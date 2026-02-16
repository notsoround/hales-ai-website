import { useEffect, useState, lazy, Suspense } from 'react';
import type { ComponentType } from 'react';
import {
  Headphones,
  MessageSquareMore,
  Network,
  Settings,
} from 'lucide-react';
import { Navbar } from './components/Navbar';
import { Hero3D } from './components/Hero3D';
import { BentoGrid } from './components/BentoGrid';
import { ProjectShowcase } from './components/ProjectShowcase';
import { GetStarted } from './components/GetStarted';
import { LearnMore } from './components/LearnMore';
import { ChatInterface } from './components/ChatInterface';
import { VoiceButton } from './components/VoiceButton';
import { IntegrationsMarquee } from './components/IntegrationsMarquee';
import SocialFeeds from './components/SocialFeeds';
import DotCursor from './components/DotCursor';
import { Footer } from './components/Footer';

// Lazy load the pages
const AboutUs = lazy(() => import('./pages/about-us/page'));
const ContactUs = lazy(() => import('./pages/contact-us/page'));
const EliteOps = lazy(() => import('./pages/elite-ops/page'));
const CupcakeTest = lazy(() => import("./pages/cupcake-test/page"));
const CupcakeDashboard = lazy(() => import("./pages/cupcake/page"));
const SandboxIndex = lazy(() => import("./pages/cupcake/sandbox/page"));

// Auto-discover sandbox pages at build time (Cupcake creates these via n8n sandbox builder)
const sandboxModules = import.meta.glob<{ default: ComponentType }>(
  './pages/cupcake/sandbox/*/page.tsx'
);

// Filter out _template from sandbox modules
const activeSandboxModules = Object.fromEntries(
  Object.entries(sandboxModules).filter(([path]) => !path.includes('_template'))
);

type PageKey =
  | 'home'
  | 'get-started'
  | 'learn-more'
  | 'matts-tasklist'
  | 'quantum-code'
  | 'about-us'
  | 'contact-us'
  | 'elite-ops'
  | 'cupcake-test'
  | 'cupcake'
  | 'cupcake-sandbox'
  | `cupcake-sandbox-${string}`;

function pathnameToPage(pathname: string): PageKey {
  const clean = pathname.replace(/\/+$/, '') || '/';
  const routes: Record<string, PageKey> = {
    '/': 'home',
    '/get-started': 'get-started',
    '/learn-more': 'learn-more',
    '/about-us': 'about-us',
    '/contact-us': 'contact-us',
    '/elite-ops': 'elite-ops',
    '/cupcake': 'cupcake',
    '/cupcake-test': 'cupcake-test',
    '/cupcake/sandbox': 'cupcake-sandbox',
  };
  if (routes[clean]) return routes[clean];

  // Sandbox sub-pages: /cupcake/sandbox/<slug>
  const sandboxMatch = clean.match(/^\/cupcake\/sandbox\/([a-z0-9-]+)$/);
  if (sandboxMatch) return `cupcake-sandbox-${sandboxMatch[1]}`;

  return 'home';
}

function pageToPathname(page: PageKey): string {
  if (page === 'home') return '/';
  if (page === 'cupcake-sandbox') return '/cupcake/sandbox';
  if (page.startsWith('cupcake-sandbox-')) {
    return `/cupcake/sandbox/${page.replace('cupcake-sandbox-', '')}`;
  }
  return `/${page}`;
}

function App() {
  const [currentPage, setCurrentPageState] = useState<PageKey>(() => pathnameToPage(window.location.pathname));
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [SandboxComponent, setSandboxComponent] = useState<ComponentType | null>(null);

  // Navigate with URL update (so direct links like /cupcake/sandbox/... work)
  const setCurrentPage = (page: PageKey) => {
    window.history.pushState({ page }, '', pageToPathname(page));
    setCurrentPageState(page);
  };

  // Handle browser back/forward
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPageState(pathnameToPage(window.location.pathname));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Load dynamic sandbox page component when needed
  useEffect(() => {
    if (currentPage.startsWith('cupcake-sandbox-')) {
      const slug = currentPage.replace('cupcake-sandbox-', '');
      const modulePath = `./pages/cupcake/sandbox/${slug}/page.tsx`;
      const loader = (activeSandboxModules as Record<string, () => Promise<{ default: ComponentType }>>)[modulePath];
      if (loader) {
        loader().then((mod) => setSandboxComponent(() => mod.default));
      } else {
        setSandboxComponent(null);
      }
    } else {
      setSandboxComponent(null);
    }
  }, [currentPage]);

  const handleMessageSent = (message: string) => {
    console.log('User message:', message);
  };

  const handleMessageReceived = (message: string) => {
    console.log('Assistant response:', message);
  };

  const handleVoiceStart = () => {
    console.log('Voice recording started');
  };

  const handleVoiceStop = () => {
    console.log('Voice recording stopped');
  };

  const handleVoiceMessage = (message: string) => {
    console.log('Voice message received:', message);
  };

  const renderPage = () => {
    if (currentPage.startsWith('cupcake-sandbox-')) {
      if (SandboxComponent) return <SandboxComponent />;
      return (
        <div className="min-h-screen bg-[#020410] text-white flex items-center justify-center px-6">
          <div className="max-w-xl text-center space-y-4">
            <div className="text-2xl font-semibold text-pink-300">Sandbox page not found</div>
            <div className="text-white/70">
              This sandbox slug is not deployed yet. Go back to the sandbox index to see what exists.
            </div>
            <button
              onClick={() => setCurrentPage('cupcake-sandbox')}
              className="px-5 py-3 rounded-full bg-white/10 hover:bg-white/15 border border-white/10"
            >
              Back to Sandbox Index
            </button>
          </div>
        </div>
      );
    }

    switch (currentPage) {
      case 'get-started':
        return <GetStarted onNavigate={setCurrentPage} />;
      case 'learn-more':
        return <LearnMore />;
      case 'about-us':
        return (
          <Suspense fallback={<div className="text-center p-4">Loading About Us...</div>}>
            <AboutUs />
          </Suspense>
        );
      case 'contact-us':
        return (
          <Suspense fallback={<div className="text-center p-4">Loading Contact Us...</div>}>
            <ContactUs />
          </Suspense>
        );
      case 'elite-ops':
        return (
          <Suspense fallback={<div className="text-center p-4">Loading Elite Ops...</div>}>
            <EliteOps />
          </Suspense>
        );
      case "cupcake-test":
        return (
          <Suspense fallback={<div className="text-center p-4">Loading...</div>}>
            <CupcakeTest />
          </Suspense>
        );
      case "cupcake":
        return (
          <Suspense fallback={<div className="text-center p-4 text-pink-400">Loading Cupcake...</div>}>
            <CupcakeDashboard />
          </Suspense>
        );
      case "cupcake-sandbox":
        return (
          <Suspense fallback={<div className="text-center p-4 text-pink-400">Loading Sandbox...</div>}>
            <SandboxIndex />
          </Suspense>
        );
      default:
        return (
          <div className="min-h-screen bg-[#020410] text-white relative font-sans selection:bg-primary/20 selection:text-primary">
            <Navbar onNavigate={setCurrentPage} currentPage={currentPage} />

            {/* Hero & Main Content */}
            <div className="relative">
              <Hero3D />
              <div className="pt-[120px] relative z-10">
                {/* Hero Section */}
                <div className="relative min-h-[90vh] flex items-center justify-center px-4 overflow-hidden">
                  <div className="text-center max-w-5xl mx-auto space-y-8">
                    <div className="relative inline-block group">
                      <h1 className="text-7xl md:text-8xl lg:text-9xl font-bold font-display tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-primary to-secondary animate-gradient-slow pb-4">
                        Hales AI
                      </h1>
                      <div className="absolute -inset-1 bg-gradient-to-r from-primary to-secondary blur-3xl opacity-20 group-hover:opacity-100 transition-opacity duration-500 rounded-full" />
                    </div>


                    <p className="text-xl md:text-2xl text-gray-400 max-w-3xl mx-auto leading-relaxed font-light">
                      Transforming businesses with <span className="text-white font-medium">advanced AI telephony</span>,
                      <span className="text-white font-medium"> workflow automation</span>, and
                      <span className="text-white font-medium"> digital cloning</span> technology.
                    </p>

                    {/* Buttons */}
                    <div className="flex flex-col sm:flex-row gap-6 justify-center items-center mt-12">
                      <button
                        onClick={() => setCurrentPage('get-started')}
                        className="group relative px-8 py-4 bg-white text-black rounded-full font-bold text-lg hover:scale-105 transition-transform duration-300"
                      >
                        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-primary to-secondary blur opacity-50 group-hover:opacity-100 transition-opacity" />
                        <span className="relative flex items-center gap-2">
                          Get Started <span className="group-hover:translate-x-1 transition-transform">→</span>
                        </span>
                      </button>
                      <button
                        onClick={() => setCurrentPage('learn-more')}
                        className="px-8 py-4 rounded-full border border-white/20 hover:bg-white/5 hover:border-white/40 transition-all duration-300 font-medium text-lg backdrop-blur-sm"
                      >
                        Learn More
                      </button>
                    </div>

                    {/* Voice Interaction */}
                    <div className="mt-16 relative">
                      <div className="glass-panel inline-flex flex-col items-center p-8 rounded-3xl hover:scale-105 transition-transform duration-500">
                        <VoiceButton
                          onStart={handleVoiceStart}
                          onStop={handleVoiceStop}
                          onMessage={handleVoiceMessage}
                          className="shadow-[0_0_50px_rgba(0,240,255,0.3)]"
                        />
                        <p className="mt-4 text-sm text-primary/60 font-medium tracking-wide">
                          TAP TO SPEAK
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Scroll Indicator */}
                <div className="absolute bottom-10 left-1/2 -translate-x-1/2 text-white/30 animate-bounce">
                  <div className="w-1 h-12 rounded-full bg-gradient-to-b from-primary/0 via-primary to-primary/0" />
                </div>
              </div>

              <div id="our-solutions" className="max-w-7xl mx-auto px-4 py-32 relative z-10">
                <h2 className="text-5xl md:text-6xl font-bold font-display text-center mb-20 bg-clip-text text-transparent bg-gradient-to-r from-white via-primary to-secondary animate-gradient">
                  Our Solutions
                </h2>
                <BentoGrid onNavigate={setCurrentPage} />
              </div>

            </div>

            {/* Project Showcase */}
            <ProjectShowcase />

            {/* Features Section - Why Choose Us */}
            <div className="bg-gradient-to-b from-[#0a1a2b] to-[#0a0f16] py-24 relative z-10">
              <div className="max-w-7xl mx-auto px-4">
                <h2 className="text-4xl font-bold text-center mb-16 bg-clip-text text-transparent bg-gradient-to-r from-primary via-white to-secondary animate-gradient">
                  Why Choose Us
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                  {[
                    {
                      icon: <Network className="w-6 h-6" />,
                      title: 'Advanced AI',
                      description: 'Cutting-edge artificial intelligence technology',
                    },
                    {
                      icon: <Settings className="w-6 h-6" />,
                      title: 'Automation',
                      description: 'Streamlined workflow automation solutions',
                    },
                    {
                      icon: <Headphones className="w-6 h-6" />,
                      title: '24/7 Support',
                      description: 'Round-the-clock technical assistance',
                    },
                    {
                      icon: <MessageSquareMore className="w-6 h-6" />,
                      title: 'Custom Integration',
                      description: 'Seamless integration with existing systems',
                    },
                  ].map((feature, index) => (
                    <div key={index} className="text-center p-6 glass-panel rounded-2xl hover:scale-105 transition-transform duration-300">
                      <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center text-primary animate-pulse-slow">
                        {feature.icon}
                      </div>
                      <h3 className="text-lg font-semibold mb-2 text-white">
                        {feature.title}
                      </h3>
                      <p className="text-gray-400">
                        {feature.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Integrations Section */}
            <div className="bg-gradient-to-b from-[#0a0f16] to-[#0a1a2b] py-24 relative z-10">
              <IntegrationsMarquee />
            </div>

            {/* Social Feeds Section */}
            <div className="relative z-10">
              <SocialFeeds />
            </div>

            {/* Footer */}
            <Footer />

            {/* Chat Interface */}
            <ChatInterface
              isOpen={isChatOpen}
              onClose={() => setIsChatOpen(false)}
              onMessageSent={handleMessageSent}
              onMessageReceived={handleMessageReceived}
            />
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#020410] text-white relative">
      <DotCursor />
      {renderPage()}
    </div>
  );
}

export default App;
