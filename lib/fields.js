// What a field is allowed to be. These are the shapes the database is willing
// to hold, kept apart from the routes that ask for them because the assistant
// writes to the same columns through a different door — and a tool call that
// validated its own way would be a second, quieter answer to "what is a day".
// One definition, both callers.

export const clean = (v, max = 400) => String(v ?? '').trim().slice(0, max)

// One line of a message somebody else wrote, for a quote, a pin or the feed.
// The cut happens on the way out rather than in CSS: a page of fifty messages
// carrying fifty full second copies is a payload paid for over exactly the
// signal this app is meant to survive, and the message itself is a tap away.
// Whitespace collapses first, so a body with three blank lines in it does not
// spend its whole allowance on them.
export const QUOTE_MAX = 140
export const excerpt = (text, max = QUOTE_MAX) => {
  const said = String(text ?? '').replace(/\s+/g, ' ').trim()
  return said.length > max ? `${said.slice(0, max - 1)}…` : said
}

// Camp answers in a small subset of Markdown and the room draws it, so `**` is
// a word being emphasised there and two asterisks anywhere an excerpt goes. The
// marks come off before the cut rather than after it: an excerpt sliced through
// `**s'mores kit**` ends on half a mark, which no amount of stripping downstream
// can put back together. Only Camp's own text is parsed as Markdown in the
// thread, so only Camp's own text is unmarked here — an asterisk somebody typed
// is an asterisk they meant. The structures are the ones assistantHtml() and
// assistantInline() draw, and nothing else.
export const unmark = (text) => String(text ?? '')
  .replace(/\r\n?/g, '\n')
  .split('\n')
  .map((line) => line.trim()
    .replace(/^#{1,3}\s+/, '')
    .replace(/^[-*]\s+/, '')
    .replace(/^\d+[.)]\s+/, ''))
  .join('\n')
  .replace(/\*\*([^*\n]+)\*\*/g, '$1')
  .replace(/`([^`\n]+)`/g, '$1')

export const LISTS = new Set(['gear', 'food', 'drinks', 'activities'])

// The map link ends up in an href that everyone on the trip taps, and anyone
// with the code can set it. So only ordinary web links are stored: a pasted
// `maps.app.goo.gl/…` gets the scheme it is missing, and anything that isn't
// http(s) after that is dropped rather than kept.
export function mapUrl(raw) {
  const v = clean(raw, 500)
  if (!v) return ''
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? v : `https://${v}`)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : ''
  } catch { return '' }
}

// Where the trip is gets more room than its name: it is one field holding a real
// place, and a full one runs to a site, a village, a postcode and a country.
export const TRIP_FIELDS = ['name', 'location', 'map_url', 'start_date', 'end_date', 'notes', 'currency']
export const TRIP_LIMITS = { notes: 4000, location: 200 }
// A place on an item is the same kind of answer as a place on the trip.
export const PLACE_MAX = TRIP_LIMITS.location

export const currencyField = (v) => {
  const code = clean(v, 3).toUpperCase()
  return /^[A-Z]{3}$/.test(code) ? code : null
}

export const tripField = (f, v) => (f === 'map_url' ? mapUrl(v)
  : f === 'currency' ? currencyField(v)
  : clean(v, TRIP_LIMITS[f] ?? 120))

// Costs arrive as ordinary decimal strings and become integer minor units at
// the boundary. Empty or zero clears a cost; anything with half a penny or an
// implausibly large value is refused instead of rounded silently.
export function money(raw) {
  const value = String(raw ?? '').trim()
  if (!value) return 0
  const match = value.match(/^(\d{1,7})(?:\.(\d{1,2}))?$/)
  if (!match) return null
  return Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'))
}

// Minor units back into the decimal string the same parser would accept. Money
// leaves the app as text wherever a person or a model has to read it, because
// 1250 is not a price and "12.5" is not one either.
export const moneyText = (minor) => (Number(minor) / 100).toFixed(2)

// The pin that comes with a searched-for place. Both halves or neither: half a
// coordinate is a point in the sea. An empty box is not a zero, so blanks stay
// null rather than becoming a spot in the Gulf of Guinea.
export function coords(body) {
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
export const ALL_WEEK = 'any'
export const isDay = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s)
export const dayField = (v) => {
  const s = clean(v, 10)
  return isDay(s) || s === ALL_WEEK ? s : ''
}
export const timeField = (v) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(clean(v, 5)) ? clean(v, 5) : '')

// The feed is written in English and read by whoever is on the trip, not by the
// machine it runs on, so the weekday is named rather than dated. A date with the
// right shape and no such day in it — the 31st of February — reads back as it
// was written rather than as "Invalid Date".
export function dayName(day) {
  if (day === ALL_WEEK) return 'every day'
  const d = new Date(`${day}T12:00:00`)
  return Number.isNaN(+d) ? day
    : d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
}

// The weekday on its own, for anything that already has the date beside it.
export function weekdayName(day) {
  const d = new Date(`${day}T12:00:00`)
  return Number.isNaN(+d) ? '' : d.toLocaleDateString('en-GB', { weekday: 'long' })
}

// Plans are always a group thing; there is no "bring your own hike".
export const kindOf = (raw, list) => (raw === 'own' && list !== 'activities' ? 'own' : 'shared')

// An 'own' item is one person's private business, so the shared feed never hears
// about it — an entry saying you added a chess board tells the group both that
// it exists and that it is yours, which is the whole thing we are hiding.
export const isPrivate = (item) => item.kind === 'own' && !!item.owner_id

// Nobody edits or deletes somebody else's personal kit. Legacy unowned rows stay
// editable by anyone, because today they are still everyone's list.
export function mayTouch(item, memberId) {
  return !isPrivate(item) || item.owner_id === memberId
}
