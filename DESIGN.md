# Cupcake Noir Design System (`DESIGN.md`)

> Authoritative design-engineering specification for the Cupcake Account App (`data-entry="account"`). Every human and AI coding agent (Antigravity, Claude Code, Cursor, ChatGPT Codex) MUST follow these rules above **and** below the fold.

---

## 1. Aesthetic Philosophy & Theme Matrix

**Cupcake Noir** is a quiet, instrument-grade health and voice companion:
- **Layered depth over borders**: Near-black obsidian canvases with a subtle top radial atmospheric wash (`::before`) and `1px` hairlines (`--nx-hair`) instead of heavy boxes or nested frames.
- **Designed Porcelain light mode**: Light theme is *not* an automatic inversion—porcelain grounds lift crisp `#ffffff` cards via soft ambient shadow (`--nx-card-shadow`), paired with AA-deepened jewel accents.
- **Color only for meaning**: Monochrome chrome; reserve chromatic accent for primary actions, interactive links, active indicators, and quantitative data.
- **Light display numerals, calm UI chrome**: Airy `Outfit` (`200`/`300`) numerals paired with grounded `Inter` (`400`/`500`/`600`) labels.

### Dual-Theme × Dual-Appearance Matrix

| Dimension | Selector | Caribbean Teal (Cupcake) | Violet / Rose (Matthieu) |
| --- | --- | --- | --- |
| **Dark Noir** (default) | `.cc-app[data-entry=account]` | Canvas `#030607` (`#04070a` base), Header `rgba(4,7,10,.82)`, Teal `#39e6d2` + Ocean `#328dff` | `[data-appearance=rose]` Canvas `#050409` (`#07060b` base), Header `rgba(7,6,11,.82)`, Violet `#ae78ff` + Indigo `#8650d5` |
| **Light Porcelain** | `:root[data-cc-scheme=light]` | Ground `#f4f6f7`, Header `rgba(245,249,250,.86)`, Deep Teal `#007a70` + Blue `#1767d1` | Ground `#f6f4f9`, Header `rgba(246,245,249,.86)`, Deep Violet `#6b3cc9` + Indigo `#4a2fa8` |
| **Hot Accent Heat** | `:root[data-accent-heat=hot]` | Dark `#30f0d7` / `#4c9dff` · Light `#00756a` / `#0f5ec4` | Dark `#be8cff` / `#9b67ea` · Light `#6a2fd6` / `#4a22b0` |

### Scoping & Light-Mode Specificity Architecture
1. **Strict Account Scoping**: Every Noir/account rule MUST be scoped to `.cc-app[data-entry=account]` (or `.cc-app.cc-account-gate` for sign-in). Never break the legacy `/cupcake` app (`.cc-app` without `data-entry="account"`) or Robyn's viewer (`.rv`).
2. **Generated Light Layer (`noir-light.generated.css`)**: `scripts/build-noir-light.mjs` walks the ES module CSS import graph from `src/pages/cupcake/sandbox/cupcakegpt/page.tsx` and re-emits every dark color declaration prefixed with `:root[data-cc-scheme=light]` (adding `(0,2,0)` specificity while preserving cascade order). **Never hand-edit `noir-light.generated.css`.**
3. **Hand-Tuned Light Layer (`noir-light.css`)**: Loaded *after* `noir-light.generated.css`. Token blocks and critical overrides repeat `[class]` (e.g., `:root[data-cc-scheme=light] .cc-app[class][class][class][class]`) so they outrank generated rules regardless of load order.
4. **Mandatory Workflow**: After **any** edit to any file under `src/components/cupcake/**/*.css`, run:
   ```bash
   node scripts/build-noir-light.mjs
   ```

---

## 2. Color Tokens, Contrast Floors & Dark Islands

### Core Surface, Ink & Accent Tokens (`--nx-*` & `--cc-*`)

| Token | Dark Noir (Caribbean) | Dark Noir (Rose) | Light Porcelain (Caribbean) | Light Porcelain (Rose) |
| --- | --- | --- | --- | --- |
| `--cc-bg` (base / elevate canvas) | `#050a0d` (`#04070a` / `#030607`) | `#09070d` (`#07060b` / `#050409`) | `#f4f6f7` | `#f6f4f9` |
| `--cc-surface` / `--cc-surface-2` | `#0c171d` / `#132631` | `#16111f` / `#241a31` | `#ffffff` / `#eef1f3` | `#ffffff` / `#f0edf5` |
| `--cc-border` / `--cc-line` | `#29434f` / `#29434f` | `#4c3b63` / `#352841` | `rgba(12,24,28,.1)` / `rgba(12,24,28,.08)` | `rgba(30,16,52,.1)` / `rgba(30,16,52,.08)` |
| `--cc-text` / `-2` / `-3` | `#edf8fc` / `#b7ccd5` / `#9fb7c2` | `#f3eefb` / `#d0c2e4` / `#b6a4ce` | `#0c1417` / `#424b50` / `#5f686d` | `#150e21` / `#473e55` / `#62597a` |
| `--cc-pink` / `--cc-pink-bright` | `#39e6d2` / `#80eee1` | `#ae78ff` / `#d6b8ff` | `#007a70` / `#006a61` | `#6b3cc9` / `#5a2fb5` |
| `--cc-ocean` / `--cc-ink` (CTA text) | `#328dff` / `#042d33` (`#021412`) | `#8650d5` / `#180d27` (`#12081f`) | `#1767d1` / `#ffffff` | `#4a2fa8` / `#ffffff` |
| `--nx-a` / `--nx-a2` | `var(--cc-pink)` / `var(--cc-ocean)` | `var(--cc-pink)` / `var(--cc-ocean)` | `var(--cc-pink)` / `var(--cc-ocean)` | `var(--cc-pink)` / `var(--cc-ocean)` |
| `--nx-good` / `--nx-warm` / `--nx-bad` | `var(--nx-a)` (`#4be08f` chart) / `#ffb547` / `#ff6b7a` | `var(--nx-a)` / `#ffb547` / `#ff6b7a` | `#007a70` / `#a85b00` / `#c02a3e` | `#6b3cc9` / `#a85b00` / `#c02a3e` |
| `--nx-ink` / `--nx-ink-2` / `--nx-ink-3` | `var(--cc-text, #eef4f5)` / `rgba(238,244,245,.7)` / `rgba(238,244,245,.48)` | `#f3eefb` / `rgba(238,244,245,.7)` / `rgba(238,244,245,.48)` | `#0c1417` / `rgba(12,20,23,.74)` / `rgba(12,20,23,.62)` | `#150e21` / `rgba(21,14,33,.74)` / `rgba(21,14,33,.62)` |
| `--nx-hair` | `rgba(255,255,255,.07)` | `rgba(255,255,255,.07)` | `rgba(12,24,28,.09)` | `rgba(30,16,52,.09)` |
| `--nx-surface` / `--nx-surface-2` | `rgba(255,255,255,.028)` / `rgba(255,255,255,.05)` | `rgba(255,255,255,.028)` / `rgba(255,255,255,.05)` | `rgba(12,24,28,.035)` / `rgba(12,24,28,.06)` | `rgba(30,16,52,.035)` / `rgba(30,16,52,.06)` |
| `--nx-card` / `--nx-card-shadow` | Gradient `rgba(255,255,255,.035→.012)` / `none` | Gradient `rgba(255,255,255,.035→.012)` / `none` | `#ffffff` / `0 1px 2px rgba(16,30,36,.04), 0 8px 28px -12px rgba(16,30,36,.12)` | `#ffffff` / `0 1px 2px rgba(30,16,52,.04), 0 8px 28px -12px rgba(30,16,52,.14)` |

### Assistant (`--ax-*`) & Library (`--lx-*`) Scoped Tokens

| Token | Dark Noir (Caribbean) | Dark Noir (Rose) | Light Porcelain (Caribbean) | Light Porcelain (Rose) |
| --- | --- | --- | --- | --- |
| `--ax-panel` | `#070b0e` | `#0b0911` | `#f9fafb` | `#faf9fc` |
| `--ax-hair` / `--ax-hair-2` | `rgba(255,255,255,.07)` / `.11` | `rgba(255,255,255,.07)` / `.11` | `rgba(12,24,28,.09)` / `.14` | `rgba(30,16,52,.09)` / `.14` |
| `--ax-glass` / `--ax-glass-2` | `rgba(255,255,255,.045)` / `.075` | `rgba(255,255,255,.045)` / `.075` | `rgba(12,24,28,.04)` / `.07` | `rgba(12,24,28,.04)` / `.07` |
| `--ax-ink` / `-2` / `-3` | `#eef4f5` / `rgba(238,244,245,.74)` / `.58` | `#f3effa` / `rgba(243,239,250,.74)` / `.58` | `#0c1417` / `rgba(12,20,23,.74)` / `.62` | `#150e21` / `rgba(21,14,33,.74)` / `.62` |
| `--lx-hair` / `--lx-hair-2` | `rgba(255,255,255,.07)` / `.11` | `rgba(255,255,255,.07)` / `.11` | `rgba(12,24,28,.09)` / `.14` | `rgba(30,16,52,.09)` / `.14` |
| `--lx-surface` / `--lx-glass` | `linear-gradient(180deg, rgba(255,255,255,.04), .015)` / `rgba(255,255,255,.045)` | Same as Caribbean | `#ffffff` / `rgba(12,24,28,.04)` | `#ffffff` / `rgba(12,24,28,.04)` |
| `--lx-ink` / `-2` / `-3` | `#eef4f5` / `rgba(238,244,245,.74)` / `.58` | `#f3eefb` / `rgba(243,239,250,.74)` / `.58` | `#0c1417` / `rgba(12,20,23,.74)` / `.62` | `#150e21` / `rgba(21,14,33,.74)` / `.62` |

### Semantic Data Category Tokens (`--ds-*`)

Each category exposes `-ink` (AA text on surface), bare fill, `-prev` (prior period), and `-tint` (soft wash).

| Category | Dark (`-ink` / fill / `-prev` / `-tint`) | Light Porcelain (`-ink` / fill / `-prev` / `-tint`) |
| --- | --- | --- |
| **Food** (`--ds-food`) | `#FF8FA6` / `#FF5C7A` / `#5C2733` / `rgba(255,92,122,.14)` *(Caribbean: `#62ead6` / `#2bcdb8` / `#214d47` / `#2bcdb81c`; Rose account: `#d6b8ff` / `#b48cff` / `#3a2a55` / `rgba(180,140,255,.12)`)* | `#C2264B` / `#FF5C7A` / `#FFD0D9` / `#FFF0F3` |
| **Steps** (`--ds-steps`) | `#FFB75C` / `#FF9F0A` / `#5A3A10` / `rgba(255,159,10,.14)` | `#A84B00` / `#FF9500` / `#FFDDB0` / `#FFF5E8` |
| **Exercise** (`--ds-exercise`) | `#6BE08A` / `#30D158` / `#1F4A2B` / `rgba(48,209,88,.14)` | `#1E7B34` / `#34C759` / `#C5EDD0` / `#EEFAF1` |
| **Sleep** (`--ds-sleep`) | `#A9A7FF` / `#7D7AFF` / `#33325E` / `rgba(125,122,255,.16)` *(Multi-dial `--md-sleep`: `#8f8cff`, Rose `#6fb7ff`)* | `#4B48C8` / `#7A78F0` / `#D5D4FA` / `#F1F1FE` |
| **Body** (`--ds-body`) | `#7ACFF5` / `#40B8F0` / `#1E4558` / `rgba(64,184,240,.14)` | `#0B6E99` / `#32ADE6` / `#C4E7F7` / `#EDF8FD` |
| **Wins** (`--ds-wins`) | `#FFD84D` / `#FFCC00` / `#4E4210` / `rgba(255,204,0,.13)` | `#8A6500` / `#F5B800` / `#F7E3A6` / `#FEF9E9` |
| **Glucose** (`--ds-glucose`) | `#DA8FFF` / `#BF5AF2` / `#4A2A5C` / `rgba(191,90,242,.16)` *(Multi-dial `--md-glucose`: `#5fe3a1`; `--md-fast`: `#ffb547`)* | `#8E3CC0` / `#BF5AF2` / `#E8CCF9` / `#F9F0FE` |
| **Summary** (`--ds-summary`) | `#64AEFF` / `#0A84FF` / `#1F3B5C` / `rgba(10,132,255,.16)` *(Caribbean: `#8cc8ff` / `#328dff`; Rose: `#c9a4ff` / `#a67df2`)* | `#0A6CD6` / `#0A84FF` / `#BBD9FB` / `#EEF5FE` |

### Contrast Floors & Dark-Island Exceptions
- **WCAG 2.1 AA Floor**: `>= 4.5:1` for all body, metadata, label, and caption text (`>= 3:1` for large display numerals `>= 24px` and non-text UI boundaries).
- **Muted Opacity Floors**:
  - **Dark Noir**: `--nx-ink-3` sits at `rgba(238,244,245,.48)` on pure `#030607` (and `.58` in `--ax-ink-3` / `--lx-ink-3`). Never drop readable captions or interactive labels below `.58` alpha in Dark Noir (use `--nx-ink-2` `.70–.74` for paragraphs and form hints).
  - **Light Porcelain**: `--nx-ink-3` is raised to `rgba(12,20,23,.62)` (Caribbean) / `rgba(21,14,33,.62)` (Rose) to maintain `>= 4.5:1` on both `#ffffff` cards and `#f4f6f7`/`#f6f4f9` grounds. Never use `opacity < 0.6` on disabled text in light mode; use solid `--cc-text-2` or `--cc-text-3`.
- **Dark-Island Exceptions**: `.cc-cam` and `.cc-photo-viewer` (plus portrait art `.cc-portrait`, `.cc-portrait-shade`, `.cc-assistant-portrait`, `video`, `::backdrop`, and `account-camera.css`) explicitly stay dark (`color-scheme: dark`) in Light Porcelain mode, like a native camera/photo viewer. All other surfaces MUST adapt to Porcelain.

---

## 3. Typography Scale & Hierarchy

| Role | Family | Weight | Size / Line-Height | Tracking & Rules |
| --- | --- | --- | --- | --- |
| **Hero Dial Numeral** (`.nx-big`) | `var(--nx-display)` (`Outfit`) | `200` | `clamp(60px, 19vw, 82px) / 0.92–0.95` *(compact mobile dial: `clamp(42px, 12.5vw, 52px)`)* | `-0.045em`, `font-variant-numeric: tabular-nums` |
| **Sheet / Sub-Hero Numeral** | `var(--nx-display)` (`Outfit`) | `200` | `56–60px / 0.95` (Meal detail, Outcomes hero, Recorder timer) | `-0.04em` to `-0.045em`, `tabular-nums` |
| **Page / Greeting Heading** (`h2`, `.nx-say`) | `var(--nx-display)` (`Outfit`) | `200–300` | Mobile `20–30px / 1.12–1.22` · Desktop `32–40px / 1.1–1.18` | `-0.02em` to `-0.025em`, `text-wrap: balance` |
| **KPI / Stat Value** (`.nx-tile b`, `.nx-kpi`, `.nx-macros b`) | `var(--nx-display)` (`Outfit`) | `300` | `17–36px / 1.0–1.1` | `-0.01em` to `-0.03em`, `tabular-nums` |
| **Card / Row Title** | `var(--nx-text)` (`Inter`) | `500` (`600` strong) | `14–15px / 1.25–1.35` | `0` to `-0.005em`, `overflow-wrap: anywhere` on user strings |
| **Body & Descriptions** | `var(--nx-text)` (`Inter`) | `400` | `13.5–15px / 1.45–1.55` | `color: var(--nx-ink-2)` for secondary copy |
| **Metadata / Captions** | `var(--nx-text)` (`Inter`) | `400–500` | `12–13px / 1.3–1.45` | `tabular-nums` on dates, durations, counts |
| **Eyebrows & Section Tags** | `var(--nx-text)` (`Inter`) | `500` | `10–11px / 1.0–1.2` | `text-transform: uppercase`, `letter-spacing: 0.12em` (`0.14em` dial/tile), `color: var(--nx-ink-3)` |
| **Form Controls** (`input`, `select`, `textarea`) | `var(--nx-text)` (`Inter`) | `400–500` | **`>= 16px`** (`max(16px, 1em)` on `pointer: coarse`) | Prevents automatic iOS Safari focus zoom |

Font stacks:
- `--nx-display: "Outfit", -apple-system, "SF Pro Display", Roboto, sans-serif` (weights `200`, `300`, `400` via `@fontsource/outfit`)
- `--nx-text: "Inter", -apple-system, "SF Pro Text", Roboto, sans-serif` (weights `400`, `500`, `600` via `@fontsource/inter`)

---

## 4. Layout, Spacing Rhythm & Responsive Geometry

- **Spacing Grid**: Strict `4px / 8px` rhythm — tight clusters `4–8px`, standard control/row gaps `10–14px`, card interiors `16–22px`, ruled section top padding `22–26px`, desktop column gaps `28–48px`.
- **Container Max Widths & Breakpoints**:
  - `.cc-top`, `.cc-shell`: `max-width: 1100px`; horizontal padding `28px` (`18px` at `<= 600px`).
  - Hero dial: `max-width: 350px` (`304px` at `<= 700px`, `276px` at `<= 380px`).
  - Gate / confirm sheet: `max-width: 400–440px`; Notification popover: `min(352px, calc(100vw - 24px))`.
  - `< 1024px`: Fixed bottom tab bar (`--cc-nav-offset: 70px`) with raised `64×64px` center Camera FAB (`margin-bottom: 10px`). Assistant docks flush above `.cc-nav`.
  - `>= 1024px`: Left sidebar (`--cc-sidebar: 220px`, `border-right: 1px solid var(--nx-hair)`).
  - `>= 1280px`: Open Assistant docks as a `400px` right-hand column (`z-index: 45`) while `.cc-shell` narrows beside it.
- **320px Zero-Overflow Guard**:
  - Every multi-column grid MUST use `minmax(0, 1fr)`.
  - Every flex/grid child MUST set `min-width: 0` (and `max-width: 100%; box-sizing: border-box` on fluid wrappers).
  - User-generated titles, meals, and transcripts MUST include `overflow-wrap: anywhere`.
  - `document.documentElement.scrollWidth <= window.innerWidth` MUST hold at `320px`, `390px`, and `1280px`.
- **Touch Targets & Native Feel (`noir-native.css`)**:
  - Minimum interactive hit target: **`>= 44×44px`**. Visually compact controls (`32–38px`) MUST expand hit area via `position: relative` + `::after { content: ""; position: absolute; inset: -6px 0; }` (`inset: -4px` on square icons).
  - Controls carry `-webkit-user-select: none; user-select: none; -webkit-touch-callout: none; touch-action: manipulation;`.
  - Scrollable drawers/sheets/dialogs MUST set `overscroll-behavior: contain`.
- **Safe-Area & FAB Clearance**:
  - `.cc-shell` mobile bottom clearance: `padding-bottom: calc(var(--cc-nav-offset, 70px) + 56px + env(safe-area-inset-bottom, 0px))` and matching `scroll-padding-bottom` (`+ 52px`).
  - Bottom sheets and `.cc-settings-panel` MUST pad bottom by `calc(24–28px + env(safe-area-inset-bottom, 0px))`.
  - Z-index hierarchy: `.cc-nav` `40` → Desktop Assistant `45` → Mobile Assistant `55` → `.cc-detail` `60` → `.nx-library-updates-dock` `62` → `.cc-top` (open drawer/notif) `85` → `.cc-settings-scrim` `86` → `.nx-notif-scrim` `88` → `.cc-settings-panel` `90` → `.nx-notif-panel` `92`.

---

## 5. Below-the-Fold Visual Craft Rules

Above-the-fold hero views already express Cupcake Noir; below-the-fold sections (Today drill-downs, Fitness, History, Food sub-tabs, Library archive, Settings, Connections) MUST match the exact same craft discipline:

1. **No Boxed Cards Nested Inside Cards**:
   - Replace nested rectangles, heavy borders, and legacy dashed boxes with **hairline dividers (`1px solid var(--nx-hair)`) + vertical air (`padding: 14–26px 0`)**.
   - Use ruled rows (`border-top`/`border-bottom: 1px solid var(--nx-hair)`, `border-radius: 0`, `background: none`) for Today drill-downs, Energy balance stats, History totals, Meal Plan slots, Groceries checklists, Connections lists, and Voice history.
   - Reserve elevated card surfaces (`.cc-card`, `.nx-steps-card`, `.nx-food-hero`) strictly for top-level standalone containers—never place another bordered card inside one.
2. **Unified Radius Scale**:
   - `24–30px`: Modals & bottom sheets (`30px 30px 0 0` on mobile bottom sheets)
   - `22px`: Primary outer cards, popovers, panels (`20px` compact list/library cards)
   - `16px`: Buttons, inputs, secondary controls (`18px` full-width primary CTAs; `999px` pills & chips)
   - `14px`: Segmented control outer tracks (`padding: 3–4px`)
   - `10px`: Segmented control inner active thumbs (`9px` inside `12px` assistant track)
3. **Strict Color Discipline**:
   - **Zero rainbow decorative chips**: Legacy colored icon tiles (`.ds-ico`, `.ds-tone-icon`) are monochrome or omitted in Noir headers.
   - **One primary CTA per screen**: Secondary actions use quiet hairline/surface treatments (`--nx-surface`, `border: 1px solid var(--nx-hair)`), never competing gradient primary fills.
   - Reserve `--nx-a` / `--cc-pink` for: primary CTA, interactive text links, active tab dot/border, and quantitative data.
   - Calm inline alerts: Error banners use `border-left: 2px solid var(--nx-warm)` + `9%` warm tint (`border-radius: 0 12px 12px 0`), never legacy magenta/pink slabs.
4. **Light Porcelain Elevation & Opaque Overlays**:
   - Every genuine outer card in Light mode uses `background: var(--nx-card); border-color: var(--nx-hair); box-shadow: var(--nx-card-shadow);`.
   - Every popover, dialog, drawer, and floating dock (`.nx-notif-panel`, `.cc-meal-dialog`, `.nx-recap-card`, `.nx-weigh-sheet`, `.cc-settings-panel`, `.nx-library-updates-dock`, `.cc-detail`) MUST be **100% opaque** (`#ffffff` in Light; `#0c1418`/`#130f1d` in Dark) so underlying text never bleeds through.
   - Scrims dim with dark ink (`rgba(12,20,23,.26–.28)` in Light, `rgba(2,5,7,.48–.68)` in Dark)—never white fog.
   - Segmented controls in Light mode follow the iOS pattern: `#fff` thumb + soft shadow on `rgba(118,118,128,.12)` track.
   - Zero stray dark islands or hardcoded `#0a…`/`rgba(255,255,255,…)` washes left unmapped in Light mode.

---

## 6. Motion & Micro-interaction Spec

Follow Emil Kowalski design-engineering principles across all Noir interactions:
1. **GPU-Composited Properties Only**: Animate ONLY `transform` and `opacity` (plus SVG `stroke-dashoffset`/`stroke-dasharray` on gauges/charts). **NEVER use `transition: all`**—always enumerate exact properties (e.g., `transition: transform 110ms cubic-bezier(.22, 1, .36, 1), opacity 180ms ease;`).
2. **Standard Curves & Timing**:
   - **Entrances, popovers, disclosures, sliding thumbs**: `cubic-bezier(.22, 1, .36, 1)` at **`160–220ms`** (`240–300ms` max for mobile bottom sheets).
   - **Tactile press (`:active`)**: `110ms` transition to `transform: scale(.96)`–`scale(.98)` (`scale(.95)` for circular FAB/record buttons). On touch-only devices (`@media (hover: none)`), provide instant `0s` press feedback (`opacity: .62`) easing back on release.
   - **View transitions**: Animate `opacity` only (`<= 220–260ms`) on `.cc-shell > *` so `position: fixed` sheets and docks keep viewport containing-block positioning.
3. **Reduced Motion Is Mandatory**: Every `@keyframes` animation and transition MUST be suppressed under `@media (prefers-reduced-motion: reduce)` (`animation: none; transition: none;`) or wrapped in `@media (prefers-reduced-motion: no-preference)`.

---

## 7. Agent Guardrails & Verification Checklist

### 10 Deploy-Pinned Canonical Files (DO NOT MODIFY)
Verified by SHA-256 in `ops/deploy-prebuilt-hales-ai.sh`—touching any of these fails production deploys:
1. `src/App.tsx`
2. `src/components/experience/HalesExperience.tsx`
3. `src/components/experience/experience.css`
4. `src/components/VoiceButton.tsx`
5. `src/hooks/use-vapi.ts`
6. `src/components/ChatInterface.tsx`
7. `public/lab/hal/index.html`
8. `public/lab/sentinel/index.html`
9. `index.html`
10. `public/favicon.svg`

*(Additional deploy invariants: `VITE_CUPCAKEGPT_KEY` MUST NEVER appear anywhere in `src/` or `public/`; `src/pages/cupcake/sandbox/cupcakegpt/page.tsx` is hash-pinned per release via `--page-sha256`.)*

### Required Sentinel Strings (DO NOT REMOVE OR RENAME)
Verified in `dist/` by `ops/deploy-prebuilt-hales-ai.sh`:
- `hales-public-chat` (in `ChatInterface.tsx` and `dist/assets`)
- `cupcake-feed` (in `dist/assets`)
- `hales:sentinel-ready` (in `dist/lab/hal/index.html`)
- Account-session controls (`VITE_CUPCAKE_ACCOUNT_SESSIONS=true`, in `dist/assets`):
  - `Transcribe full clip`
  - `Save audio to account`
  - `Meal saved to your food log`

### Mandatory Verification Gates
Run from the repository root before shipping any UI or CSS change:

```bash
# 1. Regenerate & verify Light Porcelain CSS
node scripts/build-noir-light.mjs --check

# 2. Typecheck, lint & production account-sessions build
npx tsc --noEmit
npx eslint src/components/cupcake src/pages/cupcake/sandbox/cupcakegpt/page.tsx
VITE_CUPCAKE_ACCOUNT_SESSIONS=true npm run build

# 3. Visual render & overflow check (Dark + Light, 390px + 1280px, both appearances)
W=390,1280 T=caribbean,rose ASSESS_ROOT="$PWD" ASSESS_OUT=/tmp/cupcake-shots node tests/account-design/render-main.mjs
SCHEME=light W=390,1280 T=caribbean,rose ASSESS_ROOT="$PWD" ASSESS_OUT=/tmp/cupcake-shots-light node tests/account-design/render-main.mjs

# 4. Light-mode AA contrast & dark-island audit
SCHEME=light RICH=1 W=390 ASSESS_ROOT="$PWD" ASSESS_OUT=/tmp/x node tests/account-design/light-audit.mjs

# 5. Chrome accessibility tree & reading-order probe
W=390 ASSESS_ROOT="$PWD" ASSESS_OUT=/tmp/x node tests/account-design/probe-ax.mjs
W=1280 ASSESS_ROOT="$PWD" ASSESS_OUT=/tmp/x node tests/account-design/probe-ax.mjs

# 6. Native-feel behavior & touch-target gates
RICH=1 ASSESS_ROOT="$PWD" ASSESS_OUT=/tmp/x node tests/account-design/native-feel.mjs
```

A release passes only when all gates exit `0`, zero `transition: all` rules exist in `src/components/cupcake/`, `scrollWidth <= innerWidth` holds down to `320px`, and `light-audit` reports zero unintended dark islands or AA contrast regressions.
