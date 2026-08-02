/* Camping Sync — client. Vanilla, no build step.
   Rendering is string-based with one delegated click handler; every mutation
   returns the whole trip state, so there is exactly one source of truth. */

const MEMBER_COLORS = ['#2F6B57', '#37698F', '#7A5AA6', '#8C6A2F', '#B23C6B', '#4E7A2A', '#2E6E77', '#6B5B4A']

const TABS = [
  { id: 'pack', list: 'gear', label: 'Pack', title: 'Packing list', blurb: 'Two sections: kit one person brings for everyone, and kit you each bring your own of. Say who is bringing what first, then tick things off as they go in the bag.' },
  { id: 'eat', list: 'food', label: 'Eat', title: 'Food', blurb: 'Plan it by meal. Whoever claims a meal buys for it — that is the whole trick.' },
  { id: 'drink', list: 'drinks', label: 'Drink', title: 'Drinks', blurb: 'Water first. Roughly 1 gallon / 4L per person per day if the site has no taps.' },
  { id: 'do', list: 'activities', label: 'Do', title: 'Plans', blurb: 'Ideas anyone can add. Vote for what you actually want to do, and claim the ones that need organising.' },
  { id: 'camp', list: null, label: 'Camp', title: 'The trip', blurb: '' },
]

// The two ways a thing gets brought. This distinction runs through the whole app.
const BLOCKS = {
  shared: { label: 'Brought for the group', note: 'One person brings each of these, and everyone uses it.' },
  own: { label: 'Everyone brings their own', note: 'One each — nobody can cover these for you. Tick off yours when it is packed.' },
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
  trip: null, members: [], items: [], events: [],
  catalog: null, tips: [],
  me: null,          // member id
  rev: 0,
  sheet: null,       // { kind, ...payload }
  busy: false,
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
const allHaveTheirs = (it) => S.members.length > 0 && S.members.every((m) => it.own.includes(m.id))

// Two different questions, so two different tallies: has somebody claimed the
// group kit, and have you packed your own.
function coverageFor(list) {
  const items = list ? itemsIn(list) : S.items
  const perMember = new Map()
  const ownPerMember = new Map()
  let shared = 0, open = 0, own = 0, mine = 0

  for (const it of items) {
    if (isOwn(it)) {
      own++
      if (S.me && it.own.includes(S.me)) mine++
      for (const id of it.own) ownPerMember.set(id, (ownPerMember.get(id) ?? 0) + 1)
    } else {
      shared++
      if (it.assignee_id && memberById(it.assignee_id)) {
        perMember.set(it.assignee_id, (perMember.get(it.assignee_id) ?? 0) + 1)
      } else open++
    }
  }
  return {
    shared, open, claimed: shared - open, perMember,
    own, mine, ownPerMember,
    todo: open + (own - mine),
  }
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

function coverageBar(list) {
  const c = coverageFor(list)

  if (c.shared === 0 && c.own === 0) {
    return `
      <div class="coverage">
        <div class="cov">
          <div class="cov__head"><span class="cov__label">This list</span></div>
          <div class="coverage__track"><span class="coverage__empty">nothing on it yet</span></div>
        </div>
      </div>`
  }

  const bars = []

  if (c.shared) {
    const segs = [...c.perMember.entries()]
      .map(([id, n]) => `<div class="coverage__seg" style="flex:${n};background:${colorOf(memberById(id))}"
             title="${esc(memberById(id).name)}: ${n}"></div>`).join('')
    const gap = c.open > 0
      ? `<div class="coverage__seg coverage__seg--gap" style="flex:${c.open}" title="${c.open} with nobody bringing them"></div>` : ''

    const noun = list === 'activities' ? 'ideas' : 'things'
    const say = c.open === 0
      ? `<b>All ${c.shared} covered.</b> Nice.`
      : `<b>${c.open} ${c.open === 1 ? (list === 'activities' ? 'idea has' : 'thing has') : `${noun} have`}</b> nobody bringing ${c.open === 1 ? 'it' : 'them'}.`

    const legend = [...c.perMember.entries()].map(([id, n]) => {
      const m = memberById(id)
      return `<span class="legend__item"><span class="legend__dot" style="background:${colorOf(m)}"></span>${esc(m.name)} <span class="mono">${n}</span></span>`
    }).join('')

    bars.push(`
      <div class="cov">
        <div class="cov__head">
          <span class="cov__label">${BLOCKS.shared.label}</span>
          <span class="cov__count">${c.claimed}/${c.shared} claimed</span>
        </div>
        <div class="coverage__track" role="img" aria-label="${c.claimed} of ${c.shared} claimed">${segs}${gap}</div>
        <p class="cov__say">${say}</p>
        <div class="legend">${legend}${c.open ? `<span class="legend__item"><span class="legend__dot legend__dot--gap"></span>Nobody <span class="mono">${c.open}</span></span>` : ''}</div>
      </div>`)
  }

  if (c.own) {
    const me = meMember()
    const left = c.own - c.mine
    const mineSeg = c.mine ? `<div class="coverage__seg" style="flex:${c.mine};background:${colorOf(me)}"></div>` : ''
    const gap = left ? `<div class="coverage__seg coverage__seg--gap" style="flex:${left}"></div>` : ''

    // How everyone else is doing on their own kit — the answer to "is Sam ready?"
    const legend = S.members.filter((m) => m.id !== S.me).map((m) => {
      const n = c.ownPerMember.get(m.id) ?? 0
      return `<span class="legend__item"><span class="legend__dot" style="background:${colorOf(m)}"></span>${esc(m.name)} <span class="mono">${n}/${c.own}</span></span>`
    }).join('')

    bars.push(`
      <div class="cov">
        <div class="cov__head">
          <span class="cov__label">Your own kit</span>
          <span class="cov__count">${c.mine}/${c.own} packed</span>
        </div>
        <div class="coverage__track" role="img" aria-label="you have packed ${c.mine} of ${c.own}">${mineSeg}${gap}</div>
        <p class="cov__say">${left === 0
          ? '<b>Yours is all packed.</b>' : `<b>${left} of your own ${left === 1 ? 'thing' : 'things'}</b> still to pack.`}</p>
        ${legend ? `<div class="legend">${legend}</div>` : ''}
      </div>`)
  }

  return `<div class="coverage">${bars.join('')}</div>`
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

// Everyone else's progress on a one-each item, so you can see who is still short.
function ownDots(item) {
  const others = S.members.filter((m) => m.id !== S.me)
  if (!others.length) return ''
  return `<span class="whos">${others.map((m) => {
    const done = item.own.includes(m.id)
    return `<span class="whos__dot${done ? ' is-done' : ''}"${done ? ` style="background:${colorOf(m)}"` : ''}
                  title="${esc(m.name)}: ${done ? 'packed' : 'not packed yet'}">${esc(m.name.slice(0, 1).toUpperCase())}</span>`
  }).join('')}</span>`
}

function itemRow(item) {
  const isPlan = item.list === 'activities'
  const own = isOwn(item)
  const done = own ? allHaveTheirs(item) : item.packed

  let controls
  if (isPlan) {
    const voted = item.votes.includes(S.me)
    controls = `
      <button class="chip chip--vote" data-act="vote" data-id="${item.id}" aria-pressed="${voted}">
        ${voted ? 'Up for it' : 'I want this'} <span class="mono">${item.votes.length}</span></button>
      ${assignChip(item)}`
  } else if (own) {
    controls = `${ownToggle(item)}${ownDots(item)}
      <button class="tag" data-act="assign" data-id="${item.id}">One each · change</button>`
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
  return `
    <header class="topbar">
      <div class="topbar__row">
        <div class="topbar__title">
          <h1>${esc(S.trip.name)}</h1>
          <div class="topbar__meta">${meta.map((m) => `<span>${m}</span>`).join('')}</div>
        </div>
        <button class="topbar__share" data-act="share">Invite</button>
      </div>
      ${coverageBar(TABS.find((t) => t.id === S.tab)?.list ?? null)}
    </header>`
}

function categoryGroups(items, kind) {
  return groupByCategory(items).map(([cat, list]) => {
    const tally = kind === 'own'
      ? `you ${list.filter((i) => S.me && i.own.includes(S.me)).length}/${list.length}`
      : `${list.filter((i) => i.assignee_id && memberById(i.assignee_id)).length}/${list.length}`
    return `
      <section class="group">
        <div class="group__head"><h3>${esc(cat)}</h3><span class="group__tally">${tally}</span></div>
        <ul class="items">${list.map(itemRow).join('')}</ul>
      </section>`
  }).join('')
}

function listPage(tab) {
  const items = itemsIn(tab.list)
  const shared = items.filter((i) => !isOwn(i))
  const own = items.filter(isOwn)

  let body
  if (items.length === 0) {
    body = `<div class="empty">
         <h3>Nothing here yet</h3>
         <p>Pull in the usual suspects, or write your own.</p>
         <button class="btn btn--blaze" data-act="suggest">What am I missing?</button>
       </div>`
  } else if (own.length === 0) {
    body = categoryGroups(shared, 'shared')
  } else {
    // Once a list has both, name them. The split is the point.
    const block = (kind, list) => list.length ? `
      <section class="block block--${kind}">
        <div class="block__head">
          <h3>${BLOCKS[kind].label}</h3>
          <p>${BLOCKS[kind].note}</p>
        </div>
        ${categoryGroups(list, kind)}
      </section>` : ''
    body = block('shared', shared) + block('own', own)
  }

  return `
    <main class="page">
      <div class="page__head">
        <span class="eyebrow">${esc(tab.label)}</span>
        <h2>${esc(tab.title)}</h2>
        <p>${esc(tab.blurb)}</p>
      </div>
      <div class="actions">
        <button class="btn btn--blaze" data-act="suggest">What am I missing?</button>
        <button class="btn" data-act="add">${ICONS.plus} Add your own</button>
      </div>
      ${body}
    </main>`
}

function campPage() {
  const load = new Map()
  const ownDone = new Map()
  let ownTotal = 0
  for (const it of S.items) {
    if (isOwn(it)) {
      ownTotal++
      for (const id of it.own) ownDone.set(id, (ownDone.get(id) ?? 0) + 1)
    } else if (it.assignee_id) {
      load.set(it.assignee_id, (load.get(it.assignee_id) ?? 0) + 1)
    }
  }

  const link = `${location.origin}/t/${S.trip.id}`

  return `
    <main class="page">
      <div class="page__head">
        <span class="eyebrow">Camp</span>
        <h2>The trip</h2>
      </div>

      <div class="card">
        <h3>Invite your friends</h3>
        <p>Anyone with this link can add things and claim them. No sign-up.</p>
        <div class="code-box">
          <span class="code-box__code">${esc(link)}</span>
          <button class="btn btn--sm" data-act="share">Copy</button>
        </div>
      </div>

      <div class="card">
        <h3>Who's coming</h3>
        <p>Colours match the bar at the top of every list. "Own kit" is how much of their personal kit each person has packed.</p>
        <div class="people">
          ${S.members.map((m) => `
            <div class="person">
              <span class="person__swatch" style="background:${colorOf(m)}"></span>
              <span class="person__name">${esc(m.name)}${m.id === S.me ? ' <span class="mono" style="color:var(--ink-faint);font-size:12px">you</span>' : ''}</span>
              <span class="person__load">group ${load.get(m.id) ?? 0}${ownTotal ? ` · own ${ownDone.get(m.id) ?? 0}/${ownTotal}` : ''}</span>
              ${m.id === S.me ? '' : `<button class="item__kill" data-act="drop-member" data-id="${m.id}" aria-label="Remove ${esc(m.name)}">${ICONS.x}</button>`}
            </div>`).join('')}
        </div>
      </div>

      <div class="card">
        <h3>Trip details</h3>
        <form data-act="save-trip">
          <label class="field"><span>Trip name</span><input name="name" value="${esc(S.trip.name)}" maxlength="80"></label>
          <label class="field"><span>Where</span><input name="location" value="${esc(S.trip.location)}" maxlength="120"></label>
          <div class="field field--split">
            <label class="field"><span>Arrive</span><input type="date" name="start_date" value="${esc(S.trip.start_date)}"></label>
            <label class="field"><span>Leave</span><input type="date" name="end_date" value="${esc(S.trip.end_date)}"></label>
          </div>
          <label class="field"><span>Notes for everyone</span>
            <textarea name="notes" maxlength="4000" placeholder="Gate code, who's driving, meeting point, whose car has the roof box…">${esc(S.trip.notes)}</textarea></label>
          <button class="btn btn--primary" type="submit">Save details</button>
        </form>
      </div>

      <div class="card">
        <h3>Camp smarts</h3>
        <p>The things people find out the hard way on their first trip.</p>
        <div class="tips">
          ${S.tips.map((t, i) => `
            <div class="tip">
              <span class="tip__mark">${i + 1}</span>
              <div><h4>${esc(t.title)}</h4><p>${esc(t.body)}</p></div>
            </div>`).join('')}
        </div>
      </div>

      <div class="card">
        <h3>What's been happening</h3>
        <div class="feed">
          ${S.events.length ? S.events.map((e) => `
            <div class="feed__row">
              <span class="feed__who">${esc(e.actor || 'Someone')}</span>
              <span class="feed__what">${esc(e.text)}</span>
              <span class="feed__when">${ago(e.created_at)}</span>
            </div>`).join('') : '<p style="color:var(--ink-soft);font-size:14px;margin:0">Nothing yet.</p>'}
        </div>
      </div>
    </main>`
}

function tabbar() {
  return `
    <nav class="tabbar" aria-label="Sections">
      ${TABS.map((t) => {
        const todo = t.list ? coverageFor(t.list).todo : 0
        return `<button class="tabbar__btn" data-act="tab" data-tab="${t.id}"
                  ${S.tab === t.id ? 'aria-current="page"' : ''} style="position:relative">
                  ${ICONS[t.id]}<span>${t.label}</span>
                  ${todo ? `<span class="tabbar__flag">${todo}</span>` : ''}
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

  const kindSwitch = item.list === 'activities' ? '' : `
    <div class="segmented" role="group" aria-label="How this gets brought">
      <button class="segmented__btn" aria-pressed="${!own}" data-act="set-kind" data-id="${item.id}" data-kind="shared">
        One of us brings it</button>
      <button class="segmented__btn" aria-pressed="${own}" data-act="set-kind" data-id="${item.id}" data-kind="own">
        We each bring our own</button>
    </div>`

  if (own) {
    const rows = S.members.map((m) => {
      const done = item.own.includes(m.id)
      const you = m.id === S.me
      return `
        <button class="pick${you ? '' : ' pick--flat'}" ${you ? `data-act="own" data-id="${item.id}"` : 'disabled'}
                aria-pressed="${done}">
          <span class="pick__swatch" style="background:${colorOf(m)}"></span>
          <span class="pick__main">
            <span class="pick__title">${esc(m.name)}${you ? ' (you)' : ''}</span>
            <span class="pick__note">${done ? 'Packed' : 'Not packed yet'}${you ? '' : ' — only they can tick this'}</span>
          </span>
          <span class="pick__tick">${ICONS.tickGreen}</span>
        </button>`
    }).join('')

    return sheetShell({
      title: item.title,
      blurb: 'Everyone brings their own one. Nobody can cover this for anyone else.',
      body: `${kindSwitch}<div class="sheet__group"><span class="eyebrow">Who's packed theirs</span>${rows}</div>`,
    })
  }

  const rows = S.members.map((m) => `
    <button class="pick" data-act="set-assignee" data-id="${item.id}" data-member="${m.id}"
            aria-pressed="${item.assignee_id === m.id}">
      <span class="pick__swatch" style="background:${colorOf(m)}"></span>
      <span class="pick__main"><span class="pick__title">${esc(m.name)}${m.id === S.me ? ' (you)' : ''}</span></span>
      <span class="pick__tick">${ICONS.tickGreen}</span>
    </button>`).join('')

  return sheetShell({
    title: `Who's bringing ${item.title}?`,
    blurb: 'One person brings it for everyone.',
    body: `
      ${kindSwitch}
      ${me ? `<button class="btn btn--primary btn--wide" style="margin-bottom:14px" data-act="set-assignee" data-id="${item.id}" data-member="${me.id}">I'll bring it</button>` : ''}
      ${rows}
      <button class="pick" data-act="set-assignee" data-id="${item.id}" data-member=""
              aria-pressed="${!item.assignee_id}" style="margin-top:10px">
        <span class="pick__swatch legend__dot--gap"></span>
        <span class="pick__main"><span class="pick__title">Nobody yet</span>
          <span class="pick__note">Leave it open and it stays orange on the bar.</span></span>
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
              <button type="button" class="segmented__btn" aria-pressed="true" data-act="pick-kind" data-kind="shared">
                One of us brings it</button>
              <button type="button" class="segmented__btn" aria-pressed="false" data-act="pick-kind" data-kind="own">
                We each bring our own</button>
            </div>
            <input type="hidden" name="kind" value="shared">
          </div>`}
        <button class="btn btn--primary btn--wide" type="submit">Add it</button>
      </form>`,
  })
}

function sheetSuggest(s) {
  const tab = TABS.find((t) => t.list === s.list)
  const have = new Set(itemsIn(s.list).map((i) => i.title.toLowerCase()))
  const pool = (S.catalog?.[s.list] ?? []).filter((c) => !have.has(c.title.toLowerCase()))
  const picked = s.picked ?? new Set()

  if (!pool.length) {
    return sheetShell({
      title: 'Nothing left to suggest',
      body: `<div class="empty"><h3>You've got the lot</h3><p>Every suggestion we have for ${esc(tab.title.toLowerCase())} is already on your list. Add your own from here on.</p></div>`,
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
            <span class="pick__title">${esc(c.title)}${c.own ? '<span class="tag tag--inline">one each</span>' : ''}</span>
            ${c.note ? `<span class="pick__note">${esc(c.note)}</span>` : ''}
          </span>
          <span class="pick__tick">${ICONS.tickGreen}</span>
        </button>`).join('')}
    </div>`).join('')

  return sheetShell({
    title: 'What am I missing?',
    blurb: `${pool.length} things people usually bring that aren't on your list yet. Tap the ones you want.`,
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
      render()
      window.scrollTo(0, 0)
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

    case 'add':
      S.sheet = { kind: 'add', list: TABS.find((t) => t.id === S.tab).list }
      renderSheet()
      break

    case 'suggest':
      S.sheet = { kind: 'suggest', list: TABS.find((t) => t.id === S.tab).list, picked: new Set() }
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
