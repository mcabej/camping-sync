// Putting things on a list. Shared by the route a phone posts to and the tool
// Camp calls, so a thing added by asking for it lands exactly where a thing
// added by typing it would — same validation, same feed line, same revision
// bump for every other phone watching.
import { db, uid, now, nextPosition, bumpRev, logEvent } from './db.js'
import { clean, LISTS, kindOf, coords, dayField, timeField, PLACE_MAX } from './fields.js'

export function insertTripItems(tripId, memberId, incoming, who) {
  const ts = now()
  const insert = db.prepare(`INSERT INTO items (id, trip_id, list, category, title, note, qty, kind, owner_id, place, lat, lon, day, time, position, created_at, updated_at)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  const created = []
  const shared = []

  for (const raw of incoming) {
    const list = clean(raw?.list, 20)
    const title = clean(raw?.title, 120)
    if (!LISTS.has(list) || !title) continue
    const kind = kindOf(clean(raw?.kind, 10), list)
    const id = uid()
    const [lat, lon] = coords(raw)
    const day = dayField(raw?.day)
    insert.run(
      id, tripId, list, clean(raw?.category, 60), title, clean(raw?.note, 500), clean(raw?.qty, 40), kind,
      kind === 'own' ? memberId : null, clean(raw?.place, PLACE_MAX), lat, lon,
      day, timeField(raw?.time), nextPosition(tripId, list), ts, ts,
    )
    const item = { id, list, title, kind, day }
    created.push(item)
    if (kind !== 'own') shared.push(item)
  }

  if (shared.length) {
    // One thing on several days is not several things, and the feed should not
    // pretend otherwise: the same title on as many distinct days as there are
    // rows is somebody putting the noodles down for three nights.
    const spread = shared.every((item) => item.title === shared[0].title && item.day)
      && new Set(shared.map((item) => item.day)).size === shared.length
    logEvent(tripId, who, shared.length === 1
      ? `added ${shared[0].title}`
      : spread
        ? `added ${shared[0].title} on ${shared.length} days`
        : `added ${shared.length} things to the ${created[0].list} list`)
  }
  if (created.length) bumpRev(tripId)
  return { created }
}
