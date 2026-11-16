# DRAFT: "Delete my account" page (for Matt to edit; not published)

Status: plain draft, 2026-11-16, Code Cupcake (Grok). Not linked, no route, no change to `src/App.tsx` or `index.html`
(pinned). App stores (Google Play in particular) ask for a public web page that explains how to delete an account and its
data, reachable without installing the app. This draft describes what the code does **today**; gaps are marked
**[MATT TO CONFIRM]**. Sources are listed at the end.

Important finding for Matt: the app today offers **closing** an account (access ends, data kept). **Erasing** an account's
data has backend code (`cupcake_account_deletion*.py`) that is explicitly "source only… not activated". Before a store
listing goes live, either switch on a verified deletion path or offer deletion by request with a stated time frame.

---

**Delete your Cupcake account**

You can close your Cupcake account from the app at any time, and you can ask us to delete your data.

### Before you start: download your data
Open Cupcake → **Settings** → download your data. You can choose what to include (meals and food settings, assistant
preferences, recordings and transcripts, voice conversations, invitations and sharing, and more) and any original files
you want. Once your account is closed you cannot sign in to download anything.

### Close your account in the app
1. Sign in at `hales.ai/cupcake/account` (or open Cupcake from your home screen).
2. Go to **Settings** and find **Close your account**. [MATT TO CONFIRM: where it sits in Settings and whether it is switched on in
   production.]
3. Read what closing does, enter your password, and type `CLOSE MY ACCOUNT`.
4. Confirm. You will get a private receipt in this browser that can confirm the closure for seven days.

**What closing does right away**
- Signs you out on every device. You cannot sign back in, and the app cannot reopen the account.
- Stops your phone uploads (Apple Health credentials are revoked) and ends sharing with any coach, including open invitations.

**What closing does not do**
- It does **not** erase your saved data. Your meals, photos, recordings, profile and charge records stay on our server.
- It does not remove copies in existing backups, data held by connected services, or copies other people already saved
  (for example a report you shared with a coach and they downloaded).

### Ask us to delete your data
Self-service deletion is not available in the app yet.
To have your account and its data deleted, [MATT TO CONFIRM: email address, or a form] from the email address on your
account, with the subject "Delete my Cupcake account". [MATT TO CONFIRM: how identity is verified.]

[MATT TO CONFIRM: all of the following before publishing]
- What is deleted: your account, meals and photos, food settings, weight, measurements and glucose entries, exercise,
  wins and setbacks, chats, recordings and transcripts, voice conversations, plans and groceries, health uploads, coach
  sharing records.
- What is kept, and for how long: for example minimal records of charges or of the deletion itself, if any.
- Backups: how long until deleted data ages out of backups.
- Processors: whether we ask AI providers to delete anything (requests are sent per use; their own retention applies).
- How long the whole deletion takes (for example "within 30 days"), and how we confirm it is done.

### Delete some data without deleting the account
[MATT TO CONFIRM: which records a user can remove themselves today (for example removing a logged workout, revoking a
phone upload credential, stopping coach sharing) and how to request removal of anything else.]

### Questions
[MATT TO CONFIRM: privacy contact.]

---

## Where this comes from (for Matt; remove before publishing)
| Statement | Source on `main` |
|---|---|
| Closure: password + `CLOSE MY ACCOUNT`, signs out devices, revokes device uploads and coach sharing; "This does not erase your data"; backups/external copies not erased; no reopening; 7-day receipt | voice-vault `build/cupcake_account_closure.py` (`DISCLOSURE`, `CONFIRMATION`), `reports/CUPCAKE-ACCOUNT-CLOSURE-INTEGRATION-2026-11-07.md`; website `src/components/cupcake/AccountClosureControls.tsx`, `accountClosure.ts` |
| Closure needs a server switch (`--enable-account-closure`); production state unknown | voice-vault `build/cupcake_account_http.py`, `build/cupcake_library.py` |
| Deletion requests: "Requested is not deleted"; "Source only: destructive domain adapters and retention/processor handling are not activated"; phrase `DELETE MY ACCOUNT AND DATA` exists only in source | voice-vault `build/cupcake_account_deletion.py` (`DISCLOSURE`) |
| Data domains a deletion would cover (main library tables, original media, auxiliary stores, processors, backups, restore admission) | voice-vault `build/cupcake_account_deletion.py` (`DOMAINS`), `build/cupcake_account_deletion_inventory.py` |
| Self-export sections and originals | website `src/components/cupcake/AccountSelfExport.tsx`; voice-vault `build/cupcake_account_export_bundle.py` |
