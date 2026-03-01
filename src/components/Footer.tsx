import { Twitter, Youtube, Linkedin, Mail, Github, Heart, Phone } from 'lucide-react';

export function Footer() {
    const navigate = (path: string) => {
        window.history.pushState({}, '', path);
        window.dispatchEvent(new PopStateEvent('popstate'));
    };

    return (
        <footer className="relative bg-[#020410] pt-20 pb-10 overflow-hidden border-t border-white/5">
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl -translate-y-1/2"></div>
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary/5 rounded-full blur-3xl translate-y-1/2"></div>
            </div>

            <div className="max-w-7xl mx-auto px-4 relative z-10">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
                    {/* Brand Column */}
                    <div className="space-y-6">
                        <h2 className="text-2xl font-bold font-display bg-clip-text text-transparent bg-gradient-to-r from-primary via-white to-secondary animate-gradient">
                            Hales AI
                        </h2>
                        <p className="text-gray-400 text-sm leading-relaxed">
                            AI telephony, workflow automation, and custom AI solutions. Built by Matt Hales in Texas.
                        </p>
                        <div className="flex gap-4">
                            <a href="https://x.com/hales_ai" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:bg-primary/20 hover:text-primary transition-all duration-300 hover:scale-110">
                                <Twitter size={18} />
                            </a>
                            <a href="https://youtube.com/@hales_ai" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:bg-red-500/20 hover:text-red-500 transition-all duration-300 hover:scale-110">
                                <Youtube size={18} />
                            </a>
                            <a href="https://www.linkedin.com/company/hales-asi" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:bg-blue-600/20 hover:text-blue-500 transition-all duration-300 hover:scale-110">
                                <Linkedin size={18} />
                            </a>
                            <a href="https://github.com/notsoround" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:bg-white/20 hover:text-white transition-all duration-300 hover:scale-110">
                                <Github size={18} />
                            </a>
                        </div>
                    </div>

                    {/* Navigation */}
                    <div>
                        <h3 className="text-white font-semibold mb-6">Navigate</h3>
                        <ul className="space-y-4 text-sm text-gray-400">
                            <li><button onClick={() => navigate('/about-us')} className="hover:text-primary transition-colors text-left">About Us</button></li>
                            <li><button onClick={() => navigate('/get-started')} className="hover:text-primary transition-colors text-left">Get Started</button></li>
                            <li><button onClick={() => navigate('/learn-more')} className="hover:text-primary transition-colors text-left">Learn More</button></li>
                            <li><button onClick={() => navigate('/contact-us')} className="hover:text-primary transition-colors text-left">Contact Us</button></li>
                            <li><button onClick={() => navigate('/cupcake')} className="hover:text-primary transition-colors text-left">🧁 Cupcake</button></li>
                        </ul>
                    </div>

                    {/* What We Build */}
                    <div>
                        <h3 className="text-white font-semibold mb-6">What We Build</h3>
                        <ul className="space-y-4 text-sm text-gray-400">
                            <li className="flex items-center gap-2"><Phone size={14} className="text-primary/60" /><span>AI Phone Agents</span></li>
                            <li className="flex items-center gap-2"><Mail size={14} className="text-primary/60" /><span>Email & Calendar Automation</span></li>
                            <li className="flex items-center gap-2"><Twitter size={14} className="text-primary/60" /><span>Multi-Channel Bots</span></li>
                            <li className="flex items-center gap-2"><Github size={14} className="text-primary/60" /><span>Custom AI Solutions</span></li>
                        </ul>
                    </div>

                    {/* Contact */}
                    <div>
                        <h3 className="text-white font-semibold mb-6">Get in Touch</h3>
                        <div className="space-y-4 text-sm text-gray-400">
                            <a href="mailto:matt@hales.ai" className="flex items-center gap-3 hover:text-primary transition-colors">
                                <Mail size={16} className="text-primary/60" />
                                <span>matt@hales.ai</span>
                            </a>
                            <a href="tel:+18726669598" className="flex items-center gap-3 hover:text-primary transition-colors">
                                <Phone size={16} className="text-primary/60" />
                                <span>+1 (872) 666-9598</span>
                            </a>
                            <p className="text-gray-500 text-xs mt-4">
                                Call the number above to talk to our AI voice agent — available 24/7.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-8"></div>

                <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-gray-500">
                    <p>© {new Date().getFullYear()} Hales AI. All rights reserved.</p>
                    <div className="flex items-center gap-1">
                        <span>Made with</span>
                        <Heart size={12} className="text-red-500 fill-red-500" />
                        <span>in Texas</span>
                    </div>
                </div>
            </div>
        </footer>
    );
}
