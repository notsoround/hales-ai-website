import { useState } from 'react';
import {
  BookOpen,
  Code2,
  Globe,
  Headphones,
  MessageSquareMore,
  PlayCircle,
  Search,
  Users,
  Workflow,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

const features = [
  {
    icon: <Globe className="w-8 h-8" />,
    title: 'Global Reach',
    description: 'Connect with customers worldwide through our AI solutions',
  },
  {
    icon: <Workflow className="w-8 h-8" />,
    title: 'Workflow Automation',
    description: 'Streamline your business processes with intelligent automation',
  },
  {
    icon: <Users className="w-8 h-8" />,
    title: 'Team Collaboration',
    description: 'Enable seamless communication across your organization',
  },
  {
    icon: <Code2 className="w-8 h-8" />,
    title: 'Custom Integration',
    description: 'Integrate with your existing systems and workflows',
  },
];

const faqs = [
  {
    question: 'How does voice cloning work?',
    answer: 'Our voice cloning technology uses advanced AI to create a digital replica of any voice with just a few minutes of sample audio. The process is secure, fast, and produces highly accurate results.',
  },
  {
    question: 'What security measures are in place?',
    answer: 'We implement enterprise-grade encryption, secure data storage, and strict access controls. All voice data is processed in compliance with global privacy regulations.',
  },
  {
    question: 'Can I customize the AI behavior?',
    answer: 'Yes, our AI assistants are fully customizable. You can define their personality, knowledge base, and interaction style to match your brand and requirements.',
  },
  {
    question: 'What types of integration are supported?',
    answer: 'We support integration with major CRM systems, communication platforms, and business tools. Our API allows for custom integrations with any existing system.',
  },
];

const resources = [
  {
    title: 'Getting Started Guide',
    description: 'Complete guide to setting up your AI assistant',
    icon: <BookOpen className="w-6 h-6" />,
    video: 'https://www.youtube.com/embed/jvt4xRQ1WgM',
  },
  {
    title: 'Voice Cloning Tutorial',
    description: 'Learn how to create perfect voice replicas',
    icon: <Headphones className="w-6 h-6" />,
    video: 'https://www.youtube.com/embed/C_78DM1fY7o',
  },
  {
    title: 'Integration Guide',
    description: 'Connect with your existing systems',
    icon: <MessageSquareMore className="w-6 h-6" />,
    video: 'https://www.youtube.com/embed/th5_9woFJmk',
  },
];

export function LearnMore() {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [selectedResource, setSelectedResource] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-background text-white py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 relative z-10">
        <div className="text-center mb-16">
          <h1 className="text-6xl font-bold mb-6 font-display bg-clip-text text-transparent bg-gradient-to-r from-primary via-white to-secondary animate-gradient">
            Learn More About Hales AI
          </h1>
          <p className="text-xl max-w-2xl mx-auto text-gray-400 font-light">
            Discover how our AI solutions can transform your business
          </p>
        </div>

        {/* Search */}
        <div className="max-w-2xl mx-auto mb-16">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-primary transition-colors" />
            <input
              type="text"
              placeholder="Search documentation..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full py-4 pl-12 pr-4 rounded-full bg-surface/50 border border-white/10 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-white placeholder-gray-500"
            />
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-24">
          {features.map((feature, index) => (
            <div
              key={index}
              className="p-6 rounded-2xl glass-panel group hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/10 transition-all duration-300"
            >
              <div className="text-primary mb-4 group-hover:scale-110 transition-transform origin-left">{feature.icon}</div>
              <h3 className="text-xl font-semibold mb-2 font-display text-white group-hover:text-primary transition-colors">
                {feature.title}
              </h3>
              <p className="text-gray-400 text-sm leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>

        {/* Video Resources */}
        <div className="mb-24">
          <h2 className="text-4xl font-bold text-center mb-12 font-display bg-clip-text text-transparent bg-gradient-to-r from-primary via-white to-secondary animate-gradient">
            Video Tutorials
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {resources.map((resource, index) => (
              <div
                key={index}
                className="rounded-2xl glass-panel overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-primary/10 group"
              >
                {selectedResource === index ? (
                  <div className="aspect-video bg-black">
                    <iframe
                      width="100%"
                      height="100%"
                      src={resource.video}
                      title={resource.title}
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    ></iframe>
                  </div>
                ) : (
                  <div
                    className="aspect-video bg-surface/30 relative flex items-center justify-center cursor-pointer group-hover:bg-surface/50 transition-colors overflow-hidden"
                    onClick={() => setSelectedResource(index)}
                  >
                    <img src="/video-thumb.png" alt="Select Video" className="absolute inset-0 w-full h-full object-cover opacity-50 group-hover:scale-105 transition-transform duration-700" />
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-secondary/20 backdrop-blur-[2px]" />
                    <PlayCircle className="w-16 h-16 text-primary/50 group-hover:text-primary group-hover:scale-110 transition-all duration-300 relative z-10" />
                  </div>
                )}
                <div className="p-6">
                  <div className="text-primary mb-4">{resource.icon}</div>
                  <h3 className="text-xl font-semibold mb-2 font-display text-white">
                    {resource.title}
                  </h3>
                  <p className="text-gray-400 text-sm">{resource.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ Section */}
        <div>
          <h2 className="text-4xl font-bold text-center mb-12 font-display bg-clip-text text-transparent bg-gradient-to-r from-primary via-white to-secondary animate-gradient">
            Frequently Asked Questions
          </h2>
          <div className="max-w-3xl mx-auto space-y-4">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className={`rounded-xl border transition-all duration-300 ${expandedFaq === index
                  ? 'bg-surface/80 border-primary/50 shadow-lg shadow-primary/5'
                  : 'bg-surface/30 border-white/5 hover:border-white/10'
                  }`}
              >
                <button
                  className="w-full px-6 py-4 flex items-center justify-between text-left"
                  onClick={() =>
                    setExpandedFaq(expandedFaq === index ? null : index)
                  }
                >
                  <span className={`font-semibold transition-colors ${expandedFaq === index ? 'text-primary' : 'text-white'
                    }`}>
                    {faq.question}
                  </span>
                  {expandedFaq === index ? (
                    <ChevronUp className="w-5 h-5 text-primary" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-500" />
                  )}
                </button>
                {expandedFaq === index && (
                  <div className="px-6 pb-4 text-gray-400 text-sm leading-relaxed border-t border-white/5 pt-4">
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}