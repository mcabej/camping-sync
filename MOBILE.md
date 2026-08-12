# Camping Sync on a phone, natively

A plan for a native mobile client, Android first, iOS after. Nothing here is
built yet. It is written so that whoever picks it up — including a later me —
does not have to rederive the analysis, and so that the decisions that are hard
to reverse are made before the first file is written rather than discovered in
month three.

---

## 0. The word "fork", and what it should actually mean

The ask was a "native mobile fork". Taken literally that is two products: two
databases, two ledgers, two sets of trip codes, and a group where Sam is on the
app and Alex is on the web can no longer camp together. That is not what anybody
wants from this app — the whole product is *one link, everyone on it*.

**So: fork the client, not the system.** One server, one SQLite file, one trip
code namespace, two clients that speak the same API. The web app keeps working
and stays the front door for a link forwarded into a group chat; the native app
is what people who camp twice a year install and keep.

Everything below assumes that. Section 5 lists the server changes this needs,
all of which are additive and none of which break the existing web client.

If a genuinely separate product is wanted later (a different vertical from
`ROADMAP.md` — festivals, potlucks), that is a *trip type* on the same server,
which is the argument the roadmap already makes. It is not a reason to fork now.

---

## 1. What exists today

### 1.1 Shape

No build step, no framework. Node 22 `node:sqlite` + Express + `ws`, and three
static files. ~10k lines of application code, extremely heavily commented — the
comments are load-bearing design rationale, not noise, and the port should carry
the reasoning across even where the code cannot be.

```
server.js          2.4k  REST + WebSocket delivery + static hosting + Camp assistant
lib/db.js          650   schema, migrations, getTripState, trip codes
lib/catalog.js     290   ~90 catalogue entries, 14 tips, 5 weather-advice rules
lib/reminders.js   215   the two nudges, their lease and their idempotency
lib/{fields,items,money}.js   validation / insert / ledger, newly extracted (uncommitted)
public/app.js      7.3k  the entire client: state, render, actions, sync, sheets
public/styles.css  2.4k  two palettes, every colour a token
public/sw.js       170   three caches, three lifetimes
```

### 1.2 Data model (what the mobile client must understand)

| Table | Notes that matter for a native client |
| --- | --- |
| `trips` | `id` is a readable code (`pine-ridge-402`). `rev` counter is the poll target. `currency`, `going_home`, `lat`/`lon`, `map_url`. |
| `users` | Google identity. Carries `remind_lead` / `remind_morning` — account-level, not per device. |
| `auth_identities` | `(provider, subject)` → user. **Already generic over provider** — this is what makes Sign in with Apple cheap later (§8). |
| `sessions` | Only the SHA-256 of the token is stored. 60 days. This is the table a bearer token will reuse. |
| `members` | A person *on one trip*: trip-local name, `hue` (0-7), `diet`. `user_id` links to an account; `legacy_claimable` is the pre-accounts migration bridge. |
| `items` | One table, `list` discriminator (`gear`/`food`/`drinks`/`activities`). `kind` is `shared` or `own`; `own` + `owner_id` means **private to that member and invisible to everyone else, row and all**. `day` is an ISO date, `''`, or `'any'`. `time` is `HH:MM`. `place`/`lat`/`lon`. |
| `claims` | `(item_id, member_id, packed)` — a *set*. Several people can bring parts of one thing, each with their own packed tick. |
| `own_checks`, `stows`, `votes` | Three more per-person tick sets. `stows` is the going-home question, deliberately separate from `packed`. |
| `expenses`, `expense_participants`, `payments` | Integer minor units. Equal or custom split. Payments net in rather than ticking a line off. `payments.client_id` is an idempotency key. |
| `messages` | Durable thread, own increasing cursor, `role` of `member`/`assistant`, `(trip_id, client_id)` unique — idempotency key. |
| `push_subscriptions`, `notification_preferences`, `reminders_sent` | Web Push endpoint + keys; mute/read position keyed on *member* (device-independent, so it ports cleanly); reminder dedup keyed on the day the nudge is *about*. |

### 1.3 The behavioural contracts

These are the rules the product is made of. **A native client that breaks any of
them is a bug, not a platform difference.**

1. **Blaze orange means exactly one thing**: nobody has picked this up. It is
   never decoration, never a brand accent, never an error colour.
2. **Personal kit is private.** `getTripState` filters `own` rows to the viewer.
   Own ticks never reach the activity feed. A local cache must be keyed by user
   so a signed-out or second account can never read the previous one's state.
3. **Two labelled steps**: who is bringing it, then is it packed. The packed
   toggle does not exist until somebody has claimed the thing.
4. **Anybody can act for anybody**, except: your vote, your packed tick, your
   own-kit tick, your stow. Claims, expenses, payments, diets and removals are
   the group's business by design.
5. **Faces and the ledger wait behind membership.** A forwarded link reads the
   lists and the names; it does not get photographs or money.
6. **Writes are never replayed.** The service worker refuses to cache them: a
   claim that lands an hour late is a lie about who is bringing the tent. Any
   offline outbox has to answer this (§10).
7. **`rev` is never cached.** A cached answer to "has anything changed?" is a lie.
8. **A day and "no day" are different from "any day".** Three states, and the
   Eat and Plan tabs read the third one differently.
9. **One row, one day.** Noodles on three nights is three rows, because
   everything the app counts hangs off a row.
10. **Two reminders and no more than two.** A notification switch is only ever
    turned off once.
11. **Feature switches are the device's**; reminders are the account's; muting is
    the member's, asked in the room it belongs to.

### 1.4 Screen inventory (the port's scope)

**Outside a trip**
- Landing: hero + demo coverage bar, your trips (each with a coverage bar, a
  when-badge, member count), join-by-code, create trip, sign-in, settings door.
- Join: name entry; name-clash resolution — "are you them?" vs "tell you apart".
- Settings: account (sign in/out, name, picture), theme (light/dark/system),
  notifications (device switch + the two reminder switches), five feature
  switches.

**Inside a trip — five destinations**
- **Pack** (`gear`), **Eat** (`food`+`drinks`), **Plan** (`activities`): day
  strip (Eat/Plan only, only once the trip has dates), search box (appears at 8+
  visible items), filter chips (`No day`, kind, category, hide-settled),
  category accordions with per-group tallies and fold-all, item rows with tick
  box / face stack / place chip / when chip / qty / note, the two footer doors
  (add your own, "What am I missing?").
- **My kit**: every list flattened to what *you* are carrying, grouped by source
  tab, one tick each; flips its question when the trip is going home.
- **Trip**: status card (countdown, "N things still need someone" + the worst
  list, five coverage rows including your own load), Planning Room door with
  last-message preview and unread count, going-home card, when/where card (dates
  + place search + map link + copy), notes, weather (forecast rows, advice,
  one-tap adds), who's coming (faces, diet prompts, per-person load, remove,
  invite), Settle up door, recent changes feed, Camp smarts.

**Nested pages**
- **Planning Room**: paginated thread, member and assistant messages, streaming
  `@camp` replies, `@camp` mention completion, connection status, bell
  (subscribe/mute), read-position sync.
- **Settle up**: totals, netted transfers with "Mark paid", Paid back list with
  Undo, expense list, expense sheet (payer, participants, equal/custom split),
  payment sheet, currency picker.

**Sheets** (12): item, edit, place, when, diet, expense, payment, currency, add,
suggest, plus the two ask-dialogs (confirm, copy).

### 1.5 Design language

- **Type**: Bricolage Grotesque 600/800 (display), IBM Plex Sans 400/500/600
  (body), IBM Plex Mono 500/600 (numbers, codes, eyebrows). All three are OFL —
  they can be bundled into an app binary.
- **Colour**: every value is a token in `:root`, re-answered by
  `[data-theme="dark"]`. Dark is *not* an inversion: green-black canvas, lifted
  blaze, lifted person colours, and the header/tab bar stay dark green in both.
  Alpha-carrying families keep their channels in `--*-rgb` tokens.
- **Person colour** (`--m0`…`--m7`) is identity: the same colour is that
  person's coverage segment, their tick and their face ring.
- **Texture**: a ripstop diagonal on the forest hero. One of the two things a
  design critique in `.impeccable/` flagged as an AI tell; keep it, but do not
  spread it.
- **Radii** 6/10/16, tab bar 62px, safe-area padding on both dark headers.

### 1.6 Known defects worth fixing *in the port*

From `.impeccable/critique/`:
- **P1** `--ink-faint` (`#909D95`, recently lifted) against `--paper-lift` on
  dark was measured at 4.40:1 — under AA for the 9.5–13px metadata it is spent
  on. Re-measure every small-text pair in the token port and fix at the source.
- **P1** Control density: five tabs, then a day rail, then search, then chips,
  then folds. On a phone in a field this is a cockpit before a plan. Native
  gives a real lever here — progressive disclosure of the filter row behind an
  intent, and platform-native search — that CSS never did.

---

## 2. Framework: React Native (Expo), and why

**Recommendation: React Native with Expo (dev client + prebuild + EAS), New
Architecture, TypeScript.** Not because it is the default answer, but because of
one specific fact about this codebase.

### 2.1 The deciding argument

A large fraction of `public/app.js` is not UI. It is pure, framework-free domain
logic that both clients need to agree on to the penny and to the pixel:

| Logic | Where | Why it must not be rewritten twice |
| --- | --- | --- |
| `settlement()` | app.js ~1250 **and** `lib/money.js` | Already written twice, deliberately, with a comment saying "if either changes, both change". A third copy in Kotlin is a third place for the pennies to disagree. |
| `statsFor`, `barParts`, `loadParts`, `myLoad` | app.js | The coverage bar is the product's signature. |
| `tripDays`, `dayFull/dayShort`, `byDayTime`, `mealRank`, `onDay`, `allWeek` | app.js | The three-state day model is subtle and heavily argued in the README. |
| `matchesFilter`, `groupByCategory`, `pageGroups`, `isSettled` | app.js | List semantics. |
| `catalogEntry`, `WEATHER_ADVICE` | `lib/catalog.js` | Shared with the server already. |

Choosing TypeScript for mobile means this becomes **one package imported by
three consumers** (server, web, mobile) instead of two implementations that
drift. Choosing Kotlin or Dart means writing it a third time and testing it a
third time. For an app whose whole value is arithmetic everyone trusts, that is
decisive.

### 2.2 The honest counter-arguments

- **Compose (native Kotlin) or Compose Multiplatform** would give the best
  Android feel per unit of effort, real predictive-back and edge-to-edge for
  free, and no bridge. It costs the shared domain package and, for iOS, either a
  second app or a less mature CMP iOS story.
- **Flutter** gives one codebase and excellent list performance, and shares
  nothing with this repo. Dart is a third language in a two-language project.
- **A PWA wrapped in a WebView** would be cheapest and is the wrong answer:
  Play's stance on trivial wrappers, no real push, no Credential Manager, and
  the app would be the thing this plan exists to stop being.

RN's weaknesses are known and manageable here: long-list performance (solved by
FlashList and by *not* re-rendering the world on every mutation — see §4.3),
binary size (~15–20 MB with fonts, fine), and startup (Hermes + the New
Architecture; budget in §12).

### 2.3 The stack

| Concern | Choice | Note |
| --- | --- | --- |
| Runtime | Expo SDK (latest stable), RN New Architecture, Hermes | `expo prebuild` with committed native dirs once native modules stabilise |
| Language | TypeScript, `strict: true` | The server can stay JS; the shared package is TS with JS-compatible output |
| Navigation | React Navigation (native stack + bottom tabs) | Expo Router is fine too; native stack either way for real Android transitions |
| Data | TanStack Query + MMKV persister | Fits the "every mutation returns whole trip state" API exactly (§4.2) |
| Lists | FlashList | Packing lists and the 90-item catalogue |
| Sheets | `@gorhom/bottom-sheet` | The app is sheet-driven; these must be real bottom sheets with drag, not modals |
| Auth | `@react-native-google-signin/google-signin` (Credential Manager) | Returns an ID token audienced to the **web** client ID via `serverClientId`, so `GOOGLE_CLIENT_ID` verification on the server is unchanged |
| Secrets | `expo-secure-store` (Keystore / Keychain) | The session token, and nothing else |
| Push | `expo-notifications` → FCM v1 (Android), APNs (iOS) | §5.2 |
| Storage | MMKV (prefs, cache), SQLite only if the outbox grows teeth | Start with MMKV |
| Errors | Sentry | Plus a breadcrumb on every mutation |
| Tests | Jest + React Native Testing Library, Maestro for E2E | §13 |

---

## 3. Repository shape

Move to a workspace monorepo. The server and web app stay exactly where they
are; nothing about `railway up` changes.

```
camping-sync/
  server.js                  unchanged path — Railway's start command is untouched
  lib/                       server modules (fields, items, money, db, catalog, reminders)
  public/                    the existing web client, unchanged
  packages/
    core/                    NEW — the shared domain package (TS, zero deps)
      src/types.ts           TripState, Item, Member, Expense, Payment, Message…
      src/days.ts            tripDays, dayFull/Short, onDay, byDayTime, mealRank
      src/coverage.ts        statsFor, barParts, loadParts, myLoad
      src/settlement.ts      settlement() — the one true copy
      src/filters.ts         matchesFilter, groupByCategory, isSettled, pageGroups
      src/catalog.ts         re-export of lib/catalog data, typed
    api/                     NEW — typed client over the REST + WS API
      src/client.ts          fetch wrapper, auth transport, error shapes
      src/endpoints.ts       one function per route, typed both ways
      src/socket.ts          reconnect with bounded backoff + cursor fill
  apps/
    mobile/                  NEW — the React Native app
  docs/
    api.md                   NEW — the contract, written down for the first time
```

Two rules for this refactor:

1. **`packages/core` lands first, and the *web* app adopts it first.** Porting
   `settlement()` to TS and then proving the existing web client still passes
   `npm test` is how the package earns trust before a second client depends on
   it. `lib/money.js` then imports from it too, collapsing the deliberate
   duplication into a shared source with tests.
2. **No behaviour changes ride along.** The extraction is mechanical; every
   diff to `public/app.js` in that phase should be an import replacing a
   definition.

---

## 4. Mobile architecture

### 4.1 Layers

```
screens/          one file per destination, dumb-ish
components/       item row, coverage bar, face stack, chips, day strip, sheets
features/         trip, room, settle, settings — hooks + mutations per area
lib/query/        TanStack Query client, persister, key factory
lib/api/          from packages/api
lib/design/       tokens, typography, icons, motion, theme provider
lib/offline/      outbox, connectivity, conflict rules
```

### 4.2 State: the API's shape is a gift

Every mutation endpoint returns the entire `getTripState`. That is unusual and,
on a phone, a feature: it means there is exactly one cache entry per trip and no
normalisation layer to keep coherent.

- `['trip', tripId, userId]` → the whole state. Every mutation's response is
  written straight into it with `setQueryData`.
- `['trips', userId]` → home summary (`POST /api/trips/summary`).
- `['messages', tripId]` → infinite query on the message cursor.
- `['weather', wxKey]`, `['catalog']`, `['auth']`, `['notifications']`.

Optimistic updates for exactly four interactions, and no others: **claim,
packed, own-tick, stow, vote**. These are one-tap, high-frequency, and visibly
wrong if they lag. Everything else (edits, expenses, adds) uses the server's
returned state and a busy state, because they are already sheet-shaped and the
sheet has somewhere to show a spinner.

The cache key includes the user id. Signing out clears it. This is the native
equivalent of `Vary: Cookie, x-member-id, x-user-id` on the web, and it protects
contract 1.3.2.

### 4.3 Rendering

The web client re-renders the entire page as a string on every state change and
gets away with it. React Native will not. The rules:

- `FlashList` for every list over ~20 rows, with stable `keyExtractor` and
  `getItemType` split by row shape (item row vs group header).
- Item rows are `React.memo` with a hand-written comparator over the fields the
  row actually draws (title, qty, note, claims, day, place, ticked-for-me).
- Derived state (`pageGroups`, `statsFor`) memoised on `[items, filter, tab]`.
- Filter/search state lives in a store outside React Query, so typing in the
  search box never touches the trip cache.

### 4.4 Sync

The web client polls `/rev` every 5s. On a phone that is a battery and data
regression, and Doze will make it unreliable anyway. Replace with a ladder:

1. **WebSocket while the app is foregrounded and a trip is open.** The socket
   already carries `message.created` and the assistant events; §5.3 adds
   `trip.changed { rev }`. On receipt, refetch trip state once.
2. **Poll `/rev` at 15s** as a fallback when the socket is not connected (or
   when a proxy blocks upgrades). Foreground only.
3. **On foreground / on regaining connectivity**, always refetch once and
   reconnect immediately, exactly as the web client does on `visibilitychange`
   and `online`.
4. **Backgrounded, the app is silent.** Push is the only thing that reaches it,
   which is what push is for.

The socket carries presence (`room.presence`) already; keep sending it so the
server continues to skip push for people actively reading the room.

---

## 5. Server work

All additive, all backwards-compatible with the web client. This is the
critical path — the mobile app cannot sign in or receive a notification without
the first two.

### 5.1 Bearer sessions alongside cookies

Today: Google ID token → `sameOrigin(req)` check → `sessions` row → HttpOnly
cookie. A native app has no origin and no cookie jar worth the name.

- `sessionUser(req)` also reads `Authorization: Bearer <token>`, hashing it the
  same way against the same `sessions` table. One line of new surface, zero new
  storage.
- `POST /api/auth/google` accepts a native flow: when the request carries a
  bearer-intent flag (or simply has no `Origin`, with `sameOrigin` enforced only
  when `Origin` is present), it returns `{ token, expiresAt, ...authState }` in
  the body instead of setting a cookie. The `sameOrigin` guard stays for browser
  requests — it is CSRF defence, and bearer tokens are not CSRF-prone.
- Add `sessions.client` (`'web' | 'android' | 'ios'`) and `last_seen_at` so a
  future "sign out other devices" is possible. Not exposed in v1.
- Store the token in `expo-secure-store`. Never in MMKV, never in a log,
  never in a Sentry breadcrumb.
- The `x-member-id` header stays exactly what it is today: a public cache
  discriminator, not a credential. That must not drift.
- **Verify** that Google issues an ID token audienced to `GOOGLE_CLIENT_ID` when
  the Android client passes it as `serverClientId`. An Android OAuth client
  (package name + release and debug SHA-1) must be registered in the same GCP
  project even though the audience is the web client.

### 5.2 Push: a second transport

`push_subscriptions` is Web Push-shaped (`endpoint`, `p256dh`, `auth`) and
`sendPush()` speaks VAPID. Native needs FCM (Android) and APNs (iOS, via FCM or
directly).

- Generalise to `push_targets`: `(id, member_id, trip_id, transport, address,
  p256dh, auth, platform, created_at, updated_at)` where `transport` is
  `'webpush' | 'fcm'`. Migrate existing rows in as `webpush` — the boot
  migration pattern in `lib/db.js` is exactly this shape already.
- `sendPush(targets, payload, opts)` dispatches per transport. Same 30s timeout
  discipline (the reminder lease's correctness depends on `PUSH_TIMEOUT_MS <
  REMINDER_LEASE_MS`, and `server.js` refuses to boot otherwise — keep that
  check).
- `lib/reminders.js` queries `push_subscriptions` directly in two places
  (`remindableMembers`, `runReminders`). Both move to `push_targets`. The
  reminder decision logic itself is untouched, which is what
  `scripts/reminder-smoke.mjs` protects.
- The payload shape stays identical (`title`, `body`, `tag`, `url`, `tripId`),
  so the `url` field keeps being the deep link for both clients. Android maps
  `tag` onto a notification group; the two reminders and the room already use
  distinct tags.
- Android needs **notification channels**: "Planning room", "Trip reminders".
  Two channels, mapping onto the two things the app can say, so a user can
  silence one in system settings without silencing the other. This is Android's
  version of the "two switches" design and should be treated as first-class.
- 404/410 endpoint retirement (webpush) has an FCM equivalent
  (`UNREGISTERED` / `NOT_FOUND`) — same delete-the-row treatment.

### 5.3 `trip.changed` over the socket

`broadcastTripEvent` already exists and is already called for assistant events.
Add a `{ type: 'trip.changed', rev }` broadcast from `bumpRev()`'s call sites
(or from a wrapper around it — `bumpRev` is called from ~20 places, so wrapping
is the smaller diff). The web client can ignore it and keep polling; the mobile
client uses it to cut polling out entirely while foregrounded.

Note the standing `ponytail:` comments: fan-out is in-memory and assumes one
replica. Adding a mobile client raises connection count but does not change that
constraint. Flag it in the risk register (§17), do not solve it now.

### 5.4 Idempotency for the offline outbox

`messages` and `payments` carry `client_id` and handle retries correctly,
including the 409-on-mismatch case. Nothing else does. For an outbox to be safe
(§10) the same treatment is needed on the *creating* endpoints:

- `POST /api/trips/:id/items` — accept an optional `clientId` per item, unique
  per trip, so a replayed add does not duplicate a row.
- `POST /api/trips/:id/expenses` — same.
- Toggles (`/claim`, `/packed`, `/own`, `/stow`, `/vote`) are the hard case:
  they are *toggles*, so a replay flips back. Change them to accept an explicit
  desired state (`{ claimed: true }`, `{ voted: false }`) with the current
  toggle behaviour retained when the field is absent. That makes them idempotent
  by construction, which is better than an idempotency key for state a second
  person may have changed in the meantime.
- **Deliberately not queued offline at all**: claim and vote. See §10.

### 5.5 Deep-link association files

- `public/.well-known/assetlinks.json` (Android App Links) and
  `public/.well-known/apple-app-site-association` (iOS Universal Links).
- `express.static` runs before the `app.get('/{*path}', sendIndex)` catch-all,
  so files placed in `public/` are served correctly — but AASA must be served as
  `application/json` with no extension, which needs a small explicit route.
  Verify both with Google's and Apple's validators before shipping.
- A custom domain is worth buying before this: association files are tied to the
  host, and moving off `camping-sync.up.railway.app` later means re-verifying.

### 5.6 Written-down contract

`docs/api.md`: every route, its auth requirement, its request and response
shape, and its error bodies. This does not exist today and two clients cannot
share an undocumented API. Generate the types in `packages/api` from it (or
generate it from them — either direction, but one source).

---

## 6. Porting the design system

### 6.1 Tokens

`packages/core/src/tokens.ts` (or `apps/mobile/lib/design/tokens.ts` if the web
is not going to consume it) with the full two-palette set, transcribed literally
from `styles.css`. Rules:

- **Same names.** `canvas`, `paper`, `paperSunk`, `paperLift`, `ink`, `inkSoft`,
  `inkFaint`, `forest`, `forestDeep`, `forestInk`, `blaze`, `blazeSoft`,
  `blazeDeep`, `line`, `lineStrong`, `onForest`, `tint`, `bar`, `mint`,
  `m0`…`m7`. A reviewer must be able to diff the CSS against the TS.
- Alpha families keep the `rgb` split (`inkRgb`, `forestRgb`, `blazeRgb`) so
  use sites stay at the alpha they were tuned to.
- Theme resolution mirrors the web: `light | dark | system`, with `system`
  resolved to a real value via `useColorScheme()` and re-resolved when the OS
  flips. On Android also set the status/navigation bar to `forestDeep` and
  handle the light/dark icon variant.
- **Fix the AA failure first** (§1.6) and re-derive `inkFaint` per surface, then
  push the fix back into `styles.css` so the two agree.

### 6.2 Type

Bundle Bricolage Grotesque (variable, 600/800), IBM Plex Sans (400/500/600) and
IBM Plex Mono (500/600) as assets — there is no Google Fonts CDN on native and
no reason to want one. Define a scale as named styles (`display`, `title`,
`body`, `meta`, `eyebrow`, `mono`) rather than raw sizes at call sites, so
**Dynamic Type / font-scale support is one change instead of two hundred**
(§11). Note `letter-spacing: -0.02em` on display, and the mono tabular-nums
setting, which is what makes the coverage numbers stop jittering.

### 6.3 Icons

All 22 icons are inline SVG paths in `ICONS`. Port with `react-native-svg`, one
component per icon, same `viewBox`, same stroke widths (1.7–3.2 varies
deliberately per icon and is not an accident — the cog comment explains why).

### 6.4 Motion

Reanimated for the sheet, the day-strip edge fades (MaskedView), the coverage
bar's fill, and the fold/unfold. Honour `AccessibilityInfo.isReduceMotionEnabled`
everywhere the web honours `prefers-reduced-motion`.

### 6.5 The one thing that must be redesigned, not ported

The **filter row** (§1.6 P1). On a phone the web app stacks day strip + search +
chips + fold-all above the first item. Native options, in preference order:

1. Day strip stays (it is the widest cut and it is a calendar, which people
   read as one).
2. Search moves into the header as a collapsing search field, appearing on the
   same 8-item rule.
3. Chips collapse behind a single "Filter" affordance carrying a count of active
   cuts, opening a bottom sheet. The sheet is where `No day`, kind, category and
   hide-settled live.

This is a genuine improvement the platform makes available, and it is worth
doing in v1 rather than porting the density and fixing it later.

---

## 7. Android platform standards

Non-negotiable for a shippable Android app. Treat each line as an acceptance
criterion.

**Platform behaviour**
- [ ] Target the API level Play requires at submission time (currently API 36 /
      Android 16 for the 2026 window — **verify against current Play policy**,
      it moves every August). `minSdk` 24 or 26.
- [ ] **Edge-to-edge** is enforced for apps targeting SDK 35+. Both dark headers
      already assume they own the status bar (`env(safe-area-inset-top)` on
      web); the native equivalent is `react-native-safe-area-context` insets on
      the topbar, tab bar and every sheet.
- [ ] **Predictive back**: opt in, and make the gesture do the right thing per
      destination — a sheet closes, the room/settle pages pop to the trip, a tab
      pops to Pack, and the trip pops to the trip list. The web client already
      models this history stack (`pushTripView`, the settings push/pop
      argument); mirror its logic exactly.
- [ ] Hardware/gesture back never exits from a nested page directly to the
      launcher.
- [ ] **Configuration changes** survive: rotation, dark-mode flip, font-scale
      change, per-app language change.
- [ ] Large-screen / foldable: the Trip tab's two-column layout already exists
      in CSS (`trip-columns`); use it above ~600dp. Do not lock orientation.
- [ ] **Per-app language** support (`locales_config.xml`) even though the app
      ships English-only — it costs nothing and it is the hook for i18n later.

**Notifications**
- [ ] `POST_NOTIFICATIONS` runtime permission, requested **in context** (when
      the user turns the switch on in Settings or opts into the room), never on
      first launch.
- [ ] Two channels (§5.2), correctly named and described.
- [ ] Notification taps deep-link to the exact screen (`/t/:id/room`, `/t/:id`)
      and, when the app is already open on that screen, do not stack a duplicate
      — the service worker's `notificationclick` logic is the model.
- [ ] Respect Do Not Disturb; reminders are `urgency: low` already.

**Integration**
- [ ] App Links verified for `/t/*` and `/settings` (§5.5), including the
      "open in app" path from a WhatsApp-forwarded link.
- [ ] Android share sheet for the invite link (replacing the web's clipboard
      dialog), with clipboard as the fallback.
- [ ] Adaptive icon + **monochrome layer** for themed icons.
- [ ] Correct `android:label`, splash via `expo-splash-screen` matching
      `forestDeep`.
- [ ] Maps intent for the trip's pin uses the platform maps intent, not a
      `https://google.com/maps` URL, and falls back to the URL when nothing
      handles it. Preserve the existing precedence: pasted `map_url` beats the
      pin beats the words.

**Store**
- [ ] Android App Bundle, R8/ProGuard, per-ABI splits.
- [ ] Play Data safety form: the app collects name, email address, profile
      photo, and user-generated trip content; it does not track across apps.
- [ ] Privacy policy URL — **does not exist yet and is required**. Must cover
      Google profile data, trip content, push tokens, and the OpenAI processing
      that `@camp` performs.
- [ ] Account deletion path (Play requires an in-app route *and* a web route for
      apps with accounts). Today there is no delete-account anywhere. This is a
      real gap and it blocks release — see §16 Phase 0.
- [ ] Developer verification, signing key in Play App Signing, staged rollout.

---

## 8. iOS, planned for now and built later

Decisions to take now because they are expensive to reverse:

- **Sign in with Apple will be required.** App Review guideline 4.8 requires an
  equivalent privacy-preserving login option when an app uses a third-party
  login service exclusively. The schema is already ready: `auth_identities` is
  `(provider, subject)`. Build the server's provider abstraction generically in
  Phase 1 even though only Google is wired, and never assume `provider =
  'google'` anywhere new.
- Account linking: an account created with Apple's private relay email and later
  signed into with Google is a *different* user unless linked. Decide the policy
  now (recommendation: no automatic linking by email; offer explicit linking in
  Settings later).
- APNs via FCM keeps one send path; the `push_targets` transport column already
  allows a direct-APNs row later if that changes.
- Keep every layout on safe-area insets and every gesture on React Navigation's
  native stack, so the iOS build is a configuration problem rather than a
  rewrite.
- Universal Links AASA file alongside assetlinks (§5.5).

---

## 9. Screen-by-screen port notes

Only where the native version should differ from a literal port.

| Screen | Notes |
| --- | --- |
| Landing / trips | Native pull-to-refresh. Keep the demo coverage bar — it is the product's thesis in one control. Drop the install nudge entirely. |
| Join | Keep both clash paths verbatim; the copy is doing real work. |
| Pack / Eat / Plan | Filter row redesigned per §6.5. Day strip is a horizontal FlashList with measured edge fades (the web's `edges()` measures both ends rather than assuming — do the same). Accordion folds persist per trip per device, as today (`cs.folds.*` → MMKV). |
| Item row | Tick box is a 48dp target with haptic feedback on tick. Face stack keeps the "first face on top" overlap rule — it exists so each packed tick stays visible. |
| My kit | Unchanged in shape. This is the tab most likely to be used one-handed in a car park: make it the fastest screen in the app. |
| Trip | The card stack becomes a `FlashList` of sections so the weather/tips do not cost a frame on every state change. Two columns above 600dp. |
| Planning room | Inverted FlashList, `react-native-keyboard-controller` for the composer, streaming assistant deltas appended to a single animated row. The `@camp` mention completion is a native autocomplete chip above the composer. |
| Settle up | Money is `Intl.NumberFormat` with the trip currency; RN's Hermes has full ICU on Android — **verify on a low-end device** and fall back to the existing `CUR 0.00` path. |
| Settings | Reminders and account switches hit the server; theme and feature switches are device-local. Add "Sign out of this device" and the account-deletion entry point (§7). |
| Sheets | Real bottom sheets with drag-to-dismiss and a scrim; the web's `renderSheet` carries unsaved typed values across re-renders (a bug it cost them once) — native's controlled inputs make this free, but keep the behaviour explicit in tests. |
| Weather | Same endpoint, same `cut`/`reason` handling, same "how old is this" line when served from cache. |
| Place search | The web's inline type-ahead is already disabled on coarse pointers, so native is a plain suggestion list against `/api/places`. Keep the 280ms debounce and the client-side memo of answered queries. |

---

## 10. Offline and the outbox

This is where a native app earns its place, and it is also where it can most
easily lie to people. `ROADMAP.md` already argues both sides; here is the
resolution.

**Reads work offline.** The persisted query cache holds the last trip state per
user, the catalogue, and the last forecast (with its age shown). This matches
the service worker's `data` cache and is table stakes.

**Writes are split into three classes:**

1. **Never queued.** `claim`, `vote`, and any expense/payment write. A claim
   replayed forty minutes later is a lie — somebody else has bought the
   firewood by then — and money that lands late is worse. These fail loudly and
   immediately: "No signal. That change is not saved.", which is the exact
   sentence the web app already uses.
2. **Queued, because they are about you and nobody else can contradict them.**
   `packed`, `own`, `stow`. These are private or self-only ticks; a replay is
   still true when it lands. Queue with the desired-state form from §5.4, so the
   result does not depend on arrival order.
3. **Queued with an idempotency key.** `items` (add), `messages`. Adding
   "firewood" while offline is a real intention that survives the drive; the
   `clientId` stops a retry becoming two rows.

**The queue is visible.** A persistent, tappable strip — "3 changes waiting to
send" — opening a list with per-item retry and discard. An invisible outbox is
how an app tells somebody the tent is sorted when it is not.

**On reconnect**: flush in order, stop on the first 4xx that is not 409, refetch
trip state, and reconcile. A 409 (idempotency mismatch) surfaces as a
per-item conflict the person resolves.

**Never** flush from the background, and never flush without a fresh trip state
afterwards.

---

## 11. Accessibility

`PRODUCT.md` commits to WCAG 2.2 AA. The native equivalents, as acceptance
criteria:

- [ ] Every interactive element has an `accessibilityLabel` and the right
      `accessibilityRole`; every toggle exposes `accessibilityState.checked` or
      `selected` (the web already does this via `aria-pressed` — the mapping is
      mechanical and should be reviewed row by row).
- [ ] The coverage bar has a text alternative. The web already builds one
      (`p.aria`, e.g. "4 of 12 covered, 3 packed") — reuse it verbatim from
      `packages/core`.
- [ ] **Colour is never the only channel.** Person colours carry names; the
      blaze chip carries the word; the tick is a shape.
- [ ] 48dp minimum touch targets, 8dp minimum spacing between adjacent targets.
- [ ] Font scaling to at least 200% without clipping. Test the item row, the
      day strip and the tab bar at 200% — these are the three that will break.
- [ ] Contrast: re-verify every token pair on both palettes, including the
      known-failing one (§1.6).
- [ ] TalkBack pass on: claim an item, tick your own kit, send a message, record
      a payment, change a day. Those five journeys are the product.
- [ ] Reduced motion honoured.
- [ ] Live regions for the toast and the socket connection status (the web has
      `role="status"` on both).

---

## 12. Performance budgets

Numbers to hold to, measured on a mid-range Android device (a ~£200 phone, not a
Pixel):

| Metric | Budget |
| --- | --- |
| Cold start to first frame | < 1.8s |
| Cold start to trip list rendered (cached) | < 2.5s |
| Trip open from cache | < 400ms to first paint |
| List scroll | no frame over 16ms at 90th percentile on a 200-item packing list |
| Tick round trip (optimistic) | < 100ms visual response |
| APK/AAB download size | < 25 MB |
| Memory, trip open | < 200 MB |

Instrument with Sentry performance plus a Flashlight/Macrobenchmark run in CI on
the release build for the scroll number.

---

## 13. Testing

The repo's existing style is end-to-end smoke scripts (`scripts/*.mjs`) run by
`npm test`. Keep that and add three layers:

1. **`packages/core` unit tests (Vitest).** This is where the highest-value
   tests live: settlement arithmetic including the odd-penny allocation and the
   stable member order, the three-state day model, coverage counting with
   multi-claim items, filter composition. Port the existing behaviours as
   characterisation tests *before* the web app switches to the package, so the
   extraction is provably behaviour-preserving.
2. **Component tests (Jest + RNTL)** for the item row's state matrix (own /
   shared / claimed / packed / going-home / plan), the sheets' validation, and
   the outbox's three write classes.
3. **E2E (Maestro)** on the five journeys in §11, run against a seeded local
   server, on both themes and at 200% font scale.

Plus: extend the server's own smoke scripts to cover the bearer-token auth path
and the `push_targets` migration, in the same style as
`scripts/auth-smoke.mjs` and `scripts/reminder-smoke.mjs`.

---

## 14. Build, release, ops

- **EAS Build** with three profiles: `development` (dev client), `preview`
  (internal APK), `production` (AAB). CI on every PR builds `preview`.
- **Channels**: internal → closed testing → staged production rollout (10% → 50%
  → 100%), watching Sentry crash-free sessions and ANR rate at each gate.
- **OTA updates** (`expo-updates`) for JS-only fixes, on a channel matched to
  the store build. Policy: OTA never changes what the app does, only how well it
  does it. Anything that changes functionality goes through review.
- **Versioning**: the server is version-tolerant, but add a
  `X-Client-Version` header and a soft "please update" response the app can act
  on, so a breaking API change is possible later without stranding old installs.
- **Minimum supported client**: keep at least two versions back working.

---

## 15. Security and privacy

- Session token in Keystore/Keychain only. Never logged, never in breadcrumbs,
  never in a crash report.
- No client secret ships in the app (Google's ID-token flow needs none, which
  the README already notes).
- Certificate pinning: **not** in v1. It breaks more deployments than it saves,
  and Railway's certificate rotation would be the first casualty.
- `@camp` sends trip content to OpenAI. That is already true on the web, and it
  is already fenced (`store: false`, a hashed `safety_identifier`, and a system
  prompt that treats snapshot text as untrusted data). It must be disclosed in
  the privacy policy and in the Play data-safety form, and the existing
  device-level "Camp, in the Planning Room" switch must be present in the mobile
  settings and must genuinely suppress the request (`invokeAssistant: false`),
  exactly as it does on the web.
- Screenshot protection: not needed.
- Root/jailbreak detection: not needed.
- **Account deletion** (§7) is both a store requirement and the right thing:
  delete the user, cascade the sessions and identities, and decide explicitly
  what happens to their `members` rows (recommendation: anonymise the member to
  keep the group's history and their claims intact, and say so in the UI —
  removing them outright would delete other people's record of who brought the
  tent, and `expenses`/`payments` have `ON DELETE RESTRICT` for exactly that
  reason).

---

## 16. Phases

Each phase has an exit criterion. No phase starts before the one it depends on
has met its criterion. Phases 1 and 2 are the critical path; 4 and 5 can run in
parallel with 3 once the shell exists.

### Phase 0 — Prerequisites (no mobile code)
- `docs/api.md` written from the routes as they exist.
- Privacy policy drafted and hosted; account deletion designed and built into
  the server + web client.
- Custom domain acquired and pointed, if it is ever going to be.
- Google Cloud: Android OAuth client registered (debug + release SHA-1); Firebase
  project for FCM.
- **Exit**: an unfamiliar engineer can build a client from `docs/api.md` alone,
  and a user can delete their account from the web app.

### Phase 1 — `packages/core`, adopted by the web
- Extract types, days, coverage, settlement, filters into TS.
- Characterisation tests first, then the extraction.
- `public/app.js` and `lib/money.js` both import from it; `npm test` passes
  unchanged.
- **Exit**: `settlement()` exists exactly once in the repository, with tests.

### Phase 2 — Server: bearer auth, push transports, `trip.changed`, idempotency
- §5.1 through §5.4, each with a smoke script.
- Web client entirely unaffected; verified by the existing suite.
- **Exit**: `curl` can sign in with a Google ID token, receive a bearer token,
  read a trip, and receive an FCM notification on a test device.

### Phase 3 — Mobile shell
- Expo app, navigation skeleton, design tokens, typography, icons, theme
  provider, safe areas, edge-to-edge, predictive back.
- Auth end to end: sign in, session persisted, sign out, token refresh on 401.
- Trip list and trip open, read-only.
- **Exit**: sign in on a real device, open a trip, read every list. Ugly is fine;
  wrong is not.

### Phase 4 — The lists (the product)
- Pack / Eat / Plan / My kit, item rows, tick interactions with optimistic
  updates, sheets (item, add, edit, when, place, suggest), day strip, redesigned
  filter (§6.5), coverage bars, accordions.
- **Exit**: a real trip can be planned start to finish on the phone, with the web
  app open beside it agreeing at every step.

### Phase 5 — Trip tab, room, settle
- Trip overview cards, weather, people, notes, going-home.
- Planning room with WebSocket, streaming assistant, read positions.
- Settle up with expenses, custom splits, payments.
- **Exit**: full feature parity with the web client, verified against §1.4.

### Phase 6 — Notifications, offline, deep links
- Push registration, channels, in-context permission, tap-through routing.
- Deep links verified end to end from a forwarded message.
- The outbox (§10), with its visible queue.
- **Exit**: airplane-mode test — open the app at a "campsite", read everything,
  tick your own kit, queue an added item, regain signal, watch it land once.

### Phase 7 — Hardening and release
- Accessibility pass (§11), performance pass (§12), TalkBack and 200% font runs.
- Play listing, data safety, staged rollout.
- **Exit**: shipped to closed testing with crash-free sessions > 99.5% over a
  week of real use, then rolled out.

### Phase 8 — iOS
- The configuration and review work of §8, plus Sign in with Apple.

---

## 17. Risks and open decisions

| Risk | Severity | Response |
| --- | --- | --- |
| **Single-replica assumptions.** WS fan-out and the `@camp` queue are in-process (`ponytail:` comments in `server.js`). More clients means more sockets on one Railway instance. | Medium | Measure connection count and memory before Phase 6. Shared pub/sub only if the numbers demand it. |
| **SQLite on one volume.** No replica, and a deploy without the volume wipes everything (README says so in bold). | High, pre-existing | Automate the `VACUUM INTO` snapshot routine off-box before mobile traffic arrives. |
| **Play policy drift.** Target-SDK and verification requirements move every year. | Medium | Re-check policy at the start of Phase 7, not at the start of the project. |
| **Sign in with Apple.** Discovered late, it is a schema and account-linking problem, not a UI one. | Medium | Keep the provider abstraction generic from Phase 2 (§8). |
| **Offline lying to people.** The most damaging possible bug in this app. | High | The three-class rule (§10) and a visible queue. Do not soften it for convenience. |
| **The shared package drifting from `public/app.js`.** | Medium | Phase 1 makes the web app the *first* consumer, so drift breaks the web build. |
| **`@camp` cost and latency on mobile.** Streaming over a mobile socket through Doze. | Low | The reply is durable the moment it completes; a dropped stream is refetched by cursor, which the web client already handles. |
| **Google Fonts licensing in a binary.** | Low | Both families are OFL; bundle the licence files. |

**Open decisions to make before Phase 3:**
1. Custom domain now, or accept re-verifying deep links later?
2. Does the mobile app support link-only, signed-out reading of a trip (as the
   web does), or require sign-in? *(Recommendation: support reading, because the
   forwarded link is how this app spreads.)*
3. Is the legacy `legacy_claimable` device-migration bridge supported on mobile?
   *(Recommendation: no. Mobile requires an account. It is a web-only migration
   path and carrying it into a second client doubles a temporary complexity.)*
4. Bottom bar: five destinations, or four with the Trip page promoted to the
   header? The design critique flagged the density; native gives the option.
5. Play Store name and listing — "Camping Sync" is available on the web domain,
   not necessarily on Play.

---

## 18. Non-goals

- No new *features*. Everything in `ROADMAP.md` that is unbuilt — headcount-driven
  quantities, clone-the-last-trip, lifts, date-picking, duplicate detection, the
  safety card — stays unbuilt. Parity first; the mobile app is not the place to
  argue for new product surface.
- No redesign. The visual language ports faithfully; the two exceptions
  (§1.6 P1s) are defect fixes, not restyling.
- No second backend, no second database, no second trip-code namespace.
- No tablet-specific layout beyond the two-column breakpoint the CSS already
  implies.
- No i18n in v1 — but no hard-coded strings scattered through components either.
  Copy lives in one module per screen so the door stays open.
