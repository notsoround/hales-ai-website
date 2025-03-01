import { useEffect, useRef } from 'react';

const SocialFeeds = () => {
  const twitterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initialize Twitter widget
    const initTwitterWidget = () => {
      if ((window as any).twttr && twitterRef.current) {
        (window as any).twttr.widgets.load(twitterRef.current);
      }
    };

    // Load Twitter widget script
    if (!(window as any).twttr) {
      const script = document.createElement('script');
      script.src = 'https://platform.twitter.com/widgets.js';
      script.async = true;
      script.charset = 'utf-8';
      document.head.appendChild(script);
      script.onload = initTwitterWidget;
    } else {
      initTwitterWidget();
    }

    return () => {
      const script = document.querySelector('script[src="https://platform.twitter.com/widgets.js"]');
      if (script) {
        document.head.removeChild(script);
      }
    };
  }, []);

  return (
    <section className="relative py-24 bg-[#0a1a2b]">
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a1a2b] to-[#0a0f16] opacity-80"></div>
      <div className="relative z-10 max-w-7xl mx-auto px-4">
        <h2 className="text-4xl font-bold text-center mb-16 bg-clip-text text-transparent bg-gradient-to-r from-[#00e6e6] via-[#00ccff] via-[#4d4dff] to-[#1a1aff] animate-gradient">
          Latest Updates
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* YouTube Section */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-[#0a1a2b]/50 to-[#0a0f16]/50 border border-[#00e6e6]/10 transform transition-all duration-500 hover:scale-105 backdrop-blur-sm">
            <h3 className="text-xl font-semibold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-[#00e6e6] via-[#00ccff] via-[#4d4dff] to-[#1a1aff] animate-gradient">
              Latest Video
            </h3>
            <div className="relative w-full rounded-lg overflow-hidden" style={{ paddingBottom: '56.25%' }}>
              <iframe
                className="absolute top-0 left-0 w-full h-full"
                src="https://www.youtube.com/embed/USX-Qw4KvWE"
                title="Latest Hales AI Video"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
          
          {/* Twitter/X Section */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-[#0a1a2b]/50 to-[#0a0f16]/50 border border-[#00e6e6]/10 transform transition-all duration-500 hover:scale-105 backdrop-blur-sm">
            <h3 className="text-xl font-semibold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-[#00e6e6] via-[#00ccff] via-[#4d4dff] to-[#1a1aff] animate-gradient">
              Latest Updates
            </h3>
            <div ref={twitterRef} className="w-full h-[400px] overflow-hidden rounded-lg bg-black/20">
              <a
                className="twitter-timeline"
                data-theme="dark"
                data-chrome="transparent nofooter noheader"
                href="https://twitter.com/hales_ai"
                data-tweet-limit="3"
                data-height="400"
              >
                Loading tweets...
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default SocialFeeds;