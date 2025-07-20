import { useEffect, useRef, useState, useCallback } from 'react';

const SocialFeeds = () => {
  const twitterRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasError, setHasError] = useState<boolean>(false);
  const [retryCount, setRetryCount] = useState<number>(0);
  const maxRetries = 3;

  const initTwitterWidget = useCallback(() => {
    if ((window as any).twttr && twitterRef.current) {
      try {
        // Clear any existing widgets first
        twitterRef.current.innerHTML = `
          <a
            class="twitter-timeline"
            data-theme="dark"
            data-chrome="transparent nofooter noheader noborders"
            href="https://twitter.com/hales_ai"
            data-tweet-limit="3"
            data-height="400"
            data-width="100%"
            data-border-color="#00e6e6"
            data-link-color="#00ccff"
          >
            Loading tweets...
          </a>
        `;
        
        (window as any).twttr.widgets.load(twitterRef.current).then(() => {
          setIsLoading(false);
          setHasError(false);
        }).catch((error: any) => {
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
  }, []);

  const loadTwitterScript = useCallback(() => {
    return new Promise<void>((resolve, reject) => {
      // Check if script already exists
      const existingScript = document.querySelector('script[src="https://platform.twitter.com/widgets.js"]');
      if (existingScript) {
        existingScript.remove();
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

  const retryLoad = useCallback(() => {
    if (retryCount < maxRetries) {
      setRetryCount((prev: number) => prev + 1);
      setIsLoading(true);
      setHasError(false);
      
      loadTwitterScript()
        .then(() => {
          initTwitterWidget();
        })
        .catch((error: any) => {
          console.error('Failed to load Twitter script:', error);
          setHasError(true);
          setIsLoading(false);
        });
    }
  }, [retryCount, maxRetries, loadTwitterScript, initTwitterWidget]);

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
      // Don't remove the script on cleanup as it might be used by other components
      // Just clear the widget content
      if (twitterRef.current) {
        twitterRef.current.innerHTML = '';
      }
    };
  }, [loadTwitterScript, initTwitterWidget]);

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
              Latest Videos
            </h3>
            <div className="w-full h-[400px] overflow-y-auto rounded-lg bg-black/20 relative scrollbar-thin scrollbar-thumb-[#00e6e6]/30 scrollbar-track-transparent">
              <div className="space-y-4 p-2">
                {[
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
                    className="group relative bg-gradient-to-br from-[#0a1a2b]/60 to-[#0a0f16]/60 rounded-lg overflow-hidden border border-[#00e6e6]/20 hover:border-[#00e6e6]/60 transition-all duration-300 cursor-pointer"
                    onClick={() => window.open(`https://www.youtube.com/watch?v=${video.id}`, '_blank')}
                  >
                    <div className="relative">
                      <img
                        src={video.thumbnail}
                        alt={video.title}
                        className="w-full h-24 object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          // Fallback to a default thumbnail if the image fails to load
                          (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${video.id}/hqdefault.jpg`;
                        }}
                      />
                      <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors duration-300"></div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                          <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z"/>
                          </svg>
                        </div>
                      </div>
                    </div>
                    <div className="p-3">
                      <h4 className="text-sm font-medium text-[#00e6e6] group-hover:text-[#00ccff] transition-colors duration-300 line-clamp-2">
                        {video.title}
                      </h4>
                      <p className="text-xs text-[#00e6e6]/60 mt-1">
                        Video {index + 1} of 5
                      </p>
                    </div>
                    <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-[#00e6e6]/0 via-[#00e6e6]/5 to-[#00ccff]/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Twitter/X Section */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-[#0a1a2b]/50 to-[#0a0f16]/50 border border-[#00e6e6]/10 transform transition-all duration-500 hover:scale-105 backdrop-blur-sm">
            <h3 className="text-xl font-semibold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-[#00e6e6] via-[#00ccff] via-[#4d4dff] to-[#1a1aff] animate-gradient">
              Latest Updates
            </h3>
            <div className="w-full h-[400px] overflow-hidden rounded-lg bg-black/20 relative">
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex flex-col items-center space-y-4">
                    <div className="w-8 h-8 border-2 border-[#00e6e6] border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-[#00e6e6]/70 text-sm">Loading tweets...</p>
                  </div>
                </div>
              )}
              
              {hasError && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex flex-col items-center space-y-4 text-center p-4">
                    <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                      <span className="text-red-400 text-xl">⚠️</span>
                    </div>
                    <div>
                      <p className="text-red-400 text-sm mb-2">Failed to load tweets</p>
                      {retryCount < maxRetries && (
                        <button
                          onClick={retryLoad}
                          className="px-4 py-2 bg-[#00e6e6]/20 hover:bg-[#00e6e6]/30 text-[#00e6e6] rounded-lg text-sm transition-colors"
                        >
                          Retry ({retryCount + 1}/{maxRetries})
                        </button>
                      )}
                      {retryCount >= maxRetries && (
                        <a
                          href="https://twitter.com/hales_ai"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-2 bg-[#00e6e6]/20 hover:bg-[#00e6e6]/30 text-[#00e6e6] rounded-lg text-sm transition-colors inline-block"
                        >
                          View on Twitter
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={twitterRef} className={`w-full h-full ${isLoading || hasError ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}>
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
      </div>
    </section>
  );
};

export default SocialFeeds;
