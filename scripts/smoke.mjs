// Throwaway: renders every screen against a stubbed DOM so a typo in the
// tab-bar rework shows up here rather than on somebody's phone.
import { readFileSync } from 'node:fs'

const el = () => ({
  innerHTML: '', textContent: '', value: '',
  classList: { add() {}, remove() {}, toggle() {} },
  querySelector: () => null, querySelectorAll: () => [],
  setAttribute() {}, removeAttribute() {}, focus() {}, setSelectionRange() {},
  matches: () => false, closest: () => null, getBoundingClientRect: () => ({ top: 0, bottom: 0 }),
})
const roots = { root: el(), 'sheet-root': el(), toast: el(), install: el() }

globalThis.document = {
  getElementById: (id) => roots[id], addEventListener() {}, createElement: el,
  documentElement: { style: { setProperty() {} }, classList: { toggle() {} } },
  body: { classList: { add() {}, remove() {}, toggle() {} }, style: { setProperty() {}, removeProperty() {} } },
  hidden: false, activeElement: null, querySelector: () => null,
}
globalThis.matchMedia = () => ({ matches: false })
globalThis.window = {
  scrollY: 0, scrollTo() {}, scrollBy() {}, addEventListener() {},
  innerHeight: 800, visualViewport: null, matchMedia: globalThis.matchMedia,
}
globalThis.location = { pathname: '/', origin: 'http://x', protocol: 'http:', host: 'x' }
globalThis.history = { pushState() {}, replaceState() {} }
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
globalThis.fetch = async () => ({ ok: true, json: async () => ({ catalog: {}, tips: [] }) })
globalThis.__CAMPING_SYNC_TEST__ = true

const src = readFileSync('public/app.js', 'utf8')
const hooks = ['S', 'render', 'viewTrip', 'renderSheet', 'CAMP', 'TABS',
  'loadFolds', 'saveFolds', 'autoFold', 'pageGroups', 'tripDays',
  'dayTurned', 'turnDay', 'tillMidnight', 'edges', 'perDay', 'daysPicked',
  'ensureChatSocket', 'stopChatSocket', 'fitChatBox', 'campMentionRange', 'completeCampMention']
new Function(`${src}\n;Object.assign(globalThis, {${hooks.map((h) => `__${h}: ${h}`).join(',')}})`)()

const { __S: S, __render: render, __viewTrip: viewTrip, __renderSheet: renderSheet, __TABS: TABS,
  __loadFolds: loadFolds, __saveFolds: saveFolds, __autoFold: autoFold,
  __tripDays: tripDays, __dayTurned: dayTurned, __turnDay: turnDay,
  __tillMidnight: tillMidnight, __edges: edges, __perDay: perDay,
  __daysPicked: daysPicked, __ensureChatSocket: ensureChatSocket,
  __stopChatSocket: stopChatSocket, __fitChatBox: fitChatBox,
  __campMentionRange: campMentionRange, __completeCampMention: completeCampMention } = globalThis
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
  map_url: '', start_date: '2026-09-04', end_date: '2026-09-06', notes: 'Gate code 1470', rev: 1 }
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

const find = (html, needle) => html.includes(needle)
let bad = 0
const check = (label, ok) => { if (!ok) { bad++; console.log(`  FAIL  ${label}`) } else console.log(`  ok    ${label}`) }

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
check('no badge on the tab you are on', !find(mine, 'style="background:#2F6B57">4'))
check('Mine has no standing paragraph', !find(mine, 'class="page__note"'))
check('Mine filters by kind', find(mine, 'data-act="filter-kind" data-value="own"'))
check('Mine filters by category', find(mine, 'data-act="filter-cat" data-value="Camp kitchen"'))
check('Mine counts are all yours, none blaze',
  !find(mine, 'class="filters__n">') && find(mine, 'class="filters__n" style="background:#2F6B57'))

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
check('Mine badge shows on other tabs, in your colour', find(pack, 'tabbar__flag" style="background:#2F6B57">3<'))
check('list badges stay blaze (no inline colour)', find(pack, '<span class="tabbar__flag">2<'))

// Camp is reachable from the header and lights up when you are on it.
check('the bar carries Camp alongside the tabs', find(pack, 'data-act="camp" >') || find(pack, 'data-act="camp">'))
S.camp = 'overview'
const campPageHtml = viewTrip()
check('Camp is lit when you are on it', find(campPageHtml, 'data-act="camp" aria-current="page"'))
check('trip page still renders its cards', find(campPageHtml, "Who's coming") && find(campPageHtml, 'Getting there'))
check('one place is current at a time', (campPageHtml.match(/aria-current="page"/g) ?? []).length === 1)
check('the overview links to the planning room instead of embedding it',
  find(campPageHtml, 'href="/t/t1/room"') && !find(campPageHtml, 'id="chat-text"'))
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
  find(roomPageHtml, 'thread__message--mine') && find(roomPageHtml, 'Josh'))
check('planning room has paged history and a labelled composer',
  find(roomPageHtml, 'data-act="chat-older"') && find(roomPageHtml, 'class="sr-only" for="chat-text">Message the group'))
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
socket.fire('message', { data: JSON.stringify({
  type: 'message.created',
  message: { id: 3, client_id: 'three', member_id: 'm2', author_name: 'Sam', body: 'I can drive.', created_at: new Date().toISOString() },
}) })
check('a socket delivery merges the durable message once',
  S.chat.messages.filter((m) => m.id === 3).length === 1 && S.chat.messages.at(-1).body === 'I can drive.')
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
S.sheet = { kind: 'item', id: 'Crisps' }; renderSheet()
const unclaimed = roots['sheet-root'].innerHTML
// Your name is a row like everybody else's, and that row is the only way in.
check('no "I\'ll bring it" shortcut beside your own name',
  !find(unclaimed, "I'll bring it") && !find(unclaimed, "I'll organise it"))
check('your own name is still there to tap',
  new RegExp('data-act="claim" data-id="Crisps" data-member="m1"').test(unclaimed))
S.sheet = { kind: 'place', id: 'Hike' }; renderSheet()
check('place sheet renders', find(roots['sheet-root'].innerHTML, 'Where is Hike?'))

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

// The two views that are not the trip.
S.sheet = null; S.view = 'landing'; S.trips = []; render()
check('landing renders', roots.root.innerHTML.includes('Start a trip'))
S.view = 'join'; S.me = null; render()
check('unsigned join asks for identity', roots.root.innerHTML.includes('Sign in to join'))
S.auth.user = { id: 'u1', name: 'Josh', email: 'josh@example.com', picture: '' }
render()
check('signed-in join asks for a trip name', roots.root.innerHTML.includes('How should your name appear?'))

console.log(bad ? `\n${bad} FAILED` : '\nall passed')
process.exit(bad ? 1 : 0)
