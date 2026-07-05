# hales.ai Master Checklist — Architect's Plan (2026-07-05)

Audit of the live site + codebase. ✅ = done in the 2026-07-05 cleanup pass.

## 1. Quick wins (done this pass)
- [x] Delete 6 dead components (AbstractBall, CursorTrail, GridBackground, HamburgerMenu, MatrixBackground, PasswordProtection)
- [x] Delete committed `src/App.tsx.bak.1771204434`
- [x] Delete ~3MB unreferenced public assets (6 sound files, duplicate `Hales-Ai_Quantum_Code/` folder, unused avatars adam/phil/elite_ops 2&4)
- [x] Strip dead GLSL shader blocks from `index.html` (only deleted AbstractBall used them)
- [x] Fix dead YouTube link in Footer (`@hales_ai` 404 → `@HalesAi`)
- [x] Real SEO head: title, meta description, canonical, OG + Twitter cards, theme-color
- [x] Branded `favicon.svg` (was the default Vite logo — embarrassing for an agency site)
- [x] `CLAUDE.md` harness for this repo

## 2. Security & deps (HIGH PRIORITY — next pass)
- [ ] **74 Dependabot vulnerabilities (1 critical, 35 high)** — https://github.com/notsoround/hales-ai-website/security/dependabot. Run `npm audit`, upgrade deps, retest build.
- [ ] `/cupcake` dashboard auth: PasswordProtection.tsx was dead code; verify `src/pages/cupcake/page.tsx`'s own auth actually gates it (it fetches automate.hales.ai/webhook/cupcake-web) and the password isn't client-side-only theater.
- [ ] Rotate the OpenRouter key hardcoded in n8n workflow HTTP nodes (also on the ops checklist).

## 3. Brand & design (the "phenomenal" pass)
- [ ] **Integrations marquee has NO logos** — it renders text-only names. `public/Integrations_images/` holds 16 downloaded logo webps that were never wired in. Rename them meaningfully (they're `image (1).webp`…), map to services, render real logos. ⚠️ `IntegrationsMarquee.tsx` is gate-protected — update droplet hash on deploy.
- [ ] **Logo**: Navbar + Footer + hero are all text-gradient wordmarks. Design a real mark (the new favicon's "H" motif can seed it; Matt's `/draw` pipeline with Gemini 3 Pro Image can generate candidates). ⚠️ Navbar.tsx is gate-protected.
- [ ] Hero: "Hales AI" headline + tagline is fine but generic; consider a stronger value prop + social proof strip.
- [ ] Per-service sections/pages: AI Telephony, Voice Cloning, Automation, Smart Scheduling, Web Dev — each needs its own pitch + CTA (currently one BentoGrid + generic "Why Choose Us" with filler copy like "Cutting-edge artificial intelligence technology").
- [ ] Decide whether 🧁 Cupcake belongs in the main client-facing nav (it's Matt's personal AI dashboard; consider moving to footer only).

## 4. Functional completion ("everything clicks through")
- [ ] **ChatInterface is rendered but unreachable** — `isChatOpen` starts false and nothing ever opens it. Add a floating chat button (it already talks to the cupcake-web webhook) or remove it. ⚠️ touches App.tsx (gated).
- [ ] Contact flow is mailto-only (`contact-us/page.tsx`, Footer, ProjectShowcase). Wire a real form → n8n webhook (Action Hub can send the email) with success/error states.
- [ ] Voice button (Vapi) on hero: verify the full call flow works with the AraVoice assistant and has visible error handling when mic permission is denied.
- [ ] Remove `/cupcake-test` route from production (test page exposed; also dead `matts-tasklist` / `quantum-code` PageKey entries). ⚠️ App.tsx (gated).
- [ ] Add a proper 404 view for unknown paths (currently silently falls back to home).
- [ ] LinkedIn URL is `company/hales-asi` — resolves 200 but verify it's actually the right company page (looks like a typo of hales-ai).

## 5. Tech & SEO hardening
- [ ] Main bundle is 1.58MB (459KB gzip) — code-split: three/vapi/framer chunks via `build.rollupOptions.output.manualChunks`; lazy-load below-the-fold sections.
- [ ] nginx: verify gzip/brotli + cache headers for `/assets/*` (immutable hashed filenames).
- [ ] Add `robots.txt` + `sitemap.xml` (list real routes; exclude /cupcake*).
- [ ] Add structured data (LocalBusiness/Organization JSON-LD).
- [ ] og:image is a repurposed video thumb — generate a proper 1200×630 social card (again: /draw pipeline).
- [ ] Lighthouse pass on mobile after code-split; the DotCursor + heavy Framer animations may hurt mobile perf — test and gate them to desktop.

## 6. Deploy-gate bookkeeping
Gate-protected files (droplet `deploy-hales-ai.sh` hash-pins them): `App.tsx`, `Navbar.tsx`, `Hero3D.tsx`, `IntegrationsMarquee.tsx`, `VoiceButton.tsx`.
Items above marked ⚠️ require updating the corresponding `assert_file_hash` sha256 on the droplet when deployed. Process documented in CLAUDE.md.
