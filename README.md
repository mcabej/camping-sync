# Camping Sync

A shared trip planner for camping with friends. One link, one quick sign-in.
Everyone claims what they're bringing, whatever nobody has picked up stays
orange, and the planning conversation stays with the trip instead of getting
lost in a separate group chat.

## What it does

- **Pack / Eat / Plan** — four shared lists (drinks sit under Eat), grouped by
  category — except Plan, which groups by the days of the trip once anything has
  one.
- **For the group vs personal kit** — one tent covers four people; one sleeping
  bag covers one. Group items are claimed by a single person. Personal items
  (`kind = 'own'`) can't be claimed at all — every person ticks off their own,
  and **only they can see it**: the server returns a viewer's own ticks and
  nobody else's, and personal ticks are kept out of the activity feed.
  A switcher in the sticky header moves between the two halves of a list.
- **Two steps, both labelled** — first *who is bringing it*, then *is it packed*.
  The packed toggle only exists once somebody has claimed the item, so there is
  never an unlabelled checkbox sitting next to an unanswered question.
- **What am I missing?** — a catalogue of ~90 things people usually bring, each
  with a note explaining why, filtered to hide what you already have.
- **The Trip tab** — the whole trip on one screen: days to go, what nobody has
  picked up yet and which list to open about it, all four bars reporting at once
  — including your own load — tap one to go there, the notes everyone needs
  (gate code, meeting point) shown as text rather than buried in a form, and who
  has packed what of what they claimed.
- **When and where** — the dates and the place in one card and one form, because
  that is the pair you check the night before somebody drives. The place is
  **one** field holding the real name rather than a nickname for it: headers and
  cards show what comes before the first comma, the card shows the lot, with one
  tap to turn-by-turn. Paste a map pin and that wins over everything, because a
  lot of campsites sit down an unnamed track.
- **Place search** — the *Where* box looks places up as you type, finishes the
  name for you the way a browser's address bar does, and drops the rest under
  the cursor (see below). Take one and the coordinates come with it, so the map
  link is a pin rather than a hopeful search; type whatever you like when you
  don't know yet, because "somewhere with a lake" is a real answer in March.
- **Plans have places** — a plan can say where it happens, which is usually the
  location that matters: nobody needs directions to the tent they are sleeping
  in, and "the sunset spot" means nothing to whoever has not been there. The
  chip on the row opens the same search box, with the map link behind it.
- **Days** — a strip of the trip's days over the Eat and Plan lists.
  Press Sunday and the page is Sunday, so "have we actually got Sunday lunch
  covered?" is one tap rather than a question the app cannot answer. Plans also
  group by day, which turns that tab into an itinerary. Optional everywhere, and
  invisible until the trip has dates.
- **Weather** — the trip already knows where and when it is, so the forecast
  needs nothing from anybody. Days on the Trip tab, and what they mean for the
  list offered as one-tap adds: a wet Saturday is the reason a tarp exists.
- **Dietary needs** — one line per person, shown at the top of the food list and
  again at the moment somebody takes on Saturday dinner, rather than buried on a
  page about people.
- **Settle up** — record petrol, pitch fees or the cost of a claimed item, say
  who paid, and choose exactly who shares it — one car's occupants or the whole
  trip. Its own page nets everything into a short, deterministic list of "Sam
  owes Alex £12" payments; the Trip tab keeps only the total and the next move.
  Each trip has one explicit currency, and odd pennies are assigned visibly in
  the trip's member order. Press **Mark paid** on one of those lines to record
  the money actually changing hands — full or part, and editable, because half
  of these end in a round number. Repayments net in with the expenses and keep
  their own **Paid back** list, so a mistake is one Undo rather than a fake
  expense.
- **Going home** — flip the trip round on the last morning and every list starts
  asking the other question: not *who is bringing this* but *is it back in the
  car*. Whatever nobody ticks back in is what gets left in the grass.
- **Camp smarts** — 14 things first-timers find out the hard way.
- **Live sync** — trip/list changes still use the cheap 5s revision poll;
  committed chat messages arrive immediately over a same-origin WebSocket.
  Dropped connections retry with bounded backoff and fill any gap from the
  durable message cursor. Polling remains the fallback for blocked upgrades
  and for legacy profiles until Google links their membership.
- **Planning room** — a durable, member-attributed trip thread with paginated
  history and safe retries. Its own delivery cursor keeps conversation from
  making every client refetch the packing lists.
- **Message notifications** — optional Web Push alerts for Planning Room
  messages, grouped per trip. Senders and members actively reading the room are
  skipped; each member can mute a trip, and unread counts remain visible in the
  app when push is unavailable or disabled.
- **`@camp` assistant** — signed-in members can ask a trip-aware assistant about
  the details, lists, people and recent planning thread. Replies stream through
  the existing WebSocket and become durable messages when complete. Explicit
  requests can add validated list items; ordinary questions never mutate the
  trip.
- **Activity feed** — who added, claimed, packed or dropped what.
- **Installs, and works without a signal** — add it to a home screen and it
  opens full-screen showing the last state the server sent, which is the state
  that matters once you are at the campsite and the bars have gone.

## Running it locally

```bash
npm install
npm run dev        # reads .env.local when it exists
npm start          # http://localhost:3000
```

`npm run dev` restarts on file changes. For Google sign-in and `@camp` locally,
copy the example environment file and replace its placeholders. The assistant
stays hidden and does not call OpenAI when `OPENAI_API_KEY` is absent.

```bash
cp .env.example .env.local
```

`OPENAI_MODEL` is optional; it defaults to the cost-sensitive
`gpt-5.6-luna` model.

## How it's built

No build step, no framework. Node's built-in `node:sqlite` for storage and
Express for routing; the frontend is three static files.

```
server.js          REST API + WebSocket delivery + static hosting
lib/db.js          schema, queries, trip codes
lib/catalog.js     the camping knowledge (gear, food, drinks, plans, tips)
public/            index.html, styles.css, app.js
public/            sw.js, manifest.webmanifest, icons/  — the installable part
scripts/           make-icons.mjs (regenerates public/icons)
```

### Data model

One `items` table with a `list` discriminator (`gear` / `food` / `drinks` /
`activities`), plus `trips`, `members`, `votes`, `stows`, `events` and durable
`messages`. Each trip carries a `rev` counter bumped on list and trip writes —
that's what the clients poll. Messages use their own increasing cursor and a
`role` that distinguishes member posts from durable Camp replies.

An item's `kind` decides how it's tracked, and the two are mutually exclusive:

| `kind`   | Tracked by                    | Meaning                            |
| -------- | ----------------------------- | ---------------------------------- |
| `shared` | `assignee_id` + `packed`      | One person brings it for everyone.  |
| `own`    | rows in `own_checks`          | One each; every person ticks their own. |

Switching an item between the two clears the other model's state, so a thing
can never be half-claimed and half-one-each. Plans (`activities`) are always
shared and never show the orange unclaimed chip — nobody "brings" a hike, so
they're measured by votes and can take an optional organiser instead. Trips created before this split are migrated on boot: the column is
added and known one-each titles are flipped over, using the catalogue.

An expense carries a description, an integer-minor-unit amount, a payer and the
members sharing it. It can optionally point back to a claimed item, but petrol
and pitch fees stand on their own. The trip's three-letter `currency` labels
every expense. Settlement splits each one only across its participants without
floating-point arithmetic; indivisible pennies go to those participants in the
same stable member order used everywhere else, and the UI says when that rule
was needed.

A `payments` row is the other half of that ledger: one member, another member,
an amount and an optional note. It is deliberately not a flag on the netted "Sam
owes Alex £12" line, because that line is a calculation — the next expense
redraws it, and a part payment has to survive that. Settlement folds payments
into the same balances as the expenses, so a repayment simply makes the debts it
covers smaller. Both people must still be on the trip, which is why removing a
member with payments asks you to clear them first, exactly as expenses do.

Any member can record a payment between any two people, and any member can undo
one. That is deliberate, and the same authority they already have over an
expense or somebody else's place on the trip: the person handing over the cash
is often not the person holding the phone, and a ledger only one member can
correct is a ledger that stays wrong. Both directions are named in the activity
feed. Each payment also carries a `client_id` made by the browser before
sending, unique per trip: a field with no signal in it cannot tell a lost answer
from a refused write, so pressing *Record payment* again is answered with the
payment that already landed rather than a second one. The same key arriving with
different money is refused as a conflict instead of quietly rewriting what the
group has already been shown.

Items carry the same trio as a trip — `place`, `lat`, `lon` — filled in by the
same search. Only plans offer it in the UI, since a place on a bag of sausages
answers a question nobody asked, but the columns are on every item. `day` and
`time` follow the same rule: on every row, offered only where when is a real
question. See *Days*.

Where a trip is used to be two columns — `location` for what you called it,
`address` for where it actually was — which let a trip say "the lake" and stop
there. It is one now: `location` holds the real place, `lat`/`lon` hold the pin
when it came from the search, and `map_url` is still the override for a place
the geocoder puts in the wrong field. Boot migrates the old shape by promoting
any `address` a trip has into `location` and dropping the column; trips that
only ever had the nickname keep it, since it is the best answer anyone gave.

### Place search

`GET /api/places?q=` proxies [Nominatim](https://nominatim.org), OpenStreetMap's
geocoder — free, no key, but it asks callers for one identifying `User-Agent`
and no more than a request a second. Browsers can't promise either, so the
server does it for everyone: a single queue paced at ~1.1s, an hour-long
in-memory cache of the last 400 queries, and a busy answer once six lookups are
already waiting. A failed lookup is not an error — the box still takes anything
you type, so the endpoint answers `{ places: [], failed: true }` and the menu
says so.

The box itself is a combobox with inline completion: the rest of the best match
lands in it already selected, so typing on overwrites it, `Enter` / `Tab` / `→`
take it whole, `Backspace` removes exactly the part you did not type, and `Esc`
hands your own letters back. It only ever completes a match that genuinely
starts with what you typed — finishing "lake" as "Windermere" would be a guess
dressed as a fact. Type-ahead is off where `pointer: fine` isn't, because
rewriting the value under a phone's composing keyboard corrupts the next
keystroke; touch keeps the menu, which suits a thumb better regardless. Queries
answered once are kept in the tab, so completion for a word you have typed
before lands under the cursor rather than 300ms later.

Taking a result writes the whole place into `location` and its coordinates into
`lat`/`lon` — hidden inputs beside the box, so the pin is saved by the same
submit as the words and can never end up describing somewhere else. Typing over
the words clears the pin for the same reason: a stale pin is worse than none,
because it sends people confidently to the wrong field. `display_name` from
Nominatim is not what gets stored — nine parts ending in the country, with the
parish in the middle — so `whereLine()` keeps what you would write on a
postcard: place, village, postcode, country.

If the volume ever outgrows Nominatim's policy, this is one function to point at
a paid geocoder — nothing else in the app knows where suggestions come from.

### Weather

`GET /api/weather?lat=&lon=&start=&end=` proxies
[Open-Meteo](https://open-meteo.com) — free, no key, the same shape as the
geocoder above. It is still somebody else's server, so answers are cached for
half an hour and calls in flight are shared: thirty phones opening the same trip
at once make one request between them, not thirty. The key rounds the pin to
three decimal places, which is about a hundred metres — the same forecast, and
one cache entry rather than one per phone that rounded differently.

The window asked for is the part of the trip that is both still ahead and still
knowable: yesterday's weather is not news, and anything past about a fortnight is
a seasonal average wearing a date, which is worse than saying nothing because
somebody would pack for it. When the trip runs past that horizon the answer
carries `cut: true` and the card says so. When there is nothing to ask about at
all the endpoint answers `{ days: [], reason }` — `nowhere` for a place typed by
hand with no pin behind it (the card says to pick it from the search, which is
the fix), `nowhen`, `past`, `far` with the date the forecast will reach it, or
`failed`. A forecast is a nicety; nothing else on the trip depends on it.

What makes it worth having is not the numbers but what they change. `days` come
back shaped for the card — nulls rather than zeros for a missing reading, because
a day with no wind figure is not a still day — and `advice` is read against the
*worst* of them one number at a time. Averaging would hide the Saturday it rains
all day behind two dry ones, and the Saturday is the whole reason anybody would
pack differently. The five rules live in `lib/catalog.js`, and each names its
gear by catalogue title, resolved through `catalogEntry()` into the real entry —
heading, note and all — so the client can offer "add a tarp" without knowing
anything about camping. A rename in the catalogue would quietly leave a tip with
nothing to offer, so that is checked at boot and warned about rather than
discovered by somebody wondering where the tarp button went.

The client asks once per question — the pin and the dates — and only while the
Trip tab is on screen; move the trip and the old answer is dropped rather than
left sitting under a new pin. Anything already on the list is not offered again.

### Days

`day` on `items` is an ISO date and `time` is `HH:MM`, both empty by default and
both optional for good. A trip in March has no dates yet, and most of what goes
on a list is not any particular day's — so a page with nothing dated on it is the
page it has always been, grouped by category, rather than a broken version of the
dated one. Existing rows migrate to no day at all, because nothing already on a
trip can be dated by guesswork: a dinner is not Saturday's because the trip has a
Saturday.

The server checks the shape and nothing else. A day outside the trip's dates is
not the same kind of wrong as half a coordinate — the dates themselves move, and
a plan that was Sunday's until somebody shortened the trip is still what somebody
meant — so it is kept and drawn where it falls. Anything that is not a day at all
becomes no day.

**Three values, not two.** `day` was doing two jobs at once and they are different
answers: "nobody has said yet" and "this one is for the whole trip". The teabags
are for every day; a dinner nobody has slotted is for none of them *yet*. Spelling
both as an empty string meant pressing Sunday could say *Nothing on Sun 6 Sep*
with the bread to cover it sitting on the list, and it meant the `No day` chip
filled up with things that were never going to have one. So the column — already
`TEXT`, so nothing underneath had to move — takes an ISO date, the empty string,
or `any`.

`Any day` is one name for two meanings, and they are the same meaning to whoever
taps it: *not on a particular day*. What differs is what that is worth on each
tab. Food for any day is on the list for Sunday, so pressing Sunday shows it and
the pill writes `any`. A plan for any day is **not** happening on Sunday — it is
waiting for somebody to say when — so there the pill writes no day at all and the
plan sits under `All` until it has one. Which leaves food with a third state that
has no pill, because it is what nothing pressed looks like: nobody has answered.
That is the pile `No day` is for, and it is the one worth being able to see.

A day of the trip therefore holds what was put on that day *plus* what was put on
all of them, and the rows that are there every day keep saying so even when
standing on a day would otherwise say it for them — otherwise the page cannot
tell what it has for Saturday from what it has all week, which is the whole
reason both are on it.

**One day per row, and instant noodles three nights running is three rows.** Both
day pickers are a multiple choice — the add sheet's and the one on an item that
already exists — but what neither does is let a row span days, and that is the
deliberate part. Everything this app counts hangs off a row: who has put their
name to it, whether their share is in the car, whether the day is covered. One
row standing for three dinners would have Sunday covered the moment somebody
agreed to bring Friday's, and blaze means exactly one thing here — nobody has
picked this up. Three nights of noodles is three things to pick up, so it is
three rows, and the sheet says so before you tick the second day.

That makes the When sheet a question about **the thing rather than the row it was
opened from**. Its pills are pressed for every day this thing is on, where "this
thing" is every row with the same name, on the same list, in the same group, in
the same half of it — so bacon on Thursday and bacon on Friday are one question
with two answers, while noodles at lunch and noodles at dinner stay two separate
questions rather than one Saturday that cannot say which of them it means. One
tap is then one of four things:

- **an empty day, on a thing that has days already** — a second row on that day,
  carrying everything that describes it and none of what happened to it: no
  claims, no packed ticks, because agreeing to bring Friday's is not agreeing to
  bring Sunday's;
- **an empty day, on a thing with no day at all** — a move rather than a copy.
  Giving something its first day is the commonest thing this sheet is opened for,
  and starting a fresh unclaimed row would quietly drop the name of whoever had
  already said they would bring it;
- **a day it is on, with others left** — that day's row goes. If somebody has put
  their name to it, it says whose before it does;
- **the only day it is on** — set loose rather than removed. "We are having
  noodles, just not saying when" is an answer; a thing with no rows left is a
  thing deleted, and that is what Remove is for.

If the row going is the one the sheet was opened on, the sheet is pointed at a
surviving sibling first, so it stays open on the same question.

The fan-out is one request, because the items endpoint already took a batch for
the suggestions flow. Standing on a day when you add to three, two of them land
where you cannot see them, so that is the one case the add sheet says anything
afterwards. And the trip feed distinguishes the two: the same title on as many
distinct days as there are rows is logged as "added Instant noodles on 3 days"
rather than as three unrelated things.

*Twice in one day* needs nothing new. On Eat the category **is** the meal, so
noodles at lunch and noodles at dinner are already two rows, which is right —
they are two meals somebody has to bring enough for. On Plan, `time` separates
them.

Reading by day is a **strip at the top of the page**, on Eat and Plan: `All` at
the left-hand end where the thumb starts, then one tab per day of the trip,
weekday over date the way every calendar draws it. It is a filter — press Sunday
and the page *is* Sunday.

It spent a while in the sticky header, on the argument that "what about Sunday"
is asked halfway down a list rather than at the top of one. That was wrong twice
over. The header is the one part of the screen that only ever says which trip you
are on, and a control in it reads as part of the app rather than part of the
list. And the page already had a row of chips doing exactly this job, so the list
was narrowing itself from two places at once, one of them out of reach of the
other. Down here the day is simply the first and widest of three narrowings —
which day, then find one thing, then who is bringing it — and it scrolls away
with them, which is the same argument the chips themselves won when they came out
of the header. A list with nothing on it gets none of the three: there is no day
of the trip on which nothing is still nothing.

There is one box in the row and it is the answer. Every tab carried the same
outline at first, which made five rectangles competing for a row that is really
one line of text with one thing chosen in it, and an outline that never varies
says nothing worth the ink. The days are text, the pressed one is filled — in the
same forest a pressed chip is filled, because on the page the two rows are one
control in two halves and should not answer differently — and the tap target is
unchanged because it was the padding carrying it and not the border.

What the strip did need on the page and had not needed on the dark is a
**surface**. Everything else here is paper on the canvas — the search box, `Fold
all`, the chips, the rows themselves — so days drawn straight onto the canvas
read as stray text rather than as buttons, and the row had no floor under it. It
gets one track, in the same paper and behind the same hairline as the search box
directly beneath it, and the two stack as siblings. The track is the object; the
days in it stay text until one is pressed.

A row that scrolls sideways does not say so standing still, so it **fades out at
the end it can still be pushed towards**. Two rows on the page do this — the days
and the chips under them — and the whole trick is that both ends are measured
rather than assumed. A fade that is always on fades the first day when there is
nothing to the left of it, and fades both ends of a weekend that fits on the
screen whole; it has to appear only where there is somewhere to go, or it reads
as a smudge rather than as an invitation. So `edges()` asks each row how much of
it is off-screen and which side, after every render, on every scroll, and when
the window changes shape — a row that fitted in portrait scrolls in landscape
without anybody touching it. Scroll events do not bubble, so that listener
captures, which is how the one already watching for the place-search box hears
about them too.

It is a mask rather than a gradient laid over the top, because one of these rows
sits on paper and the other on the canvas and a mask does not need to know which.
That is also why the strip is two elements: the track holds the paper, the
hairline and the corners, and the row inside it scrolls and fades, because a mask
over the track would have taken the hairline and the corners with it.

Today gets a dot under the date on a trip that is happening now — the dot
is drawn on every day and coloured in on one, so today does not sit two pixels
higher than the days either side of it.

The dot is the only thing on the page that changes without anybody touching it,
so the day is **held rather than read**: one `todayIso`, so a render straddling
midnight cannot mark two days as today or none, and something has to notice when
it turns. Two things do. A timer aimed at the next local midnight — asked for as
hour 24 of today, which is still midnight on the nights the clocks move, and
rescheduled from the clock each time so a late wake-up costs nothing. And a check
whenever the tab comes back, because a sleeping phone runs no timers, which is
where the day actually turns most of the time. Somebody typing is left alone the
way the poll leaves them alone; the day is written down before the page is asked
to redraw, so the next thing they do shows the new one. This also fixes something
older than days: "2 days to go" on a trip card had always been wrong by one from
midnight until whenever you next touched it.

That is where the question lands now. Press Sunday and either the food is there,
or the page says **Nothing on Sun 6 Sep** and offers to add something to that day.
`All` is the way back out, so nothing here toggles itself off.

Under it is the other question days create: **`No day`**, which is what nobody
has answered for — not what is for the whole trip, which has been answered and
turns up under every day. It is a **filter chip**, not a stop on the strip. It
was a stop on the strip first, and the strip was worse for it: the strip is the
trip's calendar, every other thing on it is a date, and "no day" is precisely
what a calendar cannot hold. It is a cut — the same shape as hiding what is
sorted — so it lives with the cuts, first in the row because it is the tail of
the question directly above it, and carrying a quiet count of how many are still
waiting.

Being a chip does not make it a fourth thing you can stack on a day, though. A
day and no day cannot both be true, so the two are exclusive: pressing `No day`
lets every day go, and pressing a day lets `No day` go. It is still not a new
meaning for `All`, either, because `All` has a second job — it is the escape
hatch, so a pressed day always has one tap out of it, and a filter that stayed on
across a pressed day would take that away. The wording matters too: `All` beside
`Any day` reads as two words for the same thing, so the chip is called what it
is, while the sheets keep `Any day` because there it is an answer to "which
day?" rather than a cut.

`No day` waits until the tab holds both kinds — a control that would show the
whole list and one that would show none of it are both a control that does
nothing, the same rule the search box and the hide-settled chip keep — which also
means it lets go of itself once the last thing has been slotted, and anybody
standing on it lands back on `All` rather than on an empty page. Standing there
is saying the opposite of standing on a day, so the rows under it are still asked
for one, and the add sheet arrives with nothing picked instead of with a word in
the field that is not a date.

The rest of the page answers to it. The search box appears over eight things or
more, and that count is now what the day leaves rather than what the tab holds —
a box over the one thing Thursday has on it asks you to narrow what a tap has
already narrowed. The exception is the box itself: whatever is typed in it keeps
it on screen, or searching down to two results would delete the field mid-word.

**No list is filed by day.** The headings stay what they always were — the meal
on Eat, the kind of thing on Plan — and the strip does the day axis on its own.
Four attempts are worth recording, because each looked reasonable written down
and each one put the day in two places at once:

1. **The day in the Eat headings** — "Sat 5 · Dinner". Eat is filed by meal and
   always has been, and most of what is on it is not any particular day's, so
   five headings became fifteen with "Dinner" among them five times, while empty
   day-slots claimed a gap with five undated dinners sitting underneath them.
2. **A days × meals coverage grid** over the list. Honest, but too much apparatus
   for the answer: a nine-cell table to say what pressing a day says on its own.
3. **A heading per day of the trip on Plan**, on the argument that an itinerary
   *is* a list of days. On a ten-day trip with one plan on it that is ten
   headings saying *nothing yet* and one saying anything at all.
4. **A heading per day that has something.** Better, but the page then
   reorganises itself under you as things get dated, and — the real objection —
   the strip is a few pixels above it. A heading reading "Sat 15 Aug" under a
   pressed tab reading Sat 15 is the page repeating itself, and *All* is not much
   better: those headings are the strip again, printed down the page.

The accordion answers a different question — what kind of thing is this — and
that question has one answer all week. So what the days actually do to the Plan
tab is the **order**: inside a heading, the list reads in the order it happens.
Day, then hour, then whatever order the list already had. No hour follows the
hours of its own day, because "sometime on Saturday" belongs to Saturday and not
to nine in the morning, and no day at all goes last, where it is still a plan.

Setting a day is a sheet of its own, the way a plan's place is, because when is a
different question from who is bringing it. Day pills apply on the tap and the
sheet stays open; food is also asked which meal (which writes `category`, since
that is already the meal), and a plan gets an hour to type. Those two together
cost a bug worth remembering: a pill saves, the save re-renders, and the re-render
rebuilt the time field from an item with no time on it — so typing an hour,
pressing a day and then *Save the time* saved nothing and said "Time removed".
`renderSheet` now carries anything typed but unsaved across the swap, along with
the cursor. A field whose value still matches the `value` attribute the template
wrote is the item's and takes the fresh one; a field that differs is yours.

The pills wrap rather than dividing the width between them — a trip is as often
one night as a fortnight, and a control that shares the row out looks wrong at
one of those ends. The Pack tab never asks — you pack the tent once, not on
Saturday — and none of it is drawn at all until the trip has a `start_date`,
since a strip with no days in it is worse than no strip.

Since no heading says the day, the row does: a dated row carries a chip reading
"Fri 14 · 08:15", and the My kit tab flattens the lists so its rows carry it too —
Saturday's dinner is a different armful of the car from Friday's. Press a day and
the chip drops back to the hour, because the pressed tab has already said the
rest. Eat's headings sort Breakfast, Lunch, Dinner rather than by whatever was
added first; everything that is not a meal keeps the order it had, after them.

### Dietary needs

A `diet` line on `members`, 200 characters, and `PATCH
/api/trips/:id/members/:mid` to set it. Unlike personal kit it is shared on
purpose: the entire value of writing it down is that whoever ends up cooking
finds out without going round the table one at a time.

Anybody on the trip can fill in anybody's, because the person who knows about the
nut allergy is as often whoever booked the pitch as whoever has it — so the feed
names the author when the line is not their own. It shows in the two places the
question is live: at the head of the Eat list, and inside the sheet for a food or
drink item, where somebody is deciding whether to take Saturday dinner on. The
way to fill it in sits beside the person it is about, on the Trip tab, and the
prompt is on every row whether or not it has been answered — otherwise the field
is only findable by the people who need it least.

### Going home

A trip faces one of two ways. `going_home` on `trips` is the switch, flipped by
whoever notices it is over and flippable back, because a pack-down that carries
on into Monday is a normal trip. It is offered rather than turned on for you —
only the people standing in the field know when they have started packing up —
and only once the trip is under way at all, since "is this back in the car?" is a
nonsense question on a Tuesday three weeks out.

The ticks go in `stows`, one row per person per item, the same shape as
`own_checks`. A second set rather than a reuse of `packed`: "I packed the stove
on Friday" and "the stove is in the boot on Sunday" are different facts, and
clearing Friday's answer to record Sunday's would throw away the only record of
who brought what. A group thing is back once *everybody* who carried a piece of
it says so; a personal item's stows are cut to the viewer exactly as its packing
ticks are, for the same reason.

On the way home the My kit tab keeps its shape and changes its question — the tick
stays in the same place with the same tap, and only the answer it records moves.
There is no claiming step left: by Sunday, whoever brought a thing is whoever has
to find it again. The Trip card counts what is still out there and who it is
waiting on. It says out loud that other people's personal kit is not in that
number, rather than quietly reporting a figure that is only most of the answer.
None of it reaches the activity feed: a pack-down is fifty ticks in ten minutes,
and a feed of them would bury the trip they belong to.

### Installing it

`manifest.webmanifest` and `public/sw.js` are what make it an app you can add
to a home screen: full-screen, its own icon, its own splash, and no browser
chrome eating the top of a phone. The two dark headers pay for that with
`env(safe-area-inset-top)`, since a standalone window owns the clock's row too.

The worker is stamped at boot by the same hashing that stamps `index.html`, so
what it keeps offline is byte-for-byte the build the page asked for, and a
deploy changes its bytes — which is what tells a browser a new worker exists at
an unchanged path. Three caches, three lifetimes:

| Cache   | Holds                              | Strategy                          |
| ------- | ---------------------------------- | --------------------------------- |
| `shell` | `/`, hashed `app.js` / `styles.css`| Cache first; dropped every deploy. |
| `data`  | `GET /api/catalog`, trip state, the forecast | Network first, cache as fallback. |
| `fonts` | Google Fonts                       | Cache first; outlives deploys.     |

What is deliberately *not* cached: the `rev` counter, because a cached answer
to "has anything changed?" is a lie; and every write, because a claim replayed
an hour later is a worse lie — somebody else has bought the firewood by then.
Offline, a write fails and says so. Trip state responses carry
`Vary: x-member-id, x-user-id`, which the Cache API honours, so a signed-out
request cannot be handed private state cached for the previous user. The home page's summary is a POST,
which no cache can key, so the last one is kept in `localStorage` instead.

The forecast is the one kept answer that goes off on its own, so it carries the
time it was fetched and the card says how old it is. Last night's outlook is
worth reading in a field with no bars; last night's outlook presented as this
morning's would not be.

Regenerate the icons with `npm run icons` after changing the mark or the
colours — it draws the same tent as the favicon straight into PNG.

### Auth

Trip links remain readable without an account. Creating a trip, joining one and
changing it require a membership: Google proves the user, then Camping Sync
keeps its own 60-day session in an `HttpOnly`, `SameSite=Lax` cookie. The Google
credential is verified on the server and is never stored; identities are keyed
by Google's stable subject rather than by an email address.

Members created before accounts have a null `user_id`. They continue to work on
the device that already remembers them. The first Google sign-in sends that
device's remembered trip/member pairs and attaches each still-unclaimed row to
the account, after which the public member id no longer authenticates it. This
is necessarily a one-time trust bridge: the old app had no stronger credential
to migrate.

Create an OAuth web client in Google Cloud, add the app's origins (for local
development, usually `http://localhost:3000`) and set `GOOGLE_CLIENT_ID` in the
ignored `.env.local` file. Production gets the same variable from Railway. No
client secret is used by the Google Identity Services ID-token flow.

For local or LAN testing without Google, set `DEV_AUTH_BYPASS=1` in `.env.local`
and use **Continue as developer**. The bypass is opt-in and is ignored whenever
`NODE_ENV=production`.

## Configuration

| Variable           | Default             | Notes                                      |
| ------------------ | ------------------- | ------------------------------------------ |
| `PORT`             | `3000`              | Set by Railway automatically.              |
| `DB_PATH`          | `./data/camping.db` | Point at a mounted volume in prod.         |
| `GOOGLE_CLIENT_ID` | empty               | OAuth web client id; required for sign-in. |
| `DEV_AUTH_BYPASS`  | `0`                 | Set to `1` for development-only sign-in.   |
| `OPENAI_API_KEY`   | empty               | Enables `@camp`; keep it server-side.       |
| `OPENAI_MODEL`     | `gpt-5.6-luna`      | Responses API model used by `@camp`.        |
| `VAPID_PUBLIC_KEY` | generated in DB     | Optional fixed Web Push application key.    |
| `VAPID_PRIVATE_KEY`| generated in DB     | Pair with `VAPID_PUBLIC_KEY`; keep secret.   |
| `VAPID_SUBJECT`    | app notification email | Web Push contact URI (`mailto:` or URL).  |

## Deploying

Live at **https://camping-sync.up.railway.app**.

Runs anywhere that runs Node 22.5+. This directory is already linked to the
Railway project, so shipping a change is:

```bash
railway up
```

The Railway service has a 5 GB volume mounted at `/data` and `DB_PATH` pointing
inside it. **Keep it that way** — without a volume, every deploy wipes the
database and everyone's trip disappears.
