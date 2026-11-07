# Default-off browser account boundary — 2026-11-06

This prepares account sign-in around the **same CupcakeGPT root, shell and child
components**. There is no separate account dashboard or reduced Library fork.
It is not a claim that all account features or multiuser rollout are ready.
No flag, account, credential, backend schema, live record, provider, permission,
deployment or production service was changed. All browser data/audio were
simulated; outgoing requests were intercepted or blocked by the local fixture.

Only the exact build setting `VITE_CUPCAKE_ACCOUNT_SESSIONS=true` selects the
account gate. The default build retains the existing owner-key experience and
legacy cache names. Neither a URL, stored preference, persona nor JSON field can
enable account mode or select the account whose data is returned.

## Authentication and transport

The gate restores the cookie session or presents email/password sign-in with an
explicit Remember me checkbox. It includes recovery-code redemption. Settings
adds password change, one-time recovery-code creation, Sign out and Sign out all
devices. Account identity is visible as **MyCupcake — name** from the server;
the greeting uses the same identity. Assistant name, persona, appearance and
accent remain presentation preferences. Passwords/codes are not put in app
storage; controls clear them, and the displayed recovery code disappears on
unmount. A failed server sign-out leaves the browser locked with an explicit
warning and a cookie-only retry, rather than claiming remote revocation.

Account requests use `credentials:include`, JSON and `X-Cupcake-Request:account`.
Data requests and protected account changes carry a captured
`X-Cupcake-Account-Context` from the verified identity. This is an equality fence,
never an owner selector. Data must echo the same authenticated identity before
it is exposed to any component. HTTP401 or `409 account_context_changed` locks
the view. Generations are checked around fetch/JSON/identity validation; account
changes abort pending requests and discard late responses, including responses
whose transport ignores cancellation. BroadcastChannel plus a storage-event
fallback locks sibling tabs. Focus and a 60-second session probe detect server
expiry or an identity change without remounting an unchanged session.

`libraryRequest` routes only the explicit reviewed local allowlist through
`/api/account/data`. It cannot fall back to the owner key, MCP, generic approval,
provider/worker or private service paths. Account mode removes old owner-key
entries and broadcasts their removal without reading them; reads/saves of that
key are disabled. The older feed, intervention, vision, voice and recording
transports use a guard that rejects before network access. Live voice also
rejects before microphone acquisition or loading the provider SDK. The same
shared UI displays a plain staged-feature notice and keeps saved originals.

## Browser data boundary

The whole personal UI is keyed by verified account ID plus generation. Identity
changes/expiry unmount old state, stop microphone/recording acquisition and
tracks, clear held audio players/object URLs, cancel speech and discard stale
async results. Sign-out remains available while account-mode local recording
is active.

Local/session keys are prefixed with the trusted identity, including Quick Chat
drafts/selections/pending requests/received answers, Quick Reset recovery, Talk
history/checkpoints/archive preferences/starting seeds, pending personal scores,
appearance/persona/name/accent, microphone selection and launcher preferences.
Quick Chat module memory is cleared on session changes. Captured Storage objects
reject later generations instead of redirecting old callbacks into a new user's
namespace. No legacy personal key is imported or rewritten.

Recorder IndexedDB is also per account. The full recorder operation captures its
namespace/generation, including delayed chunk and stop writes, import/upload,
draft playback/download and in-memory Blob fast paths. Owner metadata follows
the draft. Late operations refuse; previously saved originals/chunks remain in
their original database and can be recovered after that account signs in again.
The old unscoped recorder database remains intact and is never adopted by an
account view. Blocked browser storage still produces the existing recoverable
warnings rather than a fallback to another owner.

The service worker receives a build-mode marker, including before sign-in. It
has no trusted cookie principal for OS-shared audio, so recognized account-mode
shares return409 and cannot choose an account. A previously installed older
worker can still save only to the legacy unscoped database; that database stays
isolated from every account. A rollout must update the worker as well as the
application. Mixed older tabs/workers do not confer any account attribution.

## Readiness limits and dependencies

- The reviewed account-local backend allowlist is PR94. The atomic principal
  fence and identity echo require backend PR98, merged as
  `86b077cbacbadf35d9cddf18436d8b55805d21de`, or an equivalent later approved
  revision. Required context routes are data, password, recovery/issue and
  sign-out-all. Sign-out verifies context when supplied; a locked-browser retry
  may omit it and affects only the exact cookie session.
- Backend account HTTP remains default-off and still needs separately approved
  runtime deployment, complete offline ownership migrations and provisioning.
  This change does not perform any of those steps or authorize activation.
- Local health and Library reads use reviewed account adapters. Saved-meal
  history uses owned local rows only and skips the fixed Matt Food Sheet merge.
  It does not infer eating from a purchase, receipt or missing evidence.
- The normal Today/Wins feed shape still depends on private feed/purchase/phone
  intervention inputs. Those calls are blocked in account mode; they are not
  replaced with fabricated empty history or zero totals. A shared feed adapter
  using the explicit local snapshot contract remains future work.
- Quick Chat/Quick Reset provider jobs, live voice, remote recording upload/
  processing, vision, receipt/bank workflows, administrative connections and
  private report aggregates remain staged. Local recording is device-only.
  The existing text/voice/record UI remains shared for future reviewed adapters;
  unavailable features are not claimed as complete account capabilities.

## Validation

`node tests/account-browser.test.mjs` exercises four meaningful Chromium
scenarios with the actual root at390px and1280px: remembered sign-in; A/B
switching, reload and isolated caches/appearance/legacy originals; late response,
principal/echo mismatch, HTTP401 and media cleanup; recovery/password/all-device
controls; service-worker share refusal, failed sign-out retry and protected
mutation fencing. The fixture simulates server sessions and audio, asserts
cookie transport options/headers, and blocks external networking. It does not
claim deployed HTTPS/Secure/SameSite/CORS acceptance. Backend loopback tests
cover the server side separately. Local preview screenshots are under
`output/account-preview/` and visibly marked simulated.

Also passed:28 focused existing key/recovery/checkpoint/upload tests;8 focused
flag-off real-root integration checks at390px (WebKit layout and Chromium mocked
media); application TypeScript; scoped lint with no errors (the existing root
metadata fast-refresh warning remains); worker syntax; both the default
production build and a separate opt-in build artifact. No broad historical
suite or live probe was run. No portrait/art styles, assistant-shell CSS,
Settings-overlay tests, deployment scripts or environment files were edited.
