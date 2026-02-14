import React, { useEffect, useRef } from 'react';

interface IntegrationsMarqueeProps {
  className?: string;
}

// Custom logos for integrations using local images from the Integrations_images folder
const topRowLogos = [
  { name: 'Integration 1', logo: '/Integrations_images/image.webp' },
  { name: 'Integration 2', logo: '/Integrations_images/image%20(1).webp' },
  { name: 'Integration 3', logo: '/Integrations_images/image%20(2).webp' },
  { name: 'Integration 4', logo: '/Integrations_images/image%20(3).webp' },
  { name: 'Integration 5', logo: '/Integrations_images/image%20(4).webp' },
  { name: 'Integration 6', logo: '/Integrations_images/image%20(5).webp' },
  { name: 'Integration 7', logo: '/Integrations_images/image%20(6).webp' },
  { name: 'Integration 8', logo: '/Integrations_images/image%20(7).webp' }
];

const bottomRowLogos = [
  { name: 'Integration 9', logo: '/Integrations_images/image%20(8).webp' },
  { name: 'Integration 10', logo: '/Integrations_images/image%20(9).webp' },
  { name: 'Integration 11', logo: '/Integrations_images/image%20(10).webp' },
  { name: 'Integration 12', logo: '/Integrations_images/image%20(11).webp' },
  { name: 'Integration 13', logo: '/Integrations_images/image%20(12).webp' },
  { name: 'Integration 14', logo: '/Integrations_images/image%20(13).webp' },
  { name: 'Integration 15', logo: '/Integrations_images/image%20(14).webp' },
  { name: 'Integration 16', logo: '/Integrations_images/image%20(15).webp' }
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
      const speed = 1.0; // pixels per frame - increased for better visibility
      
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
      const speed = 1.0; // pixels per frame - increased for better visibility
      
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
                      className="flex items-center justify-center mx-8 h-20 w-20 bg-[#0a1a2b]/30 rounded-lg p-2 border border-[#00e6e6]/10 hover:border-[#00e6e6]/40 transition-all hover:scale-110 duration-300"
                      title={logo.name}
                    >
                      {/* Simple colored background with text */}
                      <div
                        className="w-full h-full bg-[#00e6e6]/20 rounded-md flex items-center justify-center"
                        style={{
                          backgroundImage: `url(${logo.logo})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          backgroundRepeat: 'no-repeat'
                        }}
                      >
                        <div className="bg-[#0a1a2b]/70 text-[#00e6e6] text-xs p-1 rounded absolute bottom-0 left-0 right-0 text-center">
                          {logo.name}
                        </div>
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
                      className="flex items-center justify-center mx-8 h-20 w-20 bg-[#0a1a2b]/30 rounded-lg p-2 border border-[#00e6e6]/10 hover:border-[#00e6e6]/40 transition-all hover:scale-110 duration-300"
                      title={logo.name}
                    >
                      {/* Simple colored background with text */}
                      <div
                        className="w-full h-full bg-[#00e6e6]/20 rounded-md flex items-center justify-center"
                        style={{
                          backgroundImage: `url(${logo.logo})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          backgroundRepeat: 'no-repeat'
                        }}
                      >
                        <div className="bg-[#0a1a2b]/70 text-[#00e6e6] text-xs p-1 rounded absolute bottom-0 left-0 right-0 text-center">
                          {logo.name}
                        </div>
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