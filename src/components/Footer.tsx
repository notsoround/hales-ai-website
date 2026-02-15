import { Twitter, Youtube, Linkedin, Mail, Github, Heart } from 'lucide-react';

export function Footer() {
    return (
        <footer className="relative bg-[#020410] pt-20 pb-10 overflow-hidden border-t border-white/5">
            {/* Background styling elements */}
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
                            Pioneering the future of artificial intelligence with advanced telephony, workflow automation, and digital cloning technologies.
                        </p>
                        <div className="flex gap-4">
                            <a href="https://twitter.com/hales_ai" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:bg-primary/20 hover:text-primary transition-all duration-300 hover:scale-110">
                                <Twitter size={18} />
                            </a>
                            <a href="https://youtube.com/@hales_ai" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:bg-red-500/20 hover:text-red-500 transition-all duration-300 hover:scale-110">
                                <Youtube size={18} />
                            </a>
                            <a href="#" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:bg-blue-600/20 hover:text-blue-500 transition-all duration-300 hover:scale-110">
                                <Linkedin size={18} />
                            </a>
                            <a href="#" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:bg-white/20 hover:text-white transition-all duration-300 hover:scale-110">
                                <Github size={18} />
                            </a>
                        </div>
                    </div>

                    {/* Quick Links */}
                    <div>
                        <h3 className="text-white font-semibold mb-6">Product</h3>
                        <ul className="space-y-4 text-sm text-gray-400">
                            <li><a href="#" className="hover:text-primary transition-colors">Features</a></li>
                            <li><a href="#" className="hover:text-primary transition-colors">Pricing</a></li>
                            <li><a href="#" className="hover:text-primary transition-colors">Voice Cloning</a></li>
                            <li><a href="#" className="hover:text-primary transition-colors">API Access</a></li>
                            <li><a href="#" className="hover:text-primary transition-colors">Integrations</a></li>
                        </ul>
                    </div>

                    {/* Support */}
                    <div>
                        <h3 className="text-white font-semibold mb-6">Support</h3>
                        <ul className="space-y-4 text-sm text-gray-400">
                            <li><a href="#" className="hover:text-primary transition-colors">Documentation</a></li>
                            <li><a href="#" className="hover:text-primary transition-colors">API Reference</a></li>
                            <li><a href="#" className="hover:text-primary transition-colors">System Status</a></li>
                            <li><a href="#" className="hover:text-primary transition-colors">Contact Us</a></li>
                            <li><a href="#" className="hover:text-primary transition-colors">Help Center</a></li>
                        </ul>
                    </div>

                    {/* Newsletter */}
                    <div>
                        <h3 className="text-white font-semibold mb-6">Stay Updated</h3>
                        <p className="text-gray-400 text-sm mb-4">
                            Subscribe to our newsletter for the latest AI updates and features.
                        </p>
                        <form className="flex gap-2">
                            <input
                                type="email"
                                placeholder="Enter your email"
                                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-primary/50 focus:bg-white/10 transition-all"
                            />
                            <button className="bg-gradient-to-r from-primary to-secondary p-2 rounded-lg text-black hover:opacity-90 transition-opacity">
                                <Mail size={18} />
                            </button>
                        </form>
                    </div>
                </div>

                <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-8"></div>

                <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-gray-500">
                    <p>© 2025 Hales AI. All rights reserved.</p>
                    <div className="flex gap-8">
                        <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
                        <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
                        <a href="#" className="hover:text-white transition-colors">Cookie Policy</a>
                    </div>
                    <div className="flex items-center gap-1">
                        <span>Made with</span>
                        <Heart size={12} className="text-red-500 fill-red-500" />
                        <span>in San Francisco</span>
                    </div>
                </div>
            </div>
        </footer>
    );
}
