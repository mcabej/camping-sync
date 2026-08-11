// Focused database check for the headcount that drives quantities. Like the
// other two, no HTTP server: what needs protecting here is the migration — a
// live trip must come through it counting exactly what it counted before — and
// the catalogue rates the routes read to decide what a new row knows about
// itself.
import { rmSync } from 'node:fs'
import { strict as assert } from 'node:assert'
import { DatabaseSync } from 'node:sqlite'

const path = `/tmp/camping-sync-heads-${process.pid}.db`

// A database in the shape it had before any of this: members with no party on
// them, items with no rate, claims with no share.
const before = new DatabaseSync(path)
before.exec(`
  CREATE TABLE trips (id TEXT PRIMARY KEY, name TEXT NOT NULL, location TEXT NOT NULL DEFAULT '',
    map_url TEXT NOT NULL DEFAULT '', start_date TEXT NOT NULL DEFAULT '',
    end_date TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '',
    rev INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL);
  CREATE TABLE members (id TEXT PRIMARY KEY, trip_id TEXT NOT NULL, name TEXT NOT NULL,
    hue INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
  CREATE TABLE items (id TEXT PRIMARY KEY, trip_id TEXT NOT NULL, list TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT '', title TEXT NOT NULL, note TEXT NOT NULL DEFAULT '',
    qty TEXT NOT NULL DEFAULT '', kind TEXT NOT NULL DEFAULT 'shared',
    position REAL NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
  CREATE TABLE claims (item_id TEXT NOT NULL, member_id TEXT NOT NULL,
    packed INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (item_id, member_id));
  INSERT INTO trips VALUES ('trip', 'Old trip', '', '', '2026-09-04', '2026-09-06', '', 1, 'then');
  INSERT INTO members VALUES ('josh', 'trip', 'Josh', 0, 'then');
  INSERT INTO items VALUES ('plates', 'trip', 'gear', 'Camp kitchen', 'Plates, bowls, mugs',
    '', 'x4', 'shared', 1, 'then', 'then');
  INSERT INTO claims VALUES ('plates', 'josh', 1);
`)
before.close()

process.env.DB_PATH = path

let open = null
try {
  const { db, getTripState, headsIn, dogsIn, tripCover } = await import('../lib/db.js')
  const { catalogEntry, rateOf } = await import('../lib/catalog.js')
  open = db

  const cols = (table) => db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name)
  for (const col of ['plus_adults', 'kids', 'dogs']) assert.ok(cols('members').includes(col))
  for (const col of ['per_head', 'unit', 'per_day']) assert.ok(cols('items').includes(col))
  assert.ok(cols('claims').includes('qty'))

  // Nobody's partner, kids or dog can be guessed, so a trip that has been
  // counting one person per name goes on counting one person per name.
  const state = getTripState('trip', 'josh')
  assert.equal(headsIn(state.members), 1)
  assert.equal(dogsIn(state.members), 0)
  assert.equal(state.members[0].plus_adults, 0)

  // And an item that was there before keeps the free text somebody typed, with
  // no rate invented for it — a rate arrives from the catalogue when the row is
  // added, not by guessing at rows that already exist.
  assert.equal(state.items[0].qty, 'x4')
  assert.equal(state.items[0].per_head, 0)

  // One tap has always meant "I have got this". Zero is that answer, so every
  // claim that already existed still covers the whole of its thing.
  assert.equal(state.items[0].claims[0].qty, 0)

  // The rates the routes read when something is added by name.
  const water = catalogEntry('Drinking water')
  assert.equal(water.per_head, 4)
  assert.equal(water.unit, 'L')
  assert.equal(water.per_day, 1)
  assert.equal(catalogEntry('Plates, bowls, mugs').per_head, 1)
  assert.equal(catalogEntry('Plates, bowls, mugs').per_day, 0)
  // Personal kit is one each by definition, and firewood has no per-person
  // answer at all. Both of those are a rate of nothing rather than a rate of one.
  assert.equal(catalogEntry('Sleeping bag').per_head, 0)
  assert.equal(catalogEntry('Firewood').per_head, 0)
  // A unit is a label on a rate, so on its own it is a label on nothing.
  assert.equal(rateOf({ unit: 'L', daily: true }).per_head, 0)

  // The home page's copy of the coverage bar. One claim with no number on it is
  // still the whole of the thing, so a migrated trip reads exactly as it did.
  assert.deepEqual(tripCover('trip'), { shared: 1, open: 0, gap: 0, claims: [{ hue: 0, n: 1 }] })

  // Now give the trip a headcount and the plates a rate: seven people, one each,
  // and Josh bringing four of them. Four covered, three in the gap, and the
  // thing counts as still needing somebody — which is the whole point of it.
  db.prepare('UPDATE members SET plus_adults = 1, kids = 2, dogs = 1 WHERE id = ?').run('josh')
  db.prepare(`INSERT INTO members (id, trip_id, name, hue, created_at)
              VALUES ('sam', 'trip', 'Sam', 1, 'now')`).run()
  db.prepare(`UPDATE items SET per_head = 1 WHERE id = 'plates'`).run()
  db.prepare(`UPDATE claims SET qty = 4 WHERE item_id = 'plates'`).run()

  const short = tripCover('trip')
  assert.equal(headsIn(getTripState('trip', 'josh').members), 5)
  assert.equal(short.open, 1)
  assert.equal(Math.round(short.gap * 100) / 100, 0.2)
  assert.equal(Math.round(short.claims[0].n * 100) / 100, 0.8)

  // Sam takes the rest, and the bar closes without anybody typing a number.
  db.prepare(`INSERT INTO claims (item_id, member_id, qty) VALUES ('plates', 'sam', 0)`).run()
  const done = tripCover('trip')
  assert.equal(done.open, 0)
  assert.equal(Math.round(done.gap * 1000) / 1000, 0)
  assert.equal(Math.round(done.claims.find((c) => c.hue === 1).n * 100) / 100, 0.2)

  // Water is 4L each per day: five people over the trip's three days is 60L, so
  // one person promising 20 covers a third of it.
  db.prepare(`INSERT INTO items (id, trip_id, list, category, title, per_head, unit, per_day,
                                 position, created_at, updated_at)
              VALUES ('water', 'trip', 'drinks', 'Drinks', 'Drinking water', 4, 'L', 1, 2, 'now', 'now')`).run()
  db.prepare(`INSERT INTO claims (item_id, member_id, qty) VALUES ('water', 'josh', 20)`).run()
  assert.equal(Math.round(tripCover('trip').gap * 1000) / 1000, 0.667)

  // And the same water put down for one day of the trip is one day's worth.
  db.prepare(`UPDATE items SET day = '2026-09-05' WHERE id = 'water'`).run()
  assert.equal(tripCover('trip').gap, 0)

  console.log('headcount smoke passed')
} finally {
  // Closed here rather than at the end of the run: a failed assertion would
  // otherwise leave the file open, and Windows would report that instead of
  // the assertion that actually failed.
  open?.close()
  for (const suffix of ['', '-wal', '-shm']) rmSync(`${path}${suffix}`, { force: true })
}
