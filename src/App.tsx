import React, { useEffect, useRef, useState, lazy, Suspense } from 'react';
import {
  Bot,
  Calendar,
  Code2,
  FileCode2,
  Globe,
  Headphones,
  MessageSquareMore,
  Mic2,
  Network,
  Phone,
  Settings,
  Workflow,
} from 'lucide-react';
import HamburgerMenu from './components/HamburgerMenu';
import { GridBackground } from './components/GridBackground';
import AbstractBall from './components/AbstractBall';
import { ProjectShowcase } from './components/ProjectShowcase';
import { GetStarted } from './components/GetStarted';
import { LearnMore } from './components/LearnMore';
import { ChatInterface } from './components/ChatInterface';
import { VoiceButton } from './components/VoiceButton';
import { IntegrationsMarquee } from './components/IntegrationsMarquee';
import SocialFeeds from './components/SocialFeeds';

// Lazy load the pages
const MattsTasklist = lazy(() => import('./pages/matts-tasklist/page'));
const QuantumCode = lazy(() => import('./pages/Hales-Ai_Quantum_Code/page'));
const AboutUs = lazy(() => import('./pages/about-us/page'));
const ContactUs = lazy(() => import('./pages/contact-us/page'));
const EliteOps = lazy(() => import('./pages/elite-ops/page'));

  function App() {
  const [currentPage, setCurrentPage] = useState<'home' | 'get-started' | 'learn-more' | 'matts-tasklist' | 'quantum-code' | 'about-us' | 'contact-us' | 'elite-ops'>('home');
  const [isIntersecting, setIsIntersecting] = useState<Record<string, boolean>>({});
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isGlobResponding, setIsGlobResponding] = useState(false);
  const observerRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const id = entry.target.getAttribute('data-id');
          if (id) {
            setIsIntersecting((prev) => ({
              ...prev,
              [id]: entry.isIntersecting,
            }));
          }
        });
      },
      {
        threshold: 0.2,
        rootMargin: '50px',
      }
    );

    observerRefs.current.forEach((element) => {
      observer.observe(element);
    });

    return () => observer.disconnect();
  }, []);

  const setRef = (id: string) => (element: HTMLDivElement | null) => {
    if (element) {
      element.setAttribute('data-id', id);
      observerRefs.current.set(id, element);
    } else {
      observerRefs.current.delete(id);
    }
  };

  const handleGlobInteractionStart = () => {
    if (!isChatOpen) {
      setIsChatOpen(true);
    }
  };

  const handleGlobInteractionEnd = () => {
    // Optional: Add any behavior when interaction ends
  };

  const handleMessageSent = (message: string) => {
    console.log('User message:', message);
    setIsGlobResponding(true);
    setTimeout(() => {
      setIsGlobResponding(false);
    }, 3000);
  };

  const handleMessageReceived = (message: string) => {
    console.log('Assistant response:', message);
  };

  const handleVoiceStart = () => {
    console.log('Voice recording started');
    setIsGlobResponding(true);
  };

  const handleVoiceStop = () => {
    console.log('Voice recording stopped');
  };

  const handleVoiceMessage = (message: string) => {
    console.log('Voice message received:', message);
    setIsGlobResponding(false);
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'get-started':
        return <GetStarted />;
      case 'learn-more':
        return <LearnMore />;
      case 'matts-tasklist':
        return (
          <Suspense fallback={<div className="text-center p-4">Loading Task List...</div>}>
            <MattsTasklist />
          </Suspense>
        );
      case 'quantum-code':
        return (
          <Suspense fallback={<div className="text-center p-4">Loading Quantum Code...</div>}>
            <QuantumCode />
          </Suspense>
        );
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
      default:
        return (
          <div className="relative">
            {/* Announcement Bar */}
            <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-[#00e6e6]/10 to-[#1a1aff]/10 py-2">
              <div className="max-w-7xl mx-auto px-4">
                <p className="text-center text-sm bg-clip-text text-transparent bg-gradient-to-r from-[#00e6e6] to-[#1a1aff] animate-gradient">
                  🎉 Welcome to the next generation of AI technology
                </p>
              </div>
            </div>

            {/* Navigation Bar */}
            <nav className="fixed top-[40px] left-0 right-0 z-50 bg-[#0a1a2b]/80 backdrop-blur-md border-b border-[#00e6e6]/20 shadow-lg">
              <div className="max-w-7xl mx-auto px-4 flex justify-between items-center h-16">
                <div className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#00e6e6] to-[#1a1aff] animate-gradient">
                  Hales AI
                </div>
                <div className="flex items-center">
                  <div className="hidden md:flex space-x-6 mr-6">
                    {['About Us', 'Contact Us', 'Elite Ops'].map((item) => (
                      <button
                        key={item}
                        onClick={() => setCurrentPage(item.toLowerCase().replace(' ', '-') as any)}
                        className="text-[#00e6e6] hover:text-[#00ccff] transition"
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                  <HamburgerMenu onNavigate={setCurrentPage} currentPage={currentPage} />
                </div>
              </div>
            </nav>

            {/* Main Content */}
            <div className="pt-[100px]">
              {/* Hero Section */}
              <div className="relative min-h-[85vh] max-h-screen flex items-start justify-center overflow-hidden">
                <div className="absolute w-[600px] h-[600px] bg-gradient-to-r from-[#00e6e6] via-[#00ccff] to-[#1a1aff] rounded-full filter blur-[128px] opacity-15 animate-pulse-slow"></div>
                <div className="absolute w-[500px] h-[500px] bg-gradient-to-r from-[#00e6e6] via-[#00ccff] to-[#1a1aff] rounded-full filter blur-[128px] opacity-15 animate-pulse-slow delay-700"></div>

                {/* Decorative Grid Lines */}
                <div className="absolute inset-0 grid grid-cols-6 gap-4 pointer-events-none">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-full border-l border-[#00e6e6]/5"></div>
                  ))}
                </div>

                <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
                  <div className="space-y-8 mt-10">
                    <div className="relative inline-block">
                      <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#00e6e6] via-[#00ccff] via-[#4d4dff] to-[#1a1aff] animate-gradient">
                        Hales AI
                      </h1>
                      <div className="absolute -top-4 -right-4 w-8 h-8 bg-gradient-to-r from-[#00e6e6] to-[#1a1aff] rounded-full opacity-20 animate-ping"></div>
                    </div>
                    
                    <div className="flex justify-center">
                      <p className="text-base font-semibold text-[#00e6e6] animate-pulse bg-[#0a1a2b]/50 py-2 px-4 rounded-full inline-block border border-[#00e6e6]/30">🚧 Under Construction 🚧</p>
                    </div>
                    
                    <div className="relative">
                      <div className="absolute -left-8 top-1/2 w-4 h-20 bg-gradient-to-b from-[#00e6e6]/0 via-[#00e6e6]/20 to-[#00e6e6]/0"></div>
                      <p className="text-lg md:text-xl lg:text-2xl mb-8 max-w-3xl mx-auto leading-relaxed bg-clip-text text-transparent bg-gradient-to-r from-[#00e6e6] via-[#00ccff] via-[#4d4dff] to-[#1a1aff] animate-gradient-slow">
                        Transforming businesses with advanced AI telephony, workflow automation, and digital
                        cloning technology
                      </p>
                    </div>
                    
                    {/* Get Started and Learn More buttons */}
                    <div className="flex gap-6 justify-center flex-wrap relative mt-8">
                      <button
                        onClick={() => setCurrentPage('get-started')}
                        className="group relative px-8 py-3 bg-gradient-to-r from-[#00e6e6] via-[#00ccff] via-[#4d4dff] to-[#1a1aff] rounded-full font-semibold hover:opacity-90 transition-all duration-300 animate-gradient transform hover:scale-105"
                      >
                        <span className="relative z-10">Get Started</span>
                        <div className="absolute inset-0 rounded-full bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      </button>
                      <button
                        onClick={() => setCurrentPage('learn-more')}
                        className="group relative px-8 py-3 border border-[#00e6e6]/20 rounded-full font-semibold bg-gradient-to-r from-[#00e6e6]/10 via-[#00ccff]/10 via-[#4d4dff]/10 to-[#1a1aff]/10 hover:from-[#00e6e6]/20 hover:via-[#00ccff]/20 hover:via-[#4d4dff]/20 hover:to-[#1a1aff]/20 transition-all duration-300 animate-gradient transform hover:scale-105"
                      >
                        <span className="relative z-10">Learn More</span>
                        <div className="absolute inset-0 rounded-full bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      </button>
                    </div>
                    
                    {/* Voice Button */}
                    <div className="relative mt-8 flex flex-col items-center">
                      <div className="absolute inset-0 bg-gradient-to-r from-[#00e6e6]/5 via-transparent to-[#1a1aff]/5 rounded-full blur-3xl"></div>
                      <div className="relative">
                        <div className="absolute -inset-4 bg-gradient-to-r from-[#00e6e6]/10 to-[#1a1aff]/10 rounded-full blur-md"></div>
                        <div className="relative z-10 transform hover:scale-105 transition-transform duration-300">
                          <VoiceButton
                            onStart={handleVoiceStart}
                            onStop={handleVoiceStop}
                            onMessage={handleVoiceMessage}
                            className="mx-auto shadow-lg shadow-[#00e6e6]/10"
                          />
                        </div>
                      </div>
                      <p className="mt-4 text-sm text-[#00e6e6]/70 animate-pulse">
                        Click to speak with AI
                      </p>
                    </div>
                    
                    {/* Down Arrow - Fixed position at bottom */}
                    <div className="w-full text-center mt-8 mb-4">
                      <a href="#our-solutions" className="inline-block">
                        <div className="animate-bounce">
                          <div className="w-8 h-8 mx-auto border-2 border-[#00e6e6] rounded-full flex items-center justify-center text-[#00e6e6]">
                            ↓
                          </div>
                        </div>
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              {/* Services Grid */}
              <div id="our-solutions" className="max-w-7xl mx-auto px-4 pt-16 pb-24 relative" style={{ marginTop: '40px' }}>
                <h2 className="text-4xl font-bold text-center mb-16 bg-clip-text text-transparent bg-gradient-to-r from-[#00e6e6] via-[#00ccff] via-[#4d4dff] to-[#1a1aff] animate-gradient">
                  Our Solutions
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {[
                    {
                      icon: <Phone className="w-8 h-8" />,
                      title: 'AI Telephony',
                      description:
                        'Advanced conversational AI powered by vapi.ai and retell.ai for natural phone interactions',
                      ref: 'telephony',
                    },
                    {
                      icon: <Mic2 className="w-8 h-8" />,
                      title: 'Voice Cloning',
                      description:
                        'Create perfect digital replicas of voices for personalized AI interactions',
                      ref: 'cloning',
                    },
                    {
                      icon: <Workflow className="w-8 h-8" />,
                      title: 'Workflow Automation',
                      description: 'Streamline processes with n8n and make.com integrations',
                      ref: 'workflow',
                    },
                    {
                      icon: <Calendar className="w-8 h-8" />,
                      title: 'Smart Scheduling',
                      description:
                        'Seamless appointment booking with Cal.com and Calendly integration',
                      ref: 'scheduling',
                    },
                    {
                      icon: <Globe className="w-8 h-8" />,
                      title: 'Web Development',
                      description: 'Custom AI-powered websites and web applications',
                      ref: 'web',
                    },
                    {
                      icon: <Bot className="w-8 h-8" />,
                      title: 'Custom AI Solutions',
                      description:
                        'Tailored artificial intelligence solutions for your specific needs',
                      ref: 'custom',
                    },
                  ].map((service, index) => (
                    <div
                      key={index}
                      ref={setRef(service.ref)}
                      className={`p-6 rounded-2xl bg-gradient-to-br from-[#0a1a2b]/50 to-[#0a0f16]/50 border border-[#00e6e6]/10 transform transition-all duration-500 hover:scale-105 backdrop-blur-sm ${
                        isIntersecting[service.ref]
                          ? 'opacity-100 translate-y-0'
                          : 'opacity-0 translate-y-10'
                      }`}
                    >
                      <div className="mb-4 text-[#00e6e6] animate-gradient">
                        {service.icon}
                      </div>
                      <h3 className="text-xl font-semibold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-[#00e6e6] via-[#00ccff] via-[#4d4dff] to-[#1a1aff] animate-gradient">
                        {service.title}
                      </h3>
                      <p className="bg-clip-text text-transparent bg-gradient-to-r from-[#00e6e6] via-[#00ccff] via-[#4d4dff] to-[#1a1aff] animate-gradient-slow">
                        {service.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Project Showcase */}
              <ProjectShowcase />

              {/* Features Section */}
              <div className="bg-gradient-to-b from-[#0a1a2b] to-[#0a0f16] py-24 mt-8">
                <div className="max-w-7xl mx-auto px-4">
                  <h2 className="text-4xl font-bold text-center mb-16 bg-clip-text text-transparent bg-gradient-to-r from-[#00e6e6] via-[#00ccff] via-[#4d4dff] to-[#1a1aff] animate-gradient">
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
                      <div key={index} className="text-center p-6">
                        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-gradient-to-r from-[#00e6e6]/10 via-[#00ccff]/10 via-[#4d4dff]/10 to-[#1a1aff]/10 flex items-center justify-center text-[#00e6e6] animate-gradient">
                          {feature.icon}
                        </div>
                        <h3 className="text-lg font-semibold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-[#00e6e6] via-[#00ccff] via-[#4d4dff] to-[#1a1aff] animate-gradient">
                          {feature.title}
                        </h3>
                        <p className="bg-clip-text text-transparent bg-gradient-to-r from-[#00e6e6] via-[#00ccff] via-[#4d4dff] to-[#1a1aff] animate-gradient-slow">
                          {feature.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Tech Stack */}
              <div className="py-24 px-4 mt-8">
                <div className="max-w-7xl mx-auto">
                  <h2 className="text-4xl font-bold text-center mb-16 bg-clip-text text-transparent bg-gradient-to-r from-[#00e6e6] via-[#00ccff] via-[#4d4dff] to-[#1a1aff] animate-gradient">
                    Our Tech Stack
                  </h2>
                  <div className="flex flex-wrap justify-center gap-8">
                    {[
                      { name: 'vapi.ai', icon: <Code2 className="w-6 h-6" /> },
                      { name: 'retell.ai', icon: <Mic2 className="w-6 h-6" /> },
                      { name: 'n8n', icon: <Workflow className="w-6 h-6" /> },
                      { name: 'make.com', icon: <Settings className="w-6 h-6" /> },
                      { name: 'cal.com', icon: <Calendar className="w-6 h-6" /> },
                      { name: 'VSCode', icon: <FileCode2 className="w-6 h-6" /> },
                    ].map((tech, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-[#00e6e6]/10 via-[#00ccff]/10 via-[#4d4dff]/10 to-[#1a1aff]/10 hover:from-[#00e6e6]/20 hover:via-[#00ccff]/20 hover:via-[#4d4dff]/20 hover:to-[#1a1aff]/20 animate-gradient"
                      >
                        <span className="text-[#00e6e6]">{tech.icon}</span>
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#00e6e6] via-[#00ccff] via-[#4d4dff] to-[#1a1aff] animate-gradient">
                          {tech.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Integrations Section */}
              <div className="bg-gradient-to-b from-[#0a0f16] to-[#0a1a2b] py-12">
                <IntegrationsMarquee />
              </div>

              {/* Social Feeds Section */}
              <div className="relative">
                <SocialFeeds />
              </div>

              {/* Footer */}
              <footer className="border-t border-[#00e6e6]/20 py-12">
                <div className="max-w-7xl mx-auto px-4 text-center">
                  <p className="bg-clip-text text-transparent bg-gradient-to-r from-[#00e6e6] via-[#00ccff] via-[#4d4dff] to-[#1a1aff] animate-gradient">
                    © 2025 Hales AI - Transforming Business with AI
                  </p>
                </div>
              </footer>

              {/* Chat Interface */}
              <ChatInterface 
                isOpen={isChatOpen}
                onClose={() => setIsChatOpen(false)}
                onMessageSent={handleMessageSent}
                onMessageReceived={handleMessageReceived}
              />
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0f16]/90 text-white relative">
      <GridBackground />
      {renderPage()}
    </div>
  );
}

export default App;
