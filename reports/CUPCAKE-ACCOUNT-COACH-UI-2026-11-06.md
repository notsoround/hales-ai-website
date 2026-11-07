# Account-bound coach report UI — 2026-11-06

This adds **Reports** inside the same shared Cupcake root, enabled only by the
existing default-off account-session build flag. MyCupcake continues to refer
to the signed-in account. A selected delegated view is explicitly headed
**Report — authorized owner label**, using the verified server display label.
Opening the personal Assistant from Reports returns to the personal Today
context; report data is never seeded into a personal chat. The separate legacy
coach route is unchanged and is never automatically adopted by account sign-in.

## Scope and transport

The owner chooser discovers active received grants for the authenticated account
only. It has no account search, owner-ID request field, URL-provided grant,
public recipient picker or browser fallback. The UI filters expired, revoked,
wrong-subject and invalid self-grants. The backend authorizes every data request
again. `clean-report` and `meal-photo` are independent permissions: a missing
scope produces a clear explanation and no request for that resource. Selecting
a different owner, range or personal view clears the previous report and images.

Seven- and 30-day ranges use Chicago calendar dates with an explicit end date.
The new report component renders allowlisted numeric fields from owned local
weight/body/glucose/exercise/outcome/steps/RingConn/nutrition projections. It
shows provenance, query coverage, invalid-row omissions and missing values.
Unknown exercise duration stays null; a one-reading weight change stays null;
known zero steps remain zero. Nutrition displays known totals and per-nutrient
missing/known counts. Photos and purchases do not establish eating, and the UI
does not claim complete intake or complete tracking from query coverage. It
renders no raw notes, chats, descriptions or arbitrary extra report fields.
Report owner, grant, range and version must match the selected authorized context.

Meal-photo references load separately. A user explicitly chooses Load photo;
the client mints a short-lived authorized URL, validates the fixed API origin,
path and token-only query, and fetches with cookies, request header and captured
account-context header. Redirects are refused. The binary response must echo
that exact principal and have an allowed bounded image type before a blob URL
can be created. Signed/private URLs are never image src attributes. Tokens and
images are not saved in browser storage. Blob URLs are revoked on navigation,
range/grant changes, expiry, logout or identity replacement. A failed reload
clears the previous photo and shows a refusal. HTTP 401 or a principal/echo
mismatch locks the whole personal UI through the existing session boundary.

The existing-sharing control lists only the current owner's grants, using
server-verified recipient labels, scopes and expiry. Revocation requires an
explicit button and confirmation, uses the captured account fence, and reloads
the list. New grant creation and provisioning remain a separate incomplete step;
this does not claim a complete owner-to-coach sharing journey. Already received
report bytes cannot be remotely recalled; refreshed grants and every subsequent
report/photo request enforce current expiry and revocation. No public recipient
lookup or fabricated account/recipient is introduced.

## Dependency and validation

Requires backend PR101, approved
`56736cb138fb750b0ba7b6dac67105e261954c4a`, merged
`a606f7ed44c1712a02bf2487f49ddb995b07671b`, plus its complete offline ownership
and coach-grant migrations and separately approved runtime deployment/account
provisioning. The browser flag stays off. No migration, real grant/data write,
provider, deployment, activation or permission change occurred.

Three synthetic actual-root Chromium scenarios at 390px and 1280px passed:

- Active discovery and explicit personal/report navigation; numeric-only fields,
  missing coverage, one-reading weight and unknown duration; inclusive 7/30 days;
  a clean-report grant makes no meal-photo calls.
- Photo-only scope makes no report call; authenticated blob-only display, scope
  refusals, URL revocation, rejected external URLs and mismatched binary echo.
- Delayed old-account report and binary responses are discarded after switching;
  owner existing-list/revoke, revoked grant disappearance and displayed-blob
  cleanup on logout.

Also passed: four existing account-boundary browser scenarios; eight focused
flag-off root integration checks; application TypeScript; scoped lint with zero
errors (the existing page metadata fast-refresh warning remains); both default
and opt-in production builds; diff check. Tests intercepted or blocked external
networking. Accounts, grants, records and audio were simulated. Production
HTTPS/cookie/CORS acceptance, live migrations and a deployed coach journey are
not claimed. No broad historical suite, art styles, deployment scripts or
frontend finance/provider allowlist expansion is included.
