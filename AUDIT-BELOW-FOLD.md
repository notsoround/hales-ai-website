# Cupcake Noir — Comprehensive Below-the-Fold Visual & Code Audit (Stage 4)

**Branch:** `antigravity/tier5-noir-craft`  
**Audit Method:** Full Playwright capture (`RICH=1`) across **390×844** (scroll slices `y=0, 760, 1520, 2280, 3040`) and **1280×900** desktop, in **Dark** and **Light (Porcelain)** schemes, across **Caribbean** (primary) and **Rose/Violet** (spot-checks), covering every tab, sub-tab, popover, and expanded drawer state, paired with live DOM/CSS metrics and static CSS inspection.

---

## Executive Summary & Live Metrics

- **Horizontal overflow (`scrollWidth > innerWidth`):** `0` across all 94 captured states (`390px` and `1280px`, Dark & Light, Caribbean & Rose).
- **Static `transition: all` check (`src/components/cupcake/`):** `0` occurrences in account Noir stylesheets (only 1 legacy non-account match in `robyn/robyn.css:236`, out of scope).
- **Static `impeccable` check:** Not installed locally (`npx --no-install impeccable` unavailable); skipped cleanly without modifying `package.json`.
- **Top systemic visual regressions identified below the fold:**
  1. **Legacy non-Noir box fallback on `Fitness` and `Today → More detail`:** `<TodayEnergy>` renders raw 2024 rounded cards, purple sleep bar, chunky pill chips, and 6 nested rounded stat boxes inside `FitnessWorkspace` because Noir overrides in `noir-elevate.css` are scoped strictly to `.cc-today-grid`. Similarly, `Today → More detail` cards (`Personal wins & losses`, `Apple Health uploads`, `Food today`, `6 PM blood sugar`) revert to boxed frames + yellow gradient glow + bright square Food icon badge.
  2. **Steps mini-gauge icon pinned top-left:** `.nx-steps-mini-gauge svg { position: absolute; inset: 0; }` hits both the ring `<svg>` and the Lucide `<Footprints>` `<svg>`, pushing the footprints glyph to `(0, 0)` on both mobile and desktop.
  3. **Sharing & Reports crushed inside Desktop Settings drawer:** `reports.css` applies desktop flex header (`max-width: 46%` pill beside heading) and `@media (min-width: 900px)` 2-col/4-col grids inside the narrow `.cc-settings-panel` drawer, crushing `"Reports shared with you"` into 3 narrow lines and squeezing client report KPIs.
  4. **Light Porcelain theme leaks & contrast bugs:**
     - Dark/black dial head dot (`fill: var(--nx-ink)`) on Today MultiDial, Food hero dial, and Glucose chart active point instead of crisp `#fff`.
     - `.cc-rep-avatar[data-tone=b]` (`Avery Lindqvist`) mixes 50% `#fff` into ocean blue on a light blue circle (~1.5:1 contrast).
     - `noir-light.css` `.cc-shell :is(.cc-card, .cc-dashboard-card)` clobbers `noir-history.css`'s hairline-ruled flat aesthetic on `WeekView` back into stark white shadowed cards.
     - `Food` hero card and `Household pantry` render on flat gray `--nx-surface` instead of lifted Porcelain `#ffffff`, and disabled `Add`/`Stock`/`Save decision`/`Change password` buttons fall below 4.5:1 AA contrast (`2.25–4.28:1`).
     - `Timeline` node `.cc-tl-node` gets a muddy grey outer ring halo in Light mode (`box-shadow` inverted from `#030607`).
  5. **Food Log below-the-fold duplication & card-style collision:** `Food log` shows a second full `Log a food photo` card (with a second glowing primary cyan CTA `Take meal photo`) and `Add a meal` card below the fold even though the hero card already has `Snap photo` and `Manual entry`; meanwhile `account-food.css` re-boxes `.cc-nutrition-overview` and meal rows against `noir-history.css`'s hairline aesthetic.

### Issue Counts by Disjoint Implementation Lane

| Lane | Worker | P0 (Blocking/Broken) | P1 (High-Impact Polish) | P2 (Refinement) | Total |
|---|---|---:|---:|---:|---:|
| **Lane A** | `polish-today-fitness` | 3 | 6 | 3 | **12** |
| **Lane B** | `polish-food-library` | 1 | 6 | 3 | **10** |
| **Lane C** | `polish-settings-motion` | 3 | 6 | 4 | **13** |
| **Total** | | **7** | **18** | **10** | **35** |

---

## Strict Disjoint File Ownership Matrix

> **Zero files overlap across lanes.** Nobody edits `src/components/cupcake/noir/noir-light.generated.css`, `src/pages/cupcake/sandbox/cupcakegpt/page.tsx`, or `src/components/cupcake/noir/account-noir.css` (Coordinator-only).

- **Lane A (`polish-today-fitness`):** `src/components/cupcake/noir/noir-elevate.css`, `src/components/cupcake/noir/noir-today.css`, `src/components/cupcake/account-today.css`, `src/components/cupcake/account-timeline.css`, `src/components/cupcake/noir/noir-history.css`, `src/components/cupcake/noir/noir-outcomes.css`, `src/components/cupcake/TodayPulse.tsx`, `src/components/cupcake/TodayEnergy.tsx`, `src/components/cupcake/noir/FitnessWorkspace.tsx`, `src/components/cupcake/AccountWorkoutPlan.tsx`, `src/components/cupcake/noir/OutcomeBalance.tsx`
- **Lane B (`polish-food-library`):** `src/components/cupcake/account-food.css`, `src/components/cupcake/noir/noir-pages.css`, `src/components/cupcake/noir/noir-plan.css`, `src/components/cupcake/account-recording-summary.css`, `src/components/cupcake/NutritionWorkspace.tsx`, `src/components/cupcake/AccountFoodPlan.tsx`, `src/components/cupcake/AccountFoodSections.tsx`, `src/components/cupcake/ReceiptWorkspace.tsx`, `src/components/cupcake/LibraryWorkspace.tsx`, `src/components/cupcake/AccountRecordingArchive.tsx`, `src/components/cupcake/AccountRecordingTranscription.tsx`, `src/components/cupcake/AccountRecordingSummary.tsx`, `src/components/cupcake/VoiceUpdatesCard.tsx`
- **Lane C (`polish-settings-motion`):** `src/components/cupcake/cupcake-settings.css`, `src/components/cupcake/noir/noir-connect.css`, `src/components/cupcake/noir/connections.css`, `src/components/cupcake/noir/assistant/noir-assistant.css`, `src/components/cupcake/noir/noir-native.css`, `src/components/cupcake/noir/noir-light.css`, `src/components/cupcake/noir/noir-charts.css`, `src/components/cupcake/CupcakeSettings.tsx`, `src/components/cupcake/noir/ConnectionsHub.tsx`, `src/components/cupcake/AssistantShell.tsx`, `src/components/cupcake/noir/NotificationsPopover.tsx`, `src/components/cupcake/reports/reports.css`

---

## Lane A (`polish-today-fitness`) — Today Below-Fold, Fitness & Wins/Losses

### P0 Issues

#### A-1. `[P0]` `<TodayEnergy>` inside `FitnessWorkspace` reverts to legacy non-Noir chunky boxes & 6 nested stat tiles
- **Observed (`390px` & `1280px`, Dark & Light):** On the `Fitness` tab below `Weight`, `6 PM blood sugar`, `Libre CGM`, `Last night`, and `Energy balance today` render with legacy 2024 bordered cards, gray rounded-square icon chips, bold Inter `"6 h 20 m"`, fat purple sleep bar (`#9e8cfc`), pill chips (`Resting HR 52`), and **6 nested rounded boxes** inside `Energy balance today` (`.cc-energy-stats div`).
- **Root Cause:** `noir-elevate.css` lines 166–211 scope all hairline-ruled Noir overrides strictly to `.cc-today-grid` (e.g. `.cc-today-grid .cc-energy-stats`), leaving `.nx-fitness .cc-energy` unstyled by Noir.
- **Files & Selectors:** `src/components/cupcake/noir/noir-elevate.css` (lines 166–211), `src/components/cupcake/noir/FitnessWorkspace.tsx` (lines 325–332).
- **Cupcake Noir Fix:**
  - Extend all `.cc-today-grid` drill-down Noir rules in `noir-elevate.css` using `:is(.cc-today-grid, .nx-fitness)` so `6 PM blood sugar`, `Libre CGM`, `Last night`, and `Energy balance today` render in the exact hairline-ruled, zero-frame, Outfit display-numeral Noir language inside Fitness too (no nested stat boxes, no legacy icon chips, thin 3px `--nx-a2 -> --nx-a` sleep bar, plain inline HR/SpO2 stats).
  - Also ensure `.cc-last-night-src` uses `color: var(--nx-ink-3); opacity: 1;` inside `.nx-fitness` (fixes measured `cr=3.02` in Light mode on Fitness!).

#### A-2. `[P0]` Steps mini-gauge `<Footprints>` icon pinned to top-left corner of ring
- **Observed (`390px` & `1280px`, Dark & Light, Caribbean & Rose):** Inside the `STEPS TODAY` mini-gauge on `Today`, the footprints icon sits clipped at `(0, 0)` top-left instead of centered inside the 34×34 circular progress ring.
- **Root Cause:** `src/components/cupcake/noir/noir-elevate.css:299` sets `.cc-app[data-entry=account] .nx-steps-mini-gauge svg { position: absolute; inset: 0; }`, which targets **both** the circular ring `<svg>` and the Lucide `<Footprints>` `<svg>`.
- **Files & Selectors:** `src/components/cupcake/noir/noir-elevate.css` (line 299).
- **Cupcake Noir Fix:** Scope absolute positioning strictly to the ring SVG: `.cc-app[data-entry=account] .nx-steps-mini-gauge > svg:first-child { position: absolute; inset: 0; }` (or `:has(.nx-steps-mini-track)`), and let the Lucide icon sit centered in the `display: grid; place-items: center;` container (`position: relative; width: 14px; height: 14px;`).

#### A-3. `[P0]` `Today → More detail` expanded cards clash violently with Noir hairline language
- **Observed (`390px` & `1280px`, Dark & Light):** Expanding `More detail` on `Today` reveals four heavy bordered cards (`Personal wins & losses`, `Apple Health uploads`, `Food today`, `6 PM blood sugar`):
  - `Personal wins & losses` has a legacy yellow-amber corner wash gradient (`--ds-wins`) + a nested dark/grey rounded pill (`TODAY 497 kcal eaten`) duplicating the hero dial.
  - `Food today` shows a bright pink/teal square fork-knife icon badge (`.ds-tone-icon`) and renders with a mismatched grey background in Light mode (`#eef1f3` vs `#fff`).
  - On Desktop `1280px`, `[data-empty]` forces them into cramped 3-column (25% width) boxes (`account-today.css:58`).
- **Files & Selectors:** `src/components/cupcake/noir/noir-elevate.css` (lines 112–121, 166–186, 222–237), `src/components/cupcake/account-today.css` (lines 43–62, 88–94, 115–136), `src/components/cupcake/TodayPulse.tsx` (lines 48–66).
- **Cupcake Noir Fix:**
  - In `noir-elevate.css`, unify `.cc-today-grid.is-fold-open` items (`.cc-pulse > .cc-saves`, `.cc-health-sync`, `.cc-nutrition-today`, `.cc-sugar[data-empty]`, `.cc-weight-card`) into hairline-ruled Noir sections (`background: none; border: 0; border-top: 1px solid var(--nx-hair); border-radius: 0; box-shadow: none; padding: 20px 0 6px;`).
  - Strip `.cc-nutrition-today .ds-tone-icon` and `.cc-saves` radial amber glow inside `[data-entry=account]`.
  - In `TodayPulse.tsx` (or via CSS under `.cc-today-grid .cc-saves`), hide the redundant `.cc-today-line` (`TODAY 497 kcal eaten`) when `ACCOUNT_SESSIONS` is active since Today's MultiDial already leads with calories.
  - On Desktop (`@media (min-width: 900px)` in `account-today.css`), change `[data-empty]` from `grid-column: span 3` to `grid-column: span 6` so empty fold-open sections form a balanced 2-column hairline grid instead of cramped 25%-width boxes.

### P1 Issues

#### A-4. `[P1]` `Last night` asleep display `"6 h 20 masleep"` has no space and sits flush on progress bar
- **Observed (`390px` & `1280px`, Dark & Light, Today & Fitness):** `6 h 20 m` and `asleep` nearly collide visually, and the 3px progress bar touches the descender baseline of `6 h 20 m`.
- **Files & Selectors:** `src/components/cupcake/TodayEnergy.tsx` (line 103), `src/components/cupcake/noir/noir-elevate.css` (lines 169, 195–198).
- **Cupcake Noir Fix:** In `TodayEnergy.tsx:103`, render a clear gap (`display: inline-flex; align-items: baseline; gap: 8px;`) or `<small className="cc-sleep-unit">asleep</small>` with `margin-left: 8px; font: 400 13px/1 var(--nx-text); color: var(--nx-ink-3);`, and add `margin: 12px 0 8px;` to `.cc-sleep-bar`.

#### A-5. `[P1]` `Energy balance today` 3×2 stats grid misaligns baselines on 390px
- **Observed (`390px`, Dark & Light):** `STEPS · TUE, NOV 24` wraps onto 2 lines pushing `6,420` down relative to `−372` and `−1,953`; `EXERCISE` renders `"None logged"` in huge 20px display font across 2 lines beside crisp figures `497` and `869`.
- **Files & Selectors:** `src/components/cupcake/TodayEnergy.tsx` (lines 158–165), `src/components/cupcake/noir/noir-elevate.css` (lines 201–209).
- **Cupcake Noir Fix:**
  - Make each `.cc-energy-stats div` a 2-row flex/grid column (`display: flex; flex-direction: column; justify-content: space-between;`) so all `<dd>` numerals align cleanly along the bottom edge even if a `<dt>` wraps.
  - Shorten the steps label when `steps.day.date === today` to `Steps · Today` (preventing 2-line wrap on 390px).
  - Style `.cc-energy-stats .cc-na` at `font: 400 13.5px/1.25 var(--nx-text); color: var(--nx-ink-3); opacity: 1;` instead of 20px display font (or render `—` with subtle caption).

#### A-6. `[P1]` Desktop `Today` 12-col grid leaves a 4-column dead void beside `Last night` + `Libre CGM`
- **Observed (`1280px`, Dark & Light):** When `6 PM blood sugar` is `[data-empty]` (folded into `More detail`), `Last night` (`span 4`) and `Libre CGM` (`span 4`) leave the right third of the viewport blank (`account-today.css:56-61`).
- **Files & Selectors:** `src/components/cupcake/account-today.css` (lines 55–62).
- **Cupcake Noir Fix:** Add `:has()` rules at `@media (min-width: 900px)` so when exactly **2** of `.cc-sugar`, `.cc-last-night`, `.cc-cgm` are `:not([data-empty])`, each takes `grid-column: span 6;` (filling all 12 columns cleanly).

#### A-7. `[P1]` Desktop `Fitness` stretches `Steps today` and `Weight` into awkward 1000px-wide banners
- **Observed (`1280px`, Dark & Light):** `Steps today` and `Weight` stack full-width on desktop, leaving 600px of empty dark void between left metrics and right metadata/sparkline.
- **Files & Selectors:** `src/components/cupcake/noir/FitnessWorkspace.tsx` (lines 177–323), `src/components/cupcake/noir/noir-elevate.css` (add `.nx-fitness` desktop layout rules).
- **Cupcake Noir Fix:** Wrap the `Steps` and `Weight` `<article>`s in a `<div className="nx-fitness-top">` that switches to `grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); gap: 20px;` at `@media (min-width: 900px)`.

#### A-8. `[P1]` `Fitness` `Weight` card has two redundant links to the exact same handler (`onOpenWeight`)
- **Observed (`390px` & `1280px`, Dark & Light):** Top-right says `Full history >` and bottom-right beside `Quick weigh-in` says `Weight trend →` — both call `onOpenWeight`.
- **Files & Selectors:** `src/components/cupcake/noir/FitnessWorkspace.tsx` (lines 257–260, 292–294).
- **Cupcake Noir Fix:** Keep `Full history >` in the card header and remove the duplicate `Weight trend →` link beside `Quick weigh-in` (letting `Quick weigh-in` sit cleanly as the single action button).

#### A-9. `[P1]` `WeekView` (`Wins & losses`) 3-column summary row misaligned & `Calories unavailable` wraps awkwardly
- **Observed (`390px`, Dark & Light):** In `.cc-dashboard-cards` (`—`, `$16.40`, `187.2 lb`), `187.2 lb` sits higher than `—` and `$16.40` because the 3 cards have different vertical text lengths and no `align-content: start` / top alignment (`noir-history.css:15-19`), and `187.2 lb` is tight against column edges.
- **Files & Selectors:** `src/components/cupcake/noir/noir-history.css` (lines 15–19).
- **Cupcake Noir Fix:** Add `display: grid; align-content: start; padding: 14px 10px;` on `.cc-dashboard-cards > .cc-dashboard-card` (with `padding-left: 0` on `:first-child`), and use `font-size: clamp(20px, 5.5vw, 24px)` on `strong` so `187.2 lb` never crowds its hairline divider.

### P2 Issues

#### A-10. `[P2]` `OutcomeBalance` (`noir-outcomes.css`) hardcoded `rgba(255,255,255,...)` invisible in Light mode
- **Observed (`390px` & `1280px`, Light):** Unscored tally dots (`.nx-wl-mid i.is-unscored`, `.is-none`), split track (`.nx-wl-split`), and unscored list bullet (`.nx-wl-list i.is-unscored`) use hardcoded white `rgba(255,255,255,.07–.45)` in `noir-outcomes.css` (lines 34, 35, 39, 41, 57), washing out on Porcelain white.
- **Files & Selectors:** `src/components/cupcake/noir/noir-outcomes.css` (lines 34–41, 57).
- **Cupcake Noir Fix:** Replace hardcoded white alphas with semantic tokens: `var(--nx-hair)` for track/none dot, `var(--nx-ink-3)` for unscored ring/segment (`box-shadow: inset 0 0 0 1.5px var(--nx-ink-3);`, `background: color-mix(in oklab, var(--nx-ink-3) 55%, transparent);`).

#### A-11. `[P2]` `Today` `Details` pill & `Food log` link height (`32px`) flagged as compact touch targets
- **Observed (`390px`):** `button.nx-md-drill` (`78×32`) and `button.nx-link` (`67×32`) measure 32px visually (`noir-today.css:58`).
- **Files & Selectors:** `src/components/cupcake/noir/noir-today.css` (line 58), `src/components/cupcake/noir/noir-elevate.css` (line 186).
- **Cupcake Noir Fix:** Bump `min-height: 36px` on `.nx-link` and `.cc-heading-row .cc-text-button` (while keeping the expanded `::after` hit area from `noir-native.css`).

#### A-12. `[P2]` `AccountWorkoutPlan` card inherits legacy boxed frame when Labs flag is enabled
- **Observed (Code audit):** `AccountWorkoutPlan.tsx:51` renders `<section className="cc-card cc-workout-plan">` inside `FitnessWorkspace` without Noir styling.
- **Files & Selectors:** `src/components/cupcake/noir/noir-elevate.css`, `src/components/cupcake/AccountWorkoutPlan.tsx`.
- **Cupcake Noir Fix:** Style `.nx-fitness .cc-workout-plan` as a hairline-ruled Noir section with Outfit heading and clean day rows matching `noir-plan.css`.

---

## Lane B (`polish-food-library`) — Food (All 4 Tabs), Library & Saved Audio

### P0 Issues

#### B-1. `[P0]` `Food log` duplicates full photo & manual entry cards below the fold (two glowing primary CTAs on one screen)
- **Observed (`390px` & `1280px`, Dark & Light):** At `y=0`, `.nx-food-hero` presents glowing primary `Snap photo` + secondary `Manual entry`. Scrolling to `y=1520` reveals a SECOND full `Log a food photo` section with a SECOND glowing primary cyan button (`Take meal photo`) + `Choose meal photo`, PLUS an `Add a meal` card right below it! Violates Noir's one-primary-action-per-screen hierarchy and adds ~360px of redundant scroll height.
- **Files & Selectors:** `src/components/cupcake/account-food.css` (lines 7–11, 155–159), `src/components/cupcake/AccountFoodSections.tsx`, `src/components/cupcake/NutritionWorkspace.tsx`.
- **Cupcake Noir Fix:**
  - When `.cc-account-photo` is idle (`:not([data-active=true])`) inside `.nx-food-log-stack`, demote its `Take meal photo` CTA to a quiet secondary pill (matching `Choose meal photo`) or collapse the idle utility row under a compact hairline disclosure (`Upload from gallery or enter by hand ▾`) while keeping `[data-active=true]` promoted to `order: 0` when a photo is active/uploading!
  - Ensure only `.nx-food-snap-btn` carries the primary gradient fill on the Food log screen.

### P1 Issues

#### B-2. `[P1]` `Food log` card-style collision (`account-food.css` re-boxes meal rows & overview against `noir-history.css`)
- **Observed (`390px`, Dark & Light):** `account-food.css` lines 108–123 wrap `.cc-nutrition-timeline-item button` and `.cc-nutrition-overview` in `border-radius: 16px/20px; border-color: var(--nx-hair); background: var(--nx-surface)`, fighting `noir-history.css:47-51` and creating clunky stacked rounded boxes below the fold (`caribbean-dark-390-food-log-y760.png`). Also `How these numbers work`, `Coverage & data notes`, and `Targets & estimates` float as three unruled teal text links with uneven gaps.
- **Files & Selectors:** `src/components/cupcake/account-food.css` (lines 108–132, 149–152).
- **Cupcake Noir Fix:**
  - Align `.cc-nutrition-timeline-item button` and `.cc-nutrition-overview` to Cupcake Noir's hairline-ruled style (`border: 0; border-bottom: 1px solid var(--nx-hair); border-radius: 0; background: transparent; padding: 14px 2px;`) with subtle hover tint (`background: var(--nx-surface)`).
  - Unify `.cc-nutrition-method` and `.cc-nutrition-settings` summaries into consistent 46px hairline rows (`border-top: 1px solid var(--nx-hair); color: var(--nx-ink-2);`) with crisp right-aligned chevrons.

#### B-3. `[P1]` `Receipts` error banner collides with `Groceries & pantry` pill (0px gap) + broken left-border curve + tiny 16×39 dismiss button
- **Observed (`390px` & `1280px`, Dark & Light):** In `Food → Receipts` and `Library → Receipts`, `.cc-error` touches the bottom border of the `Groceries & pantry` pill with 0px spacing, its amber `border-left: 2px` wraps around a `16px` top-left corner radius creating a jagged yellow crescent, and its `×` dismiss button measures `16×39px` (below 44px touch target).
- **Files & Selectors:** `src/components/cupcake/ReceiptWorkspace.tsx`, `src/components/cupcake/noir/noir-pages.css` (line 75).
- **Cupcake Noir Fix:**
  - Add `margin: 12px 0;` on `.cc-receipts .cc-error` and enforce `border-radius: 0 12px 12px 0 !important;` in `noir-pages.css:75` so the left amber accent bar is crisp and vertical.
  - Give `.cc-error button` `min-width: 44px; min-height: 44px; display: grid; place-items: center; flex: none;` so the `×` dismiss target meets 44×44px accessibility.

#### B-4. `[P1]` `Groceries` `Household pantry` placeholder truncates mid-word (`"e.g. Eg"`) & `Add`/`Stock` disabled buttons fail AA contrast (`3.01:1`)
- **Observed (`390px` & `1280px`, Dark & Light):**
  - In `caribbean-light-390-food-groceries-y760.png`, `"Add staple on hand, e.g. Eggs"` clips to `"Add staple on hand, e.g. Eg"`.
  - Empty-state disabled `Add` and `Stock` buttons measure **`cr=3.01`** in Light mode and **`cr=4.10–4.28`** in Dark mode (`opacity: .45` on secondary button).
  - In `AccountFoodPlan` Light mode, `.nx-pantry-receipts-link` (`Receipts`) measures **`cr=3.99`** (`12px` teal text on tinted grey pill) and `.nx-pantry-low-btn` uses hardcoded dark text `#160e02` on `--nx-warm` (`#a85b00` in Light mode).
- **Files & Selectors:** `src/components/cupcake/AccountFoodPlan.tsx`, `src/components/cupcake/noir/noir-plan.css` (lines 146–163, 185–187, 218–220).
- **Cupcake Noir Fix:**
  - Shorten placeholder in `AccountFoodPlan.tsx` to `"Add staple (e.g. eggs, rice)"` so it fits comfortably inside 390px with the `Stock` button.
  - In `noir-plan.css`, style disabled `.cc-grocery-add .cc-secondary:disabled` and `.nx-pantry-add .cc-secondary:disabled` with explicit `opacity: 1; color: var(--nx-ink-3); background: var(--nx-surface); border-color: var(--nx-hair);` (ensuring `>=4.5:1` contrast) and give `.nx-pantry-receipts-link` `background: transparent; color: var(--cc-pink-bright, var(--nx-a));`.
  - In `noir-plan.css:162`, use `color: var(--cc-ink, #160e02)` on `.nx-pantry-low-btn` so Light mode gets crisp `#ffffff` on `#a85b00`.

#### B-5. `[P1]` `Food → Plan & groceries` Desktop Light mode has downward arrow `↓` on `Shop this plan` pointing nowhere
- **Observed (`1280px`, Dark & Light):** In the 2-column desktop split (`Meal plan` left, `Groceries` right), the `Shop this plan` card at the bottom of the left column displays a downward arrow `↓` even though Groceries is in the right column (and already has a `Shop your meal plan / Choose meal plan items` card at the top of the right column!).
- **Files & Selectors:** `src/components/cupcake/AccountFoodPlan.tsx`, `src/components/cupcake/noir/noir-plan.css` (lines 188–190, 227–231).
- **Cupcake Noir Fix:** On desktop `section === 'both'`, either hide the redundant mobile handoff button `.cc-plan-to-groceries` (since Groceries is already visible right beside it with `Shop your meal plan`) or point its icon right (`→`) and scroll/focus the Groceries builder cleanly.

#### B-6. `[P1]` `Library` pluralization bug (`1 artifacts · 1 total sources`), truncated search placeholder (`"pers"`), and duplicate Refresh buttons on `Review My Day`
- **Observed (`390px` & `1280px`, Dark & Light):**
  - `LibraryWorkspace.tsx:279` renders `"1 artifacts · 1 total sources"` (unpluralized for singular `1`).
  - `LibraryWorkspace.tsx:268` search placeholder `"Find a phrase, decision, person, or project"` clips mid-word to `"Find a phrase, decision, pers"` on 390px.
  - On `Library → Review My Day`, `LibraryWorkspace.tsx:258` renders a circular Refresh icon button right above `PlanningWorkspace`'s own rounded-square Refresh icon button — **two identical refresh buttons stacked ~90px apart**!
  - On `Review My Day`, disabled `Save decision` `.cc-primary` fails AA contrast (**`cr=2.25–2.60`** in Dark & Light).
- **Files & Selectors:** `src/components/cupcake/LibraryWorkspace.tsx` (lines 258, 268, 279), `src/components/cupcake/noir/noir-pages.css`.
- **Cupcake Noir Fix:**
  - Fix singular/plural in `LibraryWorkspace.tsx:279`: `${counts.browseTotal} ${counts.browseTotal === 1 ? 'artifact' : 'artifacts'} · ${counts.libraryTotal} ${counts.libraryTotal === 1 ? 'source' : 'sources'}`.
  - Shorten search placeholder to `"Search phrases, decisions, or projects"` (fits cleanly at 390px).
  - Only show the top Library Refresh button in `LibraryWorkspace.tsx:258` when `isAllView(view)` (since `Review My Day`, `Receipts`, and `Messages` each have their own scoped refresh!).
  - In `noir-pages.css`, style `.cc-shell .cc-primary:disabled` inside account views with `opacity: 1; background: var(--nx-surface-2); color: var(--nx-ink-3); box-shadow: none; border: 1px solid var(--nx-hair);` so disabled primary buttons always pass AA contrast.

#### B-7. `[P1]` `Saved audio` & `Recording Summary` / `VoiceUpdatesCard` polish in `Library` and `Assistant → Record`
- **Observed (`390px`, Dark & Light):**
  - In `noir-plan.css:204,210,212,217,225` and `noir-pages.css:47-50`, saved audio section heading (`Saved audio`) uses a fragile `:has(> h3:first-child + .cc-muted)` selector and sits flush against the bottom nav bar on 390px (`"No audio saved to this account yet."` nearly touches the Camera FAB in `Library → Messages`).
  - `account-recording-summary.css` still uses legacy `--cc-line` fallback `#302c36` and raw `<pre>` summary output with no surface/padding styling.
- **Files & Selectors:** `src/components/cupcake/noir/noir-pages.css` (lines 46–50), `src/components/cupcake/account-recording-summary.css` (lines 1–5), `src/components/cupcake/noir/noir-plan.css` (lines 281–390).
- **Cupcake Noir Fix:**
  - Add `padding-bottom: 28px;` to the Saved audio archive container so the last line clears the raised Camera FAB comfortably on 390px.
  - Upgrade `account-recording-summary.css` to use `var(--nx-hair)` divider, `var(--nx-text)` typography, and clean summary card spacing matching `.nx-audio-flow` and `.nx-voice-updates`.

### P2 Issues

#### B-8. `[P2]` `Meal plan` / `Groceries` `Reload saved plan` pill is `34px` tall (under 44px touch target) & double heading cadence
- **Observed (`390px`, Dark & Light):** `.nx-plan-reload` measures `129×34px` (`noir-plan.css:5`), and `Food` -> segmented tab `Meal plan` -> `Your meal plan` -> `SAVED PLAN LOADED FROM YOUR ACCOUNT` -> `Lean week` stacks 4 stacked headings before the first meal row.
- **Files & Selectors:** `src/components/cupcake/noir/noir-plan.css` (lines 3–16), `src/components/cupcake/AccountFoodPlan.tsx`.
- **Cupcake Noir Fix:** Bump `.nx-plan-reload` `min-height: 40px` (or add `position: relative` hit pad) and tighten vertical spacing between `.cc-plan-save-state` and `.nx-plan-read h4`.

#### B-9. `[P2]` `Food` hero dial head dot & hardcoded dark colors in `account-food.css` and `noir-plan.css`
- **Observed (`390px`, Light & Dark):** `account-food.css:64` sets `.nx-food-snap-btn { color: #021412; }` and `noir-plan.css:212,225` hardcode `#021412` on checked grocery checkmark and dirty Save button; `noir-plan.css:199,217` hardcode `rgba(238,244,245,.8/.72)` on import summary and grocery notes.
- **Files & Selectors:** `src/components/cupcake/account-food.css` (lines 26, 27, 32, 53, 64), `src/components/cupcake/noir/noir-plan.css` (lines 194, 199, 204, 210, 212, 217, 225).
- **Cupcake Noir Fix:** Replace hardcoded `rgba(238,244,245,...)` and `rgba(255,255,255,...)` with `var(--nx-ink-2)`, `var(--nx-hair)`, `var(--nx-surface)`, and use `var(--cc-ink)` for text/checkmarks on `--nx-a` primary fills (white in Light mode, deep dark in Dark mode).

#### B-10. `[P2]` `Food log` Day/Week/Month/Year segmented control vs arrow buttons alignment on 390px
- **Observed (`390px`, Dark & Light):** Below the 4-tab `Day | Week | Month | Year` segmented bar, the `< Today >` arrow group aligns right on a separate empty row leaving 180px of dead space on the left.
- **Files & Selectors:** `src/components/cupcake/account-food.css` (lines 99–104), `src/components/cupcake/NutritionWorkspace.tsx`.
- **Cupcake Noir Fix:** Place the date label (`Tuesday, Nov 24`) or compact range summary inline on the left opposite `< Today >` on narrow screens, eliminating the awkward half-empty row.

---

## Lane C (`polish-settings-motion`) — Settings, Sharing & Reports, Connections, Assistant, Notifications, Motion & Light Porcelain

### P0 Issues

#### C-1. `[P0]` `Sharing & Reports` layout breaks inside Desktop `1280px` Settings drawer
- **Observed (`1280px`, Dark & Light):** When `Sharing & Reports` is expanded inside `.cc-settings-panel` (~360–420px wide), `.cc-coach-context` stays a horizontal flex row (`reports.css:23,27`) beside the `"MyCupcake — Synthetic B"` pill (`max-width: 46%`), crushing `"Reports / shared / with you"` into 3 cramped lines. Worse, opening any client report inside Settings triggers `@media (min-width: 900px)` (`reports.css:184–190`), forcing `.cc-rep-kpis` into **4 columns** and `.cc-rep-grid` into **2 columns** inside the narrow drawer!
- **Files & Selectors:** `src/components/cupcake/reports/reports.css` (lines 23–28, 73, 184–211).
- **Cupcake Noir Fix:**
  - Add explicit `.cc-settings-panel .cc-coach` rules (loaded after the `@media (min-width: 900px)` block) that ALWAYS stack `.cc-coach-context` vertically (`flex-direction: column; gap: 10px;`), set `.cc-coach-context > .cc-secondary { max-width: 100%; align-self: flex-start; }`, keep `.cc-rep-grid { grid-template-columns: 1fr; }`, keep `.cc-rep-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }`, and scale `.cc-rep-headline` to `26px` inside Settings.
  - Also extend line 207 `.cc-shell .cc-coach .cc-rep-card` to `:is(.cc-shell, .cc-settings-panel) .cc-coach .cc-rep-card` so report cards inside Settings receive Noir hairline styling too!
  - Remove hardcoded `color-scheme: dark` on `.cc-rep-through input` (line 73) so Light Porcelain inherits `color-scheme: light`.

#### C-2. `[P0]` Light Porcelain: Dark/black dial head dots, invisible `Avery Lindqvist` avatar letter, and Light mode white-card clobbering on `WeekView`
- **Observed (`390px` & `1280px`, Light mode, Caribbean & Rose):**
  1. **Dial head dots inverted to black:** On `Today` MultiDial, `Food` hero dial, and `Glucose` chart active point, the indicator dot center renders **solid black** (`#0c1417`) instead of luminous white (`#fff`) because `noir-light.generated.css` inverted `#fff` / `var(--nx-ink)`!
  2. **Invisible client avatar `"A"`:** In `Settings → Sharing & Reports`, `.cc-rep-avatar[data-tone=b]` (`reports.css:49`) computes `color: color-mix(in srgb, var(--cc-ocean) 50%, #fff)` on a pale blue circle — ~1.5:1 contrast, almost unreadable in Light mode!
  3. **`WeekView` hairline cards clobbered to white shadow cards:** `noir-light.css:87` (`.cc-shell :is(.cc-card, .cc-dashboard-card)`) has higher specificity (`[class]`) than `noir-history.css:11,20,26`, turning quiet hairline notes (`Purchase-call outcomes unavailable`, `No calorie or spending data to chart`) into bulky floating white shadow cards (`before-week-signals-light-390.png`).
  4. **Today `Timeline` dots have grey halo ring:** `.cc-tl-node` `box-shadow: 0 0 0 4px #030607` gets inverted to a muddy grey ring on Porcelain `#f4f6f7`.
- **Files & Selectors:** `src/components/cupcake/noir/noir-light.css` (lines 86–171), `src/components/cupcake/noir/noir-charts.css` (lines 11, 37, 47–48), `src/components/cupcake/reports/reports.css` (lines 6–19, 48–49).
- **Cupcake Noir Fix:**
  - In `noir-light.css`:
    - Restore crisp white centers on dial/chart active heads: `:root[data-cc-scheme=light] .cc-app[data-entry=account][class][class] :is(.nx-dial-head, .nx-food-head, .nx-head) { fill: #ffffff; }` and `.nx-bar.is-now { fill: var(--cc-pink-bright); }` (stops Today's calorie bar from turning pitch black!).
    - Fix `.cc-tl-node` cutout halo in Light mode to match porcelain ground: `box-shadow: 0 0 0 4px var(--cc-bg); background: var(--nx-ink-3);`.
    - Exclude hairline-ruled Noir sections from `.cc-shell :is(.cc-card, .cc-dashboard-card)` white-card elevation (`:not(.cc-dashboard-card, .cc-dashboard-chart, .cc-saves, .cc-signals, .cc-last-night, .cc-sugar, .cc-cgm, .cc-energy-curve, .cc-health-sync, .cc-nutrition-today)`), AND explicitly give `.nx-food-hero` and `.nx-pantry` crisp `#ffffff` Porcelain cards with `box-shadow: var(--nx-card-shadow)`!
    - Add `.cc-library-tabs` to the iOS-style white-thumb segmented control block at `noir-light.css:120-125`.
    - Override `reports.css` tokens in Light mode (`--rp-hair: var(--nx-hair); --rp-hair-2: rgba(12,24,28,.15); --rp-s1: #ffffff; --rp-s2: rgba(12,24,28,.04);`) and set `.cc-rep-avatar[data-tone=b] { color: var(--cc-ocean); }` (deep AA ocean blue on soft blue wash!).

#### C-3. `[P0]` `Assistant → Record` waveform box has jagged clipped neon top/bottom lines & `Live voice` saved conversation card has 0px left padding
- **Observed (`390px`, Dark & Light):**
  - In `Assistant → Record` (`caribbean-dark-390-assistant-record-y0.png`, `caribbean-light-390-assistant-record-y0.png`), `.cc-recorder` displays sharp unrounded horizontal teal top & bottom borders with no side borders/radius (looking broken/clipped), and `Import audio` floats right-aligned by itself below.
  - In `Assistant → Live voice` (`caribbean-light-390-assistant-voice-y0.png`), the `SAVED VOICE CONVERSATIONS` item has a subtle card shadow underneath `11/24/2026, 7:31:43 AM` with **0px left padding** so text touches the card edge.
- **Files & Selectors:** `src/components/cupcake/noir/assistant/noir-assistant.css`, `src/components/cupcake/noir/noir-light.css`.
- **Cupcake Noir Fix:**
  - In `noir-assistant.css`, style `.cc-assistant-workspace .cc-recorder` cleanly with `border: 1px solid var(--ax-hair); border-radius: 22px; background: var(--ax-glass); padding: 24px 18px;` (and in `noir-light.css`, `background: #ffffff; box-shadow: var(--nx-card-shadow);`), and center or full-width align the `Import audio` secondary action cleanly below.
  - Style saved voice conversation rows inside `.cc-assistant-workspace` with clean `padding: 14px 16px; border-radius: 16px; border: 1px solid var(--ax-hair); background: var(--ax-glass);` (white on Light Porcelain) so timestamps never touch the edge.

### P1 Issues

#### C-4. `[P1]` `Settings` has duplicate `Sign out` actions + 3 inconsistent disclosure icon styles (`+`/`−`, native `▶`, Lucide chevron) + orphaned `Mobile app connections` heading
- **Observed (`390px` & `1280px`, Dark & Light):**
  - `Account & security` lists `Sign out` + `Sign out all devices`, while `CupcakeSettings.tsx` footer adds another full-width `Sign out` button.
  - `SettingsGroup` uses `+` / `−`, `Download my data` inner `<details>` use raw browser triangles `▶`, and `ConnectionsHub` uses Lucide `ChevronRight` — 3 clashing disclosure indicators in one drawer.
  - `Mobile app connections` renders as a plain heading wedged between two horizontal rules with no disclosure icon or content, looking like a broken accordion.
- **Files & Selectors:** `src/components/cupcake/cupcake-settings.css` (lines 1–15), `src/components/cupcake/CupcakeSettings.tsx`, `src/components/cupcake/noir/noir-connect.css`.
- **Cupcake Noir Fix:**
  - Normalize all nested `<details> > summary` inside `.cc-settings-panel` in `cupcake-settings.css` (`list-style: none;`, hide `::-webkit-details-marker`, unified subtle CSS chevron `›` rotating 90° on `[open]`) so every disclosure inside Settings shares one refined Noir chevron language.
  - Refine `.cc-settings-group > summary::after` from chunky `20px` `+`/`−` to a crisp rotated chevron matching `ConnectionsHub`, with smooth `transform .22s var(--nx-ease)` transition.
  - Add clean vertical spacing/group rhythm in `cupcake-settings.css` so subsections don't double-border.

#### C-5. `[P1]` `Settings → Account & security` & `Connections` low-contrast controls (`cr=2.20–4.39`) & hardcoded dark colors
- **Observed (`390px` & `1280px`, Dark & Light):**
  - `Create recovery code` disabled text button measures **`cr=2.20`** (Rose Dark) and **`cr=3.28`** (Caribbean Dark).
  - `Change password` disabled secondary button measures **`cr=4.07–4.20`** (Dark).
  - `.nx-connect-badge` (`Soon`) measures **`cr=4.34–4.39`** (Dark).
  - `connections.css:17–19` hardcode `rgba(238,244,245,.72/.8)` for `.nx-connect-note` & `.nx-connect-steps ol` and `#021412` on `.nx-connect-cta`.
- **Files & Selectors:** `src/components/cupcake/cupcake-settings.css`, `src/components/cupcake/noir/connections.css` (lines 12, 17–20), `src/components/cupcake/noir/noir-connect.css` (lines 10, 12), `src/components/cupcake/noir/noir-light.css`.
- **Cupcake Noir Fix:**
  - Replace hardcoded `rgba(238,244,245,...)` in `connections.css` with `var(--nx-ink-2)` and `.nx-connect-cta` color with `var(--cc-ink)` (white on Light Porcelain).
  - Raise `.nx-connect-badge` text color to `var(--nx-ink-2)` (passes AA cleanly in both Dark and Light).
  - In `cupcake-settings.css`, override disabled buttons inside `.cc-settings-panel` to `opacity: 1; color: var(--nx-ink-3);` (with `--nx-ink-3` bumped to `>= rgba(238,244,245,.58)` inside Settings so disabled buttons and captions always exceed 4.5:1!).

#### C-6. `[P1]` `NotificationsPopover` icon buttons (`34×34`) under 44px touch target & subtle popover entrance motion
- **Observed (`390px`, Dark & Light):** `Refresh notifications` and `Close notifications` (`.nx-notif-icon-btn`) measure `34×34px` in `metrics.json` (flagged in `smallTargets`).
- **Files & Selectors:** `src/components/cupcake/noir/NotificationsPopover.tsx`, `src/components/cupcake/noir/noir-native.css` (lines 16–20), `src/components/cupcake/noir/noir-light.css` (lines 151–168).
- **Cupcake Noir Fix:** Add `.nx-notif-icon-btn` to the 44px touch-target expander in `noir-native.css:16-20` (or bump size to `38×38` with `-3px` pseudo hit-area), and ensure `.nx-notif-panel` enters with a crisp GPU-only `transform` + `opacity` curve (`cubic-bezier(.22, 1, .36, 1)`) respecting `prefers-reduced-motion: reduce`.

#### C-7. `[P1]` `Assistant` footer buttons (`32px`) & `How voice works` (`32px`) small targets + nested composer radius mismatch
- **Observed (`390px`, Dark & Light):**
  - `Private Library & originals` (`165×32`), `Show floating companion` (`144×32`), and `How voice works` (`112×32`) are `32px` tall.
  - `metrics.json` flagged nested radius mismatch: `div.cc-chat-composer.cc-chat-pill(r=24)` inside `section.cc-assistant-workspace.is-panel(r=22)` (inner radius > outer radius!).
- **Files & Selectors:** `src/components/cupcake/noir/assistant/noir-assistant.css` (lines 26–34, 120–135), `src/components/cupcake/noir/noir-native.css` (lines 16–20).
- **Cupcake Noir Fix:**
  - Bump `.cc-assistant-footer button` to `min-height: 36px` (plus `noir-native.css` hit pad) and add `.nx-voice-about > summary` to `noir-native.css` hit-area expansion.
  - Align `.cc-assistant-workspace.is-panel` outer radius on floating/modal breakpoints (`border-radius: 26px`) or tighten inner composer pill radius so inner radius is strictly `<= outer - padding`.

#### C-8. `[P1]` Motion & Easing anti-patterns (`right` layout animation + touch `transition` clobbering)
- **Observed (Static CSS audit):**
  1. `noir-assistant.css:112` animates layout property **`transition: right .22s var(--ax-ease)`** on the Read-aloud toggle thumb instead of GPU-composited `transform: translateX(...)`.
  2. `noir-native.css:11` sets `@media (hover: none) { button, summary, ... { transition: opacity .28s ease; } }`, which **clobbers every component's `transform`, `background`, and `border-color` transitions** on touch devices!
  3. Multiple stylesheets mix ad-hoc `ease`, `cubic-bezier(.3,.7,.4,1)`, `cubic-bezier(.2,.8,.2,1)`, and `cubic-bezier(.3,.7,.2,1)` without a single shared Noir motion token.
- **Files & Selectors:** `src/components/cupcake/noir/assistant/noir-assistant.css` (lines 110–116), `src/components/cupcake/noir/noir-native.css` (lines 9–13), `src/components/cupcake/noir/noir-charts.css` (lines 51–58).
- **Cupcake Noir Fix:**
  - Define unified Noir motion tokens (`--nx-ease: cubic-bezier(.22, 1, .36, 1); --nx-ease-press: cubic-bezier(.3, .7, .4, 1);`) and refactor `noir-assistant.css:110-115` to position the toggle thumb at `right: 20px` and animate **`transform: translateX(16px)`** on checked state (`transition: transform .22s var(--ax-ease)`).
  - In `noir-native.css:11`, restrict the touch-press opacity rule so it doesn't wipe out `transform` transitions (or use `transition-property: opacity, transform; transition-duration: .22s, .14s; transition-timing-function: var(--nx-ease, ease);`).

#### C-9. `[P1]` `noir-charts.css` Light mode tooltip `.nx-readout` & chart markers use hardcoded dark backgrounds
- **Observed (Code & Light mode audit):** `noir-charts.css:41-48` hardcodes `background: rgba(14,20,24,.92); border: 1px solid rgba(255,255,255,.12);` on `.nx-readout`, `rgba(255,255,255,.12/.35)` on `.nx-marker` and `.nx-bar-missing`, and `stroke: rgba(255,255,255,.06/.1/.3)` on `.nx-dial-track` and `.nx-tick`.
- **Files & Selectors:** `src/components/cupcake/noir/noir-charts.css` (lines 2–11, 41–48), `src/components/cupcake/noir/noir-light.css`.
- **Cupcake Noir Fix:** Add Light Porcelain overrides in `noir-light.css` for `.nx-readout` (`background: rgba(255,255,255,.96); border: 1px solid var(--nx-hair); color: var(--nx-ink); box-shadow: 0 10px 28px -10px rgba(12,20,23,.2);`), `.nx-marker`, `.nx-bar-missing` (`fill: rgba(12,24,28,.16)`), and `.nx-dial-track` (`stroke: rgba(12,24,28,.08)`).

### P2 Issues

#### C-10. `[P2]` Global `--nx-ink-3` dark opacity (`0.48`) borders on weak AA contrast for small captions (`11–12px`)
- **Observed (`metrics.json` `weakRgba`):** `noir-charts.css:2` sets `--nx-ink-3: rgba(238,244,245,.48)`, which lands right at `~4.50:1` on `#030607` and drops slightly below AA on slightly lighter glass surfaces (`small cr=4.50` in `reports.css`, `nx-connect-badge cr=4.34`).
- **Files & Selectors:** `src/components/cupcake/noir/noir-charts.css` (line 2), `src/components/cupcake/reports/reports.css` (line 13).
- **Cupcake Noir Fix:** Bump Dark `--nx-ink-3` from `.48` to `rgba(238,244,245,.58)` in `noir-charts.css:2` and `--rp-ink-3` in `reports.css:13` from `46%` to `58%` (keeps the quiet Noir hierarchy while guaranteeing `>5.8:1` WCAG AA contrast on every dark surface!).

#### C-11. `[P2]` `ConnectionsHub` platform line reads `"On a computer · every option shown"` on narrow viewports with desktop UA
- **Observed (`390px` viewport):** `ConnectionsHub.tsx:10-16` checks only `navigator.userAgent`, so responsive mobile windows or narrow tablets get all 5 `<details>` rows expanded at once (`startOpen` returns `true` for every row when `platform === 'desktop'`), bloating Settings panel scroll height to `6,309px`.
- **Files & Selectors:** `src/components/cupcake/noir/ConnectionsHub.tsx` (lines 23–26).
- **Cupcake Noir Fix:** Keep rows collapsed by default (or only open the top relevant row) when `window.innerWidth < 768` so Settings stays compact and scannable.

#### C-12. `[P2]` `Settings → Sharing & Reports` `Reload` button (`46×32`) compact target
- **Observed (`390px`):** `.cc-rep-quiet` measures `46×32px` (`reports.css:40`).
- **Files & Selectors:** `src/components/cupcake/reports/reports.css` (line 40).
- **Cupcake Noir Fix:** Bump `min-height: 38px; padding: 6px 8px;` (keeps quiet look while improving tap ergonomics).

#### C-13. `[P2]` `CupcakeSettings` footer `Sign out` spacing & visual separation from danger `Close account access`
- **Observed (`390px` & `1280px`, Dark & Light):** When `Close account access` and `Connections` are collapsed, the Settings footer `Sign out` sits nicely at the bottom, whereas inside `Account & security` there is a duplicate `Sign out` text link.
- **Files & Selectors:** `src/components/cupcake/CupcakeSettings.tsx`, `src/components/cupcake/cupcake-settings.css` (lines 10–11).
- **Cupcake Noir Fix:** Style `.cc-settings-signout` cleanly as a calm rounded pill with subtle hairline border (`border-radius: 14px; background: var(--nx-surface); border: 1px solid var(--nx-hair);`) and ensure generous bottom safe-area padding (`padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px))`).
