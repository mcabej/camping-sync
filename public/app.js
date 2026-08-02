/* Camping Sync — client. Vanilla, no build step.
   Rendering is string-based with one delegated click handler; every mutation
   returns the whole trip state, so there is exactly one source of truth. */

const MEMBER_COLORS = ['#2F6B57', '#37698F', '#7A5AA6', '#8C6A2F', '#B23C6B', '#4E7A2A', '#2E6E77', '#6B5B4A']

const TABS = [
  { id: 'pack', list: 'gear', label: 'Pack', title: 'Packing list' },
  { id: 'eat', list: 'food', label: 'Eat', title: 'Food', note: 'Plan it by meal. Whoever claims a meal buys for it.' },
  { id: 'drink', list: 'drinks', label: 'Drink', title: 'Drinks', note: 'About 1 gallon / 4L of water per person per day.' },
  { id: 'do', list: 'activities', label: 'Do', title: 'Plans', note: 'Vote for what you actually want to do. Nobody has to "bring" a hike.' },
  { id: 'camp', list: null, label: 'Camp', title: 'The trip' },
]

// The two ways a thing gets brought. This distinction runs through the whole app.
const SECTIONS = {
  shared: { label: 'For the group', note: 'One person brings each of these, and everyone uses it.' },
  own: { label: 'Personal kit', note: 'One each. Only you can see how much of yours is packed.' },
}

const ICONS = {
  pack: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8h12l1 12H5L6 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
  eat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3v8a2 2 0 0 0 4 0V3"/><path d="M7 11v10"/><path d="M17 3c-1.5 2-2 4-2 6s.5 3 2 3 2-1 2-3-.5-4-2-6Z"/><path d="M17 12v9"/></svg>',
  drink: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h12l-1.5 8.5a5 5 0 0 1-9 0L6 4Z"/><path d="M12 17v4"/><path d="M8 21h8"/></svg>',
  do: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 3 20h18L12 3Z"/><path d="M12 12 7 20h10l-5-8Z"/></svg>',
  camp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18Z"/></svg>',
  tick: '<svg viewBox="0 0 24 24" fill="none" stroke="#F4F8F0" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5 9.5 18 20 6.5"/></svg>',
  tickGreen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5 9.5 18 20 6.5"/></svg>',
  x: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  plus: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
}

// ---- state ------------------------------------------------------------------

const S = {
  view: 'boot',      // boot | landing | join | trip | missing
  tab: 'pack',
  section: 'shared', // which half of the current list is on screen
  trip: null, members: [], items: [], events: [],
  catalog: null, tips: [],
  me: null,          // member id
  rev: 0,
  sheet: null,       // { kind, ...payload }
  busy: false,
  editNotes: false,  // the shared notes read as text until you ask to change them
  expand: { tips: false, feed: false },
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
  const res = await fetch(`/api${path}`, { ...opts, headers, body: opts.body ? JSON.stringify(opts.body) : undefined })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Something went wrong. Try again.')
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

// Personal kit exists as a section for any list the catalogue has one-each
// suggestions for, even before the trip has added one — otherwise there is
// nowhere to go looking for it.
const hasOwnSection = (list) =>
  itemsIn(list).some(isOwn) || (S.catalog?.[list] ?? []).some((c) => c.own)

// The section actually on screen, which is 'shared' for any list that has no
// personal half at all.
function activeSection() {
  const list = TABS.find((t) => t.id === S.tab)?.list
  return list && hasOwnSection(list) ? S.section : 'shared'
}

// Each section answers a different question, so each gets its own tally.
// Plans are not "brought" by anyone, so they are counted by interest instead.
function statsFor(list) {
  const items = list ? itemsIn(list) : S.items
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
      if (it.assignee_id && memberById(it.assignee_id)) {
        perMember.set(it.assignee_id, (perMember.get(it.assignee_id) ?? 0) + 1)
      } else open++
    }
  }
  return { shared, open, claimed: shared - open, perMember, own, mine, ideas, wanted }
}

function groupByCategory(items) {
  const groups = new Map()
  for (const it of items) {
    const key = it.category || 'Other'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(it)
  }
  return [...groups.entries()]
}

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
function barParts(list, section) {
  const c = statsFor(list)
  const seg = (flex, bg) => `<div class="coverage__seg" style="flex:${flex};background:${bg}"></div>`

  if (list === 'activities') {
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
    .map(([id, n]) => `<div class="coverage__seg" style="flex:${n};background:${colorOf(memberById(id))}"
           title="${esc(memberById(id).name)}: ${n}"></div>`).join('')

  return {
    segs: `${segs}${c.open > 0 ? `<div class="coverage__seg coverage__seg--gap" style="flex:${c.open}"></div>` : ''}`,
    say: c.open === 0 ? `<b>All ${c.shared} covered.</b>` : `<b>${c.open}</b> need someone`,
    aria: `${c.claimed} of ${c.shared} claimed`,
  }
}

// One bar, one line, for whichever section is on screen. It reads left to right:
// how much is handled, then how much is not.
function coverageBar(list, section) {
  const p = barParts(list, section)
  return `
    <div class="cov">
      <div class="cov__track" role="img" aria-label="${p.aria}">
        ${p.empty ? `<span class="cov__empty">${p.empty}</span>` : p.segs}</div>
      <p class="cov__say">${p.say}</p>
    </div>`
}

// The section switcher lives in the sticky header, so the other half of the
// list is always one tap away rather than a scroll away.
function sectionSwitch(list) {
  if (!hasOwnSection(list)) return ''
  const c = statsFor(list)
  const chip = (key, outstanding) => `
    <button class="switch__btn" data-act="section" data-section="${key}" aria-pressed="${S.section === key}">
      ${SECTIONS[key].label}${outstanding ? `<span class="switch__n">${outstanding}</span>` : ''}</button>`
  return `<div class="switch" role="group" aria-label="Which kit">${chip('shared', c.open)}${chip('own', c.own - c.mine)}</div>`
}

function assignChip(item) {
  const m = memberById(item.assignee_id)
  if (m) {
    const mine = m.id === S.me ? ' chip--mine' : ''
    return `<button class="chip chip--taken${mine}" style="background:${colorOf(m)}" data-act="assign" data-id="${item.id}">
              <span class="chip__dot"></span>${esc(m.name)} is bringing it</button>`
  }
  return `<button class="chip chip--open" data-act="assign" data-id="${item.id}">Nobody's bringing this</button>`
}

// Step two, and only ever step two: you cannot pack a thing nobody is bringing,
// so this appears once the item has an owner. Always labelled, never a bare box.
function packToggle(item) {
  return `
    <button class="stage${item.packed ? ' stage--done' : ''}" data-act="pack" data-id="${item.id}" aria-pressed="${item.packed}">
      <span class="stage__box">${ICONS.tick}</span>${item.packed ? 'Packed' : 'Not packed yet'}</button>`
}

function ownToggle(item) {
  const mine = !!S.me && item.own.includes(S.me)
  const me = meMember()
  return `
    <button class="stage${mine ? ' stage--done' : ''}" data-act="own" data-id="${item.id}" aria-pressed="${mine}">
      <span class="stage__box"${mine && me ? ` style="background:${colorOf(me)}"` : ''}>${ICONS.tick}</span>${mine ? "Mine's packed" : "I've not packed mine"}</button>`
}

// Nobody "brings" a hike, so a plan never shows the orange chip. An organiser is
// optional and only for the plans that need booking or kit.
function organiserChip(item) {
  const m = memberById(item.assignee_id)
  if (!m) return `<button class="tag" data-act="assign" data-id="${item.id}">Add an organiser</button>`
  const mine = m.id === S.me ? ' chip--mine' : ''
  return `<button class="chip chip--taken${mine}" style="background:${colorOf(m)}" data-act="assign" data-id="${item.id}">
            <span class="chip__dot"></span>${esc(m.name)} is organising</button>`
}

function itemRow(item) {
  const own = isOwn(item)
  const done = own ? isMine(item) : item.packed

  let controls
  if (isPlan(item)) {
    const voted = item.votes.includes(S.me)
    controls = `
      <button class="chip chip--vote" data-act="vote" data-id="${item.id}" aria-pressed="${voted}">
        ${voted ? 'Up for it' : 'I want this'} <span class="mono">${item.votes.length}</span></button>
      ${organiserChip(item)}`
  } else if (own) {
    controls = `${ownToggle(item)}
      <button class="tag" data-act="move-kind" data-id="${item.id}" data-kind="shared">Move to group</button>`
  } else {
    controls = `${assignChip(item)}${item.assignee_id && memberById(item.assignee_id) ? packToggle(item) : ''}`
  }

  return `
    <li class="item${done ? ' item--packed' : ''}">
      <div class="item__main">
        <div class="item__title">${esc(item.title)}${item.qty ? `<span class="item__qty">${esc(item.qty)}</span>` : ''}</div>
        ${item.note ? `<p class="item__note">${esc(item.note)}</p>` : ''}
        <div class="item__row">${controls}</div>
      </div>
      <button class="item__kill" data-act="kill" data-id="${item.id}" aria-label="Remove ${esc(item.title)}">${ICONS.x}</button>
    </li>`
}

// ---- views ------------------------------------------------------------------

function viewLanding() {
  return `
  <div class="landing">
    <header class="landing__hero">
      <div class="landing__inner">
        <span class="eyebrow">Camping Sync</span>
        <h1>Who's bringing<br>the <em>tent?</em></h1>
        <p>One shared list for gear, food, drinks and plans. It keeps the tent one person brings apart from the sleeping bag you each need your own of, and the gaps stay visible until somebody fills them.</p>
        <div class="demo-bar" aria-hidden="true">
          <div class="demo-bar__label"><span>Sample packing list</span><span>9/14 claimed</span></div>
          <div class="demo-bar__track">
            <div class="demo-bar__seg" style="flex:4;background:#2F6B57"></div>
            <div class="demo-bar__seg" style="flex:3;background:#37698F"></div>
            <div class="demo-bar__seg" style="flex:2;background:#7A5AA6"></div>
            <div class="demo-bar__seg demo-bar__seg--gap"></div>
          </div>
        </div>
      </div>
    </header>

    <main class="landing__body">
      <div class="landing__card">
        <h2>Start a trip</h2>
        <p>Takes about twenty seconds. You'll get a link to send your friends — no accounts, no app to install.</p>
        <form data-act="create">
          <label class="field"><span>Your name</span>
            <input name="organiser" placeholder="Josh" autocomplete="given-name" required maxlength="40"></label>
          <label class="field"><span>Trip name</span>
            <input name="name" placeholder="First camping trip" required maxlength="80"></label>
          <label class="field"><span>Where</span>
            <input name="location" placeholder="Somewhere with a lake" maxlength="120"></label>
          <div class="field field--split">
            <label class="field"><span>Arrive</span><input type="date" name="start_date"></label>
            <label class="field"><span>Leave</span><input type="date" name="end_date"></label>
          </div>
          <button class="btn btn--primary btn--wide" type="submit">Create the trip</button>
        </form>
      </div>
      <p class="landing__join">Got a code from a friend? Open the link they sent, or add it to the end of this address.</p>
    </main>
  </div>`
}

function viewJoin() {
  return `
  <div class="landing">
    <header class="landing__hero">
      <div class="landing__inner">
        <span class="eyebrow">You've been invited</span>
        <h1>${esc(S.trip.name)}</h1>
        <p>${esc([S.trip.location, fmtDates(S.trip)].filter(Boolean).join(' · ') || 'Add yourself and start claiming things.')}</p>
      </div>
    </header>
    <main class="landing__body">
      <div class="landing__card">
        <h2>Who are you?</h2>
        <p>Your name shows up next to everything you're bringing, so the others know it's handled.</p>
        <form data-act="join">
          <label class="field"><span>Name</span>
            <input name="name" placeholder="Sam" autocomplete="given-name" required maxlength="40" autofocus></label>
          <button class="btn btn--primary btn--wide" type="submit">Join the trip</button>
        </form>
      </div>
    </main>
  </div>`
}

function topbar() {
  const meta = [S.trip.location, fmtDates(S.trip)].filter(Boolean).map(esc)
  meta.push(`${S.members.length} ${S.members.length === 1 ? 'person' : 'people'}`)
  const list = TABS.find((t) => t.id === S.tab)?.list ?? null
  return `
    <header class="topbar${list ? '' : ' topbar--bare'}">
      <div class="topbar__row">
        <div class="topbar__title">
          <h1>${esc(S.trip.name)}</h1>
          <p class="topbar__meta">${meta.join(' · ')}</p>
        </div>
        <button class="topbar__share" data-act="share">Invite</button>
      </div>
      ${list ? `${sectionSwitch(list)}${coverageBar(list, activeSection())}` : ''}
    </header>`
}

function categoryGroups(items, section) {
  return groupByCategory(items).map(([cat, list]) => {
    const tally = section === 'own'
      ? `${list.filter(isMine).length}/${list.length} packed`
      : `${list.filter((i) => i.assignee_id && memberById(i.assignee_id)).length}/${list.length}`
    return `
      <section class="group">
        <div class="group__head"><h3>${esc(cat)}</h3>
          <span class="group__tally">${list[0] && isPlan(list[0]) ? `${list.length}` : tally}</span></div>
        <ul class="items">${list.map(itemRow).join('')}</ul>
      </section>`
  }).join('')
}

function listPage(tab) {
  // Only one section is ever on screen, so the switcher in the header is the
  // whole navigation for it — no scrolling to find the other half.
  const section = activeSection()
  const items = itemsIn(tab.list).filter((i) => (section === 'own') === isOwn(i))
  const note = hasOwnSection(tab.list) ? SECTIONS[section].note : tab.note

  const body = items.length === 0
    ? `<div class="empty">
         <h3>${section === 'own' ? 'No personal kit listed yet' : 'Nothing here yet'}</h3>
         <p>${section === 'own'
            ? 'These are the things nobody can bring for you — a sleeping bag, a headtorch, your own boots.'
            : 'Pull in the usual suspects, or write your own.'}</p>
         <button class="btn btn--blaze" data-act="suggest">What am I missing?</button>
       </div>`
    : categoryGroups(items, section)

  return `
    <main class="page">
      ${note ? `<p class="page__note">${esc(note)}</p>` : ''}
      <div class="actions">
        <button class="btn btn--blaze" data-act="suggest">What am I missing?</button>
        <button class="btn" data-act="add">${ICONS.plus} Add your own</button>
      </div>
      ${body}
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
  const p = barParts(tab.list, 'shared')
  return `
    <button class="ready__row" data-act="tab" data-tab="${tab.id}">
      <span class="ready__name">${tab.label}</span>
      <span class="ready__track" role="img" aria-label="${tab.title}: ${p.aria}">${p.empty ? '' : p.segs}</span>
      <span class="ready__say">${p.empty ? '<span class="ready__none">nothing yet</span>' : (p.short ?? p.say)}</span>
    </button>`
}

function statusCard() {
  const c = countdown(S.trip)
  const mine = statsFor(null)
  return `
    <div class="card status">
      <span class="eyebrow">How it's looking</span>
      <p class="countdown">
        ${c?.n ? `<span class="countdown__n">${c.n}</span><span class="countdown__word">${c.word}</span>`
               : `<span class="countdown__word countdown__word--alone">${c ? c.word : 'No dates yet'}</span>`}
      </p>
      <div class="ready">${TABS.filter((t) => t.list).map(readyRow).join('')}</div>
      ${mine.own ? `<p class="status__mine">Your own kit: <b>${mine.mine} of ${mine.own}</b> packed. Nobody else can see this.</p>` : ''}
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
    if (isOwn(it) || isPlan(it) || !it.assignee_id || !memberById(it.assignee_id)) continue
    load.set(it.assignee_id, (load.get(it.assignee_id) ?? 0) + 1)
    if (it.packed) packed.set(it.assignee_id, (packed.get(it.assignee_id) ?? 0) + 1)
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
      ${notesCard()}
      ${peopleCard()}

      <div class="card">
        <h3>Trip details</h3>
        <form data-act="save-trip">
          <label class="field"><span>Trip name</span><input name="name" value="${esc(S.trip.name)}" maxlength="80"></label>
          <label class="field"><span>Where</span><input name="location" value="${esc(S.trip.location)}" maxlength="120"></label>
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

function tabbar() {
  return `
    <nav class="tabbar" aria-label="Sections">
      ${TABS.map((t) => {
        // Only the group's unanswered questions. Your own packing is your business,
        // and it already has a count on the section switcher.
        const open = t.list ? statsFor(t.list).open : 0
        return `<button class="tabbar__btn" data-act="tab" data-tab="${t.id}"
                  ${S.tab === t.id ? 'aria-current="page"' : ''}>
                  <span class="tabbar__icon">${ICONS[t.id]}${open ? `<span class="tabbar__flag">${open}</span>` : ''}</span>
                  <span>${t.label}</span>
                </button>`
      }).join('')}
    </nav>`
}

function viewTrip() {
  const tab = TABS.find((t) => t.id === S.tab) ?? TABS[0]
  return `<div class="app">${topbar()}${tab.list ? listPage(tab) : campPage()}</div>${tabbar()}`
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

function sheetAssign(s) {
  const item = S.items.find((i) => i.id === s.id)
  if (!item) return ''
  const me = meMember()
  const own = isOwn(item)

  const kindSwitch = isPlan(item) ? '' : `
    <div class="segmented" role="group" aria-label="How this gets brought">
      <button class="segmented__btn" aria-pressed="${!own}" data-act="set-kind" data-id="${item.id}" data-kind="shared">
        ${SECTIONS.shared.label}</button>
      <button class="segmented__btn" aria-pressed="${own}" data-act="set-kind" data-id="${item.id}" data-kind="own">
        ${SECTIONS.own.label}</button>
    </div>`

  if (own) {
    return sheetShell({
      title: item.title,
      blurb: 'Everyone brings their own one, and only you can see whether yours is packed.',
      body: `${kindSwitch}
        <button class="pick" data-act="own" data-id="${item.id}" aria-pressed="${isMine(item)}">
          <span class="pick__swatch" style="background:${colorOf(me)}"></span>
          <span class="pick__main"><span class="pick__title">Mine is packed</span>
            <span class="pick__note">${isMine(item) ? 'Ticked off.' : 'Not yet.'}</span></span>
          <span class="pick__tick">${ICONS.tickGreen}</span>
        </button>`,
    })
  }

  const rows = S.members.map((m) => `
    <button class="pick" data-act="set-assignee" data-id="${item.id}" data-member="${m.id}"
            aria-pressed="${item.assignee_id === m.id}">
      <span class="pick__swatch" style="background:${colorOf(m)}"></span>
      <span class="pick__main"><span class="pick__title">${esc(m.name)}${m.id === S.me ? ' (you)' : ''}</span></span>
      <span class="pick__tick">${ICONS.tickGreen}</span>
    </button>`).join('')

  const plan = isPlan(item)
  return sheetShell({
    title: plan ? `Who's organising ${item.title}?` : `Who's bringing ${item.title}?`,
    blurb: plan
      ? 'Optional — only for the plans that need someone to book it or bring the kit.'
      : 'One person brings it for everyone.',
    body: `
      ${kindSwitch}
      ${me ? `<button class="btn btn--primary btn--wide" style="margin-bottom:14px" data-act="set-assignee" data-id="${item.id}" data-member="${me.id}">${plan ? "I'll organise it" : "I'll bring it"}</button>` : ''}
      ${rows}
      <button class="pick" data-act="set-assignee" data-id="${item.id}" data-member=""
              aria-pressed="${!item.assignee_id}" style="margin-top:10px">
        <span class="pick__swatch${plan ? '' : ' legend__dot--gap'}"${plan ? ' style="background:var(--line-strong)"' : ''}></span>
        <span class="pick__main"><span class="pick__title">${plan ? 'Nobody needs to' : 'Nobody yet'}</span>
          <span class="pick__note">${plan ? 'Most plans do not need an organiser.' : 'Leave it open and it stays orange on the bar.'}</span></span>
        <span class="pick__tick">${ICONS.tickGreen}</span>
      </button>
      <div style="margin-top:18px">
        <form data-act="add-member">
          <label class="field"><span>Someone not on the list?</span>
            <input name="name" placeholder="Add a person" maxlength="40"></label>
          <button class="btn btn--wide btn--sm" type="submit">Add them</button>
        </form>
      </div>`,
  })
}

function sheetAdd(s) {
  const tab = TABS.find((t) => t.list === s.list)
  const cats = [...new Set([...itemsIn(s.list).map((i) => i.category), ...(S.catalog?.[s.list] ?? []).map((c) => c.cat)])].filter(Boolean)
  return sheetShell({
    title: `Add to ${tab.title.toLowerCase()}`,
    body: `
      <form data-act="add-item" data-list="${s.list}">
        <label class="field"><span>What is it?</span>
          <input name="title" required maxlength="120" autofocus placeholder="${s.list === 'food' ? 'Sausages' : s.list === 'activities' ? 'Sunrise walk to the ridge' : 'Bottle opener'}"></label>
        <div class="field--split" style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <label class="field"><span>Group</span>
            <input name="category" list="cs-cats" maxlength="60" placeholder="${esc(cats[0] ?? 'Other')}"></label>
          <label class="field"><span>How much <span style="font-weight:400">(optional)</span></span>
            <input name="qty" maxlength="40" placeholder="x2"></label>
        </div>
        <datalist id="cs-cats">${cats.map((c) => `<option value="${esc(c)}">`).join('')}</datalist>
        <label class="field"><span>Note <span style="font-weight:400">(optional)</span></span>
          <input name="note" maxlength="500" placeholder="Anything the others need to know"></label>
        ${s.list === 'activities' ? '' : `
          <div class="field">
            <span>Who brings it?</span>
            <div class="segmented" role="group" aria-label="Who brings it">
              <button type="button" class="segmented__btn" aria-pressed="${s.section !== 'own'}" data-act="pick-kind" data-kind="shared">
                ${SECTIONS.shared.label}</button>
              <button type="button" class="segmented__btn" aria-pressed="${s.section === 'own'}" data-act="pick-kind" data-kind="own">
                ${SECTIONS.own.label}</button>
            </div>
            <input type="hidden" name="kind" value="${s.section === 'own' ? 'own' : 'shared'}">
          </div>`}
        <button class="btn btn--primary btn--wide" type="submit">Add it</button>
      </form>`,
  })
}

function sheetSuggest(s) {
  const tab = TABS.find((t) => t.list === s.list)
  const have = new Set(itemsIn(s.list).map((i) => i.title.toLowerCase()))
  // Suggest into the section you are standing in, so the two never get mixed up.
  const pool = (S.catalog?.[s.list] ?? [])
    .filter((c) => !have.has(c.title.toLowerCase()) && !!c.own === (s.section === 'own'))
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
        <button class="pick" data-act="toggle-pick" data-title="${esc(c.title)}" data-cat="${esc(c.cat)}"
                data-note="${esc(c.note ?? '')}" aria-pressed="${picked.has(c.title)}">
          <span class="pick__main">
            <span class="pick__title">${esc(c.title)}</span>
            ${c.note ? `<span class="pick__note">${esc(c.note)}</span>` : ''}
          </span>
          <span class="pick__tick">${ICONS.tickGreen}</span>
        </button>`).join('')}
    </div>`).join('')

  return sheetShell({
    title: 'What am I missing?',
    blurb: `${pool.length} ${s.section === 'own' ? 'things people bring one each of' : 'things people usually bring'} that aren't on your list yet. Tap the ones you want.`,
    body,
    foot: `<button class="btn btn--primary btn--wide" data-act="add-picked" ${picked.size ? '' : 'disabled'}>
             ${picked.size ? `Add ${picked.size} ${picked.size === 1 ? 'thing' : 'things'}` : 'Pick some things'}</button>`,
  })
}

function renderSheet() {
  if (!S.sheet) { sheetRoot.innerHTML = ''; return }
  const map = { assign: sheetAssign, add: sheetAdd, suggest: sheetSuggest }
  sheetRoot.innerHTML = map[S.sheet.kind]?.(S.sheet) ?? ''
}

// ---- render -----------------------------------------------------------------

function render() {
  const y = window.scrollY
  const views = { landing: viewLanding, join: viewJoin, trip: viewTrip }
  root.innerHTML = views[S.view]?.() ?? '<div class="page"><p>Loading…</p></div>'
  renderSheet()
  if (S.view === 'trip') window.scrollTo(0, y)
}

// ---- actions ----------------------------------------------------------------

const meKey = (tripId) => `cs.me.${tripId}`

async function openTrip(code) {
  try {
    const state = await api(`/trips/${encodeURIComponent(code)}`)
    S.me = localStorage.getItem(meKey(code))
    if (S.me && !state.members.some((m) => m.id === S.me)) S.me = null
    S.view = S.me ? 'trip' : 'join'
    absorb(state)
  } catch (err) {
    toast(err.message)
    S.view = 'landing'
    render()
  }
}

document.addEventListener('click', async (ev) => {
  const el = ev.target.closest('[data-act]')
  if (!el) return
  const act = el.dataset.act
  if (el.tagName === 'BUTTON' && el.type !== 'submit') ev.preventDefault()

  switch (act) {
    case 'tab':
      S.tab = el.dataset.tab
      S.section = 'shared'
      render()
      window.scrollTo(0, 0)
      break

    case 'section':
      S.section = el.dataset.section
      render()
      window.scrollTo(0, 0)
      break

    case 'expand':
      S.expand[el.dataset.what] = !S.expand[el.dataset.what]
      render()
      break

    case 'edit-notes':
      S.editNotes = true
      render()
      break

    case 'move-kind':
      await mutate(() => api(`/items/${el.dataset.id}`, { method: 'PATCH', body: { kind: el.dataset.kind } }))
      toast(el.dataset.kind === 'shared' ? 'Moved to the group list.' : 'Moved to personal kit.')
      break

    case 'scrim':
      if (ev.target !== el) break
      S.sheet = null; renderSheet(); break

    case 'close-sheet':
      S.sheet = null; renderSheet(); break

    case 'pack': {
      const it = S.items.find((i) => i.id === el.dataset.id)
      mutate(() => api(`/items/${it.id}`, { method: 'PATCH', body: { packed: !it.packed } }))
      break
    }

    case 'own':
      if (!S.me) { toast('Join the trip first.'); break }
      mutate(() => api(`/items/${el.dataset.id}/own`, { method: 'POST', body: { memberId: S.me } }))
      break

    case 'set-kind':
      // The sheet stays open, so you see the model you just chose.
      await mutate(() => api(`/items/${el.dataset.id}`, { method: 'PATCH', body: { kind: el.dataset.kind } }))
      break

    case 'pick-kind': {
      const box = el.closest('.segmented')
      for (const b of box.querySelectorAll('.segmented__btn')) b.setAttribute('aria-pressed', b === el)
      box.parentElement.querySelector('input[name="kind"]').value = el.dataset.kind
      break
    }

    case 'vote':
      if (!S.me) { toast('Join the trip first.'); break }
      mutate(() => api(`/items/${el.dataset.id}/vote`, { method: 'POST', body: { memberId: S.me } }))
      break

    case 'kill': {
      const it = S.items.find((i) => i.id === el.dataset.id)
      if (it && confirm(`Remove "${it.title}" from the list?`)) {
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

    case 'assign':
      S.sheet = { kind: 'assign', id: el.dataset.id }
      renderSheet()
      break

    case 'set-assignee':
      S.sheet = null
      renderSheet()
      await mutate(() => api(`/items/${el.dataset.id}`, { method: 'PATCH', body: { assignee_id: el.dataset.member || '' } }))
      break

    // Both open into whichever section you are looking at.
    case 'add':
      S.sheet = { kind: 'add', list: TABS.find((t) => t.id === S.tab).list, section: activeSection() }
      renderSheet()
      break

    case 'suggest':
      S.sheet = { kind: 'suggest', list: TABS.find((t) => t.id === S.tab).list, section: activeSection(), picked: new Set() }
      renderSheet()
      break

    case 'toggle-pick': {
      const t = el.dataset.title
      S.sheet.picked.has(t) ? S.sheet.picked.delete(t) : S.sheet.picked.add(t)
      el.setAttribute('aria-pressed', S.sheet.picked.has(t))
      const foot = sheetRoot.querySelector('[data-act="add-picked"]')
      const n = S.sheet.picked.size
      foot.disabled = !n
      foot.textContent = n ? `Add ${n} ${n === 1 ? 'thing' : 'things'}` : 'Pick some things'
      break
    }

    case 'add-picked': {
      const { list, picked } = S.sheet
      const wanted = (S.catalog[list] ?? []).filter((c) => picked.has(c.title))
      S.sheet = null
      renderSheet()
      await mutate(() => api(`/trips/${S.trip.id}/items`, {
        method: 'POST',
        body: { items: wanted.map((c) => ({ list, category: c.cat, title: c.title, note: c.note ?? '', kind: c.own ? 'own' : 'shared' })) },
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
    case 'create': {
      try {
        const { trip, memberId } = await api('/trips', { method: 'POST', body: f })
        if (memberId) localStorage.setItem(meKey(trip.id), memberId)
        S.me = memberId
        S.view = 'trip'
        S.tab = 'pack'
        history.pushState({}, '', `/t/${trip.id}`)
        absorb(await api(`/trips/${trip.id}`))
        toast('Trip created. Send the link to your friends.')
      } catch (err) { toast(err.message) }
      break
    }

    case 'join': {
      try {
        const { member } = await api(`/trips/${S.trip.id}/members`, { method: 'POST', body: { name: f.name } })
        localStorage.setItem(meKey(S.trip.id), member.id)
        S.me = member.id
        S.view = 'trip'
        absorb(await api(`/trips/${S.trip.id}`))
      } catch (err) { toast(err.message) }
      break
    }

    case 'add-member': {
      if (!String(f.name).trim()) break
      const itemId = S.sheet?.id
      try {
        await api(`/trips/${S.trip.id}/members`, { method: 'POST', body: { name: f.name } })
        absorb(await api(`/trips/${S.trip.id}`))
        S.sheet = { kind: 'assign', id: itemId }
        renderSheet()
      } catch (err) { toast(err.message) }
      break
    }

    case 'add-item': {
      const list = form.dataset.list
      S.sheet = null
      renderSheet()
      await mutate(() => api(`/trips/${S.trip.id}/items`, {
        method: 'POST',
        body: { list, title: f.title, category: f.category || 'Other', qty: f.qty, note: f.note, kind: f.kind },
      }))
      break
    }

    case 'save-trip':
      await mutate(() => api(`/trips/${S.trip.id}`, { method: 'PATCH', body: f }))
      toast('Saved.')
      break

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

// The sticky header carries the trip name and dates, which you only need on
// arrival. Once you start scrolling it collapses to the switcher and the bar.
// The class goes on <html> so a re-render can't lose it.
let tight = false
addEventListener('scroll', () => {
  const now = window.scrollY > 24
  if (now === tight) return
  tight = now
  document.documentElement.classList.toggle('is-scrolled', now)
}, { passive: true })

// ---- boot -------------------------------------------------------------------

async function boot() {
  try {
    const { catalog, tips } = await api('/catalog')
    S.catalog = catalog
    S.tips = tips
  } catch { /* the app still works without suggestions */ }

  const m = location.pathname.match(/^\/t\/([^/]+)/)
  if (m) await openTrip(decodeURIComponent(m[1]))
  else { S.view = 'landing'; render() }
}

boot()
