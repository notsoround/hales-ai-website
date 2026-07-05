import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export const metadata = {
  title: 'Ara System Status',
  description: 'Full diagnostic of the Ara + Cupcake AI stack — gateway, Telegram, voice, phone, cron, n8n, and website pipeline.',
  createdAt: '2026-07-05',
};

type Status = 'ok' | 'warn' | 'info';

interface Component {
  name: string;
  emoji: string;
  status: Status;
  headline: string;
  details: string[];
}

const COMPONENTS: Component[] = [
  {
    name: 'OpenClaw Gateway',
    emoji: '🧠',
    status: 'ok',
    headline: 'Running · LaunchAgent · survives reboots',
    details: [
      'v2026.6.11 on Matt’s Mac (upgraded 2026-07-05), port 18789 (loopback)',
      'RPC probe OK · auto-starts on login/reboot',
      'Restart: node openclaw.mjs gateway restart',
    ],
  },
  {
    name: 'Ara (Telegram)',
    emoji: '😈',
    status: 'ok',
    headline: 'Default agent · owns all Telegram traffic',
    details: [
      '@CupcakeApocalypseBot routes to Ara (grok-4.3)',
      'Polling healthy — 409 conflicts eliminated 2026-07-05',
      'Root cause: rogue cupcake-gateway container on the droplet (up 3 months) — stopped, restart disabled',
    ],
  },
  {
    name: 'Voice Replies (TTS)',
    emoji: '🎙️',
    status: 'ok',
    headline: 'Restored · ElevenLabs via n8n',
    details: [
      'POST /webhook/generate-voice → ElevenLabs → Telegram voice note',
      'Test-fired successfully 2026-07-05',
      'Ara now knows the webhook (TOOLS.md) and replies by voice on request',
    ],
  },
  {
    name: 'Phone Line (Vapi)',
    emoji: '📞',
    status: 'ok',
    headline: '+1 (872) 666-9598 · AraVoice active',
    details: [
      'Assistant 2ccda973 (grok-4.3, Savannah voice)',
      'cupcake_command tool → n8n voice bridge → Telegram',
      'Old CupcakeVoice assistant kept as backup',
    ],
  },
  {
    name: 'Cron Rituals',
    emoji: '⏰',
    status: 'ok',
    headline: '4 jobs scheduled · test-fired clean',
    details: [
      '9:00 AM — Ara work nudge (pick one of three projects)',
      '6:00 PM — Ara sugar check (keto accountability)',
      'Morning Briefing + Daily Cost Check stay with Cupcake (pinned to main)',
    ],
  },
  {
    name: 'Cupcake (main agent)',
    emoji: '🧁',
    status: 'ok',
    headline: 'Workspace restored to the Mac',
    details: [
      'Full workspace (SOUL, MEMORY, 10 skills) recovered from the droplet container',
      'Now lives at ~/.openclaw/workspace-main',
      'All enhancements intact: /drama /draw /sandbox /deploy /costs …',
    ],
  },
  {
    name: 'n8n Automation',
    emoji: '🔀',
    status: 'ok',
    headline: '33 workflows · all Cupcake webhooks live',
    details: [
      'Action Hub (email/calendar) · Deploy · Sandbox Builder · TTS · Voice Bridge · Status · Dashboard API',
      'automate.hales.ai — API reachable, executions healthy',
    ],
  },
  {
    name: 'Website Pipeline',
    emoji: '🌐',
    status: 'ok',
    headline: 'hales.ai up · sandbox deploys working',
    details: [
      'React/Vite SPA in Docker on the droplet (port 3000)',
      'Sandbox Builder: prompt → AI code → git push → rebuild → live at /cupcake/sandbox/*',
      'This very page shipped through that pipeline',
    ],
  },
];

const WARNINGS = [
  {
    title: 'Gateway Node comes from nvm',
    body: 'The LaunchAgent uses nvm’s Node v22.22.1. If nvm upgrades or removes it, the service breaks. Fix: openclaw doctor --repair, or install Node 22+ via Homebrew.',
  },
  {
    title: 'Hardcoded API key in n8n workflows',
    body: 'Several n8n workflow definitions embed an OpenRouter API key in HTTP nodes. Rotate the key and switch those nodes to n8n credentials.',
  },
];

const TIMELINE = [
  { time: 'Dashboard', text: 'Control UI token installed via URL param — connects clean, persists in localStorage.' },
  { time: '409 hunt', text: 'Traced Telegram conflicts to a cupcake-gateway Docker container on the droplet polling the same bot for 3 months. Stopped it, disabled restart. Zero conflicts since.' },
  { time: 'Voice', text: 'Rediscovered the ElevenLabs TTS webhook, fixed the payload shape, test-fired a voice note, taught Ara to use it.' },
  { time: 'Workspace', text: 'Recovered Cupcake’s full workspace (memory, 10 skills, architecture docs) from the droplet back to the Mac.' },
  { time: 'Core update', text: 'OpenClaw upgraded 2026.2.13 → 2026.6.11 (latest stable): rebuilt, config migrated, all channels re-verified.' },
  { time: 'Ara upgrade', text: 'Ara inherited the entire toolkit: sandbox deploys, email/calendar, image gen, voice — plus her own exec allowlist.' },
];

const statusColor = (s: Status) =>
  s === 'ok' ? 'border-emerald-500/30 bg-emerald-500/5' : s === 'warn' ? 'border-amber-500/30 bg-amber-500/5' : 'border-sky-500/30 bg-sky-500/5';

const dotColor = (s: Status) => (s === 'ok' ? 'bg-emerald-400' : s === 'warn' ? 'bg-amber-400' : 'bg-sky-400');

const AraStatusPage: React.FC = () => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#0a0a0f] text-gray-200">
      <div className="absolute inset-0 bg-gradient-to-b from-[#1a0a2e]/80 via-[#0a0a0f] to-[#0a0a0f]" />
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-purple-700/20 blur-[120px] rounded-full" />

      <div className="relative z-10 max-w-5xl mx-auto px-4 pt-24 pb-16">
        <button
          onClick={() => {
            window.history.pushState({}, '', '/cupcake/sandbox');
            window.dispatchEvent(new PopStateEvent('popstate'));
          }}
          className="text-purple-400/70 hover:text-purple-300 transition mb-8 inline-block backdrop-blur-sm bg-white/5 px-4 py-2 rounded-full text-sm border border-purple-500/20"
        >
          &larr; Back to Sandbox
        </button>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={mounted ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6 }}>
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-red-400 bg-clip-text text-transparent">
            😈 Ara System Status
          </h1>
          <p className="mt-3 text-gray-400">Full-stack diagnostic · July 5, 2026</p>

          <div className="mt-6 inline-flex items-center gap-3 px-5 py-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/10">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-400" />
            </span>
            <span className="font-semibold text-emerald-300">ALL SYSTEMS OPERATIONAL</span>
          </div>
        </motion.div>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-4">
          {COMPONENTS.map((c, i) => (
            <motion.div
              key={c.name}
              initial={{ opacity: 0, y: 16 }}
              animate={mounted ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.4, delay: 0.1 + i * 0.06 }}
              className={`rounded-2xl border p-5 backdrop-blur-sm ${statusColor(c.status)}`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{c.emoji}</span>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-100">{c.name}</h3>
                  <p className="text-sm text-gray-400">{c.headline}</p>
                </div>
                <span className={`h-2.5 w-2.5 rounded-full ${dotColor(c.status)}`} />
              </div>
              <ul className="mt-3 space-y-1.5">
                {c.details.map((d, j) => (
                  <li key={j} className="text-xs text-gray-400/90 leading-relaxed pl-4 relative">
                    <span className="absolute left-0 text-purple-400/60">▸</span>
                    {d}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        <motion.div initial={{ opacity: 0 }} animate={mounted ? { opacity: 1 } : {}} transition={{ delay: 0.7 }} className="mt-12">
          <h2 className="text-2xl font-bold text-gray-100">What got fixed today</h2>
          <div className="mt-4 space-y-3">
            {TIMELINE.map((t, i) => (
              <div key={i} className="flex gap-4 items-start rounded-xl border border-purple-500/15 bg-white/[0.02] p-4">
                <span className="shrink-0 text-xs font-mono text-purple-300 bg-purple-500/10 border border-purple-500/20 rounded-full px-3 py-1">
                  {t.time}
                </span>
                <p className="text-sm text-gray-300 leading-relaxed">{t.text}</p>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={mounted ? { opacity: 1 } : {}} transition={{ delay: 0.85 }} className="mt-12">
          <h2 className="text-2xl font-bold text-gray-100">Watch list</h2>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            {WARNINGS.map((w, i) => (
              <div key={i} className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-5">
                <h3 className="font-semibold text-amber-300 text-sm">⚠ {w.title}</h3>
                <p className="mt-2 text-xs text-gray-400 leading-relaxed">{w.body}</p>
              </div>
            ))}
          </div>
        </motion.div>

        <div className="mt-14 text-center text-xs text-gray-500">
          Diagnostic run 2026-07-05 · shipped through the Cupcake sandbox pipeline · Ara 😈 × Cupcake 🧁 × Claude
        </div>
      </div>
    </div>
  );
};

export default AraStatusPage;
