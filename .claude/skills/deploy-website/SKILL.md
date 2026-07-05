---
name: deploy-website
description: Deploy hales.ai to production — push, canonical-gate hash updates, webhook trigger, verification. Use whenever changes to this repo need to go live, or when a deploy fails the canonical gate.
---

# Deploy hales.ai

## Standard deploy
1. `npm run build && npx tsc --noEmit` — must be clean before any deploy.
2. Commit and push: `GIT_SSH_COMMAND="ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes" git push origin main` (default SSH key auths as the wrong GitHub account). If port 22 is refused (VPN), add `-o Hostname=ssh.github.com -o Port=443`.
3. Trigger: `curl -s -m 540 -X POST https://automate.hales.ai/webhook/cupcake-deploy -H "Content-Type: application/json" -d '{}'` — waits for completion, replies with the Telegram notification payload. The droplet script does git reset --hard origin/main → gate → docker build → smoke test → auto-rollback.
4. Verify: `curl -s -o /dev/null -w "%{http_code}" https://hales.ai` → 200, and spot-check the changed page.

## If you changed a gate-protected file
Gate files: `src/App.tsx`, `src/components/Navbar.tsx`, `src/components/Hero3D.tsx`, `src/components/IntegrationsMarquee.tsx`, `src/components/VoiceButton.tsx`.
After pushing, update the pinned hash(es) on the droplet BEFORE triggering the deploy:
```bash
ssh root@134.199.239.171 'cd /var/www/hales-ai-website && git fetch origin && git show origin/main:src/App.tsx | sha256sum'
# then edit /var/www/deploy-hales-ai.sh: replace the assert_file_hash line for that file with the new hash
```
Never use `ALLOW_CANONICAL_OVERRIDE=1` — update hashes so the gate keeps protecting the new canonical state.

## Emergency rollback
The deploy script auto-tags `hales-ai-website:rollback-<timestamp>` before each deploy:
```bash
ssh root@134.199.239.171 'docker images | grep rollback | head -3'   # pick one
ssh root@134.199.239.171 'docker stop hales-ai-website; docker rm hales-ai-website; docker run -d -p 3000:3000 --restart always --name hales-ai-website hales-ai-website:rollback-<TS>'
```
