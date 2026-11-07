# Account-saved assistant preferences — 2026-11-06

Account-enabled builds now load appearance, character and assistant name from the
verified account before permitting edits in the existing Settings panel. This
uses the same shared Cupcake root; account identity remains separate from the
assistant name. The existing male/female art and all shared art styles are
unchanged. The build flag remains default-off. No deploy, flag activation,
account provisioning, migration, preset assignment, provider or live data action
was performed.

## Persistence contract

`persona_get` and `persona_save` are the only additions to the explicit account
client allowlist. They use the existing cookie transport, captured expected
account header, authenticated identity echo and generation cancellation. The
server record contains `{preferences:{appearance,persona,name},revision,updated,
saved}`. Returned records must validate before controls become editable or a
save is shown as confirmed. Appearance and character are independent choices.
Names are trimmed, limited to 24 Unicode code points and exclude Unicode control,
format, surrogate, private-use and unassigned categories, matching the backend.
A blank input saves its character's default name.

Edits update the current view and debounce for 500 ms. Only one save may be in
flight. Later edits wait and use the revision returned by that save. The panel
shows Loading, Saving, Saved, account defaults or a clear error with Retry. A
failed initial read disables editing; a failed save retains the unsaved draft
and does not claim persistence. Account mode never reads or writes browser
appearance preferences as a substitute for the server.

HTTP 409 `persona_conflict` cancels pending edits and reloads the current record.
The panel explains that preferences changed elsewhere and unsaved edits were
not applied. It never automatically retries those edits against a newer
revision. If the conflict reload fails, editing stays disabled until Retry
confirms the current server record. Requests and callbacks are bound to their
original session generation, including debounce timers, hydration and saves;
old-account results cannot redirect a mutation or update the next account.

Legacy owner-key builds retain their existing browser-only preferences, original
storage keys, change handlers and storage-event synchronization. Existing
per-account browser preferences from the preparation PR remain untouched and
are not imported into the server. Accent heat remains a separate browser
preference; it is not part of this server contract.

## Validation and limits

- Three new actual-root Chromium scenarios at 390px and 1280px use two independent
  browser cookie/storage containers with one shared simulated server. They cover
  delayed hydration and disabled controls; refusing a local-cache fallback;
  independent appearance/character; trimmed debouncing; serialized mutations;
  two-device persistence/reload and revision conflict; separate A/B settings;
  load/save failure and explicit retry; and delayed old-account saves/reads.
- Four existing account-boundary scenarios pass, including session expiry,
  expected-principal/echo fencing, media teardown, cache isolation and recovery.
- Eight focused flag-off real-root integration checks pass, including browser
  appearance/persona choices, layout and mocked media behavior.
- Application TypeScript, scoped lint (no warnings/errors), diff check and both
  default and opt-in production builds pass.

All browser authentication, records and audio were synthetic. External
networking was intercepted or blocked. These checks do not demonstrate deployed
HTTPS, production cookies/CORS or a live database migration. Runtime requires
backend PR100 (approved `5418554aa555bab1408e98f94c14a2990e1a8f1f`,
merged `4d6afb5e6f5ca6205d457c22ab73797dbcd8b1eb`) and the migrated
`account_personas` schema, in addition to the prior account API/context-fence
prerequisites. No
Robyn preset is assigned here; any offline preset seed still requires the
separate explicit provisioning approval. Broader account feeds and provider
features remain staged exactly as documented in the browser-boundary report.
