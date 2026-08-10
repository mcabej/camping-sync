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

// Your own page is the one whose heading changes with the trip: on the way out
// it is what you are carrying to the car, on the way home it is what has to come
// back off the grass.
const tabTitle = (tab) => (tab.id === 'mine' && goingHome() ? 'Yours to bring home' : tab.title)

// An item belongs to a list, and the tab is whichever one shows that list. Not
// the tab you are standing on: your own kit is edited from Mine, and Mine holds
// no list of its own to take the groups from.
const tabForList = (list) => TABS.find((t) => t.lists.includes(list)) ?? TABS[0]

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
  // Points down at what it is showing, and turns to point at the heading when
  // the section is folded away behind it.
  caret: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m5 9 7 7 7-7"/></svg>',
  find: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>',
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
  // How the list on screen is narrowed: who brings it, what kind of thing it
  // is, whether to bother with what is already handled, and whatever you typed
  // into the search box. All empty means everything, which is where every tab
  // starts — and where it goes back to when you leave it.
  filter: { kind: '', cat: '', hide: false, q: '' },
  trip: null, members: [], items: [], events: [],
  catalog: null, tips: [],
  // The forecast for where and when this trip is: `{ key, state, days, advice }`.
  // Not part of the trip — nobody edits it and it is the same for everybody — so
  // it is fetched on its own and keyed by the question it answers.
  wx: null,
  me: null,          // member id
  rev: 0,
  sheet: null,       // { kind, ...payload }
  busy: false,
  editNotes: false,  // the shared notes read as text until you ask to change them
  editWhere: false,  // same for where the trip is, which is read far more than written
  expand: { tips: false, feed: false },
  // Which headings are folded shut, as "tab:heading" — a long list is read a
  // section at a time, and Shelter & sleep should stay shut on the packing list
  // without shutting Dinner on the food. `touched` is the ones you have folded
  // or unfolded yourself, which is how the app knows not to overrule you.
  // Both are kept per trip on this device; see loadFolds.
  folds: { shut: new Set(), touched: new Set() },
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

// Which way the trip is facing. Off, the lists ask who is bringing what; on,
// your own page asks what is back in the car. See the pack-down on the Camp tab.
const goingHome = () => !!S.trip?.going_home

// The second set of ticks, for the way home. Kept apart from `packed` because
// "I put the stove in the car on Friday" and "the stove is in the car on Sunday"
// are different facts, and one of them is the only record of who brought what.
const stowsOn = (it) => it.stows ?? []
const stowedForMe = (it) => !!S.me && stowsOn(it).includes(S.me)

// Done when everybody who carried a piece of it has their piece back.
const allStowed = (it) => (isOwn(it)
  ? stowedForMe(it)
  : isClaimed(it) && claimsOn(it).every((c) => stowsOn(it).includes(c.member_id)))

// Whichever tick your own page is asking about right now.
const tickedForMe = (it) => (goingHome() ? stowedForMe(it) : packedForMe(it))

// "Sorted" is whatever the tally at the head of the section already counts as
// done, so the chip hides exactly what the numbers say is handled: on a list,
// somebody has put their name to it — or, for your own kit, you have packed it.
// On your own page everything already has your name on it, so there the only
// question left is whether it is in the car — going out, or coming home.
const isSettled = (it) => (S.tab === 'mine' ? tickedForMe(it) : isOwn(it) ? isMine(it) : isClaimed(it))

// Search is the one filter that does not care how the list is organised: you
// type "sock" because you want the socks, wherever they are filed and whoever
// is bringing them. Notes count — half of what a thing is is in its note.
function matchesQuery(it, q) {
  if (!q) return true
  const s = q.trim().toLowerCase()
  return !s || [it.title, it.note, it.category, it.qty, it.place]
    .some((v) => String(v ?? '').toLowerCase().includes(s))
}

// Everything except the category, because the category chips are built out of
// what is left after the others have had their say.
const preCat = (it, f) => inKind(it, f.kind) && (!f.hide || !isSettled(it)) && matchesQuery(it, f.q)
const matchesFilter = (it, f) => preCat(it, f) && (!f.cat || catOf(it) === f.cat)

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
  return {
    kind: pageParts().kinds ? S.filter.kind : '',
    cat: S.filter.cat,
    // Plans are not brought by anybody, so there is nothing on that tab for
    // "already handled" to mean and no chip offering it.
    hide: !!S.filter.hide && !isPlanTab(currentTab()),
    q: String(S.filter.q ?? ''),
  }
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
  const home = goingHome()
  const done = load.filter(tickedForMe).length
  const left = load.length - done
  return {
    segs: `${done ? seg(done, colorOf(meMember())) : ''}
           ${left ? `<div class="coverage__seg coverage__seg--gap" style="flex:${left}"></div>` : ''}`,
    say: left === 0
      ? `<b>All ${load.length} ${home ? 'back in.' : 'packed.'}</b>`
      : `<b>${left}</b> still to ${home ? 'find' : 'pack'}`,
    aria: `you have ${home ? 'found' : 'packed'} ${done} of ${load.length}`,
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
// A list you can read is a list you scroll; a list you have to search is a
// longer one than that. Under this many things the box is one more control
// between you and the tent.
const FIND_MIN = 8

// Above the chips: the two controls that are about the shape of the list rather
// than about what is on it. Both earn their place or neither is drawn — a page
// with six things on it and one heading has nothing to search and nothing to
// fold.
function listTools(all) {
  const f = activeFilter()
  const groups = pageGroups()
  const findable = all.length >= FIND_MIN || !!f.q
  const foldable = groups.length > 1 && !f.cat && !f.q.trim()
  if (!findable && !foldable) return ''

  const allShut = foldable && groups.every(([name]) => isShut(name))
  return `
    <div class="tools">
      ${findable ? `
        <div class="find">
          <span class="find__icon" aria-hidden="true">${ICONS.find}</span>
          <label class="sr-only" for="cs-find">Search this list</label>
          <input class="find__box" id="cs-find" data-find value="${esc(f.q)}"
                 placeholder="Search this list" enterkeyhint="search" inputmode="search"
                 autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" maxlength="60">
          ${f.q ? `<button class="find__x" data-act="find-clear" aria-label="Clear the search">${ICONS.x}</button>` : ''}
        </div>` : ''}
      ${foldable ? `
        <button class="tools__fold" data-act="fold-all" data-shut="${!allShut}"
                aria-label="${allShut ? 'Unfold every section' : 'Fold every section'}">
          <span class="tools__caret${allShut ? ' tools__caret--shut' : ''}" aria-hidden="true">${ICONS.caret}</span>
          ${allShut ? 'Unfold all' : 'Fold all'}</button>` : ''}
    </div>`
}

function filterBar(all, kinds, count) {
  const f = activeFilter()
  // Nothing to narrow and no halves to choose between is nothing to say. An
  // empty list that does have two halves keeps its chips, because a trip now
  // starts with nothing on it and this is the way to the personal side of it —
  // "What am I missing?" offers whichever half you are standing in.
  if (!all.length && !kinds) return ''

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

  // The categories on offer are the ones left after everything else has had its
  // say, so the row never offers a cut that comes back empty.
  const cats = [...new Set(all.filter((i) => preCat(i, f)).map(catOf))]

  // Most of a packing list is settled by the time you leave, and the part that
  // is not is the whole reason you opened it. This is the biggest cut on the
  // page and it wears no blaze: what it hides is the handled half, not the gap.
  const settled = all.filter((i) => inKind(i, f.kind) && isSettled(i)).length
  const hideChip = !settled && !f.hide ? '' : `
    <button class="filters__chip" data-act="filter-hide" aria-pressed="${f.hide}">
      ${ICONS.tickGreen}${S.tab === 'mine' && !goingHome() ? 'Hide packed' : 'Hide sorted'}
      ${settled ? `<span class="filters__n filters__n--quiet">${settled}</span>` : ''}</button>
    <span class="filters__div" aria-hidden="true"></span>`

  return `
    <div class="filters" role="group" aria-label="Filter this list">
      ${isPlanTab(currentTab()) ? '' : hideChip}
      ${kinds ? `${kindChip('shared')}${kindChip('own')}
        <span class="filters__div" aria-hidden="true"></span>` : ''}
      ${cats.map(catChip).join('')}
    </div>`
}

// Only reachable by narrowing a page that does have things on it, so the way
// out is whichever narrowing you are standing behind — the last one applied is
// the one you are most likely to have meant to undo.
function noMatch(f) {
  const q = f.q.trim()
  if (q) {
    return `
      <div class="empty">
        <h3>Nothing matches “${esc(q)}”</h3>
        <p>${f.hide || f.cat || f.kind ? 'There are other filters on as well, so it may be in here somewhere.' : 'Nothing on this list has those letters in it.'}</p>
        <button class="btn" data-act="find-clear">Clear the search</button>
      </div>`
  }
  if (f.hide) {
    return `
      <div class="empty">
        <h3>${S.tab === 'mine' && !goingHome() ? 'All packed' : 'All sorted'}</h3>
        <p>Everything ${f.cat ? `in ${esc(f.cat)} ` : ''}has been dealt with. That is the whole of it hidden.</p>
        <button class="btn" data-act="filter-hide">Show it anyway</button>
      </div>`
  }
  return `
    <div class="empty">
      <h3>Nothing in ${esc(f.cat)}</h3>
      <p>Not with that filter on, anyway.</p>
      <button class="btn" data-act="filter-cat" data-value="${esc(f.cat)}">Show the whole list</button>
    </div>`
}

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
// On the way home it is the same control asking the other half of the same
// question — is this in the car — so it keeps its place, its shape and its tap,
// and only the answer it records changes. There is no third state on that
// journey: everything on the page is already yours, so nothing needs claiming.
function tickBox(item, home = false) {
  const own = isOwn(item)
  const claim = own ? null : myClaim(item)
  const on = own || !!claim
  const done = home ? stowedForMe(item) : packedForMe(item)
  const me = meMember()

  const label = home
    ? (done ? `${item.title} is back in — untick it` : `Tick ${item.title} when it is back in the car`)
    : own
    ? (done ? `Yours is packed — untick ${item.title}` : `Tick ${item.title} when yours is packed`)
    : !on ? `Put my name to ${item.title}`
    : done ? `Your share of ${item.title} is packed — untick it`
    : `Tick ${item.title} when your share is packed`

  const cls = done ? ' tick--done' : on || home ? ' tick--mine' : isClaimed(item) ? '' : ' tick--open'
  return `
    <button class="tick${cls}" data-act="${home ? 'stow' : 'tick'}" data-id="${item.id}" aria-pressed="${done}"
            ${me ? `style="--mine:${colorOf(me)}"` : ''} aria-label="${esc(label)}">
      ${done ? ICONS.tick : on || home ? '' : ICONS.plus}</button>`
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
      <h1 class="sr-only">${esc(S.trip.name)} — ${esc(S.camp ? CAMP.title : tabTitle(tab))}</h1>
      <div class="topbar__trip">
        <span class="topbar__title">${esc(S.trip.name)}</span>
        ${meta ? `<span class="topbar__meta">${meta}</span>` : ''}
      </div>
      ${under}
    </header>`
}

// A heading is a heading and a handle. Fourteen things under Camp kitchen is a
// screen and a half you scroll past to reach Clothing, so every section folds —
// and folded, its tally is still on screen, which is the part you were reading
// the section for anyway. Shut sections are left out of the page rather than
// hidden in it: nothing to scroll through, nothing to tab into.
// The headings on the page as it stands, in the order it draws them, each with
// what is under it. One answer for both kinds of page, so "fold all" and the
// auto-folding are looking at exactly what you are looking at.
function pageGroups() {
  const f = activeFilter()
  const shown = pageParts().items.filter((it) => matchesFilter(it, f))
  if (S.tab !== 'mine') return groupByCategory(shown)
  // Grouped by the tab each thing came from, in tab order, so the page maps
  // onto the app you already know.
  return TABS.filter((t) => t.lists.length && !isPlanTab(t))
    .map((tab) => [tab.label, tab.lists.flatMap((l) => shown.filter((it) => it.list === l))])
    .filter(([, list]) => list.length)
}

// A pressed category chip, or something typed in the search box, has already
// cut the page down to what you asked for — so the folds stand aside while
// either is on, rather than answering you with a row of closed headings. They
// are waiting when you let go.
const foldKey = (name) => `${S.tab}:${name}`
const isShut = (name) => {
  const f = activeFilter()
  return !f.cat && !f.q.trim() && S.folds.shut.has(foldKey(name))
}

function groupSection(name, tally, body) {
  const shut = isShut(name)
  return `
    <section class="group${shut ? ' group--shut' : ''}">
      <h3 class="group__head">
        <button class="group__fold" data-act="fold" data-group="${esc(name)}" aria-expanded="${!shut}">
          <span class="group__caret" aria-hidden="true">${ICONS.caret}</span>
          <span class="group__name">${esc(name)}</span>
          <span class="group__tally">${tally}</span>
        </button>
      </h3>
      ${shut ? '' : body}
    </section>`
}

// A group is done when each thing in it is sorted, which is a different question
// for the two halves: a group thing has somebody's name on it, your own kit is
// packed. Mixed groups count both and leave the word off.
function categoryGroups(groups, mixed) {
  return groups.map(([cat, list]) => {
    const done = list.filter((i) => (isOwn(i) ? isMine(i) : isClaimed(i))).length
    const tally = list.every(isOwn) ? `${done}/${list.length} packed` : `${done}/${list.length}`
    return groupSection(cat, list[0] && isPlan(list[0]) ? `${list.length}` : tally,
      `<ul class="items">${list.map((i) => itemRow(i, mixed)).join('')}</ul>`)
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
    body = `${categoryGroups(pageGroups(), !f.kind)}
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
      ${currentTab().lists.includes('food') ? dietStrip() : ''}
      ${pool.length ? listTools(pool) : ''}
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
  const home = goingHome()
  const others = crew(item).filter((c) => c.member_id !== S.me)
  const from = [
    catOf(item),
    own ? 'personal kit' : '',
    // Whoever else is on it, because "am I the only one bringing the bacon" is
    // the question you are actually asking on the morning you leave.
    others.length ? `with ${others.map((c) => c.member.name).join(', ')}` : '',
  ].filter(Boolean).join(' · ')

  return `
    <li class="item${tickedForMe(item) ? ' item--packed' : ''}">
      ${tickBox(item, home)}
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
  const home = goingHome()

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
    [load.filter((it) => (key === 'own') === isOwn(it) && !tickedForMe(it)).length, true]

  // Inside a group, what the others are counting on you for comes before what
  // only you would miss.
  const groups = pageGroups().map(([name, items]) => {
    const rows = [...items.filter((i) => !isOwn(i)), ...items.filter(isOwn)]
    return groupSection(name, `${rows.filter(tickedForMe).length}/${rows.length} ${home ? 'back in' : 'packed'}`,
      `<ul class="items">${rows.map(mineRow).join('')}</ul>`)
  }).join('')

  // "That is the lot" is a claim about your whole load, so a filter that hides
  // half of it has no business making the claim.
  const done = !f.kind && !f.cat && !f.hide && !f.q && load.every(tickedForMe)

  return `
    <main class="page">
      ${home ? `<p class="mine__facing">Heading home. Everything below is something you brought — tick it when it is back in the car.</p>` : ''}
      ${listTools(load)}
      ${filterBar(load, kinds, count)}
      ${shown.length ? groups : noMatch(f)}
      ${done ? `<p class="mine__done">${home
        ? 'That is the lot. Everything of yours is accounted for.'
        : 'That is the lot. Nothing left on your list.'}</p>` : ''}
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

// ---- weather ----------------------------------------------------------------

// A forecast is the one thing on the Camp tab nobody has to fill in: the trip
// already knows where it is and when it is. What it is worth is not the numbers
// but what they change — a wet Saturday is the reason a tarp exists — so the
// card ends in things you can put on the list in one tap.

// WMO codes, which is what a forecast actually comes back as: what to call each
// one, and which of the glyphs below to draw for it.
const WX_WORDS = {
  0: ['Clear', 'sun'], 1: ['Mostly clear', 'sun'], 2: ['Partly cloudy', 'part'], 3: ['Overcast', 'cloud'],
  45: ['Fog', 'fog'], 48: ['Freezing fog', 'fog'],
  51: ['Light drizzle', 'drizzle'], 53: ['Drizzle', 'drizzle'], 55: ['Heavy drizzle', 'drizzle'],
  56: ['Freezing drizzle', 'drizzle'], 57: ['Freezing drizzle', 'drizzle'],
  61: ['Light rain', 'rain'], 63: ['Rain', 'rain'], 65: ['Heavy rain', 'rain'],
  66: ['Freezing rain', 'rain'], 67: ['Freezing rain', 'rain'],
  71: ['Light snow', 'snow'], 73: ['Snow', 'snow'], 75: ['Heavy snow', 'snow'], 77: ['Snow grains', 'snow'],
  80: ['Showers', 'showers'], 81: ['Showers', 'showers'], 82: ['Heavy showers', 'showers'],
  85: ['Snow showers', 'snow'], 86: ['Snow showers', 'snow'],
  95: ['Thunderstorms', 'storm'], 96: ['Thunder and hail', 'storm'], 99: ['Thunder and hail', 'storm'],
}

const WX_ICONS = {
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.9 5.9l1.4 1.4M16.7 16.7l1.4 1.4M18.1 5.9l-1.4 1.4M7.3 16.7l-1.4 1.4"/></svg>',
  part: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="8.5" cy="8" r="3.2"/><path d="M8.5 2.4v1.6M2.9 8h1.6M4.6 4.1l1.1 1.1M12.4 4.1l-1.1 1.1"/><path d="M9 19.5h8.6a3.1 3.1 0 0 0 .3-6.2 4.4 4.4 0 0 0-8.4-.9A3.6 3.6 0 0 0 9 19.5Z"/></svg>',
  cloud: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7.4 18.5h9.8a3.4 3.4 0 0 0 .3-6.8 4.9 4.9 0 0 0-9.4-1 4 4 0 0 0-.7 7.8Z"/></svg>',
  fog: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7.4 14h9.8a3.4 3.4 0 0 0 .3-6.8 4.9 4.9 0 0 0-9.4-1 4 4 0 0 0-.7 7.8Z"/><path d="M4.5 17.5h15M7 21h11"/></svg>',
  drizzle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7.4 14.5h9.8a3.4 3.4 0 0 0 .3-6.8 4.9 4.9 0 0 0-9.4-1 4 4 0 0 0-.7 7.8Z"/><path d="M9 18v1.2M12.5 18v1.2M16 18v1.2"/></svg>',
  rain: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7.4 14h9.8a3.4 3.4 0 0 0 .3-6.8 4.9 4.9 0 0 0-9.4-1 4 4 0 0 0-.7 7.8Z"/><path d="M8.6 17.4 7.8 20M12.4 17.4l-.8 2.6M16.2 17.4l-.8 2.6"/></svg>',
  showers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="6.6" r="2.6"/><path d="M8 1.8v1.2M3.4 6.6h1.2"/><path d="M9.4 15.8h7.8a3.1 3.1 0 0 0 .3-6.2 4.4 4.4 0 0 0-8.4-.9 3.6 3.6 0 0 0 .3 7.1Z"/><path d="M10.6 18.6l-.7 2.4M15.4 18.6l-.7 2.4"/></svg>',
  snow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7.4 13.6h9.8a3.4 3.4 0 0 0 .3-6.8 4.9 4.9 0 0 0-9.4-1 4 4 0 0 0-.7 7.8Z"/><path d="M9 17.4v2.4M7.9 18l2.2 1.2M10.1 18 7.9 19.2M15 17.4v2.4M13.9 18l2.2 1.2M16.1 18l-2.2 1.2"/></svg>',
  storm: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7.4 13.6h9.8a3.4 3.4 0 0 0 .3-6.8 4.9 4.9 0 0 0-9.4-1 4 4 0 0 0-.7 7.8Z"/><path d="M13.2 16.2h-2.6l-1.4 3.2h2l-1 2.6 3.6-4h-1.8l1.2-1.8Z"/></svg>',
}

const wxOf = (code) => WX_WORDS[code] ?? ['Unsettled', 'cloud']

// The question a forecast answers, as a string: where, and which days. Change any
// part of it and the answer on screen belongs to a different trip.
const wxKey = (t) => (t && t.lat != null && t.lon != null && t.start_date
  ? `${t.lat},${t.lon},${t.start_date},${t.end_date || t.start_date}`
  : '')

// Only ever asked once per question, and never at all until the Camp tab is on
// screen — see the tail of render(). The answer is thrown away when the question
// changes, which is what stops last week's forecast sitting under a new pin.
function wantWeather() {
  const key = wxKey(S.trip)
  if (!key || S.wx?.key === key) return
  S.wx = { key, state: 'load' }
  loadWeather(key)
}

async function loadWeather(key) {
  const [lat, lon, start, end] = key.split(',')
  const q = new URLSearchParams({ lat, lon, start, end })
  try {
    const data = await (await fetch(`/api/weather?${q}`)).json()
    // Somebody moved the trip while this was in the air.
    if (S.wx?.key !== key) return
    S.wx = { key, state: 'ok', days: [], advice: [], ...data }
  } catch {
    if (S.wx?.key !== key) return
    S.wx = { key, state: 'fail' }
  }
  if (S.camp) render()
}

const wxDay = (iso) => {
  const d = new Date(`${iso}T12:00:00`)
  return Number.isNaN(+d) ? iso : d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })
}

// The first day the forecast will reach a trip that is still too far off, so the
// card can say when to come back rather than just that it cannot help.
function wxOpens(start) {
  const d = new Date(`${start}T12:00:00`)
  if (Number.isNaN(+d)) return ''
  d.setDate(d.getDate() - 15)
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'long' })
}

function wxRow(d) {
  const [word, glyph] = wxOf(d.code)
  // Two numbers per row and no more. Rain is the one people act on, so it gets
  // the third slot when there is any to speak of, and the wind takes it when
  // there is more of that than of rain.
  const wet = d.pop !== null && d.pop >= 20 ? `${Math.round(d.pop)}%` : ''
  const blow = !wet && d.wind !== null && d.wind >= 30 ? `${Math.round(d.wind)} km/h` : ''
  const title = [
    d.rain !== null ? `${d.rain.toFixed(1)} mm of rain` : '',
    d.wind !== null ? `wind to ${Math.round(d.wind)} km/h` : '',
  ].filter(Boolean).join(', ')

  return `
    <li class="wx__day">
      <span class="wx__when">${esc(wxDay(d.date))}</span>
      <span class="wx__glyph" aria-hidden="true">${WX_ICONS[glyph]}</span>
      <span class="wx__word">${esc(word)}</span>
      <span class="wx__temp">${d.hi === null ? '' : `<b>${Math.round(d.hi)}°</b>`}${
        d.lo === null ? '' : `<span>${Math.round(d.lo)}°</span>`}</span>
      <span class="wx__wet mono" ${title ? `title="${esc(title)}"` : ''}>${esc(wet || blow)}</span>
    </li>`
}

// What the forecast means for the list, and the way to act on it. Anything
// already on the trip is dropped: an offer to add the tarp you packed last night
// is the app not paying attention.
function wxAdvice(advice) {
  const have = new Set(S.items.map((i) => i.title.toLowerCase()))
  const tips = (advice ?? []).map((a) => ({
    ...a, gear: (a.gear ?? []).filter((g) => !have.has(g.title.toLowerCase())),
  }))
  if (!tips.length) return ''

  return `
    <div class="wx__tips">
      ${tips.map((a) => `
        <div class="wx__tip">
          <p>${esc(a.say)}</p>
          ${a.gear.length ? `<div class="wx__gear">${a.gear.map((g) => `
            <button class="tag" data-act="wx-add" data-tip="${esc(a.id)}" data-title="${esc(g.title)}">
              ${ICONS.plus}${esc(g.title)}</button>`).join('')}</div>` : ''}
        </div>`).join('')}
    </div>`
}

function weatherCard() {
  const t = S.trip
  // Nothing to forecast for and nothing worth nudging about: a trip with no
  // dates has not got to the point where the weather is a question.
  if (!t.start_date) return ''

  // A place typed by hand has no coordinates behind it, so there is nowhere to
  // ask about. Worth one line, because the fix is to pick the place from the
  // search — and the same pin is what turns the map button into a real one.
  if (t.lat == null || t.lon == null) {
    return `
      <div class="card">
        <h3>Weather</h3>
        <p class="card__body">Pick the site from the search under <b>Getting there</b> and the forecast comes with it. A place typed by hand has no coordinates to look one up from.</p>
      </div>`
  }

  const wx = S.wx?.key === wxKey(t) ? S.wx : null

  if (!wx || wx.state === 'load') {
    return `<div class="card" aria-busy="true"><h3>Weather</h3><div class="skel"></div></div>`
  }
  // The trip is over. The pack-down card is the one with something to say now.
  if (wx.reason === 'past') return ''

  if (wx.reason === 'far') {
    const opens = wxOpens(t.start_date)
    return `
      <div class="card">
        <h3>Weather</h3>
        <p class="card__body">Too far off to forecast — nothing beyond about a fortnight is worth packing for.${
          opens ? ` Check back around <b>${esc(opens)}</b>.` : ''}</p>
      </div>`
  }

  if (wx.state === 'fail' || !wx.days.length) {
    return `
      <div class="card">
        <h3>Weather</h3>
        <p class="card__body">Can't reach the forecast right now. It is somebody else's server, and nothing else on the trip depends on it.</p>
      </div>`
  }

  // A forecast kept from the last time there was signal is still worth reading,
  // as long as it says how old it is. "now" would read as "now ago".
  const age = wx.at ? ago(wx.at) : ''

  return `
    <div class="card">
      <div class="card__head">
        <h3>Weather</h3>
        ${age ? `<span class="card__stamp mono">${age === 'now' ? 'just checked' : `checked ${age} ago`}</span>` : ''}
      </div>
      <ul class="wx">${wx.days.map(wxRow).join('')}</ul>
      ${wx.cut ? '<p class="wx__cut">The rest of the trip is past what anyone can forecast yet.</p>' : ''}
      ${wxAdvice(wx.advice)}
    </div>`
}

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

// ---- what people can eat ----------------------------------------------------

// Everyone with something to avoid. Shared on purpose, unlike personal kit: the
// whole value of writing it down is that whoever ends up cooking finds out
// without going round the table asking.
const diets = () => S.members.filter((m) => String(m.diet ?? '').trim())

// It belongs at the top of the list people claim food from, not on a page about
// people: the moment it matters is the moment somebody says they will do Saturday
// dinner. Drawn only when there is something to say — a heading over an empty
// list would be on every Eat tab forever, and the way to fill it in is on the
// Camp tab beside the person it is about.
function dietStrip() {
  const needs = diets()
  if (!needs.length) return ''
  return `
    <div class="diets">
      <span class="eyebrow">At the table</span>
      <ul class="diets__list">
        ${needs.map((m) => `
          <li class="diets__row">
            <span class="diets__who" style="--who:${colorOf(m)}">${esc(m.name)}</span>
            <span class="diets__what">${esc(m.diet)}</span>
          </li>`).join('')}
      </ul>
    </div>`
}

// ---- going home -------------------------------------------------------------

// Everything this device can know about what came on the trip: the group's
// things that somebody put their name to, and your own kit. Other people's
// personal kit is not here to be counted, which the card says out loud rather
// than quietly reporting a number that is only most of the answer.
const brought = () => S.items.filter((it) => !isPlan(it) && (isOwn(it) ? isMine(it) : isClaimed(it)))

// The pack-down. Off until the trip is actually happening, because "is this back
// in the car?" is a nonsense question on a Tuesday three weeks out — and offered
// rather than switched on for you, because only the people there know when they
// have started packing up.
function homeCard() {
  const home = goingHome()
  const c = countdown(S.trip)
  const under = c && (c.word === 'Happening now' || c.word === 'Back home')
  // A trip with no dates never becomes "under way" on its own, so something
  // being in a car is the only sign there is that it has started.
  const gone = !c && S.items.some((it) => (isOwn(it) ? isMine(it) : claimsOn(it).some((x) => x.packed)))
  if (!home && !under && !gone) return ''

  if (!home) {
    return `
      <div class="card">
        <h3>Going home</h3>
        <p>Turn this on while you are packing up. Everything anybody brought becomes something to find again, and whatever nobody ticks back in is what gets left in the grass.</p>
        <button class="btn btn--primary btn--wide" data-act="home-on">Start the pack-down</button>
      </div>`
  }

  const load = brought()
  const back = load.filter(allStowed)
  const strays = load.filter((it) => !allStowed(it))
  const shown = strays.slice(0, 6)

  return `
    <div class="card">
      <div class="card__head">
        <h3>Going home</h3>
        <span class="card__stamp mono">${back.length}/${load.length} back in</span>
      </div>
      ${strays.length ? `
        <p>Still out there. A group thing is only back once everybody who carried a piece of it says so.</p>
        <ul class="strays">
          ${shown.map((it) => {
            const who = isOwn(it)
              ? 'yours'
              : crew(it).filter((x) => !stowsOn(it).includes(x.member_id))
                .map((x) => x.member.name).join(', ')
            return `
              <li class="stray">
                <span class="stray__what">${esc(it.title)}</span>
                <span class="stray__who">${esc(who || 'nobody')}</span>
              </li>`
          }).join('')}
        </ul>
        ${strays.length > shown.length
          ? `<p class="strays__more mono">and ${strays.length - shown.length} more</p>` : ''}` : `
        <p class="card__body">Everything on the lists is accounted for. Have a look round the pitch anyway — that is where the pegs live.</p>`}
      <div class="where__go">
        <button class="btn btn--primary" data-act="tab" data-tab="mine">Tick off yours</button>
        <button class="btn btn--quiet" data-act="home-off">Back to packing</button>
      </div>
      <p class="invite__note">Other people's personal kit is private, so it is not in that count — only the group's things and your own.</p>
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
          const diet = String(m.diet ?? '').trim()
          // Every row offers the question, whether or not it has been answered.
          // It is one quiet line, and it is the only thing that makes the field
          // findable — a person who has nothing to avoid still has to be able to
          // fill in the person who does.
          return `
            <div class="person">
              <span class="person__swatch" style="background:${colorOf(m)}"></span>
              <span class="person__main">
                <span class="person__name">${esc(m.name)}${m.id === S.me ? ' <span class="person__you mono">you</span>' : ''}</span>
                <button class="person__diet${diet ? ' person__diet--set' : ''}" data-act="diet" data-id="${m.id}"
                        aria-label="${diet ? `Change what ${esc(m.name)} can eat` : `Say what ${esc(m.name)} can't eat`}">
                  ${diet ? esc(diet) : m.id === S.me ? 'Anything you avoid?' : 'Dietary needs?'}</button>
              </span>
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
      ${homeCard()}
      ${weatherCard()}
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
  if (tab.id === 'mine') return myLoad().filter((it) => !tickedForMe(it)).length
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

  // The two things you do to an item as a whole, rather than to your share of
  // it. Changing the words comes first and is the ordinary one, so it is the
  // plain button; removing keeps the quiet one it has always had.
  const acts = `
    <div class="sheet__acts">
      <button class="btn" data-act="edit-item" data-id="${item.id}">Edit</button>
      <button class="btn btn--quiet" data-act="kill" data-id="${item.id}">Remove from the list</button>
    </div>`

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
      foot: acts,
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

  // Putting your name to Saturday dinner is the moment what somebody cannot eat
  // stops being a fact about them and becomes a fact about the shopping. So it
  // is said here, where the decision is, as well as at the top of the list.
  const feeding = (item.list === 'food' || item.list === 'drinks') ? diets() : []
  const table = !feeding.length ? '' : `
    <div class="diets diets--sheet">
      <span class="eyebrow">Before you take this on</span>
      <ul class="diets__list">
        ${feeding.map((m) => `
          <li class="diets__row">
            <span class="diets__who" style="--who:${colorOf(m)}">${esc(m.name)}</span>
            <span class="diets__what">${esc(m.diet)}</span>
          </li>`).join('')}
      </ul>
    </div>`

  // The item, and then the names. There is no separate "I'll bring it" button:
  // your own name is in the list like everybody else's, and tapping it is the
  // same tap — a shortcut that duplicates the row underneath it only makes you
  // read both to work out whether they do the same thing.
  return sheetShell({
    title: item.title,
    blurb: plan
      ? 'Optional, and it can be more than one of you — only for the plans that need booking or kit.'
      : 'As many of you as it takes. Each person ticks off their own share.',
    body: `
      ${kindSwitch}
      ${table}
      ${rows}
      <div style="margin-top:18px">
        <form data-act="add-member">
          <label class="field"><span>Someone not on the list?</span>
            <input name="name" placeholder="Add a person" maxlength="40"></label>
          <button class="btn btn--wide btn--sm" type="submit">Add them</button>
        </form>
      </div>`,
    foot: acts,
  })
}

// Every group already in use on this tab, the catalogue's included, so filing a
// thing under the group it belongs with is a pick rather than a spelling test.
const catsOn = (tab) => [...new Set([
  ...itemsOn(tab).map((i) => i.category),
  ...tab.lists.flatMap((l) => (S.catalog?.[l] ?? []).map((c) => c.cat)),
])].filter(Boolean)

// What the item says, as opposed to who is bringing it. The same four fields the
// add sheet asks for, filled in — because the reason you are here is usually
// that one of them came out wrong, and retyping the other three to fix it is how
// a list ends up with two sausages on it. Which list it sits on and where a plan
// happens are left out: those are the segmented switch and the place sheet, and
// asking twice is how the two answers end up disagreeing.
function sheetEdit(s) {
  const item = S.items.find((i) => i.id === s.id)
  if (!item) return ''
  const cats = catsOn(tabForList(item.list))

  return sheetShell({
    title: 'Edit',
    blurb: isOwn(item)
      ? 'Yours alone, so this changes nothing for anybody else.'
      : 'Everyone on the trip sees this list, so they all get the new wording.',
    body: `
      <form data-act="save-item" data-id="${item.id}">
        <label class="field"><span>What is it?</span>
          <input name="title" required maxlength="120" autofocus value="${esc(item.title)}"></label>
        <div class="field--split" style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <label class="field"><span>Group</span>
            <input name="category" list="cs-cats" maxlength="60" value="${esc(item.category ?? '')}"
                   placeholder="${esc(cats[0] ?? 'Other')}"></label>
          <label class="field"><span>How much <span style="font-weight:400">(optional)</span></span>
            <input name="qty" maxlength="40" value="${esc(item.qty ?? '')}" placeholder="x2"></label>
        </div>
        <datalist id="cs-cats">${cats.map((c) => `<option value="${esc(c)}">`).join('')}</datalist>
        <label class="field"><span>Note <span style="font-weight:400">(optional)</span></span>
          <input name="note" maxlength="500" value="${esc(item.note ?? '')}"
                 placeholder="Anything the others need to know"></label>
        <button class="btn btn--primary btn--wide" type="submit">Save</button>
      </form>`,
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

// One line per person, and it is everybody's to fill in: the person who knows
// about the nut allergy is as often whoever booked the pitch as whoever has it.
// So the sheet is the same either way and only the wording moves.
function sheetDiet(s) {
  const m = memberById(s.id)
  if (!m) return ''
  const self = m.id === S.me
  const set = String(m.diet ?? '').trim()

  return sheetShell({
    title: self ? 'What you avoid' : `What ${m.name} avoids`,
    blurb: 'Everyone on the trip can see this, which is the point — whoever ends up cooking should not have to ask around.',
    body: `
      <form data-act="save-diet" data-id="${m.id}">
        <label class="field"><span>Allergies, and anything ${self ? 'you' : 'they'} do not eat</span>
          <input name="diet" maxlength="200" autofocus value="${esc(set)}"
                 placeholder="Vegetarian. No nuts — carries an EpiPen."></label>
        <button class="btn btn--primary btn--wide" type="submit">Save</button>
      </form>
      ${set ? `
        <button class="btn btn--quiet btn--wide" style="margin-top:10px"
                data-act="clear-diet" data-id="${m.id}">Remove it</button>` : ''}`,
  })
}

function sheetAdd(s) {
  const tab = tabById(s.tab)
  const cats = catsOn(tab)

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

  // Nothing is on the list until somebody puts it there, so this sheet is now
  // where a trip actually gets built. The things you cannot camp without go to
  // the top of their heading — the rest of the order is the catalogue's.
  const first = (list) => [...list].sort((a, b) => (b.starter ? 1 : 0) - (a.starter ? 1 : 0))

  const body = [...groups.entries()].map(([cat, list]) => `
    <div class="sheet__group">
      <span class="eyebrow">${esc(cat)}</span>
      ${first(list).map((c) => `
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

// Which sheet is on screen, as opposed to what it currently says. Ticking a
// name onto the bacon changes the second and not the first.
let sheetSig = null

function renderSheet() {
  if (!S.sheet) { sheetRoot.innerHTML = ''; sheetSig = null; return }
  const map = { item: sheetItem, edit: sheetEdit, add: sheetAdd, suggest: sheetSuggest, place: sheetPlace, diet: sheetDiet }
  const html = map[S.sheet.kind]?.(S.sheet) ?? ''
  const sig = `${S.sheet.kind}:${S.sheet.id ?? ''}`
  const open = sheetRoot.querySelector('.sheet')

  // The same sheet, saying something new, keeps its own element: throwing it
  // away and building another replays the slide-in and the scrim fading up, so
  // putting your name to something made the whole sheet flinch. Only the
  // contents change, and where you had scrolled to survives with them.
  if (open && sig === sheetSig) {
    const next = document.createElement('div')
    next.innerHTML = html
    const fresh = next.querySelector('.sheet')
    if (fresh) {
      const body = open.querySelector('.sheet__body')
      const y = body?.scrollTop ?? 0
      open.innerHTML = fresh.innerHTML
      const after = open.querySelector('.sheet__body')
      if (after) after.scrollTop = y
      return
    }
  }

  sheetRoot.innerHTML = html
  sheetSig = sig
}

// ---- render -----------------------------------------------------------------

// Two things the page is holding that its HTML does not say: how far along the
// chip row you had scrolled, and where the cursor was in the search box. Both
// are thrown away by rebuilding the page and both are missed at once — a chip
// row that springs back to the start every time you press a chip means swiping
// back to the same chip to press it again.
let chipsAt = { where: '', x: 0 }

function render() {
  const y = window.scrollY
  const was = root.querySelector('.filters')
  if (was) chipsAt.x = was.scrollLeft

  const box = document.activeElement
  const caret = box?.id === 'cs-find' ? { start: box.selectionStart, end: box.selectionEnd } : null

  const views = { landing: viewLanding, join: viewJoin, trip: viewTrip }
  root.innerHTML = views[S.view]?.() ?? '<div class="page"><p>Loading…</p></div>'
  // The install card floats over the bottom of the screen, which on the trip
  // page already has a tab bar standing on it.
  document.body.classList.toggle('has-tabbar', S.view === 'trip')
  renderSheet()
  if (S.view === 'trip') window.scrollTo(0, y)

  // The row goes back where it was, unless this is a different page's row —
  // a new tab starts at the left, the same as it would if you had just arrived.
  const here = `${S.view}:${S.camp ? 'camp' : S.tab}`
  const row = root.querySelector('.filters')
  if (row) row.scrollLeft = here === chipsAt.where ? chipsAt.x : 0
  chipsAt = { where: here, x: row ? row.scrollLeft : 0 }

  // The search box sits inside the list it filters, so every keystroke rebuilds
  // the box being typed in. The cursor is put back exactly where it was, which
  // is what makes editing the middle of a word possible.
  if (caret) {
    const found = root.querySelector('#cs-find')
    if (found) { found.focus(); found.setSelectionRange(caret.start, caret.end) }
  }

  // Asked for after the page is on screen, and only where it is shown: the
  // forecast is the one thing here that comes from somewhere else, so nothing
  // waits on it. It answers once per question — see wantWeather — so this being
  // in render() costs a string comparison and nothing else.
  if (S.view === 'trip' && S.camp) wantWeather()
}

// ---- actions ----------------------------------------------------------------

const meKey = (tripId) => `cs.me.${tripId}`
const TRIPS_KEY = 'cs.trips'
const foldsKey = (tripId) => `cs.folds.${tripId}`

// Packing happens over a week and a dozen visits, not in one sitting, so a
// heading you shut on Tuesday is still shut on Thursday. It is a view of the
// list rather than part of it, so it lives on the device: two people can have
// the same trip open with different things folded away, and neither is wrong.
function loadFolds() {
  S.folds = { shut: new Set(), touched: new Set() }
  try {
    const kept = JSON.parse(localStorage.getItem(foldsKey(S.trip.id)) ?? '{}')
    for (const k of kept.shut ?? []) S.folds.shut.add(k)
    for (const k of kept.touched ?? []) S.folds.touched.add(k)
  } catch { /* nothing remembered, or nowhere to remember it */ }
}

function saveFolds() {
  try {
    localStorage.setItem(foldsKey(S.trip.id),
      JSON.stringify({ shut: [...S.folds.shut], touched: [...S.folds.touched] }))
  } catch { /* private mode: the folds last as long as the visit does */ }
}

// A heading with nothing left to answer folds itself, so the list closes up as
// the trip comes together and what is left is what is left.
//
// Only ever on the way in to a tab. A section that collapsed the moment you
// ticked the last thing in it would take the row you just ticked off the screen
// under your finger, which is the app arguing with you. And never a heading you
// have folded or unfolded yourself: that is an answer already given.
function autoFold() {
  // Nothing on the Plan tab is ever settled — an idea with somebody's name on
  // it is still an idea, and a board that folded itself away would be hiding
  // the plans that are actually happening.
  if (!S.trip || isPlanTab(currentTab())) return
  for (const [name, list] of pageGroups()) {
    const key = foldKey(name)
    if (S.folds.touched.has(key)) continue
    if (list.length && list.every(isSettled)) S.folds.shut.add(key)
    else S.folds.shut.delete(key)
  }
  saveFolds()
}

// Landing on a trip: take the state, pick up whatever this device had folded
// away, and fold up anything that has been settled since you last looked.
function arrive(state) {
  absorb(state)
  loadFolds()
  autoFold()
  render()
}

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
  localStorage.removeItem(foldsKey(id))
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
    arrive(await api(`/trips/${S.trip.id}`))
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
    if (S.view === 'trip') arrive(state)
    else absorb(state)
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
      // screen for it. The same goes for whatever is in the search box.
      S.filter = { kind: '', cat: '', hide: false, q: '' }
      // Arriving is when the folds are allowed to move on their own.
      autoFold()
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

    // The one chip that answers "what is actually left", which on the morning
    // you leave is the only question on the page.
    case 'filter-hide':
      S.filter = { ...S.filter, hide: !S.filter.hide }
      render()
      window.scrollTo(0, 0)
      break

    case 'find-clear':
      S.filter = { ...S.filter, q: '' }
      render()
      break

    // Fold all, and then unfold all — one button, because the second is only
    // ever wanted straight after the first. Doing it by hand counts as having
    // an opinion, so nothing folded this way is folded back by the app.
    case 'fold-all': {
      const shut = el.dataset.shut === 'true'
      for (const [name] of pageGroups()) {
        const key = foldKey(name)
        S.folds.touched.add(key)
        if (shut) S.folds.shut.add(key)
        else S.folds.shut.delete(key)
      }
      saveFolds()
      render()
      window.scrollTo(0, 0)
      break
    }

    case 'expand':
      S.expand[el.dataset.what] = !S.expand[el.dataset.what]
      render()
      break

    // Folding a section moves everything under it up the page, so the heading
    // you pressed is put back where your thumb left it rather than wherever the
    // shorter page happens to put it.
    case 'fold': {
      const key = foldKey(el.dataset.group)
      const y = el.getBoundingClientRect().top
      S.folds.touched.add(key)
      S.folds.shut.has(key) ? S.folds.shut.delete(key) : S.folds.shut.add(key)
      saveFolds()
      render()
      const now = root.querySelector(`[data-act="fold"][data-group="${CSS.escape(el.dataset.group)}"]`)
      if (now) window.scrollBy(0, now.getBoundingClientRect().top - y)
      break
    }

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

    // The same tap on the way home, recording the other journey. No claiming
    // step: by Sunday whoever brought a thing is whoever has to find it.
    case 'stow':
      if (!S.me) { toast('Join the trip first.'); break }
      mutate(() => api(`/items/${el.dataset.id}/stow`, { method: 'POST', body: { memberId: S.me } }))
      break

    case 'own':
      if (!S.me) { toast('Join the trip first.'); break }
      mutate(() => api(`/items/${el.dataset.id}/own`, { method: 'POST', body: { memberId: S.me } }))
      break

    // Which way the trip is facing, flipped by whoever notices it is over — and
    // flippable back, because a pack-down that carries on into Monday is normal
    // and finding the mallet in the boot is not a reason to be stuck.
    case 'home-on':
    case 'home-off': {
      const home = act === 'home-on'
      await mutate(() => api(`/trips/${S.trip.id}`, { method: 'PATCH', body: { going_home: home } }))
      toast(home
        ? 'Pack-down started. Your list is asking what is back in the car.'
        : 'Back to packing.')
      break
    }

    case 'diet':
      S.sheet = { kind: 'diet', id: el.dataset.id }
      renderSheet()
      break

    case 'clear-diet': {
      const id = el.dataset.id
      S.sheet = null
      renderSheet()
      await mutate(() => api(`/trips/${S.trip.id}/members/${id}`, { method: 'PATCH', body: { diet: '' } }))
      break
    }

    // The forecast said it was worth having and the list did not have it. The
    // catalogue entry came down with the advice, so this adds the real thing —
    // its heading and the note explaining why — rather than a bare title.
    case 'wx-add': {
      const tip = (S.wx?.advice ?? []).find((a) => a.id === el.dataset.tip)
      const gear = tip?.gear?.find((g) => g.title === el.dataset.title)
      if (!gear) break
      if (gear.kind === 'own' && !S.me) { toast('Join the trip first.'); break }
      await mutate(() => api(`/trips/${S.trip.id}/items`, { method: 'POST', body: gear }))
      toast(gear.kind === 'own'
        ? `${gear.title} is on your own list.`
        : `${gear.title} is on the packing list.`)
      break
    }

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

    // A second sheet rather than fields grown into the first one: the item sheet
    // is a set of names you tap through, and a form in among them turns tapping
    // three people onto the bacon into something you have to be careful about.
    case 'edit-item':
      S.sheet = { kind: 'edit', id: el.dataset.id }
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
        arrive(await api(`/trips/${trip.id}`))
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

    // The sheet shuts on save, because what you were fixing is the row behind
    // it: seeing it say the right thing is the confirmation, and a sheet still
    // sitting on top of it is in the way of that.
    case 'save-item': {
      if (!String(f.title ?? '').trim()) break
      const id = form.dataset.id
      S.sheet = null
      renderSheet()
      await mutate(() => api(`/items/${id}`, {
        method: 'PATCH',
        body: { title: f.title, category: f.category || 'Other', qty: f.qty, note: f.note },
      }))
      toast('Saved.')
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

    case 'save-diet': {
      const id = form.dataset.id
      S.sheet = null
      renderSheet()
      await mutate(() => api(`/trips/${S.trip.id}/members/${id}`, { method: 'PATCH', body: { diet: f.diet } }))
      toast(String(f.diet ?? '').trim()
        ? 'Saved. It shows on the food list now.'
        : 'Removed.')
      break
    }
  }
})

document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && S.sheet) { S.sheet = null; renderSheet() }
})

// ---- searching a list -------------------------------------------------------

// Every keystroke redraws the list under the box, which is the point: nothing
// to submit, nothing to wait for, and the answer shrinking towards what you
// meant as you type. render() puts the cursor back afterwards.
//
// Except mid-composition. A phone keyboard building a word out of several
// keystrokes has a claim on the box it is building it in, and replacing that
// box under it drops characters — so those are let through and the list catches
// up when the word is finished.
function typedFind(box) {
  if (S.filter.q === box.value) return
  S.filter = { ...S.filter, q: box.value }
  render()
}

document.addEventListener('input', (ev) => {
  const box = ev.target.closest?.('[data-find]')
  if (box && !ev.isComposing) typedFind(box)
})

document.addEventListener('compositionend', (ev) => {
  const box = ev.target.closest?.('[data-find]')
  if (box) typedFind(box)
})

// Nothing to submit, so Enter means "I am done typing" — which on a phone is
// worth taking as "put the keyboard away and let me see the list".
document.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Enter' && ev.key !== 'Escape') return
  const box = ev.target.closest?.('[data-find]')
  if (!box) return
  ev.preventDefault()
  if (ev.key === 'Escape' && box.value) { S.filter = { ...S.filter, q: '' }; render() }
  else box.blur()
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
