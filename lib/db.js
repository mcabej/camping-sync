import { DatabaseSync } from 'node:sqlite'
import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { OWN_TITLES } from './catalog.js'

export const DB_PATH = process.env.DB_PATH || './data/camping.db'

mkdirSync(dirname(DB_PATH), { recursive: true })

export const db = new DatabaseSync(DB_PATH)

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS trips (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    -- Where the trip is, as one field: the real place, not a nickname for it.
    -- Picked from the search it arrives with a pin; typed by hand it is whatever
    -- you wrote, which is a fair answer in March when nothing is booked yet.
    location    TEXT NOT NULL DEFAULT '',
    lat         REAL,
    lon         REAL,
    map_url     TEXT NOT NULL DEFAULT '',
    start_date  TEXT NOT NULL DEFAULT '',
    end_date    TEXT NOT NULL DEFAULT '',
    notes       TEXT NOT NULL DEFAULT '',
    -- One currency for every shared cost on the trip. Amounts themselves are
    -- stored as integer minor units, so settling never loses a penny to
    -- floating-point arithmetic.
    currency    TEXT NOT NULL DEFAULT 'GBP',
    -- Which way the trip is facing. Off, the lists ask who is bringing what;
    -- on, they ask what is back in the car. Somebody flips it on the last
    -- morning, and it can be flipped back — a trip that ends on Sunday and
    -- carries on into a Monday of finding things is a normal trip.
    going_home  INTEGER NOT NULL DEFAULT 0,
    rev         INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL
  );

  -- A person can belong to several trips. Google proves the person once; the
  -- member row below still carries the trip-specific name, colour and diet.
  -- The two reminder switches live here rather than on a membership, because
  -- "nudge me three days before a trip" is a thing about you and not about one
  -- August weekend — and a settings page that asked it once per trip would be
  -- twenty switches for somebody with ten trips. Both start off: a reminder is
  -- the app talking, and nobody has asked it to yet.
  CREATE TABLE IF NOT EXISTS users (
    id             TEXT PRIMARY KEY,
    name           TEXT NOT NULL,
    email          TEXT NOT NULL DEFAULT '',
    picture        TEXT NOT NULL DEFAULT '',
    remind_lead    INTEGER NOT NULL DEFAULT 0,
    remind_morning INTEGER NOT NULL DEFAULT 0,
    created_at     TEXT NOT NULL,
    updated_at     TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS auth_identities (
    provider    TEXT NOT NULL,
    subject     TEXT NOT NULL,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (provider, subject),
    UNIQUE (provider, user_id)
  );

  -- Browsers keep the raw random token in an HttpOnly cookie; only its hash is
  -- stored here, so a copied database is not a bag of live login cookies.
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash  TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at  TEXT NOT NULL,
    created_at  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS members (
    id          TEXT PRIMARY KEY,
    trip_id     TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    user_id     TEXT REFERENCES users(id) ON DELETE SET NULL,
    legacy_claimable INTEGER NOT NULL DEFAULT 0,
    name        TEXT NOT NULL,
    hue         INTEGER NOT NULL DEFAULT 0,
    -- What they can and cannot eat. Shared on purpose, unlike personal kit:
    -- the whole value of it is that whoever is cooking finds out without
    -- having to ask the table one at a time.
    diet        TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS items (
    id          TEXT PRIMARY KEY,
    trip_id     TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    list        TEXT NOT NULL,
    category    TEXT NOT NULL DEFAULT '',
    title       TEXT NOT NULL,
    note        TEXT NOT NULL DEFAULT '',
    qty         TEXT NOT NULL DEFAULT '',
    -- 'shared': the group's, brought by whoever puts their name to it — see
    --           claims, which is a set rather than one person.
    -- 'own':    one person's own kit, private to owner_id. Nobody else on the
    --           trip sees the row at all.
    kind        TEXT NOT NULL DEFAULT 'shared',
    -- Set only on 'own' items. NULL on an 'own' row means it predates private
    -- personal kit and is still visible to everyone; see scripts/claim-own-items.
    owner_id    TEXT REFERENCES members(id) ON DELETE CASCADE,
    -- Where the thing happens. Only plans tend to have one — "the sunset spot"
    -- is no use to anybody who has not been there before — and like the trip's
    -- own location it carries a pin when it was picked from the search.
    place       TEXT NOT NULL DEFAULT '',
    lat         REAL,
    lon         REAL,
    -- Which day of the trip it belongs to, as an ISO date. Always optional, and
    -- empty on most things: a trip with no dates has no days to offer, and the
    -- teabags are not Saturday's. What it turns into is a heading — the Plan tab
    -- reads as an itinerary and the Eat list as meals — so the ungrouped case is
    -- not a lesser one, it is the list every tab already was.
    day         TEXT NOT NULL DEFAULT '',
    -- The hour a plan starts, as HH:MM. Only plans tend to have one: a meal is a
    -- slot rather than a time, and 18:30 on a bag of sausages is a lie.
    time        TEXT NOT NULL DEFAULT '',
    position    REAL NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
  );

  -- Who is bringing a group thing, and whether each of them has packed their
  -- share of it. A set, not a column on the item: ten people do not send one
  -- person for all the pillows, and the person who brings the bacon is not
  -- necessarily the person who brings the rest of the breakfast.
  CREATE TABLE IF NOT EXISTS claims (
    item_id     TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    member_id   TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    packed      INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (item_id, member_id)
  );

  -- Money is its own thing. Most costs are not cargo (petrol, pitch fees), and
  -- the people sharing one car need not be the whole trip. item_id plus
  -- claim_member_id is only the convenient link from a claimed list item.
  CREATE TABLE IF NOT EXISTS expenses (
    id              TEXT PRIMARY KEY,
    trip_id         TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    item_id         TEXT REFERENCES items(id) ON DELETE SET NULL,
    claim_member_id TEXT REFERENCES members(id) ON DELETE RESTRICT,
    description     TEXT NOT NULL,
    amount          INTEGER NOT NULL CHECK (amount > 0),
    paid_by         TEXT NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL,
    UNIQUE (item_id, claim_member_id)
  );

  CREATE TABLE IF NOT EXISTS expense_participants (
    expense_id  TEXT NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
    member_id   TEXT NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
    -- NULL keeps the familiar equal split. Custom splits store each person's
    -- exact share in minor units; the API makes sure the rows add to the cost.
    share_amount INTEGER CHECK (share_amount IS NULL OR share_amount > 0),
    PRIMARY KEY (expense_id, member_id)
  );

  -- Money actually handed over. An expense says what the trip spent; a payment
  -- says one person has since squared up with another, and the two net together
  -- into what is still owed. Kept as its own row rather than a flag on the
  -- netted "Sam owes Alex £12" because that line is a calculation, not a thing —
  -- it changes shape the moment somebody adds another expense, and a part
  -- payment has to survive that.
-- client_id is made by the browser before sending, the same as a message's:
  -- a field with no signal in it cannot tell a lost answer from a refused write,
  -- and pressing Record payment again must not turn one handover into two.
  CREATE TABLE IF NOT EXISTS payments (
    id          TEXT PRIMARY KEY,
    trip_id     TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    client_id   TEXT NOT NULL DEFAULT '',
    from_member TEXT NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
    to_member   TEXT NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
    amount      INTEGER NOT NULL CHECK (amount > 0),
    note        TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL,
    CHECK (from_member != to_member)
  );

  CREATE TABLE IF NOT EXISTS own_checks (
    item_id     TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    member_id   TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    PRIMARY KEY (item_id, member_id)
  );

  -- Back in the car on the way home. A second set of ticks rather than a reuse
  -- of the first: "I packed the stove on Friday" and "the stove is in the boot
  -- on Sunday" are different facts, and clearing Friday's answer to record
  -- Sunday's would throw away the only record of who brought what.
  --
  -- One shape for both kinds of item, the way own_checks and votes are: a set
  -- of ticks, one per person per thing. On a group item every person who put
  -- their name down has their own to give, because they each carried a piece.
  CREATE TABLE IF NOT EXISTS stows (
    item_id     TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    member_id   TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    PRIMARY KEY (item_id, member_id)
  );

  CREATE TABLE IF NOT EXISTS votes (
    item_id     TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    member_id   TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    PRIMARY KEY (item_id, member_id)
  );

  CREATE TABLE IF NOT EXISTS events (
    id          TEXT PRIMARY KEY,
    trip_id     TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    actor       TEXT NOT NULL DEFAULT '',
    text        TEXT NOT NULL,
    created_at  TEXT NOT NULL
  );

  -- The planning thread is durable trip history, not part of the short activity
  -- feed. The author's name is copied onto the message so removing a member
  -- does not turn old decisions into messages from nobody. client_id is made by
  -- the browser before sending, which makes an uncertain network retry safe.
  CREATE TABLE IF NOT EXISTS messages (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    trip_id     TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    client_id   TEXT NOT NULL,
    member_id   TEXT REFERENCES members(id) ON DELETE SET NULL,
    role        TEXT NOT NULL DEFAULT 'member',
    author_name TEXT NOT NULL,
    body        TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    UNIQUE (trip_id, client_id)
  );

  -- One browser push subscription can follow the same person across several
  -- trips. Keeping the trip/member mapping on each row makes delivery a small
  -- indexed query and lets a membership deletion remove its alerts with it.
  CREATE TABLE IF NOT EXISTS push_subscriptions (
    endpoint    TEXT NOT NULL,
    trip_id     TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    member_id   TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    p256dh      TEXT NOT NULL,
    auth        TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    PRIMARY KEY (endpoint, member_id)
  );

  -- Muting and read position belong to the member, not one of their devices.
  -- A phone and laptop therefore agree about whether this room is quiet and
  -- whether its latest messages have already been seen.
  CREATE TABLE IF NOT EXISTS notification_preferences (
    member_id            TEXT PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
    trip_id              TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    muted                INTEGER NOT NULL DEFAULT 0,
    last_read_message_id INTEGER NOT NULL DEFAULT 0,
    updated_at           TEXT NOT NULL
  );

  -- What has already been said, so it is said once. The key is the day the
  -- reminder is about rather than the day it went out: a scan that runs every
  -- quarter of an hour, a server restarted twice before lunch and a phone that
  -- was off all morning are one nudge between them. Move the trip's dates and
  -- the key moves with them, which is right — that is a different three days
  -- out, and the group deserves telling about the new one.
  CREATE TABLE IF NOT EXISTS reminders_sent (
    member_id     TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    trip_id       TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    kind          TEXT NOT NULL,
    due_date      TEXT NOT NULL,
    sent_at       TEXT NOT NULL,
    delivery_state TEXT NOT NULL DEFAULT 'sent'
      CHECK (delivery_state IN ('sending', 'sent')),
    PRIMARY KEY (member_id, kind, due_date)
  );

  -- Development installs generate VAPID keys once and retain them here.
  -- Production can override them with environment variables without changing
  -- existing schema or subscription handling.
  CREATE TABLE IF NOT EXISTS app_settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_payments_trip ON payments(trip_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_items_trip   ON items(trip_id, list);
  CREATE INDEX IF NOT EXISTS idx_members_trip ON members(trip_id);
  CREATE INDEX IF NOT EXISTS idx_events_trip  ON events(trip_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_messages_trip ON messages(trip_id, id DESC);
  CREATE INDEX IF NOT EXISTS idx_push_trip ON push_subscriptions(trip_id, member_id);
  CREATE INDEX IF NOT EXISTS idx_notification_trip ON notification_preferences(trip_id, member_id);
  CREATE INDEX IF NOT EXISTS idx_reminders_sent_trip ON reminders_sent(trip_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);
`)

// A sending row is a short lease: it closes the read/send/write race between
// scans, while a crashed or failed attempt can still be tried again.
if (!db.prepare('PRAGMA table_info(reminders_sent)').all().some((c) => c.name === 'delivery_state')) {
  db.exec(`ALTER TABLE reminders_sent ADD COLUMN delivery_state TEXT NOT NULL DEFAULT 'sent'
           CHECK (delivery_state IN ('sending', 'sent'))`)
}

// Trips created before the shared/own split have every item as shared. Flag the
// ones we know are one-each, so existing trips get the fix rather than just new ones.
const itemCols = () => db.prepare('PRAGMA table_info(items)').all().map((c) => c.name)

if (!itemCols().includes('kind')) {
  db.exec(`ALTER TABLE items ADD COLUMN kind TEXT NOT NULL DEFAULT 'shared'`)
  const setOwn = db.prepare(`UPDATE items SET kind = 'own', assignee_id = NULL, packed = 0
                             WHERE lower(title) = ?`)
  for (const title of OWN_TITLES) setOwn.run(title)
}

// Personal kit used to be a shared checklist everyone ticked their own copy of,
// so existing 'own' rows have no owner. Deliberately left NULL rather than
// guessed at: an owner picked wrong hides somebody's kit from them. They keep
// behaving as they did until scripts/claim-own-items.js assigns them for real.
if (!itemCols().includes('owner_id')) {
  db.exec('ALTER TABLE items ADD COLUMN owner_id TEXT REFERENCES members(id) ON DELETE CASCADE')
}

// One thing used to have one person: assignee_id, and a single packed flag that
// belonged to the item rather than to anyone. Both move into claims, where the
// person who put their name down keeps it and their tick comes with them. The
// columns go with the assumption — nothing reads them any more, and leaving them
// behind would leave two answers to "who is bringing this" in the same row.
if (itemCols().includes('assignee_id')) {
  db.exec(`INSERT OR IGNORE INTO claims (item_id, member_id, packed)
           SELECT id, assignee_id, packed FROM items WHERE assignee_id IS NOT NULL`)
  db.exec('ALTER TABLE items DROP COLUMN assignee_id')
  db.exec('ALTER TABLE items DROP COLUMN packed')
}

// A plan can have a place of its own: "sunset at the point" is a different
// question from where the tents are. Empty on everything that already exists,
// because there is nothing to guess from a title.
if (!itemCols().includes('place')) {
  db.exec(`ALTER TABLE items ADD COLUMN place TEXT NOT NULL DEFAULT ''`)
  db.exec('ALTER TABLE items ADD COLUMN lat REAL')
  db.exec('ALTER TABLE items ADD COLUMN lon REAL')
}

// Nothing already on a trip can be dated by guessing. A dinner is not Saturday's
// because the trip has a Saturday, and a plan filed under "After dark" is not
// Friday night — so every existing row starts with no day, which is exactly the
// list it was already drawing.
if (!itemCols().includes('day')) {
  db.exec(`ALTER TABLE items ADD COLUMN day TEXT NOT NULL DEFAULT ''`)
  db.exec(`ALTER TABLE items ADD COLUMN time TEXT NOT NULL DEFAULT ''`)
}

// Drinks used to be filed hot or cold, and water apart from both, which are
// facts about the drink rather than about the trip: nobody packs the tea
// separately from the beer. One heading now, so the catalogue and the rows
// already on people's lists agree. Every past spelling is matched, because an
// earlier pass renamed some of these once already.
db.exec(`UPDATE items SET category = 'Drinks'
         WHERE list = 'drinks'
           AND category IN ('Water', 'Hot', 'Cold', 'Hot drinks', 'Cold drinks')`)

// The drinks list is things you can drink. A cooler is not one, and it was the
// only thing on there you could not open and swallow — it is kit, so it belongs
// with the other kit. It goes to the end of the packing list rather than
// keeping the position it held on a list it has left.
db.exec(`
  UPDATE items SET list = 'gear', category = 'Camp kitchen',
    position = COALESCE((SELECT MAX(g.position) FROM items g
                         WHERE g.trip_id = items.trip_id AND g.list = 'gear'), 0) + 1
  WHERE list = 'drinks' AND lower(title) = 'a second cooler for drinks'`)

const tripCols = () => db.prepare('PRAGMA table_info(trips)').all().map((c) => c.name)

// Existing trips use the product's original currency until somebody changes it
// from Settle up. Nothing is inferred from a browser locale.
if (!tripCols().includes('currency')) {
  db.exec(`ALTER TABLE trips ADD COLUMN currency TEXT NOT NULL DEFAULT 'GBP'`)
}

const expenseParticipantCols = () => db.prepare('PRAGMA table_info(expense_participants)').all().map((c) => c.name)

// Rows from the original money feature mean "split equally". NULL preserves
// that meaning while allowing newer expenses to carry exact per-person shares.
if (!expenseParticipantCols().includes('share_amount')) {
  db.exec(`ALTER TABLE expense_participants
           ADD COLUMN share_amount INTEGER CHECK (share_amount IS NULL OR share_amount > 0)`)
}

const paymentCols = () => db.prepare('PRAGMA table_info(payments)').all().map((c) => c.name)

// The retry key arrived after the table did, so it is added rather than assumed.
// Its uniqueness is a partial index: rows written without a key — a fixture, or
// anything predating this — are not all "the same payment" as each other. The
// index has to be made here rather than with the schema, because on an existing
// database the column it names does not exist until the line above it has run.
if (!paymentCols().includes('client_id')) {
  db.exec(`ALTER TABLE payments ADD COLUMN client_id TEXT NOT NULL DEFAULT ''`)
}
db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_client
         ON payments(trip_id, client_id) WHERE client_id != ''`)

const claimCols = () => db.prepare('PRAGMA table_info(claims)').all().map((c) => c.name)

// The first money draft stored a cost on a packing claim and implicitly split
// it across the whole trip. Preserve any such rows as ordinary expenses; the
// old columns can remain harmlessly on an already-created SQLite table.
if (claimCols().includes('cost') && claimCols().includes('paid_by')) {
  const legacy = db.prepare(`
    SELECT c.item_id, c.member_id, c.cost, COALESCE(c.paid_by, c.member_id) AS paid_by,
           i.trip_id, i.title
    FROM claims c JOIN items i ON i.id = c.item_id
    WHERE c.cost > 0`).all()
  const exists = db.prepare('SELECT 1 FROM expenses WHERE item_id = ? AND claim_member_id = ?')
  const addExpense = db.prepare(`INSERT INTO expenses
    (id, trip_id, item_id, claim_member_id, description, amount, paid_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  const addParticipant = db.prepare('INSERT INTO expense_participants (expense_id, member_id) VALUES (?, ?)')
  const tripMembers = db.prepare('SELECT id FROM members WHERE trip_id = ? ORDER BY created_at')
  db.exec('BEGIN')
  try {
    for (const row of legacy) {
      if (exists.get(row.item_id, row.member_id)) continue
      const id = randomUUID()
      const ts = new Date().toISOString()
      addExpense.run(id, row.trip_id, row.item_id, row.member_id, row.title, row.cost, row.paid_by, ts, ts)
      for (const member of tripMembers.all(row.trip_id)) addParticipant.run(id, member.id)
    }
    db.exec('UPDATE claims SET cost = 0, paid_by = NULL WHERE cost > 0')
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

if (!tripCols().includes('map_url')) {
  db.exec(`ALTER TABLE trips ADD COLUMN map_url TEXT NOT NULL DEFAULT ''`)
}

// A place picked from the search brings its coordinates with it, so the map link
// is the actual pin rather than a search for the words.
for (const col of ['lat', 'lon']) {
  if (!tripCols().includes(col)) db.exec(`ALTER TABLE trips ADD COLUMN ${col} REAL`)
}

// Where a trip is used to be two questions — what you call it, and the address —
// which let a trip say "the lake" and stop there. It is one question now, so the
// address a trip already has becomes its location, and the column goes with the
// distinction. Trips that only ever had the nickname keep it: it is still the
// best answer anyone gave.
if (tripCols().includes('address')) {
  db.exec(`UPDATE trips SET location = address WHERE trim(address) != ''`)
  db.exec('ALTER TABLE trips DROP COLUMN address')
}

// Every trip that already exists is facing outwards, which is the default and
// also the truth: nothing has been packed down yet.
if (!tripCols().includes('going_home')) {
  db.exec('ALTER TABLE trips ADD COLUMN going_home INTEGER NOT NULL DEFAULT 0')
}

// Nobody's dietary needs can be guessed from anything already in the database,
// so this starts empty and stays empty until somebody says.
if (!db.prepare('PRAGMA table_info(members)').all().map((c) => c.name).includes('diet')) {
  db.exec(`ALTER TABLE members ADD COLUMN diet TEXT NOT NULL DEFAULT ''`)
}

// Existing member rows predate accounts. They remain usable on the device that
// remembers them until that person signs in, when the client attaches the row
// to a user. NULL is therefore a deliberate migration state, not a guest type.
if (!db.prepare('PRAGMA table_info(members)').all().map((c) => c.name).includes('user_id')) {
  db.exec('ALTER TABLE members ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE SET NULL')
}

// Only rows that really existed before accounts get the one-time device claim
// bridge. A placeholder somebody adds to assign them bacon tomorrow is not an
// identity credential and must never become claimable through this migration.
if (!db.prepare('PRAGMA table_info(members)').all().map((c) => c.name).includes('legacy_claimable')) {
  db.exec('ALTER TABLE members ADD COLUMN legacy_claimable INTEGER NOT NULL DEFAULT 0')
  db.exec('UPDATE members SET legacy_claimable = 1 WHERE user_id IS NULL')
}

// Assistant replies share the durable planning thread. Existing rows are all
// member-authored, so the default is also the complete migration.
if (!db.prepare('PRAGMA table_info(messages)').all().map((c) => c.name).includes('role')) {
  db.exec(`ALTER TABLE messages ADD COLUMN role TEXT NOT NULL DEFAULT 'member'`)
}

// Everybody who is already subscribed said yes to the Planning Room, and to
// nothing else. Defaulting either of these to on would read that answer as an
// answer to a question nobody was asked, and the first they would hear of it
// is their phone going off at nine in the morning.
const userCols = () => db.prepare('PRAGMA table_info(users)').all().map((c) => c.name)
for (const col of ['remind_lead', 'remind_morning']) {
  if (!userCols().includes(col)) {
    db.exec(`ALTER TABLE users ADD COLUMN ${col} INTEGER NOT NULL DEFAULT 0`)
  }
}

db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_members_trip_user
         ON members(trip_id, user_id) WHERE user_id IS NOT NULL`)

export const uid = () => randomUUID()
export const now = () => new Date().toISOString()

// Readable trip codes, so they survive being read aloud in a group chat.
const FIRST = ['pine', 'cedar', 'birch', 'alder', 'willow', 'aspen', 'maple', 'rowan', 'fern', 'moss', 'stone', 'river', 'lake', 'ridge', 'creek', 'meadow', 'hollow', 'summit', 'ember', 'canvas']
const SECOND = ['camp', 'ridge', 'trail', 'bend', 'field', 'grove', 'point', 'gap', 'fork', 'rest', 'hollow', 'flats', 'crossing', 'landing']

export function newTripCode() {
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
  const exists = db.prepare('SELECT 1 FROM trips WHERE id = ?')
  for (let i = 0; i < 40; i++) {
    const code = `${pick(FIRST)}-${pick(SECOND)}-${100 + Math.floor(Math.random() * 900)}`
    if (!exists.get(code)) return code
  }
  return randomUUID().slice(0, 12)
}

export function bumpRev(tripId) {
  db.prepare('UPDATE trips SET rev = rev + 1 WHERE id = ?').run(tripId)
}

export function logEvent(tripId, actor, text) {
  db.prepare('INSERT INTO events (id, trip_id, actor, text, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(uid(), tripId, actor || '', text, now())
  // Keep the feed to the last 60 entries per trip.
  db.prepare(`
    DELETE FROM events WHERE trip_id = ? AND id NOT IN (
      SELECT id FROM events WHERE trip_id = ? ORDER BY created_at DESC LIMIT 60
    )`).run(tripId, tripId)
}

// Personal kit is private, list and all: an 'own' item belongs to one person and
// nobody else on the trip is told it exists. Legacy rows with no owner are the
// one exception — they stay visible to everyone until they are claimed, because
// vanishing somebody's packing list is worse than the leak we are closing.
export function getTripState(tripId, viewerId = null) {
  const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(tripId)
  if (!trip) return null

  // user_id is an internal authorization link, not trip state. Keeping it out
  // also means clients cannot start treating it as another public member id.
  //
  // The picture is Google's, by way of whoever signed in, and it goes only to
  // people who are on the trip. A link can be forwarded further than it was
  // meant to go, and to somebody who has not joined, a row of faces is a set of
  // photographs of strangers handed over for nothing — so it waits behind the
  // same door the ledger does. A name they can have: it is what the invitation
  // is about.
  const members = db.prepare(`
    SELECT m.id, m.trip_id, m.name, m.hue, m.diet, m.created_at, u.picture
    FROM members m LEFT JOIN users u ON u.id = m.user_id
    WHERE m.trip_id = ? ORDER BY m.created_at`).all(tripId)
    .map((m) => ({ ...m, picture: viewerId ? m.picture ?? '' : '' }))
  const items = db.prepare(`
    SELECT * FROM items
    WHERE trip_id = ? AND (kind != 'own' OR owner_id IS NULL OR owner_id = ?)
    ORDER BY position, created_at`).all(tripId, viewerId)
  const votes = db.prepare(`
    SELECT v.item_id, v.member_id FROM votes v
    JOIN items i ON i.id = v.item_id WHERE i.trip_id = ?`).all(tripId)
  // In the order people joined, so the row of faces beside an item is the same
  // row of faces every time it is drawn.
  const claims = db.prepare(`
    SELECT c.item_id, c.member_id, c.packed FROM claims c
    JOIN items i ON i.id = c.item_id
    JOIN members m ON m.id = c.member_id
    WHERE i.trip_id = ? ORDER BY m.created_at`).all(tripId)
  // A link can be opened before somebody joins, but the group's money is not
  // part of that invitation. Only a recognized member receives the ledger.
  const expenses = viewerId ? db.prepare(`
    SELECT * FROM expenses WHERE trip_id = ? ORDER BY created_at, id`).all(tripId) : []
  const expenseParticipants = viewerId ? db.prepare(`
    SELECT p.expense_id, p.member_id, p.share_amount FROM expense_participants p
    JOIN expenses e ON e.id = p.expense_id
    JOIN members m ON m.id = p.member_id
    WHERE e.trip_id = ? ORDER BY m.created_at`).all(tripId) : []
  const payments = viewerId ? db.prepare(`
    SELECT * FROM payments WHERE trip_id = ? ORDER BY created_at, id`).all(tripId) : []
  const owns = db.prepare(`
    SELECT o.item_id, o.member_id FROM own_checks o
    JOIN items i ON i.id = o.item_id WHERE i.trip_id = ?`).all(tripId)
  const stows = db.prepare(`
    SELECT s.item_id, s.member_id FROM stows s
    JOIN items i ON i.id = s.item_id WHERE i.trip_id = ?`).all(tripId)
  const events = db.prepare('SELECT * FROM events WHERE trip_id = ? ORDER BY created_at DESC LIMIT 40').all(tripId)

  const collect = (rows) => {
    const by = new Map()
    for (const r of rows) {
      if (!by.has(r.item_id)) by.set(r.item_id, [])
      by.get(r.item_id).push(r.member_id)
    }
    return by
  }
  const byVote = collect(votes)
  const byOwn = collect(owns)
  const byStow = collect(stows)

  const byClaim = new Map()
  for (const c of claims) {
    if (!byClaim.has(c.item_id)) byClaim.set(c.item_id, [])
    byClaim.get(c.item_id).push({ member_id: c.member_id, packed: !!c.packed })
  }

  const byExpense = new Map()
  const byExpenseShare = new Map()
  for (const row of expenseParticipants) {
    if (!byExpense.has(row.expense_id)) byExpense.set(row.expense_id, [])
    byExpense.get(row.expense_id).push(row.member_id)
    if (row.share_amount !== null) {
      if (!byExpenseShare.has(row.expense_id)) byExpenseShare.set(row.expense_id, {})
      byExpenseShare.get(row.expense_id)[row.member_id] = row.share_amount
    }
  }

  return {
    trip,
    viewer_id: viewerId,
    members,
    items: items.map((i) => ({
      ...i,
      claims: byClaim.get(i.id) ?? [],
      votes: byVote.get(i.id) ?? [],
      own: viewerId && (byOwn.get(i.id) ?? []).includes(viewerId) ? [viewerId] : [],
      // A group thing's stows are the group's business — the point of the
      // pack-down is that everyone can see what is still missing. A personal
      // item's are as private as the item, which is why only the viewer's come
      // back: the same cut own_checks gets, for the same reason.
      stows: i.kind === 'own'
        ? (viewerId && (byStow.get(i.id) ?? []).includes(viewerId) ? [viewerId] : [])
        : (byStow.get(i.id) ?? []),
    })),
    expenses: expenses.map((expense) => ({
      ...expense,
      participants: byExpense.get(expense.id) ?? [],
      shares: byExpenseShare.get(expense.id) ?? null,
    })),
    payments,
    events,
  }
}

export function nextPosition(tripId, list) {
  const row = db.prepare('SELECT MAX(position) AS m FROM items WHERE trip_id = ? AND list = ?').get(tripId, list)
  return (row?.m ?? 0) + 1
}
