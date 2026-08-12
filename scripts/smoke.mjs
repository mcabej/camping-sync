// Throwaway: renders every screen against a stubbed DOM so a typo in the
// tab-bar rework shows up here rather than on somebody's phone.
import { readFileSync } from 'node:fs'

// Focus is real enough here to be tested. A stub where focus() does nothing and
// activeElement is forever null cannot tell whether the dialog hands the focus
// back when it closes — it would pass either way, which is not a test.
let onFocus = null
const el = () => {
  const node = {
    innerHTML: '', textContent: '', value: '',
    classList: { add() {}, remove() {}, toggle() {} },
    querySelector: () => null, querySelectorAll: () => [],
    setAttribute() {}, removeAttribute() {}, setSelectionRange() {},
    addEventListener() {},
    focus() { onFocus = node },
    matches: () => false, closest: () => null, getBoundingClientRect: () => ({ top: 0, bottom: 0 }),
  }
  return node
}
const roots = { root: el(), 'sheet-root': el(), 'ask-root': el(), toast: el(), install: el() }

// The dialog takes the focus off the page on its way in, which is the half of
// it that makes handing the focus back afterwards worth checking. Nothing here
// parses HTML, so the ask root answers the one question the dialog asks of it.
const askButton = el()
roots['ask-root'].querySelector = (sel) => (
  sel === '[autofocus]' && roots['ask-root'].innerHTML.includes('autofocus') ? askButton : null)

// The theme is written to the root element and to the meta tag the browser
// paints the status bar from, so both are real enough here to be read back.
const themeMeta = { content: '' }
const appVersionMeta = { content: 'build-a' }
// The app subscribes to the document at load. Keeping the handlers rather than
// dropping them is what lets the gesture tests below press on a message: a swipe
// and a long press are not renders, so there is nothing to read out of the HTML
// and the only way to ask what they do is to do them.
const docListeners = {}
const fire = (type, ev) => { for (const fn of docListeners[type] ?? []) fn(ev) }
globalThis.document = {
  getElementById: (id) => roots[id],
  addEventListener(type, fn) { (docListeners[type] ??= []).push(fn) },
  createElement: el,
  documentElement: { style: { setProperty() {} }, classList: { toggle() {} }, dataset: {} },
  body: { classList: { add() {}, remove() {}, toggle() {} }, style: { setProperty() {}, removeProperty() {} } },
  hidden: false,
  querySelector: (sel) => (
    sel === 'meta[name="theme-color"]' ? themeMeta
      : sel === 'meta[name="camping-sync-version"]' ? appVersionMeta
        : null
  ),
  // Readable and writable, because the tests set it by hand to say "the cursor
  // is in the message box" and focus() sets it the way the app does.
  get activeElement() { return onFocus },
  set activeElement(node) { onFocus = node },
}
// What the phone itself is set to, which the tests move to check that "System"
// follows it. addEventListener is real: the app subscribes to it at load.
let systemDark = false
const themeWatchers = []
globalThis.matchMedia = (query) => ({
  get matches() { return query.includes('dark') ? systemDark : false },
  addEventListener: (_ev, fn) => themeWatchers.push(fn),
})
const setSystemDark = (dark) => {
  systemDark = dark
  for (const fn of themeWatchers) fn()
}
// The window listeners are kept and the scroll position is real, because "back
// puts you where you were" is a claim about both: a handler that was never
// registered and a scroll that was never restored both look like a pass to a
// test that calls the function itself and reads the number back out of history.
// Firing is left to the tests rather than done from history.back() — a browser
// follows the pop with a popstate of its own, but doing that here would run
// boot() in the middle of the settings tests, which pop on purpose.
const winListeners = {}
const fireWindow = (type, ev) => { for (const fn of winListeners[type] ?? []) fn(ev) }
globalThis.window = {
  scrollY: 0,
  scrollTo(_x, y) { globalThis.window.scrollY = Number(y) || 0 },
  scrollBy() {},
  addEventListener(type, fn) { (winListeners[type] ??= []).push(fn) },
  innerHeight: 800, visualViewport: null, matchMedia: globalThis.matchMedia,
}
globalThis.location = { pathname: '/', origin: 'http://x', protocol: 'http:', host: 'x' }
// A real stack, because the question the settings page asks of history is not
// "did you call pushState" but "is the trip still underneath afterwards". Two
// empty functions answer yes to both a page that pops what it pushed and a page
// that piles a second copy on top, and those are the bug and the fix.
const entries = [{ state: null, path: '/' }]
const resetHistory = (path = '/') => {
  entries.length = 0
  entries.push({ state: null, path })
  globalThis.location.pathname = path
}
globalThis.history = {
  get state() { return entries[entries.length - 1].state },
  get length() { return entries.length },
  pushState(state, _title, path) {
    entries.push({ state, path })
    globalThis.location.pathname = path
  },
  replaceState(state, _title, path) {
    entries[entries.length - 1] = { state, path }
    globalThis.location.pathname = path
  },
  // The pop only. A browser follows it with a popstate, and what the app makes
  // of that is boot's job, tested where boot is.
  back() {
    if (entries.length > 1) entries.pop()
    globalThis.location.pathname = entries[entries.length - 1].path
  },
}
globalThis.WebSocket = undefined
// A real store, so what the app remembers between visits can be tested.
const store = new Map()
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  get length() { return store.size },
  key: (i) => [...store.keys()][i] ?? null,
}
// Enough of the push stack to be a browser that has one: the settings page asks
// whether notifications are possible at all before it offers any switches, and
// that question is three — a Notification, a service worker, a PushManager.
globalThis.Notification = { permission: 'granted', requestPermission: async () => 'granted' }
globalThis.PushManager = function PushManager() {}
// Node brings a navigator of its own, and it is read-only, so this replaces it
// rather than adding to it.
const workerListeners = {}
const fireWorker = (type, ev) => { for (const fn of workerListeners[type] ?? []) fn(ev) }
let workerUpdates = 0
const workerRegistration = { update: async () => { workerUpdates++ } }
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: {
    userAgent: 'node',
    serviceWorker: {
      controller: {},
      getRegistration: async () => null,
      register: async () => workerRegistration,
      addEventListener(type, fn) { (workerListeners[type] ??= []).push(fn) },
    },
  },
})
globalThis.fetch = async () => ({ ok: true, json: async () => ({ catalog: {}, tips: [] }) })
globalThis.__CAMPING_SYNC_TEST__ = true

const src = readFileSync('public/app.js', 'utf8')
const hooks = ['S', 'render', 'viewTrip', 'renderSheet', 'CAMP', 'TABS',
  'loadFolds', 'saveFolds', 'autoFold', 'pageGroups', 'tripDays',
  'dayTurned', 'turnDay', 'tillMidnight', 'edges', 'perDay', 'daysPicked',
  'ensureChatSocket', 'stopChatSocket', 'showChatChanges', 'fitChatBox',
  'clearComposer', 'watchKeyboard',
  'campMentionRange', 'completeCampMention',
  'settlement', 'customExpenseShares', 'googleSignIn', 'tripRoute', 'isEditing', 'unsaved', 'restore',
  'ask', 'askCopy', 'closeAsk',
  'loadPrefs', 'savePrefs', 'applyTheme', 'viewSettings', 'showSettings', 'leaveSettings',
  'isSettingsRoute', 'FEATURES', 'THEMES', 'PREFS_KEY', 'FACES',
  'pushTripView', 'leaveFocus']
new Function(`${src}\n;Object.assign(globalThis, {${hooks.map((h) => `__${h}: ${h}`).join(',')}})`)()

const { __S: S, __render: render, __viewTrip: viewTrip, __renderSheet: renderSheet, __TABS: TABS,
  __loadFolds: loadFolds, __saveFolds: saveFolds, __autoFold: autoFold,
  __tripDays: tripDays, __dayTurned: dayTurned, __turnDay: turnDay,
  __tillMidnight: tillMidnight, __edges: edges, __perDay: perDay,
  __daysPicked: daysPicked, __ensureChatSocket: ensureChatSocket,
  __stopChatSocket: stopChatSocket, __showChatChanges: showChatChanges,
  __fitChatBox: fitChatBox, __clearComposer: clearComposer, __watchKeyboard: watchKeyboard,
  __campMentionRange: campMentionRange, __completeCampMention: completeCampMention,
  __settlement: settlement, __customExpenseShares: customExpenseShares,
  __googleSignIn: googleSignIn, __tripRoute: tripRoute, __isEditing: isEditing,
  __unsaved: unsaved, __restore: restore,
  __ask: ask, __askCopy: askCopy, __closeAsk: closeAsk,
  __loadPrefs: loadPrefs, __savePrefs: savePrefs, __applyTheme: applyTheme,
  __viewSettings: viewSettings, __showSettings: showSettings, __leaveSettings: leaveSettings,
  __isSettingsRoute: isSettingsRoute, __FEATURES: FEATURES, __THEMES: THEMES,
  __PREFS_KEY: PREFS_KEY, __FACES: FACES,
  __pushTripView: pushTripView, __leaveFocus: leaveFocus } = globalThis
const { CATALOG } = await import('../lib/catalog.js')

// A trip with a bit of everything: claimed by one, claimed by three, unclaimed,
// half packed, personal, plans.
const claim = (id, packed = false) => ({ member_id: id, packed })
const item = (o) => ({ id: o.t, list: 'gear', category: 'Shelter', title: o.t, note: '', qty: '',
  kind: 'shared', claims: [], place: '', lat: null, lon: null, day: '', time: '',
  votes: [], own: [], ...o })

S.catalog = CATALOG
S.tips = [{ title: 'a', body: 'b' }]
S.me = 'm1'
S.view = 'trip'
S.trip = { id: 't1', name: 'Wasdale Weekend', location: 'Wasdale Head, CA20 1EX', lat: 54, lon: -3,
  map_url: '', start_date: '2026-09-04', end_date: '2026-09-06', notes: 'Gate code 1470', currency: 'GBP', rev: 1 }
S.members = [{ id: 'm1', name: 'Josh', hue: 0 }, { id: 'm2', name: 'Sam', hue: 1 },
  { id: 'm3', name: 'Ali Khan', hue: 2 }, { id: 'm4', name: 'Robin', hue: 3 }]
S.events = [{ actor: 'Sam', text: 'added Tent', created_at: new Date().toISOString() }]
S.chat = {
  ...S.chat, tripId: 't1', loading: false, hasMore: true,
  messages: [
    { id: 0, client_id: 'camp-zero', member_id: null, role: 'assistant', author_name: 'Camp',
      body: 'Gaps I see:\n\n- **Shelter:** Confirm the tent fits both people.\n- **Water:** Confirm the quantity.\n- **Note:** <img src=x onerror=alert(1)>',
      created_at: new Date().toISOString() },
    { id: 1, client_id: 'one', member_id: 'm2', author_name: 'Sam', body: 'Can we leave by eight?', created_at: new Date().toISOString() },
    { id: 2, client_id: 'two', member_id: 'm1', author_name: 'Josh', body: 'Yes — meet at mine.', created_at: new Date().toISOString() },
  ],
}
S.items = [
  item({ t: 'Tent', claims: [claim('m1')] }),
  item({ t: 'Camp stove', claims: [claim('m1', true)], category: 'Camp kitchen' }),
  item({ t: 'Cooler', claims: [claim('m2')], category: 'Camp kitchen' }),
  item({ t: 'Firewood' }),
  item({ t: 'Sleeping bag', kind: 'own', category: 'Shelter', own: ['m1'] }),
  item({ t: 'Headlamp', kind: 'own', category: 'Light & power', own: [] }),
  item({ t: 'Burgers', list: 'food', category: 'Dinner', claims: [claim('m1')] }),
  item({ t: 'Crisps', list: 'food', category: 'Snacks' }),
  // The whole point of the rework: three people splitting one line on the list,
  // each with their own tick, and a fourth name that no longer has a face.
  item({ t: 'Beer', list: 'drinks', category: 'Drinks',
    claims: [claim('m1', true), claim('m2'), claim('m3'), claim('gone')] }),
  item({ t: 'Drinking water', list: 'drinks', category: 'Drinks' }),
  item({ t: 'Hike', list: 'activities', category: 'Daytime', votes: ['m1'], claims: [claim('m2')] }),
]
S.expenses = [
  { id: 'beer-cost', item_id: 'Beer', claim_member_id: 'm1', description: 'Beer', amount: 1001,
    paid_by: 'm2', participants: ['m1', 'm2', 'm3', 'm4'] },
  // Petrol is not packing-list cargo, and only the people in this car share it.
  { id: 'petrol', item_id: null, claim_member_id: null, description: 'Petrol', amount: 6000,
    paid_by: 'm1', participants: ['m1', 'm3'] },
]

const find = (html, needle) => html.includes(needle)
let bad = 0
const check = (label, ok) => { if (!ok) { bad++; console.log(`  FAIL  ${label}`) } else console.log(`  ok    ${label}`) }
const section = (title) => console.log(`\n${title}`)

section('App updates')

// An open copy asks again when it returns to the foreground. The browser may
// make its own opportunistic checks, but that is not a deploy signal an open
// app can rely on.
fireWindow('load', {})
await new Promise((resolve) => setImmediate(resolve))
fireWindow('focus', {})
await new Promise((resolve) => setImmediate(resolve))
check('returning to the app checks the service worker for an update', workerUpdates === 1)

// The version belongs to the page, not to whichever worker happened to control
// the navigation at its first instant. A reload can load build A and then be
// claimed by build A; that is not news. A still-open build A claimed by build B
// is the page that actually needs reopening.
roots.toast.textContent = ''
fireWorker('message', { data: { type: 'app-version', version: 'build-a' } })
check('a freshly loaded current page is not told to reopen', roots.toast.textContent === '')
fireWorker('message', { data: { type: 'app-version', version: 'build-b' } })
check('an open old page is told when a new build takes control',
  roots.toast.textContent === 'Update ready. Reopen the app to get it.')

const signedAuth = S.auth
S.auth = { ...signedAuth, clientId: '', devBypass: true, user: null }
check('development auth bypass replaces missing Google sign-in',
  find(googleSignIn(), 'data-act="dev-sign-in"') && !find(googleSignIn(), 'not been configured'))
S.auth = signedAuth
check('the focused Settle up URL resolves back to the same trip',
  tripRoute('/t/pine-camp-123/settle')?.code === 'pine-camp-123'
  && tripRoute('/t/pine-camp-123/settle')?.view === 'settle')

const growingBox = { scrollHeight: 92, style: {} }
fitChatBox(growingBox)
check('the chat composer grows with its content', growingBox.style.height === '92px' && growingBox.style.overflowY === 'hidden')
growingBox.scrollHeight = 240
fitChatBox(growingBox)
check('the chat composer stops growing before it takes over the room', growingBox.style.height === '180px' && growingBox.style.overflowY === 'auto')

const FILTERS = [{ kind: '', cat: '' }, { kind: 'shared', cat: '' }, { kind: 'own', cat: '' },
  { kind: '', cat: 'Shelter' }, { kind: 'shared', cat: 'Nothing filed here' },
  { kind: '', cat: '', hide: true }, { kind: '', cat: '', q: 'te' },
  { kind: '', cat: '', q: 'nothing on any list' }, { kind: 'own', cat: '', hide: true, q: 'bag' }]

for (const camp of [false, 'overview']) {
  for (const t of TABS) {
    S.tab = t.id
    S.camp = camp
    for (const f of FILTERS) {
      S.filter = f
      const html = viewTrip()
      check(`${camp ? 'camp over ' : ''}${t.id} ${f.kind || 'all'}/${f.cat || 'any'} renders`, html.length > 500)
    }
  }
}
S.filter = { kind: '', cat: '', hide: false, q: '' }

// The lists are one list now: both halves on the page, filtered from the top.
S.camp = false; S.tab = 'pack'
const both = viewTrip()
check('unfiltered Pack shows group kit', find(both, 'Tent') && find(both, 'Firewood'))
check('unfiltered Pack shows personal kit', find(both, 'Sleeping bag'))
check('personal rows say so when mixed in', find(both, 'personal kit · only you see this'))
check('the header switch is gone', !find(both, 'class="switch"'))
check('the header carries the way back to your trips', find(both, 'class="topbar__home" href="/" data-act="home"'))
check('the filters carry both kinds', find(both, 'data-act="filter-kind" data-value="own"'))
check('the filters carry categories', find(both, 'data-act="filter-cat" data-value="Camp kitchen"'))
check('open count rides the group chip', find(both, '<span class="filters__n">1</span>'))

// The row: your tick on the left, the thing in the middle, who has it on the right.
check('no sentences left on the row',
  !find(both, 'is bringing it') && !find(both, "Nobody&#39;s bringing this") && !find(both, 'Not packed yet<'))
check('unclaimed rows wear the blaze ring', find(both, 'class="tick tick--open" data-act="tick" data-id="Firewood"'))
check('what you are bringing wears your colour', find(both, 'class="tick tick--mine" data-act="tick" data-id="Tent"'))
check('what you have packed is filled in', find(both, 'class="tick tick--done" data-act="tick" data-id="Camp stove"'))
check('somebody else\'s claim leaves your tick plain', find(both, 'class="tick" data-act="tick" data-id="Cooler"'))
check('the middle of the row opens the item', find(both, 'class="item__open" data-act="open-item" data-id="Tent"'))
check('there is no × on the row any more', !find(both, 'data-act="kill" data-id="Tent"'))
check('personal kit has no faces beside it', !find(both, 'data-act="open-item" data-id="Sleeping bag">\n      <span class="who__face"'))

S.tab = 'eat'
const eatRows = viewTrip()
check('three people on one thing show three faces',
  (eatRows.match(/who__face/g) ?? []).length >= 3 && find(eatRows, '>JO<') && find(eatRows, '>AK<'))
check('a claimant who has left the trip is not a face', !find(eatRows, '>?<'))
check('a packed share is a filled face', find(eatRows, 'who__face who__face--packed'))
// Burgers and Beer have names on them; Crisps and Drinking water do not, and
// carry nothing on the right at all.
check('nothing at all beside a thing nobody has', (eatRows.match(/class="who"/g) ?? []).length === 2)
check('no + beside the faces', !find(eatRows, 'who__add') && !find(eatRows, 'who__none'))

section('Faces')

// Google hands a photograph over at sign-in and the app was drawing two letters
// on top of it. The letters are still the answer for everybody it has no picture
// of — someone who joined by link and typed a name — so both have to hold, and
// usually side by side on the same row.
const plainMembers = S.members
const wasCamp = S.camp
S.members = plainMembers.map((m) => (m.id === 'm2' || m.id === 'm3'
  ? m
  : { ...m, picture: `https://lh3.example/${m.id}.png?sz="96` }))
const withFaces = viewTrip()
check('somebody Google has a picture of is drawn as that picture',
  find(withFaces, 'class="face__photo" src="https://lh3.example/m1.png?sz=&quot;96"'))
// The URL is somebody else's string arriving by way of the server.
check('and a quote in it cannot end the attribute it sits in', !find(withFaces, 'sz="96"'))
check('whoever it has no picture of keeps their initials', find(withFaces, '>AK<'))
check('and the person it does have one of stops wearing theirs', !find(withFaces, '>JO<'))
// Packed used to be a filled circle, which is a thing you cannot do to a face
// without covering the person up.
check('a packed share still says so, in a corner the next face does not cover',
  find(withFaces, 'class="who__tick"'))

S.camp = 'room'
const roomFaces = viewTrip()
check('a message is signed with whoever wrote it rather than a coloured tab',
  find(roomFaces, 'class="thread__mark thread__mark--face"') && !find(roomFaces, '<span class="thread__mark" style='))
check('the one without a picture is signed with initials in the same place',
  find(roomFaces, '>SA<'))
check('and Camp keeps its own mark', find(roomFaces, '<span class="thread__mark" aria-hidden="true">'))

S.camp = 'overview'
check('the roster is the people on the trip, at the size of a face',
  find(viewTrip(), 'class="person__face"'))

S.members = plainMembers
S.camp = wasCamp
S.tab = 'eat'
check('with nobody signed in through Google, every face is initials again',
  !find(viewTrip(), 'face__photo') && find(viewTrip(), '>JO<'))

S.tab = 'pack'

S.filter = { kind: 'own', cat: '', hide: false, q: '' }
const own = viewTrip()
check('personal kit filter keeps your own', find(own, 'Sleeping bag') && find(own, 'Headlamp'))
check('personal kit filter drops the group', !find(own, '>Tent<') && !find(own, 'Firewood'))
check('personal rows need no label on their own page', !find(own, 'personal kit · only you see this'))
check('the pressed chip shows as pressed', find(own, 'data-value="own" aria-pressed="true"'))

S.filter = { kind: '', cat: 'Camp kitchen', hide: false, q: '' }
const kitchen = viewTrip()
check('category filter keeps its category', find(kitchen, 'Camp stove') && find(kitchen, 'Cooler'))
check('category filter drops the rest', !find(kitchen, '>Tent<') && !find(kitchen, 'Firewood'))

S.filter = { kind: 'own', cat: 'Camp kitchen', hide: false, q: '' }
check('a filter with nothing behind it offers the way out',
  find(viewTrip(), 'data-act="filter-cat" data-value="Camp kitchen">Show the whole list'))

// The merge: one Eat tab must carry food and drink together.
S.filter = { kind: '', cat: '', hide: false, q: '' }; S.tab = 'eat'
const eat = viewTrip()
check('Eat shows food', find(eat, 'Burgers') && find(eat, 'Crisps'))
check('Eat shows drink', find(eat, 'Beer') && find(eat, 'Drinking water'))
check('Eat groups food before drink', eat.indexOf('>Dinner<') < eat.indexOf('>Drinks<'))
check('drinks are one heading', !find(eat, 'Hot drinks') && !find(eat, 'Cold drinks') && !find(eat, '>Water<'))
check('nothing on Eat is uningestible', !find(eat, 'cooler') && !find(eat, 'Cooler'))
check('Eat bar counts both lists', find(eat, '2</b> need someone'))

// Mine: claimed group kit plus personal kit, across lists, no plans.
S.filter = { kind: '', cat: '', hide: false, q: '' }
S.tab = 'mine'
const mine = viewTrip()
check('Mine has claimed gear', find(mine, 'Tent') && find(mine, 'Camp stove'))
check('Mine has claimed food/drink', find(mine, 'Burgers') && find(mine, 'Beer'))
check('Mine has personal kit', find(mine, 'Sleeping bag') && find(mine, 'Headlamp'))
check("Mine excludes others' claims", !find(mine, 'Cooler'))
check('Mine excludes plans', !find(mine, 'Hike'))
check('no badge on the tab you are on', !find(mine, 'style="background:var(--m0)">4'))
check('Mine has no standing paragraph', !find(mine, 'class="page__note"'))
check('Mine filters by kind', find(mine, 'data-act="filter-kind" data-value="own"'))
check('Mine filters by category', find(mine, 'data-act="filter-cat" data-value="Camp kitchen"'))
check('Mine counts are all yours, none blaze',
  !find(mine, 'class="filters__n">') && find(mine, 'class="filters__n" style="background:var(--m0)'))

S.filter = { kind: '', cat: 'Camp kitchen', hide: false, q: '' }
const mineKitchen = viewTrip()
check('Mine category filter keeps its category', find(mineKitchen, 'Camp stove'))
check('Mine category filter drops the rest', !find(mineKitchen, '>Tent<') && !find(mineKitchen, 'Sleeping bag'))
check('Mine drops the empty group with it', !find(mineKitchen, 'data-group="Eat"'))

S.filter = { kind: 'own', cat: '', hide: false, q: '' }
const mineOwn = viewTrip()
check('Mine personal filter keeps your own', find(mineOwn, 'Sleeping bag') && find(mineOwn, 'Headlamp'))
check('Mine personal filter drops what you claimed', !find(mineOwn, '>Tent<') && !find(mineOwn, 'Burgers'))
check('the bar follows the chip', find(mineOwn, '<b>1</b> still to pack'))
S.filter = { kind: '', cat: '', hide: false, q: '' }

// Folding: a long list is read a heading at a time, and a folded heading still
// says how much is behind it.
S.tab = 'pack'
const open = viewTrip()
check('every heading is a handle', find(open, 'data-act="fold" data-group="Shelter" aria-expanded="true"'))
S.folds.shut = new Set(['pack:Shelter'])
const folded = viewTrip()
check('a folded heading takes its rows off the page', !find(folded, 'data-id="Tent"'))
check('a folded heading keeps its tally', find(folded, 'data-group="Shelter"') && find(folded, '2/2'))
check('folding one heading leaves the others alone', find(folded, 'data-id="Camp stove"'))
check('the fold state belongs to the tab that set it', find(folded, 'data-group="Camp kitchen" aria-expanded="true"'))
S.tab = 'eat'
check('a heading folded on Pack is not folded on Eat',
  !find(viewTrip(), 'group--shut') && find(viewTrip(), 'Burgers'))
S.tab = 'mine'
S.folds.shut = new Set(['mine:Pack'])
const mineFolded = viewTrip()
check('Mine folds by the tab a thing came from', !find(mineFolded, 'data-id="Tent"') && find(mineFolded, 'data-id="Burgers"'))
S.tab = 'pack'
S.folds.shut = new Set(['pack:Shelter'])
S.filter = { kind: '', cat: 'Shelter', hide: false, q: '' }
check('a pressed category chip stands the folds down', find(viewTrip(), 'data-id="Tent"'))
S.filter = { kind: '', cat: '', hide: false, q: 'tent' }
check('a search stands the folds down too', find(viewTrip(), 'data-id="Tent"'))
S.filter = { kind: '', cat: '', hide: false, q: '' }
S.folds.shut = new Set()

// Fold all: one button that turns into its own undo.
const beforeFoldAll = S.items
S.items = [...S.items,
  item({ t: 'Mallet', category: 'Camp kitchen' }),
  item({ t: 'Lantern', category: 'Light & power' })]
const foldAll = viewTrip()
check('the page offers to fold every section', find(foldAll, 'data-act="fold-all" data-shut="true"'))
check('the fold-all button says what it will do', find(foldAll, 'Fold all</button>'))
S.folds.shut = new Set(['pack:Shelter', 'pack:Camp kitchen', 'pack:Light & power'])
const allFolded = viewTrip()
check('with everything folded the button offers the way back',
  find(allFolded, 'data-act="fold-all" data-shut="false"') && find(allFolded, 'Unfold all</button>'))
check('everything folded means no rows at all', !find(allFolded, '<li class="item'))
S.folds.shut = new Set()
S.items = beforeFoldAll

// Auto-folding: a heading with nothing left to answer folds itself, but only on
// the way in, and never one you have folded or unfolded yourself.
S.tab = 'eat'
autoFold()
check('a settled heading folds itself', S.folds.shut.has('eat:Dinner'))
check('a heading with a gap in it stays open', !S.folds.shut.has('eat:Snacks'))
S.folds.shut.delete('eat:Dinner')
S.folds.touched.add('eat:Dinner')
autoFold()
check('a heading you opened yourself is left alone', !S.folds.shut.has('eat:Dinner'))
S.folds = { shut: new Set(), touched: new Set() }

// And all of it is remembered between visits.
S.tab = 'pack'
S.folds.shut.add('pack:Shelter')
S.folds.touched.add('pack:Shelter')
saveFolds()
S.folds = { shut: new Set(), touched: new Set() }
loadFolds()
check('folds survive the app being closed',
  S.folds.shut.has('pack:Shelter') && S.folds.touched.has('pack:Shelter'))
check('folds are remembered per trip', store.has('cs.folds.t1'))
S.folds = { shut: new Set(), touched: new Set() }
store.delete('cs.folds.t1')

// Search: one box, across everything a thing is, however it is filed.
S.filter = { kind: '', cat: '', hide: false, q: '' }
check('a short list is just a list, with nothing to steer it', !find(viewTrip(), 'id="cs-find"'))
const short = S.items
S.items = [...short, item({ t: 'Tarp' }), item({ t: 'Mallet' }), item({ t: 'Paracord' })]
check('a list long enough to lose things in offers a search box', find(viewTrip(), 'id="cs-find"'))
S.items = short
S.filter = { kind: '', cat: '', hide: false, q: 'fire' }
const searched = viewTrip()
check('search keeps what matches', find(searched, 'data-id="Firewood"'))
check('search drops what does not', !find(searched, 'data-id="Tent"'))
check('search keeps its own box on screen', find(searched, 'id="cs-find"') && find(searched, 'value="fire"'))
check('search offers to clear itself', find(searched, 'data-act="find-clear"'))
const plain = S.items
S.items = plain.map((i) => (i.id === 'Firewood' ? { ...i, note: 'Buy it near the site' } : i))
S.filter = { kind: '', cat: '', hide: false, q: 'near the site' }
check('search reads the notes too', find(viewTrip(), 'data-id="Firewood"'))
S.items = plain
S.filter = { kind: '', cat: '', hide: false, q: 'zzzz' }
const noHits = viewTrip()
check('a search with nothing behind it says so', find(noHits, 'Nothing matches'))
check('and leaves you a way out', find(noHits, 'data-act="find-clear"') && find(noHits, 'id="cs-find"'))

// Hide sorted: the biggest cut on the page, and the one that wears no blaze.
S.filter = { kind: '', cat: '', hide: false, q: '' }
check('the list offers to hide what is sorted', find(viewTrip(), 'data-act="filter-hide"'))
S.filter = { kind: '', cat: '', hide: true, q: '' }
const left = viewTrip()
check('hiding sorted keeps what nobody has', find(left, 'data-id="Firewood"'))
check('hiding sorted drops what is claimed', !find(left, 'data-id="Tent"') && !find(left, 'data-id="Cooler"'))
check('hiding sorted drops your own kit once packed', !find(left, 'data-id="Sleeping bag"'))
check('hiding sorted keeps your own kit until then', find(left, 'data-id="Headlamp"'))
S.tab = 'mine'
check('on your own page the chip is about packing', find(viewTrip(), '>Hide packed'))
S.tab = 'do'
check('plans are never "sorted", so the chip stays away', !find(viewTrip(), 'data-act="filter-hide"'))
S.tab = 'pack'
S.filter = { kind: '', cat: '', hide: false, q: '' }

// Badges elsewhere: Pack has 1 unclaimed (Firewood), Eat has 2.
S.tab = 'pack'
const pack = viewTrip()
check('Pack tab badge suppressed while on Pack', !find(pack, '<span class="tabbar__flag">1<'))
check('Eat tab badge shows 2', find(pack, '<span class="tabbar__flag">2<'))
// Yours and unpacked: Tent, Burgers, Headlamp. The stove and the beer are your
// share of them already in the car; the sleeping bag is ticked.
check('Mine badge shows on other tabs, in your colour', find(pack, 'tabbar__flag" style="background:var(--m0)">3<'))
check('list badges stay blaze (no inline colour)', find(pack, '<span class="tabbar__flag">2<'))

// Camp is reachable from the header and lights up when you are on it.
check('the bar carries Camp alongside the tabs', find(pack, 'data-act="camp" >') || find(pack, 'data-act="camp">'))
S.camp = 'overview'
const campPageHtml = viewTrip()
check('Camp is lit when you are on it', find(campPageHtml, 'data-act="camp" aria-current="page"'))
check('trip page still renders its cards', find(campPageHtml, "Who's coming") && find(campPageHtml, 'When and where'))
// The dates and the place are one card and one form; there is no second form
// elsewhere on the page holding the other half of the same trip.
check('when and where is one card', (campPageHtml.match(/data-act="save-trip"/g) ?? []).length <= 1
  && !find(campPageHtml, 'Trip details'))
// The dates are the two ends of the stay and the nights between them, not one
// line of text you have to count on your fingers.
check('the stay strip draws both ends', find(campPageHtml, '>Arrive<') && find(campPageHtml, '>Leave<'))
check('the stay strip counts the nights for you', find(campPageHtml, '2 nights'))
check('and says the whole of it out loud once', find(campPageHtml, 'class="sr-only">Fri'))
// Every bar you are carrying something on, including the one that is not a list.
check('the status card counts your own load too', find(campPageHtml, 'data-act="tab" data-tab="mine"'))
check('one place is current at a time', (campPageHtml.match(/aria-current="page"/g) ?? []).length === 1)
check('the overview links to the planning room instead of embedding it',
  find(campPageHtml, 'href="/t/t1/room"') && !find(campPageHtml, 'id="chat-text"'))
const settled = settlement()
check('standalone petrol can be split only between its car occupants', settled.total === 7001
  && String(settled.transfers.map((move) => move.amount)) === '2749,501,250')
const customMeal = {
  id: 'meal', description: 'Meal', amount: 2000, paid_by: 'm1',
  participants: ['m1', 'm2'], shares: { m1: 800, m2: 1200 },
}
const customSettled = settlement([customMeal])
check('a custom meal uses its exact £8 and £12 shares', customSettled.total === 2000
  && customSettled.rounded === false && customSettled.transfers.length === 1
  && customSettled.transfers[0].from.id === 'm2'
  && customSettled.transfers[0].to.id === 'm1'
  && customSettled.transfers[0].amount === 1200)
const shareInputs = { 'share:m1': { value: '8.00' }, 'share:m2': { value: '' } }
const customPayload = customExpenseShares({
  elements: { namedItem: (name) => shareInputs[name] },
}, ['m1', 'm2'], '20.00')
check('one blank custom share takes the remainder', customPayload.shares.m1 === '8.00'
  && customPayload.shares.m2 === '12.00' && shareInputs['share:m2'].value === '12.00')
check('the Trip overview keeps only a compact route into Settle up',
  find(campPageHtml, 'href="/t/t1/settle"') && find(campPageHtml, 'data-act="settle"')
  && find(campPageHtml, '£70.01') && !find(campPageHtml, 'class="expenses"')
  && !find(campPageHtml, 'data-act="new-expense"'))
S.camp = 'settle'
const settlePageHtml = viewTrip()
check('Settle up has a focused page without the trip tab bar',
  find(settlePageHtml, 'id="settle-up-title">Settle up</h1>')
  && find(settlePageHtml, 'class="roombar__back"') && !find(settlePageHtml, 'class="tabbar"'))
check('the Settle up page owns the ledger and add action',
  find(settlePageHtml, '>Petrol<') && find(settlePageHtml, '>Beer<')
  && find(settlePageHtml, 'data-act="new-expense"'))
check('settlement makes the odd-penny rule visible', settled.rounded
  && find(settlePageHtml, 'Rounding is to the penny') && find(settlePageHtml, '£70.01'))
check('the Settle up page says who owes whom', find(settlePageHtml, '<b>Ali Khan</b> owes <b>Josh</b>')
  && find(settlePageHtml, '£27.49'))
check('every debt carries the way to settle it',
  find(settlePageHtml, 'data-act="settle-transfer" data-from="m3" data-to="m1" data-amount="2749"')
  && find(settlePageHtml, '>Record a payment<'))

// Money handed over comes off what is owed, and the line it settles goes away.
S.payments = [{ id: 'p1', from_member: 'm3', to_member: 'm1', amount: 2749, note: 'Bank transfer',
  created_at: new Date().toISOString() }]
const afterPaying = settlement()
check('a recorded payment nets off the debt it settles', afterPaying.settled === 2749
  && afterPaying.total === 7001
  && !afterPaying.transfers.some((move) => move.from.id === 'm3' && move.to.id === 'm1'))
const paidPageHtml = viewTrip()
check('the Settle up page keeps a record of what has been paid back',
  find(paidPageHtml, '<b>Ali Khan</b> paid <b>Josh</b> · Bank transfer')
  && find(paidPageHtml, 'data-act="delete-payment" data-payment="p1"')
  && find(paidPageHtml, '<b>£27.49</b> has been paid back.')
  && !find(paidPageHtml, '<b>Ali Khan</b> owes <b>Josh</b>'))
S.payments = [
  { id: 'p1', from_member: 'm3', to_member: 'm1', amount: 2749, note: '', created_at: new Date().toISOString() },
  { id: 'p2', from_member: 'm3', to_member: 'm2', amount: 501, note: '', created_at: new Date().toISOString() },
  { id: 'p3', from_member: 'm4', to_member: 'm2', amount: 250, note: '', created_at: new Date().toISOString() },
]
check('paying every line off leaves the trip square', !settlement().transfers.length
  && find(viewTrip(), 'Everyone is square.'))
S.payments = []
const recordedExpenses = S.expenses
S.expenses = []
const emptySettlePage = viewTrip()
check('an empty Settle up page teaches the first move',
  find(emptySettlePage, 'No expenses yet') && find(emptySettlePage, 'Add the first expense'))
S.expenses = recordedExpenses
S.camp = 'room'
const roomPageHtml = viewTrip()
check('planning room renders durable messages',
  find(roomPageHtml, 'Planning Room') && find(roomPageHtml, 'Can we leave by eight?'))
check('planning room replaces the trip chrome with a focused chat header',
  find(roomPageHtml, 'id="planning-room-title">Planning Room</h1>')
  && find(roomPageHtml, 'class="roombar__back"')
  && !find(roomPageHtml, 'Wasdale Weekend')
  && !find(roomPageHtml, 'class="tabbar"')
  && !find(roomPageHtml, 'auth-nudge'))
check('planning room attributes the current member',
  find(roomPageHtml, 'thread__message--mine')
  && find(roomPageHtml, '<strong class="sr-only">You</strong>')
  && !find(roomPageHtml, '<strong>Josh'))
check('planning room uses local clock times instead of elapsed ages',
  /<time[^>]*>\d{2}:\d{2}<\/time>/.test(roomPageHtml)
  && !find(roomPageHtml, '>now</time>'))
check('planning room has paged history and a labelled composer',
  find(roomPageHtml, 'data-act="chat-older"') && find(roomPageHtml, 'class="sr-only" for="chat-text">Message the group'))
check('planning room scrolls messages separately from its composer',
  find(roomPageHtml, 'class="chat__body"') && find(roomPageHtml, 'class="chat__composer"'))
check('planning room exposes its quiet delivery state',
  find(roomPageHtml, 'data-chat-connection') && find(roomPageHtml, '>Connecting</span>'))
const quietNotify = S.notify
S.notify = { ...quietNotify, tripId: 't1', available: true, subscribed: false, muted: false }
check('planning room offers notification control in its focused header',
  find(viewTrip(), 'data-act="chat-notifications"')
  && find(viewTrip(), 'aria-label="Turn on Planning Room notifications"'))
S.notify = { ...S.notify, subscribed: true, unread: 3 }
check('an enabled notification control can mute the trip',
  find(viewTrip(), 'aria-label="Mute Planning Room notifications"')
  && find(viewTrip(), 'roombar__notify--on'))
S.camp = 'overview'
const unreadOverview = viewTrip()
check('unread chat is visible before entering the room',
  find(unreadOverview, 'class="room-door__unread">3 new')
  && find(unreadOverview, 'tabbar__flag tabbar__flag--chat">3'))
S.camp = 'room'
S.notify = quietNotify
check('Camp formats structured answers instead of leaking Markdown',
  find(roomPageHtml, 'class="assistant-copy"') && find(roomPageHtml, '<ul>')
  && find(roomPageHtml, '<strong>Shelter:</strong>') && !find(roomPageHtml, '**Shelter:**'))
check('Camp formatting still escapes model-provided HTML',
  find(roomPageHtml, '&lt;img src=x onerror=alert(1)&gt;') && !find(roomPageHtml, '<img src=x'))
const readyChat = S.chat
S.chat = { ...readyChat, assistantAvailable: true }
check('planning room teaches the assistant without adding a new control',
  find(viewTrip(), 'placeholder="Message the group or @camp…"')
  && !find(viewTrip(), 'data-act="assistant"'))
check('planning room offers Camp while its mention is being typed',
  find(viewTrip(), 'id="chat-mention"') && find(viewTrip(), 'data-act="chat-mention"')
  && campMentionRange('@ca', 3)?.start === 0 && campMentionRange('@camp', 5)?.end === 5)
check('Camp autocomplete creates a ready-to-continue mention',
  completeCampMention('@ca', 3)?.value === '@camp '
  && completeCampMention(' @c', 3)?.value === ' @camp ')
check('Camp autocomplete only appears where the assistant can be invoked',
  campMentionRange('ask @ca', 7) === null && campMentionRange('@camper', 7) === null)
S.chat = { ...readyChat, messages: [], hasMore: false }
check('planning room empty state teaches the first move',
  find(viewTrip(), 'No messages yet') && find(viewTrip(), 'decision the group needs to make next'))
S.chat = { ...readyChat, messages: [], error: 'No signal. That change is not saved.' }
check('planning room error state offers a retry',
  find(viewTrip(), 'role="alert"') && find(viewTrip(), 'data-act="chat-retry"'))
S.chat = { ...readyChat, loading: true }
check('planning room loading state holds its space',
  find(viewTrip(), 'aria-busy="true"') && find(viewTrip(), 'Loading messages'))
S.chat = readyChat

// The pin. Nothing pinned draws nothing — the banner is not a slot waiting to be
// filled — and a pinned message is marked where it sits as well as at the top,
// so the one being held up looks held up wherever you meet it.
check('an unpinned room has no banner', !find(viewTrip(), 'class="pinned"'))
S.pinned = { id: 1, author: 'Sam', assistant: false, body: 'Can we leave by eight?', at: new Date().toISOString() }
const pinnedRoom = viewTrip()
check('the pinned message heads the room',
  find(pinnedRoom, 'class="pinned"') && find(pinnedRoom, 'Pinned · <b>Sam</b>')
  && find(pinnedRoom, 'data-act="chat-unpin"'))
check('the pin jumps to the message while that message is on the page',
  find(pinnedRoom, 'data-act="chat-quote" data-id="1"')
  && !find(pinnedRoom, 'pinned__jump--away'))
check('the pinned message is marked in the thread it lives in',
  find(pinnedRoom, 'thread__message--pinned') && find(pinnedRoom, 'thread__pin--on')
  && find(pinnedRoom, 'aria-pressed="true"'))
check('pinning something else says whose message it would replace',
  find(pinnedRoom, 'aria-label="Pin this message, replacing Sam&#39;s"'))
S.pinned = { id: 99, author: 'Ali Khan', assistant: false, body: 'Gone from the page', at: new Date().toISOString() }
check('a pin whose message is not loaded is text rather than a dead button',
  find(viewTrip(), 'pinned__jump--away') && !find(viewTrip(), 'data-act="chat-quote" data-id="99"'))
S.pinned = null
check('with nothing pinned the button offers a plain pin',
  find(viewTrip(), 'aria-label="Pin this message"'))

// ---- swiping to reply, holding to pin ----------------------------------------
//
// Neither gesture leaves a mark in the HTML, so these press on the handlers the
// app registered and read what happened afterwards. What is worth protecting is
// the arithmetic: which direction wins, how far is far enough, and how still a
// finger has to be — get any of those wrong and the room either replies to
// things nobody meant or stops scrolling.
{
  const classesOf = () => {
    const on = new Set()
    return {
      set: on,
      add: (c) => on.add(c), remove: (c) => on.delete(c),
      toggle: (c, force) => (force ? on.add(c) : on.delete(c)),
      contains: (c) => on.has(c),
    }
  }
  const rowFor = (id) => {
    let mark = null
    return {
      id, style: {}, classList: classesOf(),
      append(node) { mark = node },
      querySelector: (sel) => (sel === '.thread__swipe' ? mark : null),
      addEventListener() {},
      get mark() { return mark },
    }
  }
  // createElement is swapped rather than the shared stub widened: the swipe mark
  // is the only thing in the app that builds a node by hand, and the rest of this
  // file has no opinion about what one is.
  const madeCreate = document.createElement
  document.createElement = () => ({
    className: '', innerHTML: '', style: {}, classList: classesOf(),
    setAttribute() {}, remove() {},
  })

  const down = (row, x = 100, y = 100) => fire('pointerdown', {
    pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, target: { closest: () => row },
  })
  const move = (x, y = 100) => fire('pointermove', { isPrimary: true, clientX: x, clientY: y })
  const up = () => fire('pointerup', {})
  const rest = () => { fire('pointercancel', {}); S.chat.replyTo = null }

  const row = rowFor('msg-1')

  // Far enough across, and letting go quotes the message.
  down(row); move(180); up()
  check('swiping a message across replies to it', S.chat.replyTo?.id === 1)
  rest()

  // Not far enough is not an answer. A message nudged sideways on the way to
  // something else has to come back and mean nothing.
  down(row); move(140); up()
  check('a short swipe replies to nothing', S.chat.replyTo === null && !row.style.transform)
  rest()

  // Down the page belongs to the room. Once a finger is scrolling it is let go
  // of entirely, so a scroll cannot turn into a swipe halfway down.
  down(row); move(104, 140); move(200, 140); up()
  check('scrolling the room is never a reply', S.chat.replyTo === null)
  rest()

  // Leftwards is nothing at all — the gesture has a direction, and the other one
  // is where the browser's own back-swipe lives.
  down(row); move(20); up()
  check('swiping the other way replies to nothing', S.chat.replyTo === null)
  rest()

  // A message Camp is still writing has no id to answer, and no gesture either.
  const streaming = rowFor('')
  down(streaming); move(180); up()
  check('a message still being written cannot be swiped', S.chat.replyTo === null)
  rest()

  // Holding still pins. The request is the assertion: what the press does is ask
  // the server for the pin, and everything after that is the ordinary path a
  // press of the button takes.
  // Only the pin route: other parts of the app do their own asking in the
  // background, and a test that counted every request would be measuring them.
  const sent = []
  const kept = { expenses: S.expenses, payments: S.payments, items: S.items, events: S.events }
  const realFetch = globalThis.fetch
  globalThis.fetch = async (url, opts) => {
    if (String(url).endsWith('/pin')) sent.push({ url, method: opts?.method, body: opts?.body })
    return { ok: true, status: 200, json: async () => ({ trip: S.trip, ...kept, members: S.members, pinned: null }) }
  }

  down(row)
  await new Promise((resolve) => { setTimeout(resolve, 620) })
  check('holding a message pins it', sent.length === 1
    && sent[0].url === '/api/trips/t1/pin' && sent[0].method === 'PUT'
    && JSON.parse(sent[0].body).messageId === 1)
  check('and holding is not also a swipe', S.chat.replyTo === null)
  rest()

  // A finger that moved was never holding still. This is the same 620ms wait, so
  // the press had every chance to fire and did not.
  sent.length = 0
  down(row); move(118)
  await new Promise((resolve) => { setTimeout(resolve, 620) })
  check('a finger that wandered off is not a press', sent.length === 0)
  up()
  rest()

  // The click a long press leaves behind it. A press that landed on the pin
  // button would otherwise pin and then unpin in one gesture, so the click is
  // dropped — and the way to see that is that it asks the server for nothing.
  const pinClick = (from) => ({
    target: {
      closest: (sel) => (sel === '.thread__message'
        ? from
        : { dataset: { act: 'chat-pin', id: '1' }, tagName: 'BUTTON', type: 'button' }),
    },
    preventDefault() {},
  })
  const settle = () => new Promise((resolve) => { setTimeout(resolve, 20) })

  sent.length = 0
  down(row)
  await new Promise((resolve) => { setTimeout(resolve, 620) })
  fire('click', pinClick(row))
  await settle()
  check('the click behind a long press is dropped', sent.length === 1)

  // Only that message's, though. A press does not put the rest of the room out
  // of action for the next half second, and the trailing click it was waiting
  // for is spent once it arrives.
  fire('click', pinClick(row))
  await settle()
  check('a second press of the same message is a real press again', sent.length === 2)
  sent.length = 0
  down(row)
  await new Promise((resolve) => { setTimeout(resolve, 620) })
  fire('click', pinClick(rowFor('msg-2')))
  await settle()
  check('a press does not deafen the rest of the room', sent.length === 2)
  rest()

  document.createElement = madeCreate
  globalThis.fetch = realFetch
  Object.assign(S, kept)
}

// WebSocket delivery is only a wake-up path. A tiny browser stand-in proves
// one connection per trip, immediate durable-row delivery, and retry state.
class FakeSocket {
  static all = []
  constructor(url) { this.url = url; this.readyState = 0; this.listeners = {}; this.sent = []; FakeSocket.all.push(this) }
  addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn) }
  send(value) { this.sent.push(value) }
  fire(type, detail = {}) { for (const fn of this.listeners[type] ?? []) fn(detail) }
  close() { this.readyState = 3; this.fire('close') }
}
globalThis.WebSocket = FakeSocket
ensureChatSocket()
check('an unlinked legacy profile keeps the polling fallback',
  FakeSocket.all.length === 0 && S.chat.connection === 'polling')
S.auth.user = { id: 'u1', name: 'Josh', email: 'josh@example.com', picture: '' }
ensureChatSocket()
ensureChatSocket()
const socket = FakeSocket.all[0]
check('one socket connects to the current trip',
  FakeSocket.all.length === 1 && socket.url === 'ws://x/ws?tripId=t1')
socket.readyState = 1
socket.fire('open')
check('an open socket marks delivery live', S.chat.connection === 'live')
check('an open socket tells the server the room is being viewed',
  socket.sent.some((value) => JSON.parse(value).type === 'room.presence'
    && JSON.parse(value).active === true))
document.activeElement = { id: 'chat-text' }
const oldRootQuery = roots.root.querySelector
const visibleThread = { innerHTML: '', querySelector: () => null }
const visibleChat = {
  scrollTop: 0, scrollHeight: 640,
  querySelector: (selector) => selector === '.thread' ? visibleThread : null,
}
roots.root.querySelector = (selector) => selector === '.chat__body' ? visibleChat : null
socket.fire('message', { data: JSON.stringify({
  type: 'message.created',
  message: { id: 3, client_id: 'three', member_id: 'm2', author_name: 'Sam', body: 'I can drive.', created_at: new Date().toISOString() },
}) })
check('a socket delivery merges the durable message once',
  S.chat.messages.filter((m) => m.id === 3).length === 1 && S.chat.messages.at(-1).body === 'I can drive.')
check('a focused planning room paints and follows the latest message',
  find(visibleThread.innerHTML, 'I can drive.') && visibleChat.scrollTop === visibleChat.scrollHeight)
socket.fire('message', { data: JSON.stringify({ type: 'assistant.started', runId: 'run-1' }) })
socket.fire('message', { data: JSON.stringify({
  type: 'assistant.delta', runId: 'run-1', delta: 'Add a tarp for Saturday rain.',
}) })
check('assistant deltas accumulate while the composer keeps focus',
  S.chat.streams['run-1']?.body === 'Add a tarp for Saturday rain.')
document.activeElement = null
check('a streaming assistant remains a quiet row in the planning ledger',
  find(viewTrip(), 'data-assistant-stream="run-1"') && find(viewTrip(), 'Add a tarp for Saturday rain.'))
socket.fire('message', { data: JSON.stringify({
  type: 'message.created',
  message: { id: 4, client_id: 'assistant:run-1', member_id: null, role: 'assistant',
    author_name: 'Camp', body: 'Add a tarp for Saturday rain.', created_at: new Date().toISOString() },
}) })
check('the durable assistant row replaces its transient stream',
  !S.chat.streams['run-1'] && S.chat.messages.at(-1).role === 'assistant'
  && find(viewTrip(), 'thread__message--assistant'))

// Sending is the one moment the keyboard is certainly up, so the composer has to
// survive it: emptying it by hand and repainting the thread beside it keeps the
// keyboard from dropping and climbing back, which is what made the room flinch
// and left the newest message under the fold.
const composer = (text) => {
  const send = { disabled: true, innerHTML: '…', attrs: {}, setAttribute(k, v) { this.attrs[k] = v } }
  const box = { id: 'chat-text', value: text, scrollHeight: 40, style: {},
    setAttribute() {}, removeAttribute() {}, focus() {} }
  box.form = { querySelector: (sel) => (sel === 'button[type="submit"]' ? send : null) }
  return { box, send }
}
const sent = composer('Yes — meet at mine.')
visibleChat.scrollTop = 0
roots.root.innerHTML = 'the room as it stands'
roots.root.querySelector = (selector) => selector === '.chat__body' ? visibleChat
  : selector === '#chat-text' ? sent.box : null
check('a sent message empties the composer without rebuilding the room',
  clearComposer() === true && sent.box.value === ''
  && roots.root.innerHTML === 'the room as it stands')
check('and puts the send button back on its feet',
  sent.send.disabled === false && sent.send.attrs['aria-label'] === 'Send message'
  && !find(sent.send.innerHTML, 'chat__sending'))
check('and the thread lands on what was just said',
  find(visibleThread.innerHTML, 'Add a tarp for Saturday rain.')
  && visibleChat.scrollTop === visibleChat.scrollHeight)

// Your own message arrives back down the socket before the POST answers. If that
// echo redrew the room, the send still running would empty a composer that had
// already been thrown away — and the one on screen would keep the text with its
// button stuck on the ellipsis, refusing the next message.
S.chat.busy = true
document.activeElement = null
roots.root.innerHTML = 'the room mid-send'
socket.fire('message', { data: JSON.stringify({
  type: 'message.created',
  message: { id: 5, client_id: 'five', member_id: 'm2', author_name: 'Sam', body: 'On my way.', created_at: new Date().toISOString() },
}) })
check('a message landing mid-send paints the thread and leaves the room standing',
  find(visibleThread.innerHTML, 'On my way.') && roots.root.innerHTML === 'the room mid-send')
const live = composer('Yes — meet at mine.')
roots.root.querySelector = (selector) => selector === '.chat__body' ? visibleChat
  : selector === '#chat-text' ? live.box : null
check('and the composer the sender is holding is the one that gets emptied',
  clearComposer() === true && live.box.value === '' && live.send.disabled === false)

// Keeping the keyboard up through a send is what lets the next sentence be
// started before the last one lands. Coming back to it and deleting it would
// make that a trap rather than a feature.
const started = composer('And bring the tarp')
roots.root.querySelector = (selector) => selector === '.chat__body' ? visibleChat
  : selector === '#chat-text' ? started.box : null
S.chat.draft = 'Yes — meet at mine.'
check('a sentence started mid-send survives the answer to the last one',
  clearComposer('Yes — meet at mine.') === true
  && started.box.value === 'And bring the tarp' && S.chat.draft === 'And bring the tarp')
const untouched = composer('Yes — meet at mine.')
roots.root.querySelector = (selector) => selector === '.chat__body' ? visibleChat
  : selector === '#chat-text' ? untouched.box : null
check('and a composer nobody has typed into is still emptied',
  clearComposer('Yes — meet at mine.') === true
  && untouched.box.value === '' && S.chat.draft === '')
// No composer to read means the draft cannot be holding anything but the
// message that has just landed, so a redraw must not put it back.
S.chat.draft = 'Yes — meet at mine.'
roots.root.querySelector = () => null
check('a room redrawn out from under the send does not refill from the draft',
  clearComposer('Yes — meet at mine.') === false && S.chat.draft === '')
roots.root.querySelector = (selector) => selector === '.chat__body' ? visibleChat : null

// The quote gets the same treatment the sentence does. A send carries the
// message it was answering; picking a different one to answer while that send is
// in flight is a newer answer than the one being cleaned up, and tidying up
// after the old send must not spend it.
const quoting = composer('')
roots.root.querySelector = (selector) => selector === '.chat__body' ? visibleChat
  : selector === '#chat-text' ? quoting.box : null
S.chat.replyTo = { id: 1, author: 'Sam', assistant: false, body: 'Can we leave by eight?' }
clearComposer('Yes — meet at mine.', 1)
check('the quote a message was sent with comes off with it', S.chat.replyTo === null)
S.chat.replyTo = { id: 2, author: 'Josh', assistant: false, body: 'Yes — meet at mine.' }
clearComposer('Yes — meet at mine.', 1)
check('a message picked to answer mid-send is still picked afterwards',
  S.chat.replyTo?.id === 2)
S.chat.replyTo = { id: 2, author: 'Josh', assistant: false, body: 'Yes — meet at mine.' }
clearComposer('Yes — meet at mine.', null)
check('and so is one picked while an unattached message was in flight',
  S.chat.replyTo?.id === 2)
S.chat.replyTo = null
roots.root.querySelector = (selector) => selector === '.chat__body' ? visibleChat : null
S.chat.busy = false

// The room is a screenful less the keyboard, so raising the keys takes a few
// hundred pixels off the thread. A scroller left where it was is no longer at
// the bottom, and the message you just sent is behind the composer.
visibleChat.clientHeight = 400
visibleChat.scrollTop = 240
globalThis.window.visualViewport = { scale: 1, height: 480, offsetTop: 0, addEventListener() {} }
watchKeyboard()
check('raising the keyboard keeps the thread on the latest message',
  visibleChat.scrollTop === visibleChat.scrollHeight)
visibleChat.scrollTop = 60
watchKeyboard()
check('but a thread scrolled back to older messages is left where it was',
  visibleChat.scrollTop === 60)
globalThis.window.visualViewport = null

roots.root.querySelector = oldRootQuery
socket.readyState = 3
socket.fire('close')
check('a dropped socket enters reconnecting state', S.chat.connection === 'reconnecting')
stopChatSocket()
globalThis.WebSocket = undefined
S.auth.user = null

// Sheets, including the new food/drink picker.
S.camp = false; S.tab = 'eat'
S.sheet = { kind: 'add', tab: 'eat', list: 'food', section: 'shared' }
renderSheet()
check('add sheet offers Food or Drink', find(roots['sheet-root'].innerHTML, 'data-name="list" data-value="drinks"'))
S.sheet = { kind: 'add', tab: 'pack', list: 'gear', section: 'shared' }
renderSheet()
check('single-list add sheet has no picker', !find(roots['sheet-root'].innerHTML, 'data-name="list" data-value'))
check('single-list add sheet still sends a list', find(roots['sheet-root'].innerHTML, 'name="list" value="gear"'))

const have = new Set(['Burgers', 'Crisps', 'Beer', 'Drinking water'].map((s) => s.toLowerCase()))
const pool = ['food', 'drinks'].flatMap((l) => CATALOG[l]
  .filter((c) => !have.has(c.title.toLowerCase()) && !c.own)
  .map((c) => ({ ...c, list: l, key: `${l}::${c.title}` })))
S.sheet = { kind: 'suggest', tab: 'eat', section: 'shared', pool, picked: new Set(['drinks::Wine']) }
renderSheet()
const sug = roots['sheet-root'].innerHTML
check('suggest pools both lists', find(sug, 'Hot dogs') && find(sug, 'Wine'))
check('suggest picks are list-keyed', find(sug, 'data-pick="drinks::Wine" aria-pressed="true"'))

S.sheet = { kind: 'item', id: 'Beer' }; renderSheet()
const itemSheet = roots['sheet-root'].innerHTML
check('item sheet is titled the thing itself', find(itemSheet, '<h3>Beer</h3>'))
check('item sheet does not ask its question twice', !find(itemSheet, "Who&#39;s bringing"))
const pressedFor = (html, id) => new RegExp(`data-member="${id}"\\s+aria-pressed="true"`).test(html)
check('item sheet ticks everyone who is on it', pressedFor(itemSheet, 'm1') && pressedFor(itemSheet, 'm3'))
check('item sheet leaves the rest unticked', !pressedFor(itemSheet, 'm4'))
check('item sheet says who has packed theirs', find(itemSheet, 'Packed theirs.') && find(itemSheet, 'Not packed yet.'))
check('item sheet carries the way to remove it', find(itemSheet, 'data-act="kill" data-id="Beer"'))
check('a claimant can carry a cost paid by somebody else',
  find(itemSheet, '£10.01 · paid by Sam') && find(itemSheet, 'data-act="expense" data-id="Beer" data-member="m1" data-expense="beer-cost"'))
S.sheet = { kind: 'expense', expenseId: 'petrol' }; renderSheet()
const expenseSheet = roots['sheet-root'].innerHTML
check('the petrol sheet keeps its label, payer, amount and selected occupants together',
  find(expenseSheet, 'value="Petrol"') && find(expenseSheet, 'value="60.00"')
  && find(expenseSheet, 'value="m1" selected') && find(expenseSheet, 'value="m3" checked')
  && !find(expenseSheet, 'value="m2" checked') && find(expenseSheet, 'save-expense'))
S.expenses.push(customMeal)
S.sheet = { kind: 'expense', expenseId: 'meal' }; renderSheet()
const customExpenseSheet = roots['sheet-root'].innerHTML
check('a custom expense reopens with its exact shares',
  find(customExpenseSheet, 'data-split="custom"')
  && find(customExpenseSheet, 'name="share:m1" value="8.00"')
  && find(customExpenseSheet, 'name="share:m2" value="12.00"')
  && find(customExpenseSheet, 'Custom amounts')
  && find(customExpenseSheet, 'Shares add up to £20.00.'))
S.expenses.pop()
S.sheet = { kind: 'payment', from: 'm3', to: 'm1', amount: '2749' }; renderSheet()
const paymentSheet = roots['sheet-root'].innerHTML
check('marking a debt paid opens with that payment already filled in',
  find(paymentSheet, 'Record a payment')
  && find(paymentSheet, '<option value="m3" selected>Ali Khan</option>')
  && find(paymentSheet, '<option value="m1" selected>Josh (you)</option>')
  && find(paymentSheet, 'name="amount" value="27.49"')
  && find(paymentSheet, 'save-payment'))
// What a redraw is not allowed to take back. A dropdown somebody has answered
// is as deliberate as a box they have typed in, and on the payment sheet those
// dropdowns are the two people the money moved between.
const option = (value, defaultSelected) => ({ value, defaultSelected })
const picked = { name: 'from', value: 'm3', options: [option('m1', true), option('m3', false)] }
const asDrawn = { name: 'to', value: 'm1', options: [option('m1', true), option('m3', false)] }
const typedIn = { name: 'amount', type: 'text', value: '25.00', defaultValue: '27.49' }
const fakeSheet = {
  querySelectorAll: (selector) => [
    ...(selector.includes('input[name]') ? [typedIn] : []),
    ...(selector.includes('select[name]') ? [picked, asDrawn] : []),
  ],
}
const kept = unsaved(fakeSheet)
check('an answered dropdown survives a redraw under it',
  kept.get('from') === 'm3' && kept.get('amount') === '25.00')
check('and one left as it was drawn takes whatever the trip now says',
  !kept.has('to'))
picked.value = 'm1'; typedIn.value = '27.49'
restore(fakeSheet, kept, null)
check('and both go back where the person left them',
  picked.value === 'm3' && typedIn.value === '25.00')

// The five-second poll rebuilds the page under an open sheet. A dropdown being
// answered is as much "mid-edit" as a box being typed in — more so, since it is
// held open over the page the redraw would replace.
const focused = (tag) => ({ matches: (sel) => sel.split(', ').includes(tag) })
document.activeElement = focused('select')
check('a dropdown being answered counts as mid-edit', isEditing() === true)
document.activeElement = focused('input')
check('and so does a box being typed in', isEditing() === true)
document.activeElement = focused('button')
check('while a page nobody is answering is free to redraw', isEditing() === false)
document.activeElement = null
check('as is one with nothing focused at all', isEditing() === false)

S.sheet = { kind: 'payment' }; renderSheet()
const blankPayment = roots['sheet-root'].innerHTML
check('a payment nobody suggested still knows two different people',
  find(blankPayment, '<option value="m1" selected>Josh (you)</option>')
  && find(blankPayment, '<option value="m2" selected>Sam</option>')
  && find(blankPayment, 'name="amount" value=""'))
S.sheet = { kind: 'item', id: 'Crisps' }; renderSheet()
const unclaimed = roots['sheet-root'].innerHTML
// Your name is a row like everybody else's, and that row is the only way in.
check('no "I\'ll bring it" shortcut beside your own name',
  !find(unclaimed, "I'll bring it") && !find(unclaimed, "I'll organise it"))
check('your own name is still there to tap',
  new RegExp('data-act="claim" data-id="Crisps" data-member="m1"').test(unclaimed))
S.sheet = { kind: 'place', id: 'Hike' }; renderSheet()
check('place sheet renders', find(roots['sheet-root'].innerHTML, 'Where is Hike?'))

section('Who is up for it')

// A count told you the kayaking was on without telling you whether it was on
// with the people you would go with. The row answers that now, so these checks
// are about the two shapes it takes and the line where it changes.
const hike = S.items.find((i) => i.id === 'Hike')
const votesWere = hike.votes
const planRows = (votes) => { hike.votes = votes; S.sheet = null; S.tab = 'do'; S.camp = false; return viewTrip() }
// The chip on its own. The whole page has other rows on it, and the button's
// own accessible name repeats the words it shows — so a check that means "the
// row says this" has to say which of the two it is reading.
const chipOn = (html) => {
  const at = html.indexOf('class="votes" data-act="open-item" data-id="Hike"')
  return at < 0 ? '' : html.slice(at, html.indexOf('</button>', at))
}
const says = (html, words) => find(html, `<span class="votes__say">${words}</span>`)

const oneVote = planRows(['m1'])
check('your own vote is said as a name, not a number',
  says(oneVote, 'You are up for it') && !find(oneVote, '1 up for it'))
check('and it is a way into the sheet, not a label',
  find(oneVote, 'class="votes" data-act="open-item" data-id="Hike"'))

const twoVotes = planRows(['m2', 'm3'])
check('two people still fit as words', says(twoVotes, 'Sam and Ali Khan are up for it'))

// Four people, one row: three faces is all it holds, so the words go back to
// the total — and you go first, so the face that gets cut is never yours.
const fourVotes = planRows(['m2', 'm3', 'm4', 'm1'])
check('past two, the row counts',
  says(fourVotes, '4 up for it') && !says(fourVotes, 'You, Sam, Ali Khan and Robin are up for it'))
check('three faces is the most a row holds',
  (chipOn(fourVotes).match(/class="who__face"/g) ?? []).length === FACES)
// Read as Robin, who is last on the trip and so the first face to be cut when
// the faces go in the trip's order. Yours is the one face you already know the
// answer for, and a row that has dropped it reads as though you never said.
S.me = 'm4'
const asRobin = chipOn(planRows(['m1', 'm2', 'm3', 'm4']))
check('and you are on it, however late you voted',
  find(asRobin, '>RO<') && (asRobin.match(/class="who__face"/g) ?? []).length === FACES)
S.me = 'm1'
// WCAG 2.5.3: what the button says has to be the start of what it is called,
// or somebody driving this by voice cannot ask for the button they can see.
check('the visible words open the accessible name',
  find(fourVotes, 'aria-label="4 up for it — Hike: You, Sam, Ali Khan and Robin. Open to see who."'))

check('nobody up for it leaves the row to ask rather than tell',
  !find(planRows([]), 'class="votes"'))

// The sheet is where the names the row could not fit are spelled out, and where
// the two sets of people on a plan stop being one list.
hike.votes = ['m2', 'm3', 'm4', 'm1']
S.sheet = { kind: 'item', id: 'Hike' }; renderSheet()
const planSheet = roots['sheet-root'].innerHTML
check('the sheet names every voter',
  (planSheet.match(/class="up__row"/g) ?? []).length === 4 && find(planSheet, 'Robin</span>'))
check('and marks which one is you', find(planSheet, 'Josh (you)</span>'))
check('the only vote you can change is your own',
  (planSheet.match(/data-act="vote"/g) ?? []).length === 1 && find(planSheet, 'Actually, count me out'))
check('who is up for it and who is organising it are told apart',
  planSheet.indexOf('Up for it') < planSheet.indexOf('Organising it')
  && find(planSheet, 'data-act="claim" data-id="Hike" data-member="m2"'))

hike.votes = []
S.sheet = { kind: 'item', id: 'Hike' }; renderSheet()
const noVotes = roots['sheet-root'].innerHTML
check('an unvoted plan says so and offers the vote',
  find(noVotes, 'Nobody has said yet.') && find(noVotes, "I'm up for it"))

// A name is typed by hand and goes onto the row and into the label unparsed.
S.members = [...S.members, { id: 'mx', name: '<img src=x onerror=alert(1)>', hue: 4 }]
hike.votes = ['mx']
const injected = planRows(['mx'])
check('a name that looks like markup is text on the row and in the label',
  !find(injected, '<img src=x') && (injected.match(/&lt;img src=x/g) ?? []).length >= 2)
S.members = S.members.filter((m) => m.id !== 'mx')

hike.votes = votesWere
S.sheet = null
S.camp = false

// Days: what turns the Plan tab into an itinerary and the Eat list into meals.
// The trip runs Fri 4 – Sun 6 September 2026.
S.sheet = null
S.filter = { kind: '', cat: '', hide: false, q: '' }
const [FRI, SAT, SUN] = ['2026-09-04', '2026-09-05', '2026-09-06']
// Worked out the same way the app does, so the checks below say nothing about
// what locale the machine running them happens to be in.
const shortDay = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })
const fullDay = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
// A heading, as opposed to the same words on a filter chip further up the page.
const heads = (html, name) => find(html, `data-group="${name}"`)
// Attributes wrap where the templates wrap and sit in whatever order the tag
// puts them, so a check for several of them asks only that they are in the same
// tag and in this order — not that they are touching.
const attrs = (html, ...parts) => new RegExp(parts.join('[^>]*')).test(html)
// One tab out of the day strip, from its own attributes to its closing tag, so a
// check about Saturday cannot be answered by the mark on Sunday.
const dayTab = (html, iso) => {
  const at = html.indexOf(`data-value="${iso}"`)
  return at < 0 ? '' : html.slice(at, html.indexOf('</button>', at))
}

check('a trip with dates knows its days', String(tripDays(S.trip)) === String([FRI, SAT, SUN]))
check('a one-day trip is one day', tripDays({ start_date: FRI, end_date: '' }).length === 1)
check('a trip with no dates has none to offer', tripDays({ start_date: '', end_date: '' }).length === 0)
check('an end before the start does not run backwards for ever',
  tripDays({ start_date: SUN, end_date: FRI }).length === 1)

// The Eat list is filed by meal and stays filed by meal, dated or not: how a
// list is organised and what it covers are two questions, and days answer the
// second one. So the headings never move.
const flat = S.items
S.tab = 'eat'
const undated = viewTrip()
check('the Eat list keeps its plain headings', heads(undated, 'Dinner') && heads(undated, 'Snacks'))
check('and no day ever becomes a heading on it', !find(undated, `data-group="${shortDay(FRI)}`))
S.tab = 'do'
check('an undated Plan tab is still a board', heads(viewTrip(), 'Daytime'))

// The day bar: a strip at the top of the page, All first, one tab per day. It
// is a filter, so the list keeps its own headings and only its contents move.
S.items = flat.map((i) => (i.id === 'Burgers' ? { ...i, day: SAT } : i))
S.tab = 'eat'
const bar = viewTrip()
check('the page carries a day strip', find(bar, 'class="daybar"'))
check('All comes first and is the way out', bar.indexOf('data-value=""') < bar.indexOf(`data-value="${FRI}"`))
check('one tab per day of the trip',
  [FRI, SAT, SUN].every((d) => attrs(bar, 'data-act="filter-day"', `data-value="${d}"`)))
check('with nothing picked, All is the one pressed',
  attrs(bar, 'data-value=""', 'aria-pressed="true"') && !attrs(bar, `data-value="${SAT}"`, 'aria-pressed="true"'))
// It lived in the header once. The header says which trip you are on and
// nothing else, so the strip belongs on the page with the other narrowings —
// widest first, above the search box and the chips.
check('the day strip is on the page, not in the header',
  bar.indexOf('class="daybar"') > bar.indexOf('<main class="page"'))
check('and it leads the narrowings it belongs with',
  bar.indexOf('class="daybar"') < bar.indexOf('class="filters"'))
check('the header is back to saying only where you are',
  bar.slice(0, bar.indexOf('<main class="page"')).includes('topbar__title')
    && !find(bar.slice(0, bar.indexOf('<main class="page"')), 'data-act="filter-day"'))
check('the list underneath is untouched',
  heads(bar, 'Dinner') && heads(bar, 'Snacks') && !find(bar, `data-group="${shortDay(SAT)} · Dinner"`))
check('"Dinner" is a heading once, not five times', (bar.match(/data-group="Dinner"/g) ?? []).length === 1)
check('a dated row says which day it is for', attrs(bar, 'data-act="when"', 'data-id="Burgers"'))
check('an undated one is not nagged about it',
  !attrs(bar, 'data-act="when" data-id="Crisps"[^>]*>[^<]*Add a day'))

// Today, on a trip that is happening now. The fixture trip is in September 2026,
// so the same page has to be able to say nothing at all.
check('a trip that is not happening now marks no day as today', !find(bar, 'daybar__now--on'))
check('but every day keeps the room for the mark',
  (bar.match(/class="daybar__now/g) ?? []).length === 3)
const then = S.trip
const isoOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const iso = isoOf(new Date())
S.trip = { ...then, start_date: iso, end_date: iso }
const now = viewTrip()
check('today wears a dot in the strip', find(now, 'daybar__now--on'))
check('and says so where it cannot be seen', find(now, ', today"'))
S.trip = then

// And the day is watched rather than read once, because a phone left on the tab
// overnight is a phone showing yesterday. Midnight is faked here; the app aims a
// timer at the real one and checks again whenever the tab comes back.
check('nothing has turned when nothing has turned', !dayTurned(iso))
check('the same page marks no day as today', !find(viewTrip(), 'daybar__now--on'))
check('but midnight turning into Saturday moves the dot onto Saturday',
  dayTurned(SAT) && find(dayTab(viewTrip(), SAT), 'daybar__now--on')
    && !find(dayTab(viewTrip(), SUN), 'daybar__now--on'))
check('and takes it off again when the day is nobody\'s', dayTurned(iso) && !find(viewTrip(), 'daybar__now--on'))
check('the timer is aimed at the next midnight, not at a flat 24 hours',
  tillMidnight() > 0 && tillMidnight() <= 86400000 + 1000)
check('and lands on the far side of it',
  isoOf(new Date(Date.now() + tillMidnight())) !== iso)

// Midnight redraws the page, unless somebody is in the middle of typing on it.
document.activeElement = { matches: () => true }
roots.root.innerHTML = ''
turnDay(SUN)
check('a page being typed into is not redrawn under the typist', roots.root.innerHTML === '')
check('but the day has turned all the same, for the next thing they do',
  find(dayTab(viewTrip(), SUN), 'daybar__now--on'))
document.activeElement = null
roots.root.innerHTML = ''
turnDay(iso)
check('and a page nobody is touching redraws itself at midnight', roots.root.innerHTML.length > 500)
check('with the dot gone with the day', !find(viewTrip(), 'daybar__now--on'))

// Press a day and the page is that day.
S.filter = { day: SAT, kind: '', cat: '', hide: false, q: '' }
const sat = viewTrip()
check('picking a day marks it in the strip', attrs(sat, `data-value="${SAT}"`, 'aria-pressed="true"'))
check('and keeps only that day', find(sat, 'data-id="Burgers"') && !find(sat, 'data-id="Crisps"'))
check('the meal it is under is still its heading', heads(sat, 'Dinner'))

// The day nobody has covered, which is the question this was all for.
S.filter = { day: SUN, kind: '', cat: '', hide: false, q: '' }
const sun = viewTrip()
check('an empty day says which day it is', find(sun, `Nothing on ${fullDay(SUN)}`))
check('and offers to fill it, knowing the day',
  attrs(sun, 'data-act="add-to"', `data-day="${SUN}"`))
check('and offers the way back to all of them',
  attrs(sun, 'data-act="filter-day"', 'data-value=""'))

// "No day": the things nobody has slotted yet, which is the question you start
// asking the moment you plan by day at all. It is a filter chip, not a stop on
// the strip — the strip is the trip's calendar and "no day" is not a date. But
// it is still not a new meaning for All, because All is the way back out of a
// day, so the two are exclusive rather than stacked.
S.filter = { day: '', kind: '', cat: '', hide: false, q: '' }
S.tab = 'eat'
const mixed = viewTrip()
check('a tab with some dated and some not offers "No day"',
  attrs(mixed, 'data-act="filter-day"', 'data-value="none"'))
check('and it is a chip with the cuts, not a stop on the calendar',
  find(mixed, 'class="filters__chip" data-act="filter-day"')
    && !find(mixed.slice(mixed.indexOf('class="daybar"'), mixed.indexOf('class="filters"')), 'data-value="none"'))
check('it leads the cuts, being the tail of the question above them',
  mixed.indexOf('data-value="none"') < mixed.indexOf('data-act="filter-cat"'))
check('and says how many are still waiting on one',
  attrs(mixed, 'data-value="none"', '>No day<span class="filters__n filters__n--quiet">3</span>'))
check('and All is still there and still means all',
  attrs(mixed, 'data-act="filter-day"', 'data-value=""')
    && find(mixed, 'data-id="Burgers"') && find(mixed, 'data-id="Crisps"'))

S.filter = { day: 'none', kind: '', cat: '', hide: false, q: '' }
const loose = viewTrip()
check('pressing it keeps what has no day', find(loose, 'data-id="Crisps"'))
check('and drops what has one', !find(loose, 'data-id="Burgers"'))
check('it shows as pressed like any other', attrs(loose, 'data-value="none"', 'aria-pressed="true"'))
check('and All lets go of it', !attrs(loose, 'data-value=""', 'aria-pressed="true"'))
check('the strip is still there, with no day of it held down',
  find(loose, 'class="daybar"') && !attrs(loose, 'class="daybar__tab"', 'aria-pressed="true"'))

// The teabags. "Any day" on food is a third answer, not the absence of one: it
// means every day of the trip, so pressing a day finds it — which is what makes
// "have we got Sunday breakfast covered?" a question the page can answer with
// the bread on it.
const undatedEat = S.items
S.items = undatedEat.map((i) => (i.id === 'Crisps' ? { ...i, day: 'any' } : i))
S.filter = { day: SUN, kind: '', cat: '', hide: false, q: '' }
const sunday = viewTrip()
check('what is for the whole trip turns up under a day', find(sunday, 'data-id="Crisps"'))
check('and still says so, so the day can be told from the week',
  attrs(sunday, 'data-act="when"', 'data-id="Crisps"') && find(sunday, 'Any day'))
check('while the day\'s own things do not repeat the day', !find(sunday, `${shortDay(SUN)}<`))
S.filter = { day: 'none', kind: '', cat: '', hide: false, q: '' }
check('and "No day" is not for it, because it has been answered',
  !find(viewTrip(), 'data-id="Crisps"'))
S.items = undatedEat
S.filter = { day: 'none', kind: '', cat: '', hide: false, q: '' }

// Standing on "No day" is saying the opposite of standing on a day, so a row
// under it is still asked for one rather than for the hour.
const eatKept = S.items
S.tab = 'do'
S.items = [item({ id: 'Ridge', t: 'Ridge walk', list: 'activities', category: 'Daytime', day: SAT }),
  item({ id: 'Swim', t: 'Swim', list: 'activities', category: 'Daytime' })]
check('and a row under it is asked for a day, not for an hour', find(viewTrip(), 'Add a day'))
S.items = eatKept
S.tab = 'eat'

// It lets go of itself, so nobody is ever standing on an answer that has stopped
// being one: a tab where everything is dated has no such question.
const flatDays = S.items
S.items = flatDays.map((i) => (i.list === 'food' || i.list === 'drinks' ? { ...i, day: SAT } : i))
const allDated = viewTrip()
check('a tab with a day on everything does not offer it',
  !attrs(allDated, 'data-act="filter-day"', 'data-value="none"'))
check('and standing on it falls back to All rather than to nothing',
  find(allDated, 'data-id="Burgers"') && attrs(allDated, 'data-value=""', 'aria-pressed="true"'))
S.items = flatDays.map((i) => (i.list === 'food' ? { ...i, day: '' } : i))
check('nor does a tab with a day on nothing',
  !attrs(viewTrip(), 'data-act="filter-day"', 'data-value="none"'))
S.items = flatDays

// The Pack tab has no days: you pack the tent once, not on Saturday.
S.filter = { day: '', kind: '', cat: '', hide: false, q: '' }
S.tab = 'pack'
check('the packing list gets no day strip', !find(viewTrip(), 'class="daybar"'))
S.tab = 'do'
check('the Plan tab does', find(viewTrip(), 'class="daybar"'))

// And nor does a tab with nothing on it: there is no day of the trip on which
// nothing is still nothing, and the empty card is the only thing worth reading.
const some = S.items
S.items = []
check('a list with nothing on it gets no day strip', !find(viewTrip(), 'class="daybar"'))
check('just the card that gets it started', find(viewTrip(), 'data-act="suggest"'))
S.items = some
S.tab = 'eat'

// Both rows that scroll sideways — the days and the chips — fade out at the end
// they can still be pushed towards, which is the only way either of them has of
// saying there is more. Which end that is has to be measured: a fade on a week
// that fits on the screen is a lie, and one at the left of a row already at its
// left is a smudge on the first day of the trip.
const row = (scrollLeft, scrollWidth, clientWidth) => {
  const at = { scrollLeft, scrollWidth, clientWidth, dataset: {} }
  edges(at)
  return at.dataset.more
}
check('a trip that fits on the screen fades at neither end', row(0, 300, 300) === '')
check('a fortnight fades at the end there is more of it', row(0, 900, 300) === 'end')
check('pushed into the middle it fades at both', row(300, 900, 300) === 'both')
check('and at the far end, only back the way it came', row(600, 900, 300) === 'start')
check('a fraction of a pixel is not somewhere left to go', row(0.4, 300.6, 300) === '')

// Standing on a day is as good as saying so, so the add sheet arrives knowing.
S.filter = { day: SAT, kind: '', cat: '', hide: false, q: '' }
S.sheet = { kind: 'add', tab: 'eat', list: 'food', section: 'shared', day: S.filter.day }
renderSheet()
check('adding from a day lands on that day',
  find(roots['sheet-root'].innerHTML, `<input type="hidden" name="day" value="${SAT}">`))
S.sheet = null
S.filter = { day: '', kind: '', cat: '', hide: false, q: '' }

// Your own page flattens the lists, so the row has to carry the day itself.
S.tab = 'mine'
check('Mine says which day a thing is for', find(viewTrip(), shortDay(SAT)))

// Plans keep the headings they have always had — the day is the strip in the
// header, and a heading saying it too would be the page repeating itself. What
// the days do here is the order: the list reads in the order it happens.
S.items = [...flat.map((i) => (i.id === 'Hike' ? { ...i, day: SAT, time: '09:30' } : i)),
  item({ t: 'Stargazing', list: 'activities', category: 'After dark', day: SAT, time: '21:00' }),
  item({ t: 'Sunset spot', list: 'activities', category: 'After dark', day: SAT }),
  item({ t: 'Ferry', list: 'activities', category: 'Daytime', day: FRI }),
  item({ t: 'Swimming', list: 'activities', category: 'Daytime' })]
S.tab = 'do'
const plan = viewTrip()
check('the Plan tab stays filed by kind', heads(plan, 'Daytime') && heads(plan, 'After dark'))
check('and no day is ever a heading on it',
  ![FRI, SAT, SUN].some((d) => heads(plan, fullDay(d))) && !heads(plan, 'Any day'))
check('an earlier day comes first inside a heading',
  plan.indexOf('data-id="Ferry"') < plan.indexOf('data-id="Hike"'))
check('an hour comes before no hour on the same day',
  plan.indexOf('data-id="Stargazing"') < plan.indexOf('data-id="Sunset spot"'))
check('and a plan with no day at all goes last, still on the page',
  plan.indexOf('data-id="Hike"') < plan.indexOf('data-id="Swimming"'))
check('a row says which day it is on, and the hour with it',
  find(plan, `${shortDay(SAT)} · 09:30`))
check('and offers a day where there is none', find(plan, 'Add a day'))

// Press a day and the rows stop saying what the pressed tab already says.
S.filter = { day: SAT, kind: '', cat: '', hide: false, q: '' }
const planSat = viewTrip()
check('a pressed day leaves the headings where they were', heads(planSat, 'After dark'))
check('and the rows say the hour, not the day',
  find(planSat, '>09:30<') && !find(planSat, `${shortDay(SAT)} · `))
check('and offer the hour where there is none', find(planSat, 'Add a time'))
check('and Saturday is all that is left', !find(planSat, 'data-id="Swimming"'))
S.filter = { day: '', kind: '', cat: '', hide: false, q: '' }

// A list long enough to be worth searching stops being one the moment a day cuts
// it down, and the search box goes with it.
const plans = S.items
S.items = Array.from({ length: 10 }, (_, i) =>
  item({ t: `Idea ${i}`, list: 'activities', category: 'Daytime', day: i < 2 ? FRI : SAT }))
check('a list long enough to search gets the box', find(viewTrip(), 'id="cs-find"'))
S.filter = { day: FRI, kind: '', cat: '', hide: false, q: '' }
check('and loses it when a day cuts it down to two', !find(viewTrip(), 'id="cs-find"'))
S.filter = { day: FRI, kind: '', cat: '', hide: false, q: 'idea' }
check('but never while something is typed in it', find(viewTrip(), 'id="cs-find"'))
S.filter = { day: '', kind: '', cat: '', hide: false, q: 'nothing on any list' }
check('and searching down to nothing does not delete the field', find(viewTrip(), 'id="cs-find"'))
S.items = plans
S.filter = { day: '', kind: '', cat: '', hide: false, q: '' }

// The same trip with the dates taken off it: nothing about days is drawn at all.
const dated = S.trip
S.trip = { ...dated, start_date: '', end_date: '' }
const nowhen = viewTrip()
check('no dates means no day headings', !find(nowhen, 'Any day') && find(nowhen, '>Daytime<'))
check('no dates means nothing on the row offering one',
  !find(nowhen, 'data-act="when"') && find(nowhen, 'data-act="place"'))
S.sheet = { kind: 'when', id: 'Hike' }; renderSheet()
check('and the when sheet says why it has nothing to offer',
  find(roots['sheet-root'].innerHTML, 'No dates yet'))
S.sheet = { kind: 'add', tab: 'do', list: 'activities', section: 'shared' }; renderSheet()
check('and the add sheet does not ask', !find(roots['sheet-root'].innerHTML, 'name="day"'))
S.trip = dated

// The sheets, with dates back on.
S.sheet = { kind: 'when', id: 'Hike' }; renderSheet()
const when = roots['sheet-root'].innerHTML
check('the when sheet offers every day of the trip',
  attrs(when, 'data-act="on-day"', 'data-id="Hike"', `data-day="${FRI}"`) && find(when, `data-day="${SUN}"`))
check('and "no day" as an answer like any other',
  attrs(when, 'data-act="on-day"', 'data-id="Hike"', 'data-day=""'))
check('the day it is on shows as pressed', attrs(when, 'aria-pressed="true"', `data-day="${SAT}"`))
check('and it says a second day is a second one of these', find(when, 'one on each day'))
check('a plan is asked for an hour', find(when, 'name="time"') && find(when, 'value="09:30"'))
check('a plan is not asked which meal it is', !find(when, 'data-act="set-meal"'))
S.sheet = { kind: 'when', id: 'Burgers' }; renderSheet()
const meal = roots['sheet-root'].innerHTML
check('food is asked which meal, not what time',
  attrs(meal, 'data-act="set-meal"', 'data-id="Burgers"', 'data-cat="Breakfast"') && !find(meal, 'name="time"'))
check('and the meal it is already filed under shows as pressed',
  attrs(meal, 'aria-pressed="true"', 'data-cat="Dinner"'))
S.sheet = { kind: 'when', id: 'Crisps' }; renderSheet()
check('a category that is not a meal is offered rather than overwritten',
  attrs(roots['sheet-root'].innerHTML, 'aria-pressed="true"', 'data-cat="Snacks"'))

// The sheet asks about the thing, not the row it was opened from. Bacon on two
// mornings is two rows — one claim and one packed tick each — and both of them
// are the answer to "which days is bacon for?".
const held = S.items
S.items = [...held,
  item({ id: 'bacon-fri', t: 'Bacon', list: 'food', category: 'Breakfast', day: FRI }),
  item({ id: 'bacon-sat', t: 'Bacon', list: 'food', category: 'Breakfast', day: SAT }),
  item({ id: 'bacon-din', t: 'Bacon', list: 'food', category: 'Dinner', day: SUN }),
]
S.sheet = { kind: 'when', id: 'bacon-fri' }; renderSheet()
const two = roots['sheet-root'].innerHTML
check('every day the thing is on shows as pressed, not just this row\'s',
  attrs(two, 'aria-pressed="true"', `data-day="${FRI}"`)
    && attrs(two, 'aria-pressed="true"', `data-day="${SAT}"`))
check('the same name under another meal is a different question',
  !attrs(two, 'aria-pressed="true"', `data-day="${SUN}"`))
check('and "Any day" is not one of them while it has days',
  !attrs(two, 'aria-pressed="true"', 'data-day=""'))
check('the hint says how to drop one again', find(two, 'Press a day again'))

// An undated one of the same thing is a pressed "Any day", not an absence.
S.items = [...held, item({ id: 'tea-any', t: 'Tea', list: 'food', category: 'Snacks' })]
S.sheet = { kind: 'when', id: 'tea-any' }; renderSheet()
check('food nobody has answered for holds nothing down',
  !attrs(roots['sheet-root'].innerHTML, 'aria-pressed="true"', 'data-day='))
S.items = [...held, item({ id: 'tea-any', t: 'Tea', list: 'food', category: 'Snacks', day: 'any' })]
S.sheet = { kind: 'when', id: 'tea-any' }; renderSheet()
check('and one that is for the whole trip holds "Any day" down',
  attrs(roots['sheet-root'].innerHTML, 'aria-pressed="true"', 'data-day="any"'))
// A plan has no such state: "Any day" there is no day at all, waiting for one.
S.items = [...held, item({ id: 'swim-any', t: 'Swim', list: 'activities', category: 'Daytime' })]
S.sheet = { kind: 'when', id: 'swim-any' }; renderSheet()
check('a plan with no day still holds "Any day" down, which is an answer',
  attrs(roots['sheet-root'].innerHTML, 'aria-pressed="true"', 'data-day=""'))
S.items = held

S.sheet = { kind: 'add', tab: 'eat', list: 'food', section: 'shared', day: SAT, category: 'Lunch' }
renderSheet()
const seeded = roots['sheet-root'].innerHTML
check('the add sheet offers the days', find(seeded, `data-act="pick-day" data-value="${FRI}"`))
check('an empty slot seeds the sheet it opens',
  attrs(seeded, 'aria-pressed="true"', `data-value="${SAT}"`) && find(seeded, 'value="Lunch"')
  && find(seeded, `<input type="hidden" name="day" value="${SAT}">`))
check('and only that one', !attrs(seeded, 'aria-pressed="true"', `data-value="${FRI}"`))

// Instant noodles three nights running: the days are a multiple choice, and what
// comes back is one row per night rather than one row saying three.
S.sheet = { kind: 'add', tab: 'eat', list: 'food', section: 'shared', day: `${FRI},${SUN}` }
renderSheet()
const many = roots['sheet-root'].innerHTML
check('the add sheet can be holding down several days at once',
  attrs(many, 'aria-pressed="true"', `data-value="${FRI}"`)
    && attrs(many, 'aria-pressed="true"', `data-value="${SUN}"`))
check('and the day between them is not one of them',
  !attrs(many, 'aria-pressed="true"', `data-value="${SAT}"`))
check('"Any day" lets go as soon as a day is held', !attrs(many, 'aria-pressed="true"', 'data-value=""'))
check('the field carries the lot', find(many, `name="day" value="${FRI},${SUN}"`))
check('and the sheet says what more than one of them will do', find(many, 'one on each day'))

S.sheet = { kind: 'add', tab: 'eat', list: 'food', section: 'shared' }
renderSheet()
check('food with nothing picked holds nothing down, because nobody has said',
  !attrs(roots['sheet-root'].innerHTML, 'aria-pressed="true"', 'data-act="pick-day"'))
S.sheet = { kind: 'add', tab: 'do', list: 'activities', section: 'shared' }
renderSheet()
check('a plan with nothing picked is "Any day", which is an answer',
  attrs(roots['sheet-root'].innerHTML, 'aria-pressed="true"', 'data-value=""'))
S.sheet = { kind: 'add', tab: 'eat', list: 'food', section: 'shared', day: 'any' }
renderSheet()
check('and food for the whole trip has "Any day" to press',
  attrs(roots['sheet-root'].innerHTML, 'aria-pressed="true"', 'data-value="any"'))

// What the picked days turn into on the way to the server.
const noodles = { title: 'Instant noodles', list: 'food' }
check('three days picked is three rows, one per day',
  JSON.stringify(perDay(noodles, [FRI, SAT, SUN]).map((i) => i.day)) === JSON.stringify([FRI, SAT, SUN]))
check('each of them the same thing', perDay(noodles, [FRI, SAT]).every((i) => i.title === 'Instant noodles'))
check('and no day picked is still one row, on no day',
  perDay(noodles, []).length === 1 && perDay(noodles, [])[0].day === '')
check('an empty field is no days rather than one blank one', daysPicked('').length === 0)
check('and a field of days is those days', JSON.stringify(daysPicked(`${FRI},${SAT}`)) === JSON.stringify([FRI, SAT]))
S.sheet = { kind: 'add', tab: 'pack', list: 'gear', section: 'shared' }; renderSheet()
check('the packing list is never asked which day', !find(roots['sheet-root'].innerHTML, 'name="day"'))

S.sheet = null
S.items = flat
S.tab = 'pack'

// ---- the one dialog ---------------------------------------------------------

// There is nothing native left to ask with, so these are the manners the app's
// own dialog has to have in place of confirm()'s.
const pressed = el()
pressed.focus()
const dropped = ask({ title: `Remove "Josh's tent"?`, blurb: 'Its expense will stay in Settle up.', yes: 'Remove' })
const asked = roots['ask-root'].innerHTML
check('a question is the app\'s own dialog, not the browser\'s',
  find(asked, 'role="alertdialog"') && find(asked, 'aria-modal="true"'))
check('and its button says what it does, where OK said nothing',
  find(asked, '>Remove</button>') && !find(asked, '>OK</button>'))
check('a name with quotes in it is escaped into the question',
  find(asked, 'Remove &quot;Josh&#39;s tent&quot;?'))
check('the question takes the focus off the page behind it',
  document.activeElement === askButton)
check('the page behind is inert while it is up',
  roots.root.inert === true && roots['sheet-root'].inert === true)
check('and so is the install card, which the tab key would otherwise reach',
  roots.install.inert === true)
closeAsk(true)
check('yes is what it resolves to', await dropped === true)
check('and the page behind comes back with the question',
  roots.root.inert === false && roots['sheet-root'].inert === false
  && roots.install.inert === false && !roots['ask-root'].innerHTML)
check('the focus goes back to whatever had it before the question',
  document.activeElement === pressed)

const stayed = ask({ title: 'Remove Ali?' })
closeAsk(false)
check('walking away is a no, the same as a dismissed confirm()', await stayed === false)

const older = ask({ title: 'The first question?' })
const newer = ask({ title: 'The second question?' })
check('a second question walks away from the first', await older === false)
check('and only the second one is left on screen',
  find(roots['ask-root'].innerHTML, 'The second question?')
  && !find(roots['ask-root'].innerHTML, 'The first question?'))
closeAsk(true)
check('leaving the second one to be answered', await newer === true)

askCopy({ title: 'Copy this link', value: 'http://x/t/pine-camp-123' })
const copyAsk = roots['ask-root'].innerHTML
check('the clipboard fallback hands the text over to be copied by hand',
  find(copyAsk, 'value="http://x/t/pine-camp-123"') && find(copyAsk, 'readonly'))
closeAsk(true)

// The two views that are not the trip.
S.sheet = null; S.view = 'landing'; S.trips = []; render()
check('landing renders', roots.root.innerHTML.includes('Start a trip'))
S.view = 'join'; S.me = null; render()
check('unsigned join asks for identity', roots.root.innerHTML.includes('Sign in to join'))
S.auth.user = { id: 'u1', name: 'Josh', email: 'josh@example.com', picture: '' }
render()
check('signed-in join asks for a trip name', roots.root.innerHTML.includes('How should your name appear?'))

// ---- settings ---------------------------------------------------------------

section('Settings: the theme')

loadPrefs()
check('nothing kept means following the device', S.prefs.theme === 'system')
check('and every feature on, because a switch is for quietening an app you use',
  FEATURES.every((f) => S.prefs.features[f.id] === true))
check('a light device resolves system to light',
  document.documentElement.dataset.theme === 'light')
check('and the status bar is painted to match', themeMeta.content === '#1B382E')

setSystemDark(true)
check('the phone going dark takes the app with it, with no visit in between',
  document.documentElement.dataset.theme === 'dark' && themeMeta.content === '#16261F')

S.prefs.theme = 'light'
applyTheme()
check('choosing light overrules the device', document.documentElement.dataset.theme === 'light')
setSystemDark(false)
S.prefs.theme = 'dark'
applyTheme()
check('and choosing dark overrules it the other way',
  document.documentElement.dataset.theme === 'dark' && themeMeta.content === '#16261F')

savePrefs()
S.prefs = { theme: 'system', features: {} }
loadPrefs()
check('the theme survives the next visit', S.prefs.theme === 'dark')
check('and is on the page before anything is drawn',
  document.documentElement.dataset.theme === 'dark')

store.set(PREFS_KEY, '{ not json')
loadPrefs()
check('a corrupted store falls back rather than failing to start',
  S.prefs.theme === 'system' && FEATURES.every((f) => S.prefs.features[f.id] === true))

section('Settings: the page')

S.view = 'settings'
S.auth.user = null
S.alerts = null
const signedOut = viewSettings()
check('signed out, the account card offers a way in',
  find(signedOut, 'Account') && !find(signedOut, 'data-act="sign-out"'))
check('the theme has three answers',
  THEMES.every((t) => find(signedOut, `data-act="theme" data-value="${t.id}"`)))
check('and exactly one of them is pressed',
  (signedOut.match(/aria-pressed="true"\s+data-act="theme"/g) ?? []).length === 1)
check('signed out, notifications say what signing in would buy',
  find(signedOut, 'Sign in to be reminded about your trips'))
check('every feature has a switch', FEATURES.every((f) => find(signedOut, `data-act="feature" data-id="${f.id}"`)))
check('a switch says what it is to a screen reader, not just in colour',
  find(signedOut, 'role="switch" aria-checked="true"'))

S.auth.user = { id: 'u1', name: 'Josh McCabe', email: 'josh@example.com', picture: '' }
S.auth.memberships = [{ tripId: 't1', memberId: 'm1' }]
const signedIn = viewSettings()
check('signed in, the account card is who you are',
  find(signedIn, 'Josh McCabe') && find(signedIn, 'josh@example.com'))
check('with no picture, the initials stand in', find(signedIn, 'account__face--none'))
check('and signing out is here rather than beside your name on the home page',
  find(signedIn, 'data-act="sign-out"'))
const namedAwkwardly = { id: 'u1', name: 'Josh & Sam', email: '', picture: '' }
const wasUser = S.auth.user
S.auth.user = namedAwkwardly
check('a name with an ampersand in it is escaped', find(viewSettings(), 'Josh &amp; Sam'))
S.auth.user = wasUser

S.alerts = {
  loading: false, busy: false, error: '', permission: 'granted',
  publicKey: 'k', subscribed: true,
  reminders: { lead: false, morning: false },
  trips: [{ tripId: 't1', name: 'Wasdale Weekend' }],
}
const withAlerts = viewSettings()
check('this device and what you want told are two questions, asked separately',
  find(withAlerts, 'data-act="device-alerts"') && find(withAlerts, 'data-act="reminder" data-id="lead"'))
// Three days out is about the group's list and the morning of is about your
// own, so wanting one is no reason to want the other.
check('the two reminders are two switches',
  find(withAlerts, 'data-act="reminder" data-id="lead"')
  && find(withAlerts, 'data-act="reminder" data-id="morning"'))
check('and both start off, because nobody has asked for them',
  (withAlerts.match(/aria-checked="false" data-act="reminder"/g) ?? []).length === 2)
// A card that grew a row per trip buried the two answers under ten trips, and
// which trips may notify you is a question the trip's own bell already asks.
check('the trips are no longer a list on this page',
  !find(withAlerts, 'data-act="trip-alerts"') && !find(withAlerts, 'Wasdale Weekend'))

S.alerts = { ...S.alerts, reminders: { lead: true, morning: false } }
const halfReminded = viewSettings()
check('one on and one off is a state this page can draw',
  find(halfReminded, 'aria-checked="true" data-act="reminder" data-id="lead"')
  && find(halfReminded, 'aria-checked="false" data-act="reminder" data-id="morning"'))
S.alerts = { ...S.alerts, reminders: { lead: false, morning: false } }

S.alerts = { ...S.alerts, permission: 'denied' }
const blocked = viewSettings()
check('a browser-level block says so, and offers no switch that would lie',
  find(blocked, 'blocked for this site') && !find(blocked, 'data-act="device-alerts"'))
// The reminders are an account setting your phone obeys, so they are still
// yours to change from the laptop that has blocked notifications — and from the
// iPhone that cannot show one until it is on the home screen.
check('but what you want told is still yours to set from here',
  find(blocked, 'data-act="reminder" data-id="morning"'))

S.alerts = { ...S.alerts, permission: 'unsupported', subscribed: false }
const unsupported = viewSettings()
check('a browser that cannot notify says why rather than offering a dead switch',
  find(unsupported, 'cannot show notifications') && !find(unsupported, 'data-act="device-alerts"'))
check('and keeps the reminder switches its other devices obey',
  find(unsupported, 'data-act="reminder" data-id="lead"'))

// A request that never arrived is not the answer "off, and no trips". Drawn as
// switches it would be the wrong settings in the voice of the right ones.
S.alerts = {
  loading: false, busy: false, permission: '', publicKey: '', subscribed: false, trips: [],
  reminders: { lead: false, morning: false },
  error: 'Your notification settings could not be loaded.',
}
const alertsFailed = viewSettings()
check('a failed read says so rather than drawing settings nobody confirmed',
  find(alertsFailed, 'could not be loaded') && !find(alertsFailed, 'data-act="device-alerts"')
  && !find(alertsFailed, 'data-act="reminder"'))
check('and offers the one thing worth doing about it',
  find(alertsFailed, 'data-act="retry-alerts"'))

section('Settings: what the switches turn off')

S.view = 'trip'
S.alerts = null
S.camp = 'overview'
S.trip = { ...S.trip, start_date: '2099-09-04', end_date: '2099-09-06' }
// With a last message to show, the room door shows it rather than what the room
// is for — and it is the "what it is for" line that mentions @camp, so both of
// the checks below would otherwise be reading a door that says neither.
S.notify = { ...S.notify, tripId: 't1', latest: null }
loadPrefs()
const everything = viewTrip()
check('with everything on, the trip page has the lot',
  find(everything, 'countdown__n') && find(everything, '<h3>Weather</h3>')
  && find(everything, 'Camp smarts') && find(everything, '<span class="mono">@camp</span>'))
// The cog rides in the header rather than at the foot of the trip page, so it
// is one tap from every tab instead of a scroll on one of them.
check('and the way to settings is in the header', find(everything, 'class="topbar__cog"'))
for (const tab of ['pack', 'eat', 'do', 'mine']) {
  S.camp = false
  S.tab = tab
  check(`settings is reachable from ${tab}`, find(viewTrip(), 'data-act="settings"'))
}
S.camp = 'overview'
S.tab = 'pack'

S.prefs.features = { countdown: false, weather: false, suggestions: false, assistant: false, install: false }
const quietened = viewTrip()
check('the countdown goes, and takes its empty state with it',
  !find(quietened, 'countdown__n') && !find(quietened, 'No dates yet'))
check('the forecast card goes', !find(quietened, '<h3>Weather</h3>'))
check('camp smarts goes', !find(quietened, 'Camp smarts'))
check('and the room door stops advertising an assistant that is off',
  !find(quietened, '<span class="mono">@camp</span>'))
check('but the trip itself is untouched — the switches are yours, not the group\'s',
  find(quietened, 'Wasdale Weekend') && find(quietened, 'Planning room'))

S.camp = false
S.tab = 'pack'
S.filter = { day: '', kind: '', cat: '', hide: false, q: '' }
const listNoSuggest = viewTrip()
check('"What am I missing?" goes from the foot of the list',
  !find(listNoSuggest, 'data-act="suggest"') && find(listNoSuggest, 'data-act="add"'))

S.items = []
const emptyNoSuggest = viewTrip()
check('and an empty list offers writing your own as the loud button, not a leftover link',
  find(emptyNoSuggest, 'btn--blaze" data-act="add"') && !find(emptyNoSuggest, 'data-act="suggest"'))

S.camp = 'room'
S.chat = { ...S.chat, assistantAvailable: true }
const roomNoCamp = viewTrip()
check('the room drops the @camp completion when Camp is off',
  !find(roomNoCamp, 'id="chat-mention"') && !find(roomNoCamp, 'aria-controls="chat-mention"'))
check('and the placeholder stops offering it', find(roomNoCamp, 'placeholder="Write a message…"'))

S.prefs.features.assistant = true
const roomWithCamp = viewTrip()
check('turned back on, the completion comes back', find(roomWithCamp, 'id="chat-mention"'))

section('Settings: the route')

check('/settings is not a trip', tripRoute('/settings') === null)
check('but it is a route this app knows', isSettingsRoute('/settings') && isSettingsRoute('/settings/'))
check('and an ordinary path is not', !isSettingsRoute('/t/pine-camp'))

resetHistory('/t/pine-camp/room')
showSettings('/t/pine-camp/room')
check('opening settings from a trip keeps the way back to that trip',
  S.view === 'settings' && S.settingsBack === '/t/pine-camp/room')
check('and the back arrow points at it', find(roots.root.innerHTML, 'href="/t/pine-camp/room"'))
check('and it is one entry deep', history.length === 2 && location.pathname === '/settings')

// The bug this replaced: leaving pushed the trip back on rather than popping
// settings off, so every visit left the stack two entries taller than it found
// it. Press back afterwards and you were in settings again — and after a few
// visits the way out ran through every one of them before reaching the trip.
await leaveSettings()
check('leaving settings takes its own entry back off the stack', history.length === 1)
check('and leaves you standing on the trip you opened it from',
  location.pathname === '/t/pine-camp/room')

// Opened cold: a bookmark, a home-screen icon, the first page of the visit.
// There is nothing underneath to pop, so the arrow has to push somewhere.
resetHistory('/settings')
showSettings('/settings')
check('opening settings on settings does not point back at itself',
  S.settingsBack === '/')
check('and knows there is nothing behind it to go back to', S.settingsPushed === false)

section('The Planning Room: in and out')

S.view = 'trip'
S.camp = false
S.tab = 'eat'
S.notify = { ...S.notify, tripId: 't1', unread: 3 }
const onAList = viewTrip()
check('a list carries the button into the room', find(onAList, 'class="room-fab"'))
check('with what you have missed on it',
  find(onAList, 'class="room-fab__unread" aria-hidden="true">3<'))
check('and it says so out loud', find(onAList, 'aria-label="Planning room, 3 unread messages"'))

S.camp = 'overview'
check('the trip page does not — the door is already open on that screen',
  !find(viewTrip(), 'class="room-fab"'))
S.camp = 'room'
check('and the room itself does not offer a way into itself',
  !find(viewTrip(), 'class="room-fab"'))

// The bug this replaced: the arrow out drove to the trip page whatever door you
// came in by, so opening the room from the packing list and closing it again
// left you on a page you had not been on, with the list two taps away.
S.camp = false
S.tab = 'eat'
S.filter = { day: '', kind: 'own', cat: '', hide: false, q: 'bag' }
resetHistory('/t/t1')
// Half way down the list, which is the other half of where you were.
window.scrollY = 240
pushTripView('room')
window.scrollY = 0
S.camp = 'room'
check('opening the room from a list is one entry deep',
  history.length === 2 && location.pathname === '/t/t1/room')
check('and the arrow out of it is the way back rather than a destination',
  find(viewTrip(), 'data-act="leave-focus"'))
leaveFocus()
check('leaving takes that entry back off the stack', history.length === 1)
check('and lands on the trip rather than the room', location.pathname === '/t/t1')

// A reload in the room is the case the entry has to answer for: the stack
// underneath is untouched and the app's memory of which list it was drawn on is
// gone, so back has nothing to go on but what was written on the way in.
S.tab = 'pack'
S.filter = { day: '', kind: '', cat: '', hide: false, q: '' }
// The browser follows the pop with a popstate of its own, and this is the app's
// own handler answering it — not a function the test reached in and called.
fireWindow('popstate', {})
check('the pop draws the list rather than booting the app again',
  S.view === 'trip' && S.camp === false)
check('and it is the list you were reading, not the one the app opens on',
  S.tab === 'eat')
check('narrowed the way you left it', S.filter.kind === 'own' && S.filter.q === 'bag')
check('and scrolled where you left it', window.scrollY === 240)
window.scrollY = 0
S.filter = { day: '', kind: '', cat: '', hide: false, q: '' }

// Nonsense on an entry — an older version of the app wrote it, or a reload three
// days ago did — is a page restored to its defaults, never a page that fails to
// draw.
resetHistory('/t/t1')
history.replaceState({ tripView: false, tab: 'nowhere', filter: 'yes' }, '', '/t/t1')
S.camp = 'room'
fireWindow('popstate', {})
check('an entry written by another version of this app is ignored, not obeyed',
  S.tab === 'eat' && S.filter.kind === '' && typeof S.filter.q === 'string')

// Opened cold: a notification, a link somebody sent, a home-screen icon left in
// the room. There is nothing underneath to pop, so the arrow has to go
// somewhere, and the trip page is the screen the rest of the trip hangs off.
resetHistory('/t/t1/room')
S.camp = 'room'
leaveFocus()
check('opened cold, the arrow puts you on the trip page instead',
  S.camp === 'overview' && location.pathname === '/t/t1')

console.log(bad ? `\n${bad} FAILED` : '\nall passed')
process.exit(bad ? 1 : 0)
