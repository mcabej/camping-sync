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
- **Camp smarts** — 15 things first-timers find out the hard way.
- **Live sync** — clients poll a revision counter every 5s and refetch on change.
- **Activity feed** — who added, claimed, packed or dropped what.

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
