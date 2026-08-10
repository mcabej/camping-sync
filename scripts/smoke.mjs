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
globalThis.location = { pathname: '/', origin: 'http://x' }
globalThis.history = { pushState() {}, replaceState() {} }
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

const src = readFileSync('public/app.js', 'utf8')
const hooks = ['S', 'render', 'viewTrip', 'renderSheet', 'CAMP', 'TABS',
  'loadFolds', 'saveFolds', 'autoFold', 'pageGroups']
new Function(`${src}\n;Object.assign(globalThis, {${hooks.map((h) => `__${h}: ${h}`).join(',')}})`)()

const { __S: S, __render: render, __viewTrip: viewTrip, __renderSheet: renderSheet, __TABS: TABS,
  __loadFolds: loadFolds, __saveFolds: saveFolds, __autoFold: autoFold } = globalThis
const { CATALOG } = await import('../lib/catalog.js')

// A trip with a bit of everything: claimed by one, claimed by three, unclaimed,
// half packed, personal, plans.
const claim = (id, packed = false) => ({ member_id: id, packed })
const item = (o) => ({ id: o.t, list: 'gear', category: 'Shelter', title: o.t, note: '', qty: '',
  kind: 'shared', claims: [], place: '', lat: null, lon: null, votes: [], own: [], ...o })

S.catalog = CATALOG
S.tips = [{ title: 'a', body: 'b' }]
S.me = 'm1'
S.view = 'trip'
S.trip = { id: 't1', name: 'Wasdale Weekend', location: 'Wasdale Head, CA20 1EX', lat: 54, lon: -3,
  map_url: '', start_date: '2026-09-04', end_date: '2026-09-06', notes: 'Gate code 1470', rev: 1 }
S.members = [{ id: 'm1', name: 'Josh', hue: 0 }, { id: 'm2', name: 'Sam', hue: 1 },
  { id: 'm3', name: 'Ali Khan', hue: 2 }, { id: 'm4', name: 'Robin', hue: 3 }]
S.events = [{ actor: 'Sam', text: 'added Tent', created_at: new Date().toISOString() }]
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

const FILTERS = [{ kind: '', cat: '' }, { kind: 'shared', cat: '' }, { kind: 'own', cat: '' },
  { kind: '', cat: 'Shelter' }, { kind: 'shared', cat: 'Nothing filed here' },
  { kind: '', cat: '', hide: true }, { kind: '', cat: '', q: 'te' },
  { kind: '', cat: '', q: 'nothing on any list' }, { kind: 'own', cat: '', hide: true, q: 'bag' }]

for (const camp of [false, true]) {
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
const foldAll = viewTrip()
check('the page offers to fold every section', find(foldAll, 'data-act="fold-all" data-shut="true"'))
check('the fold-all button says what it will do', find(foldAll, 'Fold all</button>'))
S.folds.shut = new Set(['pack:Shelter', 'pack:Camp kitchen', 'pack:Light & power'])
const allFolded = viewTrip()
check('with everything folded the button offers the way back',
  find(allFolded, 'data-act="fold-all" data-shut="false"') && find(allFolded, 'Unfold all</button>'))
check('everything folded means no rows at all', !find(allFolded, '<li class="item'))
S.folds.shut = new Set()

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
S.camp = true
const campPageHtml = viewTrip()
check('Camp is lit when you are on it', find(campPageHtml, 'data-act="camp" aria-current="page"'))
check('trip page still renders its cards', find(campPageHtml, "Who's coming") && find(campPageHtml, 'Getting there'))
check('one place is current at a time', (campPageHtml.match(/aria-current="page"/g) ?? []).length === 1)

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

// The two views that are not the trip.
S.sheet = null; S.view = 'landing'; S.trips = []; render()
check('landing renders', roots.root.innerHTML.includes('Start a trip'))
S.view = 'join'; S.me = null; render()
check('join renders', roots.root.innerHTML.includes('Who are you?'))

console.log(bad ? `\n${bad} FAILED` : '\nall passed')
process.exit(bad ? 1 : 0)
