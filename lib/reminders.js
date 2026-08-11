// Two nudges, and no more than two. A planner that says something useful twice
// per trip gets opened; one that says something every day gets turned off, and
// a notification switch is only ever turned off once.
//
// Both are questions the trip can already answer without asking anybody:
//
//   Three days out — what has nobody put their name to? That is the last point
//   at which somebody can still buy, borrow or dig out the thing they are about
//   to be short of.
//   The morning of — what is still unticked on your own kit list? Nobody else
//   can bring your sleeping bag, and nobody else can see that you have not
//   packed it either.
//
// Nothing here sends anything. It reads the database and says what is due,
// which is the half worth testing: the sending needs a browser at the far end
// of it, and the deciding needs a Tuesday in March.
import { db, now } from './db.js'

// Three days is the gap that leaves a weekend in it. Two days out, the answer
// to "nobody has claimed a stove" is usually that nobody is going to.
export const LEAD_DAYS = 3

// Nine in the morning, in the server's own timezone — set `TZ` to the one the
// group is camping in. The trip has coordinates, but a longitude is not a
// timezone, and a nudge that lands at 04:00 because a campsite is west of a
// meridian is worse than one that lands an hour off.
export const REMINDER_HOUR = 9

const pad = (n) => String(n).padStart(2, '0')
const dayKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

// Noon, so adding days cannot land on the hour a clock goes forward and come
// back the day before. The same trick the countdown on the Trip tab uses.
function addDays(isoDay, days) {
  const at = new Date(`${isoDay}T12:00:00`)
  if (Number.isNaN(+at)) return ''
  at.setDate(at.getDate() + days)
  return dayKey(at)
}

// What the blaze chip means on every list, counted for the whole trip: a group
// thing with nobody's name on it. Plans are left out for the reason the Trip
// tab leaves them out of the same number — nobody brings a hike, so an
// unclaimed one is not a gap in what the group is taking.
const openCount = (tripId) => Number(db.prepare(`
  SELECT COUNT(*) AS n FROM items i
  WHERE i.trip_id = ? AND i.kind = 'shared' AND i.list != 'activities'
    AND NOT EXISTS (SELECT 1 FROM claims c WHERE c.item_id = i.id)`).get(tripId).n)

// Personal kit is private, so this is the one count that has to be per person.
// Rows with no owner are the pre-owner legacy shape and belong to nobody in
// particular: telling four people that a sleeping bag is unticked would be
// telling three of them about somebody else's list.
const untickedOwn = (tripId, memberId) => db.prepare(`
  SELECT i.title FROM items i
  WHERE i.trip_id = ? AND i.kind = 'own' AND i.owner_id = ?
    AND NOT EXISTS (SELECT 1 FROM own_checks o WHERE o.item_id = i.id AND o.member_id = ?)
  ORDER BY i.position, i.created_at`).all(tripId, memberId, memberId).map((r) => r.title)

// Who has both halves of the answer: a device that can be reached, and a yes to
// being reminded about this trip. Muting is deliberately not consulted — it is
// the Planning Room's switch, and somebody who has quietened forty messages a
// day about which pub to stop at has not asked to be let down about the tent.
const remindableMembers = (tripId, kind, dueDate) => db.prepare(`
  SELECT DISTINCT p.member_id AS memberId
  FROM push_subscriptions p
  JOIN notification_preferences n ON n.member_id = p.member_id AND n.trip_id = p.trip_id
  WHERE p.trip_id = ? AND n.reminders = 1
    AND NOT EXISTS (SELECT 1 FROM reminders_sent r
                    WHERE r.member_id = p.member_id AND r.kind = ? AND r.due_date = ?)
  ORDER BY p.member_id`).all(tripId, kind, dueDate).map((r) => r.memberId)

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

// One line each, and each one says the number and the deadline in that order,
// because the number is what makes anybody open the app and the deadline is
// what makes them open it now.
function body(kind, { open, titles }) {
  if (kind === 'unclaimed') {
    return `Three days to go — ${plural(open, 'thing', 'things')} nobody has claimed.`
  }
  return titles.length === 1
    ? `Today's the day — you have not ticked ${titles[0]}.`
    : `Today's the day — ${plural(titles.length, 'thing', 'things')} on your kit list are not ticked.`
}

// Everything owed right now, in the order it would be sent. A reminder is due
// when its day has come round and the hour has passed; a day that has been and
// gone is not caught up on, because a server that was down all Thursday should
// not spend Friday morning telling everybody about Thursday.
export function dueReminders(at = new Date()) {
  if (at.getHours() < REMINDER_HOUR) return []
  const today = dayKey(at)
  const lead = addDays(today, LEAD_DAYS)

  const trips = db.prepare(`SELECT id, name, start_date FROM trips
                            WHERE start_date IN (?, ?) ORDER BY id`).all(today, lead)

  const out = []
  for (const trip of trips) {
    // The date the nudge is about, which is the trip's own start. Both kinds
    // key off it, so moving the dates makes both of them due again — and a
    // scan that runs four times an hour never repeats either.
    const dueDate = trip.start_date
    const kind = dueDate === today ? 'own-kit' : 'unclaimed'
    const open = kind === 'unclaimed' ? openCount(trip.id) : 0
    // Nothing to report is not a quiet reminder, it is no reminder. It is also
    // not recorded as sent: a list that fills up at four in the afternoon is
    // still worth a word before the day is out.
    if (kind === 'unclaimed' && !open) continue

    for (const memberId of remindableMembers(trip.id, kind, dueDate)) {
      const titles = kind === 'own-kit' ? untickedOwn(trip.id, memberId) : []
      if (kind === 'own-kit' && !titles.length) continue
      out.push({
        tripId: trip.id,
        memberId,
        kind,
        dueDate,
        payload: {
          title: trip.name,
          body: body(kind, { open, titles }),
          // Its own tag per trip and kind, so a reminder never replaces the
          // Planning Room's notification or the other reminder.
          tag: `reminder-${kind}-${trip.id}`,
          url: `/t/${encodeURIComponent(trip.id)}`,
          tripId: trip.id,
          kind,
        },
      })
    }
  }
  return out
}

// Written after the attempt rather than after a delivery, because "delivered"
// is not a thing a push service tells us. A phone that was off gets the nudge
// when it next reaches its push service, which is what the message's TTL is
// for — and a nudge nobody can prove arrived is still one nudge.
export function markReminderSent({ memberId, tripId, kind, dueDate }, at = now()) {
  db.prepare(`INSERT OR IGNORE INTO reminders_sent
    (member_id, trip_id, kind, due_date, sent_at) VALUES (?, ?, ?, ?, ?)`)
    .run(memberId, tripId, kind, dueDate, at)
}
