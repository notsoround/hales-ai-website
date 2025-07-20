import React, { useState } from 'react';
import { 
  CheckCircle2, 
  Circle,
  PlayCircle,
  FileText,
  Users,
  Settings,
  ArrowRight,
  PhoneCall,
  Bot,
  Mic2
} from 'lucide-react';

const steps = [
  {
    title: 'Choose Your AI Assistant',
    description: 'Select from our range of specialized AI assistants',
    time: '5 mins',
    video: 'https://www.youtube.com/embed/jvt4xRQ1WgM',
    completed: false
  },
  {
    title: 'Voice Configuration',
    description: 'Set up voice cloning and personalization',
    time: '10 mins',
    video: 'https://www.youtube.com/embed/C_78DM1fY7o',
    completed: false
  },
  {
    title: 'Integration Setup',
    description: 'Connect with your existing systems',
    time: '15 mins',
    video: 'https://www.youtube.com/embed/th5_9woFJmk',
    completed: false
  },
  {
    title: 'Test Your Assistant',
    description: 'Make your first call and verify settings',
    time: '5 mins',
    video: 'https://www.youtube.com/embed/kJvX8W8_0DY',
    completed: false
  }
];

export function GetStarted() {
  const [currentStep, setCurrentStep] = useState(0);
  const [showVideo, setShowVideo] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-[#0a0f16] text-white py-24">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-16">
          <h1 className="text-6xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-[#00e6e6] via-[#00ccff] to-[#1a1aff] animate-gradient">
            Get Started with Hales AI
          </h1>
          <p className="text-xl max-w-2xl mx-auto text-gray-300">
            Follow our simple setup process to start transforming your business with AI
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Steps Progress */}
          <div className="space-y-8">
            {steps.map((step, index) => (
              <div
                key={index}
                className={`relative p-6 rounded-2xl transition-all duration-300 ${
                  currentStep === index
                    ? 'bg-gradient-to-r from-[#00e6e6]/20 via-[#00ccff]/20 to-[#1a1aff]/20 scale-105'
                    : 'bg-[#0a1a2b]/50'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="text-[#00e6e6]">
                    {index < currentStep ? (
                      <CheckCircle2 className="w-6 h-6" />
                    ) : currentStep === index ? (
                      <Circle className="w-6 h-6 animate-pulse" />
                    ) : (
                      <Circle className="w-6 h-6 opacity-50" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-[#00e6e6] via-[#00ccff] to-[#1a1aff] animate-gradient">
                      {step.title}
                    </h3>
                    <p className="text-gray-400 mb-4">{step.description}</p>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-[#00e6e6]">
                        Estimated time: {step.time}
                      </span>
                      <button
                        onClick={() => setShowVideo(index)}
                        className="flex items-center gap-2 text-sm text-[#00ccff] hover:text-[#00e6e6] transition-colors"
                      >
                        <PlayCircle className="w-4 h-4" />
                        Watch Tutorial
                      </button>
                    </div>
                  </div>
                </div>

                {currentStep === index && (
                  <div className="mt-6 space-y-4">
                    <button
                      onClick={() => setCurrentStep(index + 1)}
                      className="w-full py-3 bg-gradient-to-r from-[#00e6e6] via-[#00ccff] to-[#1a1aff] rounded-full font-semibold hover:opacity-90 transition animate-gradient flex items-center justify-center gap-2"
                    >
                      {index === steps.length - 1 ? 'Complete Setup' : 'Continue'}
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Video Tutorial */}
          <div className="lg:sticky lg:top-24 space-y-6">
            {showVideo !== null ? (
              <div className="aspect-video rounded-2xl overflow-hidden bg-black">
                <iframe
                  width="100%"
                  height="100%"
                  src={steps[showVideo].video}
                  title="Tutorial Video"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
              </div>
            ) : (
              <div className="aspect-video rounded-2xl bg-gradient-to-r from-[#0a1a2b] to-[#0a0f16] flex items-center justify-center">
                <PlayCircle className="w-16 h-16 text-[#00e6e6] opacity-50" />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-gradient-to-r from-[#00e6e6]/10 via-[#00ccff]/10 to-[#1a1aff]/10">
                <PhoneCall className="w-8 h-8 text-[#00e6e6] mb-2" />
                <h4 className="font-semibold mb-1">24/7 Support</h4>
                <p className="text-sm text-gray-400">Get help anytime you need</p>
              </div>
              <div className="p-4 rounded-xl bg-gradient-to-r from-[#00e6e6]/10 via-[#00ccff]/10 to-[#1a1aff]/10">
                <Bot className="w-8 h-8 text-[#00e6e6] mb-2" />
                <h4 className="font-semibold mb-1">AI Assistance</h4>
                <p className="text-sm text-gray-400">Guided setup process</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}