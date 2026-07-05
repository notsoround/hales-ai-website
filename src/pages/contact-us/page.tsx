import { useState } from 'react';
import { Mail, Phone, MapPin, Send, CheckCircle2, AlertCircle } from 'lucide-react';
import './styles.css';
import BackButton from '../../components/BackButton';

const ACTIONS_WEBHOOK = 'https://automate.hales.ai/webhook/cupcake-actions';

const ContactUs = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim() || status === 'sending') return;
    setStatus('sending');
    try {
      const res = await fetch(ACTIONS_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: {
            to: 'matt@hales.ai',
            subject: `hales.ai contact form — ${name.trim()}`,
            body: `New website inquiry\n\nName: ${name.trim()}\nEmail: ${email.trim()}\n\nMessage:\n${message.trim()}`,
          },
          channel: 'web',
          sessionId: `web-contact:${Date.now()}`,
          correlationId: crypto.randomUUID(),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStatus('sent');
      setName('');
      setEmail('');
      setMessage('');
    } catch {
      setStatus('error');
    }
  };

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
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label className="text-sm text-gray-400 ml-1">Your Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full px-6 py-4 rounded-2xl bg-black/20 border border-white/10 focus:border-primary/50 focus:outline-none focus:bg-black/40 text-white placeholder-gray-600 transition-all font-light"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-gray-400 ml-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john@example.com"
                  className="w-full px-6 py-4 rounded-2xl bg-black/20 border border-white/10 focus:border-primary/50 focus:outline-none focus:bg-black/40 text-white placeholder-gray-600 transition-all font-light"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-gray-400 ml-1">Message</label>
                <textarea
                  required
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="How can we help you?"
                  rows={4}
                  className="w-full px-6 py-4 rounded-2xl bg-black/20 border border-white/10 focus:border-primary/50 focus:outline-none focus:bg-black/40 text-white placeholder-gray-600 transition-all font-light resize-none"
                ></textarea>
              </div>
              {status === 'sent' && (
                <div className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  Message sent! Matt will get back to you shortly.
                </div>
              )}
              {status === 'error' && (
                <div className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  Something went wrong — email us directly at matt@hales.ai.
                </div>
              )}
              <button
                type="submit"
                disabled={status === 'sending'}
                className="w-full py-4 bg-gradient-to-r from-primary to-secondary rounded-2xl font-bold text-black text-lg hover:scale-[1.02] transform transition-all duration-300 shadow-[0_0_30px_rgba(0,240,255,0.3)] hover:shadow-[0_0_50px_rgba(0,240,255,0.5)] flex items-center justify-center gap-2 disabled:opacity-60 disabled:hover:scale-100"
              >
                {status === 'sending' ? 'Sending…' : 'Send Message'}
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