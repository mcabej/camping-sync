/* Camping Sync — client. Vanilla, no build step.
   Rendering is string-based with one delegated click handler; every mutation
   returns the whole trip state, so there is exactly one source of truth. */

const MEMBER_COLORS = ['#2F6B57', '#37698F', '#7A5AA6', '#8C6A2F', '#B23C6B', '#4E7A2A', '#2E6E77', '#6B5B4A']

// Four places you do something, and no more. A tab bar is a promise that these
// are the things the app is for, and it stops being one somewhere around five.
// Camp rides alongside them in the bar but is not one of them — it is the trip
// itself, not a fifth thing to keep on top of.
//
// Eat carries two lists. Food and drink are one shop, one cooler and one
// question — "who is feeding us" — and keeping them apart cost a whole tab to
// say something the categories already say.
//
// Mine is the one tab that cuts the other way: the lists answer "who is
// bringing what", and this answers "what am I carrying to the car", which is
// the only question you have on the morning you leave.
const TABS = [
  { id: 'pack', lists: ['gear'], label: 'Pack', title: 'Packing list' },
  { id: 'eat', lists: ['food', 'drinks'], label: 'Eat', title: 'Food and drink' },
  // "Do" was a shrug — it read as a to-do list, which is the one thing this tab
  // is not. Nothing here is assigned to anybody and nothing gets ticked off:
  // it is a board of ideas you vote for. "Plan" says that, and it keeps the
  // bar's rhythm — Pack, Eat, Plan — of naming the thing you came here to do.
  { id: 'do', lists: ['activities'], label: 'Plan', title: 'Plans' },
  { id: 'mine', lists: [], label: 'Mine', title: 'Yours to pack' },
]

// Where the trip is, who is coming, the invite link. It is a place you go, not
// a panel you pull down over the list you were reading, so it sits in the bar
// with the rest. It is kept out of TABS because it carries no list: everything
// that counts, badges or filters a list would have to special-case it.
const CAMP = { id: 'camp', lists: [], label: 'Camp', title: 'The trip' }

const tabById = (id) => TABS.find((t) => t.id === id) ?? TABS[0]
const currentTab = () => tabById(S.tab)
const isPlanTab = (tab) => tab.lists.includes('activities')

// What to call each half of the Eat tab when the two have to be told apart.
const LIST_WORD = { food: 'Food', drinks: 'Drink' }

// The two ways a thing gets brought. This distinction runs through the whole app.
// The wording earns its keep here: people read "Personal kit" as "my own list"
// and it now is one — private to you, invisible to everyone else on the trip.
// It used to be a switch in the header, charging every list 40px of the screen
// for a question most people answer once; it is a filter chip now, and the chip
// is the whole explanation — what each half means is said where it is acted on,
// in the add and assign sheets, rather than in a paragraph over the list.
const SECTIONS = {
  shared: { label: 'For the group' },
  own: { label: 'Personal kit' },
}

const ICONS = {
  pack: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8h12l1 12H5L6 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
  // A fork and a glass: the tab is one shop, and the icon has to say so.
  eat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 3v7a2 2 0 0 0 4 0V3"/><path d="M6.5 10v11"/><path d="M13.2 4h7.6l-1.1 7.4a2.9 2.9 0 0 1-5.4 0L13.2 4Z"/><path d="M17 14.5V21"/><path d="M14.2 21h5.6"/></svg>',
  // A compass, for the tab that asks "what are we doing with the day". The
  // mountain that used to sit here now belongs to the tent next door, and two
  // triangles in one bar told you nothing about either.
  do: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m15.6 8.4-2.1 5.1-5.1 2.1 2.1-5.1 5.1-2.1Z"/></svg>',
  mine: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4h6v3H9V4Z"/><path d="M9 5.5H6.5A1.5 1.5 0 0 0 5 7v12.5A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V7a1.5 1.5 0 0 0-1.5-1.5H15"/><path d="m9 13.5 2 2 4.5-4.5"/></svg>',
  // A tent, not a globe. The button opens the trip — where it is, who is coming
  // — and a globe was the icon for "somewhere on Earth", which is nowhere.
  camp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3.6 20.5 14 3.8"/><path d="M20.4 20.5 10 3.8"/><path d="M15.5 20.5 12 14.6l-3.5 5.9"/><path d="M2.2 20.5h19.6"/></svg>',
  tick: '<svg viewBox="0 0 24 24" fill="none" stroke="#F4F8F0" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5 9.5 18 20 6.5"/></svg>',
  tickGreen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5 9.5 18 20 6.5"/></svg>',
  x: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  plus: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  pin: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/></svg>',
  spark: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5 13.8 9l5.7 1.8-5.7 1.8L12 18l-1.8-5.4L4.5 10.8 10.2 9 12 3.5Z"/><path d="M19 3v3M20.5 4.5h-3"/></svg>',
  // iOS draws its Share button as a box with an arrow leaving it, and the only
  // way to install on that phone is to say "tap this" and mean that one.
  share: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3.5"/><path d="m8.5 7 3.5-3.5L15.5 7"/><path d="M7.5 10.5H5.5a1 1 0 0 0-1 1V20a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-8.5a1 1 0 0 0-1-1h-2"/></svg>',
  // The icon the home screen would get, so the offer shows the thing itself.
  mark: '<svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="7.5" fill="#1B382E"/><path d="M16 6 6 26h20z" fill="#E9EDE6"/><path d="M16 14 11 26h10z" fill="#1B382E"/></svg>',
}

// ---- state ------------------------------------------------------------------

const S = {
  view: 'boot',      // boot | landing | join | trip | missing
  tab: 'pack',
  // The trip page, over the top of whichever tab you were on. Not a tab of its
  // own, so the bar always has exactly one answer to "where am I".
  camp: false,
  // How the list on screen is narrowed: who brings it, and what kind of thing
  // it is. Empty means everything, which is where every tab starts.
  filter: { kind: '', cat: '' },
  trip: null, members: [], items: [], events: [],
  catalog: null, tips: [],
  me: null,          // member id
  rev: 0,
  sheet: null,       // { kind, ...payload }
  busy: false,
  editNotes: false,  // the shared notes read as text until you ask to change them
  editWhere: false,  // same for where the trip is, which is read far more than written
  expand: { tips: false, feed: false },
  // Home page: the trips this device has joined. null while we're still asking.
  trips: null,
  joinCode: '',
  joinError: '',
  // Set when the name you typed is already on the trip: { name, asking } where
  // asking is 'who' (are you them?) or 'name' (tell the two of you apart).
  joinClash: null,
  showCreate: false,
}

const root = document.getElementById('root')
const sheetRoot = document.getElementById('sheet-root')
const toastEl = document.getElementById('toast')

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

const colorOf = (m) => MEMBER_COLORS[(m?.hue ?? 0) % MEMBER_COLORS.length]
const memberById = (id) => S.members.find((m) => m.id === id) || null
const meMember = () => memberById(S.me)

let toastTimer
function toast(msg) {
  toastEl.textContent = msg
  toastEl.classList.add('is-up')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => toastEl.classList.remove('is-up'), 2600)
}

// ---- api --------------------------------------------------------------------

async function api(path, opts = {}) {
  const headers = { 'content-type': 'application/json' }
  if (S.me) headers['x-member-id'] = S.me
  let res
  try {
    res = await fetch(`/api${path}`, { ...opts, headers, body: opts.body ? JSON.stringify(opts.body) : undefined })
  } catch {
    // A dead network is not a refusal, and "Failed to fetch" is not something to
    // put in front of somebody standing in a field. Reads have a cached answer
    // behind them; a write has nothing, so it has to say it did not happen.
    throw new Error('No signal. That change is not saved.')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    // Some refusals are a question rather than a failure — a name clash on join
    // needs the body, not just the message, so it rides along on the error.
    const err = new Error(data.error || 'Something went wrong. Try again.')
    err.payload = data
    throw err
  }
  return data
}

function absorb(state) {
  if (!state?.trip) return
  S.trip = state.trip
  S.members = state.members
  S.items = state.items
  S.events = state.events
  S.rev = state.trip.rev
  render()
}

async function mutate(fn) {
  if (S.busy) return
  S.busy = true
  try {
    absorb(await fn())
  } catch (err) {
    toast(err.message)
  } finally {
    S.busy = false
  }
}

// ---- derived ----------------------------------------------------------------

const itemsIn = (list) => S.items.filter((i) => i.list === list)
const isOwn = (it) => it.kind === 'own'
const isMine = (it) => !!S.me && it.own.includes(S.me)
const isPlan = (it) => it.list === 'activities'

// Who is bringing a group thing. More than one person can, because a group of
// ten does not send one person for all the pillows — so this is a set, and each
// person in it has their own tick for their own share being in the car.
const claimsOn = (it) => it.claims ?? []
const myClaim = (it) => (S.me ? claimsOn(it).find((c) => c.member_id === S.me) : null) ?? null
const isClaimed = (it) => claimsOn(it).length > 0

// The same list with the people filled in, and anyone who has left the trip
// dropped: a name nobody can put a face to is not an answer to "who has this".
const crew = (it) => claimsOn(it)
  .map((c) => ({ ...c, member: memberById(c.member_id) }))
  .filter((c) => c.member)

// Everything under one tab, its lists in the order the tab names them — food
// before drink, so the page reads the way the shop does. Positions restart per
// list, so this is the only ordering that means anything across two of them.
const itemsOn = (tab) => tab.lists.flatMap(itemsIn)

// Personal kit is worth offering on any tab the catalogue has one-each
// suggestions for, even before the trip has added one — otherwise there is
// nowhere to go looking for it.
const hasOwnSection = (tab) =>
  itemsOn(tab).some(isOwn) || tab.lists.some((l) => (S.catalog?.[l] ?? []).some((c) => c.own))

const catOf = (it) => it.category || 'Other'

const inKind = (it, kind) => !kind || (kind === 'own') === isOwn(it)
const matchesFilter = (it, f) => inKind(it, f.kind) && (!f.cat || catOf(it) === f.cat)

// What the page on screen can be narrowed: everything it would show unfiltered,
// and whether both halves are a question on it at all.
//
// A list offers the personal-kit chip on the catalogue's say-so, before the trip
// has a single own item, because otherwise there is nowhere to go looking for
// one. Your own tab has nothing to discover — it only ever shows what exists —
// so there the chips wait until there is something behind both of them.
function pageParts() {
  const tab = currentTab()
  if (tab.id !== 'mine') return { items: itemsOn(tab), kinds: hasOwnSection(tab) }
  const load = myLoad()
  return { items: load, kinds: load.some(isOwn) && load.some((it) => !isOwn(it)) }
}

// Nothing pressed means everything. A page with no personal half has no chip to
// press, so a leftover 'own' from the tab you came from cannot hide a list.
function activeFilter() {
  return { kind: pageParts().kinds ? S.filter.kind : '', cat: S.filter.cat }
}

// What "add" and "what am I missing?" mean while a filter is on. Narrowing the
// list to your own kit is as clear a way of saying "this one is mine" as the
// switch in the sheet, so the sheets open where you are looking.
const activeSection = () => (activeFilter().kind === 'own' ? 'own' : 'shared')

// Each section answers a different question, so each gets its own tally.
// Plans are not "brought" by anyone, so they are counted by interest instead.
//
// A thing with three names on it is still one thing, so it is one unit of the
// bar split three ways. Counting it once per person would let a crowded item
// swell the coloured half and quietly shrink the gap nobody has filled.
function statsFor(items) {
  const perMember = new Map()
  let shared = 0, open = 0, own = 0, mine = 0, ideas = 0, wanted = 0

  for (const it of items) {
    if (isPlan(it)) {
      ideas++
      if (it.votes.length) wanted++
    } else if (isOwn(it)) {
      own++
      if (isMine(it)) mine++
    } else {
      shared++
      const on = crew(it)
      if (!on.length) { open++; continue }
      for (const c of on) {
        const had = perMember.get(c.member_id) ?? { share: 0, n: 0 }
        perMember.set(c.member_id, { share: had.share + 1 / on.length, n: had.n + 1 })
      }
    }
  }
  return { shared, open, claimed: shared - open, perMember, own, mine, ideas, wanted }
}

// Everything that is yours to put in the car: the shared things you have put
// your name to, and your personal kit — which needs no filtering, because the
// server never sends anyone else's. Plans are not carried, so they stay out.
function myLoad() {
  if (!S.me) return []
  return S.items.filter((it) => !isPlan(it) && (isOwn(it) || myClaim(it)))
}

// Everyone ticks their own share, so "is this packed" is a question with as many
// answers as there are names on it. This is yours.
const packedForMe = (it) => (isOwn(it) ? isMine(it) : !!myClaim(it)?.packed)

// And this is the item's: done when everybody who put their name down has their
// share in the car. Half of the bacon in the boot is not the bacon sorted.
const allPacked = (it) => (isOwn(it) ? isMine(it) : isClaimed(it) && claimsOn(it).every((c) => c.packed))

function groupByCategory(items) {
  const groups = new Map()
  for (const it of items) {
    if (!groups.has(catOf(it))) groups.set(catOf(it), [])
    groups.get(catOf(it)).push(it)
  }
  return [...groups.entries()]
}

// Where the trip is, is stored in full — "Wasdale Head Campsite, Wasdale Head,
// CA20 1EX, United Kingdom" — because that is the answer to "where is it".
// Headers and cards have no room for the country, and the part in front of the
// first comma is the part anyone would say out loud.
const firstPart = (s) => String(s ?? '').split(',')[0].trim()
const shortWhere = (trip) => firstPart(trip?.location)

function fmtDates(trip) {
  const f = (d) => {
    if (!d) return ''
    const dt = new Date(`${d}T12:00:00`)
    if (Number.isNaN(+dt)) return d
    return dt.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
  }
  const a = f(trip.start_date), b = f(trip.end_date)
  if (a && b) return `${a} – ${b}`
  return a || b || ''
}

// "13–15 Nov 26", for the header only — the trip page and the trip picker keep
// the full "Fri 13 Nov – Sun 15 Nov" form, because that is where you read the
// dates to plan around them. The header is a label: you are checking which trip
// this is, so it drops the weekday and shortens the year, but keeps the month
// as a word. Nobody has to work out what "11" is.
//
// A range says the parts it repeats once — same month, one month; same year,
// one year — so a weekend is "13–15 Nov 26" rather than twice the same tail.
function shortDates(trip) {
  const day = (s) => {
    if (!s) return null
    const d = new Date(`${s}T12:00:00`)
    return Number.isNaN(+d) ? null : d
  }
  const yy = (d) => String(d.getFullYear() % 100).padStart(2, '0')
  const dm = (d) => `${d.getDate()} ${d.toLocaleDateString(undefined, { month: 'short' })}`
  const full = (d) => `${dm(d)} ${yy(d)}`

  const a = day(trip?.start_date), b = day(trip?.end_date)
  if (!a || !b) return a || b ? full(a ?? b) : ''
  if (+a === +b) return full(a)
  if (a.getFullYear() !== b.getFullYear()) return `${full(a)} – ${full(b)}`
  if (a.getMonth() !== b.getMonth()) return `${dm(a)} – ${full(b)}`
  return `${a.getDate()}–${full(b)}`
}

function ago(iso) {
  const secs = Math.max(0, (Date.now() - new Date(iso)) / 1000)
  if (secs < 90) return 'now'
  if (secs < 3600) return `${Math.round(secs / 60)}m`
  if (secs < 86400) return `${Math.round(secs / 3600)}h`
  return `${Math.round(secs / 86400)}d`
}

// ---- shared partials --------------------------------------------------------

// The segments and the sentence for one list, in one place: the sticky header
// draws them on dark canvas, the Camp tab draws all four of them on paper.
// `empty` is a caller's problem, because the two backgrounds want different ink.
const seg = (flex, bg) => `<div class="coverage__seg" style="flex:${flex};background:${bg}"></div>`

function barParts(tab, section) {
  const c = statsFor(itemsOn(tab))

  if (isPlanTab(tab)) {
    if (!c.ideas) return { empty: 'no ideas yet', say: 'Add what you fancy doing.', aria: 'no ideas yet' }
    const rest = c.ideas - c.wanted
    return {
      segs: `${c.wanted ? seg(c.wanted, 'var(--m0)') : ''}
             ${rest ? `<div class="coverage__seg coverage__seg--quiet" style="flex:${rest}"></div>` : ''}`,
      say: `<b>${c.wanted} of ${c.ideas}</b> ${c.ideas === 1 ? 'idea has' : 'ideas have'} a vote`,
      short: `<b>${c.wanted}</b> of ${c.ideas} voted`,
      aria: `${c.wanted} of ${c.ideas} ideas have a vote`,
    }
  }

  if (section === 'own') {
    if (!c.own) return { empty: 'nothing here yet', say: 'Nothing on your personal list.', aria: 'nothing here yet' }
    const left = c.own - c.mine
    return {
      segs: `${c.mine ? seg(c.mine, colorOf(meMember())) : ''}
             ${left ? `<div class="coverage__seg coverage__seg--gap" style="flex:${left}"></div>` : ''}`,
      say: left === 0 ? '<b>All packed.</b>' : `<b>${left}</b> still to pack`,
      aria: `you have packed ${c.mine} of ${c.own}`,
    }
  }

  if (!c.shared) return { empty: 'nothing here yet', say: 'Nothing on this list.', aria: 'nothing here yet' }

  const segs = [...c.perMember.entries()]
    .map(([id, { share, n }]) => `<div class="coverage__seg" style="flex:${share};background:${colorOf(memberById(id))}"
           title="${esc(memberById(id).name)}: ${n}"></div>`).join('')

  return {
    segs: `${segs}${c.open > 0 ? `<div class="coverage__seg coverage__seg--gap" style="flex:${c.open}"></div>` : ''}`,
    say: c.open === 0 ? `<b>All ${c.shared} covered.</b>` : `<b>${c.open}</b> need someone`,
    aria: `${c.claimed} of ${c.shared} claimed`,
  }
}

// The same bar for the one list that is not a list: your own load, wherever on
// the trip it came from. Your colour for what is in the car, blaze for what is
// not — which is the same promise the bar makes everywhere else.
// The chips narrow the bar with the page, the same as they do on a list.
function mineParts() {
  const load = myLoad().filter((it) => inKind(it, activeFilter().kind))
  if (!load.length) return { empty: 'nothing yours yet', say: 'Nothing has your name on it.', aria: 'nothing on your list' }
  const done = load.filter(packedForMe).length
  const left = load.length - done
  return {
    segs: `${done ? seg(done, colorOf(meMember())) : ''}
           ${left ? `<div class="coverage__seg coverage__seg--gap" style="flex:${left}"></div>` : ''}`,
    say: left === 0 ? `<b>All ${load.length} packed.</b>` : `<b>${left}</b> still to pack`,
    aria: `you have packed ${done} of ${load.length}`,
  }
}

// One bar, one line, for whichever section is on screen. It reads left to right:
// how much is handled, then how much is not.
function coverageBar(p) {
  return `
    <div class="cov">
      <div class="cov__track${p.empty ? ' cov__track--empty' : ''}" role="img" aria-label="${p.aria}">
        ${p.empty ? `<span class="cov__empty">${p.empty}</span>` : p.segs}</div>
      <p class="cov__say">${p.say}</p>
    </div>`
}

// The list narrows from the top of the page rather than from the header: chips
// you scroll past, instead of a switch that charged every tab the same height
// whether or not anybody used it. They also do the thing the switch could not —
// a packing list you can cut down to Shelter is one you can read on a phone.
//
// Nothing pressed is everything, and pressing a chip again puts it back. Each
// kind chip carries what is left to do behind it — `count` returns that number
// and whether it is yours, because blaze means "nobody has this" everywhere in
// the app and your own kit is somebody's.
function filterBar(all, kinds, count) {
  const f = activeFilter()
  if (!all.length) return ''

  const kindChip = (key) => {
    const [n, yours] = count(key)
    return `
      <button class="filters__chip" data-act="filter-kind" data-value="${key}" aria-pressed="${f.kind === key}">
        ${SECTIONS[key].label}${n ? `<span class="filters__n"${yours
          ? ` style="background:${colorOf(meMember())};color:#F4F8F0"` : ''}>${n}</span>` : ''}</button>`
  }

  const catChip = (cat) => `
    <button class="filters__chip" data-act="filter-cat" data-value="${esc(cat)}"
            aria-pressed="${f.cat === cat}">${esc(cat)}</button>`

  // The categories on offer are the ones left after the first chip, so the row
  // never offers a cut that comes back empty.
  const cats = [...new Set(all.filter((i) => inKind(i, f.kind)).map(catOf))]

  return `
    <div class="filters" role="group" aria-label="Filter this list">
      ${kinds ? `${kindChip('shared')}${kindChip('own')}
        <span class="filters__div" aria-hidden="true"></span>` : ''}
      ${cats.map(catChip).join('')}
    </div>`
}

// Only reachable by chipping away at a page that does have things on it, so the
// way out is the filter rather than the list.
const noMatch = (f) => `
  <div class="empty">
    <h3>Nothing in ${esc(f.cat)}</h3>
    <p>Not with that filter on, anyway.</p>
    <button class="btn" data-act="filter-cat" data-value="${esc(f.cat)}">Show the whole list</button>
  </div>`

// A person, in the space a face takes. Two letters at most: on a row this is
// scenery until you look for yourself in it, and then it has to answer at once.
function initials(name) {
  const words = String(name ?? '').trim().split(/\s+/).filter(Boolean)
  if (!words.length) return '?'
  const letters = words.length > 1 ? words[0][0] + words[words.length - 1][0] : words[0].slice(0, 2)
  return letters.toUpperCase()
}

// The one control you touch most, at the left of the row where a list keeps its
// checkbox. Three states in the order you meet them: nobody has this yet (blaze
// ring, tap to put your name down), you are bringing it (your colour, tap when
// it is in the car), packed (filled). It is only ever about you — everybody
// else's ticks are the faces on the other side of the row.
function tickBox(item) {
  const own = isOwn(item)
  const claim = own ? null : myClaim(item)
  const on = own || !!claim
  const done = packedForMe(item)
  const me = meMember()

  const label = own
    ? (done ? `Yours is packed — untick ${item.title}` : `Tick ${item.title} when yours is packed`)
    : !on ? `Put my name to ${item.title}`
    : done ? `Your share of ${item.title} is packed — untick it`
    : `Tick ${item.title} when your share is packed`

  const cls = done ? ' tick--done' : on ? ' tick--mine' : isClaimed(item) ? '' : ' tick--open'
  return `
    <button class="tick${cls}" data-act="tick" data-id="${item.id}" aria-pressed="${done}"
            ${me ? `style="--mine:${colorOf(me)}"` : ''} aria-label="${esc(label)}">
      ${done ? ICONS.tick : on ? '' : ICONS.plus}</button>`
}

// Who is bringing it. Three faces and a count say what "Josh, Sam and Ali are
// bringing it" says, in a quarter of the row and without changing shape when a
// fourth person joins in. A filled face has their share packed; an outlined one
// has put their name down and not packed it yet — the same promise the tick on
// the left of the row makes.
//
// Nothing at all when nobody has it: the blaze ring on the left already says so,
// and a row with no faces on it is the plainest way of saying nobody is there.
// The way in is the row itself, which opens the same sheet the faces do.
const FACES = 3

function whoBtn(item) {
  const on = crew(item)
  if (!on.length) return ''
  const shown = on.slice(0, FACES)
  const rest = on.length - shown.length
  const verb = isPlan(item) ? 'organising' : 'bringing'

  return `
    <button class="who" data-act="open-item" data-id="${item.id}"
            aria-label="${esc(`${on.map((c) => c.member.name).join(', ')} ${on.length === 1 ? 'is' : 'are'} ${verb} ${item.title} — change who`)}">
      <span class="who__faces">${shown.map((c) => `
        <span class="who__face${c.packed ? ' who__face--packed' : ''}"
              style="--who:${colorOf(c.member)}">${esc(initials(c.member.name))}</span>`).join('')}</span>
      ${rest ? `<span class="who__more">+${rest}</span>` : ''}
    </button>`
}

// "The sunset spot" means nothing to whoever has not been there. A plan can say
// where it is, and once it does the chip is the way back to it — tapping it
// opens the same sheet, which is where the map link lives.
function placeChip(item) {
  const place = firstPart(item.place)
  if (!place) return `<button class="tag" data-act="place" data-id="${item.id}">${ICONS.pin} Add a place</button>`
  return `<button class="chip chip--place" data-act="place" data-id="${item.id}">
            ${ICONS.pin}<span class="chip__where">${esc(place)}</span></button>`
}

// `mixed` is whether group things and personal kit are sharing the page. When
// they are, an own row says so: it is the difference between a tick everyone is
// counting on and one only you will ever see.
//
// Three parts, always in the same places: your tick, the thing itself, and who
// has it. The middle is the way into everything else the item can do, so the row
// carries no sentences — the sheet says them, once, when you have asked.
function itemRow(item, mixed) {
  const own = isOwn(item)
  const plan = isPlan(item)
  const votes = plan ? item.votes.length : 0

  const meta = [
    plan ? placeChip(item) : '',
    votes ? `<span class="item__votes">${votes} up for it</span>` : '',
  ].filter(Boolean).join('')

  return `
    <li class="item${allPacked(item) ? ' item--packed' : ''}">
      ${plan ? voteBox(item) : tickBox(item)}
      <div class="item__main">
        <button class="item__open" data-act="open-item" data-id="${item.id}">
          <span class="item__title">${esc(item.title)}${item.qty ? `<span class="item__qty">${esc(item.qty)}</span>` : ''}</span>
          ${mixed && own ? '<span class="mine__from">personal kit · only you see this</span>' : ''}
          ${item.note ? `<span class="item__note">${esc(item.note)}</span>` : ''}
        </button>
        ${meta ? `<div class="item__row">${meta}</div>` : ''}
      </div>
      ${own ? '' : whoBtn(item)}
    </li>`
}

// Nobody brings a hike, so the leading control on a plan answers the only
// question a plan asks: are you up for it. Same place, same shape, same tap.
function voteBox(item) {
  const voted = item.votes.includes(S.me)
  const me = meMember()
  return `
    <button class="tick${voted ? ' tick--done' : ''}" data-act="vote" data-id="${item.id}" aria-pressed="${voted}"
            ${me ? `style="--mine:${colorOf(me)}"` : ''}
            aria-label="${voted ? `You are up for ${esc(item.title)}` : `Say you are up for ${esc(item.title)}`}">
      ${voted ? ICONS.tick : ''}</button>`
}

// ---- views ------------------------------------------------------------------

// The trip you are going on next is a number, not a date range — so the card
// leads with it, and only falls back to words when there is nothing to count.
function whenBadge(t) {
  const c = countdown(t)
  if (!c) return '<span class="when when--none mono">no dates</span>'
  if (c.n) return `<span class="when"><b>${c.n}</b><span>${c.n === 1 ? 'day' : 'days'}</span></span>`
  // Blaze only ever means "nobody has picked this up", so the trip you are on
  // right now gets the forest, not the trail marker.
  return c.word === 'Happening now'
    ? '<span class="when when--live mono">now</span>'
    : '<span class="when when--none mono">past</span>'
}

// The trip you are on beats the one you leave for on Friday, which beats the
// one with no dates, which beats the one you got back from.
function tripRank(t) {
  const c = countdown(t)
  if (!c) return [1, 0]
  if (c.word === 'Happening now') return [-1, 0]
  if (c.n) return [0, c.n]
  return [2, -Date.parse(`${t.start_date}T12:00:00`) || 0]
}
const byWhen = (a, b) => {
  const x = tripRank(a), y = tripRank(b)
  return x[0] - y[0] || x[1] - y[1]
}

// The same bar as the one in the app, at a glance and in the same colours: who
// has got what, then the hatched gap nobody has picked up.
function tripBar(t) {
  if (!t.shared) return { track: '', say: 'Nothing on the lists yet' }
  const segs = t.claims.map(({ hue, n }) =>
    `<span class="coverage__seg" style="flex:${n};background:${colorOf({ hue })}"></span>`).join('')
  return {
    track: `${segs}${t.open ? `<span class="coverage__seg coverage__seg--gap" style="flex:${t.open}"></span>` : ''}`,
    say: t.open
      ? `<b class="say--open">${t.open}</b> still need someone`
      : `<b>All ${t.shared} covered.</b>`,
  }
}

function tripCard(t) {
  const bar = tripBar(t)
  const meta = [shortWhere(t), fmtDates(t), `${t.members} ${t.members === 1 ? 'person' : 'people'}`].filter(Boolean)
  const you = t.you
    ? `<span class="trip-card__you"><span class="trip-card__dot" style="background:${colorOf(t.you)}"></span>${esc(t.you.name)}</span>`
    : '<span class="trip-card__you trip-card__you--out">Add your name</span>'

  return `
    <div class="trip-card">
      <a class="trip-card__hit" href="/t/${encodeURIComponent(t.id)}" data-act="open-trip" data-id="${esc(t.id)}">
        <span class="trip-card__edge" style="background:${t.you ? colorOf(t.you) : 'var(--forest)'}"></span>
        <span class="trip-card__body">
          <span class="trip-card__top">
            <span class="trip-card__name">${esc(t.name)}</span>
            ${whenBadge(t)}
          </span>
          ${meta.length ? `<span class="trip-card__meta">${meta.map(esc).join(' · ')}</span>` : ''}
          ${bar.track ? `<span class="trip-card__track">${bar.track}</span>` : ''}
          <span class="trip-card__foot">${you}<span class="trip-card__say">${bar.say}</span></span>
        </span>
      </a>
      <button class="trip-card__forget" data-act="forget-trip" data-id="${esc(t.id)}"
              aria-label="Remove ${esc(t.name)} from this device">${ICONS.x}</button>
    </div>`
}

function tripsBlock() {
  if (S.trips === null) {
    return `<section class="landing__block" aria-busy="true">
              <div class="landing__block-head"><h2>Your trips</h2></div>
              <div class="trips">${'<div class="skel"></div>'.repeat(2)}</div>
            </section>`
  }
  if (!S.trips.length) return ''
  return `
    <section class="landing__block">
      <div class="landing__block-head">
        <h2>Your trips</h2>
        <span class="landing__block-n mono">${S.trips.length}</span>
      </div>
      <div class="trips">${[...S.trips].sort(byWhen).map(tripCard).join('')}</div>
    </section>`
}

function joinBlock() {
  return `
    <section class="landing__card landing__card--join">
      <h2>Join a trip</h2>
      <p>Paste the link a friend sent you, or just type the code from the end of it.</p>
      <form data-act="join-code" class="joinbar${S.joinError ? ' joinbar--bad' : ''}">
        <label class="sr-only" for="cs-code">Trip link or code</label>
        <input id="cs-code" name="code" value="${esc(S.joinCode)}" placeholder="pine-hollow-204"
               autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" maxlength="200">
        <button class="btn btn--primary" type="submit">Go</button>
      </form>
      ${S.joinError ? `<p class="joinbar__err">${esc(S.joinError)}</p>` : ''}
    </section>`
}

// Whoever you were last time is almost certainly who you are this time.
const lastKnownName = () => (S.trips ?? []).map((t) => t.you?.name).find(Boolean) ?? ''

function createBlock(folded) {
  if (folded && !S.showCreate) {
    return `<section class="landing__block">
              <button class="btn btn--wide" data-act="show-create">${ICONS.plus} Start another trip</button>
            </section>`
  }
  return `
    <section class="landing__card">
      <h2>Start a trip</h2>
      <p>Takes about twenty seconds. You'll get a link to send your friends — no accounts, no app to install.</p>
      <form data-act="create">
        <label class="field"><span>Your name</span>
          <input name="organiser" value="${esc(lastKnownName())}" placeholder="Josh" autocomplete="given-name" required maxlength="40"></label>
        <label class="field"><span>Trip name</span>
          <input name="name" placeholder="First camping trip" required maxlength="80"></label>
        <label class="field places"><span>Where</span>
          <input name="location" placeholder="Somewhere with a lake" maxlength="200"
                 data-places role="combobox" aria-expanded="false" aria-autocomplete="list"
                 aria-controls="cs-places" autocomplete="off" spellcheck="false">
          <input type="hidden" name="lat" data-places-lat>
          <input type="hidden" name="lon" data-places-lon></label>
        <div class="field field--split">
          <label class="field"><span>Arrive</span><input type="date" name="start_date"></label>
          <label class="field"><span>Leave</span><input type="date" name="end_date"></label>
        </div>
        <button class="btn btn--primary btn--wide" type="submit">Create the trip</button>
      </form>
    </section>`
}

// A first-time visitor needs the pitch and the form. Somebody who already has
// trips needs their trips — so the hero shrinks and the order flips.
function viewLanding() {
  const returning = S.trips === null || S.trips.length > 0
  const blocks = returning
    ? `${tripsBlock()}${joinBlock()}${createBlock(true)}`
    : `${createBlock(false)}${joinBlock()}`

  return `
  <div class="landing">
    <header class="landing__hero${returning ? ' landing__hero--tight' : ''}">
      <div class="landing__inner">
        <span class="eyebrow">Camping Sync</span>
        <h1>Who's bringing<br>the <em>tent?</em></h1>
        ${returning ? '' : `
          <p>One shared list for gear, food, drinks and plans. It keeps the tent one person brings apart from the sleeping bag you each need your own of, and the gaps stay visible until somebody fills them.</p>
          <div class="demo-bar" aria-hidden="true">
            <div class="demo-bar__label"><span>Sample packing list</span><span>9/14 claimed</span></div>
            <div class="demo-bar__track">
              <div class="demo-bar__seg" style="flex:4;background:#2F6B57"></div>
              <div class="demo-bar__seg" style="flex:3;background:#37698F"></div>
              <div class="demo-bar__seg" style="flex:2;background:#7A5AA6"></div>
              <div class="demo-bar__seg demo-bar__seg--gap"></div>
            </div>
          </div>`}
      </div>
    </header>

    <main class="landing__body">
      <div class="landing__stack">${blocks}${installBlock()}</div>
    </main>
  </div>`
}

// The one question the app cannot answer for you. Getting it wrong in the
// "same person" direction quietly gives two people one packing list, so the
// wording leads with the other Sam rather than with the convenient answer.
function joinClashCard() {
  const { name, asking } = S.joinClash
  if (asking === 'name') {
    return `
      <div class="landing__card">
        <h2>Two of you called ${esc(name)}</h2>
        <p>Add something that tells you apart — a surname, an initial, whatever the group already calls you.</p>
        <form data-act="join-distinct">
          <label class="field"><span>Your name</span>
            <input name="name" value="${esc(name)} " placeholder="${esc(name)} B" required maxlength="40" autofocus></label>
          <button class="btn btn--primary btn--wide" type="submit">Join the trip</button>
          <button class="btn btn--wide" type="button" data-act="join-back">Back</button>
        </form>
      </div>`
  }
  return `
    <div class="landing__card">
      <h2>There's already a ${esc(name)} here</h2>
      <p>If that's you coming back on another phone, pick up where you left off. If you're a different ${esc(name)}, you need your own place on the list — otherwise you'd share their claims and their personal kit.</p>
      <button class="btn btn--primary btn--wide" data-act="join-rejoin">That's me, I'm rejoining</button>
      <button class="btn btn--wide" data-act="join-new">I'm a different ${esc(name)}</button>
    </div>`
}

function viewJoin() {
  return `
  <div class="landing">
    <header class="landing__hero">
      <div class="landing__inner">
        <span class="eyebrow">You've been invited</span>
        <h1>${esc(S.trip.name)}</h1>
        <p>${esc([shortWhere(S.trip), fmtDates(S.trip)].filter(Boolean).join(' · ') || 'Add yourself and start claiming things.')}</p>
      </div>
    </header>
    <main class="landing__body">
      ${S.joinClash ? joinClashCard() : `
      <div class="landing__card">
        <h2>Who are you?</h2>
        <p>Your name shows up next to everything you're bringing, so the others know it's handled.</p>
        <form data-act="join">
          <label class="field"><span>Name</span>
            <input name="name" placeholder="Sam" autocomplete="given-name" required maxlength="40" autofocus></label>
          <button class="btn btn--primary btn--wide" type="submit">Join the trip</button>
        </form>
      </div>`}
    </main>
  </div>`
}

// One height, always: which trip you are on, and the two facts that identify
// it. Nothing here is a control any more — the way to the trip page is the Camp
// tab — so the header is purely a sign saying where you are standing.
function topbar() {
  const tab = currentTab()
  const when = shortDates(S.trip)
  // Where, in the shortest form that is still an answer — "Wasdale Head", not
  // the postcode and the country. It is the other half of what you tell someone
  // about a trip, and it was the one thing you had to open the trip page to see.
  const where = shortWhere(S.trip)
  // Two rows now, on every list: the trip and one bar. Narrowing the list is a
  // page control rather than a fixture, so the room it used to take is the
  // room the items get. The trip page brings its own summary, so it gets none.
  const under = S.camp ? ''
    : coverageBar(S.tab === 'mine' ? mineParts() : barParts(tab, activeSection()))

  // Where and when go on their own line under the name rather than fighting it
  // for one. They are a pair — the two answers to "which trip is this" — and on
  // a phone a single row made all three of them compete for the same 300px.
  const meta = [
    where ? `<span class="topbar__where"><span class="topbar__pin" aria-hidden="true">${ICONS.pin}</span>${esc(where)}</span>` : '',
    when ? `<span class="topbar__when">${esc(when)}</span>` : '',
  ].filter(Boolean).join('<span class="topbar__dot" aria-hidden="true"></span>')

  // The trip name is app furniture rather than a page heading — what the page
  // is actually about is the section you are in, which had no heading at all
  // until now. So the h1 says both, out loud, to whoever is listening.
  return `
    <header class="topbar${under ? '' : ' topbar--bare'}">
      <h1 class="sr-only">${esc(S.trip.name)} — ${esc(S.camp ? CAMP.title : tab.title)}</h1>
      <div class="topbar__trip">
        <span class="topbar__title">${esc(S.trip.name)}</span>
        ${meta ? `<span class="topbar__meta">${meta}</span>` : ''}
      </div>
      ${under}
    </header>`
}

// A group is done when each thing in it is sorted, which is a different question
// for the two halves: a group thing has somebody's name on it, your own kit is
// packed. Mixed groups count both and leave the word off.
function categoryGroups(items, mixed) {
  return groupByCategory(items).map(([cat, list]) => {
    const done = list.filter((i) => (isOwn(i) ? isMine(i) : isClaimed(i))).length
    const tally = list.every(isOwn) ? `${done}/${list.length} packed` : `${done}/${list.length}`
    return `
      <section class="group">
        <div class="group__head"><h3>${esc(cat)}</h3>
          <span class="group__tally">${list[0] && isPlan(list[0]) ? `${list.length}` : tally}</span></div>
        <ul class="items">${list.map((i) => itemRow(i, mixed)).join('')}</ul>
      </section>`
  }).join('')
}

function listPage() {
  const f = activeFilter()
  const { items: all, kinds } = pageParts()
  // What the first chip leaves, and then what the second one does to it. The
  // two are kept apart because they run out for different reasons, and only one
  // of them is worth an empty page about.
  const pool = all.filter((i) => inKind(i, f.kind))
  const items = pool.filter((i) => matchesFilter(i, f))
  const c = statsFor(all)
  const count = (key) => (key === 'own' ? [c.own - c.mine, true] : [c.open, false])

  let body
  // An empty list has nothing to sit at the foot of, so the two ways to fill it
  // move into the card and the loud one leads.
  if (!pool.length) {
    body = `
      <div class="empty">
        <h3>${f.kind === 'own' ? 'Your list is empty' : 'Nothing here yet'}</h3>
        <p>${f.kind === 'own'
           ? 'The things nobody can bring for you — a sleeping bag, a headtorch, your own boots. Only you will see what you put here.'
           : 'Pull in the usual suspects, or write your own.'}</p>
        <button class="btn btn--blaze" data-act="suggest">What am I missing?</button>
        <button class="empty__or" data-act="add">or write your own</button>
      </div>`
  } else if (!items.length) {
    body = noMatch(f)
  } else {
    body = `${categoryGroups(items, !f.kind)}
      <div class="listfoot">
        <button class="listfoot__add" data-act="add">
          <span class="listfoot__plus">${ICONS.plus}</span>Add your own
        </button>
        <button class="listfoot__ask" data-act="suggest">${ICONS.spark}What am I missing?</button>
      </div>`
  }

  // No standing paragraph over the list: it cost the same few lines on every
  // tab, every visit, to say something you read once. The chips say what the
  // list is now, and the sheets say what each half means as you use them.
  return `
    <main class="page">
      ${filterBar(all, kinds, count)}
      ${body}
    </main>`
}

// Flattening four lists into one loses the heading each thing was sitting
// under, and "Roll mat" on its own is a worse row than "Roll mat / Sleep". So
// the row carries its own category, and says when it is nobody's business but
// yours — because that changes what the tick beside it means.
function mineRow(item) {
  const own = isOwn(item)
  const others = crew(item).filter((c) => c.member_id !== S.me)
  const from = [
    catOf(item),
    own ? 'personal kit' : '',
    // Whoever else is on it, because "am I the only one bringing the bacon" is
    // the question you are actually asking on the morning you leave.
    others.length ? `with ${others.map((c) => c.member.name).join(', ')}` : '',
  ].filter(Boolean).join(' · ')

  return `
    <li class="item${packedForMe(item) ? ' item--packed' : ''}">
      ${tickBox(item)}
      <div class="item__main">
        <button class="item__open" data-act="open-item" data-id="${item.id}">
          <span class="item__title">${esc(item.title)}${item.qty ? `<span class="item__qty">${esc(item.qty)}</span>` : ''}</span>
          <span class="mine__from">${esc(from)}</span>
          ${item.note ? `<span class="item__note">${esc(item.note)}</span>` : ''}
        </button>
      </div>
    </li>`
}

// Every other tab is one list, split in two and then split again by category —
// which is four taps away from the only question you have on the morning you
// leave. This is that question, answered on one page: everything you are
// carrying, group and personal together, in the order you would pack it.
function minePage() {
  const { items: load, kinds } = pageParts()

  if (!load.length) {
    return `
      <main class="page">
        <div class="empty">
          <h3>Nothing has your name on it</h3>
          <p>Put your name to something on one of the lists, or start a personal kit — the things nobody can bring for you. Whatever you take on shows up here.</p>
          <button class="btn btn--blaze" data-act="tab" data-tab="pack">Go to the packing list</button>
        </div>
      </main>`
  }

  // The same chips as the lists, doing the job this page most needs: on the
  // morning you leave, "just the cooking stuff" is one armful of the car.
  // Everything here is already yours, so both counts are what is still in the
  // house rather than what nobody has picked up — and both wear your colour.
  const f = activeFilter()
  const shown = load.filter((it) => matchesFilter(it, f))
  const count = (key) =>
    [load.filter((it) => (key === 'own') === isOwn(it) && !packedForMe(it)).length, true]

  // Grouped by the tab each thing came from, in tab order, so the page maps
  // onto the app you already know. Inside a group, what the others are counting
  // on you for comes before what only you would miss.
  const groups = TABS.filter((t) => t.lists.length && !isPlanTab(t))
    .map((tab) => [tab, tab.lists.flatMap((l) => shown.filter((it) => it.list === l))])
    .filter(([, items]) => items.length)
    .map(([tab, items]) => {
      const rows = [...items.filter((i) => !isOwn(i)), ...items.filter(isOwn)]
      return `
        <section class="group">
          <div class="group__head"><h3>${esc(tab.label)}</h3>
            <span class="group__tally">${rows.filter(packedForMe).length}/${rows.length} packed</span></div>
          <ul class="items">${rows.map(mineRow).join('')}</ul>
        </section>`
    }).join('')

  // "That is the lot" is a claim about your whole load, so a filter that hides
  // half of it has no business making the claim.
  const done = !f.kind && !f.cat && load.every(packedForMe)

  return `
    <main class="page">
      ${filterBar(load, kinds, count)}
      ${shown.length ? groups : noMatch(f)}
      ${done ? '<p class="mine__done">That is the lot. Nothing left on your list.</p>' : ''}
    </main>`
}

// The dates are the only thing on the trip nobody has to be told twice, so the
// Camp tab leads with the one number they add up to.
function countdown(trip) {
  const day = (s) => { const d = new Date(`${s}T12:00:00`); return Number.isNaN(+d) ? null : d }
  const start = trip.start_date ? day(trip.start_date) : null
  if (!start) return null
  const end = (trip.end_date ? day(trip.end_date) : null) ?? start
  const today = new Date()
  today.setHours(12, 0, 0, 0)

  const out = Math.round((start - today) / 86400000)
  if (out > 1) return { n: out, word: 'days to go' }
  if (out === 1) return { n: 1, word: 'day to go' }
  if (today <= end) return { word: 'Happening now' }
  return { word: 'Back home' }
}

// Every other tab shows you one list. This is the only place you can see all
// four at once, which is what the tab is for.
function readyRow(tab) {
  const p = barParts(tab, 'shared')
  return `
    <button class="ready__row" data-act="tab" data-tab="${tab.id}">
      <span class="ready__name">${tab.label}</span>
      <span class="ready__track" role="img" aria-label="${tab.title}: ${p.aria}">${p.empty ? '' : p.segs}</span>
      <span class="ready__say">${p.empty ? '<span class="ready__none">nothing yet</span>' : (p.short ?? p.say)}</span>
    </button>`
}

function statusCard() {
  const c = countdown(S.trip)
  const mine = statsFor(S.items)
  return `
    <div class="card status">
      <span class="eyebrow">How it's looking</span>
      <p class="countdown">
        ${c?.n ? `<span class="countdown__n">${c.n}</span><span class="countdown__word">${c.word}</span>`
               : `<span class="countdown__word countdown__word--alone">${c ? c.word : 'No dates yet'}</span>`}
      </p>
      <div class="ready">${TABS.filter((t) => t.lists.length).map(readyRow).join('')}</div>
      ${mine.own ? `<p class="status__mine">Your own kit: <b>${mine.mine} of ${mine.own}</b> packed. Nobody else can see this.</p>` : ''}
    </div>`
}

// One tap to turn-by-turn. A pasted link wins over everything: whoever booked
// the place knows which pin is the right one, and a lot of campsites sit down a
// track that a search for the postcode drives straight past. Failing that, a
// place taken from the search has its own coordinates, which beat sending its
// words to a different company's search box and hoping.
function mapsLink(lat, lon, text) {
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`
  }
  const t = String(text ?? '').trim()
  return t ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(t)}` : ''
}

function mapsHref(trip) {
  const pasted = String(trip.map_url ?? '').trim()
  return pasted || mapsLink(trip.lat, trip.lon, trip.location)
}

// A plan can be somewhere other than the campsite, and usually the one that
// matters — nobody needs directions to the tent they are sleeping in.
const itemHref = (item) => mapsLink(item.lat, item.lon, item.place)

// Where the trip is, in one place and one field. The card owns it because this
// is what people come back for the night before they drive — the header only
// ever shows the short version of the same thing.
function whereCard() {
  const where = String(S.trip.location ?? '').trim()
  const link = mapsHref(S.trip)

  if (S.editWhere || !where) {
    return `
      <div class="card">
        <h3>Getting there</h3>
        <p>Start typing and pick the place — that way everyone gets the pin, not just the name of it. Anything you type by hand is fine too.</p>
        <form data-act="save-where">
          <label class="field places"><span>Where</span>
            <input name="location" value="${esc(where)}" maxlength="200" autofocus
                   placeholder="Wasdale Head Campsite" data-places role="combobox"
                   aria-expanded="false" aria-autocomplete="list" aria-controls="cs-places"
                   autocomplete="off" spellcheck="false">
            <input type="hidden" name="lat" data-places-lat value="${esc(S.trip.lat ?? '')}">
            <input type="hidden" name="lon" data-places-lon value="${esc(S.trip.lon ?? '')}"></label>
          <label class="field"><span>Map link <span style="font-weight:400">(optional)</span></span>
            <input name="map_url" value="${esc(S.trip.map_url ?? '')}" maxlength="500" inputmode="url"
                   autocomplete="off" spellcheck="false" placeholder="Paste a Google or Apple Maps link"></label>
          <button class="btn btn--primary" type="submit">Save</button>
        </form>
      </div>`
  }

  return `
    <div class="card">
      <div class="card__head">
        <h3>Getting there</h3>
        <button class="btn btn--sm" data-act="edit-where">Edit</button>
      </div>
      <p class="card__body notes">${esc(where)}</p>
      <div class="where__go">
        ${link ? `<a class="btn btn--primary" href="${esc(link)}" target="_blank" rel="noopener noreferrer">${ICONS.pin} Open in maps</a>` : ''}
        <button class="btn" data-act="copy-where">Copy address</button>
      </div>
    </div>`
}

// Written once, read all weekend — so it reads as text, and only turns into a
// textarea when somebody actually wants to change it.
function notesCard() {
  const text = String(S.trip.notes ?? '').trim()
  if (S.editNotes || !text) {
    return `
      <div class="card">
        <h3>Notes for everyone</h3>
        <p>The gate code, who's driving, where you're meeting.</p>
        <form data-act="save-notes">
          <label class="field"><span class="sr-only">Notes for everyone</span>
            <textarea name="notes" maxlength="4000" autofocus
              placeholder="Gate code 1470. Meet at the Co-op car park at 9. Josh has the roof box.">${esc(S.trip.notes)}</textarea></label>
          <button class="btn btn--primary" type="submit">Save notes</button>
        </form>
      </div>`
  }
  return `
    <div class="card">
      <div class="card__head">
        <h3>Notes for everyone</h3>
        <button class="btn btn--sm" data-act="edit-notes">Edit</button>
      </div>
      <p class="card__body notes">${esc(text)}</p>
    </div>`
}

function peopleCard() {
  // What somebody is bringing for the group. Personal kit is theirs, and
  // organising a hike is not a thing you carry.
  const load = new Map(), packed = new Map()
  for (const it of S.items) {
    if (isOwn(it) || isPlan(it)) continue
    for (const c of crew(it)) {
      load.set(c.member_id, (load.get(c.member_id) ?? 0) + 1)
      if (c.packed) packed.set(c.member_id, (packed.get(c.member_id) ?? 0) + 1)
    }
  }
  const link = `${location.origin}/t/${S.trip.id}`

  return `
    <div class="card">
      <h3>Who's coming</h3>
      <p>Colours match the bar on every list. The count is what they're bringing for the group — personal kit stays private to each person.</p>
      <div class="people">
        ${S.members.map((m) => {
          const n = load.get(m.id) ?? 0
          return `
            <div class="person">
              <span class="person__swatch" style="background:${colorOf(m)}"></span>
              <span class="person__name">${esc(m.name)}${m.id === S.me ? ' <span class="person__you mono">you</span>' : ''}</span>
              <span class="person__load">${n ? `${packed.get(m.id) ?? 0} of ${n} packed` : 'nothing yet'}</span>
              ${m.id === S.me ? '' : `<button class="item__kill" data-act="drop-member" data-id="${m.id}" aria-label="Remove ${esc(m.name)}">${ICONS.x}</button>`}
            </div>`
        }).join('')}
      </div>
      <div class="invite">
        <div class="code-box">
          <span class="code-box__code">${esc(link)}</span>
          <button class="btn btn--sm" data-act="share">Copy</button>
        </div>
        <p class="invite__note">Anyone with this link can add things and claim them. No sign-up.</p>
      </div>
    </div>`
}

// Both long lists on this page open a few rows at a time, so neither of them
// buries what comes after it.
function moreBtn(what, total, shown) {
  if (total <= shown) return ''
  return `<button class="btn btn--sm btn--wide more" data-act="expand" data-what="${what}">
            ${S.expand[what] ? 'Show fewer' : `Show all ${total}`}</button>`
}

function campPage() {
  const tips = S.expand.tips ? S.tips : S.tips.slice(0, 3)
  const events = S.expand.feed ? S.events : S.events.slice(0, 8)

  return `
    <main class="page">
      ${statusCard()}
      ${whereCard()}
      ${notesCard()}
      ${peopleCard()}

      <div class="card">
        <h3>Trip details</h3>
        <form data-act="save-trip">
          <label class="field"><span>Trip name</span><input name="name" value="${esc(S.trip.name)}" maxlength="80"></label>
          <div class="field field--split">
            <label class="field"><span>Arrive</span><input type="date" name="start_date" value="${esc(S.trip.start_date)}"></label>
            <label class="field"><span>Leave</span><input type="date" name="end_date" value="${esc(S.trip.end_date)}"></label>
          </div>
          <button class="btn btn--primary" type="submit">Save details</button>
        </form>
      </div>

      <div class="card">
        <h3>Camp smarts</h3>
        <p>The things people find out the hard way on their first trip.</p>
        <div class="tips">
          ${tips.map((t, i) => `
            <div class="tip">
              <span class="tip__mark">${i + 1}</span>
              <div><h4>${esc(t.title)}</h4><p>${esc(t.body)}</p></div>
            </div>`).join('')}
        </div>
        ${moreBtn('tips', S.tips.length, 3)}
      </div>

      <div class="card">
        <h3>What's been happening</h3>
        <div class="feed">
          ${events.length ? events.map((e) => `
            <div class="feed__row">
              <span class="feed__who">${esc(e.actor || 'Someone')}</span>
              <span class="feed__what">${esc(e.text)}</span>
              <span class="feed__when" title="${esc(new Date(e.created_at).toLocaleString())}">${ago(e.created_at)}</span>
            </div>`).join('') : '<p class="card__body">Nothing yet.</p>'}
        </div>
        ${moreBtn('feed', S.events.length, 8)}
      </div>
    </main>`
}

// What the badge on a tab counts. For a list it is the group's open question —
// nobody is bringing this. Your own tab is the one place the other question
// belongs: how much of your load is still sitting in the house.
function tabFlag(tab) {
  if (tab.id === 'mine') return myLoad().filter((it) => !packedForMe(it)).length
  return tab.lists.length ? statsFor(itemsOn(tab)).open : 0
}

function tabbar() {
  return `
    <nav class="tabbar" aria-label="Sections">
      ${TABS.map((t) => {
        const here = !S.camp && S.tab === t.id
        // No badge on the tab you are standing on — the page behind it is
        // already the answer, and a count you are looking through is noise.
        const n = here ? 0 : tabFlag(t)
        // Blaze means one thing on every screen in this app: nobody has picked
        // this up. Your own kit is picked up — by you — so its count wears your
        // colour instead, and the orange keeps saying only the one thing.
        const flag = n ? `<span class="tabbar__flag"${t.id === 'mine'
          ? ` style="background:${colorOf(meMember())}"` : ''}>${n > 9 ? '9+' : n}</span>` : ''
        return `<button class="tabbar__btn" data-act="tab" data-tab="${t.id}"
                  ${here ? 'aria-current="page"' : ''}>
                  <span class="tabbar__icon">${ICONS[t.id]}${flag}</span>
                  <span>${t.label}</span>
                </button>`
      }).join('')}
      <button class="tabbar__btn" data-act="camp" ${S.camp ? 'aria-current="page"' : ''}>
        <span class="tabbar__icon">${ICONS.camp}</span>
        <span>${CAMP.label}</span>
      </button>
    </nav>`
}

function viewTrip() {
  const tab = currentTab()
  const page = S.camp ? campPage() : tab.id === 'mine' ? minePage() : listPage()
  return `<div class="app">${topbar()}${page}</div>${tabbar()}`
}

// ---- sheets -----------------------------------------------------------------

function sheetShell({ title, blurb, body, foot }) {
  return `
    <div class="sheet-scrim" data-act="scrim">
      <div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <div class="sheet__head">
          <div><h3>${esc(title)}</h3>${blurb ? `<p>${esc(blurb)}</p>` : ''}</div>
          <button class="sheet__close" data-act="close-sheet" aria-label="Close">${ICONS.x}</button>
        </div>
        <div class="sheet__body">${body}</div>
        ${foot ? `<div class="sheet__foot">${foot}</div>` : ''}
      </div>
    </div>`
}

// Everything an item can be asked, in the one place the row sends you: who has
// it, which list it belongs on, and the way to take it off. The names are a
// multiple choice — the sheet stays open while you tick two more people onto the
// bacon, because that is the whole point of it being a set.
function sheetItem(s) {
  const item = S.items.find((i) => i.id === s.id)
  if (!item) return ''
  const me = meMember()
  const own = isOwn(item)
  const plan = isPlan(item)

  const kindSwitch = plan ? '' : `
    <div class="segmented" role="group" aria-label="How this gets brought">
      <button class="segmented__btn" aria-pressed="${!own}" data-act="set-kind" data-id="${item.id}" data-kind="shared">
        ${SECTIONS.shared.label}</button>
      <button class="segmented__btn" aria-pressed="${own}" data-act="set-kind" data-id="${item.id}" data-kind="own">
        ${SECTIONS.own.label}</button>
    </div>`

  const remove = `<button class="btn btn--wide btn--quiet" data-act="kill" data-id="${item.id}">Remove from the list</button>`

  if (own) {
    return sheetShell({
      title: item.title,
      blurb: 'This is on your own list. Nobody else on the trip can see it.',
      body: `${kindSwitch}
        <button class="pick" data-act="own" data-id="${item.id}" aria-pressed="${isMine(item)}">
          <span class="pick__swatch" style="background:${colorOf(me)}"></span>
          <span class="pick__main"><span class="pick__title">Mine is packed</span>
            <span class="pick__note">${isMine(item) ? 'Ticked off.' : 'Not yet.'}</span></span>
          <span class="pick__tick">${ICONS.tickGreen}</span>
        </button>`,
      foot: remove,
    })
  }

  const on = new Map(claimsOn(item).map((c) => [c.member_id, c]))
  const rows = S.members.map((m) => {
    const claim = on.get(m.id)
    return `
      <button class="pick" data-act="claim" data-id="${item.id}" data-member="${m.id}"
              aria-pressed="${!!claim}">
        <span class="pick__swatch" style="background:${colorOf(m)}"></span>
        <span class="pick__main"><span class="pick__title">${esc(m.name)}${m.id === S.me ? ' (you)' : ''}</span>
          ${claim ? `<span class="pick__note">${claim.packed ? 'Packed theirs.' : 'Not packed yet.'}</span>` : ''}</span>
        <span class="pick__tick">${ICONS.tickGreen}</span>
      </button>`
  }).join('')

  const mine = !!myClaim(item)
  return sheetShell({
    title: plan ? `Who's organising ${item.title}?` : `Who's bringing ${item.title}?`,
    blurb: plan
      ? 'Optional, and it can be more than one of you — only for the plans that need booking or kit.'
      : 'As many of you as it takes. Each person ticks off their own share.',
    body: `
      ${kindSwitch}
      ${me && !mine ? `<button class="btn btn--primary btn--wide" style="margin-bottom:14px" data-act="claim" data-id="${item.id}" data-member="${me.id}">${plan ? "I'll organise it" : "I'll bring it"}</button>` : ''}
      ${rows}
      <div style="margin-top:18px">
        <form data-act="add-member">
          <label class="field"><span>Someone not on the list?</span>
            <input name="name" placeholder="Add a person" maxlength="40"></label>
          <button class="btn btn--wide btn--sm" type="submit">Add them</button>
        </form>
      </div>`,
    foot: remove,
  })
}

// Where a plan happens, on its own because it is the answer to a different
// question from who is organising it — and the one people ask on the day.
function sheetPlace(s) {
  const item = S.items.find((i) => i.id === s.id)
  if (!item) return ''
  const place = String(item.place ?? '').trim()
  const link = itemHref(item)
  return sheetShell({
    title: `Where is ${item.title}?`,
    blurb: 'Search for it and everyone gets the pin, not just the name of it. Leave it empty if it is wherever you happen to be.',
    body: `
      <form data-act="save-place" data-id="${item.id}">
        <label class="field places"><span>Where</span>
          <input name="place" value="${esc(place)}" maxlength="200" autofocus
                 placeholder="Wast Water shoreline" data-places role="combobox"
                 aria-expanded="false" aria-autocomplete="list" aria-controls="cs-places"
                 autocomplete="off" spellcheck="false">
          <input type="hidden" name="lat" data-places-lat value="${esc(item.lat ?? '')}">
          <input type="hidden" name="lon" data-places-lon value="${esc(item.lon ?? '')}"></label>
        <button class="btn btn--primary btn--wide" type="submit">Save</button>
      </form>
      ${link ? `
        <a class="btn btn--wide" style="margin-top:10px" href="${esc(link)}"
           target="_blank" rel="noopener noreferrer">${ICONS.pin} Open in maps</a>` : ''}`,
  })
}

function sheetAdd(s) {
  const tab = tabById(s.tab)
  const cats = [...new Set([
    ...itemsOn(tab).map((i) => i.category),
    ...tab.lists.flatMap((l) => (S.catalog?.[l] ?? []).map((c) => c.cat)),
  ])].filter(Boolean)

  // A tab that holds one list never asks which one. Eat holds two, and a bottle
  // of wine filed under dinner would be lost to whoever goes looking for it.
  const listPick = tab.lists.length < 2 ? `<input type="hidden" name="list" value="${esc(s.list)}">` : `
    <div class="field">
      <span>Food or drink?</span>
      <div class="segmented" role="group" aria-label="Food or drink">
        ${tab.lists.map((l) => `
          <button type="button" class="segmented__btn" aria-pressed="${l === s.list}"
                  data-act="pick" data-name="list" data-value="${l}">${LIST_WORD[l]}</button>`).join('')}
      </div>
      <input type="hidden" name="list" value="${esc(s.list)}">
    </div>`

  return sheetShell({
    title: `Add to ${tab.title.toLowerCase()}`,
    body: `
      <form data-act="add-item">
        <label class="field"><span>What is it?</span>
          <input name="title" required maxlength="120" autofocus placeholder="${s.list === 'food' ? 'Sausages' : s.list === 'activities' ? 'Sunrise walk to the ridge' : 'Bottle opener'}"></label>
        ${listPick}
        <div class="field--split" style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <label class="field"><span>Group</span>
            <input name="category" list="cs-cats" maxlength="60" placeholder="${esc(cats[0] ?? 'Other')}"></label>
          <label class="field"><span>How much <span style="font-weight:400">(optional)</span></span>
            <input name="qty" maxlength="40" placeholder="x2"></label>
        </div>
        <datalist id="cs-cats">${cats.map((c) => `<option value="${esc(c)}">`).join('')}</datalist>
        <label class="field"><span>Note <span style="font-weight:400">(optional)</span></span>
          <input name="note" maxlength="500" placeholder="Anything the others need to know"></label>
        ${!isPlanTab(tab) ? '' : `
          <label class="field places"><span>Where <span style="font-weight:400">(optional)</span></span>
            <input name="place" maxlength="200" placeholder="Wast Water shoreline"
                   data-places role="combobox" aria-expanded="false" aria-autocomplete="list"
                   aria-controls="cs-places" autocomplete="off" spellcheck="false">
            <input type="hidden" name="lat" data-places-lat>
            <input type="hidden" name="lon" data-places-lon></label>`}
        ${isPlanTab(tab) ? '' : `
          <div class="field">
            <span>Who brings it?</span>
            <div class="segmented" role="group" aria-label="Who brings it">
              <button type="button" class="segmented__btn" aria-pressed="${s.section !== 'own'}" data-act="pick" data-name="kind" data-value="shared">
                ${SECTIONS.shared.label}</button>
              <button type="button" class="segmented__btn" aria-pressed="${s.section === 'own'}" data-act="pick" data-name="kind" data-value="own">
                ${SECTIONS.own.label}</button>
            </div>
            <input type="hidden" name="kind" value="${s.section === 'own' ? 'own' : 'shared'}">
          </div>`}
        <button class="btn btn--primary btn--wide" type="submit">Add it</button>
      </form>`,
  })
}

function sheetSuggest(s) {
  const tab = tabById(s.tab)
  const pool = s.pool
  const picked = s.picked ?? new Set()

  if (!pool.length) {
    return sheetShell({
      title: 'Nothing left to suggest',
      body: `<div class="empty"><h3>You've got the lot</h3><p>Every suggestion we have for ${s.section === 'own' ? 'personal kit' : esc(tab.title.toLowerCase())} is already on your list. Add your own from here on.</p></div>`,
    })
  }

  const groups = new Map()
  for (const c of pool) {
    if (!groups.has(c.cat)) groups.set(c.cat, [])
    groups.get(c.cat).push(c)
  }

  const body = [...groups.entries()].map(([cat, list]) => `
    <div class="sheet__group">
      <span class="eyebrow">${esc(cat)}</span>
      ${list.map((c) => `
        <button class="pick" data-act="toggle-pick" data-pick="${esc(c.key)}" aria-pressed="${picked.has(c.key)}">
          <span class="pick__main">
            <span class="pick__title">${esc(c.title)}</span>
            ${c.note ? `<span class="pick__note">${esc(c.note)}</span>` : ''}
          </span>
          <span class="pick__tick">${ICONS.tickGreen}</span>
        </button>`).join('')}
    </div>`).join('')

  return sheetShell({
    title: 'What am I missing?',
    blurb: `${pool.length} ${s.section === 'own' ? 'things people bring for themselves' : 'things people usually bring'} that aren't on your list yet. Tap the ones you want.`,
    body,
    foot: `<button class="btn btn--primary btn--wide" data-act="add-picked" ${picked.size ? '' : 'disabled'}>
             ${picked.size ? `Add ${picked.size} ${picked.size === 1 ? 'thing' : 'things'}` : 'Pick some things'}</button>`,
  })
}

function renderSheet() {
  if (!S.sheet) { sheetRoot.innerHTML = ''; return }
  const map = { item: sheetItem, add: sheetAdd, suggest: sheetSuggest, place: sheetPlace }
  sheetRoot.innerHTML = map[S.sheet.kind]?.(S.sheet) ?? ''
}

// ---- render -----------------------------------------------------------------

function render() {
  const y = window.scrollY
  const views = { landing: viewLanding, join: viewJoin, trip: viewTrip }
  root.innerHTML = views[S.view]?.() ?? '<div class="page"><p>Loading…</p></div>'
  // The install card floats over the bottom of the screen, which on the trip
  // page already has a tab bar standing on it.
  document.body.classList.toggle('has-tabbar', S.view === 'trip')
  renderSheet()
  if (S.view === 'trip') window.scrollTo(0, y)
}

// ---- actions ----------------------------------------------------------------

const meKey = (tripId) => `cs.me.${tripId}`
const TRIPS_KEY = 'cs.trips'

// There are no accounts, so "your trips" is whatever this device remembers.
// Most-recent first, with the per-trip member keys as a fallback so trips joined
// before this list existed still show up.
function localTrips() {
  let ids = []
  try { ids = JSON.parse(localStorage.getItem(TRIPS_KEY) ?? '[]') } catch { /* rewritten below */ }
  if (!Array.isArray(ids)) ids = []
  ids = ids.filter((id) => typeof id === 'string' && id)
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k?.startsWith('cs.me.')) {
      const id = k.slice(6)
      if (id && !ids.includes(id)) ids.push(id)
    }
  }
  return ids
}

const saveTrips = (ids) => localStorage.setItem(TRIPS_KEY, JSON.stringify(ids.slice(0, 40)))
const rememberTrip = (id) => saveTrips([id, ...localTrips().filter((t) => t !== id)])

function forgetTrip(id) {
  saveTrips(localTrips().filter((t) => t !== id))
  localStorage.removeItem(meKey(id))
  if (S.trips) S.trips = S.trips.filter((t) => t.id !== id)
}

// The summary is a POST, which the worker cannot cache — and an installed app
// that answers "you have no trips" because it has no signal is worse than one
// that shows last night's numbers. So the answer is kept here instead.
const SUMMARY_KEY = 'cs.trips.last'

function lastSummary(ids) {
  try {
    const trips = JSON.parse(localStorage.getItem(SUMMARY_KEY) ?? '[]')
    return Array.isArray(trips) ? trips.filter((t) => ids.includes(t?.id)) : []
  } catch { return [] }
}

async function loadTrips() {
  const ids = localTrips()
  if (!ids.length) { S.trips = []; return }
  try {
    const { trips, missing } = await api('/trips/summary', {
      method: 'POST',
      body: { trips: ids.map((id) => ({ id, memberId: localStorage.getItem(meKey(id)) })) },
    })
    // A trip that has gone stops haunting the home page.
    for (const id of missing ?? []) forgetTrip(id)
    S.trips = trips
    localStorage.setItem(SUMMARY_KEY, JSON.stringify(trips))
  } catch {
    S.trips = S.trips ?? lastSummary(ids)
  }
}

function focusJoin() {
  if (!S.joinError) return
  const box = root.querySelector('#cs-code')
  if (box) { box.focus(); box.setSelectionRange(box.value.length, box.value.length) }
}

// The home page paints straight away and fills its trip list in behind, so a
// slow network never leaves you looking at nothing.
async function showLanding(error = '') {
  S.view = 'landing'
  S.joinError = error
  render()
  focusJoin()
  await loadTrips()
  if (S.view !== 'landing') return
  render()
  focusJoin()
}

// People paste the whole link as often as they type the code, and phone
// keyboards throw in capitals and spaces of their own accord.
function tripCodeFrom(raw) {
  const s = String(raw ?? '').trim()
  const m = s.match(/\/t\/([^/?#\s]+)/i)
  return decodeURIComponent(m ? m[1] : s).trim().toLowerCase().replace(/\s+/g, '-')
}

async function goToTrip(code) {
  history.pushState({}, '', `/t/${encodeURIComponent(code)}`)
  await openTrip(code)
}

// Joining is the one place a name is load-bearing, so it lives in one function:
// the first ask, the "is that you?" answer, and the disambiguated retry all end
// up here, and only a member id we asked for by name is ever written to storage.
async function joinAs(rawName, claim = '') {
  const name = String(rawName ?? '').trim()
  if (!name) return
  try {
    const { member } = await api(`/trips/${S.trip.id}/members`, {
      method: 'POST',
      body: { name, ...(claim ? { claim } : {}) },
    })
    localStorage.setItem(meKey(S.trip.id), member.id)
    rememberTrip(S.trip.id)
    S.me = member.id
    S.joinClash = null
    S.view = 'trip'
    absorb(await api(`/trips/${S.trip.id}`))
  } catch (err) {
    if (err.payload?.conflict === 'name') {
      S.joinClash = { name: err.payload.name, asking: 'who' }
      render()
      return
    }
    toast(err.message)
  }
}

async function openTrip(code) {
  try {
    // Who we are has to be settled before we ask, because api() puts S.me in
    // the header and the server only returns the personal-kit ticks belonging
    // to whoever asked. Asking as the member we were on the last trip comes
    // back with this trip's ticks stripped out, so your own kit reads unpacked.
    S.me = localStorage.getItem(meKey(code))
    const state = await api(`/trips/${encodeURIComponent(code)}`)
    if (S.me && !state.members.some((m) => m.id === S.me)) S.me = null
    if (S.me) rememberTrip(code)
    S.joinCode = ''
    S.joinError = ''
    S.joinClash = null
    S.view = S.me ? 'trip' : 'join'
    absorb(state)
  } catch (err) {
    S.me = null
    history.replaceState({}, '', '/')
    await showLanding(err.message)
  }
}

document.addEventListener('click', async (ev) => {
  const el = ev.target.closest('[data-act]')
  if (!el) return
  const act = el.dataset.act
  // Trip cards are real links, so a modifier-click still opens a new tab.
  if (el.tagName === 'A' && (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey)) return
  if (el.tagName === 'A') ev.preventDefault()
  if (el.tagName === 'BUTTON' && el.type !== 'submit') ev.preventDefault()

  switch (act) {
    case 'open-trip':
      await goToTrip(el.dataset.id)
      window.scrollTo(0, 0)
      break

    case 'forget-trip': {
      const t = (S.trips ?? []).find((x) => x.id === el.dataset.id)
      if (t && confirm(`Take "${t.name}" off this device? The trip itself stays put, and the link still works.`)) {
        forgetTrip(t.id)
        render()
        toast('Removed from this device.')
      }
      break
    }

    case 'join-rejoin':
      await joinAs(S.joinClash.name, 'rejoin')
      break

    case 'join-new':
      S.joinClash = { ...S.joinClash, asking: 'name' }
      render()
      break

    case 'join-back':
      S.joinClash = null
      render()
      break

    case 'show-create':
      S.showCreate = true
      render()
      root.querySelector('form[data-act="create"] input')?.focus()
      break

    case 'tab':
      S.tab = el.dataset.tab
      S.camp = false
      // A filter belongs to the list you set it on. Carrying "Shelter" onto the
      // food would be a list with most of the food missing and no reason on
      // screen for it.
      S.filter = { kind: '', cat: '' }
      render()
      window.scrollTo(0, 0)
      break

    // A destination in the bar rather than an overlay, so it goes one way: you
    // leave it by picking a list, the same as every other tab. Toggling would
    // have been the one button in the bar that put you somewhere you did not
    // press for.
    case 'camp':
      S.camp = true
      render()
      window.scrollTo(0, 0)
      break

    // Every chip is a toggle, so the way out of a filter is the chip that put
    // you in it.
    case 'filter-kind': {
      const kind = S.filter.kind === el.dataset.value ? '' : el.dataset.value
      // The categories are a property of what is left after this chip, so one
      // that no longer applies lets go rather than emptying the page.
      const cats = new Set(pageParts().items.filter((i) => inKind(i, kind)).map(catOf))
      S.filter = { kind, cat: cats.has(S.filter.cat) ? S.filter.cat : '' }
      render()
      window.scrollTo(0, 0)
      break
    }

    case 'filter-cat':
      S.filter = { ...S.filter, cat: S.filter.cat === el.dataset.value ? '' : el.dataset.value }
      render()
      window.scrollTo(0, 0)
      break

    case 'expand':
      S.expand[el.dataset.what] = !S.expand[el.dataset.what]
      render()
      break

    case 'place':
      S.sheet = { kind: 'place', id: el.dataset.id }
      renderSheet()
      break

    case 'edit-notes':
      S.editNotes = true
      render()
      break

    case 'edit-where':
      S.editWhere = true
      render()
      break

    case 'copy-where': {
      const where = String(S.trip.location ?? '').trim()
      try { await navigator.clipboard.writeText(where); toast('Address copied.') }
      catch { prompt('Copy the address:', where) }
      break
    }

    // prompt() only counts inside a gesture, and nothing above this point in the
    // handler has awaited, so this is still one.
    case 'install-yes':
      hideInstall()
      await runInstallPrompt()
      break

    case 'install-no':
      if (!wasAskedFor) turnedDown()
      hideInstall()
      break

    // Asked for rather than offered, so there is no card to read first — where
    // there is a real prompt to raise, raise it.
    case 'install-tip':
      clearTimeout(installTimer)
      if (deferred) await runInstallPrompt()
      else showInstall(true)
      break

    case 'scrim':
      if (ev.target !== el) break
      S.sheet = null; renderSheet(); break

    case 'close-sheet':
      S.sheet = null; renderSheet(); break

    // The one control on the row, and it steps: put your name to it, tick your
    // share off, untick it. Dropping out again is a decision rather than a
    // mis-tap, so it lives in the sheet behind the faces.
    case 'tick': {
      if (!S.me) { toast('Join the trip first.'); break }
      const it = S.items.find((i) => i.id === el.dataset.id)
      if (!it) break
      if (isOwn(it)) {
        mutate(() => api(`/items/${it.id}/own`, { method: 'POST', body: { memberId: S.me } }))
        break
      }
      const claim = myClaim(it)
      if (!claim) {
        await mutate(() => api(`/items/${it.id}/claim`, { method: 'POST', body: { memberId: S.me } }))
      } else {
        await mutate(() => api(`/items/${it.id}/packed`, {
          method: 'POST', body: { memberId: S.me, packed: !claim.packed },
        }))
      }
      break
    }

    case 'own':
      if (!S.me) { toast('Join the trip first.'); break }
      mutate(() => api(`/items/${el.dataset.id}/own`, { method: 'POST', body: { memberId: S.me } }))
      break

    case 'set-kind':
      // The sheet stays open, so you see the model you just chose.
      await mutate(() => api(`/items/${el.dataset.id}`, { method: 'PATCH', body: { kind: el.dataset.kind } }))
      toast(el.dataset.kind === 'own'
        ? 'On your own list now. Only you can see it.'
        : 'On the group list now — everyone can see it.')
      break

    // A segmented control inside a form is a hidden field with buttons on it.
    // Poked in place rather than re-rendered, because a re-render would take
    // whatever you had already typed into the boxes above it.
    case 'pick': {
      const box = el.closest('.segmented')
      for (const b of box.querySelectorAll('.segmented__btn')) b.setAttribute('aria-pressed', b === el)
      box.parentElement.querySelector(`input[name="${el.dataset.name}"]`).value = el.dataset.value
      break
    }

    case 'vote':
      if (!S.me) { toast('Join the trip first.'); break }
      mutate(() => api(`/items/${el.dataset.id}/vote`, { method: 'POST', body: { memberId: S.me } }))
      break

    case 'kill': {
      const it = S.items.find((i) => i.id === el.dataset.id)
      if (it && confirm(`Remove "${it.title}" from the list?`)) {
        S.sheet = null
        renderSheet()
        mutate(() => api(`/items/${it.id}`, { method: 'DELETE' }))
      }
      break
    }

    case 'drop-member': {
      const m = memberById(el.dataset.id)
      if (m && confirm(`Remove ${m.name}? Anything they were bringing goes back to nobody.`)) {
        mutate(() => api(`/trips/${S.trip.id}/members/${m.id}`, { method: 'DELETE' }))
      }
      break
    }

    case 'open-item':
      S.sheet = { kind: 'item', id: el.dataset.id }
      renderSheet()
      break

    // Names go on and come off one tap at a time, and the sheet stays put: you
    // are usually adding a second person, not replacing the first.
    case 'claim':
      await mutate(() => api(`/items/${el.dataset.id}/claim`, {
        method: 'POST', body: { memberId: el.dataset.member },
      }))
      break

    // Both open into whichever section you are looking at.
    case 'add':
      S.sheet = { kind: 'add', tab: S.tab, list: currentTab().lists[0], section: activeSection() }
      renderSheet()
      break

    // The pool is worked out once, when the sheet opens, and kept: a list that
    // reshuffles under a finger mid-tap is how you add the wrong thing. Each
    // entry carries the list it came from, because Eat holds two of them.
    case 'suggest': {
      const tab = currentTab()
      const section = activeSection()
      const have = new Set(itemsOn(tab).map((i) => i.title.toLowerCase()))
      const pool = tab.lists.flatMap((l) => (S.catalog?.[l] ?? [])
        .filter((c) => !have.has(c.title.toLowerCase()) && !!c.own === (section === 'own'))
        .map((c) => ({ ...c, list: l, key: `${l}::${c.title}` })))
      S.sheet = { kind: 'suggest', tab: tab.id, section, pool, picked: new Set() }
      renderSheet()
      break
    }

    case 'toggle-pick': {
      const t = el.dataset.pick
      S.sheet.picked.has(t) ? S.sheet.picked.delete(t) : S.sheet.picked.add(t)
      el.setAttribute('aria-pressed', S.sheet.picked.has(t))
      const foot = sheetRoot.querySelector('[data-act="add-picked"]')
      const n = S.sheet.picked.size
      foot.disabled = !n
      foot.textContent = n ? `Add ${n} ${n === 1 ? 'thing' : 'things'}` : 'Pick some things'
      break
    }

    case 'add-picked': {
      const { pool, picked } = S.sheet
      const wanted = pool.filter((c) => picked.has(c.key))
      S.sheet = null
      renderSheet()
      await mutate(() => api(`/trips/${S.trip.id}/items`, {
        method: 'POST',
        body: { items: wanted.map((c) => ({ list: c.list, category: c.cat, title: c.title, note: c.note ?? '', kind: c.own ? 'own' : 'shared' })) },
      }))
      toast(`Added ${wanted.length} ${wanted.length === 1 ? 'thing' : 'things'}.`)
      break
    }

    case 'share': {
      const url = `${location.origin}/t/${S.trip.id}`
      const text = `Join our camping trip "${S.trip.name}" and put your name down for what you're bringing.`
      if (navigator.share) {
        try { await navigator.share({ title: S.trip.name, text, url }) } catch { /* dismissed */ }
      } else {
        try { await navigator.clipboard.writeText(url); toast('Link copied. Send it to your friends.') }
        catch { prompt('Copy this link:', url) }
      }
      break
    }
  }
})

document.addEventListener('submit', async (ev) => {
  const form = ev.target.closest('[data-act]')
  if (!form) return
  ev.preventDefault()
  const f = Object.fromEntries(new FormData(form))

  switch (form.dataset.act) {
    case 'join-code': {
      const code = tripCodeFrom(f.code)
      S.joinCode = String(f.code ?? '')
      if (!code) { S.joinError = 'Paste the link, or type the code from the end of it.'; render(); focusJoin(); break }
      S.joinError = ''
      await goToTrip(code)
      break
    }

    case 'create': {
      try {
        const { trip, memberId } = await api('/trips', { method: 'POST', body: f })
        if (memberId) localStorage.setItem(meKey(trip.id), memberId)
        rememberTrip(trip.id)
        S.me = memberId
        S.view = 'trip'
        S.tab = 'pack'
        history.pushState({}, '', `/t/${trip.id}`)
        absorb(await api(`/trips/${trip.id}`))
        toast('Trip created. Send the link to your friends.')
      } catch (err) { toast(err.message) }
      break
    }

    case 'join':
      await joinAs(f.name)
      break

    case 'join-distinct':
      await joinAs(f.name, 'new')
      break

    case 'add-member': {
      if (!String(f.name).trim()) break
      const itemId = S.sheet?.id
      try {
        await api(`/trips/${S.trip.id}/members`, { method: 'POST', body: { name: f.name } })
        absorb(await api(`/trips/${S.trip.id}`))
        S.sheet = { kind: 'item', id: itemId }
        renderSheet()
      } catch (err) {
        // Adding somebody who is already here is a mistake worth naming, not a
        // second one of them — they are already in the list to pick from.
        toast(err.payload?.conflict === 'name'
          ? `${err.payload.name} is already on the trip.`
          : err.message)
      }
      break
    }

    case 'add-item': {
      S.sheet = null
      renderSheet()
      await mutate(() => api(`/trips/${S.trip.id}/items`, {
        method: 'POST',
        body: {
          list: f.list, title: f.title, category: f.category || 'Other', qty: f.qty, note: f.note, kind: f.kind,
          place: f.place, lat: f.lat, lon: f.lon,
        },
      }))
      break
    }

    case 'save-trip':
      await mutate(() => api(`/trips/${S.trip.id}`, { method: 'PATCH', body: f }))
      toast('Saved.')
      break

    case 'save-where': {
      S.editWhere = false
      await mutate(() => api(`/trips/${S.trip.id}`, {
        method: 'PATCH',
        body: { location: f.location, lat: f.lat, lon: f.lon, map_url: f.map_url },
      }))
      // The server keeps only ordinary web links, so a mistyped one comes back
      // empty. Better to say so than to leave a button that goes nowhere.
      const sent = String(f.map_url ?? '').trim()
      toast(sent && !String(S.trip.map_url ?? '').trim()
        ? "Saved — that map link didn't look like a link, so it wasn't kept."
        : 'Saved. Everyone can find it now.')
      break
    }

    case 'save-place': {
      const id = form.dataset.id
      S.sheet = null
      renderSheet()
      await mutate(() => api(`/items/${id}`, {
        method: 'PATCH',
        body: { place: f.place, lat: f.lat, lon: f.lon },
      }))
      toast(String(f.place ?? '').trim() ? 'Saved. Everyone can find it now.' : 'Place removed.')
      break
    }

    case 'save-notes':
      S.editNotes = false
      await mutate(() => api(`/trips/${S.trip.id}`, { method: 'PATCH', body: { notes: f.notes } }))
      toast('Everyone can see that now.')
      break
  }
})

document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && S.sheet) { S.sheet = null; renderSheet() }
})

// ---- place search -----------------------------------------------------------

// The "Where" box searches for real places. Picking one writes the whole place
// into the box and keeps its coordinates in a hidden pair beside it, so the map
// link works from the moment the trip exists and nobody types an address twice.
//
// This deliberately sits outside render(): a whole-page re-render mid-keystroke
// would take the box you are typing in with it. The menu is built straight into
// the DOM instead, which also means the next render() cleans it up for free.

const PLACES_MIN = 2
const PLACES_WAIT = 280
const PLACES_KEEP = 60
// Breathing room between the list and whatever edge it stops at.
const PLACES_EDGE = 8
// The gap between the list and the box it belongs to.
const PLACES_GAP = 5
// Below the box is where a list is expected, so it stays there while about four
// places fit. Less than that and it goes wherever the room actually is.
const PLACES_ROOM = 240
const PLACES_TALL = 340

// Only ever one open menu, so one object holds all of it. `complete` is whether
// the last keystroke is one worth typing ahead of — letters yes, deletions no.
// Finishing somebody's word while they are trying to erase it is exactly how an
// autocomplete makes itself hated. `typed` is what they actually put in, kept so
// Escape can hand it back.
const P = { input: null, list: [], active: -1, seq: 0, timer: 0, ctrl: null, complete: false, typed: null }

// Queries this tab has already asked about. Typing ahead only helps if it lands
// under the cursor now rather than in 300ms, and the letters of a word you have
// typed before can be answered from here without going anywhere.
const placeMemo = new Map()

function memoPlaces(q, places) {
  placeMemo.set(q.toLowerCase(), places)
  if (placeMemo.size > PLACES_KEEP) placeMemo.delete(placeMemo.keys().next().value)
}

const placesField = (input) => input?.closest('.places') ?? null

// The pin rides along with the box in two hidden fields, so it is saved by the
// same submit as the words and can never end up describing a different place.
function setPin(input, lat, lon) {
  const field = placesField(input)
  const has = lat != null && lon != null
  const put = (sel, v) => { const el = field?.querySelector(sel); if (el) el.value = has ? String(v) : '' }
  put('[data-places-lat]', lat)
  put('[data-places-lon]', lon)
}

function closePlaces() {
  placesField(P.input)?.querySelector('.places__menu')?.remove()
  P.input?.setAttribute('aria-expanded', 'false')
  P.input?.removeAttribute('aria-activedescendant')
  P.list = []
  P.active = -1
  P.typed = null
}

// The list hangs off the box, and on a phone the box can be a finger's width
// from the top of the keyboard. The room to work with is the part of the screen
// the keyboard has not taken, top to bottom — the sheet is not a wall, because
// a list drawn over the question you are answering is still a list you can read
// and tap, and one squeezed under the box is neither. So: below the box while a
// few places fit there, above it when that is where the room went, and measured
// against the visual viewport, which is the only thing that knows about keys.
function fitPlaces() {
  const field = placesField(P.input)
  const menu = field?.querySelector('.places__menu')
  if (!menu) return
  const box = field.getBoundingClientRect()
  const vv = window.visualViewport
  const seenTop = vv?.offsetTop ?? 0
  const top = seenTop + PLACES_EDGE
  const bottom = seenTop + (vv?.height ?? window.innerHeight) - PLACES_EDGE

  // A box scrolled off the top or bottom of what you can see has nothing to
  // hang a list off; the fixed menu would be left floating on its own.
  const gone = box.bottom < top || box.top > bottom
  menu.classList.toggle('places__menu--off', gone)
  if (gone) return

  const below = bottom - box.bottom - PLACES_GAP
  const above = box.top - top - PLACES_GAP
  const up = below < PLACES_ROOM && above > below

  menu.style.left = `${Math.round(box.left)}px`
  menu.style.width = `${Math.round(box.width)}px`
  menu.style.top = up ? 'auto' : `${Math.round(box.bottom + PLACES_GAP)}px`
  menu.style.bottom = up ? `${Math.round(window.innerHeight - box.top + PLACES_GAP)}px` : 'auto'
  // A floor of two rows: a list too short to show anything is no more use than
  // one nobody can reach, and it scrolls if it really comes to that.
  menu.style.maxHeight = `${Math.round(Math.max(96, Math.min(PLACES_TALL, up ? above : below)))}px`
}

function drawPlaces(empty) {
  const field = placesField(P.input)
  if (!field) return
  let menu = field.querySelector('.places__menu')
  if (!menu) {
    menu = document.createElement('div')
    menu.className = 'places__menu'
    menu.id = 'cs-places'
    menu.setAttribute('role', 'listbox')
    field.appendChild(menu)
  }
  menu.innerHTML = P.list.length
    ? P.list.map((p, i) => `
        <button type="button" class="places__opt${i === P.active ? ' is-active' : ''}"
                role="option" id="cs-place-${i}" aria-selected="${i === P.active}" data-place="${i}">
          <span class="places__name">${esc(p.label)}</span>
          ${p.detail ? `<span class="places__detail">${esc(p.detail)}</span>` : ''}
        </button>`).join('')
    : `<p class="places__msg">${esc(empty)}</p>`

  fitPlaces()
  P.input.setAttribute('aria-expanded', 'true')
  if (P.active >= 0) {
    P.input.setAttribute('aria-activedescendant', `cs-place-${P.active}`)
    menu.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' })
  } else {
    P.input.removeAttribute('aria-activedescendant')
  }
}

// The address-bar move: the rest of the best match appears in the box already
// selected, so carrying on typing overwrites it, Enter or → takes it, and
// Backspace removes exactly the part you did not type. It is only ever offered
// when the match genuinely starts with what is in the box — completing "lake"
// to "Windermere" would be a guess wearing the clothes of a fact.
// A phone keyboard composes words as it goes, and replacing the value out from
// under it corrupts the next keystroke — so the letters are only finished for
// people typing on a real keyboard. Touch keeps the menu, which is the half of
// this that works better with a thumb anyway.
const canTypeAhead = matchMedia('(pointer: fine)').matches

function typeAhead(q) {
  const input = P.input
  const top = P.list[0]
  if (!canTypeAhead || !P.complete || !top || !input) return
  if (input.value !== q || top.label.length <= q.length) return
  if (top.label.slice(0, q.length).toLowerCase() !== q.toLowerCase()) return
  // Only from the end of the line: nobody wants a word finished mid-edit.
  if (input.selectionStart !== q.length || input.selectionEnd !== q.length) return

  P.typed = q
  input.value = q + top.label.slice(q.length)
  input.setSelectionRange(q.length, top.label.length)
  P.active = 0
}

// Whether the completion is still sitting there unanswered.
const ahead = () => P.active === 0 && P.typed !== null
  && P.input?.selectionEnd > P.input?.selectionStart

function showPlaces(q, places, failed) {
  if (!P.input?.isConnected) return
  P.list = places
  P.active = -1
  P.typed = null
  typeAhead(q)
  drawPlaces(failed
    ? "Can't reach the place search right now — type it however you like."
    : `Nothing found for "${q}". Type it however you like.`)
}

async function searchPlaces(q) {
  const seq = ++P.seq
  P.ctrl?.abort()
  const ctrl = new AbortController()
  P.ctrl = ctrl
  try {
    const res = await fetch(`/api/places?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
    const data = await res.json()
    // A slower earlier answer must not land on top of a newer one.
    if (seq !== P.seq || !P.input?.isConnected) return
    const places = Array.isArray(data.places) ? data.places : []
    if (!data.failed) memoPlaces(q, places)
    showPlaces(q, places, data.failed)
  } catch { /* aborted, or offline — leave whatever is on screen */ }
}

function pickPlace(i, focus = true) {
  const place = P.list[i]
  const input = P.input
  if (!place || !input) return
  // Taking a place takes the whole place: the line you would write on a postcard
  // in the box, and its coordinates behind — which is what turns "the lake" into
  // something the others can actually drive to.
  input.value = place.where || place.label
  setPin(input, place.lat, place.lon)
  P.seq++            // any answer still in flight is now stale
  closePlaces()
  if (focus) {
    input.focus()
    input.setSelectionRange(input.value.length, input.value.length)
  }
}

document.addEventListener('input', (ev) => {
  const input = ev.target.closest?.('[data-places]')
  if (!input) return
  if (P.input && P.input !== input) closePlaces()
  P.input = input
  P.complete = !ev.isComposing && !String(ev.inputType ?? '').startsWith('delete')

  // Typing again means the pin no longer points at what the box says, and a pin
  // that has drifted off the words is worse than none: it sends people
  // confidently to the wrong field.
  setPin(input, null, null)

  clearTimeout(P.timer)
  const q = input.value.trim()
  if (q.length < PLACES_MIN) { P.seq++; closePlaces(); return }

  // A query we have seen this session answers straight away — which is what
  // makes typing ahead feel like the box knows rather than like it caught up.
  const known = placeMemo.get(q.toLowerCase())
  if (known) { P.seq++; P.ctrl?.abort(); showPlaces(q, known, false); return }
  P.timer = setTimeout(() => searchPlaces(q), PLACES_WAIT)
})

document.addEventListener('keydown', (ev) => {
  const input = ev.target.closest?.('[data-places]')
  if (!input || input !== P.input) return
  const n = P.list.length

  if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
    if (!n) return
    ev.preventDefault()
    P.active = ev.key === 'ArrowDown'
      ? (P.active + 1) % n
      : (P.active <= 0 ? n - 1 : P.active - 1)
    // Walking the list puts each place in the box as you pass it, so what you
    // would end up with by stopping here is never left to be guessed at.
    if (P.typed === null) P.typed = input.value
    input.value = P.list[P.active].where || P.list[P.active].label
    input.setSelectionRange(input.value.length, input.value.length)
    drawPlaces('')
    return
  }
  // Tab takes the completion on its way past — the whole place, address and
  // all, not just the letters that happen to be on screen.
  if (ev.key === 'Tab' && ahead()) { pickPlace(0, false); return }

  // → and End collapse the selection anyway; this makes that mean "yes, that
  // one" rather than leaving the text of a place nobody has actually chosen.
  if ((ev.key === 'ArrowRight' || ev.key === 'End') && ahead()) {
    ev.preventDefault()
    pickPlace(0)
    return
  }

  // Enter only belongs to the menu while something in it is highlighted —
  // otherwise it is still the key that submits the form.
  if (ev.key === 'Enter' && P.active >= 0) { ev.preventDefault(); pickPlace(P.active); return }

  if (ev.key === 'Escape' && n) {
    ev.preventDefault()
    ev.stopPropagation()
    // Escape gives back the letters you typed, not the ones we added.
    if (P.typed !== null) {
      const typed = P.typed
      input.value = typed
      input.setSelectionRange(typed.length, typed.length)
    }
    P.seq++
    closePlaces()
  }
})

// mousedown rather than click: the box must not lose focus (and close the menu)
// before the tap has had a chance to say which place it landed on.
document.addEventListener('mousedown', (ev) => {
  const opt = ev.target.closest?.('[data-place]')
  if (!opt || !placesField(P.input)?.contains(opt)) return
  ev.preventDefault()
  pickPlace(Number(opt.dataset.place))
})

// A tap that lands just after a flick of the list doesn't always produce a
// mousedown, and a place you tapped that stayed unpicked is the sort of thing
// that gets an app closed. The click behind it is the backstop — by the time it
// arrives a mousedown pick has already taken the menu out of the document, so
// this finds nothing left to do.
document.addEventListener('click', (ev) => {
  const opt = ev.target.closest?.('[data-place]')
  if (!opt || !placesField(P.input)?.contains(opt)) return
  ev.preventDefault()
  pickPlace(Number(opt.dataset.place))
})

document.addEventListener('focusout', (ev) => {
  if (ev.target !== P.input) return
  setTimeout(() => { if (document.activeElement !== P.input) closePlaces() }, 0)
})

// A thumb, unlike a mouse, arrives with a keyboard behind it. Bringing the box
// to the top of the sheet as it takes focus puts the whole gap down to the keys
// under it, which is where a list of results is expected to open.
const touchTyping = matchMedia('(pointer: coarse)').matches

document.addEventListener('focusin', (ev) => {
  if (!touchTyping) return
  const input = ev.target.closest?.('[data-places]')
  const body = input?.closest('.sheet__body')
  if (!body) return
  // After the keyboard has finished coming up: the sheet is a different size by
  // then, and scrolling to the wrong one lands in the wrong place.
  setTimeout(() => {
    if (!input.isConnected) return
    const gap = input.getBoundingClientRect().top - body.getBoundingClientRect().top
    body.scrollBy({ top: gap - PLACES_EDGE, behavior: 'smooth' })
  }, 260)
})

// The list is positioned against the box, so it has to be measured again when
// the box moves under it.
document.addEventListener('scroll', () => { if (P.list.length) fitPlaces() }, { capture: true, passive: true })

// The on-screen keyboard covers the foot of the page without the page ever being
// told: the layout viewport keeps its full height, so a sheet pinned to the
// bottom of it opens behind the keys. The visual viewport does know, so the gap
// between the two is measured here and the CSS stands the sheet on top of it.
function watchKeyboard() {
  const vv = window.visualViewport
  if (!vv) return
  const apply = () => {
    // Pinch-zoom shrinks the visual viewport as well, and that is not a keyboard.
    const gap = vv.scale > 1.05 ? 0 : window.innerHeight - vv.height - vv.offsetTop
    // Address bars slide in and out by a few dozen pixels as the page scrolls. A
    // keyboard is never that small, and ignoring the small ones keeps the sheet
    // from twitching along with the browser chrome.
    const kb = gap > 120 ? Math.round(gap) : 0
    document.documentElement.style.setProperty('--kb', `${kb}px`)
    document.documentElement.classList.toggle('is-kb', kb > 0)
    if (P.list.length) fitPlaces()
  }
  vv.addEventListener('resize', apply)
  vv.addEventListener('scroll', apply)
  apply()
}
watchKeyboard()

window.addEventListener('popstate', boot)

// ---- sync -------------------------------------------------------------------

async function poll() {
  if (S.view !== 'trip' || !S.trip || document.hidden || S.busy) return
  try {
    const { rev } = await api(`/trips/${S.trip.id}/rev`)
    if (rev !== S.rev) {
      // Don't yank the page out from under someone mid-edit.
      if (document.activeElement?.matches('input, textarea')) return
      absorb(await api(`/trips/${S.trip.id}`))
    }
  } catch { /* offline; try again next tick */ }
}

setInterval(poll, 5000)
document.addEventListener('visibilitychange', () => { if (!document.hidden) poll() })

// A phone that walks back into signal should not wait out the rest of the tick.
window.addEventListener('online', poll)
window.addEventListener('offline', () => toast('No signal. The list still reads; changes will not save.'))

// ---- installed app ----------------------------------------------------------

// The worker is what makes this installable and what keeps the last state the
// server sent, so opening the app at a campsite with no bars shows your list
// rather than nothing. Registration waits for load so it never competes with
// the first paint or the first fetch of a trip.
if ('serviceWorker' in navigator) {
  // Read before registering, not after: on a first visit the worker claims this
  // page as part of installing, and a check made afterwards would mistake that
  // for an update and greet a new user with news of one.
  const hadWorker = !!navigator.serviceWorker.controller
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* plain http, private mode, or no support: still an app, just not offline */
    })
  })
  // Being handed a worker when there already was one means a deploy landed
  // while this tab was open. The code running here is still the old code, so
  // say so rather than swapping it out from under a half-typed item.
  if (hadWorker) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      toast('Update ready. Reopen the app to get it.')
    })
  }
}

// ---- add to home screen -----------------------------------------------------

// Asking to be installed is worth doing once, at a moment when the answer is
// likely to be yes, and not again after a no. Most of what follows is working
// out when that moment is — and, more often, that there isn't one.

const UA = navigator.userAgent || ''

// iPadOS has called itself a Mac since 13. The touch points are what give it up.
const isIOS = /iPad|iPhone|iPod/.test(UA) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

// This app spreads by link, so a good share of arrivals are inside the browser
// that WhatsApp or Instagram keeps to itself. None of those can install
// anything, and several show a Share sheet with no Add to Home Screen on it at
// all — being told to tap something that isn't there is worse than silence.
// Android's WebView admits to being one; an iOS WKWebView is known by the
// Safari it leaves out of its user agent.
const inWebview = /\bwv\b/.test(UA) ||
  /FBAN|FBAV|FB_IAB|Instagram|LinkedInApp|Line\/|MicroMessenger|Snapchat|TikTok|Twitter|Pinterest|GSA\//i.test(UA) ||
  (isIOS && !/Safari\//.test(UA))

// On iOS the item belongs to Safari alone. Chrome and Firefox there are Safari
// underneath and pass the test above, so they are told apart by their own names.
const iosSafari = isIOS && !inWebview && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(UA)

const isInstalled = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  window.matchMedia('(display-mode: minimal-ui)').matches ||
  navigator.standalone === true

const INSTALL_KEY = 'cs.install'

function installNotes() {
  try {
    const n = JSON.parse(localStorage.getItem(INSTALL_KEY) ?? '{}')
    return n && typeof n === 'object' ? n : {}
  } catch { return {} }
}

// A prompt that cannot remember being turned down would ask again every single
// visit, so somewhere with no storage is somewhere we say nothing.
let canRemember = true
function noteInstall(patch) {
  try { localStorage.setItem(INSTALL_KEY, JSON.stringify({ ...installNotes(), ...patch })) }
  catch { canRemember = false }
}

// Counted here, once per load, so "not the first time you have opened this" is
// a question we can ask later. Doubles as the check that storage works at all.
const visits = (installNotes().visits ?? 0) + 1
noteInstall({ visits })

const MONTH = 30 * 24 * 60 * 60 * 1000

// Being installable is not a reason to ask. Three more things have to hold: the
// app has already been some use — there is a trip on this device — this is not
// the first look at it, and we were not turned down recently. Two noes and the
// question is retired.
function worthAsking() {
  if (!canRemember || isInstalled() || inWebview) return false
  const n = installNotes()
  if (n.installed || (n.no ?? 0) >= 2) return false
  if (n.at && Date.now() - n.at < MONTH) return false
  return visits >= 2 && localTrips().length > 0
}

const installEl = document.getElementById('install')

let deferred = null   // Chrome's beforeinstallprompt, held back for our moment
let installTimer

const canInstall = () => !isInstalled() && !inWebview && (!!deferred || iosSafari)

// Closing a card you went looking for is not a refusal, so it is not counted
// as one — otherwise reading the iOS instructions twice retires the question.
let wasAskedFor = false

function showInstall(askedFor = false) {
  wasAskedFor = askedFor
  // Where Chrome has handed us a prompt there is a button to press. iOS has no
  // such thing, so the card can only point at the Share sheet and stand aside.
  const ios = !deferred && iosSafari
  installEl.innerHTML = `
    <div class="install" role="region" aria-label="Add to home screen">
      <span class="install__mark" aria-hidden="true">${ICONS.mark}</span>
      <div class="install__say">
        <b>Keep Camping Sync to hand</b>
        <p>${ios
          ? `Tap ${ICONS.share} in the toolbar below, then <b>Add to Home Screen</b>.`
          : 'Opens like an app, and your lists still read with no signal.'}</p>
      </div>
      <button class="install__x" data-act="install-no" aria-label="${ios ? 'Close' : 'Not now'}">${ICONS.x}</button>
      ${ios ? '' : '<button class="btn btn--primary btn--sm install__go" data-act="install-yes">Add to home screen</button>'}
    </div>`
  // The home page has a standing offer of its own, and the two of them at once
  // is the same question asked twice.
  document.body.classList.add('install-open')
  requestAnimationFrame(() => {
    installEl.classList.add('is-up')
    // The toast lands in this same corner and sits above everything. It is told
    // how much room the card is taking so it steps over it rather than through.
    document.body.style.setProperty('--install-h', `${installEl.firstElementChild?.offsetHeight ?? 0}px`)
  })
}

function hideInstall() {
  document.body.style.removeProperty('--install-h')
  document.body.classList.remove('install-open')
  installEl.classList.remove('is-up')
  // Emptied after it has slid out rather than during, so it does not blink away.
  setTimeout(() => { if (!installEl.classList.contains('is-up')) installEl.innerHTML = '' }, 300)
}

const turnedDown = () => noteInstall({ no: (installNotes().no ?? 0) + 1, at: Date.now() })

// Never in the first seconds of a visit. The card is a suggestion, and one that
// lands while you are still finding what you came for is an interruption.
function considerInstall() {
  if (installEl.firstChild || !canInstall() || !worthAsking()) return
  clearTimeout(installTimer)
  installTimer = setTimeout(() => { if (canInstall() && worthAsking()) showInstall() }, 6000)
}

// The prompt is single use: Chrome will not hand the event back, so whatever
// comes of it is the end of the asking for this page at least.
async function runInstallPrompt() {
  const ev = deferred
  deferred = null
  if (!ev) return
  ev.prompt()
  const { outcome } = await ev.userChoice.catch(() => ({ outcome: 'dismissed' }))
  // Saying yes fires appinstalled, which does the remembering for us.
  if (outcome !== 'accepted') turnedDown()
  if (S.view === 'landing') render()
}

window.addEventListener('beforeinstallprompt', (ev) => {
  // Chrome's own bar is neither asked for nor placed by us. Holding the event
  // back is what buys the right to choose the moment.
  ev.preventDefault()
  deferred = ev
  // The home page carries a quiet way in of its own, which until now had
  // nothing to offer.
  if (S.view === 'landing') render()
  considerInstall()
})

window.addEventListener('appinstalled', () => {
  deferred = null
  noteInstall({ installed: true })
  hideInstall()
})

// The card asks once. This is how somebody who said no, or who was never in a
// position to be asked, gets there on their own terms.
function installBlock() {
  if (!canInstall()) return ''
  return `<button class="btn btn--wide btn--ghost btn--sm install__nudge" data-act="install-tip">
            ${ICONS.plus} Add Camping Sync to your home screen
          </button>`
}

// ---- boot -------------------------------------------------------------------

async function boot() {
  try {
    const { catalog, tips } = await api('/catalog')
    S.catalog = catalog
    S.tips = tips
  } catch { /* the app still works without suggestions */ }

  const m = location.pathname.match(/^\/t\/([^/]+)/)
  if (m) await openTrip(decodeURIComponent(m[1]))
  else await showLanding()

  considerInstall()
}

boot()
