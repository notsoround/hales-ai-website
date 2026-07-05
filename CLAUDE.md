# hales-ai-website

Public marketing site for Hales AI (https://hales.ai) — AI telephony, voice cloning, workflow automation, smart scheduling, web development. Owner: Matt Hales (GitHub: notsoround).

## Stack
- React 18 + Vite + TypeScript + Tailwind + Framer Motion, SPA
- **No react-router** — custom switch-based view routing in `src/App.tsx` (`pushState` + `popstate`). New top-level views = new `case` in that switch.
- Docker + nginx serve the built site on the DigitalOcean droplet (134.199.239.171), port 3000 behind nginx → https://hales.ai

## Cupcake sandbox pages (preserve!)
- `src/pages/cupcake/sandbox/<slug>/page.tsx` — auto-discovered pages built by the Cupcake/Ara Telegram bot via n8n. Never delete or restructure these; they are Matt's AI-shipped pages.
- Each page: `export const metadata = {title, description, createdAt}` + default-exported React FC.

## Deploy pipeline (the ONLY way to production)
1. Commit + push to `main` (origin = git@github.com:notsoround/hales-ai-website.git).
2. Trigger: `curl -X POST https://automate.hales.ai/webhook/cupcake-deploy` (or run `/var/www/deploy-hales-ai.sh` on the droplet via `ssh root@134.199.239.171`).
3. The script: `git reset --hard origin/main` → **canonical gate** → docker build → smoke check → auto-rollback on failure.

### Canonical gate (critical)
`/var/www/deploy-hales-ai.sh` hash-pins these files: `src/App.tsx`, `src/components/Navbar.tsx`, `src/components/Hero3D.tsx`, `src/components/IntegrationsMarquee.tsx`, `src/components/VoiceButton.tsx`.
**If you intentionally change any of them**: after pushing, update the corresponding `assert_file_hash` line in the droplet script with the new `sha256sum` of the file, or the deploy will refuse. Never bypass with `ALLOW_CANONICAL_OVERRIDE=1` unless Matt says so; update the hashes instead so the gate keeps protecting the new canonical state.

## Local dev
- `npm install && npm run dev` (Vite, port 5173) · build check: `npm run build && npx tsc --noEmit`

## Conventions
- Modern patterns only, TypeScript strict, no `.bak` files committed, assets referenced from `public/` must actually be used.
- Git auth: droplet uses its own deploy key; from this Mac use `GIT_SSH_COMMAND="ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes"` (default key auths as the wrong GitHub account).
