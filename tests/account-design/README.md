# Account app design harness

Renders the real React account app with fictional accounts and blocked network, for layout and accessibility checks. Nothing here touches production or real data.

Run from the repository root (Tailwind only loads with that working directory):

```bash
ASSESS_ROOT="$PWD" ASSESS_OUT=/tmp/cupcake-shots node tests/account-design/render-all.mjs     # 108 screens, 320/390/1280, both themes; writes cases.json
W=390,1280 T=caribbean,rose ASSESS_ROOT="$PWD" ASSESS_OUT=/tmp/cupcake-shots node tests/account-design/render-main.mjs   # Today/Food/Assistant/Reports quick look
AXE=/path/to/axe-core/axe.min.js OUT=/tmp/axe.json ASSESS_ROOT="$PWD" ASSESS_OUT=/tmp/x node tests/account-design/axe.mjs   # WCAG 2.1 A/AA serious+critical
ASSESS_ROOT="$PWD" ASSESS_OUT=/tmp/x node tests/account-design/companion-scroll.mjs   # floating companion must not move while scrolling
W=390 ASSESS_ROOT="$PWD" ASSESS_OUT=/tmp/x node tests/account-design/probe-ax.mjs   # Chrome's accessibility tree in reading order (Today, phone assistant, Reports); fails on order/containment/naming regressions. Run at W=390 and W=1280
```

Dependencies are absolute paths on Matt's Mac (vite from `hales-ai-website-account-voice/node_modules`, Playwright from the codex runtime). `npm i axe-core@4.10.2` anywhere for the axe check. A pass means: no `harnessError`, no `scrollWidth > width`, no page errors, and `{}` from axe.
