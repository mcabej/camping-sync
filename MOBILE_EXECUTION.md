# Native app — execution plan for AI agents

This is the **work order**. `MOBILE.md` is the rationale and stays the source
of truth for *why*; this file is the source of truth for *what, in which order,
by whom, and how we know it is done*. Where the two disagree, the decisions
recorded in §0 below win — they were taken after `MOBILE.md` was written.

Every task is sized for one agent session, names the files it may touch, and
ends with a verification an agent can run without a human. Tasks marked
**HUMAN GATE** cannot be done by an agent (accounts, payments, store consoles,
physical devices) and block what follows them.

---

## 0. Decisions taken (2026-08-22)

| Decision | Choice | Consequence for the plan |
| --- | --- | --- |
| Approach | **React Native + Expo**, per `MOBILE.md` §2 | Full native client; shared TS domain package |
| Web app | **Kept**, same server, same trip codes | Nothing in `public/` is removed; web gets a build step (below) |
| Web consumes `packages/core` | **Yes, via a tiny esbuild step** | `settlement()`, days, coverage, filters exist once. `public/app.js` becomes a source file bundled to `public/dist/app.js` |
| Navigation | **Expo Router** | `/t/[tripId]` file route doubles as the deep-link route |
| Signed-out reading | **Allowed**, like the web | Trip open never requires sign-in; acting does |
| Offline scope (v1) | **Read-only cache + own ticks queued** (`packed`, `own`, `stow`). Add/edit/money/claim/vote are online-only with a visible offline state | Idempotency work is limited to the three tick endpoints; no `clientId` on items/expenses in v1 |
| Domain | **Keep `*.up.railway.app` for now** | App Links verified against the Railway host; re-verify if a domain is bought later (§5.5 of `MOBILE.md`) |
| Repo | **Monorepo, this repo** | `packages/core`, `packages/api`, `apps/mobile`; `server.js` path and Railway start command unchanged |
| Legacy `legacy_claimable` bridge | **Not supported on mobile** (`MOBILE.md` §17 #3) | Mobile is account-only for writes |
| Accounts | **None exist yet** (Play, Firebase, EAS, Apple) | HUMAN GATES listed at the point they block |
| iOS | **After Android ships** | Schema/auth stay provider-generic from Phase 2; Apple work is Phase 8 only |

---

## 1. Ground rules for every agent

1. **`npm test` must pass after every task.** It runs the eight smoke scripts
   against a real server on a temp database. If a task needs new server
   behaviour, it adds a smoke script or extends one — never skips.
2. **The web client is the oracle.** Until Phase 5 exit, any disagreement
   between mobile and web is a mobile bug by definition.
3. **No behaviour changes ride along with extractions.** Phase 1 diffs to
   `public/app.js` are imports replacing definitions, nothing else.
4. **Read the comments.** `server.js` and `public/app.js` carry design rationale
   in comments (the `ponytail:` markers, the three-state day model, the
   "if either changes, both change" note on `settlement()`). Port the reasoning
   into the TS as doc comments; do not strip it.
5. **One task, one branch, one PR**, named `mobile/<phase>-<task>` (e.g.
   `mobile/1-core-settlement`). PR body: what changed, how verified, what the
   next task needs.
6. **Secrets never land in git.** Google client IDs are public and may be
   committed in `app.json`; FCM service-account JSON, EAS tokens, VAPID keys,
   and keystores do not. `.gitignore` is extended in Task 0.1.
7. **Agents may run a dev server to test the UI.** Web: `npm run dev` and
   drive it in a browser (this overrides the standing `CLAUDE.md` note for
   this programme). Mobile: `npx expo start` with an Android emulator, or
   Maestro flows where a task specifies them. `npm test` and Jest/type-check
   remain the required automated gates; manual runs are in addition, not
   instead. Real-device checks stay HUMAN GATES.
8. Don't touch `marketing/` or `netlify.toml`; the marketing site is separate.

---

## 2. Target repository layout

```
camping-sync/
  server.js                   unchanged path; Railway start unchanged
  lib/                        server modules; money.js imports from packages/core
  public/
    app.js                    SOURCE (imports packages/core)   ← Phase 1
    dist/app.js               BUILT, gitignored, served by express.static
    index.html                script src → /dist/app.js
    .well-known/              assetlinks.json, apple-app-site-association
  packages/
    core/                     shared domain logic, TS, zero runtime deps
    api/                      typed REST + WS client, TS, depends on core
  apps/
    mobile/                   Expo app (Expo Router)
  docs/
    api.md                    the HTTP/WS contract
  scripts/                    smoke scripts (existing) + build-web.mjs
  package.json                npm workspaces root
```

Root `package.json` gains `"workspaces": ["packages/*", "apps/*"]`, a `build`
script (`node scripts/build-web.mjs`), and `start` becomes
`npm run build && node --env-file-if-exists=.env.local server.js`.
Railway's builder runs `npm install` + `npm start`; nothing in Railway config
changes. Verify that on the first deploy after Phase 1 (Task 1.7).

---

## Phase 0 — Prerequisites (no mobile code)

### Task 0.1 — Workspace scaffolding
- Convert root to npm workspaces; add `packages/core`, `packages/api`,
  `apps/mobile` as empty workspaces with `package.json` + `tsconfig.json`
  (`strict: true`, `module: NodeNext`).
- Root `tsconfig.base.json`. Root `.gitignore` adds `public/dist/`,
  `apps/mobile/android/`, `apps/mobile/ios/` (until prebuild is committed in
  Task 7.2), `*.keystore`, `google-services.json`, `GoogleService-Info.plist`,
  `*-service-account.json`, `.expo/`.
- **Verify**: `npm install` succeeds; `npm test` passes unchanged.

### Task 0.2 — `docs/api.md`: write the contract down
- One section per route in `server.js` (the `app.get/post/patch/delete` list,
  ~45 routes) with: method, path, auth requirement (`sessionUser` vs public vs
  `x-member-id`), request body fields (from `lib/fields.js` validators),
  response shape, error codes actually emitted.
- Document the WebSocket: upgrade path, auth, message types currently sent by
  `broadcastTripEvent`, the cursor/fill behaviour used by the planning room.
- Document `rev` polling: `GET /api/trips/:id/rev` and what the client does
  on change.
- **Verify**: a second agent, given only `docs/api.md`, writes
  `scripts/api-doc-check.mjs` that hits every documented GET route on a temp
  server and asserts documented status codes. Add it to `npm test`.

### Task 0.2b — `docs/features.md`: the parity checklist, generated from code
`MOBILE.md` §1.4 was written at `8c14b0b` and is **incomplete** — see §A
below for the known gaps. Parity must be checked against the app, not against
that section.
- Enumerate every `data-act="…"` handler in `public/app.js` (`grep -o
  'data-act="[a-z-]*"' public/app.js | sort -u` → 100 at time of writing)
  plus every gesture (`pointerdown` handler ~line 1152: swipe-to-reply, hold-to-
  pin), every WS message type (`room.presence`, `camp.presence`, …), and
  every sheet.
- For each: one line — what it does, which screen, which server route, and
  which task in this plan owns it (or `web-only` with a reason, e.g. the PWA
  `install-*` prompts and the `sw.js` update banner).
- This file is the **H4/H5 gate checklist**; nothing is `done` in Phase 4–5
  until its row is ticked on a device.
- **Verify**: a test `scripts/features-check.mjs` that fails if a `data-act`
  appears in `public/app.js` but not in `docs/features.md` — so the checklist
  cannot rot the way §1.4 did. Add to `npm test`.

### Task 0.3 — Account deletion (server + web)
Play's data-safety form and Apple review both require it.
- `DELETE /api/account`: revoke all sessions, delete `auth_identities`, delete
  `push_subscriptions`, anonymise the user's `members` rows (keep trip-local
  name, null `user_id`, per `MOBILE.md` §15 recommendation), delete `users` row.
- Web: "Delete account" in the account sheet with a typed confirmation.
- Smoke: `scripts/account-delete-smoke.mjs` — create user, join trip, add
  items, delete, assert trip still coherent and user gone.
- **Verify**: `npm test`.

### Task 0.4 — Privacy policy page
- `public/privacy.html` (static, served by the existing catch-all ordering)
  stating: Google identity stored, trip content stored, push tokens stored,
  OpenAI receives planning-room text for the `@camp` assistant, deletion via
  the account sheet. Plain language, no template boilerplate.
- **Verify**: route returns 200 with `text/html`; linked from `index.html`
  footer/account sheet.

### Task 0.5 — Automated off-box SQLite snapshot
`MOBILE.md` §17 flags this as High severity before mobile traffic arrives.
- `scripts/snapshot-db.mjs` using `VACUUM INTO` (see memory note:
  a plain copy loses WAL writes), uploading to a Railway bucket or S3-compatible
  store via env-configured credentials. Cron it in Railway (a second service
  using the same image, `node scripts/snapshot-db.mjs`, schedule daily).
- **Verify**: script runs locally against a temp DB and produces a file that
  `sqlite3` can `PRAGMA integrity_check` on. Railway cron is a HUMAN GATE
  (needs the bucket credentials).

### HUMAN GATE H0 — accounts (can be done in parallel with Phase 1–2)
- [ ] Google Cloud: in the **same project** as `GOOGLE_CLIENT_ID`, create an
      *Android* OAuth client for package `com.campingsync.app` (pick the final
      applicationId now; it cannot change after Play upload). Needs the debug
      SHA-1 now and the release SHA-1 after H7.
- [ ] Firebase project → Android app with the same package name → download
      `google-services.json` (keep out of git; it is injected in EAS as a
      secret file). Enable FCM v1; download a service-account JSON for the
      server (`FCM_SERVICE_ACCOUNT_JSON` env on Railway).
- [ ] Expo account + EAS project (`eas init` in `apps/mobile`, commit the
      `projectId` in `app.json`).
- [ ] Google Play Console developer account ($25). Note the 12-tester /
      14-day closed testing requirement for new personal accounts — start
      recruiting testers early.
- Exit: the four IDs above are recorded in `apps/mobile/README.md` (IDs only,
  no secrets).

---

## Phase 1 — `packages/core`, adopted by the web first

Order matters: characterisation tests are written **against the current JS**
before any extraction, so the TS port has something to be wrong against.

### Task 1.1 — Characterisation tests for the domain functions
- `packages/core/test/fixtures/*.json`: 4–5 realistic `TripState` snapshots
  (use `getTripState` from `lib/db.js` on a temp DB seeded by the smoke
  scripts; add a dump helper if needed).
- For each function in the table in `MOBILE.md` §2.1 (`settlement`,
  `statsFor`, `barParts`, `loadParts`, `myLoad`, `tripDays`, `dayFull`,
  `dayShort`, `byDayTime`, `mealRank`, `onDay`, `allWeek`, `matchesFilter`,
  `groupByCategory`, `pageGroups`, `isSettled`): extract the *current* JS
  implementation verbatim into `packages/core/test/legacy/*.js` and snapshot
  its output over the fixtures. These snapshots are the spec.
- Test runner: `node --test` (no Jest at root; keep root deps minimal).
- **Verify**: `npm test -w packages/core` green.

### Task 1.2 — `packages/core/src/types.ts`
- `TripState`, `Trip`, `Member`, `Item`, `Claim`, `Expense`, `Payment`,
  `Message`, `Notification`, `AuthState`, discriminated unions for
  `Item.list`, `Item.kind`, the day model (`'' | 'any' | ISODate`). Derive
  shapes from `lib/db.js` `getTripState` and `lib/fields.js`.
- **Verify**: fixtures from 1.1 type-check when imported as `TripState`
  (a `test/types.test.ts` that does `satisfies`).

### Task 1.3 — Port `settlement()` and `money`
- `packages/core/src/settlement.ts`. Integer-cents arithmetic exactly as
  `lib/money.js`; carry the comments.
- `lib/money.js` imports from `packages/core` (built output, `dist/`).
  The server stays JS; `packages/core` builds to ESM JS + `.d.ts` with `tsc`
  on `prepare`.
- **Verify**: core snapshot tests green; root `npm test` green (money is
  covered by the existing smokes).

### Task 1.4 — Port days, coverage, filters, catalog
- `days.ts`, `coverage.ts`, `filters.ts`, `catalog.ts` (the latter re-exports
  `lib/catalog.js` data with types; server continues importing its own copy
  until the `lib/catalog.js` → core direction is flipped in the same task).
- **Verify**: all snapshot tests green.

### Task 1.5 — Web build step
- `scripts/build-web.mjs`: esbuild, entry `public/app.js`, out
  `public/dist/app.js`, `format: 'iife'`, target `es2020`, sourcemap in dev.
  esbuild is a root devDependency — but Railway runs `npm install` with dev
  deps by default; confirm in Task 1.7, otherwise move it to `dependencies`.
- `public/index.html` script tag → `/dist/app.js`. `public/sw.js` precache
  list updated to the new path (it hashes by version; check the cache name
  bump logic).
- `server.js` static serving: ensure `public/dist` is served and **not** shadowed
  by the `/{*path}` catch-all; add `public/dist` to the asset smoke
  (`scripts/assets-smoke.mjs`).
- **Verify**: `npm run build && npm test`.

### Task 1.6 — Web adopts core
- In `public/app.js`, replace each definition from the 2.1 table with
  `import { … } from '@camping-sync/core'`. Delete the local copies. Nothing
  else changes in the diff.
- **Verify**: `npm test`; `git diff --stat public/app.js` shows only removals
  plus the import lines; `grep -c "function settlement" public/app.js` is 0 and
  `grep -rn "function settlement" --include=*.{js,ts} . | grep -v node_modules`
  shows exactly one definition in `packages/core/src`.

### Task 1.7 — Deploy and confirm Railway is unaffected — HUMAN GATE H1
- Deploy `main`; confirm the build step ran in Railway logs, the volume is
  still attached, the live app loads, a trip's Settle-up numbers are unchanged.
- Exit: `settlement()` exists once in the repository and production runs it.

---

## Phase 2 — Server: bearer auth, push transports, `trip.changed`, tick idempotency

All additive. Each task extends or adds a smoke script.

### Task 2.1 — Bearer sessions
- `sessionUser(req)` in `server.js` (~line 124) also reads
  `Authorization: Bearer <token>`; same SHA-256 lookup in `sessions`.
- `POST /api/auth/google`: if the request has **no `Origin` header**, skip the
  `sameOrigin` check and return `{ token, expiresAt, ...authState }` without
  `Set-Cookie`. If `Origin` is present, current behaviour exactly.
- `POST /api/auth/logout` revokes a bearer session too.
- Migration: `sessions.client TEXT DEFAULT 'web'`, `sessions.last_seen_at`.
  Follow the boot-migration pattern in `lib/db.js`.
- `POST /api/auth/dev` (dev-only) gets the same bearer path so smokes and the
  mobile dev build can sign in without Google.
- Smoke: extend `scripts/auth-smoke.mjs` — bearer sign-in, authenticated
  request, logout revokes, cookie flow still requires same-origin.
- **Verify**: `npm test`; `docs/api.md` updated.

### Task 2.2 — `push_targets` with `webpush` + `fcm` transports
- Migrate `push_subscriptions` → `push_targets` per `MOBILE.md` §5.2, existing
  rows become `transport='webpush'`. Keep the old table name as a view only if
  the smokes reference it; otherwise update the smokes.
- `lib/push.js` (new; extract `sendPush` from `server.js`): dispatch by
  transport. FCM v1 via HTTP with a service-account JWT (`google-auth-library`
  is already a dependency — use it; no `firebase-admin`). Same 30 s timeout,
  and **keep the boot-time `PUSH_TIMEOUT_MS < REMINDER_LEASE_MS` refusal**.
  Retire targets on `UNREGISTERED`/`NOT_FOUND` exactly as 404/410 today.
- `lib/reminders.js`: both `push_subscriptions` queries move to `push_targets`.
  `scripts/reminder-smoke.mjs` must pass unchanged — it is the guard that
  reminder logic didn't move.
- `PUT /api/trips/:id/notifications` accepts
  `{ transport: 'fcm', address: '<token>', platform: 'android' | 'ios' }`
  alongside the existing Web Push body.
- Smoke: FCM path tested with a stub (`FCM_ENDPOINT` env override pointing
  at an in-process server in the smoke, asserting payload shape and
  retirement on 404).
- **Verify**: `npm test`.

### Task 2.3 — `trip.changed` over the socket
- Wrap `bumpRev()` so every call site also calls
  `broadcastTripEvent(tripId, { type: 'trip.changed', rev })`. Do not edit the
  ~20 call sites.
- Web client ignores unknown event types already — confirm by reading
  `public/app.js` socket handler, add an explicit no-op branch if not.
- Smoke: extend `scripts/chat-smoke.mjs` to open a socket, mutate the trip via
  REST, assert one `trip.changed` with the new `rev`.
- **Verify**: `npm test`.

### Task 2.4 — Explicit-state ticks
- `POST /api/items/:id/packed|own|stow` accept an optional body
  `{ value: boolean }`; absent → toggle (current behaviour). `claim` and
  `vote` are *not* changed (they are online-only in v1 by decision §0).
- Smoke: replaying `{ value: true }` twice leaves state `true`.
- **Verify**: `npm test`; `docs/api.md` updated.

### Task 2.5 — Deep-link association files
- `public/.well-known/assetlinks.json` with package `com.campingsync.app` and
  the **debug** SHA-256 for now (release fingerprint added at H7).
- Explicit route for `/.well-known/apple-app-site-association` serving
  `application/json` (content filled in Phase 8; ship an empty-but-valid file).
- Asset smoke asserts both are served with correct content types before the
  catch-all.
- **Verify**: `npm test`.

### Task 2.6 — `packages/api`
- `client.ts`: `fetch` wrapper taking a token provider, base URL, `x-member-id`
  discriminator; typed error class carrying status + server `error` field.
- `endpoints.ts`: one function per route in `docs/api.md`, request/response
  typed with `packages/core` types.
- `socket.ts`: reconnecting WS with bounded backoff, cursor fill for messages,
  `trip.changed` subscription.
- Test: `node --test` against a real temp server (reuse the harness the
  smoke scripts use) — sign in with `/api/auth/dev`, create trip, add item,
  tick, read state; socket receives `trip.changed`.
- **Verify**: `npm test -w packages/api`; add to root `npm test`.

### Exit (Phase 2)
`curl` can sign in (dev token), receive a bearer token, read a trip, tick an
item idempotently, and the FCM stub receives a reminder. Web client untouched
and green.

---

## Phase 3 — Mobile shell

### Task 3.1 — Expo app
- `npx create-expo-app apps/mobile --template blank-typescript`, Expo Router,
  New Architecture on, Hermes. `app.json`: `android.package =
  com.campingsync.app`, `scheme = campingsync`, `intentFilters` for
  `https://<railway host>/t/*` with `autoVerify: true`. The web routes are
  `/t/<code>`, `/t/<code>/room`, `/t/<code>/settle`, `/t/<code>/ask`
  (`tripRoute()` in `public/app.js` ~line 6387); the Expo Router file tree
  must mirror all four so forwarded links land on the right screen.
- Deps per `MOBILE.md` §2.3: TanStack Query, `react-native-mmkv`,
  `@shopify/flash-list`, `@gorhom/bottom-sheet`, `expo-secure-store`,
  `expo-notifications`, `@react-native-google-signin/google-signin`,
  `react-native-keyboard-controller`, Sentry (`@sentry/react-native`).
- Jest + RNTL configured; `npm run typecheck` and `npm test -w apps/mobile`
  in CI.
- **Verify**: `npx expo export --platform android` succeeds (no device needed);
  type-check green.

### Task 3.2 — Design tokens
- Port every colour token from `public/styles.css` (two palettes) into
  `apps/mobile/src/theme/tokens.ts`; spacing/radius/type scale likewise.
  Fonts: the two Google Fonts families, OFL licences bundled (`MOBILE.md` §17).
- Theme provider following system light/dark.
- Test: a snapshot that every CSS `--token` has a TS counterpart (parse the
  CSS in the test so drift fails loudly).
- **Verify**: tests green.

### Task 3.3 — Auth end to end
- `src/auth/`: Google sign-in via Credential Manager with
  `webClientId = GOOGLE_CLIENT_ID`; POST ID token to `/api/auth/google`
  (no Origin → bearer); token in SecureStore; 401 → clear + prompt.
- Dev build only: "dev sign-in" button hitting `/api/auth/dev`, gated on
  `__DEV__`.
- Signed-out is a first-class state: the app opens to the trip list (empty,
  with "open a link" hint) or to a deep-linked trip read-only.
- **Verify**: Jest tests with a mocked API for sign-in/out/401; real Google
  sign-in is HUMAN GATE H3 (needs H0's Android OAuth client + debug SHA-1).

### Task 3.4 — Navigation + data layer
- Expo Router: `app/index.tsx` (trips), `app/t/[tripId]/(tabs)/…` with tabs
  Pack / Eat / Plan / My kit / Trip (five, per `MOBILE.md` §17 #4 — decide
  four vs five at H3 after seeing it on a device; default five).
- `useTripState(tripId)`: TanStack Query, MMKV persister, refetch on
  `trip.changed` when foregrounded, `rev` poll fallback when socket is down,
  every mutation's returned state replaces the cache (the API returns whole
  trip state — use it, don't refetch).
- Read-only screens rendering every list from fixtures.
- **Verify**: RNTL tests render each tab from the Phase 1 fixtures without
  error; `npx expo export` green.

### HUMAN GATE H3 — first device run
- Install dev client on a real Android phone, sign in with Google, open an
  existing trip, read every list. Ugly is fine; wrong is not. Decide 4 vs 5
  tabs. Record findings as issues.

---

## Phase 4 — The lists (the product)

Parallelisable across agents once 3.4 is merged; each task is one screen
group and each must include RNTL tests against fixtures.

### Task 4.1 — Item row + tick interactions
Optimistic `packed`/`own`/`stow` with the explicit-state endpoints; rollback on
error; claim/vote online-only with a disabled state + toast when offline.
### Task 4.2 — Coverage bars and accordions
`barParts`/`loadParts` from core; the signature visual, pixel-matched to web.
### Task 4.3 — Day strip + redesigned filter (`MOBILE.md` §6.5)
Search in collapsing header; chips behind one "Filter (n)" sheet.
### Task 4.4 — Sheets: item, add, edit, when, place, suggest
`@gorhom/bottom-sheet`; catalogue search over `core/catalog`.
### Task 4.5 — My kit
Own-items list, private by construction (never rendered for others — assert
in a test that `kind: 'own'` items with another `owner_id` are absent).

### Exit (Phase 4) — HUMAN GATE H4
Plan a real trip start to finish on the phone with the web app open beside it,
agreeing at every step.

---

## Phase 5 — Trip tab, planning room, settle up

### Task 5.1 — Trip overview: cards, weather, people, notes, going-home, pin.
### Task 5.2 — Planning room
Inverted FlashList, `keyboard-controller` composer, streaming `@camp` deltas
appended to one row, `@camp` mention chip, read positions, cursor fill on
reconnect.
### Task 5.2b — Private Camp thread (`/t/<code>/ask`)
Per-member private `@camp` conversation (`GET/POST/DELETE /api/trips/:id/camp`),
streaming, load-older, clear-with-confirm, retry, `camp.presence`. Isolated per
member — assert in a test that another member's thread is never requested or
rendered. Reuses the 5.2 message row and streaming components.
### Task 5.3 — Settle up
Expenses, custom splits, payments with `client_id`; `settlement()` from core;
numbers asserted identical to `lib/money.js` on fixtures.
### Task 5.4 — Membership
Join via link (name + hue + diet), leave trip, delete trip (owner), account
sheet with delete account (Task 0.3).

### Exit (Phase 5) — HUMAN GATE H5
Feature parity per `docs/features.md` (Task 0.2b — **not** `MOBILE.md` §1.4, which is stale), checked off row by row on a device.

---

## Phase 6 — Notifications, offline, deep links

### Task 6.1 — Push
Register FCM token via `PUT /api/trips/:id/notifications`; two Android
channels ("Planning room", "Trip reminders"); in-context permission prompt
(after first message sent or first reminder toggle, not at launch); tap routes
through Expo Router to the `url` in the payload.
**Verify**: end to end on device via H6.

### Task 6.2 — Offline (v1 scope)
- Cached `TripState` readable with no network, with an "offline, last updated
  …" banner.
- Outbox for `packed`/`own`/`stow` only, MMKV-backed, explicit `value`, FIFO
  replay on reconnect, visible queue count. Everything else disabled offline
  with a clear reason.
- Test: Jest with a mocked network — queue 3 ticks, reconnect, assert 3
  requests with explicit values and final cache state.

### Task 6.3 — Deep links
`https://<host>/t/<code>` → trip route signed-out or in; `campingsync://`
scheme for dev. `adb shell am start` verification script in
`apps/mobile/scripts/verify-links.sh`.

### HUMAN GATE H6
Airplane-mode test from `MOBILE.md` Phase 6; push received from a real
reminder; link from WhatsApp opens the app.

---

## Phase 7 — Hardening and Play release

### Task 7.1 — Accessibility + performance passes
`MOBILE.md` §11 and §12 as checklists; TalkBack labels on every toggle
(`accessibilityState.checked`), 200 % font run, list scroll at 60 fps on a
500-item fixture, cold start budget.
### Task 7.2 — Prebuild committed, EAS profiles
`expo prebuild` output committed; `eas.json` with `development`, `preview`
(internal APK), `production` (AAB). `expo-updates` channel per profile.
Sentry DSN wired.
### Task 7.3 — Store assets
Adaptive icon from `scripts/make-icons.mjs` source, splash, feature graphic,
screenshots (agent drafts copy; screenshots come from H7), data-safety answers
drafted from `privacy.html`.
### Task 7.4 — `assetlinks.json` release fingerprint
After H7 provides the Play-signing SHA-256, add it alongside debug; deploy;
verify with Google's statement-list checker.

### HUMAN GATE H7 — Play Console
Create the app, Play App Signing, upload the `production` AAB to **closed
testing**, enrol the 12 testers, run 14 days, then production with staged
rollout. Crash-free > 99.5 % over a week before widening.

---

## Phase 8 — iOS

### HUMAN GATE H8 — Apple Developer account, App ID, APNs key, Sign in with Apple capability.
### Task 8.1 — Sign in with Apple (server)
New `auth_identities.provider = 'apple'`; verify Apple ID tokens; account
linking is **explicit** (no silent email matching — `MOBILE.md` §8).
### Task 8.2 — iOS build
`ios.bundleIdentifier`, `associatedDomains` for Universal Links, AASA filled
in, APNs via FCM or direct (decide at 8.2 based on the push module's support).
### Task 8.3 — TestFlight → App Store review
Review-notes cover: account deletion, privacy policy URL, the assistant's use
of OpenAI.

---

## Dependency graph (what can run in parallel)

```
0.1 → 0.2 → 2.6
0.1 → 0.2b            (checklist; gates H4/H5)
0.1 → 1.1 → 1.2 → 1.3 → 1.4 → 1.5 → 1.6 → H1
0.3, 0.4, 0.5                        (any time after 0.1)
H0                                   (human, parallel with all of Phase 1–2)
1.4 → 2.1, 2.2, 2.3, 2.4, 2.5        (independent of each other)
2.1 + 2.6 + H0 → 3.1 → 3.2 → 3.3 → 3.4 → H3
3.4 → 4.1 … 4.5 (parallel) → H4
3.4 → 5.1 … 5.4 (parallel, can overlap Phase 4) → H5
2.2 + 2.4 + H5 → 6.1, 6.2, 6.3 → H6
H6 → 7.1 … 7.4 → H7
H7 → H8 → 8.1 … 8.3
```

## Appendix A — Features missing from `MOBILE.md` §1.4

Found by diffing the `data-act` handlers and the commits after `8c14b0b`
against the §1.4 inventory. Each is assigned to a task; Task 0.2b makes this
list exhaustive.

| Feature (commit) | What it is | Owning task |
| --- | --- | --- |
| **Private Camp threads** (`dcd86f2`) | A per-member private `@camp` conversation at `/t/<code>/ask`, separate from the Planning Room: streaming, "older", clear, retry, `camp.presence` over WS. Camp's *trip changes* are shared with the group; the messages are not. Routes `GET/POST/DELETE /api/trips/:id/camp`. | New **Task 5.2b — Private Camp thread** (after 5.2); route `app/t/[tripId]/ask.tsx` |
| **Pinned message + gestures** (`92547ec`) | One pin per trip (`trips.pinned_message_id`), shown above the thread; `PUT /api/trips/:id/pin`; swipe-to-reply and hold-to-pin on a message row; `chat-reply`, `chat-quote`, `chat-unpin`. | Task 5.2 (add: pin slot, reply/quote composer state, `react-native-gesture-handler` swipe + long-press) |
| **Floating Planning Room / Camp shortcut** (`9266afa`, `c694b47`) | FAB pair on the list tabs with unread badge; returning from the room restores tab, filters, scroll. | Task 4.3 (FAB + badge); Expo Router stack keeps list state naturally |
| **Leave trip / delete trip / forget trip** (`1800998`) | `leave-trip` (member, `DELETE …/members/:mid` on self), `delete-trip` (owner, confirmation, `DELETE /api/trips/:id`), `forget-trip` (drop from local list). | Task 5.4 (already listed, confirm all three) |
| **Share trip** | `navigator.share` with the `/t/<code>` URL and invite text. | Task 5.1 → `expo-sharing` / RN `Share` |
| **Vote** on activities | `POST /api/items/:id/vote`; online-only per §0. | Task 4.1 |
| **Remove item** (`kill`) | Delete from the item sheet. | Task 4.4 |
| **Room presence** | `room.presence` WS message (who's in the room). | Task 5.2 |
| **"Newer build available" prompt** (`5e7b26c`) | Page/SW version stamp. | `web-only`; mobile equivalent is `expo-updates` (Task 7.2) |
| **PWA install prompts** (`install-*`) | | `web-only` |
| **Retry alerts** (`retry-alerts`) | Re-attempt push subscription after failure. | Task 6.1 |

## Definition of done for the whole programme
- Play Store production listing live; web app at the same URL unchanged in
  behaviour for existing users; one `settlement()`; `npm test` covers server,
  core, and api; iOS shipped later via Phase 8 without schema changes.
