---
name: new-sandbox-page
description: Create a new page at hales.ai/cupcake/sandbox/<slug> — the auto-discovered sandbox page convention. Use when asked to add a page, demo, or experiment to the website sandbox.
---

# New Sandbox Page

Pages under `src/pages/cupcake/sandbox/<slug>/page.tsx` are auto-discovered at build time (import.meta.glob in App.tsx) and served at `https://hales.ai/cupcake/sandbox/<slug>`. No routing changes needed.

## Requirements for page.tsx
1. `export const metadata = { title: '...', description: '...', createdAt: 'YYYY-MM-DD' };` — the sandbox index reads this.
2. Default-export a React FC.
3. Slug: lowercase, `[a-z0-9-]` only (the router regex rejects anything else).
4. Include the back button (copy from `_template/` or an existing page):
```tsx
<button onClick={() => { window.history.pushState({}, '', '/cupcake/sandbox'); window.dispatchEvent(new PopStateEvent('popstate')); }}>← Back to Sandbox</button>
```
5. Dark theme base `bg-[#0a0a0f]`, Tailwind + Framer Motion available. Never import from gate-protected files.

## Ship it
Use the `deploy-website` skill (standard deploy — sandbox pages are never gate-protected).

## Alternative: let the bot build it
`curl -X POST https://automate.hales.ai/webhook/cupcake-build -H "Content-Type: application/json" -d '{"prompt": "<what to build>", "slug": "<slug>"}'` — n8n generates the page with AI, commits, and deploys autonomously (notifies Matt's Telegram). Prefer hand-writing for anything that needs to be good.
