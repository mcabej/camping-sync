// One-off: give the pre-privacy personal-kit items an owner.
//
// Personal kit used to be a shared checklist — one row, everyone ticking their
// own copy — so those rows have no owner_id and are still visible to the whole
// trip. This works out who each one belongs to and hands it over, which is what
// makes it disappear from everybody else's list.
//
// Most of them turn out to belong to nobody: the old trip-creation step seeded
// the standard one-each checklist into every trip, so those rows are a template
// nobody typed and nobody ticked. New trips no longer get them at all.
//
// Evidence, strongest first:
//   1. the activity feed, which recorded "<name> added <title>" at the time
//   2. an own_check, which says that person considered it theirs and packed it
//   3. a batch-mate: one "add these" tap stamps every row it wrote with the
//      same millisecond, so a row alongside an attributed one shares its owner
//   4. failing all three: written in the same instant the trip was created, and
//      never ticked — a seeded template row, owned by no one
//
// Anything it cannot place is left alone and reported, because an owner guessed
// wrong hides somebody's kit from them — worse than the leak. Where a human
// knows the answer the evidence cannot reach, --assign-rest records that.
//
//   node scripts/claim-own-items.js                  # report only, changes nothing
//   node scripts/claim-own-items.js --apply          # write the owners it is sure of
//   node scripts/claim-own-items.js --apply --drop-template
//                                                   # also delete the untouched template rows
//   node scripts/claim-own-items.js --apply --assign-rest <trip>=<name>
//                                                   # hand this trip's leftovers to one person
//
// Point DB_PATH at the database you mean to touch.

// Importing the app's own database module rather than opening a second
// connection means this runs against exactly the schema the server expects, and
// brings a database that has not met the new column up to date on the way in.
import { db, DB_PATH } from '../lib/db.js'

const APPLY = process.argv.includes('--apply')
const DROP = process.argv.includes('--drop-template')

// --assign-rest <tripId>=<member name>, repeatable. The one place a person
// overrules the evidence, for the batches whose feed entries aged out.
const ASSIGN = new Map()
for (let i = 0; i < process.argv.length; i++) {
  if (process.argv[i] !== '--assign-rest') continue
  const [tripId, name] = String(process.argv[i + 1] ?? '').split('=')
  if (!tripId || !name) {
    console.error('--assign-rest needs <tripId>=<member name>')
    process.exit(1)
  }
  ASSIGN.set(tripId, name)
}
const orphans = db.prepare(`
  SELECT id, trip_id, list, category, title, created_at
  FROM items WHERE kind = 'own' AND owner_id IS NULL
  ORDER BY trip_id, created_at`).all()

if (!orphans.length) {
  console.log(`Nothing to do: no unowned personal-kit items in ${DB_PATH}.`)
  process.exit(0)
}

const memberNamed = db.prepare('SELECT id, name FROM members WHERE trip_id = ? AND lower(name) = lower(?)')
const addedEvent = db.prepare(`
  SELECT actor FROM events
  WHERE trip_id = ? AND lower(text) = lower(?) AND actor != ''
  ORDER BY created_at LIMIT 2`)
const checkers = db.prepare(`
  SELECT m.id, m.name FROM own_checks o JOIN members m ON m.id = o.member_id
  WHERE o.item_id = ?`)

// Two people called Sam on one trip would make the feed's actor name ambiguous,
// so a name that matches more than one member is treated as no evidence at all.
function fromFeed(item) {
  const rows = addedEvent.all(item.trip_id, `added ${item.title}`)
  if (rows.length !== 1) return null
  const matches = memberNamed.all(item.trip_id, rows[0].actor)
  return matches.length === 1 ? { member: matches[0], why: `feed: "${rows[0].actor} added ${item.title}"` } : null
}

function fromTicks(item) {
  const rows = checkers.all(item.id)
  return rows.length === 1 ? { member: rows[0], why: `only ${rows[0].name} had packed it` } : null
}

const tripCreated = db.prepare('SELECT created_at FROM trips WHERE id = ?')
const batchMates = db.prepare('SELECT id, title FROM items WHERE trip_id = ? AND created_at = ? AND id != ?')

// Seeding ran inside trip creation, so every template row carries the trip's
// creation timestamp to the millisecond — nobody adds an item in the same
// instant the trip is made. The title is not checked: the catalogue has been
// edited since, and several titles it used to seed as one-each it no longer does.
function isTemplate(item) {
  if (checkers.all(item.id).length) return false
  return item.created_at === tripCreated.get(item.trip_id)?.created_at
}

const claim = db.prepare('UPDATE items SET owner_id = ? WHERE id = ?')
const drop = db.prepare('DELETE FROM items WHERE id = ?')
const decided = [], template = [], undecided = []

for (const item of orphans) {
  const found = fromFeed(item) ?? fromTicks(item)
  if (found) decided.push({ item, ...found })
  else if (isTemplate(item)) template.push(item)
  else undecided.push(item)
}

// One "add these" tap writes every item it added in the same millisecond, so a
// row sitting in a batch with something already attributed came from the same
// person's tap. This is what rescues the bulk adds whose feed entries have since
// been pruned — the feed only keeps the last 60 entries per trip.
const owned = new Map(decided.map((d) => [d.item.id, d.member]))
for (let pass = 0; pass < 2; pass++) {
  for (let i = undecided.length - 1; i >= 0; i--) {
    const item = undecided[i]
    const mates = batchMates.all(item.trip_id, item.created_at, item.id)
    const found = [...new Set(mates.map((m) => owned.get(m.id)).filter(Boolean))]
    if (found.length !== 1) continue
    const mate = mates.find((m) => owned.get(m.id) === found[0])
    decided.push({ item, member: found[0], why: `added in the same batch as ${mate.title}` })
    owned.set(item.id, found[0])
    undecided.splice(i, 1)
  }
}

// Told, not deduced. Applied last so it only ever picks up what the evidence
// genuinely could not place, and never overrules a real signal.
for (const [tripId, name] of ASSIGN) {
  const matches = memberNamed.all(tripId, name)
  if (matches.length !== 1) {
    console.error(`--assign-rest ${tripId}=${name}: ${matches.length ? 'more than one member by that name' : 'no member by that name on that trip'}`)
    process.exit(1)
  }
  for (let i = undecided.length - 1; i >= 0; i--) {
    if (undecided[i].trip_id !== tripId) continue
    decided.push({ item: undecided[i], member: matches[0], why: 'assigned by hand' })
    undecided.splice(i, 1)
  }
}

console.log(`${DB_PATH}: ${orphans.length} unowned personal-kit items\n`)

if (decided.length) {
  console.log(`Belong to someone — ${decided.length}:`)
  for (const d of decided) {
    console.log(`  ${d.item.trip_id}  ${d.item.title.padEnd(28)} -> ${d.member.name.padEnd(8)} (${d.why})`)
  }
}

if (template.length) {
  const byTrip = new Map()
  for (const item of template) byTrip.set(item.trip_id, (byTrip.get(item.trip_id) ?? 0) + 1)
  console.log(`\nSeeded checklist nobody typed or ticked — ${template.length}${DROP ? ' (deleting)' : ' (kept; pass --drop-template to remove)'}:`)
  for (const [tripId, n] of byTrip) console.log(`  ${tripId}  ${n} rows`)
}

if (undecided.length) {
  console.log(`\nCannot place ${undecided.length} — left shared, decide these by hand:`)
  for (const item of undecided) {
    const who = checkers.all(item.id).map((m) => m.name)
    console.log(`  ${item.trip_id}  ${item.title.padEnd(28)} ${who.length ? `packed by: ${who.join(', ')}` : 'no ticks, no feed entry'}`)
  }
}

if (!APPLY) {
  console.log('\nDry run. Nothing was written. Re-run with --apply.')
  process.exit(0)
}

for (const d of decided) claim.run(d.member.id, d.item.id)
if (DROP) for (const item of template) drop.run(item.id)

// The feed is the other half of the leak. "Troye added chess board" tells the
// whole trip both that the thing exists and whose it is, which is exactly what
// making the row private just stopped. These entries are the evidence this
// script runs on, so they can only go once the owners are written.
const purgeNamed = db.prepare(
  'DELETE FROM events WHERE trip_id = ? AND lower(text) IN (lower(?), lower(?))')
// The old build wrote one of these every time somebody ticked a one-each item.
const purgeTicks = db.prepare(
  "DELETE FROM events WHERE trip_id = ? AND (lower(text) LIKE 'packed their own %' OR lower(text) LIKE 'unpacked their own %')")

let purged = 0
const purgedTrips = new Set()
const count = (tripId, n) => { if (n) { purged += n; purgedTrips.add(tripId) } }

for (const d of decided) {
  count(d.item.trip_id, purgeNamed.run(d.item.trip_id, `added ${d.item.title}`, `removed ${d.item.title}`).changes)
}
// Trips with no newly-private items can still carry the old per-person tick
// entries, so sweep every trip for those regardless.
for (const { id } of db.prepare('SELECT id FROM trips').all()) count(id, purgeTicks.run(id).changes)

// Every trip whose items moved needs a rev bump, or open clients keep showing
// the list they already have until something else happens to change it.
const touched = [...new Set([
  ...decided.map((d) => d.item.trip_id),
  ...(DROP ? template.map((i) => i.trip_id) : []),
  ...purgedTrips,
])]
for (const tripId of touched) db.prepare('UPDATE trips SET rev = rev + 1 WHERE id = ?').run(tripId)
console.log(`\nApplied: ${decided.length} claimed${DROP ? `, ${template.length} template rows removed` : ''}, ${purged} feed entries naming private kit purged, across ${touched.length} trips.`)
