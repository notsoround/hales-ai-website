# Mobile food photos and compact Today timeline

Source work based on origin/main `7c243bc2a9c940b4f026c115b6e4659be8831995`. This report records local simulated verification, not a deployment or physical iPhone acceptance.

## Findings and changes

- Account Food → Log a food photo → saved receipt: a long unbroken returned meal description expanded the automatic minimum width of `.cc-account-photo-progress`. The initial WebKit 320px reproduction measured a 5,416px document and a 5,381px progress grid at viewport scale 1. The committed regression uses a 300-character description, matching the backend description bound. Explicit zero-minimum grid tracks and wrapping keep this content within the phone.
- Account Food → Change portions or meal time → Choose date & time: the shared `font:inherit` reset made the selects inherit their label's 13px font. The component now keeps these controls at 16px, avoiding that iOS focus-zoom trigger. Existing viewport metadata, dialog bounds and browser zoom policy were preserved.
- Today calls this section **Timeline**. It previously showed eight entries; it now starts with three. **Show all** keeps all loaded records, timestamps and detail actions inside a keyboard-accessible scroll region capped at 20rem. **Show latest 3** resets that region's scroll; full history remains available. The current source contains no literal “Recent notifications” or “10 of 300”. Library artifact pagination starts at 30 and was left intact.
- Saved meal status accepts a confirmed account photo with its account-local destination, account logged timestamp, logged state, explicit counted flag and valid eaten time, even if its compatibility `sheetLoggedAt` field is absent. Existing sheet-backed legacy status remains. An explicit false counted flag wins; a photo, unknown nutrition or an account timestamp alone does not imply consumption. The current backend stamps both account and compatibility timestamps; this protects the frontend's accepted account contract rather than claiming production omits that field.
- Account Live voice now names the selected assistant and explains its existing availability limit before interaction. Its primary control is disabled and Text/Record remain reachable. The existing backend/transport guard and all legacy live voice behavior are retained.
- Floating companion Hide retains its action and anchor with a 44px touch target.

## Validation

- Real account photo selection → pending → saved → saved meal dialog → full photo → close: 108 measured states at 320/390/1280px, Chromium/WebKit, Caribbean/Violet. Wide synthetic images, bounded 300-entry timeline, empty/single states, all timestamps/detail actions, heading focus, keyboard return focus, viewport scale and body overflow were checked. Final focused runs cover status guards after their addition.
- The existing account photo retry/reload/uncertain-response/account-switch suite passes. The unchanged legacy food journey also passed its existing 72-state WebKit 320/375/390/430px matrix before the fix.
- Full-root availability checks cover Cupcake/Matthieu at 390/1280, Text/Record navigation, legacy voice remaining enabled, and the enlarged Hide control's hide/restore behavior. No microphone or provider request was started.
- TypeScript, scoped Cupcake/page/fixture ESLint and the account-enabled production build pass. ESLint retains two existing fast-refresh warnings; the build retains the existing large-chunk warning.

All images, uploads, meals and records used for these checks were local simulated fixtures. External requests were blocked. No real meal, provider operation, call, message or deployment was performed by this work.

## Remaining acceptance and main-page review

Physical iPhone/PWA camera/photo-picker and OS keyboard behavior still needs an actual device; browser emulation does not prove those OS interactions. The separate main-page audit should cover Today density, Settings hierarchy, assistant mode guidance, Food/Record/Library navigation and phone/desktop focus/scroll behavior. It must preserve account isolation, branding, full history and legacy functions. This change does not claim an exhaustive main-page audit.
