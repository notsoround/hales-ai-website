# Separate account entry, preserved private Cupcake — November 6, 2026

Prepared source only, based on website PR34 merge `97c5a74c18cd9e8f8331b3609a26822565b8e143`. No deployment, live flag, account, database, provider or user history changed. Browser evidence uses visibly labelled simulated accounts, records and audio on temporary localhost servers.

`/cupcake` retains the existing full Matt owner-key flow, private feed/provider transports and remembered legacy access. `/cupcake/account` (optional trailing slash) uses the same `CupcakeGPT` component through the real custom router in `src/App.tsx`, gated by the existing build opt-in. With the flag off, the account path renders an unavailable screen before mounting Cupcake or making private requests. Query strings, storage, names and personas cannot enable the account transport. The existing `/cupcake/robyn` token-viewer route remains separate.

Transport/storage mode is fixed per document. Programmatic routing across entries reloads the document; internal tab changes retain the current path and browser Back/Forward works on the account entry. One bounded `cupcakeHref` helper keeps same-site record/source/meal links in the current entry, including canonical production URLs rendered in local tests. External and legacy token-viewer URLs are unchanged. The existing source IDs, queries and fragments are retained.

Account sign-in no longer clears Matt's separate remembered owner key. The account transport still cannot read or send it. The new concurrent-tab scenario proves an account cookie and its identity-scoped local data do not replace the independently authenticated legacy entry or expose its simulated telemetry through the account view.

Account PWA installation and OS audio sharing are explicitly staged. Account pages add no legacy manifest, install prompt or worker registration, and the Settings copy explains the browser/bookmark and local-import behavior. Matt's manifest/start URL/install/share target remain intact. An already-installed broad legacy worker can control an account URL, so the worker explicitly refuses account POST paths and account-client posts to the legacy share target before parsing a body or opening IndexedDB. Legacy-client and OS/no-client shares still save only an unbound legacy draft and redirect to `/cupcake?shared=1`; account storage never adopts that database.

The worker no longer accepts a browser-wide mode toggle from either tab. Its activation removes only the obsolete public-cache mode marker and claims clients. There is no worker unregister, database deletion, migration or history rewrite. The legacy-only false notification remains compatible with an older active worker during update; the new worker ignores such messages.

Validation:

- Three new actual-App browser scenarios pass: concurrent private/account entries and preserved key/telemetry; trailing slash, Back/Forward and real source-link popup retention; installed-worker message/share isolation; staged manifest/install state; and the default-off/unknown-prefix/query-flag cases. All outbound services are intercepted with synthetic responses.
- Six new worker VM tests pass against the actual worker source, covering message isolation, account refusal before body/storage, unchanged legacy/OS share storage/redirect and narrow activation cleanup.
- Sixteen adapted existing browser scenarios pass at the explicit account URL: feed3, text3, account boundary4, coach3 and persona3. Their shared fixture now renders the real `App` router rather than mounting Cupcake directly.
- Application TypeScript, scoped lint (zero errors, one existing mixed-export warning), default-off production build, opted-in production build and `git diff --check` pass.

All 25 focused synthetic scenarios pass. Account backend setup/provisioning, explicit live activation and deployment approval remain separate. This change preserves access to Matt's existing capabilities without expanding his private providers to another account.
