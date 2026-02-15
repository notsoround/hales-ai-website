import { useState } from 'react';
import {
  CheckCircle2,
  Circle,
  PlayCircle,
  ArrowRight,
  PhoneCall,
  Bot,
  ChevronLeft
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

interface GetStartedProps {
  onNavigate: (page: 'home' | 'get-started' | 'learn-more' | 'matts-tasklist' | 'quantum-code' | 'about-us' | 'contact-us' | 'elite-ops') => void;
}

export function GetStarted({ onNavigate }: GetStartedProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [showVideo, setShowVideo] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-background text-white py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />

      {/* Back Button */}
      <button
        onClick={() => onNavigate('home')}
        className="absolute top-8 left-8 flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-primary/50 transition-all duration-300 group z-50"
      >
        <ChevronLeft className="w-5 h-5 text-gray-400 group-hover:text-primary transition-colors" />
        <span className="text-sm font-medium text-gray-400 group-hover:text-white transition-colors">Back to Home</span>
      </button>

      <div className="max-w-7xl mx-auto px-4 relative z-10">
        <div className="text-center mb-16">
          <h1 className="text-6xl font-bold mb-6 font-display bg-clip-text text-transparent bg-gradient-to-r from-primary via-white to-secondary animate-gradient">
            Get Started with Hales AI
          </h1>
          <p className="text-xl max-w-2xl mx-auto text-gray-400 font-light">
            Follow our simple setup process to start transforming your business with AI
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Steps Progress */}
          <div className="space-y-8">
            {steps.map((step, index) => (
              <div
                key={index}
                className={`relative p-6 rounded-2xl transition-all duration-300 border ${currentStep === index
                  ? 'bg-surface/80 border-primary/50 scale-105 shadow-lg shadow-primary/10'
                  : 'bg-surface/30 border-white/5 hover:bg-surface/50'
                  }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`transition-colors duration-300 ${currentStep === index ? 'text-primary' : 'text-gray-500'
                    }`}>
                    {index < currentStep ? (
                      <CheckCircle2 className="w-6 h-6 text-green-400" />
                    ) : currentStep === index ? (
                      <Circle className="w-6 h-6 animate-pulse" />
                    ) : (
                      <Circle className="w-6 h-6" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className={`text-xl font-semibold mb-2 font-display transition-colors duration-300 ${currentStep === index ? 'text-white' : 'text-gray-400'
                      }`}>
                      {step.title}
                    </h3>
                    <p className="text-gray-400 mb-4 text-sm">{step.description}</p>
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-primary/80 bg-primary/10 px-2 py-1 rounded-full">
                        Estimated time: {step.time}
                      </span>
                      <button
                        onClick={() => setShowVideo(index)}
                        className="flex items-center gap-2 text-xs text-white hover:text-primary transition-colors"
                      >
                        <PlayCircle className="w-3 h-3" />
                        Watch Tutorial
                      </button>
                    </div>
                  </div>
                </div>

                {currentStep === index && (
                  <div className="mt-6 space-y-4">
                    <button
                      onClick={() => setCurrentStep(index + 1)}
                      className="w-full py-3 bg-gradient-to-r from-primary to-secondary text-black rounded-full font-bold hover:scale-[1.02] transition-transform animate-gradient flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
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
              <div className="aspect-video rounded-2xl overflow-hidden bg-black border border-white/10 shadow-2xl">
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
              <div className="aspect-video rounded-2xl bg-surface/30 border border-white/5 flex items-center justify-center group overflow-hidden relative">
                <img src="/video-thumb.png" alt="Select Video" className="absolute inset-0 w-full h-full object-cover opacity-50 group-hover:scale-105 transition-transform duration-700" />
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-secondary/20 backdrop-blur-[2px]" />
                <PlayCircle className="w-16 h-16 text-primary/50 group-hover:text-primary group-hover:scale-110 transition-all duration-300 relative z-10" />
                <p className="absolute bottom-4 text-gray-400 text-sm">Select a step to watch tutorial</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-surface/50 border border-white/5 hover:border-primary/30 transition-colors">
                <PhoneCall className="w-8 h-8 text-primary mb-2" />
                <h4 className="font-semibold mb-1 text-white">24/7 Support</h4>
                <p className="text-xs text-gray-400">Get help anytime you need</p>
              </div>
              <div className="p-4 rounded-xl bg-surface/50 border border-white/5 hover:border-primary/30 transition-colors">
                <Bot className="w-8 h-8 text-secondary mb-2" />
                <h4 className="font-semibold mb-1 text-white">AI Assistance</h4>
                <p className="text-xs text-gray-400">Guided setup process</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}