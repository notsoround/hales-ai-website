import { useEffect, useRef, useState, useCallback } from 'react';
import Vision2026Modal from './Vision2026Modal';

const SocialFeeds = () => {
  const twitterRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasError, setHasError] = useState<boolean>(false);

  const [isModalOpen, setIsModalOpen] = useState(false);

  const initTwitterWidget = useCallback(() => {
    if ((window as any).twttr && twitterRef.current) {
      try {
        // Clear any existing widgets first
        twitterRef.current.innerHTML = '';

        // Create the anchor element programmatically to ensure it's fresh
        const anchor = document.createElement('a');
        anchor.className = 'twitter-timeline';
        anchor.setAttribute('data-theme', 'dark');
        anchor.setAttribute('data-chrome', 'transparent nofooter noheader noborders');
        anchor.setAttribute('href', 'https://twitter.com/hales_ai');
        anchor.setAttribute('data-tweet-limit', '3');
        anchor.setAttribute('data-height', '400');
        anchor.setAttribute('data-width', '100%');
        anchor.textContent = 'Loading tweets...';
        twitterRef.current.appendChild(anchor);

        // Set a timeout to handle cases where the widget hangs
        const timeoutId = setTimeout(() => {
          if (isLoading) {
            console.warn('Twitter widget load timed out');
            setHasError(true);
            setIsLoading(false);
          }
        }, 5000);

        (window as any).twttr.widgets.load(twitterRef.current).then(() => {
          clearTimeout(timeoutId);
          setIsLoading(false);
          setHasError(false);
        }).catch((error: any) => {
          clearTimeout(timeoutId);
          console.error('Twitter widget load error:', error);
          setHasError(true);
          setIsLoading(false);
        });
      } catch (error) {
        console.error('Twitter widget initialization error:', error);
        setHasError(true);
        setIsLoading(false);
      }
    }
  }, [isLoading]);

  const loadTwitterScript = useCallback(() => {
    return new Promise<void>((resolve, reject) => {
      // Check if script already exists
      if (document.querySelector('script[src="https://platform.twitter.com/widgets.js"]')) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://platform.twitter.com/widgets.js';
      script.async = true;
      script.charset = 'utf-8';
      script.crossOrigin = 'anonymous';

      script.onload = () => {
        // Wait a bit for the script to fully initialize
        setTimeout(() => {
          resolve();
        }, 100);
      };

      script.onerror = () => {
        reject(new Error('Failed to load Twitter widgets script'));
      };

      document.head.appendChild(script);
    });
  }, []);



  useEffect(() => {
    const loadWidget = async () => {
      try {
        if (!(window as any).twttr) {
          await loadTwitterScript();
        }
        initTwitterWidget();
      } catch (error) {
        console.error('Error loading Twitter widget:', error);
        setHasError(true);
        setIsLoading(false);
      }
    };

    loadWidget();

    // Cleanup function
    return () => {
      if (twitterRef.current) {
        twitterRef.current.innerHTML = '';
      }
    };
  }, [loadTwitterScript, initTwitterWidget]);

  return (
    <>
      <section className="relative py-24 bg-background">
        <div className="absolute inset-0 bg-gradient-to-b from-background to-black opacity-80"></div>
        <div className="relative z-10 max-w-7xl mx-auto px-4">
          <h2 className="text-4xl font-bold text-center mb-16 font-display bg-clip-text text-transparent bg-gradient-to-r from-primary via-white to-secondary animate-gradient">
            Latest Updates
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* YouTube Section */}
            <div className="p-6 rounded-2xl glass-panel transform transition-all duration-500 hover:scale-[1.02] backdrop-blur-sm border border-white/5 hover:border-primary/20">
              <h3 className="text-xl font-semibold mb-6 font-display bg-clip-text text-transparent bg-gradient-to-r from-primary via-white to-secondary animate-gradient">
                Latest Videos
              </h3>
              <div className="w-full h-[400px] overflow-y-auto rounded-lg bg-black/20 relative scrollbar-thin scrollbar-thumb-primary/30 scrollbar-track-transparent pr-2">
                <div className="space-y-4 p-2">
                  {[
                    {
                      id: 'featured-vision',
                      title: 'The Future of Hales AI: Vision 2026',
                      thumbnail: '/video-thumb.png',
                      isLocal: true,
                      link: '#' // Placeholder link
                    },
                    {
                      id: 'lWcjYqV9XX4',
                      title: 'Hales AI Video 1',
                      thumbnail: 'https://img.youtube.com/vi/lWcjYqV9XX4/maxresdefault.jpg'
                    },
                    {
                      id: 'Wv47Skbap-E',
                      title: 'Hales AI Video 2',
                      thumbnail: 'https://img.youtube.com/vi/Wv47Skbap-E/maxresdefault.jpg'
                    },
                    {
                      id: 'BD6Yxu9qZkY',
                      title: 'Hales AI Video 3',
                      thumbnail: 'https://img.youtube.com/vi/BD6Yxu9qZkY/maxresdefault.jpg'
                    },
                    {
                      id: 'MQENFbZpPoU',
                      title: 'Hales AI Video 4',
                      thumbnail: 'https://img.youtube.com/vi/MQENFbZpPoU/maxresdefault.jpg'
                    },
                    {
                      id: 'USX-Qw4KvWE',
                      title: 'Hales AI Video 5',
                      thumbnail: 'https://img.youtube.com/vi/USX-Qw4KvWE/maxresdefault.jpg'
                    }
                  ].map((video, index) => (
                    <div
                      key={video.id}
                      className="group relative bg-surface/30 rounded-lg overflow-hidden border border-white/5 hover:border-primary/40 transition-all duration-300 cursor-pointer"
                      onClick={() => {
                        if (video.isLocal) {
                          setIsModalOpen(true);
                        } else {
                          window.open(`https://www.youtube.com/watch?v=${video.id}`, '_blank');
                        }
                      }}
                    >
                      <div className="relative">
                        <img
                          src={video.thumbnail}
                          alt={video.title}
                          className="w-full h-24 object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={(e) => {
                            if (!video.isLocal) {
                              (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${video.id}/hqdefault.jpg`;
                            }
                          }}
                        />
                        <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors duration-300"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg">
                            <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          </div>
                        </div>
                        {video.isLocal && (
                          <div className="absolute top-2 left-2 px-2 py-0.5 bg-primary/80 backdrop-blur-sm rounded text-[10px] font-bold text-white tracking-wider">
                            FEATURED
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <h4 className="text-sm font-medium text-white group-hover:text-primary transition-colors duration-300 line-clamp-2">
                          {video.title}
                        </h4>
                        <p className="text-xs text-gray-400 mt-1">
                          {video.isLocal ? 'Coming Soon' : `Video ${index} of 5`}
                        </p>
                      </div>
                      <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary/0 via-primary/5 to-secondary/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Twitter/X Section */}
            <div className="p-6 rounded-2xl glass-panel transform transition-all duration-500 hover:scale-[1.02] backdrop-blur-sm border border-white/5 hover:border-primary/20">
              <h3 className="text-xl font-semibold mb-6 font-display bg-clip-text text-transparent bg-gradient-to-r from-primary via-white to-secondary animate-gradient">
                Latest Updates
              </h3>
              <div className="w-full h-[400px] overflow-hidden rounded-lg bg-black/20 relative">
                {/* Fallback Link (Always visible if empty or error) */}
                {(isLoading || hasError) && (
                  <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/40">
                    <div className="flex flex-col items-center space-y-4 text-center p-4">
                      {isLoading ? (
                        <>
                          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                          <p className="text-primary/70 text-sm">Loading tweets...</p>
                        </>
                      ) : (
                        <>
                          <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                            <span className="text-red-400 text-xl">⚠️</span>
                          </div>
                          <p className="text-red-400 text-sm mb-2 font-medium">Connection Refused by X</p>
                          <p className="text-gray-400 text-xs mb-4">Rate limit reached or access restricted</p>
                          <a
                            href="https://twitter.com/hales_ai"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-6 py-2 bg-primary hover:bg-primary/80 text-white rounded-full text-sm transition-all shadow-lg hover:shadow-primary/25 font-medium"
                          >
                            Open Feed in X
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                )}

                <div ref={twitterRef} className={`w-full h-full ${hasError ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300 bg-black/20`}></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Vision2026Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
};

export default SocialFeeds;
