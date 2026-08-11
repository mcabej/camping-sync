// What the two nudges say, who gets them, and — the part worth guarding — that
// each one is said once. Sending needs a browser at the far end; deciding needs
// a particular Tuesday, so the clock is passed in and the database is real.
import { rmSync } from 'node:fs'
import { strict as assert } from 'node:assert'

const path = `/tmp/camping-sync-reminders-${process.pid}.db`
process.env.DB_PATH = path

try {
  const { db, now } = await import('../lib/db.js')
  const {
    REMINDER_LEASE_MS, dueReminders, markReminderSent, runReminders,
  } = await import('../lib/reminders.js')
  const ts = now()

  // Local time throughout, because a nine o'clock nudge is nine o'clock where
  // the server is. Thursday 20 August; the trip below starts on the Sunday.
  const at = (day, hour, minute = 0) => new Date(2026, 7, day, hour, minute)

  db.prepare('INSERT INTO trips (id, name, start_date, end_date, created_at) VALUES (?, ?, ?, ?, ?)')
    .run('trip', 'Pine Camp', '2026-08-23', '2026-08-25', ts)

  // The switches are on the account, so the member rows need one behind them.
  // Sam wants both; Alex is subscribed and unmuted but has never asked to be
  // reminded, which is what everybody has after the migration.
  const addUser = db.prepare(`INSERT INTO users
    (id, name, remind_lead, remind_morning, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)`)
  addUser.run('u-sam', 'Sam', 1, 1, ts, ts)
  addUser.run('u-alex', 'Alex', 0, 0, ts, ts)
  const addMember = db.prepare(`INSERT INTO members (id, trip_id, user_id, name, created_at)
                                VALUES (?, ?, ?, ?, ?)`)
  addMember.run('sam', 'trip', 'u-sam', 'Sam', ts)
  addMember.run('alex', 'trip', 'u-alex', 'Alex', ts)
  // Nobody's account, the way a member row was before sign-in existed. It has
  // no way to have answered either switch, so it is never reminded.
  addMember.run('ghost', 'trip', null, 'Ghost', ts)

  const wants = db.prepare(`INSERT INTO notification_preferences
    (member_id, trip_id, muted, last_read_message_id, updated_at)
    VALUES (?, 'trip', ?, 0, ?)`)
  wants.run('sam', 0, ts)
  wants.run('alex', 0, ts)

  const subscribe = db.prepare(`INSERT INTO push_subscriptions
    (endpoint, trip_id, member_id, p256dh, auth, created_at, updated_at)
    VALUES (?, 'trip', ?, 'public-key', 'auth-key', ?, ?)`)
  subscribe.run('https://push.example/sam', 'sam', ts, ts)
  subscribe.run('https://push.example/alex', 'alex', ts, ts)
  subscribe.run('https://push.example/ghost', 'ghost', ts, ts)

  const addItem = db.prepare(`INSERT INTO items
    (id, trip_id, list, title, kind, owner_id, position, created_at, updated_at)
    VALUES (?, 'trip', ?, ?, ?, ?, ?, ?, ?)`)
  addItem.run('tent', 'gear', 'Tent', 'shared', null, 1, ts, ts)
  addItem.run('stove', 'gear', 'Stove', 'shared', null, 2, ts, ts)
  addItem.run('firewood', 'gear', 'Firewood', 'shared', null, 3, ts, ts)
  db.prepare('INSERT INTO claims (item_id, member_id, packed) VALUES (?, ?, 0)').run('firewood', 'sam')
  // Nobody brings a hike, so an unclaimed plan is not a gap in what is packed.
  addItem.run('hike', 'activities', 'Sunset walk', 'shared', null, 4, ts, ts)

  const before = dueReminders(at(20, 8, 59))
  assert.deepEqual(before, [], 'nothing goes out before the hour')

  const lead = dueReminders(at(20, 9, 30))
  assert.equal(lead.length, 1, 'one person asked to be reminded')
  assert.equal(lead[0].memberId, 'sam')
  assert.equal(lead[0].kind, 'unclaimed')
  assert.equal(lead[0].dueDate, '2026-08-23')
  assert.equal(lead[0].payload.title, 'Pine Camp')
  assert.equal(lead[0].payload.body, 'Three days to go — 2 things nobody has claimed.')
  assert.equal(lead[0].payload.url, '/t/trip')
  assert.equal(lead[0].payload.tag, 'reminder-unclaimed-trip')

  // A slow push must not leave the reminder visible to the next scan. In
  // production the startup scan and interval (or two instances) can overlap.
  let sends = 0
  let finishSending
  const sending = new Promise((resolve) => { finishSending = resolve })
  const send = async () => {
    sends += 1
    await sending
    return true
  }
  const firstScan = runReminders(at(20, 9, 30), send)
  await Promise.resolve()
  const secondScan = runReminders(at(20, 9, 30), send)
  finishSending()
  await Promise.all([firstScan, secondScan])
  assert.equal(sends, 1, 'overlapping scans claim a reminder before sending it')
  db.prepare('DELETE FROM reminders_sent').run()

  // The other half of the lease. A claim held longer than the lease is one the
  // next scan takes back, because a process killed mid-send must not silence
  // the nudge for the rest of the day. The attempt reclaimed here never
  // answers, which is exactly why the server gives its push requests a timeout
  // far inside the lease: by the time this happens for real the first attempt
  // has given up, rather than being about to deliver a second copy.
  let abandoned = 0
  void runReminders(at(20, 9, 30), () => {
    abandoned += 1
    return new Promise(() => {})
  })
  assert.equal(abandoned, 1, 'the first scan claims and starts sending')
  const stale = new Date(Date.now() - REMINDER_LEASE_MS - 1000).toISOString()
  db.prepare(`UPDATE reminders_sent SET sent_at = ? WHERE delivery_state = 'sending'`).run(stale)

  let reclaimed = 0
  await runReminders(at(20, 9, 30), async () => { reclaimed += 1; return true })
  assert.equal(reclaimed, 1, 'an expired lease is reclaimed and tried again')
  assert.equal(db.prepare(`SELECT delivery_state FROM reminders_sent
                           WHERE member_id = 'sam'`).get().delivery_state, 'sent')
  db.prepare('DELETE FROM reminders_sent').run()

  let attempts = 0
  await runReminders(at(20, 9, 30), async () => { attempts += 1; return false })
  await runReminders(at(20, 9, 30), async () => { attempts += 1; return true })
  await runReminders(at(20, 9, 30), async () => { attempts += 1; return true })
  assert.equal(attempts, 2, 'a failed delivery releases its claim for retry')
  db.prepare('DELETE FROM reminders_sent').run()

  // Said once. The scan runs every quarter of an hour and the server may be
  // restarted between two of them; neither is a second notification.
  markReminderSent(lead[0], ts)
  assert.deepEqual(dueReminders(at(20, 9, 45)), [], 'the same nudge does not go twice')
  assert.deepEqual(dueReminders(at(20, 23, 0)), [], 'nor later the same day')

  // Muting the Planning Room is not an answer about reminders. Somebody who has
  // quietened a chat that ran all week still wants telling about the tent.
  db.prepare(`UPDATE notification_preferences SET muted = 1 WHERE member_id = 'alex'`).run()
  db.prepare(`UPDATE users SET remind_lead = 1 WHERE id = 'u-alex'`).run()
  const alsoAlex = dueReminders(at(20, 9, 50))
  assert.deepEqual(alsoAlex.map((r) => r.memberId), ['alex'],
    'a muted trip still reminds, and a member with no account never does')

  // A device that has gone: the reminder has nowhere to be, and is not recorded
  // as said, so it arrives whenever that browser comes back before the day is out.
  db.prepare(`DELETE FROM push_subscriptions WHERE member_id = 'alex'`).run()
  assert.deepEqual(dueReminders(at(20, 10, 0)), [], 'nobody to tell is not a reminder')
  subscribe.run('https://push.example/alex', 'alex', ts, ts)
  assert.equal(dueReminders(at(20, 10, 5)).length, 1, 'and it is still owed when the phone is back')
  markReminderSent(dueReminders(at(20, 10, 5))[0], ts)

  // Moving the dates makes it due again, because that is a different three days
  // out and the group deserves telling about the new one.
  db.prepare(`UPDATE trips SET start_date = '2026-08-24' WHERE id = 'trip'`).run()
  const moved = dueReminders(at(21, 9, 30))
  assert.deepEqual(moved.map((r) => r.memberId).sort(), ['alex', 'sam'])
  assert.equal(moved[0].dueDate, '2026-08-24')
  for (const reminder of moved) markReminderSent(reminder, ts)

  // A covered list has nothing to say, so it says nothing rather than saying
  // "0 things". The unticked own list is the same rule for one person.
  db.prepare(`UPDATE trips SET start_date = '2026-08-28' WHERE id = 'trip'`).run()
  const claim = db.prepare('INSERT INTO claims (item_id, member_id, packed) VALUES (?, ?, 0)')
  claim.run('tent', 'sam')
  claim.run('stove', 'alex')
  assert.deepEqual(dueReminders(at(25, 9, 30)), [], 'everything claimed is not worth a notification')

  // The morning of. Personal kit is private, so this one is counted per person:
  // Sam's two, Alex's none, and a legacy row belonging to nobody in particular.
  // Alex has said yes to the three-day nudge and nothing else, which is the
  // whole point of splitting them — that yes does not answer for this one.
  db.prepare(`UPDATE trips SET start_date = '2026-08-26' WHERE id = 'trip'`).run()
  addItem.run('bag', 'gear', 'Sleeping bag', 'own', 'sam', 5, ts, ts)
  addItem.run('torch', 'gear', 'Headtorch', 'own', 'sam', 6, ts, ts)
  addItem.run('legacy', 'gear', 'Boots', 'own', null, 7, ts, ts)

  const morning = dueReminders(at(26, 9, 5))
  assert.deepEqual(morning.map((r) => r.memberId), ['sam'], 'only the person with a list to tick')
  assert.equal(morning[0].kind, 'own-kit')
  assert.equal(morning[0].payload.body, 'Today\'s the day — 2 things on your kit list are not ticked.')
  assert.equal(morning[0].payload.tag, 'reminder-own-kit-trip')

  // One left is worth naming. A count of one is the app knowing the answer and
  // declining to say it.
  db.prepare('INSERT INTO own_checks (item_id, member_id) VALUES (?, ?)').run('torch', 'sam')
  const lastOne = dueReminders(at(26, 9, 20))
  assert.equal(lastOne[0].payload.body, 'Today\'s the day — you have not ticked Sleeping bag.')

  // And the other way round: Sam keeps the three-day switch on and turns this
  // one off, on a morning that would otherwise have gone out.
  db.prepare(`UPDATE users SET remind_morning = 0 WHERE id = 'u-sam'`).run()
  assert.deepEqual(dueReminders(at(26, 9, 30)), [],
    'only the morning switch answers for the morning')
  db.prepare(`UPDATE users SET remind_morning = 1 WHERE id = 'u-sam'`).run()

  db.prepare('INSERT INTO own_checks (item_id, member_id) VALUES (?, ?)').run('bag', 'sam')
  assert.deepEqual(dueReminders(at(26, 9, 40)), [], 'a ticked list is a quiet morning')

  // Both kinds key off the trip's start date, and they are still two reminders:
  // the morning-of one is owed even though the three-days-out one was sent
  // against the same day.
  db.prepare('DELETE FROM own_checks').run()
  markReminderSent(dueReminders(at(26, 9, 50))[0], ts)
  assert.deepEqual(dueReminders(at(26, 10, 0)), [])
  assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM reminders_sent
                           WHERE member_id = 'sam' AND due_date = '2026-08-26'`).get().n, 1)

  // A day that has been and gone is not caught up on: a server that was down
  // all Wednesday should not spend Thursday morning talking about Wednesday.
  db.prepare('DELETE FROM reminders_sent').run()
  assert.deepEqual(dueReminders(at(27, 9, 0)), [], 'yesterday is not re-sent today')

  // Leaving the trip takes the record of what was said with it, the same way it
  // takes the subscription and the preference.
  db.prepare('DELETE FROM reminders_sent').run()
  db.prepare(`DELETE FROM claims WHERE item_id = 'tent'`).run()
  db.prepare(`UPDATE trips SET start_date = '2026-08-30' WHERE id = 'trip'`).run()
  const owed = dueReminders(at(27, 9, 30))
  assert.equal(owed[0].payload.body, 'Three days to go — 1 thing nobody has claimed.')
  for (const reminder of owed) markReminderSent(reminder, ts)
  assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM reminders_sent WHERE member_id = 'sam'`).get().n, 1)
  db.prepare(`DELETE FROM members WHERE id = 'sam'`).run()
  assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM reminders_sent WHERE member_id = 'sam'`).get().n, 0)

  db.close()
  console.log('reminder smoke passed')
} finally {
  for (const suffix of ['', '-shm', '-wal']) rmSync(`${path}${suffix}`, { force: true })
}
