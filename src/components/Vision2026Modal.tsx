import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Network, Cpu, Zap, Globe } from 'lucide-react';

interface Vision2026ModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const Vision2026Modal: React.FC<Vision2026ModalProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="relative w-full max-w-4xl aspect-video bg-black border border-cyan-500/50 rounded-2xl overflow-hidden shadow-[0_0_100px_rgba(6,182,212,0.3)]"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 z-50 p-2 text-cyan-500/50 hover:text-cyan-400 bg-black/50 hover:bg-cyan-900/20 rounded-full transition-colors"
                    >
                        <X size={24} />
                    </button>

                    {/* Animation Container */}
                    <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
                        {/* Background Grid */}
                        <div className="absolute inset-0 bg-[linear-gradient(to_right,#083344_1px,transparent_1px),linear-gradient(to_bottom,#083344_1px,transparent_1px)] bg-[size:2rem_2rem] opacity-20" />

                        {/* Central Content */}
                        <div className="relative z-10 text-center">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.5 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 1, ease: "easeOut" }}
                                className="mb-8 relative inline-block"
                            >
                                <div className="absolute -inset-8 bg-cyan-500/20 blur-3xl rounded-full" />
                                <Globe className="w-24 h-24 text-cyan-400 animate-pulse relative z-10 mx-auto" strokeWidth={1} />

                                {/* Orbiting Elements */}
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                                    className="absolute inset-0 z-0"
                                >
                                    <div className="absolute -top-4 left-1/2 w-3 h-3 bg-blue-500 rounded-full shadow-[0_0_10px_#3b82f6]" />
                                </motion.div>
                                <motion.div
                                    animate={{ rotate: -360 }}
                                    transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                                    className="absolute inset-0 z-0"
                                >
                                    <div className="absolute top-1/2 -right-6 w-2 h-2 bg-purple-500 rounded-full shadow-[0_0_10px_#a855f7]" />
                                </motion.div>
                            </motion.div>

                            <motion.h1
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.5, duration: 0.8 }}
                                className="text-5xl md:text-7xl font-bold font-display tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 mb-4"
                            >
                                VISION 2026
                            </motion.h1>

                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: "100%" }}
                                transition={{ delay: 1, duration: 1 }}
                                className="h-px bg-gradient-to-r from-transparent via-cyan-500 to-transparent mx-auto mb-6 max-w-lg"
                            />

                            {/* Feature Nodes */}
                            <div className="flex justify-center gap-8 md:gap-16">
                                {[
                                    { icon: Network, label: "NEURAL LINK" },
                                    { icon: Cpu, label: "QUANTUM CORE" },
                                    { icon: Zap, label: "HYPER SPEED" }
                                ].map((item, index) => (
                                    <motion.div
                                        key={index}
                                        initial={{ y: 20, opacity: 0 }}
                                        animate={{ y: 0, opacity: 1 }}
                                        transition={{ delay: 1.5 + index * 0.2 }}
                                        className="flex flex-col items-center gap-2 group"
                                    >
                                        <div className="p-3 rounded-xl bg-cyan-900/20 border border-cyan-500/30 group-hover:border-cyan-400/60 group-hover:bg-cyan-500/10 transition-all duration-300">
                                            <item.icon className="w-6 h-6 text-cyan-400" />
                                        </div>
                                        <span className="text-xs font-mono text-cyan-500/70 tracking-widest">{item.label}</span>
                                    </motion.div>
                                ))}
                            </div>

                            {/* Typing Effect Text */}
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 2.5 }}
                                className="mt-12 font-mono text-cyan-400/80 text-sm md:text-base"
                            >
                                <span className="inline-block border-r-2 border-cyan-500 animate-pulse pr-1">
                                    INITIALIZING GLOBAL PROTOCOLS...
                                </span>
                            </motion.div>
                        </div>

                        {/* Scanlines Overlay */}
                        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_50%,rgba(0,0,0,0.5)_50%)] bg-[size:100%_4px] pointer-events-none opacity-20" />

                        {/* Vignette */}
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.8)_100%)] pointer-events-none" />
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default Vision2026Modal;
