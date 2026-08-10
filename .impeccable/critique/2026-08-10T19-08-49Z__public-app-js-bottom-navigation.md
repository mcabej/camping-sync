---
target: bottom bar icons and navigation
total_score: 29
p0_count: 0
p1_count: 3
timestamp: 2026-08-10T19-08-49Z
slug: public-app-js-bottom-navigation
---
# Bottom Navigation Critique

## Design Health Score

| # | Heuristic | Score | Key issue |
|---|---|---:|---|
| 1 | Visibility of system status | 3/4 | Current destination is clear; badge meanings are not. |
| 2 | Match system / real world | 2/4 | “Mine” and “Camp” do not predict their destinations. |
| 3 | User control and freedom | 3/4 | Navigation is persistent, but changing tabs resets list context. |
| 4 | Consistency and standards | 3/4 | Familiar five-button bar; labels mix verbs, a pronoun, and a noun. |
| 5 | Error prevention | 4/4 | Large labeled targets reduce accidental navigation. |
| 6 | Recognition rather than recall | 2/4 | Pack/Mine and Camp/Trip distinctions must be learned. |
| 7 | Flexibility and efficiency | 3/4 | Core destinations stay one tap away. |
| 8 | Aesthetic and minimalist design | 3/4 | Compact and coherent; no destination is visibly dominant. |
| 9 | Error recovery | 3/4 | Persistent bar gives an immediate way back. |
| 10 | Help and documentation | 3/4 | Visible labels help, but ambiguous destinations lack clarification. |
| **Total** | | **29/40** | **Good foundation; semantic refinement needed.** |

## Anti-patterns verdict

The bar does not look generically AI-generated. It uses a restrained, coherent outline-icon family, visible labels, large targets, and a non-color-only current state. The deterministic detector found one unrelated `single-font` warning in `public/index.html`; it found no navigation-specific anti-pattern. Browser inspection could not enter a trip without mutating application state, so the supplied mobile screenshot and source/CSS trace were used.

## Overall impression

The five-destination structure is sound. Eat is immediately legible. Pack and Plan have good names with imperfect glyphs. Mine and Camp are learned labels rather than self-explanatory ones; those are the main opportunity.

## What's working

- Five persistent, text-labeled destinations fit the mobile pattern and exceed the 44px touch-target minimum.
- Eat successfully combines food and drink, and its fork/glass icon is immediately recognizable.
- The icon set is visually consistent; the active state uses forest text plus an orange top marker, not color alone.

## Priority issues

### [P1] “Camp” misnames a trip hub

The destination is internally titled “The trip” and contains readiness, weather, location, notes, people/invite, trip details, advice, pack-down controls, and activity. “Camp” plus a tent predicts campsite information. Rename it **Trip**; the tent can remain as the domain-level home glyph.

### [P1] “Mine” is too vague

It aggregates everything the current person is carrying, including claimed group items and private personal kit, and changes from packing to bringing home. “Mine” could mean profile, assignments, or possessions. Rename it **My kit**. Keep the checklist icon, or use a backpack if it remains distinct from Pack.

### [P1] Inactive navigation labels fail text contrast

`#8A978F` on `#FBFCF9` is approximately 2.95:1 at 11px, below WCAG's 4.5:1 requirement. Darken the inactive label/icon color while retaining sufficient distinction from the active forest state.

### [P2] Pack and Plan glyphs are weaker than their labels

Pack's handled bag resembles shopping; use a backpack or rucksack. Plan's compass suggests Explore or navigation, while the destination is activity ideas, voting, and an itinerary; use a calendar/itinerary glyph. Keep both labels.

### [P2] Badge semantics are not explicit to assistive technology

Bare badge numbers become part of the button name without saying whether they mean unclaimed items or items left to pack. Add visually hidden text such as “3 unclaimed items” and “3 items left to pack,” and use `aria-hidden` on decorative SVGs.

## Persona red flags

- **First-time organizer:** Camp looks like campsite/location, so people, invite, settings, weather, and readiness are poorly discoverable. Mine does not predict a personal carry checklist.
- **Hurried packer:** Pack versus Mine requires remembering “all gear” versus “everything I am carrying”; the tote and clipboard do not sharpen that distinction enough.
- **Screen-reader user:** Visible labels and `aria-current` are good, but badge units are missing and inactive visual labels have insufficient contrast.

## Minor observations

- “Eat” can stay; a cup/bottle could replace the stemmed glass if the app should feel less dining/alcohol-specific.
- `aria-label="Sections"` is generic; `Trip sections` would provide better scope.
- The source treats Camp as separate from four tabs, but the UI correctly presents five equal destinations. User-facing semantics should win over the internal distinction.

## Questions to consider

- Is the four-character label constraint worth making Mine and Camp harder to understand?
- Should the last destination communicate the domain (“Camp”) or the object being managed (“Trip”)?
- Can Pack and My kit remain distinct at a glance without relying on users learning the data model?
