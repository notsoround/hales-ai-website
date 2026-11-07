# Account feed, saved finance access and text conversations — November 6, 2026

Prepared source only, behind the existing default-off account-session build flag. No live deployment, database migration, account/grant creation, provider request, manual health/purchase entry or multiuser activation occurred. The published site remains the female-portrait release. The separate local portrait preview uses simulated data; its empty sample history is unrelated to production history.

## Account connections

`feedApi.feedRequest` selects the captured-cookie account `feed_get` transport and requires the reviewed `owned-local-ledgers` source confirmation. It never reads the owner key or falls back to the private webhook. Flag-off builds retain the existing private feed transport. Today, range/custom/All-time dashboard queries, Saves windows and the connection check now share this adapter. Account requests retain the existing generation, identity-echo, context-header and abort boundaries.

Unavailable calories, daily spending and phone outcomes remain null in cards and chart labels. Partial calorie totals retain their partial label. Personal wins/losses have a separate account summary; unavailable purchase-call records never become zero scored calls or a fabricated win rate. Empty partial sources have an unavailable explanation. Unknown-currency transactions stay unknown and remain reachable in the Saved transactions drilldown when the USD total is unavailable. Known USD totals retain the matching USD population. Account curve purchase markers require explicit currency and observed time; day-only sort timestamps never become a noon purchase.

The account Today timeline uses the complete feed snapshot rather than replacing its exercise rows with a separately capped list. A confirmed exercise save or undo refreshes that feed. Feed-only workouts remain present once. The existing independent exercise hook continues serving the exercise controls and energy card.

The explicit account allowlist adds six already reviewed local finance actions: receipt list/get/original/confirm and reconciliation list/resolve/settings. This connects saved receipt access; new extraction and refreshed bank candidate search remain staged and unavailable. This change does not claim a complete account bank-matching journey.

Five reviewed QuickChat actions (list/get/create/begin/cancel) now reach the same existing Text UI through accountData. Normal requests use the server-execution contract and durable polling/reload, without browser-supplied answers or private-gateway fallback. Complete/fail remain refused before transport. Text inference additionally requires the backend's explicit account-reply worker flag, offline authorization schema and server billing configuration. Reset, live voice, recording uploads and new photo analysis remain staged for account sign-in. Device-local recording continues to retain its existing boundary.

## Dependencies and release limits

Based on website coach UI merge `327ef0f6e9b5fb116cb61fd6f4b124f02e60a49b`, preserving MyCupcake/Reports navigation and independent photo authorization. Backend source dependencies are feed PR102 merge `2827a7089f63391937c3024e35a50ba4e5a459ad` and account QuickChat PR103 merge `dee2f45f4763a964a70b21d6a997b9d0f547ae15`; neither is deployed or activated.

Before account activation, the full existing Matt entry must remain accessible alongside the new account entry. Account-local coverage does not replace Matt's private external history, CGM, bank refresh or purchase-call integrations. Entry preservation is the next separately reviewed slice. A production rollout still needs concrete migration/setup rehearsal and the user's separate approvals for code publication, live migration, Robyn provisioning and multiuser activation. No real-user acceptance is claimed from synthetic fixtures.

## Verification

All three new actual-root account feed browser scenarios pass: own timeline/nullable totals/range/custom/history cursor; A/B delayed response and cache isolation; wrong-source/503 refusal and retry. They include a feed-only workout, synthetic UI exercise save/undo with authoritative feed refresh, and unknown-currency transaction drilldown.

All three new actual-root account text scenarios pass: queued request survives actual reload and completes by server polling; A/B private history/draft isolation; 503 preserves the draft and unsupported complete/fail refuse before transport. These use an explicit synthetic server hook, no paid provider. Regeneration/cancel UI flows were not exercised.

The four existing account-browser and three coach-browser scenarios pass. Dashboard model and five data-state checks pass. The focused account purchase-marker check passes. TypeScript and scoped ESLint pass with only the two existing fast-refresh warnings. Default production and account-enabled production builds pass; final enabled build completed after the runtime changes. `git diff --check` passes. One unrelated pre-existing direct-Node import-resolution failure in the broad Today-energy test prevented that test from starting; the new purchase-marker check runs separately without changing the older module imports.
