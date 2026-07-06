# hales.ai — Architecture & Operations

_Last updated: 2026-07-06_

Marketing site for Hales AI (AI telephony, voice cloning, workflow automation, smart scheduling, web development). This documents the stack, how it deploys, and the safety rails.

---

## 1. Stack

- **React 18 + Vite + TypeScript + Tailwind + Framer Motion** — single-page app.
- **No react-router.** Routing is a custom switch in `src/App.tsx` using `pushState` + `popstate`. A new top-level page = a new `case` there.
- **Served by nginx in Docker** on the DigitalOcean droplet (134.199.239.171), port 3000, behind nginx → https://hales.ai.
- Build output is code-split: main bundle ~95KB, with `three` / `motion` / `vapi` in separate chunks.

---

## 2. Page map

| Route | Component | Notes |
|-------|-----------|-------|
| `/` | `App.tsx` default | Hero, voice orb, services (BentoGrid), integrations marquee, footer, chat widget |
| `/get-started`, `/learn-more`, `/about-us`, `/contact-us`, `/elite-ops` | pages | Contact form emails matt@hales.ai via n8n |
| `/cupcake` | `pages/cupcake/page.tsx` | Password dashboard (chat to Cupcake); links to sandbox |
| `/cupcake/sandbox` | `pages/cupcake/sandbox/page.tsx` | Auto-lists every page the bot built |
| `/cupcake/sandbox/<slug>` | `pages/cupcake/sandbox/<slug>/page.tsx` | AI-generated pages (auto-discovered via `import.meta.glob`) |

### Sandbox pages
Drop a `page.tsx` under `src/pages/cupcake/sandbox/<slug>/` with `export const metadata = {title, description, createdAt}` and a default-exported React FC. It appears automatically after the next build — no routing edits. Preserve these; the Cupcake bot ships them.

---

## 3. Live integrations (what actually calls out)

- **Vapi** — the hero "Talk to our AI" voice orb. Needs `VITE_VAPI_ASSISTANT_ID` + `VITE_VAPI_API_KEY` baked in at build (see §5).
- **n8n webhooks** — `cupcake-web` backs the chat widget + `/cupcake` dashboard; `cupcake-actions` backs the contact form (emails you); `cupcake-deploy` runs the deploy.
- **Cupcake dashboard password** — `VITE_CUPCAKE_PASSWORD` baked in at build.

---

## 4. Deploy pipeline (the only path to production)

1. Commit + push to `main`. From this Mac: `GIT_SSH_COMMAND="ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes" git push origin main` (the default key auths as the wrong GitHub account). The droplet has its own SSH deploy key.
2. Trigger: `curl -X POST https://automate.hales.ai/webhook/cupcake-deploy` (or run `/var/www/deploy-hales-ai.sh` on the droplet).
3. The script: `git reset --hard origin/main` → **canonical gate** → `docker build` (node 22) → smoke test → auto-rollback on failure. A rollback image is tagged before each deploy.

### Canonical gate (critical)
`deploy-hales-ai.sh` hash-pins these files: `src/App.tsx`, `src/components/Navbar.tsx`, `src/components/Hero3D.tsx`, `src/components/IntegrationsMarquee.tsx`, `src/components/VoiceButton.tsx`. **If you change one, update its `assert_file_hash` line on the droplet** with the new `sha256sum`, or the deploy refuses. Never bypass with `ALLOW_CANONICAL_OVERRIDE=1` — update the hash so the gate keeps protecting the new state.

---

## 5. Build-time env (why the voice button once looked dead)

`.env` is intentionally excluded from the Docker build context (`.dockerignore`). The `VITE_*` public vars are passed as Docker **build args** in the deploy script and declared as `ARG`/`ENV` in the `Dockerfile`, so they bake into the bundle:
`VITE_CUPCAKE_PASSWORD`, `VITE_VAPI_API_KEY`, `VITE_VAPI_ASSISTANT_ID`.
The droplet source of truth for these is `/var/www/hales-ai-website/.env`.

---

## 6. Local dev

```
npm install
npm run dev            # Vite on :5173
npm run build && npx tsc --noEmit   # must be clean before deploy
```

## 7. SEO / perf baked in
Real title/description/OG/Twitter meta + Organization JSON-LD in `index.html`; `robots.txt` + `sitemap.xml` (exclude /cupcake); branded `favicon.svg`; nginx immutable caching for `/assets`, no-cache HTML shell. `npm audit` = 0 vulnerabilities (vite 8, node 22).

## 8. Rollback
Every deploy tags `hales-ai-website:rollback-<timestamp>`. To restore:
```
ssh root@134.199.239.171 'docker images | grep rollback | head'
ssh root@134.199.239.171 'docker stop hales-ai-website; docker rm hales-ai-website; \
  docker run -d -p 3000:3000 --restart always --name hales-ai-website hales-ai-website:rollback-<TS>'
```
