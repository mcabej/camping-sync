// Focused database check for the account migration. No HTTP server and no real
// Google credential: this proves the durable identity/member boundary the live
// token verification writes into.
import { rmSync } from 'node:fs'
import { strict as assert } from 'node:assert'

const path = `/tmp/camping-sync-auth-${process.pid}.db`
process.env.DB_PATH = path

try {
  const { db, getTripState, now } = await import('../lib/db.js')
  const ts = now()

  db.prepare('INSERT INTO trips (id, name, created_at) VALUES (?, ?, ?)').run('trip', 'Auth trip', ts)
  db.prepare(`INSERT INTO users (id, name, email, picture, created_at, updated_at)
              VALUES (?, ?, ?, '', ?, ?)`).run('user', 'Sam', 'sam@example.com', ts, ts)
  db.prepare(`INSERT INTO members (id, trip_id, legacy_claimable, name, created_at)
              VALUES (?, ?, 1, ?, ?)`).run('legacy', 'trip', 'Sam', ts)

  assert.equal(db.prepare('SELECT user_id FROM members WHERE id = ?').get('legacy').user_id, null)
  db.prepare(`UPDATE members SET user_id = ?, legacy_claimable = 0
              WHERE id = ? AND user_id IS NULL AND legacy_claimable = 1`).run('user', 'legacy')
  assert.equal(db.prepare('SELECT user_id FROM members WHERE id = ?').get('legacy').user_id, 'user')

  assert.throws(() => db.prepare(`INSERT INTO members (id, trip_id, user_id, name, created_at)
                                  VALUES (?, ?, ?, ?, ?)`).run('duplicate', 'trip', 'user', 'Other Sam', ts))

  db.prepare(`INSERT INTO items (id, trip_id, list, title, created_at, updated_at)
              VALUES ('wood', 'trip', 'gear', 'Firewood', ?, ?)`).run(ts, ts)
  db.prepare(`INSERT INTO claims (item_id, member_id) VALUES ('wood', 'legacy')`).run()
  db.prepare(`INSERT INTO expenses
    (id, trip_id, item_id, claim_member_id, description, amount, paid_by, created_at, updated_at)
    VALUES ('wood-cost', 'trip', 'wood', 'legacy', 'Firewood', 1001, 'legacy', ?, ?)`)
    .run(ts, ts)
  db.prepare(`INSERT INTO expense_participants (expense_id, member_id)
              VALUES ('wood-cost', 'legacy')`).run()
  assert(db.prepare('PRAGMA table_info(expense_participants)').all().some((column) => column.name === 'share_amount'))

  const state = getTripState('trip', 'legacy')
  assert.equal(state.viewer_id, 'legacy')
  assert.equal(state.members[0].user_id, undefined)
  assert.equal(state.trip.currency, 'GBP')
  assert.deepEqual(state.expenses.map(({ description, amount, paid_by, participants }) => (
    { description, amount, paid_by, participants }
  )), [{ description: 'Firewood', amount: 1001, paid_by: 'legacy', participants: ['legacy'] }])
  assert.equal(state.expenses[0].shares, null)

  // Repayments ride along with the expenses, and only to somebody the trip
  // recognises. A payment to yourself is not a payment.
  db.prepare(`INSERT INTO members (id, trip_id, name, created_at) VALUES ('other', 'trip', 'Ali', ?)`).run(ts)
  db.prepare(`INSERT INTO payments (id, trip_id, from_member, to_member, amount, note, created_at)
              VALUES ('paid', 'trip', 'other', 'legacy', 500, 'Cash', ?)`).run(ts)
  assert.throws(() => db.prepare(`INSERT INTO payments (id, trip_id, from_member, to_member, amount, created_at)
                                  VALUES ('self', 'trip', 'legacy', 'legacy', 500, ?)`).run(ts))
  assert.throws(() => db.prepare(`INSERT INTO payments (id, trip_id, from_member, to_member, amount, created_at)
                                  VALUES ('free', 'trip', 'other', 'legacy', 0, ?)`).run(ts))
  assert.deepEqual(getTripState('trip', 'legacy').payments.map(({ from_member, to_member, amount, note }) => (
    { from_member, to_member, amount, note }
  )), [{ from_member: 'other', to_member: 'legacy', amount: 500, note: 'Cash' }])
  // A link opened by somebody who has not joined does not come with the ledger.
  assert.deepEqual(getTripState('trip', null).payments, [])

  // The retry key, in the exact shape the route writes it: sending the same
  // payment twice records it once. The conflict target has to name the index's
  // WHERE clause too, or a partial index refuses the clause outright — which is
  // the whole statement failing, not a missed de-duplication.
  const record = (id, clientId) => db.prepare(`INSERT INTO payments
      (id, trip_id, client_id, from_member, to_member, amount, created_at)
      VALUES (?, 'trip', ?, 'other', 'legacy', 500, ?)
      ON CONFLICT (trip_id, client_id) WHERE client_id != '' DO NOTHING`).run(id, clientId, ts)
  assert.equal(record('first', 'key').changes, 1)
  assert.equal(record('retry', 'key').changes, 0)
  assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM payments WHERE client_id = 'key'`).get().n, 1)
  // Rows with no key are not all the same payment as each other, which is what
  // keeps the index partial: 'paid' above already has none.
  assert.equal(record('keyless', '').changes, 1)

  db.prepare(`INSERT INTO sessions (token_hash, user_id, expires_at, created_at)
              VALUES ('hash', 'user', ?, ?)`).run(new Date(Date.now() + 60000).toISOString(), ts)
  db.prepare('DELETE FROM users WHERE id = ?').run('user')
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n, 0)
  assert.equal(db.prepare('SELECT user_id FROM members WHERE id = ?').get('legacy').user_id, null)
  assert.equal(db.prepare('SELECT legacy_claimable FROM members WHERE id = ?').get('legacy').legacy_claimable, 0)

  db.close()
  console.log('auth migration smoke passed')
} finally {
  for (const suffix of ['', '-shm', '-wal']) rmSync(`${path}${suffix}`, { force: true })
}
