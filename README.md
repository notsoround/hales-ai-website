# Hales AI

**Voice agents, workflow automation, and interactive interfaces.** Built by Matt Hales and the Hales AI team.

[Explore the live site](https://hales.ai) · [Meet HAL](https://hales.ai/lab/hal/index.html)

## The experience

**HAL / Signal Lab** is an interactive character with a glowing red lens, independent eye and reflection movement, and pointer tracking. Start a voice conversation from the page, or play with its visual pulse. Voice requires microphone permission; pointer tracking does not use a camera.

The main site presents Hales AI's services alongside interactive experiments and a public chat experience. Cupcake is a separate private assistant project; its credentials and personal data are not part of this public showcase.

## Built with

| Layer | Tools |
| --- | --- |
| Website | React 18, TypeScript, Vite |
| Interface | Tailwind CSS, Framer Motion |
| HAL experiment | Standalone HTML, JavaScript modules, Three.js |
| Voice | Vapi Web SDK |
| Hosting | Docker and a reverse proxy |

The HAL scene includes a poster fallback, responsive layout, capped rendering resolution, motion controls, and off-screen rendering pauses. Those choices help keep an expressive scene usable on smaller devices; performance still depends on the device and browser.

## Run locally

```sh
git clone https://github.com/notsoround/hales-ai-website.git
cd hales-ai-website
npm ci
npm run dev
```

Open the address printed by Vite. The HAL experiment is at `/lab/hal/index.html`.

```sh
npm run build
npm run preview
```

Voice and backend integrations require their corresponding service configuration. A local page rendering successfully does not prove those integrations are connected. Never place private API keys or personal assistant credentials in browser bundles.

## Project boundaries

- This repository is the public website and its experiments, not the private Cupcake deployment.
- Employer repositories, client records, health data, and financial records belong outside this public repository.
- Public demos should use public information or synthetic examples.
- Production deployment uses an operator-controlled process with content verification gates. A local build does not publish the site.

---

**[Hales AI](https://hales.ai)** — useful systems with a little personality.
