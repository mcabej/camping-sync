import express from 'express'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import {
  db, uid, now, newTripCode, bumpRev, logEvent, getTripState, nextPosition,
} from './lib/db.js'
import { CATALOG, TIPS, WEATHER_ADVICE, catalogEntry } from './lib/catalog.js'

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

// The map link ends up in an href that everyone on the trip taps, and anyone
// with the code can set it. So only ordinary web links are stored: a pasted
// `maps.app.goo.gl/…` gets the scheme it is missing, and anything that isn't
// http(s) after that is dropped rather than kept.
function mapUrl(raw) {
  const v = clean(raw, 500)
  if (!v) return ''
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? v : `https://${v}`)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : ''
  } catch { return '' }
}

// Where the trip is gets more room than its name: it is one field holding a real
// place, and a full one runs to a site, a village, a postcode and a country.
const TRIP_FIELDS = ['name', 'location', 'map_url', 'start_date', 'end_date', 'notes']
const TRIP_LIMITS = { notes: 4000, location: 200 }
// A place on an item is the same kind of answer as a place on the trip.
const PLACE_MAX = TRIP_LIMITS.location
const tripField = (f, v) => (f === 'map_url' ? mapUrl(v) : clean(v, TRIP_LIMITS[f] ?? 120))

// The pin that comes with a searched-for place. Both halves or neither: half a
// coordinate is a point in the sea. An empty box is not a zero, so blanks stay
// null rather than becoming a spot in the Gulf of Guinea.
function coords(body) {
  const num = (v, max) => {
    const s = String(v ?? '').trim()
    if (!s) return null
    const n = Number(s)
    return Number.isFinite(n) && Math.abs(n) <= max ? n : null
  }
  const lat = num(body?.lat, 90)
  const lon = num(body?.lon, 180)
  return lat === null || lon === null ? [null, null] : [lat, lon]
}

// When a thing happens, on the trip's own calendar: which day, and for a plan
// which hour of it. Only the shape is checked. A day outside the trip's dates is
// not the same kind of wrong as half a coordinate — the dates themselves move,
// and a plan that was Sunday's until somebody shortened the trip is still what
// somebody meant — so it is kept and the client draws it where it falls. What is
// not a day at all becomes no day, which is the case every list already handles.
// One value that is not a date and is not nothing: the teabags, which are for
// every day of the trip rather than for one of them or for none. It is a third
// answer to the same question, so it lives in the same column — and the column
// is TEXT, so nothing has to change underneath it.
const ALL_WEEK = 'any'
const isDay = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s)
const dayField = (v) => {
  const s = clean(v, 10)
  return isDay(s) || s === ALL_WEEK ? s : ''
}
const timeField = (v) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(clean(v, 5)) ? clean(v, 5) : '')

// The feed is written in English and read by whoever is on the trip, not by the
// machine it runs on, so the weekday is named rather than dated. A date with the
// right shape and no such day in it — the 31st of February — reads back as it
// was written rather than as "Invalid Date".
function dayName(day) {
  if (day === ALL_WEEK) return 'every day'
  const d = new Date(`${day}T12:00:00`)
  return Number.isNaN(+d) ? day
    : d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
}

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

// ---- place search -----------------------------------------------------------

// "Where" is a real search, and it runs through here rather than straight from
// the browser. OpenStreetMap asks callers for one identifying User-Agent and at
// most a request a second — neither of which is true of thirty phones typing on
// their own. Going through the server gives us one queue and one cache to hold
// to that, and keeps the keystrokes of everyone's trip planning off a third
// party's logs beyond the one lookup it takes to answer.
const PLACES_URL = 'https://nominatim.openstreetmap.org/search'
const PLACES_UA = 'camping-sync/1.0 (https://camping-sync.up.railway.app)'
const PLACES_TTL = 60 * 60 * 1000
const PLACES_KEEP = 400   // cached queries
const PLACES_WAITING = 6  // lookups allowed to queue before we stop taking more

const placeCache = new Map()

function remember(key, places) {
  placeCache.set(key, { at: Date.now(), places })
  // Oldest insertion first, so this drops the least recently missed query.
  if (placeCache.size > PLACES_KEEP) placeCache.delete(placeCache.keys().next().value)
}

// One request a second, shared across everybody: each lookup waits its turn in a
// single chain rather than racing the others out of the door.
let queue = Promise.resolve()
let lastCall = 0
let waiting = 0

function queued(fn) {
  const turn = queue.then(async () => {
    const gap = 1100 - (Date.now() - lastCall)
    if (gap > 0) await new Promise((r) => setTimeout(r, gap))
    lastCall = Date.now()
    return fn()
  })
  queue = turn.then(() => {}, () => {})
  return turn
}

// One field for where the trip is means one string that has to do both jobs:
// recognisable at a glance, and enough to find the place. Nominatim's
// display_name is neither — nine parts ending in the country, with the road and
// the parish in the middle — so what a trip keeps is what you would write on a
// postcard: the place, the village, the postcode, the country.
function whereLine(r, label) {
  const a = r?.address ?? {}
  const town = a.village || a.town || a.city || a.hamlet || a.suburb || a.municipality || a.county
  const out = []
  for (const part of [label, town, a.postcode, a.country]) {
    const v = String(part ?? '').trim()
    if (v && !out.some((x) => x.toLowerCase() === v.toLowerCase())) out.push(v)
  }
  return out.join(', ').slice(0, TRIP_LIMITS.location)
}

// A result reads as a name and where that name is: "Wasdale Head Campsite" then
// "Wasdale Head, Cumberland, England". `where` is what taking it puts in the
// box, and lat/lon are the pin that comes with it.
function shapePlace(r) {
  const full = String(r?.display_name ?? '').trim()
  if (!full) return null
  const parts = full.split(',').map((s) => s.trim()).filter(Boolean)
  const label = String(r?.name ?? '').trim() || parts[0] || full
  const rest = parts[0] === label ? parts.slice(1) : parts
  const lat = Number(r?.lat)
  const lon = Number(r?.lon)
  return {
    id: String(r?.place_id ?? label),
    label: label.slice(0, 120),
    detail: rest.join(', ').slice(0, 160),
    where: whereLine(r, label.slice(0, 120)),
    lat: Number.isFinite(lat) ? lat : null,
    lon: Number.isFinite(lon) ? lon : null,
  }
}

app.get('/api/places', async (req, res) => {
  const q = clean(req.query?.q, 120)
  if (q.length < 2) return res.json({ places: [] })

  const key = q.toLowerCase()
  const hit = placeCache.get(key)
  if (hit && Date.now() - hit.at < PLACES_TTL) return res.json({ places: hit.places })

  // Better to say the search is busy than to queue a lookup nobody is still
  // waiting on — the box in front of them has moved on several letters by now.
  if (waiting >= PLACES_WAITING) return res.json({ places: [], failed: true })

  const url = new URL(PLACES_URL)
  url.searchParams.set('q', q)
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('limit', '6')
  url.searchParams.set('addressdetails', '1')

  waiting++
  try {
    const upstream = await queued(() => fetch(url, {
      headers: {
        'user-agent': PLACES_UA,
        'accept-language': clean(req.get('accept-language'), 80) || 'en',
      },
      signal: AbortSignal.timeout(6000),
    }))
    if (!upstream.ok) throw new Error(`nominatim ${upstream.status}`)
    const rows = await upstream.json()
    const places = (Array.isArray(rows) ? rows : []).map(shapePlace).filter(Boolean)
    remember(key, places)
    res.json({ places })
  } catch {
    // Suggestions are a convenience; the box still takes anything you type.
    res.json({ places: [], failed: true })
  } finally {
    waiting--
  }
})

// ---- weather ----------------------------------------------------------------

// The one card on the Camp tab that needs nothing from anybody: the trip already
// knows where it is and when it is, which is the whole of a forecast request.
//
// Open-Meteo is free and wants no key, but it is still somebody else's server —
// so answers are cached for half an hour, and thirty phones opening the same
// trip at once make one call between them rather than thirty.
const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast'
const WEATHER_DAILY = [
  'weather_code', 'temperature_2m_max', 'temperature_2m_min',
  'precipitation_sum', 'precipitation_probability_max', 'wind_speed_10m_max',
].join(',')
// A forecast is a forecast for about a fortnight. Past that it is a seasonal
// average wearing a date, which is worse than saying nothing — somebody would
// pack for it.
const WEATHER_REACH = 15
const WEATHER_TTL = 30 * 60 * 1000
const WEATHER_KEEP = 200

const weatherCache = new Map()
// Keyed the same way as the cache, and cleared as soon as an answer lands: the
// second phone to ask waits on the first one's call instead of starting another.
const weatherFlight = new Map()

const dayFrom = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10)

// Nulls rather than zeros for anything missing: a day with no wind reading is
// not a still day, and advice keyed off the numbers has to be able to tell.
function shapeDays(daily) {
  const at = (key, i) => {
    const n = Number(daily?.[key]?.[i])
    return Number.isFinite(n) ? n : null
  }
  return (daily?.time ?? []).map((date, i) => ({
    date,
    code: at('weather_code', i),
    hi: at('temperature_2m_max', i),
    lo: at('temperature_2m_min', i),
    rain: at('precipitation_sum', i),
    pop: at('precipitation_probability_max', i),
    wind: at('wind_speed_10m_max', i),
  }))
}

// The worst the trip has to offer, one number at a time. Averaging would hide
// the Saturday it rains all day behind two dry ones, and the Saturday is the
// whole reason anybody would pack differently.
function worstOf(days) {
  const worst = (key, seed, beats) => days.reduce((acc, d) => (
    d[key] !== null && beats(d[key], acc) ? d[key] : acc), seed)
  const up = (a, b) => a > b
  return {
    hi: worst('hi', -Infinity, up),
    lo: worst('lo', Infinity, (a, b) => a < b),
    rain: worst('rain', 0, up),
    pop: worst('pop', 0, up),
    wind: worst('wind', 0, up),
    storm: days.some((d) => d.code !== null && d.code >= 95),
  }
}

// What the numbers mean for the packing list, resolved into real catalogue
// entries so the client can offer them as one-tap adds without knowing anything
// about camping. This is the only camping-specific part of the endpoint: the
// forecast itself is just a forecast, and a different kind of trip would keep it
// and swap this out.
function adviceFor(days) {
  if (!days.length) return []
  const w = worstOf(days)
  return WEATHER_ADVICE.filter((tip) => tip.when(w)).map((tip) => ({
    id: tip.id,
    say: typeof tip.say === 'function' ? tip.say(w) : tip.say,
    gear: tip.gear.map(catalogEntry).filter(Boolean),
  }))
}

async function fetchWeather(lat, lon, from, to) {
  const url = new URL(WEATHER_URL)
  url.searchParams.set('latitude', String(lat))
  url.searchParams.set('longitude', String(lon))
  url.searchParams.set('daily', WEATHER_DAILY)
  // The days of a trip are the days where it is, not where the server is.
  url.searchParams.set('timezone', 'auto')
  url.searchParams.set('start_date', from)
  url.searchParams.set('end_date', to)

  const upstream = await fetch(url, { signal: AbortSignal.timeout(6000) })
  if (!upstream.ok) throw new Error(`open-meteo ${upstream.status}`)
  const body = await upstream.json()
  // It answers 200 with `error: true` for a date it will not cover, which is a
  // refusal however it is dressed.
  if (body?.error) throw new Error(String(body.reason ?? 'open-meteo refused'))
  const days = shapeDays(body?.daily)
  return { days, advice: adviceFor(days), at: new Date().toISOString() }
}

app.get('/api/weather', async (req, res) => {
  // A trip with words in its location box and no pin behind them has nowhere to
  // forecast for. Saying so is what tells somebody to pick the place from the
  // search rather than type it.
  const [lat, lon] = coords(req.query)
  if (lat === null) return res.json({ days: [], reason: 'nowhere' })

  const start = clean(req.query?.start, 20)
  const end = clean(req.query?.end, 20) || start
  if (!isDay(start) || !isDay(end) || end < start) return res.json({ days: [], reason: 'nowhen' })

  const today = dayFrom(0)
  const reach = dayFrom(WEATHER_REACH)
  if (end < today) return res.json({ days: [], reason: 'past' })
  if (start > reach) return res.json({ days: [], reason: 'far', reach })

  // Yesterday's weather is not news, and the far end of a long trip is past
  // what anybody can forecast — so the window is the part of the trip that is
  // both still ahead and still knowable. `cut` is how the card says so.
  const from = start < today ? today : start
  const to = end > reach ? reach : end
  // Three decimal places is about a hundred metres, which is the same forecast
  // and one cache entry rather than one per phone that rounded differently.
  const key = `${lat.toFixed(3)},${lon.toFixed(3)},${from},${to}`

  const hit = weatherCache.get(key)
  if (hit && Date.now() - hit.at < WEATHER_TTL) return res.json({ ...hit.answer, cut: to < end })

  try {
    let flight = weatherFlight.get(key)
    if (!flight) {
      flight = fetchWeather(lat, lon, from, to)
      weatherFlight.set(key, flight)
      flight.then(
        (answer) => {
          weatherCache.set(key, { at: Date.now(), answer })
          if (weatherCache.size > WEATHER_KEEP) weatherCache.delete(weatherCache.keys().next().value)
        },
        () => {},
      ).finally(() => weatherFlight.delete(key))
    }
    res.json({ ...(await flight), cut: to < end })
  } catch {
    // A forecast is a nicety. The card says it could not get one and the trip
    // carries on being planned without it.
    res.json({ days: [], reason: 'failed' })
  }
})

// ---- trips ------------------------------------------------------------------

app.post('/api/trips', (req, res) => {
  const name = clean(req.body?.name, 80) || 'Camping trip'
  const organiser = clean(req.body?.organiser, 40)
  const id = newTripCode()
  const ts = now()

  const [lat, lon] = coords(req.body)
  db.prepare(`INSERT INTO trips (id, name, location, lat, lon, map_url, start_date, end_date, notes, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', ?)`)
    .run(id, name, tripField('location', req.body?.location), lat, lon,
      mapUrl(req.body?.map_url), clean(req.body?.start_date, 20), clean(req.body?.end_date, 20), ts)

  let memberId = null
  if (organiser) {
    memberId = uid()
    db.prepare('INSERT INTO members (id, trip_id, name, hue, created_at) VALUES (?, ?, ?, 0, ?)')
      .run(memberId, id, organiser, ts)
  }

  // A new trip starts empty. The catalogue's essentials are all still there
  // behind "What am I missing?", where they are an offer you accept rather than
  // twenty rows you have to read and delete before the list is yours.
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
  const openCount = db.prepare(`SELECT COUNT(*) AS c FROM items WHERE ${SHARED}
                                AND NOT EXISTS (SELECT 1 FROM claims c WHERE c.item_id = items.id)`)
  // A thing with three people on it is still one thing, so it is one unit of the
  // bar split three ways. Counting it once per person would let a crowded item
  // swell the coloured half and quietly shrink the gap nobody has filled.
  const claims = db.prepare(`
    SELECT m.hue AS hue,
           SUM(1.0 / (SELECT COUNT(*) FROM claims x WHERE x.item_id = c.item_id)) AS n
    FROM claims c
    JOIN items i ON i.id = c.item_id
    JOIN members m ON m.id = c.member_id
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
  const sets = [], vals = [], touched = []
  for (const f of TRIP_FIELDS) {
    if (req.body?.[f] !== undefined) {
      sets.push(`${f} = ?`)
      vals.push(tripField(f, req.body[f]))
      touched.push(f)
    }
  }
  // The pin belongs to the location, so it travels with it: sending a place
  // without coordinates means the words were typed by hand, and last week's pin
  // is no longer pointing at them.
  if (req.body?.location !== undefined) {
    const [lat, lon] = coords(req.body)
    sets.push('lat = ?', 'lon = ?')
    vals.push(lat, lon)
  }
  // Which way the trip is facing is a switch, not a field: it changes the
  // question every list is asking, so it gets its own line in the feed and is
  // kept out of the "updated the trip details" bundle below.
  if (req.body?.going_home !== undefined) {
    const home = req.body.going_home ? 1 : 0
    if (home !== trip.going_home) {
      db.prepare('UPDATE trips SET going_home = ? WHERE id = ?').run(home, trip.id)
      logEvent(trip.id, actorName(trip.id, req),
        home ? 'started the pack-down' : 'went back to packing')
    }
  }

  if (sets.length) {
    db.prepare(`UPDATE trips SET ${sets.join(', ')} WHERE id = ?`).run(...vals, trip.id)
    // Where everyone is driving to is the one detail worth its own line in the
    // feed — it is the thing people go back looking for.
    const where = touched.every((f) => f === 'location' || f === 'map_url')
    logEvent(trip.id, actorName(trip.id, req), where ? 'set where the trip is' : 'updated the trip details')
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

// What somebody can eat is a fact about the trip rather than a private note:
// the whole value of writing it down is that whoever ends up cooking finds out
// without asking the table one at a time. So it is shared like a claim, and like
// a claim anybody on the trip can fill it in — the person who knows about the
// nut allergy is as often the one booking the pitch as the one who has it.
app.patch('/api/trips/:id/members/:mid', (req, res) => {
  const trip = requireTrip(req, res)
  if (!trip) return
  const m = db.prepare('SELECT * FROM members WHERE id = ? AND trip_id = ?').get(req.params.mid, trip.id)
  if (!m) return res.status(404).json({ error: 'They are not on this trip any more.' })

  if (req.body?.diet !== undefined) {
    const diet = clean(req.body.diet, 200)
    if (diet !== m.diet) {
      db.prepare('UPDATE members SET diet = ? WHERE id = ?').run(diet, m.id)
      // Named when it is somebody else's, because a line about what you can eat
      // that you did not write is worth knowing the author of.
      const who = actorName(trip.id, req)
      const self = who === m.name
      logEvent(trip.id, who, diet
        ? (self ? 'said what they can and cannot eat' : `noted what ${m.name} can and cannot eat`)
        : (self ? 'cleared their dietary needs' : `cleared the note on what ${m.name} eats`))
    }
  }

  bumpRev(trip.id)
  res.json(getTripState(trip.id, viewerId(req)))
})

app.delete('/api/trips/:id/members/:mid', (req, res) => {
  const trip = requireTrip(req, res)
  if (!trip) return
  const m = db.prepare('SELECT * FROM members WHERE id = ? AND trip_id = ?').get(req.params.mid, trip.id)
  if (m) {
    // What they had put their name to goes back to nobody — claims cascade with
    // the member, and each carried that person's own packed tick with it.
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
  const insert = db.prepare(`INSERT INTO items (id, trip_id, list, category, title, note, qty, kind, owner_id, place, lat, lon, day, time, position, created_at, updated_at)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
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
    const [lat, lon] = coords(raw)
    insert.run(
      id, trip.id, list, clean(raw?.category, 60), title, clean(raw?.note, 500), clean(raw?.qty, 40), kind,
      kind === 'own' ? me : null, clean(raw?.place, PLACE_MAX), lat, lon,
      dayField(raw?.day), timeField(raw?.time),
      nextPosition(trip.id, list), ts, ts,
    )
    // Only group kit is news. What you put on your own list is yours alone.
    if (kind !== 'own') added.push({ title, day: dayField(raw?.day) })
  }

  if (refused && !added.length) {
    return res.status(400).json({ error: 'Join the trip before adding your own kit.' })
  }

  if (added.length) {
    const who = actorName(trip.id, req)
    // One thing on several days is not several things, and the feed should not
    // pretend otherwise: the same title on as many distinct days as there are
    // rows is somebody putting the noodles down for three nights.
    const spread = added.every((a) => a.title === added[0].title && a.day)
      && new Set(added.map((a) => a.day)).size === added.length
    logEvent(trip.id, who, added.length === 1
      ? `added ${added[0].title}`
      : spread
        ? `added ${added[0].title} on ${added.length} days`
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

  // Which day it is on, and the hour if it has one. Two fields rather than one
  // because they are set from different places: the day is a chip you tap and
  // the time is something you type, and a plan can perfectly well have a day
  // and no hour.
  const timed = req.body?.day !== undefined || req.body?.time !== undefined
  if (req.body?.day !== undefined) push('day', dayField(req.body.day))
  if (req.body?.time !== undefined) push('time', timeField(req.body.time))

  // Same rule as the trip's own location: the pin travels with the words, so
  // rewriting where the sunset spot is never leaves last week's coordinates
  // pointing at it.
  const placed = req.body?.place !== undefined
  if (placed) {
    const [lat, lon] = coords(req.body)
    push('place', clean(req.body.place, PLACE_MAX))
    push('lat', lat)
    push('lon', lon)
  }

  // Switching between shared and own resets the other model's state, so it is
  // handled on its own rather than alongside who is bringing it.
  const newKind = req.body?.kind !== undefined ? kindOf(clean(req.body.kind, 10), item.list) : null
  if (newKind === 'own' && !me) {
    return res.status(400).json({ error: 'Join the trip before taking something onto your own list.' })
  }
  if (newKind) {
    push('kind', newKind)
    // Moving a thing onto your own list takes it off everybody else's view of
    // the trip; moving it back to the group hands it to everyone again. Either
    // way the names on it stop meaning what they meant.
    push('owner_id', newKind === 'own' ? me : null)
    db.prepare('DELETE FROM claims WHERE item_id = ?').run(item.id)
    if (newKind === 'shared') db.prepare('DELETE FROM own_checks WHERE item_id = ?').run(item.id)
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
  } else if (placed) {
    // Worth a line: half the point of saying where the sunset spot is, is that
    // the others find out there is one.
    const where = clean(req.body.place, PLACE_MAX)
    logEvent(item.trip_id, who, where
      ? `said where ${item.title} is`
      : `took the place off ${item.title}`)
  } else if (timed) {
    // The one change on a list that moves something out from under the heading
    // somebody else was reading, so it is worth a line — but only when it moved.
    // Sending a time the server will not keep is not news, and neither is
    // pressing the day something is already on.
    const day = req.body?.day !== undefined ? dayField(req.body.day) : item.day
    const at = req.body?.time !== undefined ? timeField(req.body.time) : item.time
    if (day !== item.day) {
      logEvent(item.trip_id, who, day
        ? `put ${item.title} on ${dayName(day)}`
        : `took the day off ${item.title}`)
    } else if (at !== item.time) {
      logEvent(item.trip_id, who, at
        ? `set ${item.title} for ${at}`
        : `took the time off ${item.title}`)
    }
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

// Who is bringing a group thing. Anyone on the trip can put a name down or take
// one off, including their own — the list belongs to everybody, and the person
// who notices that Sam has left is rarely Sam.
function claimant(req, res) {
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id)
  if (!item) { res.status(404).json({ error: 'That item is already gone.' }); return null }
  if (item.kind === 'own') {
    res.status(400).json({ error: 'Personal kit is already yours — nobody else brings it.' })
    return null
  }
  const memberId = clean(req.body?.memberId, 64)
  const member = db.prepare('SELECT * FROM members WHERE id = ? AND trip_id = ?').get(memberId, item.trip_id)
  if (!member) { res.status(400).json({ error: 'Join the trip before putting your name down.' }); return null }
  return { item, member }
}

app.post('/api/items/:id/claim', (req, res) => {
  const found = claimant(req, res)
  if (!found) return
  const { item, member } = found

  const has = db.prepare('SELECT 1 FROM claims WHERE item_id = ? AND member_id = ?').get(item.id, member.id)
  if (has) db.prepare('DELETE FROM claims WHERE item_id = ? AND member_id = ?').run(item.id, member.id)
  else db.prepare('INSERT INTO claims (item_id, member_id) VALUES (?, ?)').run(item.id, member.id)

  // Named, because a claim taken off by somebody else is the one change on this
  // list you would want to know was not you.
  const who = actorName(item.trip_id, req)
  const self = member.name === who
  logEvent(item.trip_id, who,
    has ? `dropped ${item.title}${self ? '' : ` for ${member.name}`}`
      : self ? `is bringing ${item.title}` : `put ${member.name} down for ${item.title}`)

  bumpRev(item.trip_id)
  res.json(getTripState(item.trip_id, viewerId(req)))
})

// Your half of a group thing being in the car. Each person who is bringing some
// of it ticks their own, so "packed" is a thing several people can each be half
// of — and putting a tick against it means you are bringing it, if you were not
// already on the list.
app.post('/api/items/:id/packed', (req, res) => {
  const found = claimant(req, res)
  if (!found) return
  const { item, member } = found
  const packed = req.body?.packed ? 1 : 0

  db.prepare(`INSERT INTO claims (item_id, member_id, packed) VALUES (?, ?, ?)
              ON CONFLICT(item_id, member_id) DO UPDATE SET packed = excluded.packed`)
    .run(item.id, member.id, packed)

  logEvent(item.trip_id, actorName(item.trip_id, req), `${packed ? 'packed' : 'unpacked'} ${item.title}`)
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

// Back in the car, on the way home. The same shape as ticking off your own kit —
// a set of ticks, toggled one at a time — because by Sunday there is no claiming
// left to do: whoever brought a thing is who has to find it again.
//
// Deliberately not logged. A pack-down is fifty ticks in ten minutes, and a feed
// of them would bury the trip they belong to.
app.post('/api/items/:id/stow', (req, res) => {
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id)
  if (!item) return res.status(404).json({ error: 'That item is already gone.' })
  const memberId = clean(req.body?.memberId, 64)
  const member = db.prepare('SELECT * FROM members WHERE id = ? AND trip_id = ?').get(memberId, item.trip_id)
  if (!member) return res.status(400).json({ error: 'Join the trip before ticking things off.' })
  if (!mayTouch(item, member.id)) return res.status(403).json({ error: "That's on somebody else's personal list." })

  const has = db.prepare('SELECT 1 FROM stows WHERE item_id = ? AND member_id = ?').get(item.id, member.id)
  if (has) db.prepare('DELETE FROM stows WHERE item_id = ? AND member_id = ?').run(item.id, member.id)
  else db.prepare('INSERT INTO stows (item_id, member_id) VALUES (?, ?)').run(item.id, member.id)

  bumpRev(item.trip_id)
  res.json(getTripState(item.trip_id, viewerId(req) || member.id))
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

const PUBLIC = join(__dirname, 'public')

// Every asset is referenced by a hash of its own bytes, so `/app.js?v=<hash>`
// names one exact build and can be kept for a year. A deploy changes the bytes,
// which changes the hash, which changes the URL — so phones fetch the new file
// instead of sitting on an hour-old copy of the old one. Nothing is ever
// invalidated; the old URL is simply no longer pointed at.
const ASSETS = ['app.js', 'styles.css', 'manifest.webmanifest']
const assetVersions = new Map(ASSETS.map((name) => [
  name,
  createHash('sha256').update(readFileSync(join(PUBLIC, name))).digest('hex').slice(0, 8),
]))

// Hashes are stamped into the markup once, at boot. Only root-relative hrefs and
// srcs are candidates, which leaves the data: icon and the Google Fonts links
// alone, and an unrecognised name is passed through untouched.
const indexHtml = readFileSync(join(PUBLIC, 'index.html'), 'utf8')
  .replace(/\b(href|src)="\/([^"?]+)"/g, (whole, attr, name) => (
    assetVersions.has(name) ? `${attr}="/${name}?v=${assetVersions.get(name)}"` : whole
  ))

// index.html is the pointer carrying the current hashes, so it is the one file
// that must never be held: a stale copy here means a stale copy of everything.
const sendIndex = (_req, res) => res.set('Cache-Control', 'no-cache').type('html').send(indexHtml)

app.get('/', sendIndex)

// The worker is handed the same hashed URLs the markup got, so what it keeps
// for offline is exactly what the page asks for — and the combined hash rides
// along in its bytes, which is how a browser is told a new worker exists at an
// unchanged path. Like index.html it must never be held, or a phone would go on
// installing last week's worker.
const swVersion = createHash('sha256')
  .update([...assetVersions.values()].join('|'))
  .digest('hex')
  .slice(0, 8)

const hashed = (name) => `/${name}?v=${assetVersions.get(name)}`

const swJs = readFileSync(join(PUBLIC, 'sw.js'), 'utf8')
  .replace('__VERSION__', swVersion)
  .replace('__PRECACHE__', JSON.stringify(['/', ...ASSETS.map(hashed)]))

app.get('/sw.js', (_req, res) => (
  res.set('Cache-Control', 'no-cache').type('js').send(swJs)
))

app.use(express.static(PUBLIC, {
  index: false,
  setHeaders(res, path) {
    // Only a URL carrying the hash that matches the file earns the long life,
    // because that is the only URL whose bytes cannot change under it. A bare
    // /app.js stays reachable and keeps revalidating.
    if (res.req.query.v && res.req.query.v === assetVersions.get(basename(path))) {
      res.set('Cache-Control', 'public, max-age=31536000, immutable')
    }
  },
}))

app.get('/{*path}', sendIndex)

const port = process.env.PORT || 3000
app.listen(port, () => console.log(`camping-sync listening on :${port}`))
