# Hales AI

The company website for [Hales AI](https://hales.ai) — a one-person AI shop building telephony agents, workflow automation, and custom AI solutions.

**Live at**: [https://hales.ai](https://hales.ai)

## What's Here

- **Main site**: Company landing page with 3D hero, service grid, integrations marquee, and embedded voice agent
- **Cupcake Dashboard** (`/cupcake`): Password-protected control panel for Cupcake, a multi-channel AI assistant that runs across Telegram, phone, web, and CLI
- **Sandbox** (`/cupcake/sandbox/*`): AI-generated pages deployed via automated pipeline — code gen → git → Docker → live in ~2 minutes

## Tech Stack

- **Framework**: React 18 + Vite + TypeScript
- **Styling**: Tailwind CSS + Framer Motion
- **Voice**: Vapi.ai embedded widget (tap-to-speak on landing page)
- **3D**: Three.js animated hero background
- **Hosting**: Docker container on DigitalOcean, nginx reverse proxy, Let's Encrypt SSL
- **Deployment**: Webhook-triggered — `git pull` → `docker build --no-cache` → swap container
- **Automation**: n8n workflow handles the full deploy pipeline with Telegram notifications

## Architecture

```
hales.ai (nginx + SSL)
    → Docker container (port 3000)
        → React SPA
            ├── /             Landing page
            ├── /cupcake      Dashboard (auth required)
            ├── /cupcake/sandbox/*  Auto-generated pages
            └── /cupcake-test Demo page
```

## Development

```bash
git clone https://github.com/notsoround/hales-ai-website.git
cd hales-ai-website
npm install
npm run dev
# → http://localhost:5173
```

Environment variables (optional, for voice widget):
```
VITE_VAPI_PUBLIC_KEY=
VITE_VAPI_ASSISTANT_ID=
```

## Deployment

The production deploy is fully automated via n8n webhook:

```bash
# Trigger deploy
curl -X POST https://automate.hales.ai/webhook/cupcake-deploy

# Or manually on the droplet
ssh root@134.199.239.171
/var/www/deploy-hales-ai.sh
```

The deploy script includes content verification gates — it checks for required UI markers and rejects deploys that would regress the design.

---

Built and maintained by [Matt Hales](https://hales.ai)
