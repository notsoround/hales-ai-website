# DRAFT: Cupcake privacy policy (for Matt to edit; not published)

Status: plain draft, 2026-11-16, Code Cupcake (Grok). Not linked from the site, not a route, no change to `src/App.tsx`
or `index.html` (both are pinned by the deploy script). Every factual line was checked against the code on `main`
(website `hales-ai-website` and backend `voice-vault`); the "Where this comes from" list at the end gives the file for each.
Anything the code cannot prove is marked **[MATT TO CONFIRM]**. This is not legal advice; have it reviewed before publishing.

---

**Cupcake Privacy Policy**
Last updated: [MATT TO CONFIRM: date of publication]

Cupcake (also offered with the "Matthieu" assistant) is a food log, daily check-in and AI coach that runs at
`hales.ai/cupcake/account` and can be added to your phone's home screen. It is operated by [MATT TO CONFIRM: legal name of
the operator / company, and country]. Contact: [MATT TO CONFIRM: privacy contact email].

## 1. What we collect

**Your account**
- Email address, the name you give, and when the account was created.
- Your password, stored only as a salted one-way hash (PBKDF2-SHA256, 600,000 rounds). We cannot read your password.
- Sign-in sessions: a random session token is kept in a secure, host-only cookie (`__Host-cupcake_session`); the server
  stores only a hash of it. Sessions last 12 hours, or 30 days if you choose "remember me". Failed sign-in attempts are
  counted for a short time to block guessing.

**What you put in**
- Meals: photos you take or choose, the AI's estimate of what is on the plate (items, calories, protein, carbs, fat), the
  time you ate, portion changes, and meals you type in yourself. Photos are resized in your browser before upload.
  [MATT TO CONFIRM: whether photo location/EXIF metadata survives the in-browser re-encode; the code re-encodes to JPEG,
  which normally drops it, but this has not been verified.]
- Food targets and settings (for example a daily calorie target), meal and workout plans, grocery lists.
- Weight, body measurements and glucose readings you enter, and exercise you log.
- Wins and setbacks you record, and notes.
- Conversations with the assistant: typed chats, and if you use them, voice recordings, live voice conversations and their
  transcripts.
- Your assistant preferences (which persona, its name and look).

**From connections you turn on**
- Apple Health (iPhone), through the Health Auto Export app: the metrics you choose to send (for example steps, sleep and
  weight). Each phone gets its own upload credential, which you can revoke.
- [MATT TO CONFIRM] Android Health Connect: the app currently says this is "not available for accounts yet". Remove or
  update this line when it is.
- [MATT TO CONFIRM] Glucose sensor (Libre), ring sleep data (RingConn) and bank spending: in the code these come from
  sources tied to the owner's own account only; other accounts see them as unavailable. State whether any are offered to
  the public before publishing.

**Coaching and sharing**
- If you invite or accept a coach, we keep the invitation, the relationship, and what you chose to share (for example a
  clean report or meal photos), for how long, and when it was revoked.

**Usage and cost records**
- For AI features we keep per-request records needed to enforce limits and reconcile cost (which feature, which model,
  time, cost estimate, request status). [MATT TO CONFIRM: whether any server access logs (IP address, user agent) are kept
  by the web server and for how long; not determinable from the application code.]

**On your device**
- The app stores a few preferences in your browser (theme, assistant appearance and position, Labs switches, unsent
  drafts, and a short-lived closure receipt if you close your account). These stay on your device.
- We do not use advertising or analytics trackers. No analytics or ad scripts were found in the website code.
  [MATT TO CONFIRM before publishing.]

## 2. How we use it
- To run the app for you: log and estimate meals, show your day and history, answer your questions, and keep you signed in.
- To show your data to a coach only when you share it, and only what you shared.
- To keep the service safe and within cost limits.
- We do not sell your data and do not use it for advertising. [MATT TO CONFIRM]
- [MATT TO CONFIRM: whether account data is ever used to improve prompts or the product beyond your own account.]

## 3. Who processes it for us
To provide AI features, the content needed for that one request is sent to these processors:
- **OpenRouter** routes AI requests: assistant chat (model `openai/gpt-4o-mini`), meal photo estimates (the photo and
  instructions), voice-note transcription (`openai/whisper-1`, OpenAI as the provider), and optional web search in the
  plan builders (a Labs feature, off by default).
- **Vapi** runs live voice conversations (with **Daily** for the call audio connection); the model behind live voice is
  provided by **xAI** through Vapi. [MATT TO CONFIRM: Vapi's speech-to-text and voice providers and their retention.]
- [MATT TO CONFIRM: each processor's data retention and training settings (for example OpenRouter's and the model
  providers' zero-retention or no-training options), and whether a data processing agreement is in place.]
- Hosting: the app's data is stored on a server we operate. [MATT TO CONFIRM: hosting provider and region/country.]

We do not send your data to anyone else unless you ask us to (for example by sharing with a coach) or the law requires it.

## 4. Where it is stored and how it is protected
- Account data is kept in a database and file store on our server; meal photos and recordings are stored as files there.
  Every record is tied to your account, and the server checks your session on every request; the browser cannot choose
  whose data it reads.
- Connections use HTTPS. Passwords are hashed; session and upload tokens are stored only as hashes.
- Backups: encrypted backups of the server are kept. [MATT TO CONFIRM: backup encryption, location, and how long backups
  are kept.]

## 5. How long we keep it
- Your data stays while your account is open.
- [MATT TO CONFIRM] Retention after closing or a deletion request. Today, closing an account (see section 6) stops access
  but does not erase saved content; no retention period has been set in the code.

## 6. Your choices and rights
- **Download your data:** Settings lets you download a copy of your structured data (meals and food settings, assistant
  preferences, recordings and transcripts, voice conversations, invitations and sharing, and more) and originals you select.
- **Revoke connections:** remove a phone's Apple Health upload credential, and stop sharing with a coach, at any time.
- **Close your account:** Settings → "Close your account". You confirm with your password and the phrase `CLOSE MY ACCOUNT`.
  This signs out all devices, stops uploads and coach sharing, and you cannot sign back in. **It does not erase your saved
  data.** [MATT TO CONFIRM: whether self-service closure is switched on in production.]
- **Delete your data:** see "Delete my account" (draft: `reports/CUPCAKE-DELETE-ACCOUNT-DRAFT-2026-11-16.md`).
  Self-service erasure is not available yet; [MATT TO CONFIRM: how to request it and how long it takes].
- [MATT TO CONFIRM: which legal rights to list for your users' locations (for example access, correction, deletion,
  portability, objection), and how to exercise them.]

## 7. Health information
Cupcake shows estimates to help you notice patterns. It is not a medical device and does not give medical advice.
[MATT TO CONFIRM: whether any health-privacy law applies (for example US state consumer health data laws, or GDPR special
category data for EU users) and the consent wording it needs.]

## 8. Children
Cupcake is not intended for children. [MATT TO CONFIRM: minimum age (for example 13, 16 or 18) and what happens if a
child's account is found.]

## 9. Changes
We will update this page when the app changes how it handles data, and change the date at the top.
[MATT TO CONFIRM: whether users are notified in the app or by email for material changes.]

## 10. Contact
[MATT TO CONFIRM: name, email and postal address for privacy questions.]

---

## Where this comes from (for Matt; remove before publishing)
| Claim | Source on `main` |
|---|---|
| Account fields, PBKDF2-SHA256 600,000 rounds, 12 h / 30 d sessions, token hashes, failure throttling | voice-vault `build/cupcake_account_sessions.py` |
| Cookie `__Host-cupcake_session` | voice-vault `build/cupcake_account_http.py` |
| Data kept per account (meals, items, settings, weight, body check-ins, glucose, exercise, outcomes, chats, talk sessions, coach grants/invitations, health uploads, AI cost records) | voice-vault `build/cupcake_account_deletion_inventory.py` (`COLUMNS`) |
| In-browser photo resize/re-encode | website `src/components/cupcake/prepareFoodImage.ts` |
| Chat model `openai/gpt-4o-mini` via OpenRouter; web search off unless enabled | voice-vault `build/cupcake_account_quick_chat.py` |
| Meal photo estimates via the same provider path | voice-vault `build/cupcake_account_food_photo.py` |
| Transcription `openai/whisper-1`, provider OpenAI | voice-vault `build/cupcake_account_transcription.py` |
| Live voice via Vapi, xAI model, Daily transport | voice-vault `build/cupcake_account_voice.py` |
| Apple Health via Health Auto Export with per-account upload credential; Health Connect "not available for accounts yet"; Libre "shown when connected" | website `src/components/cupcake/AccountAppleHealth.tsx`, `noir/ConnectionsHub.tsx` |
| Libre reader returns unavailable for other accounts | voice-vault `build/cupcake_account_cgm.py` |
| Self-export sections | website `src/components/cupcake/AccountSelfExport.tsx`, voice-vault `build/cupcake_account_export_bundle.py` |
| Closure effect, phrase, 7-day receipt, "does not erase your data" | voice-vault `build/cupcake_account_closure.py` (`DISCLOSURE`), website `AccountClosureControls.tsx` |
| Deletion requests are source only, not activated | voice-vault `build/cupcake_account_deletion.py` (`DISCLOSURE['availability']`) |
| Browser storage keys (theme, appearance, Labs, drafts, closure receipt) | website `src/components/cupcake/*` (`cupcake-*-v1` keys) |
| No analytics/ad scripts | website `src/`, `index.html` searched for gtag, GTM, Plausible, PostHog, Segment, Mixpanel, Sentry, Hotjar, Clarity: none |
