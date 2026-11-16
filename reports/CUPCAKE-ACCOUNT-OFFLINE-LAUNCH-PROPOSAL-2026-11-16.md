# Proposal: an offline launch page for Cupcake accounts

**Draft for Matt’s approval.** This proposal does not add a service worker, register one, change a manifest, or enable an offline mode. The product still requires a connection to sign in, use the assistant, or view and save account records.

## What the user sees

After a successful online visit in a supported, installed account app, opening it during a connection loss should show a small branded, static page: **You’re offline. Connect to the internet, then try again.** A single **Try again** action reloads the current launch URL. Always try the real online page first; an HTTP sign-in response, maintenance page, error status, or redirect must not be replaced with a cached success.

One public HTML file serves both Cupcake and Matthieu. It contains its own small, accessible layout and no framework bundle. Only the two allowlisted public assistant names can affect branding; nothing from the URL is rendered as untrusted HTML. Do not show a stale Today screen, a sign-in form, personal names, notification counts, or pending writes. A first launch without a successful online install, an evicted cache, or unsupported storage can still show the browser's normal offline fallback.

## Proposed boundary for a later implementation

- Serve a standalone public worker script at a new root-level path (candidate `/cupcake-account-sw.js`). Register with exact scope `/cupcake/account` from an account-only, installed-app lifecycle component only after activation is approved. A root-level script permits that narrow scope without a `Service-Worker-Allowed` override or new directory that could affect nginx's current routes. Leave `src/App.tsx`, the pinned Cupcake page, `index.html`, the manifests, and Original's worker untouched.
- Explicitly handle only ordinary same-origin **GET navigations** to exact `/cupcake/account` or `/cupcake/account/`. Scope matching is a URL-prefix check; reject lookalikes such as `/cupcake/account-extra` in the fetch handler. Accept the known installed persona and tab shortcuts. Leave callback, invite, recovery and other token-bearing or unknown-query navigations to the browser. Never use a requested URL as a cache key.
- At install, fetch a fixed `/cupcake-account-offline.html` and the public icon URLs listed in the two account manifests (192, 512, maskable and Matthieu’s public avatar). Use an explicit same-origin allowlist, credentials omitted, no redirects, and verify successful expected-typed static responses before storing them. The cache must contain exactly **one standalone public HTML document plus those icons**. Do not precache the SPA index, scripts, manifests or user assets. On install failure, preserve the prior working version and fall back to the normal browser behavior.
- During navigation, attempt the network without writing any response to Cache Storage. Only a failed connection may use the preloaded shell. Match the exact cached keys for icons; every other request passes through. No API or library interception, no general runtime caching, no IndexedDB, no background sync, no receipt/photo/audio cache, and no share target. Even on a controlled page the worker will receive some unrelated fetch events; allowlisting the handler matters as much as its registration scope.
- Use a versioned name reserved for this feature and replace only its older caches after successful activation. Do not claim all clients or skip waiting; allow the browser to finish existing online sessions before the new worker takes over. The narrower account registration will match ahead of the broader Original registration for account URLs; verify overlap and the deactivation path in both install orders. Never unregister or delete the Original worker/cache. A future disable path unregisters only the exact account registration and removes only account-shell caches; an offline device can receive the removal only when it reconnects.

See the W3C [Service Workers specification](https://www.w3.org/TR/service-workers/) for scope matching, registration and fetch-event behavior.

## Before implementation or rollout

Get explicit approval for account worker registration. Then verify, using synthetic responses and fresh browser profiles:

1. Online Cupcake and Matthieu launch and their camera, talk, and text shortcuts still reach the real app. The original `/cupcake` install and share target continue to work. Check original-first and account-first install order.
2. Offline program launch and reload for both personas display only the static status page. No account requests run from the fallback. Try again after connectivity returns reaches the real app, and ordinary calls, permissions and history controls still require their regular actions.
3. Inspect Cache Storage: exact public allowlist and nothing else, after signed-out-to-synthetic-account transitions and attempts to fetch cookies, API responses, deep links or real-app HTML. Verify that failed responses, redirects, invalid content and lookalike routes are never added.
4. Check focus, contrast, reduced motion, text size, and no horizontal overflow at 320/390 px. Check supported installed modes on Android Chrome and iOS Safari, plus a browser without a controlling worker. No device or browser support is claimed by this proposal.
5. Exercise update, failed install, cache eviction and removal on a local test origin. Reconfirm the Original worker and unrelated caches are untouched.

Implementation, pilot enablement and eventual deployment are all outside this draft.
