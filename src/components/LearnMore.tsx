import React, { useState } from 'react';
import {
  BookOpen,
  Code2,
  FileText,
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
    <div className="min-h-screen bg-[#0a0f16] text-white py-24">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-16">
          <h1 className="text-6xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-[#00e6e6] via-[#00ccff] to-[#1a1aff] animate-gradient">
            Learn More About Hales AI
          </h1>
          <p className="text-xl max-w-2xl mx-auto text-gray-300">
            Discover how our AI solutions can transform your business
          </p>
        </div>

        {/* Search */}
        <div className="max-w-2xl mx-auto mb-16">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#00e6e6]" />
            <input
              type="text"
              placeholder="Search documentation..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full py-4 pl-12 pr-4 rounded-full bg-[#0a1a2b] border border-[#00e6e6]/20 focus:border-[#00e6e6] focus:outline-none focus:ring-2 focus:ring-[#00e6e6]/20 transition-all"
            />
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-24">
          {features.map((feature, index) => (
            <div
              key={index}
              className="p-6 rounded-2xl bg-gradient-to-br from-[#0a1a2b]/50 to-[#0a0f16]/50 border border-[#00e6e6]/10 hover:scale-105 transition-all duration-300"
            >
              <div className="text-[#00e6e6] mb-4">{feature.icon}</div>
              <h3 className="text-xl font-semibold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-[#00e6e6] via-[#00ccff] to-[#1a1aff] animate-gradient">
                {feature.title}
              </h3>
              <p className="text-gray-400">{feature.description}</p>
            </div>
          ))}
        </div>

        {/* Video Resources */}
        <div className="mb-24">
          <h2 className="text-4xl font-bold text-center mb-12 bg-clip-text text-transparent bg-gradient-to-r from-[#00e6e6] via-[#00ccff] to-[#1a1aff] animate-gradient">
            Video Tutorials
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {resources.map((resource, index) => (
              <div
                key={index}
                className="rounded-2xl bg-[#0a1a2b]/50 overflow-hidden hover:scale-105 transition-all duration-300"
              >
                {selectedResource === index ? (
                  <div className="aspect-video">
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
                    className="aspect-video bg-gradient-to-r from-[#0a1a2b] to-[#0a0f16] flex items-center justify-center cursor-pointer"
                    onClick={() => setSelectedResource(index)}
                  >
                    <PlayCircle className="w-16 h-16 text-[#00e6e6] opacity-50" />
                  </div>
                )}
                <div className="p-6">
                  <div className="text-[#00e6e6] mb-4">{resource.icon}</div>
                  <h3 className="text-xl font-semibold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-[#00e6e6] via-[#00ccff] to-[#1a1aff] animate-gradient">
                    {resource.title}
                  </h3>
                  <p className="text-gray-400">{resource.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ Section */}
        <div>
          <h2 className="text-4xl font-bold text-center mb-12 bg-clip-text text-transparent bg-gradient-to-r from-[#00e6e6] via-[#00ccff] to-[#1a1aff] animate-gradient">
            Frequently Asked Questions
          </h2>
          <div className="max-w-3xl mx-auto space-y-4">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="rounded-xl bg-[#0a1a2b]/50 border border-[#00e6e6]/10"
              >
                <button
                  className="w-full px-6 py-4 flex items-center justify-between text-left"
                  onClick={() =>
                    setExpandedFaq(expandedFaq === index ? null : index)
                  }
                >
                  <span className="font-semibold">{faq.question}</span>
                  {expandedFaq === index ? (
                    <ChevronUp className="w-5 h-5 text-[#00e6e6]" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-[#00e6e6]" />
                  )}
                </button>
                {expandedFaq === index && (
                  <div className="px-6 pb-4 text-gray-400">{faq.answer}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}