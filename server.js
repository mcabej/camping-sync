import express from 'express'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  db, uid, now, newTripCode, bumpRev, logEvent, getTripState, nextPosition,
} from './lib/db.js'
import { CATALOG, TIPS, starterItems } from './lib/catalog.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
app.use(express.json({ limit: '256kb' }))

// Trip state is cut differently for every member — your personal-kit ticks are
// in it and nobody else's are. Express would otherwise hang an ETag on these
// responses with nothing saying they vary by viewer, which is an invitation for
// a cache in the middle to hand one person's answer to the next one.
app.use('/api', (_req, res, next) => {
  res.set('Cache-Control', 'no-store')
  res.set('Vary', 'x-member-id')
  next()
})

const clean = (v, max = 400) => String(v ?? '').trim().slice(0, max)
const LISTS = new Set(['gear', 'food', 'drinks', 'activities'])

// Plans are always a group thing; there is no "bring your own hike".
const kindOf = (raw, list) => (raw === 'own' && list !== 'activities' ? 'own' : 'shared')

// An 'own' item is one person's private business, so the shared feed never hears
// about it — an entry saying you added a chess board tells the group both that
// it exists and that it is yours, which is the whole thing we are hiding.
const isPrivate = (item) => item.kind === 'own' && !!item.owner_id

// Nobody edits or deletes somebody else's personal kit. Legacy unowned rows stay
// editable by anyone, because today they are still everyone's list.
function mayTouch(item, memberId) {
  return !isPrivate(item) || item.owner_id === memberId
}

function requireTrip(req, res) {
  const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(req.params.id)
  if (!trip) {
    res.status(404).json({ error: 'No trip with that code. Check the link.' })
    return null
  }
  return trip
}

// Who is asking. Personal-kit ticks are only ever returned to their owner.
const viewerId = (req) => clean(req.get('x-member-id') || req.body?.actorId, 64) || null

// The name we attribute changes to in the activity feed.
function actorName(tripId, req) {
  const id = viewerId(req)
  if (!id) return ''
  const m = db.prepare('SELECT name FROM members WHERE id = ? AND trip_id = ?').get(id, tripId)
  return m?.name ?? ''
}

// ---- reference data ---------------------------------------------------------

app.get('/api/catalog', (_req, res) => res.json({ catalog: CATALOG, tips: TIPS }))

// ---- trips ------------------------------------------------------------------

app.post('/api/trips', (req, res) => {
  const name = clean(req.body?.name, 80) || 'Camping trip'
  const organiser = clean(req.body?.organiser, 40)
  const id = newTripCode()
  const ts = now()

  db.prepare(`INSERT INTO trips (id, name, location, start_date, end_date, notes, created_at)
              VALUES (?, ?, ?, ?, ?, '', ?)`)
    .run(id, name, clean(req.body?.location, 120), clean(req.body?.start_date, 20), clean(req.body?.end_date, 20), ts)

  let memberId = null
  if (organiser) {
    memberId = uid()
    db.prepare('INSERT INTO members (id, trip_id, name, hue, created_at) VALUES (?, ?, ?, 0, ?)')
      .run(memberId, id, organiser, ts)
  }

  // Every trip starts with the things you genuinely cannot camp without.
  const insert = db.prepare(`INSERT INTO items (id, trip_id, list, category, title, note, qty, kind, position, created_at, updated_at)
                             VALUES (?, ?, ?, ?, ?, ?, '', ?, ?, ?, ?)`)
  starterItems().forEach((it, i) => insert.run(uid(), id, it.list, it.category, it.title, it.note, it.kind, i, ts, ts))

  logEvent(id, organiser, 'started the trip')
  res.json({ trip: db.prepare('SELECT * FROM trips WHERE id = ?').get(id), memberId })
})

app.get('/api/trips/:id', (req, res) => {
  const state = getTripState(req.params.id, viewerId(req))
  if (!state) return res.status(404).json({ error: 'No trip with that code. Check the link.' })
  res.json(state)
})

// A device remembers the codes it has joined. This turns that bare list into
// something worth putting on the home page — without an account behind it.
app.post('/api/trips/summary', (req, res) => {
  const wanted = (Array.isArray(req.body?.trips) ? req.body.trips : []).slice(0, 40)
  const tripRow = db.prepare('SELECT id, name, location, start_date, end_date FROM trips WHERE id = ?')
  const memberRow = db.prepare('SELECT name, hue FROM members WHERE id = ? AND trip_id = ?')
  const headcount = db.prepare('SELECT COUNT(*) AS c FROM members WHERE trip_id = ?')
  // Plans are not "brought" by anyone and personal kit is private, so the home
  // page counts the same thing the coverage bar does: shared things, and gaps.
  const SHARED = `trip_id = ? AND kind = 'shared' AND list != 'activities'`
  const sharedCount = db.prepare(`SELECT COUNT(*) AS c FROM items WHERE ${SHARED}`)
  const openCount = db.prepare(`SELECT COUNT(*) AS c FROM items WHERE ${SHARED} AND assignee_id IS NULL`)
  const claims = db.prepare(`
    SELECT m.hue AS hue, COUNT(*) AS n FROM items i
    JOIN members m ON m.id = i.assignee_id
    WHERE i.trip_id = ? AND i.kind = 'shared' AND i.list != 'activities'
    GROUP BY m.hue ORDER BY n DESC`)

  const trips = [], missing = []
  for (const entry of wanted) {
    const id = clean(entry?.id, 64)
    if (!id) continue
    const trip = tripRow.get(id)
    // Trips that no longer exist are reported back so the device can forget them.
    if (!trip) { missing.push(id); continue }
    trips.push({
      ...trip,
      members: headcount.get(id).c,
      shared: sharedCount.get(id).c,
      open: openCount.get(id).c,
      claims: claims.all(id),
      you: memberRow.get(clean(entry?.memberId, 64), id) ?? null,
    })
  }
  res.json({ trips, missing })
})

// Cheap endpoint the clients poll; a changed rev means "refetch".
app.get('/api/trips/:id/rev', (req, res) => {
  const row = db.prepare('SELECT rev FROM trips WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'not found' })
  res.json({ rev: row.rev })
})

app.patch('/api/trips/:id', (req, res) => {
  const trip = requireTrip(req, res)
  if (!trip) return
  const fields = ['name', 'location', 'start_date', 'end_date', 'notes']
  const sets = [], vals = []
  for (const f of fields) {
    if (req.body?.[f] !== undefined) {
      sets.push(`${f} = ?`)
      vals.push(clean(req.body[f], f === 'notes' ? 4000 : 120))
    }
  }
  if (sets.length) {
    db.prepare(`UPDATE trips SET ${sets.join(', ')} WHERE id = ?`).run(...vals, trip.id)
    logEvent(trip.id, actorName(trip.id, req), 'updated the trip details')
  }
  bumpRev(trip.id)
  res.json(getTripState(trip.id, viewerId(req)))
})

// ---- members ----------------------------------------------------------------

const memberNamed = db.prepare('SELECT * FROM members WHERE trip_id = ? AND lower(name) = lower(?)')

// Two people on one trip must never share a name, or the next person to type it
// gets an ambiguous question and the people list reads as one person twice.
function distinctName(tripId, name) {
  if (!memberNamed.get(tripId, name)) return name
  for (let n = 2; n < 40; n++) {
    const candidate = `${name} (${n})`
    if (!memberNamed.get(tripId, candidate)) return candidate
  }
  return `${name} (${uid().slice(0, 4)})`
}

app.post('/api/trips/:id/members', (req, res) => {
  const trip = requireTrip(req, res)
  if (!trip) return
  const name = clean(req.body?.name, 40)
  if (!name) return res.status(400).json({ error: 'Enter a name so your friends know who is who.' })

  // A name is not an identity. Someone typing a name already on the trip is
  // usually themselves on a second phone — but sometimes it is the other Sam,
  // and handing them the first Sam's member id merges two people into one:
  // one colour, one set of claims, one personal kit between them. So we ask
  // which it is rather than guessing, and hand back nothing until they answer.
  const claim = clean(req.body?.claim, 10)
  const existing = memberNamed.get(trip.id, name)
  if (existing && claim !== 'new') {
    if (claim !== 'rejoin') return res.status(409).json({ conflict: 'name', name: existing.name })
    return res.json({ member: existing, rejoined: true })
  }

  const count = db.prepare('SELECT COUNT(*) AS c FROM members WHERE trip_id = ?').get(trip.id).c
  const member = { id: uid(), trip_id: trip.id, name: distinctName(trip.id, name), hue: count % 8, created_at: now() }
  db.prepare('INSERT INTO members (id, trip_id, name, hue, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(member.id, member.trip_id, member.name, member.hue, member.created_at)

  logEvent(trip.id, member.name, 'joined the trip')
  bumpRev(trip.id)
  res.json({ member })
})

app.delete('/api/trips/:id/members/:mid', (req, res) => {
  const trip = requireTrip(req, res)
  if (!trip) return
  const m = db.prepare('SELECT * FROM members WHERE id = ? AND trip_id = ?').get(req.params.mid, trip.id)
  if (m) {
    // Their claims go back to nobody, so nothing may still read as packed.
    db.prepare('UPDATE items SET packed = 0 WHERE assignee_id = ?').run(m.id)
    db.prepare('DELETE FROM members WHERE id = ?').run(m.id)
    logEvent(trip.id, actorName(trip.id, req), `removed ${m.name} from the trip`)
    bumpRev(trip.id)
  }
  res.json(getTripState(trip.id, viewerId(req)))
})

// ---- items ------------------------------------------------------------------

app.post('/api/trips/:id/items', (req, res) => {
  const trip = requireTrip(req, res)
  if (!trip) return

  const incoming = Array.isArray(req.body?.items) ? req.body.items : [req.body]
  const ts = now()
  const insert = db.prepare(`INSERT INTO items (id, trip_id, list, category, title, note, qty, kind, assignee_id, owner_id, position, created_at, updated_at)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  const added = []

  // Personal kit needs somebody to belong to, so it can only be added by a
  // member — there is no such thing as an unowned private item any more.
  const me = viewerId(req)
  const isMember = me && db.prepare('SELECT 1 FROM members WHERE id = ? AND trip_id = ?').get(me, trip.id)
  let refused = false

  for (const raw of incoming) {
    const list = clean(raw?.list, 20)
    const title = clean(raw?.title, 120)
    if (!LISTS.has(list) || !title) continue
    const kind = kindOf(clean(raw?.kind, 10), list)
    if (kind === 'own' && !isMember) { refused = true; continue }
    const id = uid()
    insert.run(
      id, trip.id, list, clean(raw?.category, 60), title, clean(raw?.note, 500), clean(raw?.qty, 40), kind,
      kind === 'own' ? null : clean(raw?.assignee_id, 64) || null,
      kind === 'own' ? me : null, nextPosition(trip.id, list), ts, ts,
    )
    // Only group kit is news. What you put on your own list is yours alone.
    if (kind !== 'own') added.push(title)
  }

  if (refused && !added.length) {
    return res.status(400).json({ error: 'Join the trip before adding your own kit.' })
  }

  if (added.length) {
    const who = actorName(trip.id, req)
    logEvent(trip.id, who, added.length === 1
      ? `added ${added[0]}`
      : `added ${added.length} things to the ${clean(incoming[0]?.list, 20)} list`)
  }
  bumpRev(trip.id)
  res.json(getTripState(trip.id, viewerId(req)))
})

app.patch('/api/items/:id', (req, res) => {
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id)
  if (!item) return res.status(404).json({ error: 'That item is already gone.' })
  const me = viewerId(req)
  if (!mayTouch(item, me)) return res.status(403).json({ error: "That's on somebody else's personal list." })

  const sets = ['updated_at = ?'], vals = [now()]
  const push = (col, val) => { sets.push(`${col} = ?`); vals.push(val) }

  if (req.body?.title !== undefined) push('title', clean(req.body.title, 120))
  if (req.body?.note !== undefined) push('note', clean(req.body.note, 500))
  if (req.body?.qty !== undefined) push('qty', clean(req.body.qty, 40))
  if (req.body?.category !== undefined) push('category', clean(req.body.category, 60))

  // Switching between shared and own resets the other model's state, so it is
  // handled on its own rather than alongside an assignment or a packed tick.
  const newKind = req.body?.kind !== undefined ? kindOf(clean(req.body.kind, 10), item.list) : null
  if (newKind === 'own' && !me) {
    return res.status(400).json({ error: 'Join the trip before taking something onto your own list.' })
  }
  if (newKind) {
    push('kind', newKind)
    push('assignee_id', null)
    push('packed', 0)
    // Moving a thing onto your own list takes it off everybody else's view of
    // the trip; moving it back to the group hands it to everyone again.
    push('owner_id', newKind === 'own' ? me : null)
    if (newKind === 'shared') db.prepare('DELETE FROM own_checks WHERE item_id = ?').run(item.id)
  } else {
    if (req.body?.packed !== undefined) push('packed', req.body.packed ? 1 : 0)
    if (req.body?.assignee_id !== undefined) {
      const a = clean(req.body.assignee_id, 64)
      push('assignee_id', a && db.prepare('SELECT 1 FROM members WHERE id = ? AND trip_id = ?').get(a, item.trip_id) ? a : null)
    }
  }

  db.prepare(`UPDATE items SET ${sets.join(', ')} WHERE id = ?`).run(...vals, item.id)

  const who = actorName(item.trip_id, req)
  if (newKind) {
    // Where a thing went is the group's business when it leaves or joins the
    // group list. What is on the private list it went to is not, so the wording
    // stops at the boundary.
    logEvent(item.trip_id, who, newKind === 'own'
      ? `took ${item.title} off the group list`
      : `made ${item.title} a group item`)
  } else if (isPrivate(item)) {
    // Nothing: edits to your own kit are yours.
  } else if (req.body?.assignee_id !== undefined) {
    const a = clean(req.body.assignee_id, 64)
    logEvent(item.trip_id, who, a ? `is bringing ${item.title}` : `dropped ${item.title}`)
  } else if (req.body?.packed !== undefined) {
    logEvent(item.trip_id, who, `${req.body.packed ? 'packed' : 'unpacked'} ${item.title}`)
  }

  bumpRev(item.trip_id)
  res.json(getTripState(item.trip_id, viewerId(req)))
})

app.delete('/api/items/:id', (req, res) => {
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id)
  if (!item) return res.status(404).json({ error: 'That item is already gone.' })
  if (!mayTouch(item, viewerId(req))) return res.status(403).json({ error: "That's on somebody else's personal list." })
  db.prepare('DELETE FROM items WHERE id = ?').run(item.id)
  // Crossing something off your own list is not an announcement.
  if (!isPrivate(item)) logEvent(item.trip_id, actorName(item.trip_id, req), `removed ${item.title}`)
  bumpRev(item.trip_id)
  res.json(getTripState(item.trip_id, viewerId(req)))
})

// Ticking off your own kit. The row is already yours, so this only ever records
// that you have packed it — and only you can do it.
app.post('/api/items/:id/own', (req, res) => {
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id)
  if (!item) return res.status(404).json({ error: 'That item is already gone.' })
  const memberId = clean(req.body?.memberId, 64)
  const member = db.prepare('SELECT * FROM members WHERE id = ? AND trip_id = ?').get(memberId, item.trip_id)
  if (!member) return res.status(400).json({ error: 'Join the trip before ticking things off.' })
  if (!mayTouch(item, member.id)) return res.status(403).json({ error: "That's on somebody else's personal list." })

  const has = db.prepare('SELECT 1 FROM own_checks WHERE item_id = ? AND member_id = ?').get(item.id, member.id)
  if (has) db.prepare('DELETE FROM own_checks WHERE item_id = ? AND member_id = ?').run(item.id, member.id)
  else db.prepare('INSERT INTO own_checks (item_id, member_id) VALUES (?, ?)').run(item.id, member.id)

  // Deliberately not logged to the feed — your own packing is nobody else's news.
  bumpRev(item.trip_id)
  res.json(getTripState(item.trip_id, member.id))
})

app.post('/api/items/:id/vote', (req, res) => {
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id)
  if (!item) return res.status(404).json({ error: 'That item is already gone.' })
  const memberId = clean(req.body?.memberId, 64)
  if (!memberId) return res.status(400).json({ error: 'Join the trip before voting.' })

  const has = db.prepare('SELECT 1 FROM votes WHERE item_id = ? AND member_id = ?').get(item.id, memberId)
  if (has) db.prepare('DELETE FROM votes WHERE item_id = ? AND member_id = ?').run(item.id, memberId)
  else db.prepare('INSERT INTO votes (item_id, member_id) VALUES (?, ?)').run(item.id, memberId)

  bumpRev(item.trip_id)
  res.json(getTripState(item.trip_id, viewerId(req)))
})

// ---- static -----------------------------------------------------------------

app.use(express.static(join(__dirname, 'public'), { maxAge: '1h', index: 'index.html' }))
app.get('/{*path}', (_req, res) => res.sendFile(join(__dirname, 'public', 'index.html')))

const port = process.env.PORT || 3000
app.listen(port, () => console.log(`camping-sync listening on :${port}`))
