# Camping Sync

A shared trip planner for camping with friends. One link, no accounts. Everyone
claims what they're bringing, and whatever nobody has picked up stays orange
until somebody fixes that.

## What it does

- **Pack / Eat / Drink / Do** — four shared lists, grouped by category.
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
- **The Camp tab** — the whole trip on one screen: days to go, all four lists
  reporting their coverage at once (tap one to go there), the notes everyone
  needs (gate code, meeting point) shown as text rather than buried in a form,
  and who has packed what of what they claimed.
- **Getting there** — where the trip is, in **one** field, holding the real
  place rather than a nickname for it. Headers and cards show what comes before
  the first comma; the card shows the lot, with one tap to turn-by-turn. Paste a
  map pin and that wins over everything, because a lot of campsites sit down an
  unnamed track.
- **Place search** — the *Where* box looks places up as you type, finishes the
  name for you the way a browser's address bar does, and drops the rest under
  the cursor (see below). Take one and the coordinates come with it, so the map
  link is a pin rather than a hopeful search; type whatever you like when you
  don't know yet, because "somewhere with a lake" is a real answer in March.
- **Plans have places** — a plan can say where it happens, which is usually the
  location that matters: nobody needs directions to the tent they are sleeping
  in, and "the sunset spot" means nothing to whoever has not been there. The
  chip on the row opens the same search box, with the map link behind it.
- **Camp smarts** — 15 things first-timers find out the hard way.
- **Live sync** — clients poll a revision counter every 5s and refetch on change.
- **Activity feed** — who added, claimed, packed or dropped what.
- **Installs, and works without a signal** — add it to a home screen and it
  opens full-screen showing the last state the server sent, which is the state
  that matters once you are at the campsite and the bars have gone.

## Running it locally

```bash
npm install
npm start          # http://localhost:3000
```

`npm run dev` restarts on file changes.

## How it's built

No build step, no framework. Node's built-in `node:sqlite` for storage and
Express for routing; the frontend is three static files.

```
server.js          REST API + static hosting
lib/db.js          schema, queries, trip codes
lib/catalog.js     the camping knowledge (gear, food, drinks, plans, tips)
public/            index.html, styles.css, app.js
public/            sw.js, manifest.webmanifest, icons/  — the installable part
scripts/           make-icons.mjs (regenerates public/icons)
```

### Data model

One `items` table with a `list` discriminator (`gear` / `food` / `drinks` /
`activities`), plus `trips`, `members`, `votes` and `events`. Each trip carries
a `rev` counter bumped on every write — that's what the clients poll.

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

Items carry the same trio as a trip — `place`, `lat`, `lon` — filled in by the
same search. Only plans offer it in the UI, since a place on a bag of sausages
answers a question nobody asked, but the columns are on every item.

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
| `data`  | `GET /api/catalog`, trip state     | Network first, cache as fallback.  |
| `fonts` | Google Fonts                       | Cache first; outlives deploys.     |

What is deliberately *not* cached: the `rev` counter, because a cached answer
to "has anything changed?" is a lie; and every write, because a claim replayed
an hour later is a worse lie — somebody else has bought the firewood by then.
Offline, a write fails and says so. Trip state responses carry
`Vary: x-member-id`, which the Cache API honours, so a shared phone can never
be handed the copy cut for the other member. The home page's summary is a POST,
which no cache can key, so the last one is kept in `localStorage` instead.

Regenerate the icons with `npm run icons` after changing the mark or the
colours — it draws the same tent as the favicon straight into PNG.

### Auth

There isn't any. A trip code (`cedar-ridge-284`) is the capability: anyone with
the link can read and write. Your identity is a member row, remembered in
`localStorage` per trip. That's the right trade-off for four friends and a
weekend — it is not the right trade-off for anything sensitive.

## Configuration

| Variable  | Default             | Notes                                  |
| --------- | ------------------- | -------------------------------------- |
| `PORT`    | `3000`              | Set by Railway automatically.          |
| `DB_PATH` | `./data/camping.db` | Point at a mounted volume in prod.     |

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
