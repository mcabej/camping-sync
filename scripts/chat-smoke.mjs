// Focused database check for durable trip messages. HTTP behaviour is kept
// thin; these assertions protect the persistence, idempotency and deletion
// semantics the routes rely on.
import { rmSync } from 'node:fs'
import { strict as assert } from 'node:assert'

const path = `/tmp/camping-sync-chat-${process.pid}.db`
process.env.DB_PATH = path

try {
  const { db, now } = await import('../lib/db.js')
  const ts = now()

  db.prepare('INSERT INTO trips (id, name, created_at) VALUES (?, ?, ?)').run('trip', 'Chat trip', ts)
  db.prepare(`INSERT INTO members (id, trip_id, name, created_at)
              VALUES (?, ?, ?, ?)`).run('sam', 'trip', 'Sam', ts)

  const insert = db.prepare(`INSERT INTO messages
    (trip_id, client_id, member_id, author_name, body, created_at)
    VALUES (?, ?, ?, ?, ?, ?)`)
  for (let i = 1; i <= 5; i++) {
    insert.run('trip', `client-${i}`, 'sam', 'Sam', `Message ${i}`, ts)
  }

  const retry = db.prepare(`INSERT INTO messages
    (trip_id, client_id, member_id, author_name, body, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT (trip_id, client_id) DO NOTHING`)
    .run('trip', 'client-5', 'sam', 'Sam', 'Message 5', ts)
  assert.equal(retry.changes, 0)
  assert.equal(db.prepare('SELECT body FROM messages WHERE client_id = ?').get('client-5').body, 'Message 5')
  assert.equal(db.prepare('SELECT role FROM messages WHERE client_id = ?').get('client-5').role, 'member')

  const latest = db.prepare(`SELECT id, body FROM messages WHERE trip_id = ?
                             ORDER BY id DESC LIMIT 2`).all('trip').reverse()
  assert.deepEqual(latest.map((m) => m.body), ['Message 4', 'Message 5'])
  const older = db.prepare(`SELECT body FROM messages WHERE trip_id = ? AND id < ?
                            ORDER BY id DESC LIMIT 2`).all('trip', latest[0].id).reverse()
  assert.deepEqual(older.map((m) => m.body), ['Message 2', 'Message 3'])

  db.prepare(`INSERT INTO messages
    (trip_id, client_id, member_id, role, author_name, body, created_at)
    VALUES (?, ?, NULL, 'assistant', 'Camp', ?, ?)`)
    .run('trip', 'assistant:run-1', 'Bring a tarp for the forecast rain.', ts)
  const assistant = db.prepare('SELECT role, member_id, author_name FROM messages WHERE client_id = ?')
    .get('assistant:run-1')
  assert.equal(assistant.role, 'assistant')
  assert.equal(assistant.member_id, null)
  assert.equal(assistant.author_name, 'Camp')

  db.prepare(`INSERT INTO notification_preferences
    (member_id, trip_id, muted, last_read_message_id, updated_at)
    VALUES (?, ?, 1, ?, ?)`).run('sam', 'trip', latest[0].id, ts)
  db.prepare(`INSERT INTO push_subscriptions
    (endpoint, trip_id, member_id, p256dh, auth, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run('https://push.example/subscription', 'trip', 'sam', 'public-key', 'auth-key', ts, ts)
  assert.equal(db.prepare('SELECT muted FROM notification_preferences WHERE member_id = ?').get('sam').muted, 1)
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM push_subscriptions WHERE trip_id = ?').get('trip').n, 1)

  db.prepare('DELETE FROM members WHERE id = ?').run('sam')
  const kept = db.prepare('SELECT member_id, author_name FROM messages WHERE id = ?').get(latest[1].id)
  assert.equal(kept.member_id, null)
  assert.equal(kept.author_name, 'Sam')
  assert.equal(db.prepare('SELECT body FROM messages WHERE client_id = ?')
    .get('assistant:run-1').body, 'Bring a tarp for the forecast rain.')
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM push_subscriptions').get().n, 0)
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM notification_preferences').get().n, 0)

  db.prepare('DELETE FROM trips WHERE id = ?').run('trip')
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM messages').get().n, 0)

  db.close()
  console.log('durable chat smoke passed')
} finally {
  for (const suffix of ['', '-shm', '-wal']) rmSync(`${path}${suffix}`, { force: true })
}
