import React from 'react';
import { motion } from 'framer-motion';
import { Phone, Mic2, Workflow, Calendar, Globe, ArrowRight, Sparkles } from 'lucide-react';

const solutions = [
    {
        icon: <Phone className="w-8 h-8" />,
        title: 'AI Telephony',
        description: 'Advanced conversational AI agents that handle calls 24/7 with human-like naturalness.',
        colSpan: 2,
        gradient: 'from-blue-500/20 to-cyan-500/20',
        border: 'group-hover:border-cyan-500/50'
    },
    {
        icon: <Mic2 className="w-8 h-8" />,
        title: 'Voice Cloning',
        description: 'Digital voice replicas.',
        colSpan: 1,
        gradient: 'from-purple-500/20 to-pink-500/20',
        border: 'group-hover:border-pink-500/50'
    },
    {
        icon: <Workflow className="w-8 h-8" />,
        title: 'Workflow Automation',
        description: 'Connect your apps and automate repetitive tasks with n8n and Make.',
        colSpan: 1,
        gradient: 'from-green-500/20 to-emerald-500/20',
        border: 'group-hover:border-emerald-500/50'
    },
    {
        icon: <Calendar className="w-8 h-8" />,
        title: 'Smart Scheduling',
        description: 'AI that books appointments directly into your calendar while you sleep.',
        colSpan: 2,
        gradient: 'from-orange-500/20 to-red-500/20',
        border: 'group-hover:border-orange-500/50'
    },
    {
        icon: <Globe className="w-8 h-8" />,
        title: 'Web Development',
        description: 'Futuristic, high-performance web applications built for the AI era.',
        colSpan: 1,
        gradient: 'from-indigo-500/20 to-blue-500/20',
        border: 'group-hover:border-blue-500/50'
    }
];

interface BentoGridProps {
    onNavigate?: (page: any) => void;
}

export const BentoGrid: React.FC<BentoGridProps> = ({ onNavigate }) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-7xl mx-auto">
            {solutions.map((item, index) => (
                <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    className={`group relative p-8 rounded-3xl glass-panel overflow-hidden hover:scale-[1.02] transition-all duration-500 border border-white/5 ${item.border} ${item.colSpan === 2 ? 'md:col-span-2' : 'md:col-span-1'
                        }`}
                >
                    {/* Background Gradient Blob */}
                    <div className={`absolute -right-10 -top-10 w-64 h-64 rounded-full bg-gradient-to-br ${item.gradient} blur-[80px] opacity-0 group-hover:opacity-40 transition-opacity duration-500`} />

                    <div className="relative z-10 h-full flex flex-col justify-between">
                        <div className="space-y-4">
                            <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center text-white group-hover:bg-primary/20 group-hover:text-primary transition-colors duration-300">
                                {item.icon}
                            </div>
                            <h3 className="text-2xl font-display font-bold text-white group-hover:text-primary transition-colors">
                                {item.title}
                            </h3>
                            <p className="text-gray-400 group-hover:text-gray-300 leading-relaxed">
                                {item.description}
                            </p>
                        </div>

                        <div className="pt-8 flex items-center gap-2 text-sm font-semibold text-white/40 group-hover:text-white transition-colors cursor-pointer">
                            <span>Learn more</span>
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </div>
                    </div>
                </motion.div>
            ))}

            {/* Call to Action Card */}
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                className="md:col-span-1 p-8 rounded-3xl bg-gradient-to-br from-primary to-secondary flex flex-col justify-center items-center text-center space-y-4 shadow-[0_0_30px_rgba(112,0,255,0.3)] hover:shadow-[0_0_50px_rgba(112,0,255,0.5)] transition-shadow duration-500"
            >
                <Sparkles className="w-8 h-8 text-white animate-pulse" />
                <h3 className="text-2xl font-bold font-display text-white">Custom Solution?</h3>
                <p className="text-white/80">We build bespoke AI automation for enterprise needs.</p>
                <button
                    onClick={() => onNavigate?.('contact-us')}
                    className="bg-white text-black px-6 py-2 rounded-full font-bold hover:scale-105 transition-transform"
                >
                    Contact Sales
                </button>
            </motion.div>
        </div>
    );
};
