'use client';

import { useEffect } from 'react';
import Script from 'next/script';

const SocialFeeds = () => {
  useEffect(() => {
    // Initialize Twitter widget
    const initTwitterWidget = () => {
      if ((window as any).twttr) {
        (window as any).twttr.widgets.load();
      }
    };

    // Load Twitter widget script
    const script = document.createElement('script');
    script.src = 'https://platform.twitter.com/widgets.js';
    script.async = true;
    document.body.appendChild(script);
    script.onload = initTwitterWidget;

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return (
    <section className="social-feeds-section">
      <div className="container mx-auto px-4 py-16 bg-black/30 backdrop-blur-sm">
        <h2 className="gradient-text text-2xl md:text-3xl text-center mb-12">Latest Updates</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {/* YouTube Section */}
          <div className="w-full bg-black/50 rounded-lg overflow-hidden">
            <h3 className="gradient-text text-xl p-4 text-center">Latest Video</h3>
            <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
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
          <div className="w-full bg-black/50 rounded-lg overflow-hidden">
            <h3 className="gradient-text text-xl p-4 text-center">Latest Updates</h3>
            <div className="w-full h-[400px] overflow-hidden">
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