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
const roots = { root: el(), 'sheet-root': el(), toast: el() }

globalThis.document = {
  getElementById: (id) => roots[id], addEventListener() {}, createElement: el,
  documentElement: { style: { setProperty() {} }, classList: { toggle() {} } },
  hidden: false, activeElement: null, querySelector: () => null,
}
globalThis.window = { scrollY: 0, scrollTo() {}, addEventListener() {}, innerHeight: 800, visualViewport: null }
globalThis.matchMedia = () => ({ matches: false })
globalThis.location = { pathname: '/', origin: 'http://x' }
globalThis.history = { pushState() {}, replaceState() {} }
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {}, length: 0, key: () => null }
globalThis.fetch = async () => ({ ok: true, json: async () => ({ catalog: {}, tips: [] }) })

const src = readFileSync('public/app.js', 'utf8')
const hooks = ['S', 'render', 'viewTrip', 'renderSheet', 'CAMP', 'TABS']
new Function(`${src}\n;Object.assign(globalThis, {${hooks.map((h) => `__${h}: ${h}`).join(',')}})`)()

const { __S: S, __render: render, __viewTrip: viewTrip, __renderSheet: renderSheet, __TABS: TABS } = globalThis
const { CATALOG } = await import('../lib/catalog.js')

// A trip with a bit of everything: claimed, unclaimed, packed, personal, plans.
const item = (o) => ({ id: o.t, list: 'gear', category: 'Shelter', title: o.t, note: '', qty: '',
  kind: 'shared', assignee_id: null, packed: false, place: '', lat: null, lon: null, votes: [], own: [], ...o })

S.catalog = CATALOG
S.tips = [{ title: 'a', body: 'b' }]
S.me = 'm1'
S.view = 'trip'
S.trip = { id: 't1', name: 'Wasdale Weekend', location: 'Wasdale Head, CA20 1EX', lat: 54, lon: -3,
  map_url: '', start_date: '2026-09-04', end_date: '2026-09-06', notes: 'Gate code 1470', rev: 1 }
S.members = [{ id: 'm1', name: 'Josh', hue: 0 }, { id: 'm2', name: 'Sam', hue: 1 }]
S.events = [{ actor: 'Sam', text: 'added Tent', created_at: new Date().toISOString() }]
S.items = [
  item({ t: 'Tent', assignee_id: 'm1' }),
  item({ t: 'Camp stove', assignee_id: 'm1', packed: true, category: 'Camp kitchen' }),
  item({ t: 'Cooler', assignee_id: 'm2', category: 'Camp kitchen' }),
  item({ t: 'Firewood' }),
  item({ t: 'Sleeping bag', kind: 'own', category: 'Shelter', own: ['m1'] }),
  item({ t: 'Headlamp', kind: 'own', category: 'Light & power', own: [] }),
  item({ t: 'Burgers', list: 'food', category: 'Dinner', assignee_id: 'm1' }),
  item({ t: 'Crisps', list: 'food', category: 'Snacks' }),
  item({ t: 'Beer', list: 'drinks', category: 'Drinks', assignee_id: 'm1' }),
  item({ t: 'Drinking water', list: 'drinks', category: 'Drinks' }),
  item({ t: 'Hike', list: 'activities', category: 'Daytime', votes: ['m1'] }),
]

const find = (html, needle) => html.includes(needle)
let bad = 0
const check = (label, ok) => { if (!ok) { bad++; console.log(`  FAIL  ${label}`) } else console.log(`  ok    ${label}`) }

for (const camp of [false, true]) {
  for (const t of TABS) {
    S.tab = t.id
    S.camp = camp
    for (const section of ['shared', 'own']) {
      S.section = section
      const html = viewTrip()
      check(`${camp ? 'camp over ' : ''}${t.id}/${section} renders`, html.length > 500)
    }
  }
}

// The merge: one Eat tab must carry food and drink together.
S.camp = false; S.tab = 'eat'; S.section = 'shared'
const eat = viewTrip()
check('Eat shows food', find(eat, 'Burgers') && find(eat, 'Crisps'))
check('Eat shows drink', find(eat, 'Beer') && find(eat, 'Drinking water'))
check('Eat groups food before drink', eat.indexOf('>Dinner<') < eat.indexOf('>Drinks<'))
check('drinks are one heading', !find(eat, 'Hot drinks') && !find(eat, 'Cold drinks') && !find(eat, '>Water<'))
check('nothing on Eat is uningestible', !find(eat, 'cooler') && !find(eat, 'Cooler'))
check('Eat bar counts both lists', find(eat, '2</b> need someone'))

// Mine: claimed group kit plus personal kit, across lists, no plans.
S.tab = 'mine'
const mine = viewTrip()
check('Mine has claimed gear', find(mine, 'Tent') && find(mine, 'Camp stove'))
check('Mine has claimed food/drink', find(mine, 'Burgers') && find(mine, 'Beer'))
check('Mine has personal kit', find(mine, 'Sleeping bag') && find(mine, 'Headlamp'))
check("Mine excludes others' claims", !find(mine, 'Cooler'))
check('Mine excludes plans', !find(mine, 'Hike'))
check('no badge on the tab you are on', !find(mine, 'style="background:#2F6B57">4'))

// Badges elsewhere: Pack has 1 unclaimed (Firewood), Eat has 2.
S.tab = 'pack'
const pack = viewTrip()
check('Pack tab badge suppressed while on Pack', !find(pack, '<span class="tabbar__flag">1<'))
check('Eat tab badge shows 2', find(pack, '<span class="tabbar__flag">2<'))
check('Mine badge shows on other tabs, in your colour', find(pack, 'tabbar__flag" style="background:#2F6B57">4<'))
check('list badges stay blaze (no inline colour)', find(pack, '<span class="tabbar__flag">2<'))

// Camp is reachable from the header and lights up when you are on it.
check('header opens the trip', find(pack, 'data-act="camp" aria-pressed="false"'))
S.camp = true
check('header lit on the trip page', find(viewTrip(), 'data-act="camp" aria-pressed="true"'))
check('trip page still renders its cards', find(viewTrip(), "Who's coming") && find(viewTrip(), 'Getting there'))
check('no tab is current on the trip page', !find(viewTrip(), 'aria-current="page"'))

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

S.sheet = { kind: 'assign', id: 'Tent' }; renderSheet()
check('assign sheet renders', find(roots['sheet-root'].innerHTML, 'Who&#39;s bringing Tent?'))
S.sheet = { kind: 'place', id: 'Hike' }; renderSheet()
check('place sheet renders', find(roots['sheet-root'].innerHTML, 'Where is Hike?'))

// The two views that are not the trip.
S.sheet = null; S.view = 'landing'; S.trips = []; render()
check('landing renders', roots.root.innerHTML.includes('Start a trip'))
S.view = 'join'; S.me = null; render()
check('join renders', roots.root.innerHTML.includes('Who are you?'))

console.log(bad ? `\n${bad} FAILED` : '\nall passed')
process.exit(bad ? 1 : 0)
