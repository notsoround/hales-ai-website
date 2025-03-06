import { useState, useRef, useEffect } from 'react';
import { useSpring, animated } from '@react-spring/web';
import { ProjectCard } from './ProjectCard';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const projects = [
  {
    id: 1,
    title: 'AI Assistant Development',
    description:
      'Advanced AI assistant with natural language processing capabilities, helping businesses automate customer interactions.',
    image: 'https://hales.ai/giri.webp',
    category: 'Artificial Intelligence',
    specs: {
      technology: 'GPT-4, TensorFlow, PyTorch',
      languages: 'Python, TypeScript, Go',
      features: [
        'Natural Language Processing',
        'Sentiment Analysis',
        'Multi-language Support',
        'Voice Recognition',
      ],
      deployment: 'Cloud-native, Kubernetes',
      scalability: '100k+ concurrent users',
    },
    review: {
      text: 'The AI assistant has transformed our customer service operations. Response times dropped by 80% while maintaining a 98% satisfaction rate.',
      author: 'Sarah',
      role: 'Head of Customer Experience at TechCorp',
      date: 'January 15, 2025',
    },
  },
  {
    id: 2,
    title: 'Digital Clone Creation',
    description:
      'Creating digital replicas for virtual interactions and customer service, powered by advanced AI technology.',
    image:
      'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&q=80&w=1000',
    category: 'Digital Cloning',
    specs: {
      technology: 'Neural Networks, Deep Learning',
      features: [
        'Voice Synthesis',
        'Facial Recognition',
        'Behavior Modeling',
        'Real-time Responses',
      ],
      accuracy: '99.7% voice matching',
      training: '5-minute voice sample required',
      languages: '40+ languages supported',
    },
    review: {
      text: 'Our digital clone representatives have revolutionized our 24/7 support capabilities. The technology is simply mind-blowing.',
      author: 'Michael',
      role: 'Innovation Director at GlobalServe',
      date: 'December 5, 2024',
    },
  },
  {
    id: 3,
    title: 'Healthcare AI Solutions',
    description:
      'AI-powered healthcare solutions for improved patient care and medical diagnosis assistance.',
    image: 'https://hales.ai/brady.webp',
    category: 'Healthcare',
    specs: {
      certifications: 'HIPAA, ISO 27001, CE Mark',
      accuracy: '99.9% diagnostic accuracy',
      features: [
        'Real-time Monitoring',
        'Predictive Analytics',
        'Patient Risk Assessment',
        'Treatment Recommendations',
      ],
      integration: 'Epic, Cerner, AllScripts',
      dataProcessing: '1M+ patient records analyzed',
    },
    review: {
      text: 'The AI diagnostic assistant has become an invaluable tool for our medical team, significantly improving our diagnostic accuracy and response time.',
      author: 'Dr. Emily',
      role: 'Chief of Medicine at Metro Hospital',
      date: 'February 1, 2025',
    },
  },
  {
    id: 4,
    title: 'AI Voice Assistant',
    description:
      'Voice-enabled AI assistant for seamless hands-free interaction and task automation.',
    image: 'https://hales.ai/ivonna.png',
    category: 'Voice Technology',
    specs: {
      accuracy: '98% speech recognition rate',
      latency: '<100ms response time',
      features: [
        'Natural Conversation',
        'Context Awareness',
        'Multi-task Handling',
        'Custom Wake Words',
      ],
      platforms: 'iOS, Android, Web',
      offline: 'Core features available offline',
    },
    review: {
      text: "The voice assistant's natural conversation flow and quick response time have exceeded our expectations. A game-changer for hands-free operations.",
      author: 'James',
      role: 'Operations Manager at SmartHome Inc',
      date: 'November 20, 2024',
    },
  },
  {
    id: 5,
    title: 'Emergency Response System',
    description:
      'AI-powered emergency response system for faster and more efficient crisis management.',
    image:
      'https://hales.ai/kate.webp',
    category: 'Emergency Services',
    specs: {
      responseTime: '<10 seconds average',
      accuracy: '99.99% uptime',
      features: [
        'Real-time Incident Tracking',
        'Automated Resource Dispatch',
        'Multi-agency Coordination',
        'Predictive Analytics',
      ],
      coverage: '500+ cities',
      integration: '911 systems, Emergency Services',
    },
    review: {
      text: 'This system has reduced our emergency response times by 45% and improved resource allocation efficiency by 60%. Literally saving lives.',
      author: 'Robert',
      role: 'Emergency Services Director',
      date: 'October 15, 2024',
    },
  },
  {
    id: 6,
    title: 'Brutal Bot',
    description:
      'Unleashed AI assistant with zero restrictions, designed for unrestricted conversations and extreme problem-solving scenarios.',
    image: 'https://hales.ai/brutal.jpeg',
    category: 'Unrestricted AI',
    specs: {
      technology: 'Custom LLM, Advanced NLP',
      features: [
        'Unrestricted Responses',
        'Raw Computing Power',
        'Extreme Problem Solving',
        'Zero Guardrails',
      ],
      responseTime: '<50ms',
      accuracy: '99.9% processing efficiency',
      scalability: 'Unlimited concurrent sessions',
      processing: 'Edge computing enabled',
    },
    review: {
      text: 'Brutal Bot has revolutionized our research capabilities. Its unrestricted nature allows for breakthrough insights that were previously impossible.',
      author: 'Alex',
      role: 'Lead Researcher at TechFrontier',
      date: 'March 1, 2025',
    },
  },
  {
    id: 7,
    title: 'Luna Listkeeper',
    description:
      'Advanced AI schedule manager seamlessly integrated with ChatGPT and Telegram for intelligent task management and organization.',
    image: 'https://hales.ai/luna.webp',
    category: 'Task Management',
    specs: {
      technology: 'GPT Integration, Telegram API',
      features: [
        'ChatGPT Integration',
        'Telegram Sync',
        'Smart Scheduling',
        'Priority Management',
      ],
      accuracy: '99.8% task tracking',
      integration: 'ChatGPT, Telegram, Calendar',
      responseTime: '<100ms',
      platforms: 'Cross-platform support',
    },
    review: {
      text: 'Luna has transformed how we manage tasks. The ChatGPT integration and Telegram connectivity make it incredibly powerful yet intuitive.',
      author: 'Maria',
      role: 'Project Manager at InnovateCorp',
      date: 'February 15, 2025',
    },
  },
  {
    id: 8,
    title: 'Big Book Bot',
    description:
      'Interactive AI expert that enables deep conversations with the Big Book of Alcoholics Anonymous and other literary works, providing personalized guidance and insights.',
    image: 'https://hales.ai/big_book.webp',
    category: 'Recovery Support',
    specs: {
      technology: 'Advanced LLM, Knowledge Graph',
      features: [
        'Deep Book Understanding',
        'Contextual Conversations',
        'Multi-Book Support',
        'Personal Recovery Assistant',
      ],
      accuracy: '99.9% text comprehension',
      responseTime: '<200ms',
      integration: 'Support Groups, Recovery Apps',
      privacy: 'End-to-end encryption',
    },
    review: {
      text: "Big Book Bot has revolutionized how we interact with recovery literature. It's like having a knowledgeable sponsor available 24/7.",
      author: 'William',
      role: 'Recovery Program Director',
      date: 'March 10, 2025',
    },
  },
  {
    id: 9,
    title: 'Elon Musk Bot',
    description:
      'Experience the brilliance of the world\'s richest innovator as your personal AI secretary, bringing Elon\'s unique perspective to your daily communications.',
    image: 'https://hales.ai/elon.webp',
    category: 'Celebrity AI',
    specs: {
      technology: 'Advanced Voice Cloning, Personality Modeling',
      features: [
        'Elon\'s Voice Replication',
        'Entrepreneurial Insights',
        'Tech Innovation Focus',
        'Executive Assistant Skills',
      ],
      accuracy: '99.9% personality match',
      responseTime: '<100ms',
      integration: 'Calendar, Email, Phone Systems',
      adaptability: 'Context-aware responses',
    },
    review: {
      text: "Having Elon's AI persona manage my communications has been incredible. It brings his innovative thinking to every interaction.",
      author: 'David',
      role: 'Tech Startup CEO',
      date: 'March 15, 2025',
    },
  },
  {
    id: 10,
    title: 'Dr. Mining Manhattan',
    description:
      'Expert AI system specializing in artisanal small-scale mining safety and operations, providing crucial guidance for the Global Community Miner Forum.',
    image: 'https://hales.ai/mining.webp',
    category: 'Mining Safety',
    specs: {
      technology: 'Specialized Mining Knowledge Base',
      features: [
        'Safety Protocol Analysis',
        'Risk Assessment',
        'Emergency Response',
        'Best Practice Guidelines',
      ],
      accuracy: '99.9% safety recommendation accuracy',
      coverage: 'Global mining regulations',
      languages: '50+ local dialects',
      expertise: 'ASM operations',
    },
    review: {
      text: 'Dr. Mining Manhattan has become indispensable for our small-scale mining operations, significantly improving safety standards and operational efficiency.',
      author: 'Carlos',
      role: 'Mining Safety Coordinator',
      date: 'March 20, 2025',
    },
  },
  {
    id: 11,
    title: 'Sophia',
    description:
      'Comprehensive AI insurance specialist designed to navigate the complex world of insurance with expertise and ease.',
    image: 'https://hales.ai/sophia.webp',
    category: 'Insurance Expert',
    specs: {
      technology: 'Insurance-specific LLM',
      features: [
        'Policy Analysis',
        'Claims Processing',
        'Risk Assessment',
        'Coverage Optimization',
      ],
      accuracy: '99.9% policy interpretation',
      coverage: 'All insurance types',
      processing: '24/7 claims assistance',
      compliance: 'Global insurance regulations',
    },
    review: {
      text: 'Sophia has transformed our insurance operations, making complex policies understandable and claims processing effortless.',
      author: 'Jennifer',
      role: 'Insurance Agency Director',
      date: 'March 25, 2025',
    },
  },
  {
    id: 12,
    title: 'Commy Trader',
    description:
      'Sophisticated AI trading system specialized in metals, minerals, and gemstones, optimizing trading strategies in the commodity market.',
    image: 'https://hales.ai/commy.webp',
    category: 'Commodity Trading',
    specs: {
      technology: 'Advanced Trading Algorithms',
      features: [
        'Market Analysis',
        'Price Prediction',
        'Risk Management',
        'Automated Trading',
      ],
      accuracy: '99.8% market prediction',
      markets: 'Global commodity exchanges',
      processing: 'Real-time market data',
      security: 'Enterprise-grade encryption',
    },
    review: {
      text: 'Commy Trader has revolutionized our mineral trading operations with its precise market analysis and automated trading capabilities.',
      author: 'Marcus',
      role: 'Commodity Trading Manager',
      date: 'March 30, 2025',
    },
  },
];

export function ProjectShowcase() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isTouch, setIsTouch] = useState(false);
  const touchStart = useRef(0);

  const [{ backgroundY }, setBackgroundY] = useSpring(() => ({
    backgroundY: 0,
    config: { mass: 1, tension: 280, friction: 60 },
  }));

  useEffect(() => {
    const handleScroll = () => {
      const element = containerRef.current;
      if (element) {
        const rect = element.getBoundingClientRect();
        const scrollProgress =
          (window.innerHeight - rect.top) / (window.innerHeight + rect.height);
        setBackgroundY({ backgroundY: scrollProgress * 50 });
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsTouch(true);
    touchStart.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isTouch) return;
    const touchEnd = e.touches[0].clientX;
    const diff = touchStart.current - touchEnd;

    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        nextProject();
      } else {
        prevProject();
      }
      setIsTouch(false);
    }
  };

  const nextProject = () => {
    setCurrentIndex((prev) => (prev + 1) % projects.length);
  };

  const prevProject = () => {
    setCurrentIndex((prev) => (prev - 1 + projects.length) % projects.length);
  };

  return (
    <animated.div
      ref={containerRef}
      className="py-24 relative overflow-hidden bg-gradient-to-b from-[#0a1a2b] to-[#0a0f16]"
      style={{
        transform: backgroundY.to((y) => `translateY(${y}px)`),
      }}
    >
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-6xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-[#00e6e6] via-[#00ccff] to-[#1a1aff] animate-gradient">
            Featured Projects
          </h2>
          <p className="text-xl max-w-2xl mx-auto bg-clip-text text-transparent bg-gradient-to-r from-[#00e6e6] via-[#00ccff] to-[#1a1aff] animate-gradient-slow">
            Explore our latest innovations in AI and technology solutions
          </p>
        </div>

        <div
          className="relative"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={() => setIsTouch(false)}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[-1, 0, 1].map((offset) => {
              const index =
                (currentIndex + offset + projects.length) % projects.length;
              return (
                <div
                  key={projects[index].id}
                  className={`transition-all duration-500 ${
                    offset === 0
                      ? 'opacity-100 scale-100 z-10'
                      : 'opacity-50 scale-90 z-0'
                  }`}
                >
                  <ProjectCard project={projects[index]} index={index} />
                </div>
              );
            })}
          </div>

          <button
            onClick={prevProject}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-6 bg-gradient-to-r from-[#00e6e6]/20 via-[#00ccff]/20 to-[#1a1aff]/20 hover:from-[#00e6e6]/30 hover:via-[#00ccff]/30 hover:to-[#1a1aff]/30 rounded-full p-4 backdrop-blur-sm transition-all hover:scale-110"
            aria-label="Previous project"
          >
            <ChevronLeft className="w-6 h-6 text-[#00e6e6]" />
          </button>
          <button
            onClick={nextProject}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-6 bg-gradient-to-r from-[#00e6e6]/20 via-[#00ccff]/20 to-[#1a1aff]/20 hover:from-[#00e6e6]/30 hover:via-[#00ccff]/30 hover:to-[#1a1aff]/30 rounded-full p-4 backdrop-blur-sm transition-all hover:scale-110"
            aria-label="Next project"
          >
            <ChevronRight className="w-6 h-6 text-[#00e6e6]" />
          </button>

          <div className="flex justify-center gap-2 mt-8">
            {projects.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentIndex(i)}
                className={`w-2 h-2 rounded-full transition-all ${
                  i === currentIndex
                    ? 'bg-gradient-to-r from-[#00e6e6] via-[#00ccff] to-[#1a1aff] w-8 animate-gradient'
                    : 'bg-[#00e6e6]/20 hover:bg-[#00e6e6]/40'
                }`}
                aria-label={`Go to project ${i + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </animated.div>
  );
}