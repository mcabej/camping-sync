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

  const state = getTripState('trip', 'legacy')
  assert.equal(state.viewer_id, 'legacy')
  assert.equal(state.members[0].user_id, undefined)

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
