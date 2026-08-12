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

  // A quoted reply names one message and stops there. The quote is joined back
  // rather than copied onto the reply, so this is the read the room actually
  // makes — and a reply to a reply resolves to the message it answered, not to
  // a chain walked backwards.
  const answered = latest[1].id
  db.prepare(`INSERT INTO messages
    (trip_id, client_id, member_id, author_name, body, reply_to, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run('trip', 'client-reply', 'sam', 'Sam', 'No, Saturday morning', answered, ts)
  const quoted = db.prepare(`SELECT m.body, q.author_name AS reply_author, q.body AS reply_body
    FROM messages m LEFT JOIN messages q ON q.id = m.reply_to
    WHERE m.client_id = ?`).get('client-reply')
  assert.equal(quoted.reply_author, 'Sam')
  assert.equal(quoted.reply_body, 'Message 5')

  // Quoting across trips is how one room would become a way to read another,
  // so the route looks the reply up inside the trip. The check is the lookup
  // itself: a message from somewhere else is simply not found here.
  db.prepare('INSERT INTO trips (id, name, created_at) VALUES (?, ?, ?)').run('other', 'Other trip', ts)
  db.prepare(`INSERT INTO messages (trip_id, client_id, member_id, author_name, body, created_at)
              VALUES (?, ?, NULL, ?, ?, ?)`).run('other', 'elsewhere', 'Someone', 'Private plans', ts)
  const foreign = db.prepare('SELECT id FROM messages WHERE client_id = ?').get('elsewhere').id
  assert.equal(db.prepare('SELECT 1 AS ok FROM messages WHERE id = ? AND trip_id = ?')
    .get(foreign, 'trip'), undefined)
  // Nor is a pin a way into another room. Nothing writes this today — the route
  // looks the message up inside the trip first — but the read trip state makes
  // is the same lookup, so a row that arrived some other way, out of a restored
  // backup say, resolves to nothing rather than to that conversation.
  db.prepare('UPDATE trips SET pinned_message_id = ? WHERE id = ?').run(foreign, 'trip')
  assert.equal(db.prepare('SELECT id FROM messages WHERE id = ? AND trip_id = ?')
    .get(foreign, 'trip'), undefined)
  db.prepare('UPDATE trips SET pinned_message_id = NULL WHERE id = ?').run('trip')
  db.prepare('DELETE FROM trips WHERE id = ?').run('other')

  // One pin per trip is the column, not a rule kept on top of one: pinning
  // something else overwrites, and there is no state in which a trip has two.
  db.prepare('UPDATE trips SET pinned_message_id = ? WHERE id = ?').run(latest[0].id, 'trip')
  db.prepare('UPDATE trips SET pinned_message_id = ? WHERE id = ?').run(latest[1].id, 'trip')
  assert.equal(db.prepare('SELECT pinned_message_id FROM trips WHERE id = ?').get('trip').pinned_message_id,
    latest[1].id)

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

  // A reply outlives what it answered. Losing the quoted message costs the
  // quote and nothing else: the reply is still a message, still in the room,
  // and still says what it says.
  db.prepare('DELETE FROM messages WHERE id = ?').run(answered)
  const orphan = db.prepare('SELECT body, reply_to FROM messages WHERE client_id = ?').get('client-reply')
  assert.equal(orphan.body, 'No, Saturday morning')
  assert.equal(orphan.reply_to, null)

  // And so does the trip. That message was the pinned one, and losing it takes
  // the pin down rather than the trip with it.
  assert.equal(db.prepare('SELECT pinned_message_id FROM trips WHERE id = ?').get('trip').pinned_message_id,
    null)

  // A pinned trip still deletes. The two tables point at each other — the trip
  // names a message, the message names the trip — and the cascade has to be able
  // to walk that in one direction without the pin holding the door.
  const survivor = db.prepare('SELECT id FROM messages WHERE client_id = ?').get('client-reply').id
  db.prepare('UPDATE trips SET pinned_message_id = ? WHERE id = ?').run(survivor, 'trip')
  db.prepare('DELETE FROM trips WHERE id = ?').run('trip')
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM messages').get().n, 0)
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM trips').get().n, 0)

  db.close()
  console.log('durable chat smoke passed')
} finally {
  for (const suffix of ['', '-shm', '-wal']) rmSync(`${path}${suffix}`, { force: true })
}
