---
target: dark theme
total_score: 31
p0_count: 0
p1_count: 2
timestamp: 2026-08-11T16-49-55Z
slug: public-index-html-dark-theme
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 4 | Coverage, loading, connection, and toast states are explicit. |
| 2 | Match System / Real World | 4 | Camping, ownership, packing, meals, and trip language are concrete. |
| 3 | User Control and Freedom | 3 | Navigation is clear, but device-local removal is visually hidden. |
| 4 | Consistency and Standards | 3 | Tokens and controls are coherent; five peer tabs create excess density. |
| 5 | Error Prevention | 3 | Busy/disabled states are strong; destructive housekeeping needs better recovery. |
| 6 | Recognition Rather Than Recall | 3 | Labels and tallies help, but several icon-only controls depend on learned meaning. |
| 7 | Flexibility and Efficiency | 3 | Search, filters, and folds help repeat use; bulk and desktop workflows are limited. |
| 8 | Aesthetic and Minimalist Design | 3 | Calm nocturnal palette; texture and repeated micro-label grammar add noise. |
| 9 | Error Recovery | 2 | Errors and toasts exist, but destructive actions have weak undo evidence. |
| 10 | Help and Documentation | 3 | Contextual notes are useful; compact icons and status systems still need inference. |
| **Total** | | **31/40** | **Strong, with accessibility and density gaps** |

## Anti-Patterns Verdict

**LLM assessment:** The dark theme does not immediately look AI-generated. It is a semantic night palette, not an inversion: green ink is separated from green surfaces, member colors are lifted, and blaze orange retains one operational meaning. Two conspicuous tells remain: the `repeating-linear-gradient` ripstop texture and repeated tiny tracked uppercase labels. Card use is high but mostly justified by separable trip objects.

**Deterministic scan:** One `single-font` warning at `public/index.html:1`. This is a false positive: `public/styles.css:91-93` defines Bricolage Grotesque, IBM Plex Sans, and IBM Plex Mono, all loaded in `index.html` and assigned distinct roles.

**Visual overlays:** No reliable user-visible overlay is available. T3 preview was automation-capable, but navigation failed for both environment-port and direct localhost URLs. The fallback was isolated source review, detector output, responsive-rule inspection, and calculated WCAG contrast.

## Overall Impression

The dark theme is unusually intentional and fits “dependable trail wayfinding.” Its biggest opportunity is not a new aesthetic; it is hardening the existing system for dim phones by fixing the one failing text/surface pair, widening dark elevation separation, and reducing simultaneous controls.

## What's Working

1. The palette is semantic rather than inverted. Dark surfaces, readable green ink, blaze action state, member colors, switch tracks, scrims, and shadows each receive deliberate answers.
2. Outdoor character supports the product. Forest surfaces and a restrained blaze accent orient users without turning the planner into a workplace dashboard.
3. Implementation care is visible: theme resolution occurs before first paint, the browser theme color updates, system changes are followed, safe areas and the on-screen keyboard are handled, and motion has reduced-motion alternatives.

## Priority Issues

### [P1] Faint text fails AA on raised dark surfaces

**Why it matters:** `--ink-faint` (`#828F87`) on `--paper-lift` (`#1F2A25`) measures about **4.40:1**, below the 4.5:1 requirement, and the token is used at 9.5-13px for metadata and labels. In low brightness these are the first details to disappear.

**Fix:** Raise `--ink-faint` slightly or introduce a separate muted token for raised surfaces, then audit every small-text use. Do not reduce hierarchy by making all secondary copy full-strength.

**Suggested command:** `$impeccable audit dark theme`

### [P1] Mobile navigation and list controls compete

**Why it matters:** Five permanent tabs are followed by day rails, search, kind/category chips, folds, and add/suggest actions. A tired user in a campsite sees a control cockpit before the plan.

**Fix:** Move Camp or My kit into a contextual/secondary destination, or progressively reveal filters after search/filter intent. Preserve Bring, Eat, and Plan as the stable core.

**Suggested command:** `$impeccable distill trip navigation`

### [P2] Dark elevations may collapse on dim OLED screens

**Why it matters:** Canvas `#0F1714`, paper `#18211D`, sunk paper `#131B18`, bar `#141D19`, and black shadows sit close together. Source values are plausible, but without live visual validation there is a real risk that cards, wells, and bars merge at low brightness.

**Fix:** Test at 15-25% brightness on a phone. If boundaries collapse, increase perceptual lightness separation or use one stronger hairline strategy rather than heavier shadow.

**Suggested command:** `$impeccable colorize dark theme`

### [P2] Texture and micro-label cadence weaken an otherwise original system

**Why it matters:** The generated ripstop texture is an explicit synthetic-UI tell, while repeated mono uppercase labels make unrelated sections sound identical.

**Fix:** Remove the two `repeating-linear-gradient` layers. Keep mono uppercase only where it expresses compact data or one deliberate wayfinding level.

**Suggested command:** `$impeccable quieter dark theme`

### [P2] Removal controls are hidden and weakly recoverable

**Why it matters:** `.trip-card__forget` is invisible until hover and only 0.55 opacity on touch; remove-person uses an `×`. Users may not discover device-local removal, while accidental actions appear to rely on confirmation rather than undo.

**Fix:** Put explicitly labelled removal in a menu or settings surface and provide an undo toast. Keep destructive actions out of the primary card scan path.

**Suggested command:** `$impeccable harden destructive actions`

## Persona Red Flags

**Jordan, first-time organiser:** A populated trip requires decoding five tabs, coverage stripes, member colors, badges, day rails, and chips. Blaze is consistently used, but “orange means unclaimed” is still learned rather than self-evident.

**Sam, tired phone user at camp:** Small faint metadata and closely spaced dark elevations are vulnerable at low brightness. Icon-only header controls have no hover tooltip on touch, while multiple horizontal control rails demand careful scanning.

**Alex, repeat organiser:** Search, filters, and folds are useful, but five-tab traversal and limited bulk/keyboard affordances make cross-list cleanup repetitive on desktop.

## Minor Observations

- `--on-forest` on the lighter dark-theme `--forest` is **4.52:1**: it passes AA for normal text, but with almost no margin. Guard it in token tests.
- Core pairs are strong: ink/paper 13.46:1, soft ink/paper 7.24:1, blaze/paper 5.22:1, and on-blaze/blaze 5.99:1.
- Several controls are visually smaller than the preferred 44px touch target (for example the 36px topbar buttons and 26px search clear/ticks). They exceed WCAG 2.2's 24px minimum, but live testing should verify spacing and effective row targets.
- The device-only theme explanation and no-white-flash implementation are excellent details.
- Settings' narrow card stack is coherent but may feel monotonous on desktop.

## Questions to Consider

- Is the true mental model five permanent destinations, or are Camp/My kit contextual views of Bring, Eat, and Plan?
- At 15% phone brightness, can users distinguish canvas, card, sunk region, enabled switch, and disabled switch without relying on shadows?
- Should the product's strongest completion signal be the coverage bar, a plain-language “ready” statement, or both?
