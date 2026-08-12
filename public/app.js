/* Camping Sync — client. Vanilla, no build step.
   Rendering is string-based with one delegated click handler; every mutation
   returns the whole trip state, so there is exactly one source of truth. */

// The eight person colours live in the stylesheet, where the dark palette can
// answer for them too — a plum and a brown are the same circle on a dark ground.
// What comes back is the custom property rather than the colour: these are set
// inline, on a swatch or as `--who`, and both take a var() perfectly well.
const MEMBER_COLORS = ['var(--m0)', 'var(--m1)', 'var(--m2)', 'var(--m3)', 'var(--m4)', 'var(--m5)', 'var(--m6)', 'var(--m7)']

// Four places you do something, and no more. A tab bar is a promise that these
// are the things the app is for, and it stops being one somewhere around five.
// Trip rides alongside them in the bar but is not one of them — it is the trip
// itself, not a fifth thing to keep on top of.
//
// Eat carries two lists. Food and drink are one shop, one cooler and one
// question — "who is feeding us" — and keeping them apart cost a whole tab to
// say something the categories already say.
//
// My kit is the one tab that cuts the other way: the lists answer "who is
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
  { id: 'mine', lists: [], label: 'My kit', title: 'Yours to pack' },
]

// Where the trip is, who is coming, the invite link. It is a place you go, not
// a panel you pull down over the list you were reading, so it sits in the bar
// with the rest. It is kept out of TABS because it carries no list: everything
// that counts, badges or filters a list would have to special-case it.
const CAMP = { id: 'camp', lists: [], label: 'Trip', title: 'The trip' }
const ROOM = { id: 'room', title: 'Planning room' }
const SETTLE = { id: 'settle', title: 'Settle up' }

const tabById = (id) => TABS.find((t) => t.id === id) ?? TABS[0]
const currentTab = () => tabById(S.tab)
const isPlanTab = (tab) => tab.lists.includes('activities')

// Your own page is the one whose heading changes with the trip: on the way out
// it is what you are carrying to the car, on the way home it is what has to come
// back off the grass.
const tabTitle = (tab) => (tab.id === 'mine' && goingHome() ? 'Yours to bring home' : tab.title)

// An item belongs to a list, and the tab is whichever one shows that list. Not
// the tab you are standing on: your own kit is edited from My kit, which holds
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
  // A rucksack, rather than the handled shopping bag that used to make Pack
  // look like a second route into Eat.
  pack: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 7V5.8a4 4 0 0 1 8 0V7"/><rect x="5" y="7" width="14" height="14" rx="3"/><path d="M8 13h8v5H8zM5 11H3.5v6H5M19 11h1.5v6H19"/></svg>',
  // A fork and a glass: the tab is one shop, and the icon has to say so.
  eat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 3v7a2 2 0 0 0 4 0V3"/><path d="M6.5 10v11"/><path d="M13.2 4h7.6l-1.1 7.4a2.9 2.9 0 0 1-5.4 0L13.2 4Z"/><path d="M17 14.5V21"/><path d="M14.2 21h5.6"/></svg>',
  // An itinerary: the page is where ideas become plans on particular days,
  // not a compass that sends you somewhere else.
  do: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5.5" width="17" height="15" rx="2.5"/><path d="M7.5 3.5v4M16.5 3.5v4M3.5 10h17M8 14h3M8 17h6"/></svg>',
  mine: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4h6v3H9V4Z"/><path d="M9 5.5H6.5A1.5 1.5 0 0 0 5 7v12.5A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V7a1.5 1.5 0 0 0-1.5-1.5H15"/><path d="m9 13.5 2 2 4.5-4.5"/></svg>',
  // A tent, not a globe. The button opens the trip — where it is, who is coming
  // — and a globe was the icon for "somewhere on Earth", which is nowhere.
  camp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3.6 20.5 14 3.8"/><path d="M20.4 20.5 10 3.8"/><path d="M15.5 20.5 12 14.6l-3.5 5.9"/><path d="M2.2 20.5h19.6"/></svg>',
  room: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5.5 5.5h13a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H11l-4.8 3v-3h-.7a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z"/><path d="M7.5 9.5h9M7.5 13.5h6"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>',
  // A trail fingerpost, for the one move that leaves the trip entirely. A
  // chevron would have said "up one level", which is what the Planning Room's
  // own back arrow says — and the two are not the same move. The board points
  // the way you are going, the stub arm points at the trip you are standing in.
  signpost: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 3v18"/><path d="M14.5 6H7l-3 3 3 3h7.5"/><path d="M14.5 15.5H18"/><path d="M11.5 21h6"/></svg>',
  send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h13M13 6l6 6-6 6"/></svg>',
  reply: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 7 5 11.5 9.5 16"/><path d="M5 11.5h8.5a5.5 5.5 0 0 1 5.5 5.5v1.5"/></svg>',
  // A cog, drawn plainly. Every other icon in this app was redrawn to say
  // something particular — a tent, a rucksack, a fingerpost — but the way into
  // settings is the one place where being instantly recognised beats being
  // interesting, and a cog is the thing everybody already knows. Eight teeth
  // rather than a ring of spokes, which at this size would read as a sun and
  // send people looking for a brightness slider.
  // Eight teeth on a 9.4 radius with the valleys at 7.1, generated rather than
  // drawn by hand so the thing is symmetric about both axes: an eyeballed cog
  // sits a fraction low in its own hole, which is the sort of half-pixel that
  // reads as "slightly wrong" without anybody being able to say why.
  cog: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M10.45 2.73A9.4 9.4 0 0 1 13.55 2.73L13.96 5.18A7.1 7.1 0 0 1 15.44 5.79L17.46 4.35A9.4 9.4 0 0 1 19.65 6.54L18.21 8.56A7.1 7.1 0 0 1 18.82 10.04L21.27 10.45A9.4 9.4 0 0 1 21.27 13.55L18.82 13.96A7.1 7.1 0 0 1 18.21 15.44L19.65 17.46A9.4 9.4 0 0 1 17.46 19.65L15.44 18.21A7.1 7.1 0 0 1 13.96 18.82L13.55 21.27A9.4 9.4 0 0 1 10.45 21.27L10.04 18.82A7.1 7.1 0 0 1 8.56 18.21L6.54 19.65A9.4 9.4 0 0 1 4.35 17.46L5.79 15.44A7.1 7.1 0 0 1 5.18 13.96L2.73 13.55A9.4 9.4 0 0 1 2.73 10.45L5.18 10.04A7.1 7.1 0 0 1 5.79 8.56L4.35 6.54A9.4 9.4 0 0 1 6.54 4.35L8.56 5.79A7.1 7.1 0 0 1 10.04 5.18Z"/><circle cx="12" cy="12" r="3.1"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>',
  bellOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M13.7 5.25A6 6 0 0 0 6 9c0 2.1-.27 3.55-.68 4.58M18 9c0 7 3 7 3 9H9M10 21h4M3 3l18 18"/></svg>',
  tick: '<svg viewBox="0 0 24 24" fill="none" stroke="var(--on-forest)" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5 9.5 18 20 6.5"/></svg>',
  tickGreen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5 9.5 18 20 6.5"/></svg>',
  x: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  plus: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  // Points down at what it is showing, and turns to point at the heading when
  // the section is folded away behind it.
  caret: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m5 9 7 7 7-7"/></svg>',
  find: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>',
  pin: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/></svg>',
  // A drawing pin pushed into the board, for the pinned message. `pin` above is
  // already taken by the map pin, and the two are different things that would
  // both like the same four letters — so the one that is literally a pin gets
  // the literal name, and this is a tack.
  tack: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4h6"/><path d="M10 4v5.5L7.5 14h9L14 9.5V4"/><path d="M12 14v6"/></svg>',
  // A clock, for when a thing happens — the other half of the question the pin
  // beside it answers.
  clock: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 1.8"/></svg>',
  spark: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5 13.8 9l5.7 1.8-5.7 1.8L12 18l-1.8-5.4L4.5 10.8 10.2 9 12 3.5Z"/><path d="M19 3v3M20.5 4.5h-3"/></svg>',
  // iOS draws its Share button as a box with an arrow leaving it, and the only
  // way to install on that phone is to say "tap this" and mean that one.
  share: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3.5"/><path d="m8.5 7 3.5-3.5L15.5 7"/><path d="M7.5 10.5H5.5a1 1 0 0 0-1 1V20a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-8.5a1 1 0 0 0-1-1h-2"/></svg>',
  // The icon the home screen would get, so the offer shows the thing itself.
  mark: '<svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="7.5" fill="#1B382E"/><path d="M16 6 6 26h20z" fill="#E9EDE6"/><path d="M16 14 11 26h10z" fill="#1B382E"/></svg>',
}

// ---- state ------------------------------------------------------------------

// What the settings page can turn off, and what each switch is called where a
// person reads it. Kept as data rather than five hand-written rows: the page,
// the defaults and the storage all read from here, so adding a sixth switch is
// one entry rather than four edits in three places.
//
// Every one of these is on until somebody says otherwise. A switch is a way to
// quieten an app you already use, not a checklist to fill in before it works.
const FEATURES = [
  {
    id: 'assistant', label: 'Camp, in the Planning Room',
    note: 'Ask it about the trip with @camp, or ask it to change the lists, plans, notes and costs. Off, the room is just the group.',
  },
  {
    id: 'weather', label: 'Weather forecast',
    note: 'The forecast for where and when the trip is, on the trip page.',
  },
  {
    id: 'suggestions', label: 'Suggestions and camp smarts',
    note: '“What am I missing?” on every list, and the tips at the foot of the trip page.',
  },
  {
    id: 'countdown', label: 'Countdown',
    note: 'How many days to go, above what the trip is still waiting on.',
  },
  {
    id: 'install', label: 'Offer to add to home screen',
    note: 'The card that offers to install the app. Turning this off never asks again.',
  },
]

const THEMES = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'System' },
]

// Does this device want that part of the app? Absent means yes, so a feature
// added after somebody last set their switches arrives turned on rather than
// hidden behind a settings page they have no reason to open again.
const wants = (id) => S.prefs.features[id] !== false

const S = {
  view: 'boot',      // boot | landing | join | trip | settings | missing
  // How this app is set up on this device: which palette, and which of the
  // optional parts of it are on. Deliberately not on the account — a phone in
  // a tent at night and a laptop at a desk want different answers to the same
  // question, and the one thing you cannot do with a synced theme is have two.
  // What does belong to the account — who you are, which trips are muted, which
  // reminders you want — is on the server already, and the settings page reads
  // it from there.
  prefs: { theme: 'system', features: {} },
  // What the settings page asks about alerts: null until asked.
  // `{ loading, error, publicKey, permission, subscribed, reminders, trips }`.
  alerts: null,
  // Where the back arrow out of settings goes: wherever you opened it from.
  // `settingsPushed` is whether the history entry it is standing on is one this
  // app pushed, and so one it may pop on the way out.
  settingsBack: '/',
  settingsPushed: false,
  tab: 'pack',
  // A list tab, the trip overview, or the planning room nested under it. The
  // room gets its own URL and screen without taking a sixth slot in the bar.
  camp: false,       // false | overview | room | settle
  // How the list on screen is narrowed: which day of the trip, who brings it,
  // what kind of thing it is, whether to bother with what is already handled,
  // and whatever you typed into the search box. All empty means everything,
  // which is where every tab starts — and where it goes back to when you leave.
  filter: { day: '', kind: '', cat: '', hide: false, q: '' },
  trip: null, members: [], items: [], expenses: [], payments: [], events: [],
  // The one pinned message, as the server resolves it: `{ id, author, assistant,
  // body, at }` or null. Trip state rather than chat state, because it is what
  // the trip is currently waiting on and it changes when the trip does.
  pinned: null,
  // Google proves one user across devices; a member is still their place on one
  // particular trip. Unlinked local members remain usable while they migrate.
  auth: { loaded: false, clientId: '', devBypass: false, user: null, memberships: [] },
  authBusy: false,
  // Messages are paged and polled on their own cursor. They are durable server
  // state, but not part of the large trip payload or its revision counter.
  chat: {
    tripId: '', messages: [], hasMore: false, loading: false,
    loadingOlder: false, busy: false, error: '', draft: '', pending: null,
    connection: 'idle', assistantAvailable: false, streams: {},
    // The message the next send will quote, as the server describes it:
    // `{ id, author, assistant, body }` or null. See shapeMessage on the server.
    replyTo: null,
  },
  notify: {
    tripId: '', loading: false, available: false, subscribed: false,
    muted: false, unread: 0, publicKey: '', busy: false,
    // The last thing said in the room, for the door on the trip page:
    // `{ author, assistant, body, at }` or null. See latestMessage on the server.
    latest: null,
  },
  catalog: null, tips: [],
  // The forecast for where and when this trip is: `{ key, state, days, advice }`.
  // Not part of the trip — nobody edits it and it is the same for everybody — so
  // it is fetched on its own and keyed by the question it answers.
  wx: null,
  // Which forecast day has its numbers open, as an ISO date. A row only has room
  // for the number worth acting on, and the rest of them are a tap away rather
  // than a hover away — there is no hovering on the phone this is read on.
  wxOpen: null,
  me: null,          // member id
  rev: 0,
  sheet: null,       // { kind, ...payload }
  busy: false,
  editNotes: false,  // the shared notes read as text until you ask to change them
  editWhere: false,  // same for where the trip is, which is read far more than written
  expand: { tips: false, feed: false, diets: false, notes: false },
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
const askRoot = document.getElementById('ask-root')
const toastEl = document.getElementById('toast')
const installEl = document.getElementById('install')

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

// Camp answers in a small, deliberate subset of Markdown. Parse only the
// structures that make a practical answer easier to scan, and escape every
// piece of model text before adding our own markup.
function assistantInline(text) {
  const source = String(text ?? '')
  const token = /(\*\*([^*\n]+)\*\*|`([^`\n]+)`)/g
  let html = '', at = 0, match
  while ((match = token.exec(source))) {
    html += esc(source.slice(at, match.index))
    html += match[2] !== undefined
      ? `<strong>${esc(match[2])}</strong>`
      : `<code>${esc(match[3])}</code>`
    at = match.index + match[0].length
  }
  return html + esc(source.slice(at))
}

// The other end of the same subset: what Camp wrote, with the marks taken off
// instead of drawn. A preview is one clipped line and has nowhere to put a bold
// word, so it gets the words. This is the grammar above read backwards, and the
// server keeps its own copy in lib/fields.js — it has to strip before it cuts a
// body down to a quote, which is a thing only the end holding the whole message
// can do.
function unmark(text) {
  return String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim()
      .replace(/^#{1,3}\s+/, '')
      .replace(/^[-*]\s+/, '')
      .replace(/^\d+[.)]\s+/, ''))
    .join('\n')
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/`([^`\n]+)`/g, '$1')
}

function assistantHtml(text) {
  const lines = String(text ?? '').replace(/\r\n?/g, '\n').split('\n')
  let html = '', paragraph = [], list = '', items = []
  const flushParagraph = () => {
    if (!paragraph.length) return
    html += `<p>${assistantInline(paragraph.join(' '))}</p>`
    paragraph = []
  }
  const flushList = () => {
    if (!items.length) return
    html += `<${list}>${items.map((item) => `<li>${assistantInline(item)}</li>`).join('')}</${list}>`
    list = ''; items = []
  }

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) { flushParagraph(); flushList(); continue }

    const bullet = line.match(/^[-*]\s+(.+)/)
    const numbered = line.match(/^\d+[.)]\s+(.+)/)
    if (bullet || numbered) {
      flushParagraph()
      const kind = bullet ? 'ul' : 'ol'
      if (list && list !== kind) flushList()
      list = kind
      items.push((bullet || numbered)[1])
      continue
    }

    flushList()
    const heading = line.match(/^#{1,3}\s+(.+)/)
    if (heading) {
      flushParagraph()
      html += `<p class="assistant-copy__heading">${assistantInline(heading[1])}</p>`
    } else {
      paragraph.push(line)
    }
  }
  flushParagraph(); flushList()
  return html || '<p></p>'
}

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

// ---- asking -----------------------------------------------------------------

// Everywhere the app stops to ask something. confirm() and prompt() did this
// until now, and they arrived wearing the browser's furniture: a system font, an
// OK the app says nowhere else, and "camping-sync.up.railway.app says" over the
// top of a question we had written carefully — the address bar introducing us to
// somebody who has been using the trip all week. So the question is ours now,
// and there is one of it.
//
// It answers as a promise, because every caller was already reading confirm()'s
// answer on the line it asked: `if (await ask({...}))` is the same sentence.
let askAnswer = null   // resolve() of the question currently up, or null
let askFrom = null     // what had the focus before it, to give back afterwards

// Everything the question stands in front of. The scrim covers all of it, but a
// scrim only stops fingers — the tab key walks straight through one, and the
// install card is a live pair of buttons that can raise itself on a timer while
// a question is up. The toast is left out on purpose: it holds nothing to press,
// and an aria-live region going inert is a sentence cut off mid-announcement.
const BEHIND = () => [root, sheetRoot, installEl]

function closeAsk(answer) {
  if (!askAnswer) return
  const settle = askAnswer
  askAnswer = null
  askRoot.innerHTML = ''
  // Order matters: focus will not go back to something still inert.
  for (const layer of BEHIND()) layer.inert = false
  askFrom?.focus?.()
  askFrom = null
  settle(answer)
}

function openAsk(html) {
  // Never two at once, and a second question is a way of walking away from the
  // first — which is what a dismissed confirm() meant too.
  closeAsk(false)
  // Read before the dialog is anywhere near the page: it carries an autofocus,
  // and where it lands is decided by the browser at a moment of its choosing.
  askFrom = document.activeElement
  const answered = new Promise((resolve) => { askAnswer = resolve })
  askRoot.innerHTML = html
  // The page behind is not a page you can use while this is up. `inert` says so
  // to the pointer, the tab key and the screen reader in one word — and it is
  // what keeps a live update redrawing the trip underneath from stealing the
  // focus out of the dialog.
  for (const layer of BEHIND()) layer.inert = true
  const first = askRoot.querySelector('[autofocus]')
  first?.focus()
  first?.select?.()
  return answered
}

// One at a time, so the question and its small print can hold fixed ids and be
// named to a screen reader by the words on screen rather than by a copy of them.
function askShell({ title, blurb, body = '', acts }) {
  return `
    <div class="ask-scrim" data-ask="scrim">
      <div class="ask" role="alertdialog" aria-modal="true"
           aria-labelledby="ask-title"${blurb ? ' aria-describedby="ask-blurb"' : ''}>
        <div class="ask__head">
          <h3 id="ask-title">${esc(title)}</h3>
          ${blurb ? `<p id="ask-blurb">${esc(blurb)}</p>` : ''}
        </div>
        ${body}
        <div class="ask__foot">${acts}</div>
      </div>
    </div>`
}

// Yes or no. `yes` is the answer written out — "Remove", "Take it off" — because
// a button that says what it does can be read on its own, and the last thing
// somebody about to undo a payment should have to do is scroll their eye back up
// to the question to find out what OK meant.
//
// Removing gets no colour of its own: blaze means nobody has picked this up yet
// and nothing else, and the question mark is doing the warning already.
function ask({ title, blurb = '', yes = 'OK', no = 'Cancel' }) {
  return openAsk(askShell({
    title,
    blurb,
    acts: `
      <button class="btn" data-ask="no">${esc(no)}</button>
      <button class="btn btn--primary" data-ask="yes" autofocus>${esc(yes)}</button>`,
  }))
}

// The fallback when the clipboard will not take something — an old browser, or
// a page the OS has decided is not allowed to write to it. There is nothing to
// answer here: the text is the whole point, sitting selected in a box, one
// long-press from being copied the manual way.
function askCopy({ title, blurb = '', value }) {
  return openAsk(askShell({
    title,
    blurb,
    body: `<div class="ask__body">
      <input class="ask__copy" value="${esc(value)}" readonly spellcheck="false"
             aria-labelledby="ask-title" autofocus>
    </div>`,
    acts: `<button class="btn btn--primary" data-ask="yes">Done</button>`,
  }))
}

askRoot.addEventListener('click', (ev) => {
  const hit = ev.target.closest('[data-ask]')
  if (!hit) return
  // The scrim is the card's own parent, so only a press on the space around the
  // card counts as walking away — not one that landed on the card and bubbled.
  if (hit.dataset.ask === 'scrim' && ev.target !== hit) return
  closeAsk(hit.dataset.ask === 'yes')
})

// ---- api --------------------------------------------------------------------

async function api(path, opts = {}) {
  const headers = { 'content-type': 'application/json' }
  if (S.me) headers['x-member-id'] = S.me
  // Not a credential — the HttpOnly cookie is that. This public id only gives
  // the offline cache a value that changes on sign-out, so private trip state
  // from an authenticated session cannot match the signed-out request.
  if (S.auth.user) headers['x-user-id'] = S.auth.user.id
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
  if (S.trip?.id !== state.trip.id) resetChat()
  S.trip = state.trip
  if (Object.hasOwn(state, 'viewer_id')) S.me = state.viewer_id
  S.members = state.members
  S.items = state.items
  S.expenses = state.expenses ?? []
  S.payments = state.payments ?? []
  S.events = state.events
  S.pinned = state.pinned ?? null
  S.rev = state.trip.rev
  render()
}

// Says whether it got through, because a form that closes on the way out has to
// stay open when the request does not: what you typed is in the DOM and nowhere
// else, and nothing rebuilds the page on the failing path.
// A refusal some callers have to read rather than just report — a spent
// idempotency key says something about what to send next — arrives at `onError`
// on the way to the toast.
async function mutate(fn, onError) {
  if (S.busy) return false
  S.busy = true
  try {
    absorb(await fn())
    return true
  } catch (err) {
    onError?.(err)
    toast(err.message)
    return false
  } finally {
    S.busy = false
  }
}

function resetChat(tripId = '') {
  S.chat = {
    tripId, messages: [], hasMore: false, loading: false,
    loadingOlder: false, busy: false, error: '', draft: '', pending: null,
    connection: 'idle', assistantAvailable: false, streams: {}, replyTo: null,
  }
}

const pushSupported = () => typeof Notification !== 'undefined'
  && 'serviceWorker' in navigator && 'PushManager' in globalThis

async function currentPushSubscription() {
  if (!pushSupported()) return null
  const registration = await navigator.serviceWorker.getRegistration()
  return registration?.pushManager.getSubscription() ?? null
}

function pushApplicationKey(value) {
  const padded = `${value}${'='.repeat((4 - value.length % 4) % 4)}`
  const bytes = atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(bytes, (char) => char.charCodeAt(0))
}

async function wantNotificationState() {
  const tripId = S.trip?.id
  if (!tripId || S.notify.loading || S.notify.tripId === tripId) return
  S.notify = { ...S.notify, tripId, loading: true, available: false, unread: 0 }
  try {
    const subscription = await currentPushSubscription()
    if (S.trip?.id !== tripId) {
      if (S.notify.tripId === tripId) S.notify = { ...S.notify, tripId: '', loading: false }
      void wantNotificationState()
      return
    }
    const query = subscription ? `?endpoint=${encodeURIComponent(subscription.endpoint)}` : ''
    const state = await api(`/trips/${tripId}/notifications${query}`)
    if (S.trip?.id !== tripId) {
      if (S.notify.tripId === tripId) S.notify = { ...S.notify, tripId: '', loading: false }
      void wantNotificationState()
      return
    }
    S.notify = {
      tripId, loading: false, available: pushSupported() && !!state.available,
      subscribed: !!state.subscribed, muted: !!state.muted,
      unread: Number(state.unread) || 0, publicKey: String(state.publicKey ?? ''), busy: false,
      latest: state.latest ?? null,
    }
  } catch {
    if (S.notify.tripId === tripId) S.notify = {
      ...S.notify, tripId: '', loading: false, available: false, busy: false,
    }
    if (S.trip?.id !== tripId) void wantNotificationState()
    return
  }
  if (S.trip?.id === tripId) render()
}

async function enableNotifications() {
  if (!S.notify.available || S.notify.busy || !S.notify.publicKey) return
  const tripId = S.trip?.id
  if (!tripId) return
  S.notify.busy = true
  render()
  try {
    const permission = await Notification.requestPermission()
    if (S.trip?.id !== tripId) return
    if (permission !== 'granted') {
      toast(permission === 'denied'
        ? 'Notifications are blocked in your browser settings.'
        : 'Notifications were left off.')
      return
    }
    const registration = await navigator.serviceWorker.ready
    if (S.trip?.id !== tripId) return
    let subscription = await registration.pushManager.getSubscription()
    if (S.trip?.id !== tripId) return
    subscription ??= await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: pushApplicationKey(S.notify.publicKey),
      })
    if (S.trip?.id !== tripId) return
    let state = await api(`/trips/${tripId}/notifications`, {
      method: 'PUT', body: { subscription: subscription.toJSON() },
    })
    if (S.trip?.id !== tripId) return
    if (state.muted) {
      state = await api(`/trips/${tripId}/notifications`, {
        method: 'PATCH', body: { muted: false, endpoint: subscription.endpoint },
      })
      if (S.trip?.id !== tripId) return
    }
    S.notify = {
      ...S.notify, subscribed: true, muted: false,
      unread: Number(state.unread) || 0,
    }
    toast('Planning Room notifications are on.')
  } catch (err) {
    if (S.trip?.id === tripId) toast(err.message || 'Notifications could not be turned on.')
  } finally {
    if (S.trip?.id === tripId && S.notify.tripId === tripId) {
      S.notify.busy = false
      render()
    }
  }
}

// What the settings page needs, at once and on the way in: the two reminder
// switches, and the trips this device would be subscribed to. The trips are not
// drawn — a list of them was a card that grew a row per trip and buried the two
// answers underneath — but the device switch subscribes to every one of them,
// so it still has to know what they are.
//
// Asked for even where this browser could not show a notification if it tried.
// The reminders belong to the account and are obeyed by every device on it, so
// an iPhone that has not been added to the home screen should still be able to
// answer them for the laptop that can.
const noAlerts = (rest) => ({
  loading: false, busy: false, error: '', permission: '', publicKey: '',
  subscribed: false, trips: [], reminders: { lead: false, morning: false }, ...rest,
})

async function wantAlerts() {
  if (!S.auth.user || S.alerts) return
  const supported = pushSupported()
  S.alerts = noAlerts({ loading: true })
  try {
    const subscription = supported ? await currentPushSubscription() : null
    const query = subscription ? `?endpoint=${encodeURIComponent(subscription.endpoint)}` : ''
    const data = await api(`/notifications${query}`)
    if (S.view !== 'settings') { S.alerts = null; return }
    const trips = data.trips ?? []
    S.alerts = noAlerts({
      permission: supported ? Notification.permission : 'unsupported',
      publicKey: String(data.publicKey ?? ''),
      // What this switch promises is every trip on the account, so it only
      // reads as on when every trip has this endpoint on file. A trip that
      // slipped through — one joined on another device, or while this one was
      // offline — turns it back off, which is both true and the way to fix it:
      // switching it on again writes the trips that are missing.
      subscribed: supported && !!subscription && trips.every((t) => t.subscribed),
      trips: trips.map((t) => ({
        tripId: String(t.tripId), name: String(t.name ?? 'Trip'),
      })),
      reminders: {
        lead: !!data.reminders?.lead, morning: !!data.reminders?.morning,
      },
    })
  } catch (err) {
    S.alerts = noAlerts({ error: err.message || 'Your notification settings could not be loaded.' })
  }
  if (S.view === 'settings') render()
}

// After a write that may only half have landed. What the page believes is
// thrown away rather than patched, because the point is that nobody here knows
// what the server ended up with — so it asks.
async function reloadAlerts() {
  S.alerts = null
  await wantAlerts()
}

// A trip that has just appeared on this account. The device switch subscribes
// every trip it knew about at the time it was thrown, so a trip started or
// joined afterwards would have no endpoint against it and would go quiet — no
// Planning Room alert and, worse, no reminder, on a device whose settings page
// says it is switched on.
//
// So a membership that has just been made brings the browser's existing
// subscription with it. Nothing is asked of anybody: no subscription, or a
// permission that was never granted, means this device was not being notified
// and this is not the moment to suggest it. The settings page is dropped
// because its trip list is now a trip short either way.
async function syncNotificationsForTrip(tripId) {
  S.alerts = null
  if (!pushSupported() || Notification.permission !== 'granted') return
  try {
    const subscription = await currentPushSubscription()
    if (!subscription) return
    await api(`/trips/${tripId}/notifications`, {
      method: 'PUT', body: { subscription: subscription.toJSON() },
    })
    // The bell in the Planning Room reads the same rows, so it is sent back to
    // ask rather than told what to think.
    if (S.notify.tripId === tripId) S.notify = { ...S.notify, tripId: '' }
  } catch {
    // The trip is joined either way, and the settings page is the place that
    // says which trips this device is on — where it now reads as off, with the
    // switch that fixes it.
  }
}

// The device switch on the settings page. On means: ask the browser, then put
// this endpoint on every trip on the account, because "notify me on this
// device" is not a question you want to answer once per trip. Off unsubscribes
// the browser and forgets the endpoint, and deliberately leaves the per-trip
// mutes alone — turning your laptop off for a week is not the same as saying a
// trip may never reach you.
async function toggleDeviceAlerts() {
  const a = S.alerts
  if (!a || a.busy) return
  a.busy = true
  render()
  try {
    if (a.subscribed) {
      await clearBrowserNotifications()
      a.subscribed = false
      if (S.notify.tripId) S.notify = { ...S.notify, subscribed: false }
      toast('This device will not be notified.')
    } else {
      const permission = await Notification.requestPermission()
      a.permission = permission
      if (permission !== 'granted') {
        toast(permission === 'denied'
          ? 'Notifications are blocked in your browser settings.'
          : 'Notifications were left off.')
        return
      }
      const registration = await navigator.serviceWorker.ready
      let subscription = await registration.pushManager.getSubscription()
      subscription ??= await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: pushApplicationKey(a.publicKey),
      })
      const body = { subscription: subscription.toJSON() }
      // Every trip on the account, and they are independent writes, so they go
      // together rather than one behind the other.
      //
      // When some of them fail the browser is subscribed to the rest, and this
      // switch used to settle back to off — an off switch on a device that is
      // about to be notified, which is the one state worth going out of the way
      // to avoid. So what actually landed is read back from the server rather
      // than inferred from which call threw.
      const writes = await Promise.allSettled(a.trips.map((t) => api(
        `/trips/${t.tripId}/notifications`, { method: 'PUT', body })))
      const failed = writes.filter((w) => w.status === 'rejected')
      if (failed.length) {
        // The bell in the Planning Room reads the same rows and answers once per
        // trip, so it is sent back to ask again rather than left holding this.
        if (S.notify.tripId) S.notify = { ...S.notify, tripId: '' }
        await reloadAlerts()
        throw new Error(failed.length === writes.length
          ? failed[0].reason?.message || 'Notifications could not be turned on.'
          : `Notifications were turned on for ${writes.length - failed.length} of your ${writes.length} trips.`)
      }
      a.subscribed = true
      if (S.notify.tripId) S.notify = { ...S.notify, subscribed: true }
      toast(a.trips.length ? 'This device will be notified.' : 'Notifications are on for this device.')
    }
  } catch (err) {
    toast(err.message || 'Notifications could not be changed.')
  } finally {
    // A reload above may have replaced this object outright, and it is the one
    // the page is drawing that needs its switch letting go of, not this one.
    if (S.alerts === a) a.busy = false
    if (S.view === 'settings') render()
  }
}

// One of the two reminders, on or off for every trip you are on. It writes the
// account rather than a membership, so there is no trip id in it and nothing on
// the trip page to keep in step — the answer comes back whole and both switches
// are drawn from it, because one write may as well tell us about both.
const REMINDER_SAID = {
  lead: { on: 'You will hear three days before a trip.', off: 'The three-day reminder is off.' },
  morning: { on: 'You will hear on the morning of a trip.', off: 'The morning reminder is off.' },
}

async function toggleReminder(kind) {
  const a = S.alerts
  if (!a || a.busy || !REMINDER_SAID[kind]) return
  a.busy = true
  render()
  try {
    const { reminders } = await api('/notifications', {
      method: 'PATCH', body: { [kind]: !a.reminders[kind] },
    })
    a.reminders = { lead: !!reminders?.lead, morning: !!reminders?.morning }
    toast(a.reminders[kind] ? REMINDER_SAID[kind].on : REMINDER_SAID[kind].off)
  } catch (err) {
    toast(err.message || 'That reminder could not be changed.')
  } finally {
    if (S.alerts === a) a.busy = false
    if (S.view === 'settings') render()
  }
}

async function toggleTripMute() {
  if (S.notify.busy) return
  if (!S.notify.subscribed) return enableNotifications()
  const tripId = S.trip?.id
  if (!tripId) return
  const muted = !S.notify.muted
  S.notify.busy = true
  render()
  try {
    const subscription = await currentPushSubscription()
    if (S.trip?.id !== tripId) return
    const state = await api(`/trips/${tripId}/notifications`, {
      method: 'PATCH', body: { muted, endpoint: subscription?.endpoint ?? '' },
    })
    if (S.trip?.id !== tripId) return
    S.notify = { ...S.notify, muted: !!state.muted }
    toast(S.notify.muted ? 'Planning Room notifications muted.' : 'Planning Room notifications on.')
  } catch (err) {
    if (S.trip?.id === tripId) toast(err.message)
  } finally {
    if (S.trip?.id === tripId && S.notify.tripId === tripId) {
      S.notify.busy = false
      render()
    }
  }
}

async function clearBrowserNotifications() {
  const subscription = await currentPushSubscription().catch(() => null)
  if (!subscription) return
  await api('/notifications', {
    method: 'DELETE', body: { endpoint: subscription.endpoint },
  }).catch(() => {})
  await subscription.unsubscribe().catch(() => {})
}

let readMessagePending = { tripId: '', messageId: 0 }
function markRoomRead() {
  if (S.camp !== 'room' || document.hidden || S.chat.tripId !== S.trip?.id) return
  const messageId = Number(S.chat.messages.at(-1)?.id ?? 0)
  if (readMessagePending.tripId === S.trip.id
      && messageId <= readMessagePending.messageId && !S.notify.unread) return
  readMessagePending = { tripId: S.trip.id, messageId }
  S.notify.unread = 0
  const tripId = S.trip.id
  api(`/trips/${tripId}/notifications/read`, { method: 'POST', body: { messageId } })
    .then(({ unread }) => {
      if (S.trip?.id === tripId) S.notify.unread = Number(unread) || 0
    })
    .catch(() => { /* unread state catches up on the next successful visit */ })
}

function mergeMessages(incoming) {
  const byId = new Map(S.chat.messages.map((m) => [Number(m.id), m]))
  for (const message of incoming ?? []) {
    byId.set(Number(message.id), message)
    if (message.role === 'assistant' && message.client_id?.startsWith('assistant:')) {
      delete S.chat.streams[message.client_id.slice('assistant:'.length)]
    }
  }
  S.chat.messages = [...byId.values()].sort((a, b) => Number(a.id) - Number(b.id))
}

function newMessageId() {
  return globalThis.crypto?.randomUUID?.()
    ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

// The same cut the server makes when it hands a quote back, made here as well so
// the chip under the composer shows exactly what the sent message will carry.
// See QUOTE_MAX and shapeMessage on the server.
const QUOTE_MAX = 140
const quoteOf = (message) => {
  const body = String(message.body ?? '').replace(/\s+/g, ' ').trim()
  return {
    id: Number(message.id),
    author: message.author_name,
    assistant: message.role === 'assistant',
    body: body.length > QUOTE_MAX ? `${body.slice(0, QUOTE_MAX - 1)}…` : body,
  }
}

// Straight into the box, because writing the reply is what the tap was for — and
// on a phone this is the thing that brings the keyboard up. Attaching or
// dropping a quote redraws the composer, and a textarea drawn with a draft
// already in it puts the caret in front of it: picking a quote halfway through a
// sentence would leave the rest of it being typed at the beginning.
function focusComposer() {
  const box = root.querySelector('#chat-text')
  if (!box) return
  box.focus()
  box.setSelectionRange(box.value.length, box.value.length)
}

function startReply(id) {
  const message = S.chat.messages.find((m) => Number(m.id) === id)
  if (!message) return
  S.chat.replyTo = quoteOf(message)
  render()
  focusComposer()
}

// One slot, so pinning is always a choice against whatever is in it. Sending a
// message id sets the pin and drops what was there; sending null clears it.
const savePin = (messageId) => mutate(
  () => api(`/trips/${S.trip.id}/pin`, { method: 'PUT', body: { messageId } }),
)

// What a pin costs, asked before it costs it. A phone has no hover to read the
// button's label off, so the message being displaced is put in front of the
// person doing the displacing — and it is quoted, because "replace the pinned
// message?" is not a question anybody can answer without seeing which one.
//
// Pinning into an empty slot asks nothing. It takes nothing away, and a question
// with only one sensible answer is furniture.
async function pinMessage(id) {
  const held = S.pinned
  if (held && Number(held.id) !== id) {
    const swap = await ask({
      title: 'Replace the pinned message?',
      blurb: `“${held.body}” comes down — a trip pins one message at a time.`,
      yes: 'Replace it',
    })
    if (!swap) return
  }
  await savePin(id)
}

const motionOK = () => !globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// ---- the two gestures in the room --------------------------------------------
//
// One finger down, and what it does next says which of two things it meant:
// dragging right replies to the message, staying still pins it. They cannot be
// confused with each other because they are opposites — movement and the absence
// of it — and the first thing either does is rule the other out.
//
// Neither is the only way to do its job. The reply arrow and the pin are drawn on
// every message and stay drawn, so this is a shortcut for the hand that already
// expects it and nothing at all to the person who never tries. Mice are left out:
// a drag with a mouse is a text selection, and a long press with one is a person
// reading.
const SWIPE_AXIS = 8      // across before we will call the direction
const SWIPE_SLOP = 12     // ... and how far a finger may wander and still be still
const SWIPE_REPLY = 56    // ... and how far it must go before letting go replies
const SWIPE_MAX = 84      // as far as the message itself will travel
const HOLD_MS = 500
const HOLD_HINT_MS = 160

let held = null    // the finger currently down on a message, or null
let heldAt = 0     // when a press last fired, so the click behind it can be dropped
let heldRow = null // ... and which message it fired on, so only that click is

// The arrow the message slides off to reveal. It counters the row's own transform
// so it stays where it was put: the message moves, the mark it moves towards does
// not, which is what makes the gesture read as uncovering something rather than
// dragging the whole row somewhere.
function swipeMark(row) {
  let mark = row.querySelector('.thread__swipe')
  if (!mark) {
    mark = document.createElement('span')
    mark.className = 'thread__swipe'
    mark.setAttribute('aria-hidden', 'true')
    mark.innerHTML = ICONS.reply
    row.append(mark)
  }
  return mark
}

function drawSwipe(row, dx) {
  row.style.transform = dx ? `translateX(${dx}px)` : ''
  if (!dx) {
    row.querySelector('.thread__swipe')?.remove()
    return
  }
  const mark = swipeMark(row)
  mark.style.transform = `translateX(${-dx}px)`
  mark.style.opacity = String(Math.min(1, dx / SWIPE_REPLY))
  mark.classList.toggle('thread__swipe--ready', dx >= SWIPE_REPLY)
}

// Putting the row back where it was found. Everything this touches is inline
// style and one appended span, so a render() in between simply throws it all away
// and there is nothing to put back.
function endHold(snap = false) {
  if (!held) return
  const { row, dx } = held
  clearTimeout(held.hint)
  clearTimeout(held.timer)
  held = null
  row.classList.remove('thread__message--holding')
  // Only a message that actually moved has anywhere to go back to. Sliding one
  // that never left would leave the class waiting on a transition that is never
  // going to start.
  if (!snap || !dx || !motionOK()) return drawSwipe(row, 0)
  row.classList.add('thread__message--snapping')
  row.addEventListener('transitionend', () => {
    row.classList.remove('thread__message--snapping')
    drawSwipe(row, 0)
  }, { once: true })
  row.style.transform = ''
  const mark = row.querySelector('.thread__swipe')
  if (mark) mark.style.opacity = '0'
}

// A press pins, or unpins what it is already holding up — the same answer the
// button on the message gives, because a gesture that did something the visible
// control does not would be a second, quieter set of rules.
function holdPin(id, row) {
  heldAt = Date.now()
  heldRow = row
  globalThis.navigator?.vibrate?.(12)
  // The browser may have started selecting a word under the finger by now. The
  // press was not for that, and leaving it highlighted behind the dialog reads
  // as the app having misheard.
  globalThis.getSelection?.()?.removeAllRanges?.()
  return Number(S.pinned?.id) === id ? savePin(null) : pinMessage(id)
}

document.addEventListener('pointerdown', (ev) => {
  if (ev.pointerType === 'mouse' || !ev.isPrimary || held) return
  const row = ev.target.closest?.('.thread__message')
  // A message being written by Camp has no durable id yet, and nothing can be
  // said to a message that does not exist. Those rows are simply not gestures.
  const id = Number(String(row?.id ?? '').slice(4))
  if (!row?.id?.startsWith('msg-') || !Number.isSafeInteger(id) || id < 1) return
  held = {
    id, row, x: ev.clientX, y: ev.clientY, axis: '', dx: 0,
    hint: setTimeout(() => row.classList.add('thread__message--holding'), HOLD_HINT_MS),
    timer: setTimeout(() => {
      const target = held && { id: held.id, row: held.row }
      endHold()
      if (target) void holdPin(target.id, target.row)
    }, HOLD_MS),
  }
}, { passive: true })

document.addEventListener('pointermove', (ev) => {
  if (!held || !ev.isPrimary) return
  const dx = ev.clientX - held.x
  const dy = ev.clientY - held.y
  // Any real movement means this was never a press.
  if (Math.abs(dx) > SWIPE_SLOP || Math.abs(dy) > SWIPE_SLOP) {
    clearTimeout(held.hint)
    clearTimeout(held.timer)
    held.row.classList.remove('thread__message--holding')
  }
  if (!held.axis) {
    // Down the page is the room's own gesture and it wins: the list is longer
    // than the screen, and a reply shortcut that made scrolling feel sticky
    // would have cost more than it saved. Leaving on the vertical also drops the
    // finger entirely, so a scroll cannot turn into a swipe halfway down.
    if (Math.abs(dy) > SWIPE_AXIS && Math.abs(dy) >= Math.abs(dx)) return endHold()
    if (dx > SWIPE_AXIS) held.axis = 'x'
    else return
  }
  held.dx = Math.max(0, Math.min(dx - SWIPE_AXIS, SWIPE_MAX))
  drawSwipe(held.row, held.dx)
}, { passive: true })

document.addEventListener('pointerup', () => {
  if (!held) return
  const { id, dx, axis } = held
  endHold(true)
  if (axis === 'x' && dx >= SWIPE_REPLY) startReply(id)
})

// A finger the browser has taken for a scroll, or one that has left the screen.
// Either way it is not saying anything to this message.
document.addEventListener('pointercancel', () => endHold(true))

// Long-pressing on Android raises the browser's own menu at about the moment the
// pin fires, and the two would arrive on top of each other. Only a press this app
// is in the middle of is answered for: a right-click at a desk is still the
// browser's to handle.
document.addEventListener('contextmenu', (ev) => {
  if (held || Date.now() - heldAt < 400) ev.preventDefault()
})

// Back to whatever a quote was pointing at. The message is marked for a moment
// once it is there: being dropped into the middle of a room you had scrolled
// away from otherwise leaves you working out which line you were sent to.
//
// The mark is taken off here rather than left to fade out on its own, because
// the fade is an animation and the stylesheet turns every animation off for
// anybody who has asked for less motion — which would take the one thing this
// does away from the people least able to follow an unannounced jump. So the
// class carries the outline and this owns how long it stays; the animation only
// decides whether it leaves gently or at once.
const FOUND_MS = 1600
let foundTimer = 0
function showMessage(id) {
  if (!Number.isSafeInteger(id)) return
  const found = root.querySelector(`#msg-${id}`)
  if (!found) return
  found.scrollIntoView({ block: 'center', behavior: motionOK() ? 'smooth' : 'auto' })
  clearTimeout(foundTimer)
  for (const was of root.querySelectorAll('.thread__message--found')) {
    was.classList.remove('thread__message--found')
  }
  // Restarting the mark needs the class to have been off for a frame, rather
  // than removed and put back inside the same one.
  requestAnimationFrame(() => {
    found.classList.add('thread__message--found')
    foundTimer = setTimeout(() => found.classList.remove('thread__message--found'), FOUND_MS)
  })
}

async function wantMessages() {
  const tripId = S.trip?.id
  if (!tripId || (S.chat.tripId === tripId && !S.chat.error)) return
  const connection = S.chat.connection
  resetChat(tripId)
  S.chat.connection = connection
  S.chat.loading = true
  try {
    const data = await api(`/trips/${tripId}/messages`)
    if (S.chat.tripId !== tripId) return
    mergeMessages(data.messages)
    S.chat.hasMore = !!data.hasMore
    S.chat.assistantAvailable = !!data.assistantAvailable
  } catch (err) {
    if (S.chat.tripId === tripId) S.chat.error = err.message
  } finally {
    if (S.chat.tripId === tripId) {
      S.chat.loading = false
      if (S.view === 'trip' && S.camp === 'room') render()
    }
  }
}

async function olderMessages() {
  const tripId = S.trip?.id
  const first = S.chat.messages[0]?.id
  if (!tripId || !first || S.chat.loadingOlder || !S.chat.hasMore) return
  S.chat.loadingOlder = true
  try {
    const data = await api(`/trips/${tripId}/messages?before=${first}`)
    if (S.chat.tripId !== tripId) return
    mergeMessages(data.messages)
    S.chat.hasMore = !!data.hasMore
    S.chat.assistantAvailable = !!data.assistantAvailable
  } catch (err) {
    if (S.chat.tripId === tripId) toast(err.message)
  } finally {
    if (S.chat.tripId === tripId) {
      S.chat.loadingOlder = false
      render()
    }
  }
}

// WebSocket delivery is a fast notification of durable rows. Reconnect always
// asks REST for everything after the last id, so a dropped packet or sleeping
// phone cannot leave a permanent hole in the thread.
let chatSocket = null
let chatSocketTrip = ''
let chatReconnectTimer = null
let chatReconnectAttempt = 0
let chatNeedsRender = false
let sentRoomPresence = null

const chatConnectionLabel = (state) => ({
  live: 'Live', connecting: 'Connecting', reconnecting: 'Reconnecting',
  offline: 'Offline', polling: 'Checking every 5s', idle: 'Connecting',
}[state] ?? 'Connecting')

function setChatConnection(state) {
  S.chat.connection = state
  const status = root.querySelector?.('[data-chat-connection]')
  if (!status) return
  status.dataset.state = state
  status.textContent = chatConnectionLabel(state)
}

function showChatChanges() {
  if (S.camp !== 'room') return
  // Keep the textarea itself in place while an IME owns it, or while the message
  // it just sent is still in flight, and refresh its sibling thread instead.
  // Replacing the composer can lose a composing word or dismiss the phone
  // keyboard — and mid-send it also strands the send that is still running on a
  // form the room has already thrown away, leaving the visible one holding the
  // text with its button stuck on the ellipsis. Your own message comes back down
  // the socket before the POST answers, so this is the ordinary case, not a race.
  if (S.chat.busy || document.activeElement?.id === 'chat-text') {
    chatNeedsRender = true
    drawChatThread()
    return
  }
  chatNeedsRender = false
  render({ chatBottom: true })
}

function followChat(body = root.querySelector?.('.chat__body')) {
  if (body) body.scrollTop = body.scrollHeight
}

function drawChatThread() {
  const body = root.querySelector?.('.chat__body')
  if (!body) return
  let thread = body.querySelector?.('.thread')
  if (!thread) {
    const empty = body.querySelector?.('.chat__empty')
    if (!empty) return
    thread = document.createElement('ol')
    thread.className = 'thread'
    thread.setAttribute('aria-label', 'Planning messages')
    empty.replaceWith(thread)
  }
  thread.innerHTML = chatRows()
  followChat(body)
}

// Sending is the one moment the composer is certainly the thing you are holding,
// and on a phone the keyboard is standing under it. A full redraw takes the
// textarea with it, so the keyboard drops and climbs back as focus is restored —
// the room changes height twice, which is the flinch, and the thread ends up
// pinned to a bottom that was measured while the keyboard was down, which is why
// the message you just sent sat below the fold. So the composer stays, emptied
// and re-enabled by hand, and the thread beside it is redrawn the same way an
// incoming message redraws it. Everything else the room owes a redraw is left to
// the one that comes on blur.
// It asks the room for the composer rather than being handed the form that was
// submitted: a redraw between the tap and the answer leaves that node detached,
// and emptying one the reader cannot see is worse than not emptying anything.
//
// And it empties it only if what is in there is still the message that was sent.
// Keeping the keyboard up through a send means the next sentence can be started
// before the last one lands — which is the point — so a slow answer coming back
// to an empty box is the ordinary case, and coming back to a started one must
// not be a sentence deleted.
function clearComposer(sent = null, sentReplyTo = null) {
  const box = root.querySelector?.('#chat-text')
  // The quote went with the message that has just landed, so the next one starts
  // unattached — unless somebody picked a different message to answer while this
  // one was in flight. That is a newer answer to the same question than the send
  // being cleaned up is carrying, and dropping it would throw away a choice made
  // after the one it is tidying: the same rule the draft below follows, for the
  // same reason.
  //
  // The chip comes off by hand for the same reason the box is emptied by hand.
  // It lives inside the composer, and the composer is the one thing a send must
  // not redraw.
  if ((S.chat.replyTo?.id ?? null) === sentReplyTo) {
    S.chat.replyTo = null
    box?.form?.querySelector('.chat__replying')?.remove()
  }
  // No composer on screen to read, so the message that has just landed is the
  // only thing the draft could still be holding, and it is spent.
  if (!box) { S.chat.draft = ''; return false }
  if (sent === null || box.value === sent) {
    box.value = ''
    S.chat.draft = ''
  } else {
    S.chat.draft = box.value
  }
  fitChatBox(box)
  setCampMentionOpen(box, false)
  const send = box.form?.querySelector('button[type="submit"]')
  if (send) {
    send.disabled = false
    send.setAttribute('aria-label', 'Send message')
    send.innerHTML = ICONS.send
  }
  drawChatThread()
  return true
}

function receiveAssistantEvent(data) {
  const runId = String(data.runId ?? '')
  if (!/^[a-z0-9-]{1,100}$/i.test(runId)) return
  const current = S.chat.streams[runId] ?? { runId, body: '', state: 'thinking', error: '' }
  S.chat.streams[runId] = current

  if (data.type === 'assistant.delta' && typeof data.delta === 'string') {
    current.body = (current.body + data.delta).slice(0, 12000)
    current.state = 'writing'
  } else if (data.type === 'assistant.failed') {
    current.state = 'failed'
    current.body = ''
    current.error = String(data.error || 'Camp could not answer that.')
  } else if (data.type !== 'assistant.started') {
    return
  }

  const row = root.querySelector?.(`[data-assistant-stream="${runId}"]`)
  if (!row) return showChatChanges()
  row.dataset.state = current.state
  row.setAttribute('aria-busy', current.state === 'failed' ? 'false' : 'true')
  const answer = row.querySelector?.('[data-assistant-body]')
  const status = row.querySelector?.('[data-assistant-status]')
  if (answer) answer.innerHTML = assistantHtml(current.body || current.error || 'Thinking…')
  if (status) status.textContent = current.state === 'failed' ? 'Could not answer' : 'Writing…'
  followChat()
}

async function syncNewMessages(tripId) {
  if (S.chat.tripId !== tripId || S.chat.loading || S.chat.error) return false
  let changed = false
  let after = S.chat.messages.at(-1)?.id ?? 0
  do {
    const data = await api(`/trips/${tripId}/messages?after=${after}&limit=100`)
    if (S.chat.tripId !== tripId) return false
    if (data.messages?.length) {
      mergeMessages(data.messages)
      after = S.chat.messages.at(-1).id
      changed = true
    }
    S.chat.assistantAvailable = !!data.assistantAvailable
    if (!data.messages?.length) return changed
    if (!data.hasMore) return changed
  } while (true)
}

function stopChatSocket(state = 'idle') {
  clearTimeout(chatReconnectTimer)
  chatReconnectTimer = null
  chatReconnectAttempt = 0
  chatSocketTrip = ''
  sentRoomPresence = null
  const socket = chatSocket
  chatSocket = null
  if (socket && socket.readyState < 2) socket.close(1000, 'Leaving trip')
  setChatConnection(state)
}

function scheduleChatReconnect(tripId) {
  if (chatReconnectTimer || S.view !== 'trip' || S.trip?.id !== tripId || !S.me) return
  if (!S.auth.user) return setChatConnection('polling')
  if (navigator.onLine === false) {
    setChatConnection('offline')
    return
  }
  setChatConnection('reconnecting')
  const base = Math.min(1000 * (2 ** chatReconnectAttempt), 30000)
  const delay = base + Math.floor(Math.random() * Math.min(1000, base / 4))
  chatReconnectAttempt++
  chatReconnectTimer = setTimeout(() => {
    chatReconnectTimer = null
    connectChatSocket(tripId)
  }, delay)
}

function connectChatSocket(tripId) {
  if (S.view !== 'trip' || S.trip?.id !== tripId || !S.me) return
  if (!S.auth.user) return setChatConnection('polling')
  if (navigator.onLine === false) return setChatConnection('offline')
  setChatConnection(chatReconnectAttempt ? 'reconnecting' : 'connecting')

  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
  const url = `${protocol}//${location.host}/ws?tripId=${encodeURIComponent(tripId)}`
  let socket
  try { socket = new globalThis.WebSocket(url) } catch { return scheduleChatReconnect(tripId) }
  chatSocket = socket
  chatSocketTrip = tripId
  sentRoomPresence = null

  socket.addEventListener('open', () => {
    if (chatSocket !== socket || chatSocketTrip !== tripId) return
    chatReconnectAttempt = 0
    setChatConnection('live')
    syncRoomPresence()
    if (S.chat.error) wantMessages()
    else syncNewMessages(tripId).then((changed) => { if (changed) showChatChanges() }, () => {})
  })
  socket.addEventListener('message', (event) => {
    if (chatSocket !== socket) return
    try {
      const data = JSON.parse(event.data)
      if (data.type === 'message.created' && data.message) {
        const viewing = S.camp === 'room' && !document.hidden
        if (S.chat.tripId === tripId) mergeMessages([data.message])
        // The door's preview is fetched once with the rest of the notification
        // state, so the socket keeps it current — otherwise it would say what
        // was last said at the moment you arrived and nothing after.
        if (S.notify.tripId === tripId) S.notify.latest = previewOf(data.message)
        if (viewing) {
          showChatChanges()
          markRoomRead()
        } else {
          if (data.message.member_id !== S.me) {
            S.notify.unread = Math.max(0, Number(S.notify.unread) || 0) + 1
          }
          render()
        }
      } else if (data.type?.startsWith('assistant.')) {
        receiveAssistantEvent(data)
      }
    } catch { /* ignore messages from an incompatible server */ }
  })
  socket.addEventListener('close', () => {
    if (chatSocket !== socket) return
    chatSocket = null
    sentRoomPresence = null
    scheduleChatReconnect(tripId)
  })
  socket.addEventListener('error', () => { /* close schedules the retry */ })
}

function syncRoomPresence() {
  if (!chatSocket || chatSocket.readyState !== 1 || typeof chatSocket.send !== 'function') return
  const active = S.camp === 'room' && !document.hidden
  if (active === sentRoomPresence) return
  try {
    chatSocket.send(JSON.stringify({ type: 'room.presence', active }))
    sentRoomPresence = active
  } catch { /* a closing socket will reconnect and announce again */ }
}

function ensureChatSocket() {
  const tripId = S.view === 'trip' && S.me ? S.trip?.id : ''
  if (!tripId) return stopChatSocket()
  // Legacy profiles retain the polling path until Google links the membership;
  // their temporary public member id never becomes a credential in a URL.
  if (!S.auth.user) return stopChatSocket('polling')
  if (typeof globalThis.WebSocket !== 'function') return setChatConnection('polling')
  if (navigator.onLine === false) return stopChatSocket('offline')
  if (chatSocketTrip === tripId && chatSocket && chatSocket.readyState < 2) {
    setChatConnection(chatSocket.readyState === 1 ? 'live' : 'connecting')
    syncRoomPresence()
    return
  }
  if (chatSocketTrip && chatSocketTrip !== tripId) stopChatSocket()
  chatSocketTrip = tripId
  connectChatSocket(tripId)
}

function reconnectChatNow() {
  if (S.view !== 'trip' || !S.trip || !S.me || !S.auth.user
      || typeof globalThis.WebSocket !== 'function') return
  if (chatSocket?.readyState === 1) return
  clearTimeout(chatReconnectTimer)
  chatReconnectTimer = null
  const old = chatSocket
  chatSocket = null
  sentRoomPresence = null
  if (old && old.readyState < 2) old.close()
  chatSocketTrip = S.trip.id
  connectChatSocket(S.trip.id)
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

const tripCurrency = () => String(S.trip?.currency || 'GBP').toUpperCase()

// Building an Intl formatter costs tens of microseconds; using one costs a
// small fraction of that. A page of prices and dates used to build a fresh
// formatter for every row on every redraw, which on a long list is a real part
// of the frame. They are keyed by whatever makes them differ and then kept —
// there are only ever a handful, and none of them go stale.
const moneyFormats = new Map()
const dateFormats = new Map()

const dateFormat = (opts) => {
  const key = JSON.stringify(opts)
  let found = dateFormats.get(key)
  if (!found) dateFormats.set(key, found = new Intl.DateTimeFormat(undefined, opts))
  return found
}

// What toLocaleString() spells out when asked for no options in particular.
// Written down so the cached formatter says exactly what the tooltips used to.
const STAMP = {
  year: 'numeric', month: 'numeric', day: 'numeric',
  hour: 'numeric', minute: 'numeric', second: 'numeric',
}
const CLOCK = { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }

function moneyText(minor) {
  const currency = tripCurrency()
  try {
    let found = moneyFormats.get(currency)
    if (!found) {
      moneyFormats.set(currency, found = new Intl.NumberFormat('en', {
        style: 'currency', currency, currencyDisplay: 'narrowSymbol',
        minimumFractionDigits: 2, maximumFractionDigits: 2,
      }))
    }
    return found.format(minor / 100)
  } catch {
    return `${currency} ${(minor / 100).toFixed(2)}`
  }
}

function minorFromInput(raw) {
  const match = String(raw ?? '').trim().match(/^(\d{1,7})(?:\.(\d{1,2}))?$/)
  if (!match) return null
  return Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'))
}

const minorInput = (minor) => (minor / 100).toFixed(2)

const expenseForClaim = (itemId, memberId) => S.expenses.find((expense) => (
  expense.item_id === itemId && expense.claim_member_id === memberId
)) ?? null

// Each expense says who shared it. A custom split carries exact shares; an
// equal one divides integer minor units and gives leftover pennies to the
// first names in the trip's stable order. The card says so.
//
// Payments are the other half of the ledger: money already handed over, moving
// one balance towards zero and the other back down. They net in with the
// expenses rather than crossing a transfer off, because the transfers are only
// ever a suggestion of the fewest payments that would square the trip — the
// next expense redraws them, and a repayment made yesterday still counts.
function settlement(expenses = S.expenses, members = S.members, payments = S.payments) {
  if (!members.length) return { expenses: 0, total: 0, rounded: false, transfers: [], settled: 0 }
  const known = new Map(members.map((m) => [m.id, m]))
  const balances = new Map(members.map((m) => [m.id, 0]))
  let count = 0, total = 0, rounded = false

  for (const expense of expenses) {
    const amount = Number(expense.amount)
    const payerId = expense.paid_by
    const sharing = new Set(expense.participants ?? [])
    const participants = members.filter((member) => sharing.has(member.id))
    if (!Number.isSafeInteger(amount) || amount <= 0 || !known.has(payerId) || !participants.length) continue

    const custom = expense.shares !== null && expense.shares !== undefined
    let portions
    if (custom) {
      portions = participants.map((member) => Number(expense.shares?.[member.id]))
      if (portions.some((share) => !Number.isSafeInteger(share) || share <= 0)
          || portions.reduce((sum, share) => sum + share, 0) !== amount) continue
    } else {
      const share = Math.floor(amount / participants.length)
      const remainder = amount % participants.length
      if (remainder) rounded = true
      portions = participants.map((_, i) => share + (i < remainder ? 1 : 0))
    }

    count++
    total += amount
    balances.set(payerId, balances.get(payerId) + amount)
    participants.forEach((member, i) => {
      balances.set(member.id, balances.get(member.id) - portions[i])
    })
  }

  let settledSum = 0
  for (const payment of payments ?? []) {
    const amount = Number(payment.amount)
    if (!Number.isSafeInteger(amount) || amount <= 0) continue
    if (!known.has(payment.from_member) || !known.has(payment.to_member)) continue
    if (payment.from_member === payment.to_member) continue
    settledSum += amount
    balances.set(payment.from_member, balances.get(payment.from_member) + amount)
    balances.set(payment.to_member, balances.get(payment.to_member) - amount)
  }

  const debtors = members.map((member) => ({ member, amount: -(balances.get(member.id) ?? 0) }))
    .filter((x) => x.amount > 0)
  const creditors = members.map((member) => ({ member, amount: balances.get(member.id) ?? 0 }))
    .filter((x) => x.amount > 0)
  const transfers = []
  let owing = 0, owed = 0
  while (owing < debtors.length && owed < creditors.length) {
    const amount = Math.min(debtors[owing].amount, creditors[owed].amount)
    transfers.push({ from: debtors[owing].member, to: creditors[owed].member, amount })
    debtors[owing].amount -= amount
    creditors[owed].amount -= amount
    if (!debtors[owing].amount) owing++
    if (!creditors[owed].amount) owed++
  }
  return { expenses: count, total, rounded, transfers, settled: settledSum }
}

// The same list with the people filled in, and anyone who has left the trip
// dropped: a name nobody can put a face to is not an answer to "who has this".
const crew = (it) => claimsOn(it)
  .map((c) => ({ ...c, member: memberById(c.member_id) }))
  .filter((c) => c.member)

// Who is up for a plan, in the trip's own order rather than the order the votes
// landed in — so the faces on a row stay where they are when somebody else says
// yes, and anyone who has left the trip drops off for the same reason as above.
const voters = (it) => S.members.filter((m) => it.votes.includes(m.id))

// A list of people, said the way you would say it. Used where the answer is
// read rather than counted — labels, and the line at the top of a plan.
const andList = (names) => (names.length < 2 ? (names[0] ?? '')
  : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`)

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
// your own page asks what is back in the car. See the pack-down on the Trip tab.
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
// The one answer in the day strip that is not a day: what nobody has got round
// to putting on one. A word rather than a date, so it can share the field with
// the days without ever being mistaken for one.
const NO_DAY = 'none'

// And the one answer on an item that is not a day either. `day` was doing two
// jobs at once — "nobody has said" and "this one is for the whole trip" — and
// they are different answers. The teabags are for every day of the trip; a
// dinner nobody has slotted is for none of them yet. Spelling both of them as
// an empty string meant pressing Sunday could say "Nothing on Sun 6 Sep" with
// the bread to cover it sitting on the list, and it meant "No day" filled up
// with things that were never going to have one.
const ALL_WEEK = 'any'
const allWeek = (it) => it.day === ALL_WEEK

// So a day of the trip holds what was put on that day, plus what was put on all
// of them. "No day" holds only what has not been answered — being all week is an
// answer, and a good one.
const onDay = (it, day) => (day === NO_DAY ? !it.day : it.day === day || allWeek(it))

const preCat = (it, f) => (!f.day || onDay(it, f.day)) && inKind(it, f.kind)
  && (!f.hide || !isSettled(it)) && matchesQuery(it, f.q)
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
    // A day you cannot see the bar for is a day you cannot get back off, so it
    // only counts where the bar is drawn — and never for a day the trip has
    // since stopped covering, which would leave the list empty with every tab
    // in the bar unpressed. The same goes for "No day" once the last thing
    // without one has been given one: the pill goes, so standing on it stops.
    day: dayTabs().includes(S.filter.day) || (S.filter.day === NO_DAY && offersNoDay())
      ? S.filter.day : '',
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

// ---- days -------------------------------------------------------------------

// A trip already knew when it was; an item did not. A day on an item is what
// turns the Plan tab from a board into an itinerary and the Eat list from a pile
// of food into meals — "have we actually got Sunday lunch covered?" is the
// question none of this could answer before.
//
// It is optional everywhere and always will be. A trip in March has no dates
// yet, and half of what is on the lists is not any particular day's — so a page
// with nothing dated on it is the page it has always been, not a broken version
// of the dated one.

const isDayString = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s ?? ''))

// Built out of the parts rather than through UTC: `toISOString` on a local noon
// is the day before in New Zealand, and the day a trip starts is the day where
// the trip is.
const isoOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// One heading per day is only a good idea for as long as a trip is a trip. A
// year mistyped as 2062 should not answer with thirteen thousand of them.
const TRIP_DAYS_MAX = 31

// The days of the trip, in order. Empty until it has a start date, which is the
// whole of "a trip with no dates still has to work": there is nothing to offer,
// so nothing about days is drawn at all.
function tripDays(trip) {
  const start = trip?.start_date
  if (!isDayString(start)) return []
  const d = new Date(`${start}T12:00:00`)
  if (Number.isNaN(+d)) return []
  const end = isDayString(trip?.end_date) && trip.end_date >= start ? trip.end_date : start

  const out = []
  for (let i = 0; i < TRIP_DAYS_MAX; i++) {
    const iso = isoOf(d)
    out.push(iso)
    if (iso >= end) break
    d.setDate(d.getDate() + 1)
  }
  return out
}

// "Fri 4 Sep" for a plan, which is a thing on a date. "Fri 4" for a meal, which
// is one of three on a day you have already been told — and the same form the
// forecast rows use, so the two lists of days on screen read alike.
const dayAt = (iso) => {
  const d = new Date(`${iso}T12:00:00`)
  return Number.isNaN(+d) ? null : d
}
// "Any day" is a day as far as anything reading one is concerned, so the two
// that put a day into words answer for it rather than leaving 'any' on screen.
const dayWords = (iso, opts) => {
  const d = dayAt(iso)
  return d ? dateFormat(opts).format(d) : iso
}
const dayFull = (iso) => (iso === ALL_WEEK ? ANY_DAY
  : dayWords(iso, { weekday: 'short', day: 'numeric', month: 'short' }))
const dayShort = (iso) => (iso === ALL_WEEK ? ANY_DAY
  : dayWords(iso, { weekday: 'short', day: 'numeric' }))

// Which of these is today, once the trip is the thing you are standing in rather
// than the thing you are planning. Working it out from the phone's own clock is
// the point: on the Saturday morning of the trip, which of these is today should
// not be arithmetic.
//
// Held rather than read, for two reasons. A render that straddled midnight could
// otherwise mark two days as today or none, and this is the one thing on the
// page that changes without anybody touching it — so something has to notice
// when it does. See watchMidnight.
let todayIso = isoOf(new Date())
const isToday = (iso) => iso === todayIso

// Whether the day has turned since the last time anybody looked, and the place
// the new one is written down. `now` is an argument so that the turn can be
// tested without waiting until midnight.
function dayTurned(now = isoOf(new Date())) {
  if (now === todayIso) return false
  todayIso = now
  return true
}

// Milliseconds until the next local midnight, plus a second so the timer lands
// on the far side of it rather than on the line. Local, and worked out by asking
// for hour 24 of today, which is the next midnight even on the nights the clocks
// move — a fixed 24 hours would drift by an hour twice a year.
function tillMidnight() {
  const at = new Date()
  at.setHours(24, 0, 0, 1)
  return Math.max(1000, at - Date.now())
}

// A phone left on the tab overnight kept the dot on yesterday. So the day is
// watched: a timer aimed at the next midnight, rescheduled from the clock each
// time rather than by adding a day to itself, so a late or early wake-up costs
// nothing. A sleeping phone does not run timers at all, which is what the check
// on the way back into the tab is for — see the visibilitychange below.
//
// The dot is not the only thing this fixes. "2 days to go" on the trip card has
// always been wrong by one from midnight until whenever you next touched it.
//
// Somebody typing is left alone, the same as the poll leaves them alone. The day
// has still turned by then — it is written down before the page is asked to
// redraw — so the next thing they do shows the new one.
// Whether somebody is in the middle of answering something. A dropdown counts:
// it is held open over the page it is part of, and rebuilding that page shuts it
// under the finger on its way to an answer. The sheet keeps what has already
// been picked either way — see unsaved() — but this is the difference between
// keeping an answer and not interrupting one.
const isEditing = () => !!document.activeElement?.matches?.('input, textarea, select')

function turnDay(now) {
  if (!dayTurned(now)) return
  if (isEditing()) return
  render()
}

function watchMidnight() {
  setTimeout(() => { turnDay(); watchMidnight() }, tillMidnight())
}
watchMidnight()

// The three meals a day has. Everything else on the Eat tab — the snacks, the
// drinks, the oil and the teabags — is not a meal and wants no day: it is there
// all weekend.
const MEALS = ['Breakfast', 'Lunch', 'Dinner']
const mealRank = (cat) => {
  const i = MEALS.indexOf(cat)
  return i < 0 ? MEALS.length : i
}

// The first pill in the picker, and an answer somebody can pick rather than the
// absence of one. It is named out loud because taking a day back off something
// has to be as easy as putting one on.
//
// One name, two meanings, and they are the same meaning to whoever taps it: not
// on a particular day. What differs is what that is worth on each tab. Food that
// is for any day is on the list for Sunday — the teabags are there on Sunday, so
// pressing Sunday shows them, and the pill writes ALL_WEEK. A plan for any day is
// not happening on Sunday; it is waiting for somebody to say when, so there the
// pill writes no day at all and the plan sits under All until it has one.
const ANY_DAY = 'Any day'
//
// Which leaves a third state on food with no pill of its own, because it is what
// nothing pressed looks like: nobody has answered yet. That is the pile "No day"
// is for, and it is the one worth being able to see.
const anyDayMeans = (plan) => (plan ? '' : ALL_WEEK)

// Days are worth offering on the two tabs where when is a real question. You
// pack the tent once, not on Saturday, so the packing list never asks.
const takesDays = (tab) => tab.id === 'eat' || isPlanTab(tab)

// The days the strip offers, which is the trip's own days on the two tabs that
// take them and nothing anywhere else. Empty is All, and All is not in here: it
// is the way out of a day rather than a day of its own.
const dayTabs = () => (takesDays(currentTab()) ? tripDays(S.trip) : [])

// And whether "No day" is on offer as well: the things nobody has got round to
// slotting, which is the question you start asking the moment you plan by day at
// all. It waits until the tab has both kinds on it, because a control that would
// show the whole list and one that would show none of it are both a control that
// does nothing — the same rule the search box and the hide chip already keep.
// That also means it lets go on its own once the last one is slotted.
//
// It is a filter chip and not a tab in the strip. The strip is the trip's
// calendar and every stop on it is a date; "no day" is not a date, and putting
// it in there made the calendar carry something that is not one of its days. It
// is a cut, like hiding what is sorted — so it lives with the cuts.
//
// It is still not a new meaning for All, though. All is the way back, and a
// filter that stayed on across a pressed day would leave that day with no one
// tap out of it. So it is exclusive with the strip: pressing it lets every day
// go, and pressing a day lets it go. A day and no day cannot both be true.
function offersNoDay() {
  if (!dayTabs().length) return false
  const all = itemsOn(currentTab())
  return all.some((i) => i.day) && all.some((i) => !i.day)
}

// No tab is filed by day, though. The day is a strip in the header on both of
// them, and the headings underneath stay what they have always been: the meal on
// Eat, the kind of thing on Plan.
//
// The Plan tab was headed by days for a while, on the argument that an itinerary
// *is* a list of days. Two goes at it were worse than the strip both times — a
// heading for every day of the trip made a ten-day trip ten headings saying
// "nothing yet", and dropping the empty ones only meant the page reorganised
// itself under you as things were dated. And with the strip in the header, a day
// heading is the second copy of a control that is already on screen: press
// Saturday up there and the page is Saturday, so a heading saying so underneath
// is the page repeating itself. The accordion is for the other question — what
// kind of thing is this — and that question has one answer all week.
//
// The same reasoning killed the day in the Eat headings, where it also turned
// five headings into fifteen with "Dinner" among them five times.
//
// Which day a sheet opened from here should arrive holding: the one you are
// standing on, and nothing at all if where you are standing is "No day".
const seedDay = () => (activeFilter().day === NO_DAY ? '' : activeFilter().day)

// So the only thing that makes a row's day already-said is having pressed it —
// and "No day" says the opposite, so the rows under it still offer to be given
// one, which is the whole reason you would be standing there.
const daySaid = () => {
  const day = activeFilter().day
  return !!day && day !== NO_DAY
}

function fmtDates(trip) {
  const f = (d) => (d ? dayFull(d) : '')
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
  const dm = (d) => `${d.getDate()} ${dateFormat({ month: 'short' }).format(d)}`
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
// draws them on dark canvas, the Trip tab draws all four of them on paper.
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
//
// It takes the load rather than fetching it, because the two places that draw
// this bar want different loads: the header narrows with the chips on screen,
// and the Trip tab has no chips and must not inherit yesterday's.
function loadParts(load) {
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

// The chips narrow the bar with the page, the same as they do on a list.
const mineParts = () => loadParts(myLoad().filter((it) => inKind(it, activeFilter().kind)))

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
// than about what is on it. A long list is worth searching whether or not it has
// headings to fold, so the box earns its place on its own — but the fold button
// only ever earns one beside it. On its own above a row of chips it reads as a
// stray control rather than a row of tools, and a list too short to search is
// too short for folding to be worth a button.
//
// `shown` is the list as it stands, not the list as it was filed: press Thursday
// and eight ideas become one, and a search box over a single row is a control
// asking you to narrow what a tap has already narrowed. The one thing that never
// takes the box away is the box — whatever is typed in it keeps it on screen, or
// searching down to two results would delete the field mid-word.
function listTools(shown) {
  const f = activeFilter()
  const groups = pageGroups()
  if (shown.length < FIND_MIN && !f.q) return ''
  const foldable = groups.length > 1 && !f.cat && !f.q.trim()

  const allShut = foldable && groups.every(([name]) => isShut(name))
  return `
    <div class="tools">
      <div class="find">
        <span class="find__icon" aria-hidden="true">${ICONS.find}</span>
        <label class="sr-only" for="cs-find">Search this list</label>
        <input class="find__box" id="cs-find" data-find value="${esc(f.q)}"
               placeholder="Search this list" enterkeyhint="search" inputmode="search"
               autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" maxlength="60">
        ${f.q ? `<button class="find__x" data-act="find-clear" aria-label="Clear the search">${ICONS.x}</button>` : ''}
      </div>
      ${foldable ? `
        <button class="tools__fold" data-act="fold-all" data-shut="${!allShut}"
                aria-label="${allShut ? 'Unfold every section' : 'Fold every section'}">
          <span class="tools__caret${allShut ? ' tools__caret--shut' : ''}" aria-hidden="true">${ICONS.caret}</span>
          ${allShut ? 'Unfold all' : 'Fold all'}</button>` : ''}
    </div>`
}

function filterBar(all, kinds, count) {
  const f = activeFilter()
  // An empty page has nothing to narrow; let its empty state own the screen.
  if (!all.length) return ''

  const kindChip = (key) => {
    const [n, yours] = count(key)
    return `
      <button class="filters__chip" data-act="filter-kind" data-value="${key}" aria-pressed="${f.kind === key}">
        ${SECTIONS[key].label}${n ? `<span class="filters__n"${yours
          ? ` style="background:${colorOf(meMember())};color:var(--on-forest)"` : ''}>${n}</span>` : ''}</button>`
  }

  const catChip = (cat) => `
    <button class="filters__chip" data-act="filter-cat" data-value="${esc(cat)}"
            aria-pressed="${f.cat === cat}">${esc(cat)}</button>`

  // The categories on offer are the ones left after everything else has had its
  // say, so the row never offers a cut that comes back empty.
  const cats = [...new Set(all.filter((i) => preCat(i, f)).map(catOf))]

  // The one cut that answers the strip above rather than narrowing under it, so
  // it leads the row: it is the tail of the same question, and pressing it lets
  // every day go. The count is quiet — undated is not unclaimed, and blaze means
  // only ever the one thing. It goes when there is nothing left under it, unless
  // that is where you are standing, which needs the way back to stay on screen.
  const loose = all.filter((i) => !i.day && inKind(i, f.kind)).length
  const dayChip = !offersNoDay() || (!loose && f.day !== NO_DAY) ? '' : `
    <button class="filters__chip" data-act="filter-day" data-value="${NO_DAY}"
            aria-pressed="${f.day === NO_DAY}">No day${loose
      ? `<span class="filters__n filters__n--quiet">${loose}</span>` : ''}</button>
    <span class="filters__div" aria-hidden="true"></span>`

  // Most of a packing list is settled by the time you leave, and the part that
  // is not is the whole reason you opened it. This is the biggest cut on the
  // page and it wears no blaze: what it hides is the handled half, not the gap.
  const settled = all.filter((i) => inKind(i, f.kind) && isSettled(i)).length
  const hideChip = !settled && !f.hide ? '' : `
    <button class="filters__chip" data-act="filter-hide" aria-pressed="${f.hide}">
      ${ICONS.tickGreen}${S.tab === 'mine' && !goingHome() ? 'Hide packed' : 'Hide sorted'}
      ${settled ? `<span class="filters__n filters__n--quiet">${settled}</span>` : ''}</button>
    <span class="filters__div" aria-hidden="true"></span>`

  // The two at the front are the ones somebody came looking for rather than
  // reached for, so they are on screen without scrolling the row: what still has
  // no day, and who cannot eat what.
  return `
    <div class="filters" role="group" aria-label="Filter this list">
      ${dayChip}
      ${currentTab().lists.includes('food') ? dietChip() : ''}
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
  // A day with nothing on it is the answer to the question days were added for,
  // so it is not a dead end: it says which day, and it offers to fill it. This
  // is "have we actually got Sunday lunch covered?" — you press Sunday, and
  // either the food is there or this is.
  // Standing on "No day" with nothing under it only happens with another filter
  // on, because the pill lets go of itself once everything has a day. Which is
  // worth saying out loud, since it is the good ending.
  if (f.day === NO_DAY && !q) {
    return `
      <div class="empty">
        <h3>Everything has a day</h3>
        <p>${f.cat || f.kind || f.hide
          ? 'Nothing without a day that also matches the other filters.'
          : 'Nothing on this list is still waiting to be put on one.'}</p>
        <button class="empty__or" data-act="filter-day" data-value="">or show every day</button>
      </div>`
  }
  if (f.day && !q) {
    return `
      <div class="empty">
        <h3>Nothing on ${esc(dayFull(f.day))}</h3>
        <p>${f.cat || f.kind || f.hide
          ? 'Nothing for this day that also matches the other filters.'
          : 'Nobody has put anything on this day yet.'}</p>
        <button class="btn btn--blaze" data-act="add-to" data-day="${esc(f.day)}" data-cat="">
          Add something for ${esc(dayShort(f.day))}</button>
        <button class="empty__or" data-act="filter-day" data-value="">or show every day</button>
      </div>`
  }
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

// What goes inside a face. Google hands over a photograph at sign-in and the app
// was drawing two letters over the top of it, which is a worse likeness of
// somebody than the likeness we already had.
//
// The initials stay for everyone Google has no picture of — someone who joined
// by link and typed a name, a member added on their behalf — so this is the
// better answer where there is one and the old one everywhere else. Their colour
// is on the ring either way: it is the same colour as their share of the
// coverage bar and their tick, and those cannot carry a face.
//
// `referrerpolicy` because Google's picture host does not need to be told which
// trip was open when it was asked for.
const faceInner = (who) => (who?.picture
  ? `<img class="face__photo" src="${esc(who.picture)}" alt="" loading="lazy"
       decoding="async" referrerpolicy="no-referrer">`
  : esc(initials(who?.name)))

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
              style="--who:${colorOf(c.member)}">${faceInner(c.member)}${c.packed && c.member.picture
          ? `<span class="who__tick" aria-hidden="true">${ICONS.tick}</span>` : ''}</span>`).join('')}</span>
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

// When a thing happens, in whatever is still worth saying. On an itinerary the
// heading overhead has already said which day, so the chip is down to the hour;
// anywhere else it is the whole answer. Nothing at all until the trip has dates,
// because until then there is no day to offer and a chip that opens onto an
// apology is worse than no chip.
//
// `offer` is whether an empty one is worth a prompt. A plan row has room for the
// invitation — the same row already offers a place — but thirty rows of food
// each asking to be given a day is a list you cannot read. There the way in is
// the item sheet, and the chip only ever appears once there is something to say.
// Standing on Saturday says a row's day for it — except for the rows that are
// there every day, which are on Saturday's page without being Saturday's. Those
// keep saying so, or the page cannot tell what it has for Saturday from what it
// has all week, which is the whole reason they are both on it.
function whenChip(item, offer) {
  if (!tripDays(S.trip).length) return ''
  const dated = daySaid() && !allWeek(item)
  const said = [dated ? '' : item.day && dayShort(item.day), item.time].filter(Boolean).join(' · ')
  if (!said) {
    return !offer ? '' : `<button class="tag" data-act="when" data-id="${item.id}">
              ${ICONS.clock} Add a ${dated ? 'time' : 'day'}</button>`
  }
  return `<button class="chip chip--when" data-act="when" data-id="${item.id}">
            ${ICONS.clock}<span class="chip__where">${esc(said)}</span></button>`
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

  const meta = [
    // Food keeps its meal heading, so the day is the one thing the row does not
    // already say — and only when there is one.
    takesDays(currentTab()) ? whenChip(item, plan) : '',
    plan ? placeChip(item) : '',
    plan ? votesChip(item) : '',
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

// "3 up for it" tells you the kayaking is on without telling you whether it is
// on with the people you would go with — which is the thing you are deciding
// when you look. So the count is spent on faces instead: the same faces the rest
// of the app uses for who has a thing, saying who is up for this one. Three
// faces is as many as a row can hold, so past two people the words go back to
// being the total — the faces show you the shape of it, the number says how far
// it goes past them, and the sheet has every name.
//
// Two names still fit as words, and words are the plainer answer, so up to two
// get said. Past that the faces carry it and the sheet spells the rest out —
// which is where the chip goes, and why it is a button rather than a label.
//
// Nothing at all when nobody has voted: the empty ring on the left already says
// so, and the row is asking you, not telling you.
//
// You go first when you are on it, so the three faces that fit always include
// your own — a row that has dropped you off the end reads as though you never
// said, which is the one thing about it you already know.
function votesChip(item) {
  const on = voters(item).sort((a, b) => Number(b.id === S.me) - Number(a.id === S.me))
  if (!on.length) return ''
  const names = on.map((m) => (m.id === S.me ? 'You' : m.name))
  const few = on.length <= 2
  const said = few
    ? `${andList(names)} ${names.length === 1 && names[0] !== 'You' ? 'is' : 'are'} up for it`
    : `${on.length} up for it`

  // What the button says, and then what it did not have the width to. The
  // visible words come first and whole: somebody driving this by voice says the
  // words they can see, and a label that starts somewhere else is a button they
  // cannot ask for. The names it could not fit follow, for the reader that has
  // room for them.
  const label = `${said} — ${item.title}${few ? '' : `: ${andList(names)}`}. Open to see who.`

  return `
    <button class="votes" data-act="open-item" data-id="${item.id}"
            aria-label="${esc(label)}">
      <span class="who__faces">${on.slice(0, FACES).map((m) => `
        <span class="who__face" style="--who:${colorOf(m)}">${faceInner(m)}</span>`).join('')}</span>
      <span class="votes__say">${esc(said)}</span>
    </button>`
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

// Where signing in or out puts you: back where you were standing. Every one of
// these paths used to end at the home page, which was right while the only
// place to sign in from was the home page. Settings can do it too, and being
// thrown off the page you deliberately opened — with the URL still claiming you
// are on it — is the app losing your place, not taking you anywhere.
async function afterAuthChange() {
  if (S.view === 'settings') {
    // The alerts belonged to the session that has just been replaced.
    S.alerts = null
    render()
    return
  }
  // The address bar says where you are, not the trip left over in memory from
  // earlier in the visit — signing in from the home page after reading a trip
  // used to drag you back into that trip, on a URL that said otherwise.
  const found = tripRoute()
  if (found) await openTrip(found.code)
  else await showLanding()
}

function googleSignIn(note = 'Your account keeps your name and trips together across devices.') {
  const dev = S.auth.devBypass
    ? '<button class="btn btn--wide auth__dev" data-act="dev-sign-in">Continue as developer</button>'
    : ''
  if (!S.auth.clientId) {
    return dev || '<p class="auth__unavailable">Google sign-in has not been configured on this server yet.</p>'
  }
  return `<div class="auth" aria-busy="${S.authBusy}">
            <div class="auth__google" data-google></div>
            ${dev}
            ${note ? `<p class="auth__note">${esc(note)}</p>` : ''}
          </div>`
}

// Signing out used to be here, next to your name, which made the one row about
// the account a row with one thing you could do to it. Everything about the
// account now lives on one page, and this points at it — including for somebody
// who has not signed in, who has a theme and a set of switches all the same.
function accountBlock() {
  return `<section class="landing__account">
            <span>${S.auth.user ? `Signed in as <b>${esc(S.auth.user.name)}</b>` : ''}</span>
            <a class="btn btn--sm btn--quiet" href="${SETTINGS_PATH}" data-act="settings">Settings</a>
          </section>`
}

function applyAuth(data) {
  S.auth = {
    loaded: true,
    clientId: String(data?.clientId ?? S.auth.clientId ?? ''),
    devBypass: !!data?.devBypass,
    user: data?.user ?? null,
    memberships: Array.isArray(data?.memberships) ? data.memberships : [],
  }
  // A server-linked membership is authoritative. This also completes the
  // one-time migration after Google sign-in without making people rejoin.
  for (const m of S.auth.memberships) {
    if (!m?.tripId || !m?.memberId) continue
    localStorage.setItem(meKey(m.tripId), m.memberId)
    rememberTrip(m.tripId)
  }
}

const legacyMemberships = () => localTrips().map((tripId) => ({
  tripId, memberId: localStorage.getItem(meKey(tripId)),
})).filter((m) => m.memberId)

async function signedInWithGoogle(result) {
  if (S.authBusy || !result?.credential) return
  S.authBusy = true
  try {
    applyAuth(await api('/auth/google', {
      method: 'POST', body: { credential: result.credential, legacyMemberships: legacyMemberships() },
    }))
    toast('Signed in. Your trips are linked to this account.')
    await afterAuthChange()
  } catch (err) {
    toast(err.message)
  } finally {
    S.authBusy = false
    render()
  }
}

let googleFor = ''
function renderGoogleButtons() {
  const g = window.google?.accounts?.id
  if (!g || !S.auth.clientId) return
  if (googleFor !== S.auth.clientId) {
    g.initialize({ client_id: S.auth.clientId, callback: signedInWithGoogle })
    googleFor = S.auth.clientId
  }
  for (const slot of root.querySelectorAll?.('[data-google]') ?? []) {
    if (slot.dataset.ready) continue
    slot.dataset.ready = 'true'
    g.renderButton(slot, { type: 'standard', theme: 'outline', size: 'large', text: 'signin_with', shape: 'rectangular' })
  }
}

document.getElementById('google-identity')?.addEventListener('load', renderGoogleButtons)

// A signed-in name wins; otherwise whoever you were last time is probably who
// you are this time on an old, not-yet-linked trip.
const lastKnownName = () => S.auth.user?.name || (S.trips ?? []).map((t) => t.you?.name).find(Boolean) || ''

function createBlock(folded) {
  if (folded && !S.showCreate) {
    return `<section class="landing__block">
              <button class="btn btn--wide" data-act="show-create">${ICONS.plus} Start another trip</button>
            </section>`
  }
  if (!S.auth.user) {
    return `<section class="landing__card">
              <h2>Start a trip</h2>
              <p>Sign in first so this trip follows you to another phone and nobody else can speak as you.</p>
              ${googleSignIn()}
            </section>`
  }
  return `
    <section class="landing__card">
      <h2>Start a trip</h2>
      <p>Takes about twenty seconds. You'll get a link to send your friends — no app to install.</p>
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
        <label class="field"><span>Currency</span>
          <input name="currency" value="GBP" maxlength="3" pattern="[A-Za-z]{3}" required
                 list="currency-codes" autocomplete="off" autocapitalize="characters" spellcheck="false">
          <datalist id="currency-codes"><option value="GBP"><option value="EUR"><option value="USD"><option value="CAD"><option value="AUD"><option value="NZD"></datalist></label>
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
              <div class="demo-bar__seg" style="flex:4;background:var(--m0)"></div>
              <div class="demo-bar__seg" style="flex:3;background:var(--m1)"></div>
              <div class="demo-bar__seg" style="flex:2;background:var(--m2)"></div>
              <div class="demo-bar__seg demo-bar__seg--gap"></div>
            </div>
          </div>`}
      </div>
    </header>

    <main class="landing__body">
      <div class="landing__stack">${accountBlock()}${blocks}${installBlock()}</div>
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
  const card = !S.auth.user ? `
      <div class="landing__card">
        <h2>Sign in to join</h2>
        <p>Your friends will know messages and packing claims really came from you.</p>
        ${googleSignIn('One sign-in reconnects your trips on every device.')}
      </div>` : S.joinClash ? joinClashCard() : `
      <div class="landing__card">
        <h2>How should your name appear?</h2>
        <p>This is the name shown next to everything you're bringing.</p>
        <form data-act="join">
          <label class="field"><span>Name</span>
            <input name="name" value="${esc(S.auth.user.name)}" placeholder="Sam" autocomplete="name" required maxlength="40" autofocus></label>
          <button class="btn btn--primary btn--wide" type="submit">Join the trip</button>
        </form>
      </div>`
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
      ${card}
    </main>
  </div>`
}

// ---- settings ---------------------------------------------------------------

// A switch, said the same way everywhere it appears. The label is the control:
// the whole row is the button, so the target is a row rather than a 40px pill,
// which is the difference between working and not working on a phone in a tent.
function toggleRow({ act, id, on: isOn, label, note, busy = false }) {
  return `
    <button class="switch" role="switch" aria-checked="${isOn}" data-act="${act}"${id ? ` data-id="${esc(id)}"` : ''}
            ${busy ? 'disabled' : ''}>
      <span class="switch__say">
        <span class="switch__label">${esc(label)}</span>
        ${note ? `<span class="switch__note">${esc(note)}</span>` : ''}
      </span>
      <span class="switch__track" aria-hidden="true"><span class="switch__knob"></span></span>
    </button>`
}

// Who you are, everywhere. The name and picture come from Google and are
// rewritten from it at every sign-in, so there is nothing here to edit — the
// name you can change is the one on a particular trip, which is a different
// name on purpose and is edited where it is used, beside the people on it.
function settingsAccount() {
  if (!S.auth.user) {
    return `
      <section class="card set-card">
        <h2>Account</h2>
        <p class="card__body">Signing in keeps your name and your trips together, so the same list opens on your phone and your laptop, and nobody else can speak as you.</p>
        ${googleSignIn('')}
      </section>`
  }

  const { name, email, picture } = S.auth.user
  const trips = S.auth.memberships.length
  return `
    <section class="card set-card">
      <h2>Account</h2>
      <div class="account">
        ${picture
          ? `<img class="account__face" src="${esc(picture)}" alt="" width="48" height="48" referrerpolicy="no-referrer">`
          : `<span class="account__face account__face--none" aria-hidden="true">${esc(initials(name))}</span>`}
        <div class="account__who">
          <b>${esc(name)}</b>
          ${email ? `<span>${esc(email)}</span>` : ''}
        </div>
      </div>
      <p class="set-note">${trips
        ? `${trips} trip${trips === 1 ? '' : 's'} on this account. Your name and picture come from Google — what you are called on a particular trip is set on that trip, beside everyone else's.`
        : 'No trips on this account yet.'}</p>
      <button class="btn btn--wide btn--quiet" data-act="sign-out">Sign out</button>
    </section>`
}

function settingsAppearance() {
  const following = S.prefs.theme === 'system'
  return `
    <section class="card set-card">
      <h2>Appearance</h2>
      <div class="segmented" role="group" aria-label="Theme">
        ${THEMES.map((t) => `
          <button type="button" class="segmented__btn" aria-pressed="${S.prefs.theme === t.id}"
                  data-act="theme" data-value="${t.id}">${t.label}</button>`).join('')}
      </div>
      <p class="set-note">${following
        ? `Following this device, which is ${prefersDark() ? 'dark' : 'light'} at the moment.`
        : 'This device only. A theme is about the screen in your hand and the light it is in, so it is not carried to your other ones.'}</p>
    </section>`
}

// Two questions that read as one and are not: whether this browser is allowed
// to show a notification at all, and what is worth being told. The first belongs
// to the device, the second to you — answer it here and your laptop obeys it too.
//
// Which trips may notify you is deliberately not here any more. It was a switch
// per trip on a page that has to stay readable, and somebody with ten trips got
// ten rows of it; the question belongs to a trip, and the bell in its own
// Planning Room is where it is asked.
function settingsNotifications() {
  if (!S.auth.user) {
    return `
      <section class="card set-card">
        <h2>Notifications</h2>
        <p class="card__body">Sign in to be reminded about your trips. A trip can still be muted from its Planning Room in the meantime.</p>
      </section>`
  }

  const a = S.alerts
  if (!a || a.loading) {
    return `
      <section class="card set-card">
        <h2>Notifications</h2>
        <p class="card__body">Checking…</p>
      </section>`
  }

  // A request that never arrived is not the same answer as "off, and off".
  // Drawn as switches, the failure would read as settings — the wrong ones, in
  // the calm voice of the right ones — so it says what happened and offers the
  // one thing worth doing about it.
  if (a.error) {
    return `
      <section class="card set-card">
        <h2>Notifications</h2>
        <p class="card__body">${esc(a.error)}</p>
        <button class="btn btn--quiet" data-act="retry-alerts">Try again</button>
      </section>`
  }

  // Whether this browser can be notified, and what you want to be told, are two
  // answers, and only the first one is this browser's. A device that cannot ring
  // keeps the reminder switches: they are what your phone will obey.
  const unsupported = a.permission === 'unsupported'
  const blocked = a.permission === 'denied'
  const device = unsupported
    ? '<p class="set-note">This browser cannot show notifications. On an iPhone they arrive once the app is added to the home screen.</p>'
    : blocked
      ? '<p class="set-note set-note--warn">Notifications are blocked for this site in your browser settings. Nothing here can turn them back on — that switch is the browser\'s.</p>'
      : a.subscribed
        ? `${toggleRow({
            act: 'device-alerts', on: true, busy: a.busy,
            label: 'Notify me on this device',
            note: 'Turning this off leaves everything below alone and stops this browser only.',
          })}`
        : `${toggleRow({
            act: 'device-alerts', on: false, busy: a.busy,
            label: 'Notify me on this device',
            note: 'Planning Room messages and the reminders below, while the app is closed.',
          })}`

  // Two nudges, two switches, because they are two questions: three days out is
  // about the group's list and the morning of is about your own, and wanting one
  // is no reason to want the other.
  //
  // Both are asked once rather than once per trip. Ten trips would have been
  // twenty switches on a page whose whole job is to be readable, and "remind me
  // three days before a trip" was never a fact about one August weekend anyway.
  const reminders = `
    <div class="switches">
      ${toggleRow({
        act: 'reminder', id: 'lead', on: a.reminders.lead, busy: a.busy,
        label: 'Three days out',
        note: 'How many things nobody has claimed, while there is still time to sort it.',
      })}
      ${toggleRow({
        act: 'reminder', id: 'morning', on: a.reminders.morning, busy: a.busy,
        label: 'The morning of',
        note: 'What is still unticked on your own kit list.',
      })}
    </div>`

  return `
    <section class="card set-card">
      <h2>Notifications</h2>
      ${device}
      <h3 class="set-sub">Remind me about my trips</h3>
      <p class="set-note">Kept with your account rather than this browser, and answered for every trip you are on. A trip's Planning Room has its own bell for what people say in it.</p>
      ${reminders}
    </section>`
}

function settingsFeatures() {
  return `
    <section class="card set-card">
      <h2>Features</h2>
      <p class="card__body">Everything here is on to start with. Turning one off only changes what this device shows you — nobody else's trip loses anything.</p>
      <div class="switches">
        ${FEATURES.map((f) => toggleRow({
          act: 'feature', id: f.id, on: wants(f.id), label: f.label, note: f.note,
        })).join('')}
      </div>
    </section>`
}

function viewSettings() {
  return `
    <div class="app app--focus">
      <header class="topbar topbar--bare topbar--focus">
        <div class="roombar">
          <a class="roombar__back" href="${esc(S.settingsBack)}" data-act="leave-settings">
            <span aria-hidden="true">${ICONS.back}</span>
            <span class="sr-only">Back</span>
          </a>
          <h1 class="roombar__title">Settings</h1>
          <span class="roombar__balance" aria-hidden="true"></span>
        </div>
      </header>
      <main class="page set-page">
        ${settingsAccount()}
        ${settingsAppearance()}
        ${settingsNotifications()}
        ${settingsFeatures()}
      </main>
    </div>`
}

// The days of the trip as a strip you swipe, at the top of the page.
//
// This is a filter, not a heading and not a table: tap Sunday and the page is
// Sunday. That is the whole of "have we got Sunday lunch covered?" — you look,
// and either something is there or the page says nothing is. It costs one row,
// it reads the same at one day and at thirty, and a trip where nobody is
// planning by day simply never leaves All.
//
// It sat in the header for a while, which was wrong twice over. The header says
// which trip you are on and nothing else — putting a control in it made the one
// fixed thing on screen a thing you could change. And it stood over the chips
// that do the same job, so the page narrowed itself from two places at once.
// Down here the day is the first of the three, and it scrolls away with them,
// which is the same argument the filter chips already won.
//
// The weekday over the date is the shape every calendar uses, so it needs no
// explaining; All keeps the left-hand end, where the thumb starts.
function dayBar() {
  const days = dayTabs()
  if (!days.length) return ''
  const now = activeFilter().day

  const tab = (day, body, label) => `
    <button class="daybar__tab" data-act="filter-day" data-value="${esc(day)}"
            aria-pressed="${now === day}" aria-label="${esc(label)}">${body}</button>`

  // One track, in the same paper and the same hairline as the search box under
  // it, because on the page a control with no surface reads as stray text. The
  // track is the object; the days inside it are text until one is pressed.
  //
  // Two elements rather than one: the days fade out at whichever end there is
  // more of them, and a fade is a mask, and a mask over the track would take
  // the track's own border and corner with it. So the track holds, and the row
  // inside it scrolls and fades.
  return `
    <div class="daybar">
      <div class="daybar__row" role="group" aria-label="Which day of the trip">
        ${tab('', '<span class="daybar__all">All</span>', 'Every day of the trip')}
        ${days.map((d) => {
          const at = dayAt(d)
          // The dot is drawn on every day and coloured in on one, so today does
          // not sit two pixels higher than the days either side of it.
          const now = isToday(d)
          return tab(d, `
            <span class="daybar__dow">${esc(at ? dateFormat({ weekday: 'short' }).format(at) : d)}</span>
            <span class="daybar__num">${esc(at ? at.getDate() : '')}</span>
            <span class="daybar__now${now ? ' daybar__now--on' : ''}"></span>`,
          now ? `${dayFull(d)}, today` : dayFull(d))
        }).join('')}
      </div>
    </div>`
}

// One height, always: which trip you are on, and the two facts that identify
// it. Nothing here is a control any more — the way to the trip page is the Trip
// tab — so the header is purely a sign saying where you are standing.
function roomNotificationButton() {
  if (!S.notify.available) return '<span class="roombar__balance" aria-hidden="true"></span>'
  const on = S.notify.subscribed && !S.notify.muted
  const label = !S.notify.subscribed
    ? 'Turn on Planning Room notifications'
    : S.notify.muted ? 'Unmute Planning Room notifications' : 'Mute Planning Room notifications'
  return `<button class="roombar__notify${on ? ' roombar__notify--on' : ''}" data-act="chat-notifications"
    aria-label="${label}" title="${label}" ${S.notify.busy ? 'disabled' : ''}>
    ${S.notify.muted ? ICONS.bellOff : ICONS.bell}
  </button>`
}

function topbar() {
  if (S.camp === 'room' || S.camp === 'settle') {
    const settling = S.camp === 'settle'
    return `
      <header class="topbar topbar--bare topbar--focus">
        <div class="roombar">
          <!-- Back to whatever you were reading when you opened this, which is
               not always the trip page — so the arrow says "Back" and means it.
               The href is the trip, which is where this lands when there is
               nothing behind it, and where a new tab should open. -->
          <a class="roombar__back" href="/t/${encodeURIComponent(S.trip.id)}" data-act="leave-focus">
            <span aria-hidden="true">${ICONS.back}</span>
            <span class="sr-only">Back</span>
          </a>
          <h1 class="roombar__title" id="${settling ? 'settle-up-title' : 'planning-room-title'}">${settling ? 'Settle up' : 'Planning Room'}</h1>
          ${settling
            ? `<button class="roombar__currency mono" data-act="currency" aria-label="Change trip currency">${esc(tripCurrency())}</button>`
            : roomNotificationButton()}
        </div>
      </header>`
  }

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
  // The signpost beside the name is the way out of the trip. The tabs move you
  // around inside one, and the browser's own back button is not on screen in an
  // installed app — so without this, opening a trip was a one-way door.
  return `
    <header class="topbar${under ? '' : ' topbar--bare'}${S.camp ? ' topbar--trip' : ''}">
      <h1 class="sr-only">${esc(S.trip.name)} — ${esc(S.camp === 'room' ? ROOM.title : S.camp ? CAMP.title : tabTitle(tab))}</h1>
      <div class="topbar__row">
        <a class="topbar__home" href="/" data-act="home" aria-label="Back to your trips" title="Your trips">
          <span aria-hidden="true">${ICONS.signpost}</span>
        </a>
        <div class="topbar__trip">
          <span class="topbar__title">${esc(S.trip.name)}</span>
          ${meta ? `<span class="topbar__meta">${meta}</span>` : ''}
        </div>
        <!-- The two ways out of the list you are reading, at the two ends of the
             row: the fingerpost leaves the trip, the cog leaves the app itself.
             It sat at the foot of the trip page, which meant scrolling a long
             page on one tab out of five to reach something that has nothing to
             do with that page. The Planning Room and Settle up headers already
             put their one control in this same right-hand slot. -->
        <a class="topbar__cog" href="${SETTINGS_PATH}" data-act="settings"
           aria-label="Settings" title="Settings">
          <span aria-hidden="true">${ICONS.cog}</span>
        </a>
      </div>
      ${under}
    </header>`
}

// A heading is a heading and a handle. Fourteen things under Camp kitchen is a
// screen and a half you scroll past to reach Clothing, so every section folds —
// and folded, its tally is still on screen, which is the part you were reading
// the section for anyway. Shut sections are left out of the page rather than
// hidden in it: nothing to scroll through, nothing to tab into.

// Days first, then whatever a day the trip has not got — somebody shortens a
// trip and Sunday's plans do not stop existing, they just stop being on it.
const byDay = (days) => {
  const order = new Map(days.map((d, i) => [d, i]))
  return (a, b) => (order.get(a) ?? Infinity) - (order.get(b) ?? Infinity) || (a < b ? -1 : a > b ? 1 : 0)
}

// Inside a heading on the Plan tab, time runs forward: the day, then the hour,
// then whatever order the list already had. Whatever has no hour follows the
// hours of its own day — "sometime on Saturday" belongs to Saturday, not to nine
// in the morning — and whatever has no day at all goes last, where it is still a
// plan: "we should swim at some point" is an answer, not an omission.
const byDayTime = (days) => {
  const day = byDay(days)
  const has = (x) => (x ? 0 : 1)
  return (a, b) =>
    has(a.day) - has(b.day) || (a.day && b.day ? day(a.day, b.day) : 0) ||
    has(a.time) - has(b.time) || (a.time < b.time ? -1 : a.time > b.time ? 1 : 0)
}

// The headings on the page as it stands, in the order it draws them, each with
// what is under it. One answer for every kind of page, so "fold all" and the
// auto-folding are looking at exactly what you are.
function pageGroups() {
  const f = activeFilter()
  const tab = currentTab()
  const shown = pageParts().items.filter((it) => matchesFilter(it, f))
  if (S.tab === 'mine') {
    // Grouped by the tab each thing came from, in tab order, so the page maps
    // onto the app you already know.
    return TABS.filter((t) => t.lists.length && !isPlanTab(t))
      .map((t) => [t.label, t.lists.flatMap((l) => shown.filter((it) => it.list === l))])
      .filter(([, list]) => list.length)
  }

  // The plans are filed by kind like everything else, but read in the order they
  // happen: a category with Saturday's swim above Thursday's hike is a list you
  // have to sort in your head.
  const days = tripDays(S.trip)
  const when = isPlanTab(tab) && days.length ? byDayTime(days) : null
  const groups = groupByCategory(shown)
    .map(([cat, list]) => [cat, when ? [...list].sort(when) : list])

  // Breakfast, lunch, dinner is the order a day happens in, and the grid at the
  // top of the Eat tab says so. A list under it running dinner, breakfast, lunch
  // — whatever order things were added in — is the page disagreeing with itself.
  // Snacks and drinks are not meals and tie, so a stable sort leaves them in the
  // order they were, after the meals.
  if (tab.id === 'eat') groups.sort((a, b) => mealRank(a[0]) - mealRank(b[0]))

  // An empty heading means "nobody has covered this", which is only true of a
  // page showing everything. Behind a filter it would mean "nothing here matches
  // what you asked for", and a row of those is not a gap, it is noise.
  const narrowed = !!(f.day || f.kind || f.cat || f.hide || f.q.trim())
  return narrowed ? groups.filter(([, list]) => list.length) : groups
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
    return groupSection(cat, isPlan(list[0]) ? `${list.length}` : tally,
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
  // And what is left before anything is typed, which is what the search box has
  // to justify itself against — see listTools.
  const found = pool.filter((i) => matchesFilter(i, { ...f, q: '' }))
  const items = found.filter((i) => matchesQuery(i, f.q))
  const c = statsFor(all)
  const count = (key) => (key === 'own' ? [c.own - c.mine, true] : [c.open, false])

  let body
  // With suggestions turned off in settings, writing your own is not the
  // quieter of two offers any more — it is the offer, and it takes the loud
  // button rather than leaving the empty page with a link where a door was.
  const suggests = wants('suggestions')
  // An empty list has nothing to sit at the foot of, so the two ways to fill it
  // move into the card and the loud one leads.
  if (!pool.length) {
    body = `
      <div class="empty">
        <h3>${f.kind === 'own' ? 'Your list is empty' : 'Nothing here yet'}</h3>
        <p>${f.kind === 'own'
           ? 'The things nobody can bring for you — a sleeping bag, a headtorch, your own boots. Only you will see what you put here.'
           : suggests ? 'Pull in the usual suspects, or write your own.' : 'Write the first thing on it.'}</p>
        ${suggests
          ? `<button class="btn btn--blaze" data-act="suggest">What am I missing?</button>
             <button class="empty__or" data-act="add">or write your own</button>`
          : '<button class="btn btn--blaze" data-act="add">Add the first thing</button>'}
      </div>`
  } else if (!items.length) {
    body = noMatch(f)
  } else {
    body = `${categoryGroups(pageGroups(), !f.kind)}
      <div class="listfoot">
        <button class="listfoot__add" data-act="add">
          <span class="listfoot__plus">${ICONS.plus}</span>Add your own
        </button>
        ${suggests ? `<button class="listfoot__ask" data-act="suggest">${ICONS.spark}What am I missing?</button>` : ''}
      </div>`
  }

  // No standing paragraph over the list: it cost the same few lines on every
  // tab, every visit, to say something you read once. The chips say what the
  // list is now, and the sheets say what each half means as you use them.
  //
  // Three narrowings, widest first: which day, then find-one-thing, then who is
  // bringing it and what kind of thing it is. A list with nothing on it gets
  // none of them — there is no day of the trip on which nothing is still
  // nothing, and the empty card is the only thing worth reading.
  return `
    <main class="page">
      ${all.length ? dayBar() : ''}
      ${listTools(found)}
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
    // Your own page groups by the tab a thing came from, so the day heading that
    // carried this on the Eat tab is not here to carry it. Saturday's dinner is
    // a different armful of the car from Friday's.
    item.day ? dayShort(item.day) : '',
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
// Trip tab leads with the one number they add up to.
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

// What the trip is still waiting on, as one number and one place to go.
//
// "Open" means here what the blaze means on every list: nobody has picked this
// up. An idea with no vote is unfinished in a different sense — it is waiting on
// an opinion rather than on a person — so it is the line you get once the lists
// are covered rather than a number added into them. Counting the two together
// would also be the one thing the bar never does, which is add up things people
// have to act on differently.
function openWork() {
  const lists = TABS.filter((t) => t.lists.length && !isPlanTab(t))
    .map((t) => ({ tab: t, n: statsFor(itemsOn(t)).open }))
  const need = lists.reduce((sum, x) => sum + x.n, 0)

  if (need) {
    // The button goes to whichever list is worst off. A tie goes to the earlier
    // tab, which is the order the rows underneath already read in.
    const worst = lists.reduce((best, x) => (x.n > best.n ? x : best))
    return {
      say: `<b>${need}</b> ${need === 1 ? 'thing still needs' : 'things still need'} someone`,
      go: worst.tab.label, to: worst.tab.id,
    }
  }

  const plan = TABS.find(isPlanTab)
  const ideas = statsFor(itemsOn(plan))
  const rest = ideas.ideas - ideas.wanted
  if (rest) {
    return {
      say: `<b>${rest}</b> ${rest === 1 ? 'idea is' : 'ideas are'} waiting on a vote`,
      go: plan.label, to: plan.id,
    }
  }

  // Covered and empty are different answers, and only one of them is good news.
  return S.items.some((it) => !isOwn(it))
    ? { say: 'Everything is covered.' }
    : { say: 'Nothing on the lists yet.', go: 'Pack', to: 'pack' }
}

// Every other tab shows you one list. This is the only place you can see all of
// them at once, which is what the tab is for.
//
// It takes where the row goes and what to call it rather than a tab, because one
// of the rows is your own load — which is not a list, has no tab object to read
// a title off, and would otherwise be the fourth bar people have to go and find.
function readyRow({ label, title, to, parts: p }) {
  return `
    <button class="ready__row" data-act="tab" data-tab="${to}">
      <span class="ready__name">${label}</span>
      <span class="ready__track" role="img" aria-label="${title}: ${p.aria}">${p.empty ? '' : p.segs}</span>
      <span class="ready__say">${p.empty ? '<span class="ready__none">nothing yet</span>' : (p.short ?? p.say)}</span>
    </button>`
}

function statusCard() {
  // The whole top line of the card, not just the number: turning the countdown
  // off and being left with "No dates yet" in the slot it used to fill would be
  // the countdown still talking, in its least useful voice.
  const c = wants('countdown') ? countdown(S.trip) : null
  const work = openWork()
  const rows = [
    ...TABS.filter((t) => t.lists.length)
      .map((t) => ({ label: t.label, title: tabTitle(t), to: t.id, parts: barParts(t, 'shared') })),
    // Unfiltered on purpose: this bar is the whole of what you are carrying, and
    // a chip left on a list two taps ago has no business shrinking it.
    { label: 'Yours', title: tabTitle(tabById('mine')), to: 'mine', parts: loadParts(myLoad()) },
  ]

  return `
    <section class="card status" aria-label="How the trip is looking">
      <span class="eyebrow">How it's looking</span>
      ${c ? `
        <p class="countdown">
          ${c.n ? `<span class="countdown__n">${c.n}</span><span class="countdown__word">${c.word}</span>`
                : `<span class="countdown__word countdown__word--alone">${c.word}</span>`}
        </p>`
      : !wants('countdown') ? '' : `
        <button class="countdown countdown--ask" data-act="set-dates">
          <span class="countdown__word countdown__word--alone">No dates yet</span>
          <span class="countdown__go">Set them</span>
        </button>`}
      <div class="status__work">
        <p class="status__say">${work.say}</p>
        ${work.to ? `<button class="btn btn--sm" data-act="tab" data-tab="${work.to}">${work.go}</button>` : ''}
      </div>
      <div class="ready">${rows.map(readyRow).join('')}</div>
      ${S.items.some(isOwn) ? `<p class="status__mine">Yours is what you have claimed plus your own kit. Nobody else can see the personal half.</p>` : ''}
    </section>`
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

// A forecast is the one thing on the Trip tab nobody has to fill in: the trip
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

// Only ever asked once per question, and never at all until the Trip tab is on
// screen — see the tail of render(). The answer is thrown away when the question
// changes, which is what stops last week's forecast sitting under a new pin.
function wantWeather() {
  const key = wxKey(S.trip)
  if (!key || S.wx?.key === key) return
  S.wx = { key, state: 'load' }
  S.wxOpen = null   // an open day belongs to the forecast it was opened on
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
  if (S.camp === 'overview') render()
}

// The first day the forecast will reach a trip that is still too far off, so the
// card can say when to come back rather than just that it cannot help.
function wxOpens(start) {
  const d = new Date(`${start}T12:00:00`)
  if (Number.isNaN(+d)) return ''
  d.setDate(d.getDate() - 15)
  return dateFormat({ day: 'numeric', month: 'long' }).format(d)
}

// The rest of the numbers, spelled out rather than abbreviated — this is the
// line that says what the 24% in the row above it was a percentage of.
function wxDetail(d) {
  return [
    d.pop !== null ? `${Math.round(d.pop)}% chance of rain` : '',
    d.rain !== null ? `${d.rain.toFixed(1)} mm` : '',
    d.wind !== null ? `wind to ${Math.round(d.wind)} km/h` : '',
  ].filter(Boolean).join(' · ')
}

function wxRow(d) {
  const [word, glyph] = wxOf(d.code)
  // Two numbers per row and no more. Rain is the one people act on, so it gets
  // the third slot when there is any to speak of, and the wind takes it when
  // there is more of that than of rain.
  const wet = d.pop !== null && d.pop >= 20 ? `${Math.round(d.pop)}%` : ''
  const blow = !wet && d.wind !== null && d.wind >= 30 ? `${Math.round(d.wind)} km/h` : ''
  const detail = wxDetail(d)
  const open = !!detail && S.wxOpen === d.date

  // Nothing to open means nothing to press: a row with no numbers behind it
  // stays a row, rather than a button that answers a tap with nothing.
  const row = `
    <span class="wx__when">${esc(dayShort(d.date))}</span>
    <span class="wx__glyph" aria-hidden="true">${WX_ICONS[glyph]}</span>
    <span class="wx__word">${esc(word)}</span>
    <span class="wx__temp">${d.hi === null ? '' : `<b>${Math.round(d.hi)}°</b>`}${
      d.lo === null ? '' : `<span>${Math.round(d.lo)}°</span>`}</span>
    <span class="wx__wet mono">${esc(wet || blow)}</span>`

  return `
    <li class="wx__row${open ? ' wx__row--open' : ''}">
      ${detail ? `
        <button class="wx__day" data-act="wx-day" data-date="${esc(d.date)}"
                aria-expanded="${open}">${row}</button>`
      : `<div class="wx__day">${row}</div>`}
      ${open ? `<p class="wx__detail">${esc(detail)}</p>` : ''}
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
  // Turned off in settings: the card goes, and with it the request behind it —
  // see the guard on wantWeather in render, which is what stops a card nobody
  // is showing from still asking the forecast service every time.
  if (!wants('weather')) return ''
  const t = S.trip
  // Nothing to forecast for and nothing worth nudging about: a trip with no
  // dates has not got to the point where the weather is a question.
  if (!t.start_date) return ''

  // A place typed by hand has no coordinates behind it, so there is nowhere to
  // ask about. Worth one line, because the fix is to pick the place from the
  // search — and the same pin is what turns the map button into a real one.
  // Three of the ways this card has nothing to forecast are still the weather
  // card, on quieter paper: a loose line of text between two cards reads as
  // something that has gone wrong, and takes the heading out of the outline
  // with it.
  if (t.lat == null || t.lon == null) {
    return `
      <div class="card card--quiet">
        <h3>Weather</h3>
        <p class="card__body">Pick the site from the search under <b>When and where</b> and the forecast comes with it. A place typed by hand has no coordinates to look one up from.</p>
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
      <div class="card card--quiet">
        <h3>Weather</h3>
        <p class="card__body">Too far off to forecast — nothing beyond about a fortnight is worth packing for.${
          opens ? ` Check back around <b>${esc(opens)}</b>.` : ''}</p>
      </div>`
  }

  if (wx.state === 'fail' || !wx.days.length) {
    return `
      <div class="card card--quiet">
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

// When the trip is and where it is, in one card and one form. They used to be
// two — a "Getting there" card holding the address, and a "Trip details" form in
// the other column holding the name and the dates — which put the answer to the
// one question people come back for the night before they drive in two places,
// and made changing it two saves to the same endpoint.
//
// `S.editWhere` carries which field asked for the form, so that pressing "No
// dates yet" up in the status card lands on the date rather than on the address.
function whenWhereCard() {
  const where = String(S.trip.location ?? '').trim()
  const when = fmtDates(S.trip)
  const link = mapsHref(S.trip)

  if (S.editWhere || !where) {
    const dates = S.editWhere === 'dates'
    // Nothing is autofocused mid-save: the page redraws once while the request
    // is in flight, and a field grabbing focus then would fetch the keyboard
    // back for the frame before the form closes.
    const focus = (mine) => (!S.busy && dates === mine ? 'autofocus' : '')
    return `
      <div class="card">
        <h3>When and where</h3>
        <p>Start typing and pick the place — that way everyone gets the pin, not just the name of it. Anything you type by hand is fine too.</p>
        <form data-act="save-trip">
          <label class="field"><span>Trip name</span>
            <input name="name" value="${esc(S.trip.name)}" maxlength="80"></label>
          <div class="field field--split">
            <label class="field"><span>Arrive</span>
              <input type="date" name="start_date" value="${esc(S.trip.start_date)}" ${focus(true)}></label>
            <label class="field"><span>Leave</span>
              <input type="date" name="end_date" value="${esc(S.trip.end_date)}"></label>
          </div>
          <label class="field places"><span>Where</span>
            <input name="location" value="${esc(where)}" maxlength="200" ${focus(false)}
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
        <h3>When and where</h3>
        <button class="btn btn--sm" data-act="edit-where">Edit</button>
      </div>
      <p class="where">
        <span class="where__pin" aria-hidden="true">${ICONS.pin}</span>
        <span class="notes">${esc(where)}</span>
      </p>
      ${stayStrip(when)}
      <div class="where__go">
        ${link ? `<a class="btn btn--primary" href="${esc(link)}" target="_blank" rel="noopener noreferrer">${ICONS.pin} Open in maps</a>` : ''}
        <button class="btn" data-act="copy-where">Copy address</button>
      </div>
    </div>`
}

// The stay, drawn as the two ends it actually has: the day you arrive, the day
// you leave, and the nights in between on the line that joins them. It was one
// line of text — "Fri, Sep 11 – Fri, Sep 18" — which made you count on your
// fingers for the one number the whole thing is about, and put the answer to
// "which weekend is this?" in the same weight as the address under it.
//
// The two ends face each other rather than both starting at the left margin.
// Nothing else in the card is a pair, so the mirroring is what says these two
// dates are the same fact read from either side.
function stayStrip(sentence) {
  const at = (s) => (isDayString(s) ? dayAt(s) : null)
  const a = at(S.trip.start_date)
  const b = at(S.trip.end_date)
  if (!a && !b) {
    return `<p class="stay stay--ask">
      <button class="when__ask" data-act="set-dates">Add the dates</button>
    </p>`
  }

  const end = (d, cap, side) => `
    <div class="stay__end stay__end--${side}">
      <span class="stay__cap">${cap}</span>
      <span class="stay__date">
        <b>${d.getDate()}</b>${esc(dateFormat({ month: 'short' }).format(d))}
      </span>
      <span class="stay__dow">${esc(dateFormat({ weekday: 'long' }).format(d))}</span>
    </div>`

  // One date is a real answer to give — a trip booked before anyone knows which
  // day they are driving home has a start and nothing else — so it gets the end
  // it has and no line off into nowhere.
  if (!a || !b || +a === +b) {
    const only = a ?? b
    return `
      <div class="stay stay--one">
        <span class="sr-only">${esc(sentence)}</span>
        <div aria-hidden="true">${end(only, a && b ? 'The day' : a ? 'Arrive' : 'Leave', 'in')}</div>
        ${a && b ? '<span class="stay__tag" aria-hidden="true">day trip</span>' : ''}
      </div>`
  }

  const nights = Math.round((b - a) / 86400000)
  return `
    <div class="stay">
      <span class="sr-only">${esc(sentence)}, ${nights} ${nights === 1 ? 'night' : 'nights'}</span>
      <div class="stay__row" aria-hidden="true">
        ${end(a, 'Arrive', 'in')}
        <span class="stay__span">
          <span class="stay__nights">${nights} ${nights === 1 ? 'night' : 'nights'}</span>
          <span class="stay__rule"></span>
        </span>
        ${end(b, 'Leave', 'out')}
      </div>
    </div>`
}

// Written once, read all weekend — so it reads as text, and only turns into a
// textarea when somebody actually wants to change it.
function notesCard() {
  const text = String(S.trip.notes ?? '').trim()

  if (S.editNotes) {
    return `
      <div class="card">
        <h3>Notes for everyone</h3>
        <p>The gate code, who's driving, where you're meeting.</p>
        <form data-act="save-notes">
          <label class="field"><span class="sr-only">Notes for everyone</span>
            <textarea name="notes" maxlength="4000" ${S.busy ? '' : 'autofocus'}
              placeholder="Gate code 1470. Meet at the Co-op car park at 9. Josh has the roof box.">${esc(S.trip.notes)}</textarea></label>
          <button class="btn btn--primary" type="submit">Save notes</button>
        </form>
      </div>`
  }

  // An empty card that opens a textarea at you is a card demanding to be filled
  // in. This one offers instead: most of the page is worth reading before the
  // notes are worth writing.
  if (!text) {
    return `
      <div class="card">
        <h3>Notes for everyone</h3>
        <p>The gate code, who's driving, where you're meeting — the things people ask twice.</p>
        <button class="btn btn--wide" data-act="edit-notes">Write it down</button>
      </div>`
  }

  return `
    <div class="card">
      <div class="card__head">
        <h3>Notes for everyone</h3>
        <button class="btn btn--sm" data-act="edit-notes">Edit</button>
      </div>
      <p class="card__body notes clamp${S.expand.notes ? ' is-open' : ''}" data-clamp="notes">${esc(text)}</p>
      <button class="btn btn--sm btn--wide more" data-act="expand" data-what="notes" hidden>
        ${S.expand.notes ? 'Show less' : 'Show all'}</button>
    </div>`
}

// ---- what people can eat ----------------------------------------------------

// Everyone with something to avoid. Shared on purpose, unlike personal kit: the
// whole value of writing it down is that whoever ends up cooking finds out
// without going round the table asking.
const diets = () => S.members.filter((m) => String(m.diet ?? '').trim())

// Two people who both wrote "vegan" are one fact about the shopping, not two.
// So identical needs pool into a single row and the faces beside it say who is
// behind it. Case and stray spacing are the same need typed twice; anything
// else is somebody's own words and keeps its own row.
function dietGroups() {
  const by = new Map()
  for (const m of diets()) {
    const need = String(m.diet).trim()
    const key = need.toLowerCase()
    if (by.has(key)) by.get(key).who.push(m)
    else by.set(key, { need, who: [m] })
  }
  // Whatever rules out the most dinners is the one to read first. Sort is
  // stable, so people who share a need stay in the order the trip lists them.
  return [...by.values()].sort((a, b) => b.who.length - a.who.length)
}

// Written the way a cook reads it, not the way it was entered: the thing to
// avoid is the line, and the people are the footnote. Whoever is doing Saturday
// dinner wants a short column of constraints to shop against, and asking them to
// pull that out of a list of names is work the page can do instead.
//
// It belongs at the top of the list people claim food from, not on a page about
// people: the moment it matters is the moment somebody says they will do Saturday
// dinner. Drawn only when there is something to say — a heading over an empty
// list would be on every Eat tab forever, and the way to fill it in is on the
// Trip tab beside the person it is about.
// Four rows is about the most this is worth where it sits over the claim
// buttons: a trip where everybody has something to avoid would otherwise push
// the names — the only reason that sheet is open — off the bottom of it. So the
// rest fold away behind a count, the way the tips and the feed do on Trip.
// Nothing is dropped quietly: the heading says how many there are first.
const DIET_ROWS = 4

function dietTable({ eyebrow, sheet, cap }) {
  const groups = dietGroups()
  if (!groups.length) return ''
  // How big the table is, which the old list never said: two people to cook
  // around reads very differently at a trip of three than at a trip of ten.
  const all = S.members.length
  const named = groups.reduce((n, g) => n + g.who.length, 0)
  const rest = all - named
  // Counted off the whole set, not the shown ones — folding rows away must not
  // change who the card says eats anything.
  const shown = cap && !S.expand.diets ? groups.slice(0, DIET_ROWS) : groups

  return `
    <div class="diets${sheet ? ` diets--${sheet === 'plain' ? 'plain' : 'sheet'}` : ''}">
      <div class="diets__head">
        <span class="eyebrow">${eyebrow}</span>
        <span class="diets__count mono">${named} of ${all}</span>
      </div>
      <ul class="diets__list">
        ${shown.map((g) => `
          <li class="diets__row">
            <span class="diets__what">${esc(g.need)}</span>
            <span class="diets__who" aria-label="${esc(g.who.map((m) => m.name).join(', '))}">
              ${g.who.map((m) => `
                <span class="who__face" style="--who:${colorOf(m)}"
                      aria-hidden="true">${faceInner(m)}</span>`).join('')}
            </span>
          </li>`).join('')}
      </ul>
      ${cap ? moreBtn('diets', groups.length, DIET_ROWS) : ''}
      ${rest ? `<p class="diets__rest">${rest === 1 ? 'One other eats' : `The other ${rest} eat`} anything.</p>` : ''}
    </div>`
}

// On the page itself it is a door, not a notice. What people cannot eat is
// reference — true all week, read on the two or three occasions somebody is
// actually deciding what to cook — and a standing card charges every visit to
// the Eat tab for something you look up on purpose. So the page keeps the one
// fact you cannot act on without: that there is something to know, and how
// much of it. The rest is a tap away.
//
// It rides in the chip row rather than on a line of its own. A lone control
// above the chips reads as something that fell off the page, and that row is
// already the one place a food tab keeps its small round controls — it scrolls
// sideways, so it takes another one for nothing, and the count wears the same
// quiet badge the Hide chip does.
function dietChip() {
  const n = diets().length
  if (!n) return ''
  return `
    <button class="filters__chip filters__chip--door" data-act="diets"
            aria-label="Dietary needs — ${n} ${n === 1 ? 'person' : 'people'}, open the list">
      Dietary needs<span class="filters__n filters__n--quiet">${n}</span></button>
    <span class="filters__div" aria-hidden="true"></span>`
}

// The list, once you have asked for it. No cap here: a dialog you opened on
// purpose scrolls, and hiding a row behind a second tap inside it would be
// hiding the thing you came for.
function sheetDiets() {
  return sheetShell({
    title: 'Dietary needs',
    blurb: 'What everybody has said they avoid. Add or change your own beside your name on the Trip tab.',
    body: dietTable({ eyebrow: 'At the table', sheet: 'plain' }),
  })
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

function settleDoor() {
  const settled = settlement()
  const next = settled.transfers[0]
  const detail = !settled.expenses
    ? 'No expenses yet. Add petrol, pitch fees or anything else the group shares.'
    : next
      ? `${next.from.name} owes ${next.to.name} ${moneyText(next.amount)}`
      : 'Everything recorded so far is square.'
  return `
    <a class="settle-door" href="/t/${encodeURIComponent(S.trip.id)}/settle" data-act="settle">
      <span class="settle-door__copy"><strong>Settle up</strong><span>${esc(detail)}</span></span>
      ${settled.expenses ? `<span class="settle-door__total mono">${moneyText(settled.total)}</span>` : ''}
      <span class="settle-door__go" aria-hidden="true">→</span>
    </a>`
}

function settlePage() {
  const settled = settlement()
  if (!settled.expenses && !S.payments.length) {
    return `
      <main class="page settle-page" aria-labelledby="settle-up-title">
        <section class="settle-empty">
          <h2>No expenses yet</h2>
          <p>Add petrol, the pitch fee or anything else people on this trip need to share.</p>
          <button class="btn btn--primary" data-act="new-expense">Add the first expense</button>
        </section>
      </main>`
  }

  return `
    <main class="page settle-page" aria-labelledby="settle-up-title">
      <div class="settle-page__intro">
        <p><b>${moneyText(settled.total)}</b> recorded across ${settled.expenses} ${settled.expenses === 1 ? 'expense' : 'expenses'}.${
          settled.settled ? ` <b>${moneyText(settled.settled)}</b> has been paid back.` : ''}</p>
        <button class="btn btn--primary" data-act="new-expense">${ICONS.plus} Add expense</button>
      </div>

      <section class="settle-section" aria-labelledby="settle-payments-title">
        <div class="settle-section__head">
          <h2 id="settle-payments-title">To settle</h2>
          <span>${settled.transfers.length} ${settled.transfers.length === 1 ? 'payment' : 'payments'}</span>
        </div>
        ${settled.transfers.length ? `
          <ul class="settle">
            ${settled.transfers.map((move) => `
              <li class="settle__row">
                <span><b>${esc(move.from.name)}</b> owes <b>${esc(move.to.name)}</b></span>
                <strong class="mono">${moneyText(move.amount)}</strong>
                <button class="btn btn--sm" data-act="settle-transfer" data-from="${move.from.id}" data-to="${move.to.id}" data-amount="${move.amount}">Mark paid</button>
              </li>`).join('')}
          </ul>` : `<p class="settle__square">Everyone is square.</p>`}
        ${S.members.length > 1 ? `
          <div class="settle__acts">
            <button class="btn btn--quiet btn--sm" data-act="settle-transfer">Record a payment</button>
          </div>` : ''}
        ${settled.rounded ? '<p class="settle__round">Rounding is to the penny. Any extra penny shares go to the first names shown under Who’s coming.</p>' : ''}
      </section>

      ${S.payments.length ? `
        <section class="settle-section" aria-labelledby="settle-paid-title">
          <div class="settle-section__head">
            <h2 id="settle-paid-title">Paid back</h2>
            <span>${moneyText(settled.settled)}</span>
          </div>
          <ul class="settle">
            ${S.payments.map((payment) => {
              const from = memberById(payment.from_member), to = memberById(payment.to_member)
              return `<li class="settle__row">
                <span><b>${esc(from?.name || 'someone')}</b> paid <b>${esc(to?.name || 'someone')}</b>${
                  payment.note ? ` · ${esc(payment.note)}` : ''}</span>
                <strong class="mono">${moneyText(payment.amount)}</strong>
                <button class="btn btn--sm btn--quiet" data-act="delete-payment" data-payment="${payment.id}">
                  Undo</button>
              </li>`
            }).join('')}
          </ul>
        </section>` : ''}

      ${S.expenses.length ? `
      <section class="settle-section" aria-labelledby="settle-expenses-title">
        <div class="settle-section__head">
          <h2 id="settle-expenses-title">Expenses</h2>
          <span>${esc(tripCurrency())}</span>
        </div>
        <ul class="expenses">
          ${S.expenses.map((expense) => {
            const payer = memberById(expense.paid_by)
            const people = (expense.participants ?? []).length
            const split = expense.shares ? `custom split between ${people}` : `shared equally by ${people}`
            return `<li>
              <button class="expense-row" data-act="expense" data-expense="${expense.id}">
                <span><b>${esc(expense.description)}</b><small>Paid by ${esc(payer?.name || 'someone')} · ${split}</small></span>
                <strong class="mono">${moneyText(expense.amount)}</strong>
              </button>
            </li>`
          }).join('')}
        </ul>
      </section>` : ''}
    </main>`
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
  return `
    <div class="card">
      <div class="card__head">
        <h3>Who's coming</h3>
        <button class="btn btn--sm" data-act="share">Invite</button>
      </div>
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
              <span class="person__face" style="--who:${colorOf(m)}" aria-hidden="true">${faceInner(m)}</span>
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
      <p class="invite__note">Anyone with the trip's link can see it. Only members can read or write in the planning room.</p>
    </div>`
}

// The same one-liner the server makes for the door, for a message that has just
// come down the socket rather than one that was already there when we asked.
// Including the Markdown coming off Camp's answers: the server does that before
// its own cut (unmark, in lib/fields.js), and a door that read `**` on the live
// message and plain words on the reloaded one would be two doors.
const previewOf = (m) => ({
  author: m.author_name || 'Someone',
  assistant: m.role === 'assistant',
  body: (m.role === 'assistant' ? unmark(m.body) : String(m.body ?? '')).replace(/\s+/g, ' ').trim(),
  at: m.created_at,
})

// A door with a count on it says how much you have missed. A door with the last
// thing said on it says whether it is worth opening, which is the question you
// actually have — and it is one line, so it stays a door rather than becoming a
// second, worse chat window.
function roomDoor() {
  const here = S.notify.tripId === S.trip.id
  const unread = here ? S.notify.unread : 0
  const last = here ? S.notify.latest : null
  return `
    <a class="room-door" href="/t/${encodeURIComponent(S.trip.id)}/room" data-act="room">
      <span class="room-door__icon" aria-hidden="true">${ICONS.room}</span>
      <span class="room-door__copy">
        <strong>Planning room</strong>
        ${last?.body ? `
          <span class="room-door__last">
            <b${last.assistant ? ' class="mono"' : ''}>${esc(last.author)}</b>
            ${esc(last.body)}</span>`
        : wants('assistant')
          ? '<span>Questions, decisions and <span class="mono">@camp</span> help live here.</span>'
          : '<span>Questions and decisions live here, where they can be found later.</span>'}
      </span>
      <span class="room-door__go">${unread
        ? `<span class="room-door__unread">${unread > 99 ? '99+' : unread} new</span>`
        : 'Open <span aria-hidden="true">→</span>'}</span>
    </a>`
}

// What a reply is answering, drawn above it. A quote is a jump when the message
// it names is on screen somewhere and a plain block of text when it is not —
// rather than a control that looks the same either way and does nothing half the
// time. Scrolling back far enough turns the same quote into a button, which is
// the answer to "why can I press that one and not this one".
function quoteBlock(reply) {
  if (!reply) return ''
  const here = S.chat.messages.some((m) => Number(m.id) === Number(reply.id))
  const inner = `
    <span class="sr-only">Replying to</span>
    <b${reply.assistant ? ' class="mono"' : ''}>${esc(reply.author)}</b>
    <span class="thread__quote-said">${esc(reply.body)}</span>`
  return here
    ? `<button class="thread__quote" type="button" data-act="chat-quote" data-id="${esc(String(reply.id))}">${inner}</button>`
    : `<p class="thread__quote thread__quote--away">${inner}</p>`
}

// The pin, drawn above the room it heads rather than in the thread where it
// would scroll away like everything else. It follows the same rule a quote does:
// a jump while the message it names is on the loaded page, a plain block once
// you have not scrolled back far enough to reach it — a control that only works
// half the time is worse than one that admits which half it is in.
function pinBanner() {
  const pin = S.pinned
  if (!pin) return ''
  const here = S.chat.messages.some((m) => Number(m.id) === Number(pin.id))
  const inner = `
    <span class="pinned__mark" aria-hidden="true">${ICONS.tack}</span>
    <span class="pinned__copy">
      <small>Pinned · <b${pin.assistant ? ' class="mono"' : ''}>${esc(pin.author)}</b></small>
      <span>${esc(pin.body)}</span>
    </span>`
  return `
    <div class="pinned">
      ${here
        ? `<button class="pinned__jump" type="button" data-act="chat-quote" data-id="${esc(String(pin.id))}"
             aria-label="Go to the pinned message from ${esc(pin.author)}">${inner}</button>`
        : `<div class="pinned__jump pinned__jump--away">${inner}</div>`}
      <button class="pinned__drop" type="button" data-act="chat-unpin"
        aria-label="Unpin this message">${ICONS.x}</button>
    </div>`
}

// What the pin button on a message is offering to do, which depends on what is
// already pinned. Saying "replacing Sam's" out loud is the point: one slot means
// pinning is always a choice against something, and a button that hid that would
// be quietly spending a decision somebody else made.
function pinLabel(message, isPinned) {
  if (isPinned) return 'Unpin this message'
  const held = S.pinned
  return held ? `Pin this message, replacing ${held.author}'s` : 'Pin this message'
}

function chatRows() {
  const messageRows = S.chat.messages.map((message) => {
    const member = memberById(message.member_id)
    const when = new Date(message.created_at)
    const assistant = message.role === 'assistant'
    const mine = message.member_id === S.me
    const isPinned = Number(S.pinned?.id) === Number(message.id)
    const pinning = pinLabel(message, isPinned)
    // A message is somebody talking, so it is signed with them rather than with
    // a coloured tab standing in for them. Other people's names stay: at this
    // size a face is recognition, not identification, and the two together are
    // how you read a room you have scrolled back through. Your own bubble is
    // already signed by its side and face, so repeating your name there adds no
    // information; screen readers still get the simpler author label "You".
    //
    // Whoever wrote it may have left the trip since. The message keeps the name
    // it was sent under, so the face falls back to that rather than to nothing.
    return `
      <li class="thread__message${mine ? ' thread__message--mine' : ''}${assistant ? ' thread__message--assistant' : ''}${isPinned ? ' thread__message--pinned' : ''}"
        id="msg-${esc(String(message.id))}">
        ${assistant
          ? `<span class="thread__mark" aria-hidden="true">${ICONS.camp}</span>`
          : `<span class="thread__mark thread__mark--face" aria-hidden="true"
               style="--who:${member ? colorOf(member) : 'var(--ink-faint)'}"
               >${faceInner(member ?? { name: message.author_name })}</span>`}
        <div class="thread__content">
          <div class="thread__meta">
            ${mine
              ? '<strong class="sr-only">You</strong>'
              : `<strong>${esc(message.author_name)}${assistant ? ' <span class="thread__camp mono">assistant</span>' : ''}</strong>`}
            <time class="mono" datetime="${esc(message.created_at)}" title="${esc(dateFormat(STAMP).format(when))}">${dateFormat(CLOCK).format(when)}</time>
            <button class="thread__reply" type="button" data-act="chat-reply" data-id="${esc(String(message.id))}"
              aria-label="Reply to ${esc(message.author_name)}">${ICONS.reply}</button>
            <button class="thread__pin${isPinned ? ' thread__pin--on' : ''}" type="button"
              data-act="${isPinned ? 'chat-unpin' : 'chat-pin'}" data-id="${esc(String(message.id))}"
              aria-pressed="${isPinned}" title="${esc(pinning)}"
              aria-label="${esc(pinning)}">${ICONS.tack}</button>
          </div>
          ${quoteBlock(message.reply)}
          ${assistant ? `<div class="assistant-copy">${assistantHtml(message.body)}</div>` : `<p>${esc(message.body)}</p>`}
        </div>
      </li>`
  }).join('')
  const streamRows = Object.values(S.chat.streams).map((stream) => `
    <li class="thread__message thread__message--assistant thread__message--streaming"
      data-assistant-stream="${esc(stream.runId)}" data-state="${esc(stream.state)}"
      aria-busy="${stream.state === 'failed' ? 'false' : 'true'}">
      <span class="thread__mark" aria-hidden="true">${ICONS.camp}</span>
      <div class="thread__content">
        <div class="thread__meta">
          <strong>Camp <span class="thread__camp mono">assistant</span></strong>
          <span class="thread__status mono" data-assistant-status>${stream.state === 'failed' ? 'Could not answer' : 'Writing…'}</span>
        </div>
        <div class="assistant-copy" data-assistant-body>${assistantHtml(stream.body || stream.error || 'Thinking…')}</div>
      </div>
    </li>`).join('')
  return messageRows + streamRows
}

// Two different noes wearing one word. The server says whether Camp can answer
// at all — no key, no assistant — and the settings page says whether you want it
// to. Everything the room draws asks this rather than the flag underneath, so
// turning Camp off puts the room back to being the group talking, including the
// @camp completion and what the sr-only help promises.
const assistantOn = () => S.chat.assistantAvailable && wants('assistant')

function chatCard() {
  const chat = S.chat
  const waiting = chat.tripId !== S.trip.id || chat.loading
  const rows = chatRows()

  return `
    <section class="chat-card chat-card--page" aria-labelledby="planning-room-title" aria-busy="${waiting}">
      <span class="sr-only chat__connection mono" data-chat-connection
        data-state="${esc(chat.connection)}" role="status" aria-live="polite">${chatConnectionLabel(chat.connection)}</span>
      <p class="sr-only" id="chat-help">${assistantOn()
        ? 'Keep decisions with the trip. Start with <span class="mono">@camp</span> to ask about the trip, or to have it change the lists, plans, notes and costs. Replying to one of its messages asks it as well.'
        : 'Keep decisions with the trip, where everybody can find them later.'}</p>
      ${waiting || chat.error ? '' : pinBanner()}
      <div class="chat__body">
        ${waiting ? '<div class="skel" aria-label="Loading messages"></div>' : chat.error ? `
          <div class="chat__error" role="alert">
            <p>${esc(chat.error)}</p>
            <button class="btn btn--sm" data-act="chat-retry">Try again</button>
          </div>` : `
          ${chat.hasMore ? `<button class="chat__older" data-act="chat-older"
            ${chat.loadingOlder ? 'disabled' : ''}>${chat.loadingOlder ? 'Loading…' : 'Earlier messages'}</button>` : ''}
          ${rows ? `
            <ol class="thread" aria-label="Planning messages">${rows}</ol>` : `
            <div class="chat__empty">
              <strong>No messages yet</strong>
              <span>Start with the decision the group needs to make next.</span>
            </div>`}`}
      </div>
      ${waiting || chat.error ? '' : `
        <form class="chat__composer" data-act="send-message">
          <label class="sr-only" for="chat-text">${assistantOn() ? 'Message the group or @camp' : 'Message the group'}</label>
          ${assistantOn() ? `
            <div class="chat__mention" id="chat-mention" role="listbox" aria-label="Mention Camp" hidden>
              <button class="chat__mention-option" id="chat-mention-camp" type="button" role="option"
                aria-selected="true" data-act="chat-mention">
                <span class="chat__mention-mark" aria-hidden="true">${ICONS.camp}</span>
                <span class="chat__mention-copy"><strong>Camp</strong><small>Trip assistant</small></span>
                <span class="chat__mention-handle mono">@camp</span>
              </button>
            </div>` : ''}
          ${chat.replyTo ? `
            <div class="chat__replying">
              <span class="chat__replying-mark" aria-hidden="true">${ICONS.reply}</span>
              <span class="chat__replying-copy">
                <small>Replying to <b${chat.replyTo.assistant ? ' class="mono"' : ''}>${esc(chat.replyTo.author)}</b>${
                  chat.replyTo.assistant && assistantOn() ? ' — it will answer' : ''}</small>
                <span>${esc(chat.replyTo.body)}</span>
              </span>
              <button class="chat__replying-drop" type="button" data-act="chat-reply-cancel"
                aria-label="Cancel reply">${ICONS.x}</button>
            </div>` : ''}
          <div class="chat__write">
            <textarea id="chat-text" name="text" rows="1" maxlength="2000" required
              aria-describedby="chat-help" aria-autocomplete="list"
              ${assistantOn() ? 'aria-controls="chat-mention"' : ''} aria-expanded="false"
              placeholder="${assistantOn() ? 'Message the group or @camp…' : 'Write a message…'}">${esc(chat.draft)}</textarea>
            <button class="btn btn--primary chat__send" type="submit" aria-label="${chat.busy ? 'Sending message' : 'Send message'}"
              ${chat.busy ? 'disabled' : ''}>${chat.busy ? '<span class="chat__sending" aria-hidden="true">…</span>' : ICONS.send}</button>
          </div>
        </form>`}
    </section>`
}

function roomPage() {
  return `
    <main class="room-page">
      ${chatCard()}
    </main>`
}

// Both long lists on this page open a few rows at a time, so neither of them
// buries what comes after it.
function moreBtn(what, total, shown) {
  if (total <= shown) return ''
  return `<button class="btn btn--sm btn--wide more" data-act="expand" data-what="${what}">
            ${S.expand[what] ? 'Show fewer' : `Show all ${total}`}</button>`
}

// Every card here says what it is in its own heading, so the page needs no
// titles over groups of them — "Essentials" and "Good to know" were labels for
// the layout rather than for anything a person came to find. What is left is an
// order: how the trip is looking, anything urgent, the details you drive to,
// then the reading matter at the bottom.
function campPage() {
  const tips = S.expand.tips ? S.tips : S.tips.slice(0, 3)
  const events = S.expand.feed ? S.events : S.events.slice(0, 8)

  return `
    <main class="page trip-page">
      <div class="trip-lead">
        ${statusCard()}
        ${roomDoor()}
      </div>

      ${homeCard()}

      <div class="trip-columns">
        <div class="trip-stack">
          ${whenWhereCard()}
          ${notesCard()}
          ${weatherCard()}
        </div>
        <div class="trip-stack">
          ${peopleCard()}
          ${settleDoor()}

          <div class="card">
            <h3>Recent changes</h3>
            <div class="feed">
              ${events.length ? events.map((e) => `
                <div class="feed__row">
                  <span class="feed__who">${esc(e.actor || 'Someone')}</span>
                  <span class="feed__what">${esc(e.text)}</span>
                  <span class="feed__when" title="${esc(dateFormat(STAMP).format(new Date(e.created_at)))}">${ago(e.created_at)}</span>
                </div>`).join('') : '<p class="card__body">Nothing yet.</p>'}
            </div>
            ${moreBtn('feed', S.events.length, 8)}
          </div>
        </div>
      </div>

      ${!wants('suggestions') || !S.tips.length ? '' : `
      <div class="card trip-smarts">
        <h3>Camp smarts</h3>
        <p>The things people find out the hard way on their first trip.</p>
        <div class="tips">
          ${tips.map((t) => `
            <div class="tip">
              <span class="tip__mark" aria-hidden="true">${ICONS.spark}</span>
              <div><h4>${esc(t.title)}</h4><p>${esc(t.body)}</p></div>
            </div>`).join('')}
        </div>
        ${moreBtn('tips', S.tips.length, 3)}
      </div>`}
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
  const roomUnread = S.notify.tripId === S.trip.id ? S.notify.unread : 0
  return `
    <nav class="tabbar" aria-label="Trip sections">
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
        const flagLabel = n ? `<span class="sr-only">${n} ${t.id === 'mine'
          ? (goingHome() ? 'items left to bring home' : 'items left to pack')
          : `unclaimed item${n === 1 ? '' : 's'}`}</span>` : ''
        return `<button class="tabbar__btn" data-act="tab" data-tab="${t.id}"
                  ${here ? 'aria-current="page"' : ''}>
                  <span class="tabbar__icon" aria-hidden="true">${ICONS[t.id]}${flag}</span>
                  <span class="tabbar__label">${t.label}</span>
                  ${flagLabel}
                </button>`
      }).join('')}
      <button class="tabbar__btn" data-act="camp" ${S.camp ? 'aria-current="page"' : ''}>
        <span class="tabbar__icon" aria-hidden="true">${ICONS.camp}${roomUnread
          ? `<span class="tabbar__flag tabbar__flag--chat">${roomUnread > 9 ? '9+' : roomUnread}</span>` : ''}</span>
        <span class="tabbar__label">${CAMP.label}</span>
        ${roomUnread ? `<span class="sr-only">${roomUnread} unread Planning Room message${roomUnread === 1 ? '' : 's'}</span>` : ''}
      </button>
    </nav>`
}

// The room, from wherever you are standing. The door on the trip page is the
// front one — wide, with the last thing said written on it — and this is the
// side entrance for the four lists, which otherwise reach the room through a
// page they did not ask for. It stays a button rather than becoming a second
// door: an icon, a count when there is one, and nothing to read. The trip page
// never gets it, because the door is already open on that screen and two ways
// into the same room, six inches apart, is one of them too many.
function roomFab() {
  if (S.camp) return ''
  const unread = S.notify.tripId === S.trip.id ? S.notify.unread : 0
  const label = unread
    ? `Planning room, ${unread} unread message${unread === 1 ? '' : 's'}`
    : 'Planning room'
  return `
    <a class="room-fab" href="/t/${encodeURIComponent(S.trip.id)}/room" data-act="room"
       aria-label="${label}" title="Planning room">
      <span class="room-fab__icon" aria-hidden="true">${ICONS.room}</span>
      ${unread ? `<span class="room-fab__unread" aria-hidden="true">${unread > 9 ? '9+' : unread}</span>` : ''}
    </a>`
}

function authNudge() {
  if (S.auth.user || !S.me) return ''
  return `<aside class="auth-nudge">
            <div><b>Keep this profile</b><span>Sign in once to use ${esc(meMember()?.name || 'your name')} on another device.</span></div>
            ${googleSignIn('')}
          </aside>`
}

function viewTrip() {
  const tab = currentTab()
  const page = S.camp === 'room' ? roomPage()
    : S.camp === 'settle' ? settlePage()
      : S.camp ? campPage() : tab.id === 'mine' ? minePage() : listPage()
  if (S.camp === 'room') return `<div class="app app--room">${topbar()}${page}</div>`
  if (S.camp === 'settle') return `<div class="app app--focus">${topbar()}${page}</div>`
  return `<div class="app">${topbar()}${authNudge()}${page}</div>${tabbar()}${roomFab()}`
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
  //
  // And, where a day means something, the way to it. A plan row carries its own
  // chip for this, but a bag of sausages does not — the heading it sits under is
  // where its day is said, and a heading is not something you can tap to change.
  const when = takesDays(tabForList(item.list)) && tripDays(S.trip).length
    ? `<button class="btn" data-act="when" data-id="${item.id}">When</button>`
    : ''
  const acts = `
    <div class="sheet__acts">
      ${when}
      <button class="btn" data-act="edit-item" data-id="${item.id}">Edit</button>
      <button class="btn btn--quiet" data-act="kill" data-id="${item.id}">Remove</button>
    </div>`

  if (own) {
    return sheetShell({
      title: item.title,
      blurb: 'This is on your own list. Nobody else on the trip can see it.',
      body: `${kindSwitch}
        <button class="pick" data-act="own" data-id="${item.id}" aria-pressed="${isMine(item)}">
          <span class="pick__swatch" style="background:${colorOf(me)}"></span>
          <span class="pick__main"><span class="pick__title">My kit is packed</span>
            <span class="pick__note">${isMine(item) ? 'Ticked off.' : 'Not yet.'}</span></span>
          <span class="pick__tick">${ICONS.tickGreen}</span>
        </button>`,
      foot: acts,
    })
  }

  // A plan sheet answers two questions about two different sets of people, so it
  // says which is which. Who is up for it comes first: it is the question the row
  // asks, and three faces deep is exactly as far as the row could answer it — the
  // point of opening this is to see the rest of the names.
  //
  // Your own name is a button and everybody else's is only a name. A vote is the
  // one thing on this trip you cannot cast for somebody else: putting Sam down
  // for the kayaking is how a plan ends up with five yeses and two kayakers.
  const upForIt = !plan ? '' : (() => {
    const up = voters(item)
    const voted = up.some((m) => m.id === S.me)
    return `
      <div class="sheet__group">
        <span class="eyebrow">Up for it</span>
        ${up.length ? `<ul class="up">${up.map((m) => `
          <li class="up__row">
            <span class="who__face" style="--who:${colorOf(m)}" aria-hidden="true">${faceInner(m)}</span>
            <span class="up__name">${esc(m.name)}${m.id === S.me ? ' (you)' : ''}</span>
          </li>`).join('')}</ul>` : '<p class="sheet__note">Nobody has said yet.</p>'}
        ${me ? `<button class="btn btn--wide btn--sm" data-act="vote" data-id="${item.id}" aria-pressed="${voted}">
          ${voted ? 'Actually, count me out' : "I'm up for it"}</button>` : ''}
      </div>`
  })()

  const on = new Map(claimsOn(item).map((c) => [c.member_id, c]))
  const rows = S.members.map((m) => {
    const claim = on.get(m.id)
    const expense = claim ? expenseForClaim(item.id, m.id) : null
    return `
      <div class="claim-row">
        <button class="pick" data-act="claim" data-id="${item.id}" data-member="${m.id}"
                aria-pressed="${!!claim}">
          <span class="pick__swatch" style="background:${colorOf(m)}"></span>
          <span class="pick__main"><span class="pick__title">${esc(m.name)}${m.id === S.me ? ' (you)' : ''}</span>
            ${claim ? `<span class="pick__note">${claim.packed ? 'Packed theirs.' : 'Not packed yet.'}</span>` : ''}</span>
          <span class="pick__tick">${ICONS.tickGreen}</span>
        </button>
        ${claim ? `<button class="claim-row__cost" data-act="expense" data-id="${item.id}" data-member="${m.id}"${expense ? ` data-expense="${expense.id}"` : ''}>
          ${expense ? `${moneyText(expense.amount)} · paid by ${esc(memberById(expense.paid_by)?.name || m.name)}` : 'Add what it cost'}</button>` : ''}
      </div>`
  }).join('')

  // Putting your name to Saturday dinner is the moment what somebody cannot eat
  // stops being a fact about them and becomes a fact about the shopping. So it
  // is said here, where the decision is, as well as at the top of the list.
  const table = (item.list === 'food' || item.list === 'drinks')
    ? dietTable({ eyebrow: 'Before you take this on', sheet: true, cap: true })
    : ''

  // The item, and then the names. There is no separate "I'll bring it" button:
  // your own name is in the list like everybody else's, and tapping it is the
  // same tap — a shortcut that duplicates the row underneath it only makes you
  // read both to work out whether they do the same thing.
  //
  // On a plan the names mean something narrower than "who is coming", and coming
  // to them straight after a list of everyone who is up for it is exactly when
  // they would be misread — so on a plan they get a heading that says so, and the
  // sentence about them moves down to sit with them rather than over everything.
  const named = !plan ? rows : `
    <div class="sheet__group">
      <span class="eyebrow">Organising it</span>
      <p class="sheet__note">Optional, and it can be more than one of you — only for the plans that need booking or kit.</p>
      ${rows}
    </div>`

  return sheetShell({
    title: item.title,
    blurb: plan ? '' : 'As many of you as it takes. Each person ticks off their own share.',
    body: `
      ${kindSwitch}
      ${table}
      ${upForIt}
      ${named}
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
        <div class="field--split">
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

// One choice out of a set, as a row of pills that wraps.
//
// Deliberately not the two-way switch: that is a sunken track with a slider in
// it, and a track says "one of these two". A trip is as often one night as it is
// a fortnight, so this control has to look right at two options and at thirty —
// which rules out anything that divides the width up between them. A day at one
// end of a week would be a sliver, and the last row of a wrapped grid stretches
// its two survivors to double the width of the ones above.
//
// Pills are the same size whatever there are of them: as wide as the words on
// them, packed from the left, wrapping when they run out of room. Nothing is
// hidden behind a swipe, nothing changes shape as the trip gets longer.
const pill = (label, pressed, attrs) => `
  <button type="button" class="days__chip" aria-pressed="${pressed}" ${attrs}>${esc(label)}</button>`

const pillRow = (label, pills) =>
  `<div class="days" role="group" aria-label="${esc(label)}">${pills}</div>`

// The days the pills are holding down, in the order the trip has them. One field
// carrying a list rather than a field per day: it is still the answer to "which
// day", and the sheet has one place to put it.
const daysPicked = (v) => String(v ?? '').split(',').filter(Boolean)

// And what that turns into: one row per day rather than one row that spans them.
// Everything this app counts hangs off a row — who has put their name to it,
// whether their share is in the car, whether the day is covered. A single row
// standing for three dinners would have Sunday covered the moment somebody
// agreed to bring Friday's, and blaze means one thing here: nobody has this yet.
// So three nights of noodles is three things to pick up, which is what it is.
const perDay = (one, days) => (days.length ? days : ['']).map((day) => ({ ...one, day }))

// Every row that is the same thing as this one. Bacon and eggs on Thursday and
// bacon and eggs on Friday are two rows, because a claim and a packed tick are
// per row — but they are one thing, and this sheet asks about the thing.
//
// The group counts, so noodles at lunch and noodles at dinner stay two separate
// questions rather than one Saturday that cannot say which of them it means.
const sameThing = (a, b) => a.list === b.list && a.kind === b.kind && catOf(a) === catOf(b)
  && String(a.title).trim().toLowerCase() === String(b.title).trim().toLowerCase()
const kinOf = (item) => S.items.filter((i) => sameThing(i, item))

// The same thing on another day: everything that describes it, and none of what
// happened to it. Claims and packed ticks stay behind, because agreeing to bring
// Friday's is not agreeing to bring Sunday's.
const copyTo = (item, day) => ({
  list: item.list, title: item.title, category: item.category, qty: item.qty, note: item.note,
  kind: item.kind, place: item.place, lat: item.lat, lon: item.lon, time: item.time, day,
})

// Who has put their name to it, for the one question worth asking out loud.
const namesOn = (item) => {
  const who = claimsOn(item).map((c) => memberById(c.member_id)?.name).filter(Boolean)
  if (!who.length) return 'Somebody has'
  return `${andList(who)} ${who.length === 1 ? 'has' : 'have'}`
}

// The days of the trip, plus the answer that is always available: no day at all.
// Taps land straight away and the sheet stays put — there is nothing to type, so
// there is nothing to save, and seeing the pill fill in is the confirmation.
//
// A multiple choice, because instant noodles three nights running is a normal
// thing to want. Pressed means there is a row of this thing on that day, so
// pressing an empty day puts one there and pressing a full one takes it away —
// and the one you cannot take away is the last, because a thing with no rows
// left is a thing removed, which is what Remove is for.
function dayPills(item) {
  const kin = kinOf(item)
  const on = new Set(kin.map((i) => i.day ?? ''))
  const one = (day, label) =>
    pill(label, on.has(day), `data-act="on-day" data-id="${item.id}" data-day="${esc(day)}"`)
  return pillRow('Which days',
    one(anyDayMeans(isPlan(item)), ANY_DAY) + tripDays(S.trip).map((d) => one(d, dayShort(d))).join(''))
}

// Which meal, for the tab where a day on its own is only half the slot. It
// writes the category, because the category is already the meal — Breakfast,
// Lunch, Dinner are what the Eat tab has always been filed under, and a second
// column saying the same thing is a second answer to disagree with the first.
// Whatever it is filed under now is offered too, so opening this on the crisps
// does not silently propose making them breakfast.
function mealPills(item) {
  const here = catOf(item)
  const meals = MEALS.includes(here) ? MEALS : [...MEALS, here]
  return pillRow('Which meal', meals.map((m) =>
    pill(m, here === m, `data-act="set-meal" data-id="${item.id}" data-cat="${esc(m)}"`)).join(''))
}

// When a thing happens, on its own because it is a different question from who
// is bringing it — and on the Eat tab it is the question that turns a list of
// food into a list of meals.
//
// A trip with no dates has nothing to offer here, and says so rather than
// showing an empty row of chips: the fix is two fields away on the Trip tab.
function sheetWhen(s) {
  const item = S.items.find((i) => i.id === s.id)
  if (!item) return ''
  const plan = isPlan(item)

  // "When is Sausages?" is not a sentence. A plan is a thing that happens and
  // takes the plain question; food is for a meal, and asking it that way keeps
  // the grammar upright whatever somebody called the thing.
  const asking = plan ? `When is ${item.title}?` : `Which days is ${item.title} for?`

  if (!tripDays(S.trip).length) {
    return sheetShell({
      title: asking,
      blurb: 'This trip has no dates on it yet, so there are no days to put things on.',
      body: `
        <div class="empty">
          <h3>No dates yet</h3>
          <p>Add when you arrive and when you leave, and every day of the trip shows up here to file things under.</p>
          <button class="btn btn--blaze" data-act="camp">Go to the trip page</button>
        </div>`,
    })
  }

  return sheetShell({
    title: asking,
    blurb: plan
      ? 'Optional, both of them. A plan with no day is still a plan — it just sits at the end, waiting for somebody to say when.'
      : 'The day and the meal make a slot between them, so "have we got Sunday lunch covered?" is a question the list can answer.',
    body: `
      <span class="eyebrow">Which days?</span>
      ${dayPills(item)}
      <p class="field__hint">${kinOf(item).length > 1
        ? 'One of these on each day you have picked, each with its own name to put to it. Press a day again to drop that one.'
        : 'Pick more than one and you get one on each day, each with its own name to put to it.'}${plan ? ''
        : ' “Any day” is for what the whole trip shares — the teabags, the oil — and shows up under every day.'}</p>
      ${plan ? '' : `<span class="eyebrow">Which meal?</span>${mealPills(item)}`}
      ${!plan ? '' : `
        <form data-act="save-time" data-id="${item.id}">
          <label class="field"><span>Time <span style="font-weight:400">(optional)</span></span>
            <input type="time" name="time" value="${esc(item.time ?? '')}"></label>
          <button class="btn btn--primary btn--wide" type="submit">Save the time</button>
        </form>`}`,
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

function sheetExpense(s) {
  const expense = s.expenseId ? S.expenses.find((row) => row.id === s.expenseId) : null
  if (s.expenseId && !expense) return ''
  const item = s.id ? S.items.find((row) => row.id === s.id) : null
  const carrier = s.member ? memberById(s.member) : null
  const claim = item && carrier ? claimsOn(item).find((row) => row.member_id === carrier.id) : null
  if (!expense && (s.id || s.member) && (!item || !carrier || !claim)) return ''
  const description = expense?.description || item?.title || ''
  const payer = expense?.paid_by || carrier?.id || S.me || S.members[0]?.id
  const value = expense ? (expense.amount / 100).toFixed(2) : ''
  const sharing = new Set(expense?.participants ?? S.members.map((member) => member.id))
  const split = expense?.shares ? 'custom' : 'equal'
  const equalValues = new Map()
  if (expense && !expense.shares && sharing.size) {
    const people = S.members.filter((member) => sharing.has(member.id))
    const each = Math.floor(expense.amount / people.length)
    const remainder = expense.amount % people.length
    people.forEach((member, i) => equalValues.set(member.id, each + (i < remainder ? 1 : 0)))
  }

  return sheetShell({
    title: expense ? `Edit ${expense.description}` : item ? `Cost of ${item.title}` : 'Add expense',
    blurb: item && carrier
      ? `${carrier.name} is bringing this. Choose who paid and who shares the cost.`
      : 'Choose only the people who share this cost — for petrol, that may be one car rather than the whole trip.',
    body: `
      <form class="expense-form" id="expense-form" data-act="save-expense" data-split="${split}"${expense ? ` data-expense="${expense.id}"` : ''}${item ? ` data-id="${item.id}"` : ''}${carrier ? ` data-member="${carrier.id}"` : ''}>
        <label class="field"><span>What was it for?</span>
          <input name="description" value="${esc(description)}" maxlength="120" required
                 ${description ? '' : 'autofocus '}placeholder="Petrol"></label>
        <label class="field"><span>Cost (${esc(tripCurrency())})</span>
          <input name="amount" value="${esc(value)}" ${description ? 'autofocus ' : ''}inputmode="decimal"
                 required placeholder="0.00" pattern="[0-9]+([.][0-9]{1,2})?"></label>
        <label class="field"><span>Paid by</span>
          <select name="paidBy">
            ${S.members.map((m) => `<option value="${m.id}"${m.id === payer ? ' selected' : ''}>${esc(m.name)}</option>`).join('')}
          </select></label>
        <fieldset class="expense-split">
          <legend>How should it be split?</legend>
          <input type="hidden" name="splitMode" value="${split}">
          <div class="segmented expense-split__modes">
            <button type="button" class="segmented__btn" data-act="expense-split" data-value="equal"
                    aria-pressed="${split === 'equal'}">Equal</button>
            <button type="button" class="segmented__btn" data-act="expense-split" data-value="custom"
                    aria-pressed="${split === 'custom'}">Custom amounts</button>
          </div>
          <p class="field__hint" id="expense-share-help" data-share-help>${split === 'custom'
            ? 'Enter each person’s share. Leave one blank to give them the remainder.'
            : 'The cost is divided evenly between everyone selected below.'}</p>
        </fieldset>
        <fieldset class="expense-people">
          <legend>Who shares it?</legend>
          ${S.members.map((member) => {
            const selected = sharing.has(member.id)
            const share = expense?.shares?.[member.id] ?? equalValues.get(member.id)
            return `<div class="expense-person">
              <label class="expense-person__who">
                <input type="checkbox" name="participantIds" value="${member.id}"${selected ? ' checked' : ''}>
                <span class="pick__swatch" style="background:${colorOf(member)}"></span>
                <span class="expense-person__name">${esc(member.name)}${member.id === S.me ? ' (you)' : ''}</span>
              </label>
              <label class="expense-person__amount">
                <span class="sr-only">${esc(member.name)}’s share (${esc(tripCurrency())})</span>
                <input name="share:${member.id}" value="${share ? minorInput(share) : ''}"
                       inputmode="decimal" placeholder="0.00" pattern="[0-9]+([.][0-9]{1,2})?"
                       aria-describedby="expense-share-help"${split !== 'custom' || !selected ? ' disabled' : ''}>
              </label>
            </div>`
          }).join('')}
          <p class="expense-split__total" data-share-total aria-live="polite">${split === 'custom'
            ? `Shares add up to ${moneyText(expense.amount)}.` : ''}</p>
        </fieldset>
      </form>`,
    // Saving is the thing you came to do, so it sits in the foot where the sheet
    // cannot scroll it out of reach — and on an expense that already exists it
    // shares that row with removing it, rather than hiding a screen further up.
    foot: expense
      ? `<div class="sheet__acts">
          <button class="btn btn--primary" type="submit" form="expense-form">Save</button>
          <button class="btn btn--quiet" data-act="delete-expense" data-expense="${expense.id}">Remove</button>
        </div>`
      : `<button class="btn btn--primary btn--wide" type="submit" form="expense-form">Save expense</button>`,
  })
}

// Handing the money over. The page can suggest the payment — press Mark paid on
// a line and it arrives filled in — but the amount stays editable, because half
// of these get settled with a round number and a "we'll call it even", and a
// part payment has to be sayable.
function sheetPayment(s) {
  if (S.members.length < 2) return ''
  const suggested = memberById(s.from)
  const payee = memberById(s.to)
  const from = suggested?.id || S.me || S.members[0].id
  const to = payee?.id || S.members.find((member) => member.id !== from)?.id || ''
  const amount = Number(s.amount) > 0 ? minorInput(Number(s.amount)) : ''
  const people = (chosen) => S.members
    .map((member) => `<option value="${member.id}"${member.id === chosen ? ' selected' : ''}>${
      esc(member.name)}${member.id === S.me ? ' (you)' : ''}</option>`).join('')

  return sheetShell({
    title: 'Record a payment',
    blurb: 'Money that has already changed hands — cash, a bank transfer, a round at the pub. It comes off what is still owed.',
    body: `
      <form class="payment-form" id="payment-form" data-act="save-payment">
        <label class="field"><span>Who paid?</span>
          <select name="from">${people(from)}</select></label>
        <label class="field"><span>Who did they pay?</span>
          <select name="to">${people(to)}</select></label>
        <label class="field"><span>How much (${esc(tripCurrency())})</span>
          <input name="amount" value="${esc(amount)}" inputmode="decimal" required autofocus
                 placeholder="0.00" pattern="[0-9]+([.][0-9]{1,2})?"></label>
        <label class="field"><span>Note (optional)</span>
          <input name="note" maxlength="120" placeholder="Bank transfer"></label>
      </form>`,
    foot: `<button class="btn btn--primary btn--wide" type="submit" form="payment-form">Record payment</button>`,
  })
}

function expenseRows(form) {
  return [...form.querySelectorAll('.expense-person')].map((row) => ({
    person: row.querySelector('input[name="participantIds"]'),
    share: row.querySelector('input[name^="share:"]'),
  }))
}

function updateExpenseShareTotal(form) {
  const output = form.querySelector('[data-share-total]')
  if (!output || form.dataset.split !== 'custom') return
  const total = minorFromInput(form.elements.namedItem('amount')?.value)
  const picked = expenseRows(form).filter(({ person }) => person.checked)
  if (!picked.length) { output.textContent = 'Choose at least one person.'; return }
  if (!total) { output.textContent = 'Enter the cost, then assign each share.'; return }

  let assigned = 0, blanks = 0, invalid = false
  for (const { share } of picked) {
    const raw = share.value.trim()
    if (!raw) { blanks++; continue }
    const amount = minorFromInput(raw)
    if (!amount) invalid = true
    else assigned += amount
  }
  if (invalid) { output.textContent = 'Use positive amounts with no more than two decimal places.'; return }

  const left = total - assigned
  if (blanks === 1 && left > 0) output.textContent = `${moneyText(left)} will go to the remaining person.`
  else if (blanks > 1) output.textContent = `${moneyText(Math.max(left, 0))} left to assign across ${blanks} people.`
  else if (left === 0) output.textContent = `Shares add up to ${moneyText(total)}.`
  else if (left > 0) output.textContent = `${moneyText(left)} left to assign.`
  else output.textContent = `${moneyText(-left)} over the cost.`
}

function setExpenseSplit(form, split) {
  form.dataset.split = split
  form.elements.namedItem('splitMode').value = split
  for (const button of form.querySelectorAll('[data-act="expense-split"]')) {
    button.setAttribute('aria-pressed', button.dataset.value === split)
  }
  const rows = expenseRows(form)
  for (const { person, share } of rows) share.disabled = split !== 'custom' || !person.checked

  if (split === 'custom') {
    const picked = rows.filter(({ person }) => person.checked)
    const total = minorFromInput(form.elements.namedItem('amount')?.value)
    if (total && picked.length && picked.every(({ share }) => !share.value.trim())) {
      const each = Math.floor(total / picked.length)
      const remainder = total % picked.length
      picked.forEach(({ share }, i) => { share.value = minorInput(each + (i < remainder ? 1 : 0)) })
    }
  }

  const help = form.querySelector('[data-share-help]')
  if (help) help.textContent = split === 'custom'
    ? 'Enter each person’s share. Leave one blank to give them the remainder.'
    : 'The cost is divided evenly between everyone selected below.'
  updateExpenseShareTotal(form)
}

function customExpenseShares(form, participants, rawTotal) {
  const total = minorFromInput(rawTotal)
  if (!total) return { error: 'Enter a cost greater than zero.' }
  if (!participants.length) return { error: 'Choose at least one person to share this expense.' }
  const shares = {}, blank = []
  let assigned = 0
  for (const memberId of participants) {
    const input = form.elements.namedItem(`share:${memberId}`)
    const raw = String(input?.value ?? '').trim()
    if (!raw) { blank.push({ memberId, input }); continue }
    const amount = minorFromInput(raw)
    if (!amount) return { error: 'Every custom share must be greater than zero and use no more than two decimal places.' }
    shares[memberId] = minorInput(amount)
    assigned += amount
  }
  if (blank.length > 1) return { error: 'Enter each share, or leave only one person blank for the remainder.' }
  if (blank.length === 1) {
    const remainder = total - assigned
    if (remainder <= 0) return { error: 'There is no positive remainder for the blank share.' }
    shares[blank[0].memberId] = minorInput(remainder)
    if (blank[0].input) blank[0].input.value = shares[blank[0].memberId]
    assigned += remainder
  }
  if (assigned !== total) return { error: `The shares must add up to ${moneyText(total)}.` }
  return { shares }
}

function sheetCurrency() {
  return sheetShell({
    title: 'Trip currency',
    blurb: 'One currency covers every cost on this trip.',
    body: `
      <form data-act="save-currency">
        <label class="field"><span>Three-letter code</span>
          <input name="currency" value="${esc(tripCurrency())}" maxlength="3" pattern="[A-Za-z]{3}"
                 required autofocus list="currency-codes" autocomplete="off" autocapitalize="characters" spellcheck="false">
          <datalist id="currency-codes"><option value="GBP"><option value="EUR"><option value="USD"><option value="CAD"><option value="AUD"><option value="NZD"></datalist>
          <p class="field__hint">Changing this relabels existing costs. It does not convert them.</p></label>
        <button class="btn btn--primary btn--wide" type="submit">Save currency</button>
      </form>`,
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

  // Which days this is for, where a day means anything: a plan on the itinerary,
  // or the meal a bag of sausages is for. "Any day" keeps the front, because most
  // of what goes on a list is not any particular day's and the sheet should not
  // make you say so. An empty heading that offered to fill itself arrives with
  // its own answer already in.
  //
  // On a plan it is pressed by default and means no day. On food it means all of
  // them, and nothing is pressed by default — because a bag of sausages nobody
  // has spoken for yet is neither Sunday's nor the whole week's, and saying so
  // out loud is what makes "No day" worth pressing.
  //
  // More than one, because instant noodles three nights running is a normal
  // thing to want and typing it out three times is not. What comes back is three
  // rows rather than one row that says three days, and the note says so, because
  // it is the difference between one person having agreed to bring the noodles
  // and three people each having agreed to bring a night's worth.
  const days = tripDays(S.trip)
  const plan = isPlanTab(tab)
  const on = String(s.day ?? '').split(',').filter(Boolean)
  const lead = anyDayMeans(plan)
  const dayPick = !days.length || !takesDays(tab) ? '' : `
    <div class="field">
      <span>Which days? <span style="font-weight:400">(optional)</span></span>
      ${pillRow('Which days',
        pill(ANY_DAY, plan ? !on.length : on.includes(ALL_WEEK), `data-act="pick-day" data-value="${esc(lead)}"`)
        + days.map((d) => pill(dayShort(d), on.includes(d), `data-act="pick-day" data-value="${esc(d)}"`)).join(''))}
      <input type="hidden" name="day" value="${esc(on.join(','))}">
      <p class="field__hint">${plan
        ? 'Pick more than one and you get one on each day, each with its own name to put to it.'
        : 'Pick more than one and you get one on each day, each with its own name to put to it. “Any day” is for what the whole trip shares — the teabags, the oil — and shows up under every day.'}</p>
    </div>`

  // And the hour, for the one kind of thing that has one. A meal is a slot, not
  // a time: nobody serves breakfast at 08:15 on a campsite.
  const timePick = !days.length || !isPlanTab(tab) ? '' : `
    <label class="field"><span>Time <span style="font-weight:400">(optional)</span></span>
      <input type="time" name="time"></label>`

  return sheetShell({
    title: `Add to ${tab.title.toLowerCase()}`,
    body: `
      <form data-act="add-item">
        <label class="field"><span>What is it?</span>
          <input name="title" required maxlength="120" autofocus placeholder="${s.list === 'food' ? 'Sausages' : s.list === 'activities' ? 'Sunrise walk to the ridge' : 'Bottle opener'}"></label>
        ${listPick}
        <div class="field--split">
          <label class="field"><span>Group</span>
            <input name="category" list="cs-cats" maxlength="60" value="${esc(s.category ?? '')}"
                   placeholder="${esc(cats[0] ?? 'Other')}"></label>
          <label class="field"><span>How much <span style="font-weight:400">(optional)</span></span>
            <input name="qty" maxlength="40" placeholder="x2"></label>
        </div>
        <datalist id="cs-cats">${cats.map((c) => `<option value="${esc(c)}">`).join('')}</datalist>
        <label class="field"><span>Note <span style="font-weight:400">(optional)</span></span>
          <input name="note" maxlength="500" placeholder="Anything the others need to know"></label>
        ${dayPick}
        ${timePick}
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

// The one thing a sheet is holding that its own HTML does not say: what somebody
// has typed into it and not saved yet. `defaultValue` is the value the template
// wrote, so a field that differs from it is theirs and not the item's.
//
// This matters because the sheet redraws while you are standing in it. The day
// pills save on the tap, and the redraw that followed rebuilt the time field
// from an item that had no time on it — so typing 09:30, pressing Tuesday and
// then Save the time saved nothing and said "Time removed", which was true of
// the field it read and a lie about what had happened.
function unsaved(sheet) {
  const held = new Map()
  for (const f of sheet.querySelectorAll('input[name], textarea[name]')) {
    if (f.type !== 'checkbox' && f.type !== 'radio' && f.value !== f.defaultValue) held.set(f.name, f.value)
  }
  // A dropdown is answered as deliberately as a box is typed in, and picking one
  // is not a keystroke that a redraw five seconds later gets to take back. Its
  // "as rendered" value is whichever option carried the selected attribute.
  for (const f of sheet.querySelectorAll('select[name]')) {
    const asDrawn = [...f.options].find((option) => option.defaultSelected)?.value ?? f.options[0]?.value
    if (f.value !== asDrawn) held.set(f.name, f.value)
  }
  return held
}

// And where the cursor was, if it was in the sheet at all. A time or a number
// input has no caret to ask about and throws when asked.
function caretIn(sheet) {
  const box = document.activeElement
  if (!box?.name || !sheet.contains?.(box)) return null
  try { return { name: box.name, start: box.selectionStart, end: box.selectionEnd } }
  catch { return { name: box.name, start: null, end: null } }
}

function restore(sheet, typed, at) {
  for (const f of sheet.querySelectorAll('input[name], textarea[name], select[name]')) {
    if (typed.has(f.name)) f.value = typed.get(f.name)
    if (at && f.name === at.name) {
      f.focus()
      if (at.start !== null) { try { f.setSelectionRange(at.start, at.end) } catch { /* no caret to put back */ } }
    }
  }
}

function renderSheet() {
  if (!S.sheet) { sheetRoot.innerHTML = ''; sheetSig = null; return }
  const map = {
    item: sheetItem, edit: sheetEdit, add: sheetAdd, suggest: sheetSuggest,
    place: sheetPlace, when: sheetWhen, diet: sheetDiet, diets: sheetDiets,
    expense: sheetExpense, payment: sheetPayment, currency: sheetCurrency,
  }
  const html = map[S.sheet.kind]?.(S.sheet) ?? ''
  const sig = `${S.sheet.kind}:${S.sheet.expenseId ?? S.sheet.id ?? ''}:${S.sheet.member ?? ''}`
  const open = sheetRoot.querySelector('.sheet')

  // The same sheet, saying something new, keeps its own element: throwing it
  // away and building another replays the slide-in and the scrim fading up, so
  // putting your name to something made the whole sheet flinch. Only the
  // contents change, and where you had scrolled to survives with them — and so
  // does what you had typed, which is nowhere in the HTML being rebuilt.
  if (open && sig === sheetSig) {
    const next = document.createElement('div')
    next.innerHTML = html
    const fresh = next.querySelector('.sheet')
    if (fresh) {
      const body = open.querySelector('.sheet__body')
      const y = body?.scrollTop ?? 0
      const typed = unsaved(open)
      const at = caretIn(open)
      open.innerHTML = fresh.innerHTML
      const after = open.querySelector('.sheet__body')
      if (after) after.scrollTop = y
      restore(open, typed, at)
      return
    }
  }

  sheetRoot.innerHTML = html
  sheetSig = sig
}

// ---- render -----------------------------------------------------------------

// Two things the page is holding that its HTML does not say: how far along its
// sideways rows you had scrolled, and where the cursor was in the search box.
// Both are thrown away by rebuilding the page and both are missed at once — a
// row that springs back to the start every time you press something in it means
// swiping back to the same place to press the next thing.
//
// Two rows scroll sideways, and the days had this wrong until the chips were
// generalised to cover them: on a fortnight away, pressing the twelfth day sent
// the strip back to the first.
const SIDEWAYS = ['.daybar__row', '.filters']
const ROWS = SIDEWAYS.join(', ')
let rowsAt = { where: '', x: {} }

// Which way a sideways row can still go. Said by measuring rather than assumed,
// because a fade that is always on fades the first day when there is nothing to
// the left of it, and fades both ends of a weekend that fits on the screen —
// which reads as a bug rather than as an invitation.
function edges(row) {
  const room = row.scrollWidth - row.clientWidth
  // A pixel of slack at each end: scrollLeft is fractional on a zoomed page and
  // on a trackpad, and an eighth of a pixel is not somewhere left to scroll.
  const back = row.scrollLeft > 1
  const on = row.scrollLeft < room - 1
  row.dataset.more = back && on ? 'both' : back ? 'start' : on ? 'end' : ''
}

const markEdges = () => { for (const row of root.querySelectorAll?.(ROWS) ?? []) edges(row) }

// A clamp is a height, and nothing in the text says whether it has hit one:
// six lines of gate codes and six lines of anything else are nowhere near the
// same number of characters. So the button that opens it is offered only after
// the box has been laid out and found to be full — and it stays on once open,
// because that is the way back.
function markClamp() {
  for (const box of root.querySelectorAll?.('[data-clamp]') ?? []) {
    const btn = box.parentElement?.querySelector(`[data-act="expand"][data-what="${box.dataset.clamp}"]`)
    if (!btn) continue
    btn.hidden = !box.classList.contains('is-open') && box.scrollHeight <= box.clientHeight + 1
  }
}

const CHAT_BOX_MAX = 180
function fitChatBox(box) {
  if (!box) return
  box.style.height = 'auto'
  box.style.height = `${Math.min(box.scrollHeight, CHAT_BOX_MAX)}px`
  box.style.overflowY = box.scrollHeight > CHAT_BOX_MAX ? 'auto' : 'hidden'
}

// Camp is only invoked when it starts the message, so autocomplete is offered
// only there. That keeps a completed mention honest: choosing it always creates
// a message the assistant will actually answer.
function campMentionRange(value, caret = String(value ?? '').length) {
  const before = String(value ?? '').slice(0, caret)
  const match = before.match(/^(\s*)@([a-z]*)$/i)
  if (!match || !'camp'.startsWith(match[2].toLowerCase())) return null
  return { start: match[1].length, end: caret }
}

function completeCampMention(value, caret = String(value ?? '').length) {
  const text = String(value ?? '')
  const range = campMentionRange(text, caret)
  if (!range) return null
  const after = text.slice(range.end)
  const gap = after && /^\s/.test(after) ? '' : ' '
  const next = `${text.slice(0, range.start)}@camp${gap}${after}`
  return { value: next, caret: range.start + 5 + gap.length }
}

function setCampMentionOpen(box, open) {
  const list = root.querySelector?.('#chat-mention')
  if (!box || !list) return
  list.hidden = !open
  box.setAttribute('aria-expanded', String(open))
  if (open) box.setAttribute('aria-activedescendant', 'chat-mention-camp')
  else box.removeAttribute('aria-activedescendant')
}

function syncCampMention(box) {
  setCampMentionOpen(box, !!campMentionRange(box?.value, box?.selectionStart))
}

function acceptCampMention(box) {
  const completed = completeCampMention(box?.value, box?.selectionStart)
  if (!box || !completed) return false
  box.value = completed.value
  box.setSelectionRange(completed.caret, completed.caret)
  S.chat.draft = completed.value
  setCampMentionOpen(box, false)
  fitChatBox(box)
  box.focus()
  return true
}

function render({ chatBottom = false } = {}) {
  const y = window.scrollY
  const oldChat = root.querySelector?.('.chat__body')
  const oldChatTop = oldChat?.scrollTop ?? 0
  const chatWasAtBottom = oldChat
    ? oldChat.scrollHeight - oldChat.scrollTop - oldChat.clientHeight < 96
    : false
  for (const sel of SIDEWAYS) {
    const was = root.querySelector(sel)
    if (was) rowsAt.x[sel] = was.scrollLeft
  }

  const box = document.activeElement
  const caret = box?.id === 'cs-find' ? { start: box.selectionStart, end: box.selectionEnd } : null

  const views = { landing: viewLanding, join: viewJoin, trip: viewTrip, settings: viewSettings }
  root.innerHTML = views[S.view]?.() ?? '<div class="page"><p>Loading…</p></div>'
  fitChatBox(root.querySelector?.('#chat-text'))
  const nextChat = root.querySelector?.('.chat__body')
  if (nextChat) {
    nextChat.scrollTop = chatBottom || !oldChat || chatWasAtBottom
      ? nextChat.scrollHeight
      : oldChatTop
  }
  chatNeedsRender = false
  // The install card floats over the bottom of the screen, which on the trip
  // page already has a tab bar standing on it.
  document.body.classList.toggle('has-tabbar', S.view === 'trip' && S.camp !== 'room')
  // And the room button floats in the corner above that bar, so the foot of a
  // list needs to end clear of it — see .has-room-fab.
  document.body.classList.toggle('has-room-fab', S.view === 'trip' && !S.camp)
  renderSheet()
  if (S.view === 'trip') window.scrollTo(0, y)

  // Each row goes back where it was, unless this is a different page's row —
  // a new tab starts at the left, the same as it would if you had just arrived.
  // Then each is asked which way it can still go, which is what the fade at its
  // ends is drawn from.
  const here = `${S.view}:${S.camp || S.tab}`
  const kept = {}
  for (const sel of SIDEWAYS) {
    const row = root.querySelector(sel)
    if (!row) continue
    row.scrollLeft = here === rowsAt.where ? (rowsAt.x[sel] ?? 0) : 0
    kept[sel] = row.scrollLeft
    edges(row)
  }
  rowsAt = { where: here, x: kept }

  // The search box sits inside the list it filters, so every keystroke rebuilds
  // the box being typed in. The cursor is put back exactly where it was, which
  // is what makes editing the middle of a word possible.
  if (caret) {
    const found = root.querySelector('#cs-find')
    if (found) { found.focus(); found.setSelectionRange(caret.start, caret.end) }
  }

  // Google's button owns its inner markup, so it is mounted after our
  // string-rendered page is in the document and remounted after a redraw.
  renderGoogleButtons()

  // Needs the page measured, so it comes after it is in the document.
  markClamp()

  // Asked for after the page is on screen, and only where it is shown: the
  // forecast is the one thing here that comes from somewhere else, so nothing
  // waits on it. It answers once per question — see wantWeather — so this being
  // in render() costs a string comparison and nothing else.
  if (S.view === 'trip' && S.camp === 'overview' && wants('weather')) wantWeather()
  if (S.view === 'trip') wantNotificationState()
  if (S.view === 'trip' && S.camp === 'room') {
    wantMessages()
    markRoomRead()
  }
  if (S.view === 'settings') wantAlerts()
  ensureChatSocket()
  syncRoomPresence()
}

// ---- actions ----------------------------------------------------------------

const meKey = (tripId) => `cs.me.${tripId}`
const TRIPS_KEY = 'cs.trips'
const DEV_USER_KEY = 'cs.dev-user'
const foldsKey = (tripId) => `cs.folds.${tripId}`
// Read by the inline script in index.html as well as here, and it has to keep
// being readable by a five-line try/catch that runs before anything else does.
const PREFS_KEY = 'cs.prefs'

function loadPrefs() {
  let kept = {}
  try { kept = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') } catch { /* nothing kept */ }
  const theme = THEMES.some((t) => t.id === kept?.theme) ? kept.theme : 'system'
  const features = {}
  for (const f of FEATURES) features[f.id] = kept?.features?.[f.id] !== false
  S.prefs = { theme, features }
  applyTheme()
}

function savePrefs() {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(S.prefs)) } catch {
    // Private mode. The settings hold for this visit and are forgotten with it,
    // which is the same bargain the folded headings and the install card make.
  }
}

const prefersDark = () => !!globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches
const darkNow = () => S.prefs.theme === 'dark' || (S.prefs.theme === 'system' && prefersDark())

// The status bar and the address bar are painted by the browser from a meta
// tag, not by the stylesheet, so the header's colour has to be said twice.
const THEME_COLOR = { light: '#1B382E', dark: '#16261F' }

// "System" is resolved to a real light or dark here rather than left to CSS, so
// there is one answer on the page at a time and the inline boot script, this,
// and the media listener below cannot disagree about what is showing.
function applyTheme() {
  const dark = darkNow()
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  const meta = document.querySelector?.('meta[name="theme-color"]')
  if (meta) meta.content = dark ? THEME_COLOR.dark : THEME_COLOR.light
}

// Following the phone is only following it if it keeps up: the system flips at
// sunset, or someone changes it while the app is open in another window.
globalThis.matchMedia?.('(prefers-color-scheme: dark)')?.addEventListener?.('change', () => {
  if (S.prefs.theme === 'system') applyTheme()
})

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

// The account's memberships are copied into the same small local index old
// devices used. That keeps the offline home page and the migration path one
// mechanism rather than maintaining a second account-only trip picker.
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

function tripRoute(pathname = location.pathname) {
  const match = String(pathname).match(/^\/t\/([^/]+)(?:\/(room|settle))?\/?$/)
  return match ? { code: decodeURIComponent(match[1]), view: match[2] || '' } : null
}

const SETTINGS_PATH = '/settings'
const isSettingsRoute = (pathname = location.pathname) => /^\/settings\/?$/.test(String(pathname))

// Settings stands outside a trip: it is about you and this device, and the same
// page opens from the home screen and from inside a trip. `back` is where the
// arrow out of it goes — the page you were on, or home when it was opened from
// a bookmark with nothing behind it.
function showSettings(back = '/') {
  S.settingsBack = isSettingsRoute(back) ? '/' : back
  S.view = 'settings'
  S.alerts = null
  if (location.pathname === SETTINGS_PATH) {
    // Already standing on it: a reload, a bookmark, or the back and forward
    // buttons. There is a page underneath to go back to only if this entry is
    // one we pushed, and the mark we left on it is what survives a reload.
    S.settingsPushed = !!history.state?.back
  } else {
    history.pushState({ back: S.settingsBack }, '', SETTINGS_PATH)
    S.settingsPushed = true
  }
  // The page paints on what is already known — who you are came with the boot —
  // and render asks for the notification settings behind it. Nothing here waits
  // on the network to draw.
  render()
  window.scrollTo(0, 0)
}

// The arrow back out. Settings is a detour, so leaving it unwinds the detour:
// it pops the entry going in pushed, which is the one thing that makes this
// arrow and the browser's own back button agree. Pushing the page you came from
// back on instead looked identical on screen and left a pair of entries behind
// every visit, so pressing back afterwards walked into settings again, and
// again, before it ever reached the page you were actually reading.
//
// A push is still right when there is nothing underneath: /settings can be the
// whole of a visit, opened from a bookmark or a home-screen icon.
async function leaveSettings() {
  S.alerts = null
  if (S.settingsPushed) {
    // The pop restores the scroll position too, which the push never could.
    history.back()
    return
  }
  const back = tripRoute(S.settingsBack)
  if (back) {
    // Which page of the trip, before it is opened rather than after, so the
    // trip is drawn once on the page you left rather than twice.
    S.camp = back.view || false
    history.pushState({ tripView: back.view }, '', S.settingsBack)
    await openTrip(back.code)
  } else {
    history.pushState({}, '', '/')
    await showLanding()
  }
  window.scrollTo(0, 0)
}

async function goToTrip(code) {
  S.camp = false
  history.pushState({ tripView: false }, '', `/t/${encodeURIComponent(code)}`)
  await openTrip(code)
}

// `from` is the view this entry was pushed on top of — the list you were
// reading, the trip page, false for a plain list tab. Nothing reads it as a
// destination: what it is for is being there at all, which is how the arrow out
// of the Planning Room knows there is a page underneath to go back to rather
// than a link somebody sent you. See leaveFocus.
function pushTripView(view) {
  const suffix = view === 'room' ? '/room' : view === 'settle' ? '/settle' : ''
  // What the page you are leaving was showing, written on the entry you are
  // leaving it on: which list, how it was narrowed, how far down it you had got.
  // In memory all three survive a visit to the room on their own — but a reload
  // in the room does not touch the stack underneath and wipes the memory above
  // it, and then back landed on the top of an unfiltered Pack list, which is
  // nowhere anybody has been. The entry is the only part of this that is still
  // there afterwards, so the answer goes on the entry.
  history.replaceState(
    { ...history.state, tab: S.tab, filter: { ...S.filter }, y: window.scrollY },
    '', location.pathname)
  history.pushState({ tripView: view, from: S.camp },
    '', `/t/${encodeURIComponent(S.trip.id)}${suffix}`)
}

// And back the other way. Everything here is checked rather than trusted: an
// entry can have been written by an older version of this app, or by a reload
// three days ago, and a filter of the wrong shape would take the list down on
// arrival. Absent is fine and means the default — this is a page being restored,
// not a page being validated, and the worst answer it can give is the list you
// would have got anyway.
function restoreList(state) {
  if (TABS.some((t) => t.id === state?.tab)) S.tab = state.tab
  const f = state?.filter
  if (!f || typeof f !== 'object') return
  const word = (v) => (typeof v === 'string' ? v : '')
  S.filter = { day: word(f.day), kind: word(f.kind), cat: word(f.cat), hide: !!f.hide, q: word(f.q) }
}

// The arrow out of the Planning Room and Settle up. It unwinds the way in
// rather than driving to a fixed address: the room is opened from a list as
// often as from the trip page now, and an arrow that always landed on the trip
// page took you somewhere you had not been on the way in — and left the list
// you were actually reading two taps away.
//
// The same pop as leaveSettings, for the same reasons: it keeps this arrow and
// the browser's own back button saying the same thing, it brings the scroll
// position back with it, and it does not leave a pair of entries behind that
// walk you into the room again on the way out.
//
// Opened cold — a notification, a shared link, a home-screen icon on /room —
// there is nothing underneath, and then the trip page is the right place to be
// put down: it is the one screen everything else on the trip is reachable from.
function leaveFocus() {
  if (history.state?.from !== undefined) {
    history.back()
    return
  }
  pushTripView('overview')
  S.camp = 'overview'
  render()
  window.scrollTo(0, 0)
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
      body: { name, self: true, ...(claim ? { claim } : {}) },
    })
    localStorage.setItem(meKey(S.trip.id), member.id)
    rememberTrip(S.trip.id)
    S.me = member.id
    S.joinClash = null
    S.view = 'trip'
    await syncNotificationsForTrip(S.trip.id)
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
    S.me = Object.hasOwn(state, 'viewer_id')
      ? state.viewer_id
      : (S.me && state.members.some((m) => m.id === S.me) ? S.me : null)
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
  // The click a long press leaves behind it. Pressing on the pin button itself
  // would otherwise pin and then unpin in one gesture, which reads as the press
  // having done nothing at all.
  //
  // Only that message's click, and only for as long as a trailing one could
  // still arrive. Dropping every click for the window would take an unrelated
  // one with it; matching the row alone would swallow a real tap on the message
  // just pressed, on a platform that sends no trailing click at all.
  if (heldRow && Date.now() - heldAt < 400 && ev.target.closest?.('.thread__message') === heldRow) {
    heldRow = null
    return
  }
  const el = ev.target.closest('[data-act]')
  if (!el) return
  const act = el.dataset.act
  // Trip cards are real links, so a modifier-click still opens a new tab.
  if (el.tagName === 'A' && (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey)) return
  if (el.tagName === 'A') ev.preventDefault()
  if (el.tagName === 'BUTTON' && el.type !== 'submit') ev.preventDefault()

  switch (act) {
    case 'sign-out': {
      try {
        await clearBrowserNotifications()
        applyAuth(await api('/auth/logout', { method: 'POST' }))
        S.me = null
        toast('Signed out.')
        // Signing out on the settings page leaves you on it: it is the page you
        // chose to be on, and it still has plenty to say to somebody signed out.
        // The alerts go with the session that could read them.
        await afterAuthChange()
      } catch (err) { toast(err.message) }
      break
    }

    case 'dev-sign-in': {
      if (S.authBusy) break
      S.authBusy = true
      try {
        let devId = localStorage.getItem(DEV_USER_KEY)
        if (!devId) {
          devId = newMessageId()
          localStorage.setItem(DEV_USER_KEY, devId)
        }
        applyAuth(await api('/auth/dev', {
          method: 'POST', body: { devId, legacyMemberships: legacyMemberships() },
        }))
        toast('Signed in for development.')
        await afterAuthChange()
      } catch (err) { toast(err.message) }
      finally { S.authBusy = false; render() }
      break
    }

    case 'open-trip':
      await goToTrip(el.dataset.id)
      window.scrollTo(0, 0)
      break

    // Settings is a page you go to and come back from, so it is a push with
    // where you were kept on it: the back arrow returns to the trip you were
    // reading rather than dropping you on the home page.
    case 'settings':
      showSettings(location.pathname)
      break

    case 'leave-settings':
      await leaveSettings()
      break

    case 'theme': {
      const value = el.dataset.value
      if (!THEMES.some((t) => t.id === value) || S.prefs.theme === value) break
      S.prefs = { ...S.prefs, theme: value }
      savePrefs()
      applyTheme()
      render()
      break
    }

    case 'feature': {
      const id = el.dataset.id
      if (!FEATURES.some((f) => f.id === id)) break
      S.prefs.features[id] = !wants(id)
      savePrefs()
      // Turning the forecast back on has to ask for one: it was never fetched
      // while the card was off, and wantWeather answers once per question.
      if (id === 'weather' && wants(id)) S.wx = null
      render()
      break
    }

    // Forgetting the answer is the whole of the retry: render asks for alerts
    // whenever the settings page has none.
    case 'retry-alerts':
      S.alerts = null
      render()
      break

    case 'device-alerts':
      await toggleDeviceAlerts()
      break

    case 'reminder':
      await toggleReminder(el.dataset.id)
      break

    // Leaving a trip is a push rather than a back(), because you can arrive on
    // a trip from a shared link with nothing behind you in the history.
    case 'home':
      S.camp = false
      history.pushState({}, '', '/')
      await showLanding()
      window.scrollTo(0, 0)
      break

    case 'forget-trip': {
      const t = (S.trips ?? []).find((x) => x.id === el.dataset.id)
      if (!t) break
      const off = await ask({
        title: `Take "${t.name}" off this device?`,
        blurb: 'The trip itself stays put, and the link still works.',
        yes: 'Take it off',
      })
      if (!off) break
      forgetTrip(t.id)
      render()
      toast('Removed from this device.')
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
      if (S.camp) pushTripView(false)
      S.tab = el.dataset.tab
      S.camp = false
      // A filter belongs to the list you set it on. Carrying "Shelter" onto the
      // food would be a list with most of the food missing and no reason on
      // screen for it. The same goes for whatever is in the search box.
      //
      // The day goes with them. Eat and Plan both have the bar, so a Saturday
      // set on one would silently follow you to the other — and the bar showing
      // Saturday pressed is not the same as having asked for it there.
      S.filter = { day: '', kind: '', cat: '', hide: false, q: '' }
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
      if (S.camp !== 'overview') pushTripView('overview')
      S.camp = 'overview'
      render()
      window.scrollTo(0, 0)
      break

    case 'leave-focus':
      leaveFocus()
      break

    case 'room':
      if (S.camp !== 'room') pushTripView('room')
      S.camp = 'room'
      render()
      window.scrollTo(0, 0)
      break

    case 'settle':
      if (S.camp !== 'settle') pushTripView('settle')
      S.camp = 'settle'
      render()
      window.scrollTo(0, 0)
      break

    case 'chat-notifications':
      await toggleTripMute()
      break

    case 'chat-mention':
      acceptCampMention(root.querySelector('#chat-text'))
      break

    case 'chat-reply':
      startReply(Number(el.dataset.id))
      break

    case 'chat-reply-cancel':
      if (S.chat.replyTo) {
        S.chat.replyTo = null
        render()
        focusComposer()
      }
      break

    case 'chat-quote':
      showMessage(Number(el.dataset.id))
      break

    case 'chat-pin':
      await pinMessage(Number(el.dataset.id))
      break

    case 'chat-unpin':
      await savePin(null)
      break

    case 'chat-older':
      await olderMessages()
      break

    case 'chat-retry':
      resetChat()
      render()
      break

    // Not a toggle: All is the way back out, and it is sitting at the left-hand
    // end of the bar where the thumb already is. Pressing the day you are on to
    // leave it would be the one control here that undoes itself.
    case 'filter-day':
      S.filter = { ...S.filter, day: el.dataset.value, cat: '' }
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
      S.filter = { ...S.filter, kind, cat: cats.has(S.filter.cat) ? S.filter.cat : '' }
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

    case 'when':
      S.sheet = { kind: 'when', id: el.dataset.id }
      renderSheet()
      break

    case 'expense':
      S.sheet = {
        kind: 'expense', expenseId: el.dataset.expense || '',
        id: el.dataset.id || '', member: el.dataset.member || '',
      }
      renderSheet()
      break

    case 'new-expense':
      S.sheet = { kind: 'expense' }
      renderSheet()
      break

    case 'currency':
      S.sheet = { kind: 'currency' }
      renderSheet()
      break

    // Straight off a "Sam owes Alex £12" line it arrives filled in; from the
    // button under the list it arrives blank, for the payment nobody suggested.
    //
    // The retry key is made here, with the sheet, and lives as long as it does.
    // A field with no signal in it cannot tell a lost answer from a refused
    // write, so pressing Record payment again has to be able to mean "the one I
    // already sent" rather than a second handover of the same money.
    case 'settle-transfer':
      S.sheet = {
        kind: 'payment', clientId: newMessageId(),
        from: el.dataset.from || '', to: el.dataset.to || '',
        amount: el.dataset.amount || '',
      }
      renderSheet()
      break

    case 'delete-payment': {
      const payment = S.payments.find((row) => row.id === el.dataset.payment)
      if (!payment) break
      const from = memberById(payment.from_member)?.name || 'someone'
      const to = memberById(payment.to_member)?.name || 'someone'
      const undo = await ask({
        title: `Undo ${from} paying ${to} ${moneyText(payment.amount)}?`,
        blurb: 'The amount goes back to being owed.',
        yes: 'Undo it',
      })
      if (undo && await mutate(() => api(`/payments/${payment.id}`, { method: 'DELETE' }))) {
        toast('Payment removed.')
      }
      break
    }

    case 'delete-expense': {
      const expense = S.expenses.find((row) => row.id === el.dataset.expense)
      if (!expense) break
      const gone = await ask({
        title: `Remove "${expense.description}" from Settle up?`,
        blurb: 'What everyone owes is worked out again without it.',
        yes: 'Remove',
      })
      if (gone && await mutate(() => api(`/expenses/${expense.id}`, { method: 'DELETE' }))) {
        S.sheet = null
        renderSheet()
        toast('Expense removed.')
      }
      break
    }

    // Both land straight away and leave the sheet open, the same as the
    // shared/own switch: there is nothing to type, so seeing the chip come on is
    // the whole of the confirmation.
    //
    // The days are a multiple choice over every row of the same thing, so one
    // tap is one of four things depending on what is already true. Three of them
    // are quiet; the fourth asks first, because it throws away somebody's word.
    case 'on-day': {
      const item = S.items.find((i) => i.id === el.dataset.id)
      if (!item) break
      const day = el.dataset.day
      const kin = kinOf(item)
      const there = kin.filter((i) => (i.day ?? '') === day)

      if (!there.length) {
        // Giving a thing its first day is a move, not a copy. Anybody who has
        // already said they will bring it has said it about this, and starting
        // a fresh unclaimed row would quietly drop their name.
        const loose = kin.length === 1 && !(kin[0].day ?? '') ? kin[0] : null
        if (loose) {
          await mutate(() => api(`/items/${loose.id}`, { method: 'PATCH', body: { day } }))
          break
        }
        // Otherwise a second row, standing on its own: nobody has agreed to
        // bring Sunday's by having agreed to bring Friday's.
        await mutate(() => api(`/trips/${S.trip.id}/items`, { method: 'POST', body: { items: [copyTo(item, day)] } }))
        toast(day ? `Also on ${dayFull(day)}.` : 'Also on no particular day.')
        break
      }

      // Taking the only day off does not remove the thing, it sets it loose —
      // "we are having noodles, just not saying when" is an answer.
      if (there.length === kin.length) {
        await mutate(() => api(`/items/${there[0].id}`, { method: 'PATCH', body: { day: '' } }))
        break
      }

      const spoken = there.filter(isClaimed)
      const ids = new Set(there.map((row) => row.id))
      const linked = S.expenses.filter((expense) => ids.has(expense.item_id))
      const costNote = linked.length ? ` Its ${linked.length === 1 ? 'expense' : 'expenses'} will stay in Settle up.` : ''
      if (spoken.length && !(await ask({
        title: 'Take that day off anyway?',
        blurb: `${namesOn(spoken[0])} put their name to ${day ? dayFull(day) : 'the undated one'}.${costNote}`,
        yes: 'Take it off',
      }))) break
      // The sheet is open on one of these rows, so if that is the one going, it
      // is pointed at another before it goes and stays open on the same thing.
      if (there.some((i) => i.id === S.sheet?.id)) {
        const left = kin.find((i) => !there.includes(i))
        if (left) S.sheet = { ...S.sheet, id: left.id }
      }
      for (const row of there) await mutate(() => api(`/items/${row.id}`, { method: 'DELETE' }))
      break
    }

    case 'set-meal':
      await mutate(() => api(`/items/${el.dataset.id}`, { method: 'PATCH', body: { category: el.dataset.cat } }))
      break

    // Same form as Edit, opened on the date rather than on the address — the
    // field that was asked for is the field the cursor lands in.
    case 'set-dates':
      S.editWhere = 'dates'
      render()
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
      catch { await askCopy({ title: 'Copy the address', value: where }) }
      break
    }

    case 'expense-split': {
      const form = el.closest('form[data-act="save-expense"]')
      if (form) setExpenseSplit(form, el.dataset.value === 'custom' ? 'custom' : 'equal')
      break
    }

    // Chrome's install prompt only counts inside a gesture, and nothing on the
    // way to this case has awaited, so this is still one.
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

    case 'diets':
      S.sheet = { kind: 'diets' }
      renderSheet()
      break

    case 'clear-diet': {
      const id = el.dataset.id
      S.sheet = null
      renderSheet()
      await mutate(() => api(`/trips/${S.trip.id}/members/${id}`, { method: 'PATCH', body: { diet: '' } }))
      break
    }

    // One day's numbers at a time: opening a second closes the first, so the
    // card never grows a second table underneath the one you were reading.
    case 'wx-day':
      S.wxOpen = S.wxOpen === el.dataset.date ? null : el.dataset.date
      render()
      break

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

    // A row of choices inside a form — the two-way switch, or the days — is a
    // hidden field with buttons on it. Poked in place rather than re-rendered,
    // because a re-render would take whatever you had already typed into the
    // boxes above it.
    case 'pick': {
      const box = el.closest('.segmented, .days')
      for (const b of box.querySelectorAll('button')) b.setAttribute('aria-pressed', b === el)
      box.parentElement.querySelector(`input[name="${el.dataset.name}"]`).value = el.dataset.value
      break
    }

    // The same row of pills, but you can hold down more than one of them. "Any
    // day" is not a day, so it is the one that clears the rest — and it comes
    // back on its own when you let go of the last day, because a row of pills
    // with nothing pressed in it has stopped saying anything.
    //
    // The field is written from what is pressed rather than tracked alongside
    // it, in the order the pills stand in, which is the order of the trip. So
    // tapping Sunday and then Friday still adds Friday's first.
    case 'pick-day': {
      const box = el.closest('.days')
      const any = box.querySelector('[data-value=""]')
      if (el.dataset.value) {
        el.setAttribute('aria-pressed', el.getAttribute('aria-pressed') !== 'true')
      } else {
        for (const b of box.querySelectorAll('button')) b.setAttribute('aria-pressed', b === any)
      }
      const picked = [...box.querySelectorAll('button[aria-pressed="true"]')]
        .map((b) => b.dataset.value).filter(Boolean)
      // Only where "Any day" means no day is it the state of having picked
      // none. On food it means every day, which is a pick like any other, and
      // having picked nothing is a pill row with nothing pressed: nobody has
      // said yet, which is a thing the list can now show you.
      if (any) any.setAttribute('aria-pressed', !picked.length)
      box.parentElement.querySelector('input[name="day"]').value = picked.join(',')
      break
    }

    case 'vote':
      if (!S.me) { toast('Join the trip first.'); break }
      mutate(() => api(`/items/${el.dataset.id}/vote`, { method: 'POST', body: { memberId: S.me } }))
      break

    case 'kill': {
      const it = S.items.find((i) => i.id === el.dataset.id)
      if (!it) break
      const linked = S.expenses.filter((expense) => expense.item_id === it.id)
      const costNote = linked.length ? `Its ${linked.length === 1 ? 'expense' : 'expenses'} will stay in Settle up.` : ''
      if (!(await ask({ title: `Remove "${it.title}" from the list?`, blurb: costNote, yes: 'Remove' }))) break
      S.sheet = null
      renderSheet()
      mutate(() => api(`/items/${it.id}`, { method: 'DELETE' }))
      break
    }

    case 'drop-member': {
      const m = memberById(el.dataset.id)
      if (!m) break
      const out = await ask({
        title: `Remove ${m.name}?`,
        blurb: 'Anything they were bringing goes back to nobody.',
        yes: 'Remove',
      })
      if (out) mutate(() => api(`/trips/${S.trip.id}/members/${m.id}`, { method: 'DELETE' }))
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

    // Both open into whichever section you are looking at — and, if you are
    // standing on one day of the trip, onto that day. Narrowing the list to
    // Saturday is as clear a way of saying "this is Saturday's" as the picker
    // in the sheet is.
    // Standing on a day is as good as saying so, so the sheet arrives knowing —
    // except on "No day", where standing there is saying the opposite, and the
    // sheet should arrive with nothing picked rather than with a word in the
    // field that is not a date.
    case 'add':
      S.sheet = {
        kind: 'add', tab: S.tab, list: currentTab().lists[0],
        section: activeSection(), day: seedDay(),
      }
      renderSheet()
      break

    // The same sheet, from something that names a day — an empty heading on the
    // itinerary, or a day of the trip with nothing on it. It knows more than the
    // plus at the foot of the page does, so it arrives with the answer already
    // in rather than asking again for what you just pressed.
    case 'add-to': {
      const cat = el.dataset.cat
      const tab = currentTab()
      S.sheet = {
        kind: 'add', tab: S.tab, section: activeSection(),
        // Eat carries two lists, and a heading of drinks is not asking for food.
        list: tab.lists.includes('drinks') && cat === 'Drinks' ? 'drinks' : tab.lists[0],
        day: el.dataset.day, category: cat,
      }
      renderSheet()
      break
    }

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
        catch {
          await askCopy({
            title: 'Copy this link',
            blurb: 'Send it to whoever is coming — it is the way in to the trip.',
            value: url,
          })
        }
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
        S.camp = false
        history.pushState({ tripView: false }, '', `/t/${trip.id}`)
        if (memberId) await syncNotificationsForTrip(trip.id)
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
      const one = {
        list: f.list, title: f.title, category: f.category || 'Other', qty: f.qty, note: f.note, kind: f.kind,
        place: f.place, lat: f.lat, lon: f.lon, time: f.time,
      }
      const days = daysPicked(f.day)
      await mutate(() => api(`/trips/${S.trip.id}/items`, { method: 'POST', body: { items: perDay(one, days) } }))
      // Standing on Saturday, two of those three landed somewhere you cannot
      // see. Said once, rather than a sheet that stays open to prove it.
      if (days.length > 1) toast(`Added on ${days.length} days.`)
      break
    }

    case 'send-message': {
      // Both, because they are answers to different questions: the trimmed one
      // is the message, and the raw one is what the box will still be holding
      // afterwards if nobody has typed over it.
      const typed = String(f.text ?? '')
      const text = typed.trim()
      if (!text || S.chat.busy || S.chat.tripId !== S.trip.id) break
      const tripId = S.trip.id
      // What it is answering is part of the message, so a retry is only the
      // same send if the quote on it is the same one too.
      const replyTo = S.chat.replyTo?.id ?? null
      const pending = S.chat.pending?.text === text && (S.chat.pending?.replyTo ?? null) === replyTo
        ? S.chat.pending
        : { clientId: newMessageId(), text, replyTo }
      S.chat.pending = pending
      S.chat.draft = text
      S.chat.busy = true
      const send = form.querySelector('button[type="submit"]')
      if (send) {
        send.disabled = true
        send.setAttribute('aria-label', 'Sending message')
        send.innerHTML = '<span class="chat__sending" aria-hidden="true">…</span>'
      }
      const wasAvailable = S.chat.assistantAvailable
      try {
        // Turning Camp off took away the invitation — the placeholder, the
        // completion, the line offering it — but not the answer: typing the
        // eight characters yourself still summoned it, in a room the settings
        // page had promised was just the group. So the sender says whether it
        // wants one, and the room stays as quiet as it looks.
        const { message, assistant, assistantAvailable } = await api(`/trips/${tripId}/messages`, {
          method: 'POST', body: { ...pending, invokeAssistant: wants('assistant') },
        })
        if (S.chat.tripId !== tripId) break
        mergeMessages([message])
        S.chat.assistantAvailable = !!assistantAvailable
        if (assistant?.status === 'queued' && assistant.runId) {
          S.chat.streams[assistant.runId] ??= {
            runId: assistant.runId, body: '', state: 'thinking', error: '',
          }
        } else if (assistant?.status === 'unavailable') {
          toast('Camp is not available yet. Your message was saved for the group.')
        } else if (assistant?.status === 'busy') {
          toast('Camp already has a few requests queued. Try again shortly.')
        } else if (assistant?.status === 'limited') {
          toast('Camp has answered you a lot this hour. Your message was saved for the group.')
        }
        S.chat.pending = null
        S.chat.busy = false
        // Emptied first, so that whatever the draft is left holding — nothing,
        // or the sentence started while this was in flight — is what a redraw
        // would put back in the box.
        //
        // Whether Camp is there changes the composer itself — its label, its
        // placeholder, the mention list beside it — so that one needs the redraw.
        const emptied = clearComposer(typed, pending.replyTo)
        if (S.chat.assistantAvailable !== wasAvailable || !emptied) {
          render({ chatBottom: true })
        }
        root.querySelector('#chat-text')?.focus()
      } catch (err) {
        if (S.chat.tripId !== tripId) break
        // If the request reached the server but its answer did not reach us,
        // the same client id goes with the retry. A true key conflict needs a
        // fresh id, otherwise it could never recover.
        if (err.payload?.conflict === 'message-retry') S.chat.pending = null
        S.chat.busy = false
        if (send) {
          send.disabled = false
          send.setAttribute('aria-label', 'Send message')
          send.innerHTML = ICONS.send
        }
        toast(err.message)
      }
      break
    }

    // One form for when and where, so one save. The server takes the two dates
    // as independent strings and has no opinion about their order, so the one
    // order that is not a trip is stopped here — a trip that ends before it
    // starts empties the day strip, the countdown and the forecast at once.
    case 'save-trip': {
      const from = String(f.start_date ?? ''), to = String(f.end_date ?? '')
      if (from && to && to < from) {
        toast('That ends before it starts. Have another look at the dates.')
        break
      }
      // Typing in the search box drops the pin behind it, so coordinates never
      // outlive the address they were found for. A pasted map link does — it
      // wins over the pin everywhere it is used, and whoever pasted it is the
      // one who knows whether it still points at the right gate.
      const moved = String(f.location ?? '').trim() !== String(S.trip.location ?? '').trim()
      const sent = String(f.map_url ?? '').trim()

      if (!await mutate(() => api(`/trips/${S.trip.id}`, { method: 'PATCH', body: f }))) break
      // Only now: a save that failed leaves the form on screen with what you
      // typed still in it, which is the only copy of it there is.
      S.editWhere = false
      render()

      // The server keeps only ordinary web links, so a mistyped one comes back
      // empty. Better to say so than to leave a button that goes nowhere.
      toast(sent && !String(S.trip.map_url ?? '').trim()
        ? "Saved — that map link didn't look like a link, so it wasn't kept."
        : moved && sent ? 'Saved. The map link still points where it did.'
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

    // The one thing on the when sheet you type rather than tap. The sheet stays
    // open, because the day chips above it are where you were and where you may
    // well be going next.
    case 'save-time': {
      const id = form.dataset.id
      // What it says has to be true of the thing, not of the box: an empty field
      // on a plan that never had a time has removed nothing.
      const had = S.items.find((i) => i.id === id)?.time
      const want = String(f.time ?? '').trim()
      await mutate(() => api(`/items/${id}`, { method: 'PATCH', body: { time: want } }))
      toast(want ? 'Saved.' : had ? 'Time removed.' : 'No time on it, then.')
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
      if (!await mutate(() => api(`/trips/${S.trip.id}`, { method: 'PATCH', body: { notes: f.notes } }))) break
      S.editNotes = false
      render()
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

    case 'save-expense': {
      const expenseId = form.dataset.expense
      const participants = new FormData(form).getAll('participantIds')
      const split = f.splitMode === 'custom' ? 'custom' : 'equal'
      const body = {
        description: f.description, amount: f.amount, paidBy: f.paidBy, participants, split,
        ...(form.dataset.id ? { itemId: form.dataset.id, claimMemberId: form.dataset.member } : {}),
      }
      if (split === 'custom') {
        const custom = customExpenseShares(form, participants, f.amount)
        if (custom.error) { toast(custom.error); break }
        body.shares = custom.shares
      }
      const path = expenseId ? `/expenses/${expenseId}` : `/trips/${S.trip.id}/expenses`
      if (!await mutate(() => api(path, { method: expenseId ? 'PATCH' : 'POST', body }))) break
      S.sheet = null
      renderSheet()
      toast('Expense saved.')
      break
    }

    case 'save-payment': {
      if (f.from === f.to) { toast('A payment needs two different people.'); break }
      const sheet = S.sheet
      if (sheet?.kind !== 'payment') break
      sheet.clientId ||= newMessageId()
      const sent = await mutate(
        () => api(`/trips/${S.trip.id}/payments`, {
          method: 'POST',
          body: { clientId: sheet.clientId, from: f.from, to: f.to, amount: f.amount, note: f.note },
        }),
        // The key named one exact handover and this is a different one, so it
        // needs a key of its own. The next press is then an ordinary send.
        (err) => { if (err.payload?.conflict === 'payment-retry') sheet.clientId = newMessageId() },
      )
      if (!sent) break
      S.sheet = null
      renderSheet()
      toast('Payment recorded.')
      break
    }

    case 'save-currency':
      if (!await mutate(() => api(`/trips/${S.trip.id}`, {
        method: 'PATCH', body: { currency: f.currency },
      }))) break
      S.sheet = null
      renderSheet()
      toast(`Trip currency is ${tripCurrency()}.`)
      break
  }
})

document.addEventListener('keydown', (ev) => {
  // A question in front of everything else answers for everything else: Escape
  // walks away from it rather than closing the sheet standing behind it.
  if (askAnswer) {
    if (ev.key === 'Escape') closeAsk(false)
    // Enter on a button is that button, and one of them is Cancel. Anywhere
    // else in the dialog it is the answer being held out.
    else if (ev.key === 'Enter' && ev.target.tagName !== 'BUTTON') closeAsk(true)
    return
  }
  if (ev.target.id === 'chat-text') {
    const mention = root.querySelector?.('#chat-mention')
    if (mention && !mention.hidden && (ev.key === 'Enter' || ev.key === 'Tab')) {
      ev.preventDefault()
      acceptCampMention(ev.target)
      return
    }
    if (mention && !mention.hidden && ev.key === 'Escape') {
      ev.preventDefault()
      setCampMentionOpen(ev.target, false)
      return
    }
    // The mention list first, then the quote: escape takes the most recent thing
    // off, and the box itself is never what it closes.
    if (S.chat.replyTo && ev.key === 'Escape') {
      ev.preventDefault()
      S.chat.replyTo = null
      ev.target.form?.querySelector('.chat__replying')?.remove()
      return
    }
  }
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
  if (ev.target.id === 'chat-text') {
    S.chat.draft = ev.target.value
    fitChatBox(ev.target)
    syncCampMention(ev.target)
  }
  const expenseForm = ev.target.closest?.('form[data-act="save-expense"]')
  if (expenseForm) {
    if (ev.target.name === 'participantIds') {
      const row = ev.target.closest('.expense-person')
      const share = row?.querySelector('input[name^="share:"]')
      if (share) share.disabled = expenseForm.dataset.split !== 'custom' || !ev.target.checked
    }
    updateExpenseShareTotal(expenseForm)
  }
  const box = ev.target.closest?.('[data-find]')
  if (box && !ev.isComposing) typedFind(box)
})

window.addEventListener('resize', () => fitChatBox(root.querySelector?.('#chat-text')))

// Incoming rows are painted beside the focused composer, without rebuilding
// it under the keyboard. The first blur catches the rest of the room UI up.
document.addEventListener('focusout', (ev) => {
  if (ev.target.id !== 'chat-text') return
  setTimeout(() => {
    if (!document.activeElement?.closest?.('#chat-mention')) {
      setCampMentionOpen(ev.target, false)
    }
  }, 0)
  if (!chatNeedsRender) return
  setTimeout(() => {
    if (chatNeedsRender && document.activeElement?.id !== 'chat-text') showChatChanges()
  }, 0)
})

document.addEventListener('focusin', (ev) => {
  if (ev.target.id === 'chat-text') syncCampMention(ev.target)
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

// Tapping send hands focus to the button, and the phone takes the keyboard away
// with it — the room grows by a few hundred pixels and shrinks again when focus
// comes back after the send, which is the flinch you see. Refusing the focus
// leaves the caret in the textarea and the keyboard where it was; the click
// behind this still submits the form.
document.addEventListener('mousedown', (ev) => {
  if (ev.target.closest?.('.chat__send')) ev.preventDefault()
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

// The fade at the ends of a sideways row has to be told when the row moves, and
// scroll does not bubble — hence the capture, which is how the line above hears
// about it too. Passive: nothing here is going to cancel a swipe.
document.addEventListener('scroll', (ev) => {
  const row = ev.target
  if (row?.matches?.(ROWS)) edges(row)
}, { capture: true, passive: true })

// And when the window changes shape, because a row that fitted in portrait is a
// row that scrolls in landscape, and neither one has been touched. The same goes
// for six lines of notes, which is a different amount of writing on each.
window.addEventListener('resize', () => { markEdges(); markClamp() })

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
    // The room is as tall as the screen less the keyboard, so raising the keys
    // takes a few hundred pixels off the thread — and a scroller that was at the
    // bottom is suddenly some way short of it, with the newest message hidden
    // behind the composer. Asked before the height changes, put back after.
    const body = root.querySelector?.('.chat__body')
    const following = body
      ? body.scrollHeight - body.scrollTop - body.clientHeight < 96
      : false
    document.documentElement.style.setProperty('--kb', `${kb}px`)
    document.documentElement.classList.toggle('is-kb', kb > 0)
    if (following) followChat(body)
    if (P.list.length) fitPlaces()
  }
  vv.addEventListener('resize', apply)
  vv.addEventListener('scroll', apply)
  apply()
}
watchKeyboard()

// Back is an answer, and the answer is no. confirm() used to stop the event loop
// dead, so the button could not be pressed while it was up; a question that
// waits on a promise can be walked out from under, and answering it afterwards
// would run "Remove" against a trip you have already left.
//
// Moving between the pages of the trip already on screen is a redraw and not an
// arrival — the same trip, the same state, already in hand. Booting it again
// left the room sitting there for three requests to end up drawing the list it
// had all along, which is a long time to spend on a back button. Anything else
// — another trip, the home page, settings, a state we cannot account for — is a
// visit, and boot is what a visit is.
function onPop() {
  closeAsk(false)
  const found = tripRoute()
  if (S.view !== 'trip' || !S.trip || found?.code !== S.trip.id) { boot(); return }
  const route = found.view || history.state?.tripView
  S.camp = route === 'room' || route === 'settle' || route === 'overview' ? route : false
  if (!S.camp) restoreList(history.state)
  render()
  // Render puts the page back where it was standing, which on the way out of the
  // room is the top of it. Where you were is on the entry we came back to.
  window.scrollTo(0, history.state?.y ?? 0)
}
window.addEventListener('popstate', onPop)

// ---- sync -------------------------------------------------------------------

async function pollMessages() {
  if (S.camp !== 'room' || S.chat.tripId !== S.trip.id || S.chat.loading
      || S.chat.busy || S.chat.error || isEditing()) return
  const tripId = S.trip.id
  try {
    if (await syncNewMessages(tripId)) showChatChanges()
  } catch { /* offline; try again next tick */ }
}

async function poll() {
  if (S.view !== 'trip' || !S.trip || document.hidden || S.busy) return
  await pollMessages()
  try {
    const { rev } = await api(`/trips/${S.trip.id}/rev`)
    if (rev !== S.rev) {
      // Don't yank the page out from under someone mid-edit.
      if (isEditing()) return
      absorb(await api(`/trips/${S.trip.id}`))
    }
  } catch { /* offline; try again next tick */ }
}

setInterval(poll, 5000)

// Coming back to the tab asks both questions at once: what has changed on the
// trip, and what has changed on the clock. A phone that was asleep at midnight
// ran no timer, so this is where the day actually turns most of the time.
document.addEventListener('visibilitychange', () => {
  syncRoomPresence()
  if (document.hidden) return
  turnDay()
  poll()
  ensureChatSocket()
  markRoomRead()
})

// A phone that walks back into signal should not wait out the rest of the tick.
window.addEventListener('online', () => { poll(); reconnectChatNow() })
window.addEventListener('offline', () => {
  stopChatSocket('offline')
  toast('No signal. The list still reads; changes will not save.')
})

// ---- installed app ----------------------------------------------------------

// The worker is what makes this installable and what keeps the last state the
// server sent, so opening the app at a campsite with no bars shows your list
// rather than nothing. Registration waits for load so it never competes with
// the first paint or the first fetch of a trip.
if ('serviceWorker' in navigator) {
  const pageVersion = document.querySelector('meta[name="camping-sync-version"]')?.content
  let workerRegistration = null
  let announcedVersion = null

  // A worker announces the build it has activated. A reload can fetch the new
  // page before that worker takes control, so controllerchange alone is not an
  // update signal: only a build newer than this running page is.
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type !== 'app-version') return
    const workerVersion = event.data.version
    if (!pageVersion || !workerVersion || workerVersion === pageVersion || workerVersion === announcedVersion) return
    announcedVersion = workerVersion
    toast('Update ready. Reopen the app to get it.')
  })

  const checkForAppUpdate = () => {
    if (document.hidden || !workerRegistration) return
    workerRegistration.update().catch(() => {
      /* plain http, private mode, or no support: still an app, just not offline */
    })
  }

  window.addEventListener('load', async () => {
    try {
      workerRegistration = await navigator.serviceWorker.register('/sw.js')
    } catch {
      /* plain http, private mode, or no support: still an app, just not offline */
    }
  })

  // Registration checks on page load, but a home-screen app can remain open
  // through several deploys. Check while it is in use and immediately when the
  // person returns to it; one request a minute keeps this prompt timely without
  // turning the worker script into part of the five-second trip-state poll.
  setInterval(checkForAppUpdate, 60_000)
  window.addEventListener('focus', checkForAppUpdate)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkForAppUpdate()
  })
  window.addEventListener('online', () => {
    if (!document.hidden) checkForAppUpdate()
  })
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

let deferred = null   // Chrome's beforeinstallprompt, held back for our moment
let installTimer

// One gate for both ways the offer appears — the card that comes to you after a
// couple of visits, and the standing nudge at the foot of the home page — so
// turning it off in settings turns off the asking rather than one of its halves.
const canInstall = () => wants('install') && !isInstalled() && !inWebview && (!!deferred || iosSafari)

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
  // Before anything is asked for or drawn: the settings decide what the rest of
  // the boot is allowed to do, and the theme is already on the page from the
  // inline script in index.html — this is what keeps the two agreeing after a
  // change, and what re-applies it when the phone flips at sunset.
  loadPrefs()

  await Promise.all([
    api('/auth').then(applyAuth, () => {
      S.auth = { loaded: true, clientId: '', devBypass: false, user: null, memberships: [] }
    }),
    api('/catalog').then(({ catalog, tips }) => {
      S.catalog = catalog
      S.tips = tips
    }, () => { /* the app still works without suggestions */ }),
  ])

  const found = tripRoute()
  if (isSettingsRoute()) showSettings(history.state?.back ?? '/')
  else if (found) {
    const route = found.view || history.state?.tripView
    S.camp = route === 'room' || route === 'settle' || route === 'overview' ? route : false
    await openTrip(found.code)
  }
  else await showLanding()

  considerInstall()
}

if (!globalThis.__CAMPING_SYNC_TEST__) boot()
