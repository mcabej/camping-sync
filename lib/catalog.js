// The camping knowledge baked into the app: what to bring, what to eat,
// what to do, and the things first-timers find out the hard way.
//
// Nothing here is ever put on a trip for you. A list you did not write is a list
// you have to read and prune before it is yours, which is more work than writing
// it — so all of this is offered under "What am I missing?" as one-tap adds, and
// a new trip starts empty.
//
// `starter: true` is the shortlist: the things you genuinely cannot camp
//                 without. They are offered first inside their heading, so the
//                 essentials are the first thing you see when you go looking.
// `own: true`     means this is yours rather than the group's — it belongs on
//                 one person's private list, and is only offered on the
//                 personal-kit half.
// `per: n`        is how much of it one person needs, with `unit` for what n is
//                 counted in and `daily: true` for the rates that are per person
//                 *per day*. It is what turns "how much?" from a free-text box
//                 nobody trusts into a number that goes up when somebody's
//                 partner joins. Only a few things honestly have one — the
//                 meals, plates, cutlery and drinking water, and nothing else on
//                 these lists — and `own` things never do, because one each is
//                 what personal kit already means.

export const GEAR = [
  // ---- Shelter & sleep -----------------------------------------------------
  { cat: 'Shelter & sleep', title: 'Tent', starter: true, note: 'Open it before you leave. Poles, stakes and rainfly all present?' },
  { cat: 'Shelter & sleep', title: 'Sleeping bag', starter: true, own: true, note: 'Check the temperature rating against the forecast low, not the high.' },
  { cat: 'Shelter & sleep', title: 'Sleeping pad or air mattress', starter: true, own: true, note: 'The one thing beginners skip. Bare ground pulls heat out of you all night.' },
  { cat: 'Shelter & sleep', title: 'Groundsheet or footprint', note: 'Goes under the tent. Keeps the floor dry and unpunctured.' },
  { cat: 'Shelter & sleep', title: 'Pillow', own: true },
  { cat: 'Shelter & sleep', title: 'Extra blanket', own: true, note: 'Cheap insurance on a cold night.' },
  { cat: 'Shelter & sleep', title: 'Mallet for tent stakes', note: 'A rock works. A mallet works better.' },
  { cat: 'Shelter & sleep', title: 'Eye mask and earplugs', own: true, note: 'Campsites are louder and brighter at 6am than you expect.' },

  // ---- Camp kitchen --------------------------------------------------------
  { cat: 'Camp kitchen', title: 'Camp stove', starter: true, note: 'Do not count on cooking over the fire. Fire bans happen.' },
  { cat: 'Camp kitchen', title: 'Fuel for the stove', starter: true, note: 'Check the canister is not half empty from last time.' },
  { cat: 'Camp kitchen', title: 'Lighter and waterproof matches', starter: true },
  { cat: 'Camp kitchen', title: 'Cooler', starter: true, note: 'Pack it the night before so it is cold when the food goes in.' },
  { cat: 'Camp kitchen', title: 'A second cooler for drinks', note: 'Keeps people out of the food cooler, which keeps the food cold.' },
  { cat: 'Camp kitchen', title: 'Ice or ice packs', starter: true },
  { cat: 'Camp kitchen', title: 'Water jug or containers', starter: true, note: 'Roughly 1 gallon / 4L per person per day for drinking and cooking.' },
  { cat: 'Camp kitchen', title: 'Pot and pan' },
  { cat: 'Camp kitchen', title: 'Plates, bowls, mugs', per: 1, note: 'One set each. A group of nine finds this out at the first meal.' },
  { cat: 'Camp kitchen', title: 'Cutlery', per: 1 },
  { cat: 'Camp kitchen', title: 'Sharp knife and small cutting board' },
  { cat: 'Camp kitchen', title: 'Cooking utensils', note: 'Spatula, tongs, a big spoon.' },
  { cat: 'Camp kitchen', title: 'Can opener and bottle opener', note: 'The classic forgotten item. Ask anyone.' },
  { cat: 'Camp kitchen', title: 'Aluminium foil', note: 'Foil packet dinners cook in the coals and leave nothing to wash.' },
  { cat: 'Camp kitchen', title: 'Dish soap, sponge, wash tub', note: 'Biodegradable soap, and wash well away from any stream or lake.' },
  { cat: 'Camp kitchen', title: 'Tea towel and paper towels' },
  { cat: 'Camp kitchen', title: 'Trash bags', starter: true, note: 'Bring out everything you brought in. Two more than you think.' },
  { cat: 'Camp kitchen', title: 'Food storage tub with a lid', note: 'Keeps food out of reach of animals and stops the raccoons winning.' },
  { cat: 'Camp kitchen', title: 'Coffee setup', note: 'Instant, a French press, or a pour-over cone. Decide now, not at 7am.' },
  { cat: 'Camp kitchen', title: 'Salt, pepper, oil', note: 'Small bottles. Everything tastes better and nobody remembers these.' },

  // ---- Light & power -------------------------------------------------------
  { cat: 'Light & power', title: 'Headlamp', starter: true, own: true, note: 'One each — hands free beats a phone torch every time. It gets properly dark.' },
  { cat: 'Light & power', title: 'Lantern for the table' },
  { cat: 'Light & power', title: 'Spare batteries' },
  { cat: 'Light & power', title: 'Power bank', starter: true, own: true, note: 'No outlets. Phones drain fast hunting for signal.' },
  { cat: 'Light & power', title: 'Car charger and cable' },

  // ---- Fire & sitting ------------------------------------------------------
  { cat: 'Fire & sitting', title: 'Firewood', note: 'Buy it near the campsite. Moving firewood spreads tree pests, and it is often against the rules.' },
  { cat: 'Fire & sitting', title: 'Kindling or fire starters', note: 'Wood alone will not light. Bring starters.' },
  { cat: 'Fire & sitting', title: 'Camp chair', starter: true, own: true, note: 'One each. Sitting on a log gets old in twenty minutes.' },
  { cat: 'Fire & sitting', title: 'Water bucket to douse the fire', note: 'Fire out cold before bed and before you leave. Every time.' },
  { cat: 'Fire & sitting', title: 'Work gloves' },

  // ---- Clothing ------------------------------------------------------------
  { cat: 'Clothing', title: 'Warm layer: fleece or puffy', starter: true, own: true, note: 'Nights drop far below the daytime high. This is the most common regret.' },
  { cat: 'Clothing', title: 'Rain jacket', starter: true, own: true, note: 'Check the forecast, then bring it anyway.' },
  { cat: 'Clothing', title: 'Sturdy closed shoes', starter: true, own: true },
  { cat: 'Clothing', title: 'Spare socks', own: true, note: 'Twice as many as you planned. Wet feet ruin a day.' },
  { cat: 'Clothing', title: 'Beanie and gloves', own: true, note: 'You lose most heat through your head while sleeping.' },
  { cat: 'Clothing', title: 'Sun hat and sunglasses', own: true },
  { cat: 'Clothing', title: 'Swimsuit and quick-dry towel', own: true },
  { cat: 'Clothing', title: 'Camp sandals', own: true, note: 'For the shower block and for giving your feet a break.' },
  { cat: 'Clothing', title: 'Dry bag or bin liner for wet clothes', own: true },

  // ---- Health & safety -----------------------------------------------------
  { cat: 'Health & safety', title: 'First aid kit', starter: true, note: 'Plasters, blister pads, painkillers, antihistamine, tweezers for splinters and ticks.' },
  { cat: 'Health & safety', title: 'Personal medications', starter: true, own: true, note: 'Plus an inhaler or EpiPen if anyone in the group carries one. Tell each other where they are.' },
  { cat: 'Health & safety', title: 'Sunscreen', starter: true },
  { cat: 'Health & safety', title: 'Insect repellent', starter: true, note: 'Dusk is when they arrive. All of them.' },
  { cat: 'Health & safety', title: 'Toilet paper', starter: true, note: 'Assume the campsite has run out.' },
  { cat: 'Health & safety', title: 'Toiletries and toothbrush', starter: true, own: true },
  { cat: 'Health & safety', title: 'Hand sanitiser and wet wipes' },
  { cat: 'Health & safety', title: 'Tick remover', note: 'Worth having if there is long grass or woodland.' },
  { cat: 'Health & safety', title: 'Trowel', note: 'Only if there are no toilets. Bury it 15cm deep, 60m from water.' },

  // ---- Paperwork & logistics ----------------------------------------------
  { cat: 'Logistics', title: 'Campsite booking confirmation', starter: true, note: 'Screenshot it. There will be no signal at the gate.' },
  { cat: 'Logistics', title: 'Offline maps downloaded', starter: true, own: true, note: 'Everyone does this one. Download the area in Google Maps or a hiking app before you lose signal.' },
  { cat: 'Logistics', title: 'Cash', starter: true, own: true, note: 'Firewood, showers and honesty boxes are often cash only.' },
  { cat: 'Logistics', title: 'Someone at home knows the plan', starter: true, note: 'Where you are, when you are back. Costs nothing.' },
  { cat: 'Logistics', title: 'Check the fire ban status', starter: true, note: 'Ring the site or check the park website in the last 48 hours.' },
  { cat: 'Logistics', title: 'Check quiet hours and the arrival cut-off', note: 'Many sites lock the gate at 10pm.' },
  { cat: 'Logistics', title: 'Spare car key', note: 'Locking the keys in the car, three hours from anywhere, is a real day.' },

  // ---- Repairs & extras ----------------------------------------------------
  { cat: 'Repairs & extras', title: 'Duct tape', note: 'Fixes tents, boots, poles and pride.' },
  { cat: 'Repairs & extras', title: 'Paracord or rope', note: 'Washing line, guy line, tarp ridge.' },
  { cat: 'Repairs & extras', title: 'Multi-tool' },
  { cat: 'Repairs & extras', title: 'Tarp', note: 'A dry place to sit when it rains changes the whole trip.' },
  { cat: 'Repairs & extras', title: 'Camp table' },
  { cat: 'Repairs & extras', title: 'Hammock' },
  { cat: 'Repairs & extras', title: 'Speaker', note: 'Check quiet hours first. Your neighbours are two metres away.' },
]

// A meal is the one thing on any of these lists that is straightforwardly one
// each, so every main course carries `per: 1`: put the burgers down for Saturday
// and the list says how many, and keeps saying it when somebody's partner joins.
// Snacks do not — nobody rations the crisps by the head — and neither do the
// drinks you choose rather than need.
export const FOOD = [
  { cat: 'Dinner', title: 'Burgers', per: 1, note: 'Shape the patties at home.' },
  { cat: 'Dinner', title: 'Hot dogs', per: 1, note: 'The lowest-effort camp dinner there is.' },
  { cat: 'Dinner', title: 'Foil packet dinners', per: 1, note: 'Sausage, potato, onion, butter. Wrap at home, cook in the coals.' },
  { cat: 'Dinner', title: 'Chilli', per: 1, unit: 'portions', note: 'Cook it at home, freeze it, reheat in one pot. It doubles as an ice block.' },
  { cat: 'Dinner', title: 'Pasta and jar sauce', per: 1, unit: 'portions', note: 'One pot, ten minutes.' },
  { cat: 'Dinner', title: 'Fajitas', per: 1, note: 'Chop the peppers and marinate the meat at home.' },
  { cat: 'Dinner', title: 'Curry from a jar with rice', per: 1, unit: 'portions' },
  { cat: 'Breakfast', title: 'Bacon and eggs', per: 1, note: 'Crack the eggs into a bottle at home. No shells, no breakage.' },
  { cat: 'Breakfast', title: 'Pancake mix', per: 1, unit: 'portions', note: 'The just-add-water kind.' },
  { cat: 'Breakfast', title: 'Instant oatmeal', per: 1, unit: 'sachets' },
  { cat: 'Breakfast', title: 'Pastries and fruit', per: 1, note: 'For the morning nobody wants to cook.' },
  { cat: 'Breakfast', title: 'Breakfast burritos', per: 1, note: 'Make them at home, wrap in foil, warm on the stove.' },
  { cat: 'Lunch', title: 'Sandwich supplies', per: 1, unit: 'lunches', note: 'Bread, cheese, ham, whatever. Lunch is rarely worth cooking.' },
  { cat: 'Lunch', title: 'Wraps and hummus', per: 1, unit: 'lunches' },
  { cat: 'Lunch', title: 'Instant noodles', per: 1, unit: 'packets' },
  { cat: 'Snacks', title: 'S\'mores kit', note: 'Marshmallows, chocolate, biscuits. Non-negotiable.' },
  { cat: 'Snacks', title: 'Trail mix and nuts' },
  { cat: 'Snacks', title: 'Crisps' },
  { cat: 'Snacks', title: 'Chocolate and sweets' },
  { cat: 'Snacks', title: 'Fruit', note: 'Apples and oranges survive a cooler. Bananas do not.' },
  { cat: 'Snacks', title: 'Biscuits' },
]

// Only things you can actually drink. The jug, the cooler and anything else you
// carry them in is kit, and kit lives in the packing list — a cooler on the
// menu is as much use as a saucepan on it.
export const DRINKS = [
  { cat: 'Drinks', title: 'Drinking water', starter: true, per: 4, unit: 'L', daily: true, note: 'About 1 gallon / 4L per person per day. Check whether the site has taps.' },
  { cat: 'Drinks', title: 'Coffee', starter: true },
  { cat: 'Drinks', title: 'Tea' },
  { cat: 'Drinks', title: 'Hot chocolate', note: 'Better round a fire than it has any right to be.' },
  { cat: 'Drinks', title: 'Beer' },
  { cat: 'Drinks', title: 'Wine', note: 'Boxed or a screw cap. Nobody brings the corkscrew.' },
  { cat: 'Drinks', title: 'Spirits and mixers' },
  { cat: 'Drinks', title: 'Soft drinks' },
  { cat: 'Drinks', title: 'Juice' },
  { cat: 'Drinks', title: 'Electrolyte tablets', note: 'For a hot day of walking, or the morning after.' },
]

export const ACTIVITIES = [
  { cat: 'Daytime', title: 'Hike', note: 'Pick the route now and download it. Check the length and the climb.' },
  { cat: 'Daytime', title: 'Swimming' },
  { cat: 'Daytime', title: 'Kayaking or paddleboarding' },
  { cat: 'Daytime', title: 'Fishing', note: 'Check whether you need a licence.' },
  { cat: 'Daytime', title: 'Mountain biking' },
  { cat: 'Daytime', title: 'Explore the nearest town' },
  { cat: 'Daytime', title: 'Photography walk' },
  { cat: 'Around camp', title: 'Campfire', note: 'Only if there is no fire ban.' },
  { cat: 'Around camp', title: 'Cards or a board game', note: 'For the two hours of rain nobody planned for.' },
  { cat: 'Around camp', title: 'Hammock and a book' },
  { cat: 'Around camp', title: 'Cook something properly together' },
  { cat: 'Around camp', title: 'Frisbee or a football' },
  { cat: 'After dark', title: 'Stargazing', note: 'Download a star map app while you still have signal.' },
  { cat: 'After dark', title: 'Sunset spot', note: 'Find out where it is before the day you want it.' },
  { cat: 'After dark', title: 'Night walk' },
  { cat: 'After dark', title: 'Sunrise hike', note: 'Agree who is actually getting up. Be honest.' },
]

// Things that go wrong on a first trip. Shown on the Camp smarts tab.
export const TIPS = [
  {
    title: 'Your sleeping pad matters more than your sleeping bag',
    body: 'A cold night is almost always the ground stealing your heat from underneath, not thin air above you. An insulated pad or air mattress fixes more cold nights than a warmer bag does.',
  },
  {
    title: 'It gets much colder than the forecast high',
    body: 'The number you looked at is the daytime peak. Clear nights can drop 15-20°C below it. Look up the overnight low and pack for that.',
  },
  {
    title: 'Arrive with at least two hours of daylight left',
    body: 'Pitching a tent you have never used, in the dark, with a headtorch, is the worst possible introduction to camping. Aim to arrive early.',
  },
  {
    title: 'Pitch the tent once in the garden first',
    body: 'Twenty minutes at home tells you whether the poles are all there, whether the zip works, and how it actually goes up. This is the single highest-value thing on this list.',
  },
  {
    title: 'Assume there is no phone signal',
    body: 'Download offline maps, screenshot your booking, and agree a meeting point with your friends in case you get separated and cannot call.',
  },
  {
    title: 'Never keep food in the tent',
    body: 'Food goes in the car, a bear box, or a sealed tub, depending on where you are. Animals find it, and you do not want them finding it next to your head.',
  },
  {
    title: 'Check the fire ban before you buy firewood',
    body: 'Bans are common in dry seasons and they are enforced. Check the park or site website in the last day or two, and always have a stove as backup.',
  },
  {
    title: 'Buy firewood near the site, not at home',
    body: 'Moving firewood moves tree pests with it. Most parks ask you not to, and many sell wood at the gate.',
  },
  {
    title: 'Water: about 1 gallon / 4L per person per day',
    body: 'That covers drinking, cooking and washing up. Find out whether your site has drinking taps. If it does not, this is a lot of water and it needs planning.',
  },
  {
    title: 'Prep food at home',
    body: 'Chop vegetables, marinate meat, shape burgers, crack eggs into a bottle. Freeze anything you are eating on the second night. It doubles as an ice block and thaws right on time.',
  },
  {
    title: 'Leave no trace',
    body: 'Everything you bring in comes out with you, including food scraps and bottle caps. Wash up 60m away from any stream or lake, and use biodegradable soap.',
  },
  {
    title: 'Put the fire out cold',
    body: 'Water, stir, water again, until you can hold your hand over it. Do this before bed and before you leave, every time.',
  },
  {
    title: 'Agree who is driving and who is paying for what',
    body: 'Fuel, the pitch fee, firewood, the big shop. Sorting it before you go is much easier than working it out in a car park on Sunday.',
  },
  {
    title: 'Tell someone at home the plan',
    body: 'Where you are camping and when you expect to be back. It costs nothing and it is the one safety habit worth keeping forever.',
  },
]

export const CATALOG = { gear: GEAR, food: FOOD, drinks: DRINKS, activities: ACTIVITIES }

// Used once, to backfill trips created before items knew about shared vs own.
// The extra titles are ones the catalogue has since renamed.
export const OWN_TITLES = new Set([
  ...Object.values(CATALOG).flat().filter((e) => e.own).map((e) => e.title.toLowerCase()),
  'headlamp for each person',
  'camp chairs',
])

// The rate an entry carries, in the three columns an item stores it in. Kept in
// one place so that the catalogue can go on saying `per: 4, unit: 'L', daily`
// while everything downstream reads the same three fields off an item, whether
// that item came from here or somebody typed it.
export function rateOf(entry) {
  const per = entry?.own ? 0 : Number(entry?.per) > 0 ? Number(entry.per) : 0
  // The three go together or not at all: a unit with no rate is a label on
  // nothing, and a per-day flag with no rate is nothing per day.
  if (!per) return { per_head: 0, unit: '', per_day: 0 }
  return { per_head: per, unit: String(entry.unit ?? ''), per_day: entry.daily ? 1 : 0 }
}

// A catalogue entry by name, in the shape an item is added in. This is how
// anything else in the app can say "offer them the tarp" without owning a copy
// of what the tarp is, which heading it goes under, or why it is worth having.
const BY_TITLE = new Map(Object.entries(CATALOG).flatMap(([list, entries]) => entries.map((e) => [
  e.title.toLowerCase(),
  { list, category: e.cat, title: e.title, note: e.note ?? '', kind: e.own ? 'own' : 'shared', ...rateOf(e) },
])))

export const catalogEntry = (title) => BY_TITLE.get(String(title ?? '').trim().toLowerCase()) ?? null

// What a forecast means for what you pack. Every tip in TIPS is about the
// weather in the abstract — "it gets colder than the forecast high" — and this
// is the same knowledge aimed at the actual numbers for the actual weekend,
// which is the version somebody will act on.
//
// `when` is read against the worst of the trip's days rather than their average.
// One wet afternoon is the entire reason a tarp exists, and a mean of three days
// hides it. Units are the ones Open-Meteo answers in: °C, mm, km/h.
export const WEATHER_ADVICE = [
  {
    id: 'wet',
    when: (w) => w.rain >= 4 || w.pop >= 60,
    say: 'Rain is coming. A dry place to sit is the difference between a washout and a good weekend.',
    gear: ['Tarp', 'Rain jacket', 'Dry bag or bin liner for wet clothes'],
  },
  {
    id: 'cold',
    when: (w) => w.lo <= 5,
    say: (w) => `Down to ${Math.round(w.lo)}°C overnight. Check sleeping bag ratings against that number, not the daytime high.`,
    gear: ['Warm layer: fleece or puffy', 'Beanie and gloves', 'Extra blanket'],
  },
  {
    id: 'windy',
    when: (w) => w.wind >= 40,
    say: 'Windy enough to matter. Peg out every guy line, and bring more pegs than the tent came with.',
    gear: ['Paracord or rope', 'Mallet for tent stakes'],
  },
  {
    id: 'hot',
    when: (w) => w.hi >= 25,
    say: 'Hot. Shade and water go further than you expect on a pitch with no trees on it.',
    gear: ['Sunscreen', 'Sun hat and sunglasses', 'Water jug or containers'],
  },
  {
    id: 'storm',
    when: (w) => w.storm,
    say: 'Thunderstorms in the outlook. Know where the car is, and do not pitch under the tallest tree on the field.',
    gear: [],
  },
]

// Advice names its gear by title, so a rename in the catalogue would quietly
// leave a tip with nothing to offer. Said out loud at boot rather than
// discovered by somebody wondering where the tarp button went.
for (const tip of WEATHER_ADVICE) {
  for (const title of tip.gear) {
    if (!catalogEntry(title)) console.warn(`catalog: weather advice "${tip.id}" points at "${title}", which is not in the catalogue`)
  }
}
