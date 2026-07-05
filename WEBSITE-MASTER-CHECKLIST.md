# hales.ai Master Checklist — Architect's Plan (updated 2026-07-05, evening)

✅ = done & deployed to production · ⏳ = remaining

## 1. Quick wins ✅ ALL DONE
- [x] Delete 6 dead components + committed `App.tsx.bak`
- [x] Delete ~3MB unreferenced public assets (sounds, dupe Quantum_Code folder, unused avatars)
- [x] Strip dead GLSL shaders from `index.html`
- [x] Fix dead YouTube link (`@hales_ai` → `@HalesAi`)
- [x] Real SEO head: title, description, canonical, OG + Twitter cards, theme-color
- [x] Branded `favicon.svg`
- [x] `CLAUDE.md` harness + `.claude/` skills (deploy-website, new-sandbox-page) + global n8n-hales skill

## 2. Security & deps ✅ DONE
- [x] **74 → 0 vulnerabilities.** Upgraded vite 5→8, removed unused bcrypt/gsap/axios + dead VapiService.ts. `npm audit` = clean.
- [x] Bumped Docker build image node 18 → 22 (vite 8 needs ≥20.19).
- [ ] ⏳ Rotate the OpenRouter key hardcoded in n8n workflow HTTP nodes (ops item, separate from the site).
- [ ] ⏳ `/cupcake` password is client-side only (baked into the JS bundle) — fine as a soft gate, but not real security. For anything sensitive, move auth server-side (n8n check).

## 3. Brand & design ✅ MOSTLY DONE
- [x] **Integrations marquee now shows real logos** — identified & wired 10 (OpenAI, Gemini, ElevenLabs, Google Cloud, Azure, Twilio, Slack, HubSpot, Google Calendar, Google Sheets), clean monogram fallbacks for the rest, edge-fade masks, modern pill cards.
- [x] **Voice button redesigned** — animated conic-gradient orb with live waveform driven by real Vapi volume, clear state labels ("Talk to our AI" / "Live — tap to end"). The old one divided a 0–1 volume by 100 so it literally never moved.
- [x] **Real logo mark** — SVG "H" monogram in the Navbar + favicon (seed for a fuller brand identity later).
- [x] Removed personal 🧁 Cupcake link from the client-facing top nav (still reachable in footer).
- [ ] ⏳ Per-service deep pages (AI Telephony, Voice Cloning, etc.) — BentoGrid links exist; dedicated pages with individual pitches + CTAs would be the next polish.
- [ ] ⏳ "Why Choose Us" copy is still generic ("Cutting-edge artificial intelligence technology") — worth a rewrite.
- [ ] ⏳ Full custom logo/wordmark from a designer or the /draw pipeline (current mark is clean but simple).

## 4. Functional completion ✅ MOSTLY DONE
- [x] **Chat widget now works** — rewired from the broken Vapi REST path to the live cupcake-web n8n webhook; floating launcher button on home; verified end-to-end (real AI reply received in preview).
- [x] **Contact form is real** — submits to the cupcake-actions webhook (emails matt@hales.ai) with sending/success/error states. Was mailto-only.
- [x] **Voice button now actually connects** — root cause found: `.env` was excluded from the Docker build, so `VITE_VAPI_ASSISTANT_ID` was empty in the live bundle (the button could never start a call — that's why it "looked the same"). Fixed via Docker build args; assistant ID now baked in.
- [x] Removed exposed `/cupcake-test` route + dead PageKey entries.
- [x] Added a real 404 view for unknown paths.
- [ ] ⏳ Verify the live Vapi call quality/error-handling on a real phone (needs a human mic test).
- [ ] ⏳ LinkedIn URL `company/hales-asi` resolves but looks like a typo of `hales-ai` — confirm the correct page.

## 5. Tech & SEO ✅ DONE
- [x] **Main bundle 1,576KB → 95KB** (26KB gzip) via manual chunks (three / motion / vapi split out).
- [x] nginx: immutable cache for `/assets/*`, no-cache HTML shell, tuned gzip.
- [x] `robots.txt` + `sitemap.xml` (excludes /cupcake).
- [x] Organization JSON-LD structured data.
- [ ] ⏳ Proper 1200×630 social share image (currently reuses video-thumb.png).
- [ ] ⏳ Mobile Lighthouse pass (DotCursor now gated to fine-pointer devices, which helps).

## 6. Deploy-gate bookkeeping ✅ MAINTAINED
- [x] All gate hashes updated for changed protected files (App.tsx, Navbar, IntegrationsMarquee, VoiceButton); gate marker "TAP TO SPEAK" → "VoiceButton"; verified consistent.
- [x] Deploy pipeline health confirmed end-to-end (multiple clean deploys tonight, smoke checks passing).
