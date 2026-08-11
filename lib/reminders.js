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
// Web push is passed in by the server. This module owns the database-backed
// decision and delivery lease, which keeps both halves testable.
import { db, now } from './db.js'

// Three days is the gap that leaves a weekend in it. Two days out, the answer
// to "nobody has claimed a stove" is usually that nobody is going to.
export const LEAD_DAYS = 3

// Nine in the morning, in the server's own timezone — set `TZ` to the one the
// group is camping in. The trip has coordinates, but a longitude is not a
// timezone, and a nudge that lands at 04:00 because a campsite is west of a
// meridian is worse than one that lands an hour off.
export const REMINDER_HOUR = 9

// Longer than a message's hour, because these are worth waiting for a phone to
// come back on: the morning-of nudge is still true at lunchtime.
export const REMINDER_TTL = 6 * 3600

// How long a send is allowed to be in flight before another scan may take the
// reminder back. Exported because a lease only prevents a second delivery while
// the leased attempt cannot outlast it — the server bounds its push requests
// well inside this.
export const REMINDER_LEASE_MS = 30 * 60 * 1000

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

// Each nudge has its own switch, and they are separate questions: three days
// out is about the group's list and the morning of is about your own, and
// wanting one is no reason to want the other.
const SWITCH = { unclaimed: 'remind_lead', 'own-kit': 'remind_morning' }

// Who has both halves of the answer: a device that can be reached, and a yes to
// this kind of nudge. The yes is on the account rather than the membership —
// "remind me three days before a trip" is a thing about a person, not about one
// August weekend — which is also why a member row with no account behind it is
// not reminded: it has no way to have answered.
//
// Muting is deliberately not consulted. It is the Planning Room's switch, and
// somebody who has quietened forty messages a day about which pub to stop at
// has not asked to be let down about the tent.
const remindableMembers = (tripId, kind, dueDate) => db.prepare(`
  SELECT DISTINCT p.member_id AS memberId
  FROM push_subscriptions p
  JOIN members m ON m.id = p.member_id
  JOIN users u ON u.id = m.user_id
  WHERE p.trip_id = ? AND u.${SWITCH[kind]} = 1
    AND NOT EXISTS (SELECT 1 FROM reminders_sent r
                    WHERE r.member_id = p.member_id AND r.kind = ? AND r.due_date = ?
                      AND r.delivery_state = 'sent')
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

// The sent state is written once a push service accepts the attempt, because
// delivery to a phone is not something it reports. A phone that was off gets
// the nudge when it next connects, which is what the message's TTL is for.
function claimReminder({ memberId, tripId, kind, dueDate }, claimedAt) {
  const expiredAt = new Date(new Date(claimedAt).getTime() - REMINDER_LEASE_MS).toISOString()
  return db.prepare(`INSERT INTO reminders_sent
    (member_id, trip_id, kind, due_date, sent_at, delivery_state)
    VALUES (?, ?, ?, ?, ?, 'sending')
    ON CONFLICT(member_id, kind, due_date) DO UPDATE SET
      trip_id = excluded.trip_id, sent_at = excluded.sent_at, delivery_state = 'sending'
    WHERE reminders_sent.delivery_state = 'sending' AND reminders_sent.sent_at <= ?`)
    .run(memberId, tripId, kind, dueDate, claimedAt, expiredAt).changes === 1
}

function releaseReminder({ memberId, kind, dueDate }, claimedAt) {
  db.prepare(`DELETE FROM reminders_sent
              WHERE member_id = ? AND kind = ? AND due_date = ?
                AND delivery_state = 'sending' AND sent_at = ?`)
    .run(memberId, kind, dueDate, claimedAt)
}

export function markReminderSent({ memberId, tripId, kind, dueDate }, at = now(), claimedAt = '') {
  if (claimedAt) {
    db.prepare(`UPDATE reminders_sent SET delivery_state = 'sent', sent_at = ?
                WHERE member_id = ? AND kind = ? AND due_date = ?
                  AND delivery_state = 'sending' AND sent_at = ?`)
      .run(at, memberId, kind, dueDate, claimedAt)
    return
  }
  db.prepare(`INSERT INTO reminders_sent
    (member_id, trip_id, kind, due_date, sent_at, delivery_state) VALUES (?, ?, ?, ?, ?, 'sent')
    ON CONFLICT(member_id, kind, due_date) DO UPDATE SET
      trip_id = excluded.trip_id, sent_at = excluded.sent_at, delivery_state = 'sent'`)
    .run(memberId, tripId, kind, dueDate, at)
}

export async function runReminders(at = new Date(), sendPush) {
  for (const reminder of dueReminders(at)) {
    const claimedAt = now()
    if (!claimReminder(reminder, claimedAt)) continue
    try {
      const subscriptions = db.prepare(`SELECT endpoint, p256dh, auth FROM push_subscriptions
                                        WHERE trip_id = ? AND member_id = ?`)
        .all(reminder.tripId, reminder.memberId)
      const sent = subscriptions.length && await sendPush(
        subscriptions,
        JSON.stringify(reminder.payload),
        { ttl: REMINDER_TTL, urgency: 'low' },
      )
      if (sent) markReminderSent(reminder, now(), claimedAt)
      else releaseReminder(reminder, claimedAt)
    } catch (err) {
      releaseReminder(reminder, claimedAt)
      throw err
    }
  }
}
