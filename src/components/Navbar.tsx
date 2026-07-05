import React, { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface NavbarProps {
    onNavigate: (page: any) => void;
    currentPage: string;
}

const navItems = [
    { name: 'About Us', id: 'about-us' },
    { name: 'Contact Us', id: 'contact-us' },
    { name: 'Elite Ops', id: 'elite-ops' },
];

const LogoMark = () => (
    <svg viewBox="0 0 64 64" className="w-9 h-9" aria-hidden="true">
        <defs>
            <linearGradient id="hales-mark" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#00F0FF" />
                <stop offset="1" stopColor="#7000FF" />
            </linearGradient>
        </defs>
        <rect width="64" height="64" rx="14" fill="#0A0F1E" />
        <path d="M18 14v36M46 14v36M18 32h28" stroke="url(#hales-mark)" strokeWidth="7" strokeLinecap="round" fill="none" />
        <circle cx="46" cy="14" r="5" fill="#00F0FF" />
    </svg>
);

export const Navbar: React.FC<NavbarProps> = ({ onNavigate, currentPage }) => {
    const [isScrolled, setIsScrolled] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 20);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <>
            <motion.nav
                initial={{ y: -100 }}
                animate={{ y: 0 }}
                className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled ? 'py-4' : 'py-6'
                    }`}
            >
                <div className="max-w-7xl mx-auto px-4">
                    <div className={`relative backdrop-blur-xl border border-white/10 rounded-2xl px-6 py-3 transition-all duration-300 ${isScrolled ? 'bg-[#020410]/80 shadow-lg shadow-primary/10' : 'bg-transparent border-transparent'
                        }`}>
                        <div className="flex justify-between items-center">
                            {/* Logo */}
                            <button
                                onClick={() => onNavigate('home')}
                                aria-label="Hales AI home"
                                className="flex items-center gap-3 hover:scale-105 transition-transform"
                            >
                                <LogoMark />
                                <span className="text-2xl font-bold font-display bg-clip-text text-transparent bg-gradient-to-r from-primary via-white to-secondary animate-gradient">
                                    Hales AI
                                </span>
                            </button>

                            {/* Desktop Menu */}
                            <div className="hidden md:flex items-center gap-8">
                                {navItems.map((item) => (
                                    <button
                                        key={item.id}
                                        onClick={() => onNavigate(item.id)}
                                        className="relative group px-4 py-2"
                                    >
                                        <span className={`relative z-10 text-sm font-medium transition-colors duration-300 ${currentPage === item.id ? 'text-primary' : 'text-gray-300 group-hover:text-white'
                                            }`}>
                                            {item.name}
                                        </span>
                                        <span className={`absolute inset-0 rounded-lg bg-white/5 scale-0 group-hover:scale-100 transition-transform duration-200 origin-center ${currentPage === item.id ? 'scale-100 bg-white/10' : ''
                                            }`} />
                                    </button>
                                ))}

                                <button
                                    onClick={() => onNavigate('get-started')}
                                    className="px-6 py-2 rounded-full bg-gradient-to-r from-primary to-secondary text-black font-bold text-sm hover:shadow-[0_0_20px_rgba(0,240,255,0.3)] hover:scale-105 transition-all duration-300"
                                >
                                    Get Started
                                </button>
                            </div>

                            {/* Mobile Menu Button */}
                            <button
                                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                                className="md:hidden p-2 text-white hover:text-primary transition-colors"
                            >
                                {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                            </button>
                        </div>
                    </div>
                </div>
            </motion.nav>

            {/* Mobile Menu Overlay */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="fixed inset-0 z-40 bg-[#020410]/95 backdrop-blur-xl md:hidden pt-32 px-6"
                    >
                        <div className="flex flex-col gap-6">
                            {navItems.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => {
                                        onNavigate(item.id);
                                        setIsMobileMenuOpen(false);
                                    }}
                                    className="text-2xl font-display font-bold text-left text-white/80 hover:text-primary transition-colors"
                                >
                                    {item.name}
                                </button>
                            ))}
                            <div className="h-px bg-white/10 my-4" />
                            <button
                                onClick={() => {
                                    onNavigate('get-started');
                                    setIsMobileMenuOpen(false);
                                }}
                                className="w-full py-4 rounded-xl bg-gradient-to-r from-primary to-secondary text-black font-bold text-lg"
                            >
                                Get Started
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};
