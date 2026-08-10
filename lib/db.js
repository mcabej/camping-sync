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
    -- Which way the trip is facing. Off, the lists ask who is bringing what;
    -- on, they ask what is back in the car. Somebody flips it on the last
    -- morning, and it can be flipped back — a trip that ends on Sunday and
    -- carries on into a Monday of finding things is a normal trip.
    going_home  INTEGER NOT NULL DEFAULT 0,
    rev         INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS members (
    id          TEXT PRIMARY KEY,
    trip_id     TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
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

  CREATE INDEX IF NOT EXISTS idx_items_trip   ON items(trip_id, list);
  CREATE INDEX IF NOT EXISTS idx_members_trip ON members(trip_id);
  CREATE INDEX IF NOT EXISTS idx_events_trip  ON events(trip_id, created_at DESC);
`)

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

  const members = db.prepare('SELECT * FROM members WHERE trip_id = ? ORDER BY created_at').all(tripId)
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

  return {
    trip,
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
    events,
  }
}

export function nextPosition(tripId, list) {
  const row = db.prepare('SELECT MAX(position) AS m FROM items WHERE trip_id = ? AND list = ?').get(tripId, list)
  return (row?.m ?? 0) + 1
}
