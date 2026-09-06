import { useEffect, useState, lazy, Suspense } from 'react';
import type { ComponentType } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { GetStarted } from './components/GetStarted';
import { LearnMore } from './components/LearnMore';
import { ChatInterface } from './components/ChatInterface';
import HalesExperience from './components/experience/HalesExperience';

// Lazy load the pages
const AboutUs = lazy(() => import('./pages/about-us/page'));
const ContactUs = lazy(() => import('./pages/contact-us/page'));
const EliteOps = lazy(() => import('./pages/elite-ops/page'));
const CupcakeDashboard = lazy(() => import("./pages/cupcake/sandbox/cupcakegpt/page"));
const SandboxIndex = lazy(() => import("./pages/cupcake/sandbox/page"));

// Auto-discover sandbox pages at build time (Cupcake creates these via n8n sandbox builder)
const sandboxModules = import.meta.glob<{ default: ComponentType }>(
  './pages/cupcake/sandbox/*/page.tsx'
);

// Filter out _template from sandbox modules
const activeSandboxModules = Object.fromEntries(
  Object.entries(sandboxModules).filter(([path]) => !path.includes('_template'))
);

const sandboxPages = Object.fromEntries(
  Object.entries(activeSandboxModules).map(([path, loader]) => [path, lazy(loader)])
);

type PageKey =
  | 'home'
  | 'get-started'
  | 'learn-more'
  | 'about-us'
  | 'contact-us'
  | 'elite-ops'
  | 'cupcake'
  | 'cupcake-sandbox'
  | `cupcake-sandbox-${string}`
  | 'not-found';

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
    '/cupcake/sandbox': 'cupcake-sandbox',
  };
  if (routes[clean]) return routes[clean];

  // Sandbox sub-pages: /cupcake/sandbox/<slug>
  const sandboxMatch = clean.match(/^\/cupcake\/sandbox\/([a-z0-9-]+)$/);
  if (sandboxMatch) return `cupcake-sandbox-${sandboxMatch[1]}`;

  return clean === '/' ? 'home' : 'not-found';
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

  const handleMessageSent = (message: string) => {
    void message;
  };

  const handleMessageReceived = (message: string) => {
    void message;
  };

  const renderPage = () => {
    if (currentPage.startsWith('cupcake-sandbox-')) {
      const slug = currentPage.replace('cupcake-sandbox-', '');
      const SandboxComponent = sandboxPages[`./pages/cupcake/sandbox/${slug}/page.tsx`];
      if (SandboxComponent) return <Suspense fallback={<div className="p-12 text-center text-gray-300">Loading your app…</div>}><SandboxComponent /></Suspense>;
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
      case 'not-found':
        return (
          <div className="min-h-screen bg-[#020410] text-white flex items-center justify-center px-6">
            <div className="max-w-xl text-center space-y-6">
              <div className="text-8xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">404</div>
              <p className="text-xl text-gray-400">That page doesn&apos;t exist — but our AI probably could build it.</p>
              <button
                onClick={() => setCurrentPage('home')}
                className="px-8 py-4 bg-white text-black rounded-full font-bold hover:scale-105 transition-transform"
              >
                Back to Hales AI
              </button>
            </div>
          </div>
        );
      default:
        return (
          <div>
            <HalesExperience openChat={() => setIsChatOpen(true)} />

            {/* Chat Interface + floating launcher */}
            <ChatInterface
              isOpen={isChatOpen}
              onClose={() => setIsChatOpen(false)}
              onMessageSent={handleMessageSent}
              onMessageReceived={handleMessageReceived}
            />
            <button
              onClick={() => setIsChatOpen((v) => !v)}
              aria-label={isChatOpen ? 'Close chat' : 'Chat with Hales AI'}
              className="fixed bottom-6 right-4 sm:right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-primary to-secondary text-black flex items-center justify-center shadow-[0_0_30px_rgba(0,240,255,0.4)] hover:scale-110 transition-transform"
            >
              {isChatOpen ? <X size={24} /> : <MessageCircle size={24} />}
            </button>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#020410] text-white relative">
      {renderPage()}
    </div>
  );
}

export default App;
