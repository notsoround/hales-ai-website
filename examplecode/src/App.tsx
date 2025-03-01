import React, { useEffect, useRef, useState } from 'react';
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
  MessageCircle,
} from 'lucide-react';
import { ChatInterface } from './components/ChatInterface';
import { GridBackground } from './components/GridBackground';
import { CursorTrail } from './components/CursorTrail';
import { ProjectShowcase } from './components/ProjectShowcase';
import { GetStarted } from './components/GetStarted';
import { LearnMore } from './components/LearnMore';
import ParentComponent from './components/ParentComponent';

function App() {
  const [currentPage, setCurrentPage] = useState<'home' | 'get-started' | 'learn-more'>('home');
  const [isIntersecting, setIsIntersecting] = useState<Record<string, boolean>>({});
  const [isChatOpen, setIsChatOpen] = useState(false);
  const observerRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const handleMessageSent = (message: string) => {
    console.log('User message:', message);
  };

  const handleMessageReceived = (message: string) => {
    console.log('Assistant response:', message);
  };

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

  const renderPage = () => {
    switch (currentPage) {
      case 'get-started':
        return <GetStarted />;
      case 'learn-more':
        return <LearnMore />;
      default:
        return (
          <>
            {/* Hero Section */}
            <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
              <div className="absolute w-[600px] h-[600px] bg-gradient-to-r from-[#00e6e6] via-[#00ccff] to-[#1a1aff] rounded-full filter blur-[128px] opacity-20 animate-pulse-slow"></div>
              <div className="absolute w-[500px] h-[500px] bg-gradient-to-r from-[#00e6e6] via-[#00ccff] to-[#1a1aff] rounded-full filter blur-[128px] opacity-20 animate-pulse-slow delay-700"></div>

              <div className="relative z-10 text-center px-4">
                <h1 className="text-6xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-[#00e6e6] via-[#00ccff] via-[#4d4dff] to-[#1a1aff] animate-gradient">
                  Hales AI
                </h1>
                <p className="text-xl mb-8 max-w-2xl mx-auto bg-clip-text text-transparent bg-gradient-to-r from-[#00e6e6] via-[#00ccff] via-[#4d4dff] to-[#1a1aff] animate-gradient-slow">
                  Transforming businesses with advanced AI telephony, workflow automation, and digital
                  cloning technology
                </p>
                <div className="flex gap-4 justify-center">
                  <button
                    onClick={() => setCurrentPage('get-started')}
                    className="px-8 py-3 bg-gradient-to-r from-[#00e6e6] via-[#00ccff] via-[#4d4dff] to-[#1a1aff] rounded-full font-semibold hover:opacity-90 transition animate-gradient"
                  >
                    Get Started
                  </button>
                  <button
                    onClick={() => setCurrentPage('learn-more')}
                    className="px-8 py-3 border border-[#00e6e6]/20 rounded-full font-semibold bg-gradient-to-r from-[#00e6e6]/10 via-[#00ccff]/10 via-[#4d4dff]/10 to-[#1a1aff]/10 hover:from-[#00e6e6]/20 hover:via-[#00ccff]/20 hover:via-[#4d4dff]/20 hover:to-[#1a1aff]/20 transition animate-gradient"
                  >
                    Learn More
                  </button>
                </div>
                <div className="mt-12">
                  <ParentComponent />
                </div>
                <p className="text-sm text-[#00e6e6]/60 mt-2">Click the glob to start voice chat</p>
              </div>

              <div className="absolute bottom-10 w-full text-center">
                <div className="animate-bounce">
                  <div className="w-8 h-8 mx-auto border-2 border-[#00e6e6] rounded-full flex items-center justify-center text-[#00e6e6]">
                    ↓
                  </div>
                </div>
              </div>
            </div>

            {/* Services Grid */}
            <div className="max-w-7xl mx-auto px-4 py-24">
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
            <div className="bg-gradient-to-b from-[#0a1a2b] to-[#0a0f16] py-24">
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
            <div className="py-24 px-4">
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

            {/* Footer */}
            <footer className="border-t border-[#00e6e6]/20 py-12">
              <div className="max-w-7xl mx-auto px-4 text-center">
                <p className="bg-clip-text text-transparent bg-gradient-to-r from-[#00e6e6] via-[#00ccff] via-[#4d4dff] to-[#1a1aff] animate-gradient">
                  © 2024 Hales AI - Transforming Business with AI
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

            {/* Chat Button */}
            {!isChatOpen && (
              <button
                onClick={() => setIsChatOpen(true)}
                className="fixed bottom-4 right-4 w-14 h-14 rounded-full bg-gradient-to-r from-[#00e6e6] via-[#00ccff] to-[#1a1aff] flex items-center justify-center text-white shadow-lg hover:scale-110 transition-transform z-50 animate-gradient"
              >
                <MessageCircle size={24} />
              </button>
            )}
          </>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0f16] text-white relative">
      <GridBackground />
      <CursorTrail />
      {renderPage()}
    </div>
  );
}

export default App;