import React, { useEffect, useRef } from 'react';

interface IntegrationsMarqueeProps {
  className?: string;
}

// Placeholder logos for integrations
const topRowLogos = [
  { name: 'OpenAI', logo: 'https://cdn.worldvectorlogo.com/logos/openai-2.svg' },
  { name: 'Anthropic', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/Anthropic_logo.svg/1200px-Anthropic_logo.svg.png' },
  { name: '11 Labs', logo: 'https://assets-global.website-files.com/646218c67da47160c64a84d5/6462e1e8e7e7d1d7d0b0b47c_11ElevenLabs-logo-circle.png' },
  { name: 'Deepgram', logo: 'https://cdn.worldvectorlogo.com/logos/deepgram.svg' },
  { name: 'Assembly AI', logo: 'https://cdn.worldvectorlogo.com/logos/assemblyai.svg' },
  { name: 'PlayHT', logo: 'https://play.ht/favicon/favicon-32x32.png' },
  { name: 'Azure', logo: 'https://cdn.worldvectorlogo.com/logos/azure-1.svg' },
  { name: 'Gemini', logo: 'https://seeklogo.com/images/G/google-gemini-logo-A5680F3396-seeklogo.com.png' },
  { name: 'Groq', logo: 'https://cdn.worldvectorlogo.com/logos/groq.svg' },
  { name: 'Perplexity', logo: 'https://cdn.worldvectorlogo.com/logos/perplexity-ai.svg' },
  { name: 'Gladia', logo: 'https://cdn.worldvectorlogo.com/logos/gladia.svg' },
  { name: 'Langfuse', logo: 'https://cdn.worldvectorlogo.com/logos/langfuse.svg' },
  { name: 'Twilio', logo: 'https://cdn.worldvectorlogo.com/logos/twilio-2.svg' }
];

const bottomRowLogos = [
  { name: 'AWS S3', logo: 'https://cdn.worldvectorlogo.com/logos/aws-s3.svg' },
  { name: 'GCP Cloud', logo: 'https://cdn.worldvectorlogo.com/logos/google-cloud-1.svg' },
  { name: 'Google Calendar', logo: 'https://cdn.worldvectorlogo.com/logos/google-calendar-2020-2.svg' },
  { name: 'Zendesk', logo: 'https://cdn.worldvectorlogo.com/logos/zendesk-1.svg' },
  { name: 'Notion', logo: 'https://cdn.worldvectorlogo.com/logos/notion-2.svg' },
  { name: 'Zapier', logo: 'https://cdn.worldvectorlogo.com/logos/zapier-1.svg' },
  { name: 'Apollo.io', logo: 'https://cdn.worldvectorlogo.com/logos/apollo-graphql-compact.svg' },
  { name: 'Google Sheets', logo: 'https://cdn.worldvectorlogo.com/logos/google-sheets-full-logo-1.svg' },
  { name: 'Salesforce', logo: 'https://cdn.worldvectorlogo.com/logos/salesforce-2.svg' },
  { name: 'Hubspot', logo: 'https://cdn.worldvectorlogo.com/logos/hubspot-1.svg' },
  { name: 'Five9', logo: 'https://cdn.worldvectorlogo.com/logos/five9.svg' },
  { name: 'Make', logo: 'https://cdn.worldvectorlogo.com/logos/make-2.svg' },
  { name: 'Slack', logo: 'https://cdn.worldvectorlogo.com/logos/slack-new-logo.svg' }
];

export function IntegrationsMarquee({ className = '' }: IntegrationsMarqueeProps) {
  const topRowRef = useRef<HTMLDivElement>(null);
  const bottomRowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Animation for top row (right to left)
    const animateTopRow = () => {
      if (!topRowRef.current) return;
      
      const scrollWidth = topRowRef.current.scrollWidth;
      const viewportWidth = topRowRef.current.offsetWidth;
      
      if (scrollWidth <= viewportWidth) return;
      
      let currentPosition = 0;
      const speed = 0.5; // pixels per frame
      
      const scroll = () => {
        if (!topRowRef.current) return;
        
        currentPosition -= speed;
        
        // Reset position when we've scrolled the full width of the content
        if (Math.abs(currentPosition) >= scrollWidth / 2) {
          currentPosition = 0;
        }
        
        topRowRef.current.style.transform = `translateX(${currentPosition}px)`;
        requestAnimationFrame(scroll);
      };
      
      requestAnimationFrame(scroll);
    };
    
    // Animation for bottom row (left to right)
    const animateBottomRow = () => {
      if (!bottomRowRef.current) return;
      
      const scrollWidth = bottomRowRef.current.scrollWidth;
      const viewportWidth = bottomRowRef.current.offsetWidth;
      
      if (scrollWidth <= viewportWidth) return;
      
      let currentPosition = 0;
      const speed = 0.5; // pixels per frame
      
      const scroll = () => {
        if (!bottomRowRef.current) return;
        
        currentPosition += speed;
        
        // Reset position when we've scrolled the full width of the content
        if (currentPosition >= scrollWidth / 2) {
          currentPosition = 0;
        }
        
        bottomRowRef.current.style.transform = `translateX(${currentPosition}px)`;
        requestAnimationFrame(scroll);
      };
      
      requestAnimationFrame(scroll);
    };
    
    animateTopRow();
    animateBottomRow();
  }, []);

  return (
    <div className="py-24 relative">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Left side - Marquee */}
          <div className={`overflow-hidden ${className}`}>
            <div className="py-8">
              <h2 className="text-4xl font-bold text-center mb-4 bg-clip-text text-transparent bg-gradient-to-r from-[#00e6e6] via-[#00ccff] via-[#4d4dff] to-[#1a1aff] animate-gradient">
                INTEGRATIONS
              </h2>
              <h3 className="text-5xl font-bold text-center mb-16 bg-clip-text text-transparent bg-gradient-to-r from-[#00e6e6] via-[#00ccff] via-[#4d4dff] to-[#1a1aff] animate-gradient">
                Integrate with more than 40+ apps in a snap.
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
                      className="flex items-center justify-center mx-8 h-16 w-16 bg-[#0a1a2b]/50 rounded-lg p-2"
                      title={logo.name}
                    >
                      <img 
                        src={logo.logo} 
                        alt={logo.name} 
                        className="max-h-full max-w-full object-contain filter brightness-0 invert opacity-70 hover:opacity-100 transition-opacity"
                      />
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
                      className="flex items-center justify-center mx-8 h-16 w-16 bg-[#0a1a2b]/50 rounded-lg p-2"
                      title={logo.name}
                    >
                      <img 
                        src={logo.logo} 
                        alt={logo.name} 
                        className="max-h-full max-w-full object-contain filter brightness-0 invert opacity-70 hover:opacity-100 transition-opacity"
                      />
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