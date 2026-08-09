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
    rev         INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS members (
    id          TEXT PRIMARY KEY,
    trip_id     TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    hue         INTEGER NOT NULL DEFAULT 0,
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
    -- 'shared': one person brings it for the group, tracked by assignee_id.
    -- 'own':    one person's own kit, private to owner_id. Nobody else on the
    --           trip sees the row at all.
    kind        TEXT NOT NULL DEFAULT 'shared',
    assignee_id TEXT REFERENCES members(id) ON DELETE SET NULL,
    -- Set only on 'own' items. NULL on an 'own' row means it predates private
    -- personal kit and is still visible to everyone; see scripts/claim-own-items.
    owner_id    TEXT REFERENCES members(id) ON DELETE CASCADE,
    packed      INTEGER NOT NULL DEFAULT 0,
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

  CREATE TABLE IF NOT EXISTS own_checks (
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

// A plan can have a place of its own: "sunset at the point" is a different
// question from where the tents are. Empty on everything that already exists,
// because there is nothing to guess from a title.
if (!itemCols().includes('place')) {
  db.exec(`ALTER TABLE items ADD COLUMN place TEXT NOT NULL DEFAULT ''`)
  db.exec('ALTER TABLE items ADD COLUMN lat REAL')
  db.exec('ALTER TABLE items ADD COLUMN lon REAL')
}

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
  const owns = db.prepare(`
    SELECT o.item_id, o.member_id FROM own_checks o
    JOIN items i ON i.id = o.item_id WHERE i.trip_id = ?`).all(tripId)
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

  return {
    trip,
    members,
    items: items.map((i) => ({
      ...i,
      packed: !!i.packed,
      votes: byVote.get(i.id) ?? [],
      own: viewerId && (byOwn.get(i.id) ?? []).includes(viewerId) ? [viewerId] : [],
    })),
    events,
  }
}

export function nextPosition(tripId, list) {
  const row = db.prepare('SELECT MAX(position) AS m FROM items WHERE trip_id = ? AND list = ?').get(tripId, list)
  return (row?.m ?? 0) + 1
}
