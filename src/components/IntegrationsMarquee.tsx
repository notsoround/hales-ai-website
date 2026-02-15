import React, { useEffect, useRef } from 'react';

interface IntegrationsMarqueeProps {
  className?: string;
}

// Professional integrations with real service names
const topRowLogos = [
  { name: 'Veo 3', category: 'AI Video' },
  { name: 'Google Cloud', category: 'Cloud Platform' },
  { name: 'Microsoft Azure', category: 'Cloud Services' },
  { name: 'Eleven Labs', category: 'AI Voice' },
  { name: 'Cline', category: 'AI Assistant' },
  { name: 'Cursor', category: 'AI IDE' },
  { name: 'OpenAI', category: 'AI Platform' },
  { name: 'Claude', category: 'AI Assistant' },
  { name: 'Hugging Face', category: 'AI Models' },
  { name: 'Replicate', category: 'AI APIs' },
  { name: 'Anthropic', category: 'AI Research' },
  { name: 'Cohere', category: 'AI Language' }
];

const bottomRowLogos = [
  { name: 'DeepSeek', category: 'AI Models' },
  { name: 'Twilio', category: 'Communications' },
  { name: 'Digital Ocean', category: 'Cloud Hosting' },
  { name: 'Pinecone', category: 'Vector DB' },
  { name: 'Open Source', category: 'Community' },
  { name: 'Make.com', category: 'Automation' },
  { name: 'Zapier', category: 'Workflows' },
  { name: 'GitHub', category: 'Development' },
  { name: 'Vercel', category: 'Deployment' },
  { name: 'Netlify', category: 'Hosting' },
  { name: 'Slack', category: 'Team Chat' },
  { name: 'Stripe', category: 'Payments' }
];

export function IntegrationsMarquee({ className = '' }: IntegrationsMarqueeProps) {
  const topRowRef = useRef<HTMLDivElement>(null);
  const bottomRowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Simple CSS animation approach - more reliable
    if (topRowRef.current) {
      topRowRef.current.style.animation = 'scrollRight 40s linear infinite';
    }

    if (bottomRowRef.current) {
      bottomRowRef.current.style.animation = 'scrollLeft 40s linear infinite';
    }
  }, []);

  return (
    <div className="py-24 relative">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Left side - Marquee */}
          {/* Left side - Marquee */}
          <div className={`overflow-hidden ${className}`}>
            <div className="py-8">
              <h2 className="text-4xl font-bold text-center mb-4 bg-clip-text text-transparent bg-gradient-to-r from-primary via-white to-secondary animate-gradient">
                INTEGRATIONS
              </h2>
              <h3 className="text-5xl font-bold text-center mb-16 bg-clip-text text-transparent bg-gradient-to-r from-primary via-white to-secondary animate-gradient">
                Integrate with over 40+ apps instantly.
              </h3>

              {/* Top row - moving right to left */}
              <div className="relative overflow-hidden mb-8">
                <div
                  ref={topRowRef}
                  className="flex items-center whitespace-nowrap"
                >
                  {/* Double the logos to create seamless loop */}
                  {[...topRowLogos, ...topRowLogos].map((logo, index) => (
                    <div
                      key={`top-${index}`}
                      className="flex-shrink-0 mx-6 group cursor-pointer"
                      title={`${logo.name} - ${logo.category}`}
                    >
                      <div className="relative w-32 h-24 bg-gradient-to-br from-surface/60 to-background/60 rounded-xl p-3 border border-primary/20 hover:border-primary/60 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-primary/20 backdrop-blur-sm">
                        {/* Content */}
                        <div className="h-full flex flex-col justify-between">
                          {/* Service name */}
                          <div className="text-center">
                            <h4 className="text-sm font-semibold text-white group-hover:text-primary transition-colors leading-tight">
                              {logo.name}
                            </h4>
                          </div>

                          {/* Category badge */}
                          <div className="text-center">
                            <span className="inline-block px-2 py-1 text-xs bg-primary/10 text-primary rounded-full border border-primary/20">
                              {logo.category}
                            </span>
                          </div>
                        </div>

                        {/* Hover glow effect */}
                        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary/0 via-primary/5 to-secondary/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom row - moving left to right */}
              <div className="relative overflow-hidden">
                <div
                  ref={bottomRowRef}
                  className="flex items-center whitespace-nowrap"
                >
                  {/* Double the logos to create seamless loop */}
                  {[...bottomRowLogos, ...bottomRowLogos].map((logo, index) => (
                    <div
                      key={`bottom-${index}`}
                      className="flex-shrink-0 mx-6 group cursor-pointer"
                      title={`${logo.name} - ${logo.category}`}
                    >
                      <div className="relative w-32 h-24 bg-gradient-to-br from-surface/60 to-background/60 rounded-xl p-3 border border-primary/20 hover:border-primary/60 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-primary/20 backdrop-blur-sm">
                        {/* Content */}
                        <div className="h-full flex flex-col justify-between">
                          {/* Service name */}
                          <div className="text-center">
                            <h4 className="text-sm font-semibold text-white group-hover:text-primary transition-colors leading-tight">
                              {logo.name}
                            </h4>
                          </div>

                          {/* Category badge */}
                          <div className="text-center">
                            <span className="inline-block px-2 py-1 text-xs bg-primary/10 text-primary rounded-full border border-primary/20">
                              {logo.category}
                            </span>
                          </div>
                        </div>

                        {/* Hover glow effect */}
                        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary/0 via-primary/5 to-secondary/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right side - Hexagon Grid */}
          <div className="flex items-center justify-center">
            <div className="relative w-full max-w-md aspect-square">
              {/* Hexagon grid pattern */}
              <svg
                viewBox="0 0 500 500"
                className="w-full h-full opacity-30"
              >
                <defs>
                  <pattern
                    id="hexagons"
                    width="50"
                    height="43.4"
                    patternUnits="userSpaceOnUse"
                    patternTransform="scale(2) rotate(0)"
                  >
                    <path
                      d="M25,0 L50,14.3 L50,37.7 L25,52 L0,37.7 L0,14.3 Z"
                      fill="none"
                      stroke="#00e6e6"
                      strokeWidth="1"
                    />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#hexagons)" />

                {/* Colored dots */}
                <circle cx="100" cy="100" r="5" fill="#00e6e6" className="animate-pulse-slow" />
                <circle cx="200" cy="150" r="5" fill="#00ccff" className="animate-pulse-slow" />
                <circle cx="300" cy="200" r="5" fill="#4d4dff" className="animate-pulse-slow" />
                <circle cx="150" cy="250" r="5" fill="#1a1aff" className="animate-pulse-slow" />
                <circle cx="250" cy="300" r="5" fill="#00e6e6" className="animate-pulse-slow" />
                <circle cx="350" cy="350" r="5" fill="#00ccff" className="animate-pulse-slow" />
                <circle cx="400" cy="150" r="5" fill="#4d4dff" className="animate-pulse-slow" />
                <circle cx="100" cy="350" r="5" fill="#1a1aff" className="animate-pulse-slow" />
              </svg>

              {/* Glowing orbs */}
              <div className="absolute top-1/4 left-1/4 w-8 h-8 bg-[#00e6e6] rounded-full filter blur-md opacity-50 animate-pulse-slow"></div>
              <div className="absolute top-2/3 left-1/2 w-6 h-6 bg-[#00ccff] rounded-full filter blur-md opacity-40 animate-pulse-slow delay-700"></div>
              <div className="absolute top-1/2 left-3/4 w-10 h-10 bg-[#4d4dff] rounded-full filter blur-md opacity-30 animate-pulse-slow delay-500"></div>
              <div className="absolute top-3/4 left-1/3 w-12 h-12 bg-[#1a1aff] rounded-full filter blur-md opacity-20 animate-pulse-slow delay-300"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
