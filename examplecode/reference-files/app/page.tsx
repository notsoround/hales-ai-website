"use client";

import Image from "next/image";
import Link from "next/link";
import ParentComponent from "@/components/parentComponent";
import AiCard from "@/components/ai-card";
import { MatrixBackground } from "@/components/MatrixBackground";
import SocialFeeds from "@/components/social-feeds";
import { useEffect, useRef, useState } from "react";
import { 
  Phone, 
  Mic2, 
  Calendar, 
  Globe, 
  Bot, 
  Network,
  Settings,
  Headphones,
  MessageSquareMore,
  Code2,
  FileCode2,
  ArrowRight
} from "lucide-react";

// Custom Workflow icon since it's not in lucide-react
const Workflow = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
  </svg>
);

// Navigation component
const Navigation = () => {
  return (
    <nav className="sticky top-0 z-50 bg-gradient-to-b from-black/80 to-transparent backdrop-blur-sm py-4">
      <div className="container mx-auto px-4">
        <div className="flex flex-wrap justify-center gap-4">
          <Link href="/matts-tasklist" className="px-4 py-2 rounded-lg bg-[#001a33] text-[#38b6ff] hover:bg-[#002a4d] transition-colors flex items-center gap-2">
            Task List <ArrowRight className="w-4 h-4" />
          </Link>
          <Link href="/Hales-Ai_Quantum_Code" className="px-4 py-2 rounded-lg bg-[#001a33] text-[#38b6ff] hover:bg-[#002a4d] transition-colors flex items-center gap-2">
            Quantum Code <ArrowRight className="w-4 h-4" />
          </Link>
          <Link href="/realtime-chat" className="px-4 py-2 rounded-lg bg-[#001a33] text-[#38b6ff] hover:bg-[#002a4d] transition-colors flex items-center gap-2">
            Voice Chat <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default function Home() {
  const [isIntersecting, setIsIntersecting] = useState<Record<string, boolean>>({});
  const refs = useRef<Record<string, HTMLDivElement | null>>({});

  const setRef = (key: string) => (element: HTMLDivElement | null) => {
    refs.current[key] = element;
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const key = Object.keys(refs.current).find(
            (k) => refs.current[k] === entry.target
          );
          if (key) {
            setIsIntersecting((prev) => ({
              ...prev,
              [key]: entry.isIntersecting,
            }));
          }
        });
      },
      { threshold: 0.1 }
    );

    Object.values(refs.current).forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-[#000d1a] overflow-x-hidden">
      <MatrixBackground />
      <Navigation />
      
      <main className="relative z-10">
        {/* Header */}
        <header className="container mx-auto px-4 md:px-24 lg:px-24 mb-20">
          <h1 className="gradient-text mt-20 md:text-5xl text-2xl text-center">Hales Ai.</h1>
          <div className="mt-4 mb-4 px-6 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg 
            hover:from-blue-600 hover:to-cyan-600 transition-all duration-300 shadow-lg hover:shadow-cyan-500/50 max-w-xs mx-auto text-center">
            Under Construction
          </div>

          <div className="w-full relative z-20 pointer-events-auto mb-20">
            <div className="max-w-4xl mx-auto">
              <ParentComponent />
            </div>
          </div>
          <div className="text-white flex flex-col gap-5 text-center my-5">
            <p className="gradient-text lg:text-xl text-base pointer-events-none">Meet Our Team Of Ai Expert Agents</p>
            <p className="gradient-text text-base pointer-events-none">Each member is dedicated to providing top-notch services and solutions. From counseling to translation, our agents excel in various tasks.</p>
          </div>
        </header>

        {/* AI Cards Grid */}
        <section className="container mx-auto px-4 md:px-24 lg:px-24 mb-32">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
            <AiCard imageUrl="/ivonna.png" role="Ai Tech Innovator Fire & Safety" name="Ivonna" />
            <AiCard imageUrl="/sophia.webp" role="AI Insurance Specialist" name="Sophia" />
            <AiCard imageUrl="/giri.webp" role="Ai Global Health Expert" name="Giri" />
            <AiCard imageUrl="/mining.webp" role="Ai Mining Safety Expert" name="Dr. Mining Manhattan" />
            <AiCard imageUrl="/elon.webp" role="Hales Ai main bot" name="Elon musk bot" />
            <AiCard imageUrl="/big_book.webp" role="Ai AA Expert" name="Big Book Bot" />
            <AiCard imageUrl="/brady.webp" role="Ai Annuities Expert" name="Brady Bot" />
            <AiCard imageUrl="/commy.webp" role="Ai Mineral Trader" name="Commy Trader" />
            <AiCard imageUrl="/luna.webp" role="Ai Schedule Strategist" name="Luna Listkeeper" />
            <AiCard imageUrl="/kate.webp" role="​Ai Live Translator" name="Kate Cross" />
            <AiCard imageUrl="/phil.webp" role="Ai Extreme Health & Wellness" name="Phil Extreme" />
            <AiCard imageUrl="/brutal.jpeg" role="Ai Anything Goes Bot! 0 Guard rails" name="Brutal Bot" />
            <AiCard imageUrl="/ivonna.png" role="Realtime Voice ChatGPT" name="Voice Assistant" link="/realtime-chat" />
          </div>
        </section>

        {/* Services Section */}
        <section className="bg-[#001a33]/50 py-24 mb-32 rounded-3xl mx-4 md:mx-24 lg:mx-24">
          <div className="container mx-auto px-4">
            <h2 className="gradient-text text-4xl font-bold text-center mb-16">Our Solutions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[
                {
                  icon: <Phone className="w-8 h-8" />,
                  title: "AI Telephony",
                  description: "Advanced conversational AI powered by vapi.ai and retell.ai for natural phone interactions",
                  ref: "telephony"
                },
                {
                  icon: <Mic2 className="w-8 h-8" />,
                  title: "Voice Cloning",
                  description: "Create perfect digital replicas of voices for personalized AI interactions",
                  ref: "cloning"
                },
                {
                  icon: <Workflow className="w-8 h-8" />,
                  title: "Workflow Automation",
                  description: "Streamline processes with n8n and make.com integrations",
                  ref: "workflow"
                },
                {
                  icon: <Calendar className="w-8 h-8" />,
                  title: "Smart Scheduling",
                  description: "Seamless appointment booking with Cal.com and Calendly integration",
                  ref: "scheduling"
                },
                {
                  icon: <Globe className="w-8 h-8" />,
                  title: "Web Development",
                  description: "Custom AI-powered websites and web applications",
                  ref: "web"
                },
                {
                  icon: <Bot className="w-8 h-8" />,
                  title: "Custom AI Solutions",
                  description: "Tailored artificial intelligence solutions for your specific needs",
                  ref: "custom"
                }
              ].map((service, index) => (
                <div
                  key={index}
                  ref={setRef(service.ref)}
                  className={`p-6 rounded-2xl bg-gradient-to-br from-[#001a33] to-[#000d1a] border border-[#38b6ff]/20 transform transition-all duration-500 hover:scale-105 ${
                    isIntersecting[service.ref] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
                  }`}
                >
                  <div className="mb-4 text-[#38b6ff]">{service.icon}</div>
                  <h3 className="text-xl font-semibold mb-2 text-white">{service.title}</h3>
                  <p className="text-gray-300">{service.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="bg-[#000d1a] py-24 mb-32 rounded-3xl mx-4 md:mx-24 lg:mx-24">
          <div className="container mx-auto px-4">
            <h2 className="gradient-text text-4xl font-bold text-center mb-16">Why Choose Us</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                {
                  icon: <Network className="w-6 h-6" />,
                  title: "Advanced AI",
                  description: "Cutting-edge artificial intelligence technology"
                },
                {
                  icon: <Settings className="w-6 h-6" />,
                  title: "Automation",
                  description: "Streamlined workflow automation solutions"
                },
                {
                  icon: <Headphones className="w-6 h-6" />,
                  title: "24/7 Support",
                  description: "Round-the-clock technical assistance"
                },
                {
                  icon: <MessageSquareMore className="w-6 h-6" />,
                  title: "Custom Integration",
                  description: "Seamless integration with existing systems"
                }
              ].map((feature, index) => (
                <div key={index} className="text-center p-6 bg-[#001a33]/50 rounded-xl">
                  <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[#38b6ff]/10 flex items-center justify-center text-[#38b6ff]">
                    {feature.icon}
                  </div>
                  <h3 className="text-lg font-semibold mb-2 text-white">{feature.title}</h3>
                  <p className="text-gray-300">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Tech Stack Section */}
        <section className="bg-[#001a33]/50 py-24 mb-32 rounded-3xl mx-4 md:mx-24 lg:mx-24">
          <div className="container mx-auto px-4">
            <h2 className="gradient-text text-4xl font-bold text-center mb-16">Our Tech Stack</h2>
            <div className="flex flex-wrap justify-center gap-8">
              {[
                { name: "vapi.ai", icon: <Code2 className="w-6 h-6" /> },
                { name: "retell.ai", icon: <Mic2 className="w-6 h-6" /> },
                { name: "n8n", icon: <Workflow className="w-6 h-6" /> },
                { name: "make.com", icon: <Settings className="w-6 h-6" /> },
                { name: "cal.com", icon: <Calendar className="w-6 h-6" /> },
                { name: "VSCode", icon: <FileCode2 className="w-6 h-6" /> }
              ].map((tech, index) => (
                <div key={index} className="flex items-center gap-2 px-6 py-3 rounded-full bg-[#001a33] border border-[#38b6ff]/20 text-white">
                  {tech.icon}
                  <span>{tech.name}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Social Feeds Section */}
        <section className="container mx-auto px-4 md:px-24 lg:px-24 mb-32">
          <SocialFeeds />
        </section>

        {/* Footer */}
        <footer className="bg-[#000d1a] py-8">
          <div className="container mx-auto px-4">
            <p className="gradient-text text-base text-center">Hales.Ai &copy; 2024</p>
          </div>
        </footer>
      </main>
    </div>
  );
}
