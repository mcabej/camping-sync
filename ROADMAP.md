# Where this could go

Two lists. The first is features that would make the app more useful to a group
planning a trip, worst-first by what they cost against what they're worth. The
second is what else this shape of app is good for, because almost none of what
makes it work is about camping.

Nothing here is a commitment. It is written down so that the next person to open
the repo — including a later me — does not have to rederive it. Each numbered
feature has an issue; the numbers below are the order of the argument, not the
issue numbers.

## Features

### 1. Money: who paid, what it cost, who owes who

The biggest hole. The app already knows the one thing a bill-splitter has to ask
for: who claimed what. Put `cost` on the `claims` row and net it down to "Sam
owes Alex £12" on the Camp tab. Firewood, the pitch fee, the big shop — every
trip ends in an awkward group-chat thread about this, and closing it here means
nobody opens a second app. *Camp smarts already tells people to sort this before
they go; this is the app taking its own advice.*

Touches: `claims`, a settle-up panel, possibly `paid_by` for the person who put
the card in when somebody else carried the thing.

### 2. Days

`trips` has `start_date` and `end_date`, and a plan can say where it happens but
not when. A `day` on an item turns the Plan tab into an itinerary and — the part
that matters more — turns the Eat list from a pile of food into meals. "Have we
actually got Sunday lunch covered?" is a question the app cannot currently
answer.

Touches: `items.day`, the Plan tab, the Eat tab's categories.

### 3. Headcount that drives quantities

`qty` is free text, so nobody trusts it. Let a member say who they are bringing
— a partner, two kids, a dog — and give catalogue entries a per-person rate.
Then "12 L of water" is computed, and it recomputes when the eleventh person
joins. It also fixes the coverage bar, which today cannot tell four sleeping bags
from nine people.

Touches: `members`, `lib/catalog.js` rates, `statsFor`.

### 4. Weather — **built**

`lat`/`lon` and the dates were already there, and `/api/places` was already the
pattern for a server-side proxy with a cache. Open-Meteo is free and keyless, so
this is nearly a copy of code the repo already had. The forecast is on the Camp
tab, and what it means for the packing list is offered as one-tap adds.

See the README's *Weather* section.

### 5. Clone the last trip

The same six people go camping every August and rebuild the list from scratch
each time. "Start from a previous trip" copies the items and their kinds and
drops the claims. Trivial, given one `items` table — and it is the strongest
reason anyone has to come back a second year.

### 6. Reminders

The service worker is already registered, so Web Push is a short step. Three
days out: "4 things nobody has claimed." The morning of: "you haven't ticked your
sleeping bag." A planner that nudges gets used; one that doesn't gets filled in
once and forgotten.

Caveat worth respecting: this app has no accounts, so a push subscription is the
first thing it would store that outlives a `localStorage` wipe.

### 7. Dietary needs and allergies — **built**

One field per person, shown where food is being claimed rather than buried on a
settings page. Small, and it prevents a specific bad day.

See the README's *Dietary needs* section.

### 8. Getting there, together

Who is driving, how many spare seats, when they leave, where they would pick up.
Lifts are the second thing a group chat argues about after money. The coordinates
are already on the trip, so a pick-up point is the same search box again.

### 9. Picking the dates in the first place

Today a trip starts with its dates already settled, which means the hardest bit
of coordination happens somewhere else — usually a thread nobody can read back.
A when2meet-style grid over candidate weekends would pull the app one step
earlier into the process, and `votes` is already the primitive for it.

### 10. The pack-down list — **built**

Flip the question on the way home so nothing is left in the grass. Cheap, and
nothing else does it.

See the README's *Going home* section.

### Smaller ones

- **Duplicate detection.** Two people both add "firewood"; offer a merge rather
  than a second row.
- **A safety card.** Nearest A&E, what3words, the gate code — structured fields
  rather than prose in `notes`, cached so it survives no signal, which is
  exactly when it matters.
- **Offline writes.** The README argues, correctly, that a replayed claim is a
  lie — somebody else has bought the firewood by then. But "no bars at the
  campsite" is this app's home turf, and a claim that fails there is the failure
  people will remember. An outbox with idempotency keys and a visible "3 changes
  waiting to send" would avoid the lie, because the queue is on screen. Worth
  reconsidering, not worth doing carelessly.

## Other verticals

The camping-specific part of this repo is small: `lib/catalog.js`, `TIPS`, four
list ids, and a handful of labels in `public/app.js`. Everything that makes the
app worth using is domain-neutral — one link and no accounts, claim what you are
bringing, orange until somebody covers it, group things kept apart from the ones
you each need your own of, offline-first, coverage arithmetic. So the move is a
trip *type* chosen at creation that swaps the catalogue and the vocabulary. Not
a fork.

### Near neighbours — a new catalogue and little else

- **Festivals.** The same trip with worse weather and a different gear list.
  Probably a larger audience than camping. The obvious second vertical, because
  it validates the type-swap at almost no content cost.
- **Hen and stag weekends, wedding-adjacent group trips.** Larger groups, less
  organised, higher willingness to pay — and the two features that matter most
  here are money (1) and voting on plans, both of which are already on the list.
- **Ski trips, chalets, villa and holiday-let shares.** Who is cooking which
  night, and one big shared bill.
- **Hiking and backpacking**, with one twist worth building: weight. Grams on an
  item turns the coverage view into a pack-weight view, which is a different and
  much-wanted tool.
- **Potlucks, BBQs, Christmas dinner, dinner parties.** "Who's bringing what" in
  its purest form, and the most viral: one use, no setup, shared by link into a
  family chat. A cut-down mode rather than a whole trip.

### Further out, but real

- **Scouts, DofE, school and church trips.** A leader issues a kit list;
  participants or parents tick it off; the leader watches coverage. The
  `shared` / `own` split already models exactly this, and the safety card lands
  hardest here. But under-18s change the calculus: "anyone with the link can
  read and write" stops being an acceptable trade, so this is the vertical that
  forces real auth. Do not walk into it by accident.
- **Sports clubs and away days.** Kit, carpools, a fixture schedule.
- **Bands on tour, film and photo shoots.** Load-in lists, per-person gear, call
  times by day — which is feature 2 with different words on it.
- **Volunteer work parties, beach cleans, community gardens.** Tools claimed by
  whoever owns one, no accounts, patchy signal. A very good fit.
- **Emergency preparedness and go-bags.** A curated catalogue where each entry
  explains why it is there is precisely what `TIPS` and the note-per-item
  already do well.
- **Overlanding and van life, bikepacking, fishing and hunting trips.** Small,
  passionate, catalogue-driven audiences.
