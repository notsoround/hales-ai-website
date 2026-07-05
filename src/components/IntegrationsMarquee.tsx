import { useEffect, useRef } from 'react';

interface IntegrationsMarqueeProps {
  className?: string;
}

interface Integration {
  name: string;
  category: string;
  logo?: string; // path under /Integrations_images/
}

// Row 1 — AI stack
const topRowLogos: Integration[] = [
  { name: 'OpenAI', category: 'AI Platform', logo: '/Integrations_images/openai.webp' },
  { name: 'Claude', category: 'AI Assistant' },
  { name: 'Gemini', category: 'AI Models', logo: '/Integrations_images/gemini.webp' },
  { name: 'ElevenLabs', category: 'AI Voice', logo: '/Integrations_images/elevenlabs.webp' },
  { name: 'Vapi', category: 'AI Telephony' },
  { name: 'Grok', category: 'AI Models' },
  { name: 'DeepSeek', category: 'AI Models' },
  { name: 'OpenRouter', category: 'AI Gateway' },
  { name: 'Hugging Face', category: 'AI Models' },
  { name: 'Cursor', category: 'AI IDE' },
];

// Row 2 — infrastructure & tools
const bottomRowLogos: Integration[] = [
  { name: 'Google Cloud', category: 'Cloud', logo: '/Integrations_images/google-cloud.webp' },
  { name: 'Microsoft Azure', category: 'Cloud', logo: '/Integrations_images/azure.webp' },
  { name: 'Twilio', category: 'Communications', logo: '/Integrations_images/twilio.webp' },
  { name: 'Slack', category: 'Team Chat', logo: '/Integrations_images/slack.webp' },
  { name: 'HubSpot', category: 'CRM', logo: '/Integrations_images/hubspot.webp' },
  { name: 'Google Calendar', category: 'Scheduling', logo: '/Integrations_images/google-calendar.webp' },
  { name: 'Google Sheets', category: 'Data', logo: '/Integrations_images/google-sheets.webp' },
  { name: 'n8n', category: 'Automation' },
  { name: 'Make.com', category: 'Automation' },
  { name: 'Zapier', category: 'Workflows' },
  { name: 'DigitalOcean', category: 'Hosting' },
  { name: 'Stripe', category: 'Payments' },
];

function LogoCard({ item, keyPrefix, index }: { item: Integration; keyPrefix: string; index: number }) {
  return (
    <div
      key={`${keyPrefix}-${index}`}
      className="flex-shrink-0 mx-4 group cursor-default"
      title={`${item.name} — ${item.category}`}
    >
      <div className="relative flex items-center gap-3 px-5 py-3 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-primary/50 hover:bg-white/[0.06] transition-all duration-300 hover:scale-[1.04] hover:shadow-lg hover:shadow-primary/10 backdrop-blur-sm">
        {item.logo ? (
          <img
            src={item.logo}
            alt={`${item.name} logo`}
            loading="lazy"
            className="w-8 h-8 object-contain opacity-80 group-hover:opacity-100 transition-opacity"
          />
        ) : (
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 border border-white/10 flex items-center justify-center text-xs font-bold text-primary">
            {item.name.slice(0, 2)}
          </div>
        )}
        <div className="leading-tight whitespace-nowrap">
          <div className="text-sm font-semibold text-white group-hover:text-primary transition-colors">{item.name}</div>
          <div className="text-[11px] text-gray-500">{item.category}</div>
        </div>
      </div>
    </div>
  );
}

export function IntegrationsMarquee({ className = '' }: IntegrationsMarqueeProps) {
  const topRowRef = useRef<HTMLDivElement>(null);
  const bottomRowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (topRowRef.current) {
      topRowRef.current.style.animation = 'scrollRight 45s linear infinite';
    }
    if (bottomRowRef.current) {
      bottomRowRef.current.style.animation = 'scrollLeft 40s linear infinite';
    }
  }, []);

  return (
    <div className={`overflow-hidden ${className}`}>
      <div className="max-w-7xl mx-auto px-4">
        <div className="py-8">
          <p className="text-center text-sm font-semibold tracking-[0.3em] text-primary/70 mb-3">INTEGRATIONS</p>
          <h3 className="text-4xl md:text-5xl font-bold text-center mb-14 bg-clip-text text-transparent bg-gradient-to-r from-white via-primary to-secondary animate-gradient">
            Plays nice with your whole stack.
          </h3>

          {/* Top row — scrolls right */}
          <div className="relative overflow-hidden mb-6 [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
            <div ref={topRowRef} className="flex items-center whitespace-nowrap w-max">
              {[...topRowLogos, ...topRowLogos].map((item, index) => (
                <LogoCard item={item} keyPrefix="top" index={index} key={`top-${index}`} />
              ))}
            </div>
          </div>

          {/* Bottom row — scrolls left */}
          <div className="relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
            <div ref={bottomRowRef} className="flex items-center whitespace-nowrap w-max">
              {[...bottomRowLogos, ...bottomRowLogos].map((item, index) => (
                <LogoCard item={item} keyPrefix="bottom" index={index} key={`bottom-${index}`} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
