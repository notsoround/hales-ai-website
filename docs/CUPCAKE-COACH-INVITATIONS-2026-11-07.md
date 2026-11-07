# Coach invitations and explicit sharing — November 7, 2026

Source only. This change neither deploys nor activates a schema, sends an invitation,
creates a real account, grants real access, or contacts an external provider.

The existing Reports reader now contains **My clients & invitations** and **Sharing
controls**. Enabled coaches can create an email-bound invitation with a confirmed
assistant preview and 1/7/14-day expiry. The private link is held in memory and shown
once; copying is manual and no email is sent. Pending, expired, revoked and accepted
states remain visible. A missing once-only token response tells the coach to revoke
and recreate rather than presenting an empty link as success.

`/cupcake/account#invite=…` consumes the fragment before React mounts and removes the
token using `history.replaceState`. Anonymous preview/redeem use POST bodies. The
recipient chooses their own name/password for a new account, or signs into the
intended existing account and explicitly accepts. Existing passwords and saved
assistant preferences are preserved. Pilot disclosure acceptance is explicit;
membership itself shares no data.

Owners choose an accepted connection, independently opt into the clean report and/or
original meal photos, and set a 1/7/30-day expiry. Report categories and exclusions
are shown before consent. Revocation remains available. Sharing is directional:
the signed-in account grants only its own data, including for reciprocal coaching.
The original clean report/photo reader and owned-grant revoke view remain intact.

Frontend contract is coordinated with the matching voice-vault pilot lifecycle:

- Authenticated `coach/workspace`, `coach/invitations/create|list|revoke`.
- Anonymous `invitations/preview|redeem`; authenticated `invitations/accept`.
- Authenticated `sharing/relationships|grant|revoke`.
- Cookie authentication, captured account-context header and identity echo fence
  every authenticated response. No client-supplied owner selector is added.

Validation (synthetic data and isolated Playwright contexts only):

- `node tests/account-invitations.test.mjs`: invitation creation/copy/hide, public
  preview and fragment cleanup, wrong-account refusal, intended existing-account
  acceptance, new own-password signup under React StrictMode, independent off-by-
  default scopes, report-only/photo-only/both grants, expiry and revocation.
- `node tests/account-coach.test.mjs`: all three existing reader/photo/context/revoke
  browser scenarios pass.
- Both themes at 320/390/1280 pixels have no horizontal overflow or nested forms.
  Local screenshots: `/tmp/cupcake-invitation-evidence/` (synthetic only).
- Application TypeScript and scoped ESLint pass. Root release integration owns the
  single combined production build. `App.tsx` and protected page source are unchanged.
- Zero legacy owner-key reads or private/provider requests in the new scenarios;
  invitation tokens are absent from the URL and browser storage after entry.
