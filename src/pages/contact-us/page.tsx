import { Mail, Phone, MapPin, Send } from 'lucide-react';
import './styles.css';
import BackButton from '../../components/BackButton';

const ContactUs = () => {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden py-12">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[100px] -translate-y-1/2"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-[100px] translate-y-1/2"></div>
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4">
        <div className="mb-8">
          <BackButton />
        </div>

        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-bold mb-6 font-display bg-clip-text text-transparent bg-gradient-to-r from-primary via-white to-secondary animate-gradient">
            Contact Us
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto font-light">
            Ready to transform your business with AI? Get in touch with our team.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
          {/* Contact Info */}
          <div className="glass-panel p-8 rounded-3xl border border-white/5 relative overflow-hidden group hover:border-primary/20 transition-colors duration-500">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

            <h2 className="text-2xl font-bold mb-8 text-white relative z-10">
              Get in Touch
            </h2>

            <div className="space-y-8 relative z-10">
              <a href="mailto:Matt@hales.ai" className="flex items-start space-x-6 group/item p-4 rounded-2xl hover:bg-white/5 transition-colors">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover/item:scale-110 transition-transform duration-300">
                  <Mail className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-1">Email Us</h3>
                  <span className="text-lg text-white font-medium group-hover/item:text-primary transition-colors">
                    Matt@hales.ai
                  </span>
                </div>
              </a>

              <a href="tel:+17867082214" className="flex items-start space-x-6 group/item p-4 rounded-2xl hover:bg-white/5 transition-colors">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover/item:scale-110 transition-transform duration-300">
                  <Phone className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-1">Call Us</h3>
                  <span className="text-lg text-white font-medium group-hover/item:text-primary transition-colors">
                    +1 (786) 708-2214
                  </span>
                </div>
              </a>

              <div className="flex items-start space-x-6 group/item p-4 rounded-2xl hover:bg-white/5 transition-colors">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover/item:scale-110 transition-transform duration-300">
                  <MapPin className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-1">Visit HQ</h3>
                  <span className="text-lg text-white font-medium">
                    Matt-GPT AI Street<br />
                    Starbase, TX
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Contact Form */}
          <div className="glass-panel p-8 rounded-3xl border border-white/5 relative overflow-hidden">
            <h2 className="text-2xl font-bold mb-8 text-white">
              Send a Message
            </h2>
            <form className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm text-gray-400 ml-1">Your Name</label>
                <input
                  type="text"
                  placeholder="John Doe"
                  className="w-full px-6 py-4 rounded-2xl bg-black/20 border border-white/10 focus:border-primary/50 focus:outline-none focus:bg-black/40 text-white placeholder-gray-600 transition-all font-light"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-gray-400 ml-1">Email Address</label>
                <input
                  type="email"
                  placeholder="john@example.com"
                  className="w-full px-6 py-4 rounded-2xl bg-black/20 border border-white/10 focus:border-primary/50 focus:outline-none focus:bg-black/40 text-white placeholder-gray-600 transition-all font-light"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-gray-400 ml-1">Message</label>
                <textarea
                  placeholder="How can we help you?"
                  rows={4}
                  className="w-full px-6 py-4 rounded-2xl bg-black/20 border border-white/10 focus:border-primary/50 focus:outline-none focus:bg-black/40 text-white placeholder-gray-600 transition-all font-light resize-none"
                ></textarea>
              </div>
              <button
                type="submit"
                className="w-full py-4 bg-gradient-to-r from-primary to-secondary rounded-2xl font-bold text-black text-lg hover:scale-[1.02] transform transition-all duration-300 shadow-[0_0_30px_rgba(0,240,255,0.3)] hover:shadow-[0_0_50px_rgba(0,240,255,0.5)] flex items-center justify-center gap-2"
              >
                Send Message
                <Send className="w-5 h-5" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactUs;