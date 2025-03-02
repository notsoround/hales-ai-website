import React from 'react';
import { Mail, Phone, MapPin } from 'lucide-react';
import './styles.css';
import BackButton from '../../components/BackButton';

const ContactUs = () => {
  return (
    <div className="contact-us-container">
      <BackButton />
      
      <h1 className="text-4xl font-bold text-center mb-8 bg-clip-text text-transparent bg-gradient-to-r from-[#00e6e6] via-[#00ccff] via-[#4d4dff] to-[#1a1aff] animate-gradient">
        Contact Us
      </h1>
      <div className="max-w-4xl mx-auto px-4">
        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-gradient-to-br from-[#0a1a2b]/50 to-[#0a0f16]/50 border border-[#00e6e6]/10 rounded-2xl p-8 backdrop-blur-sm">
            <h2 className="text-2xl font-semibold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-[#00e6e6] via-[#00ccff] via-[#4d4dff] to-[#1a1aff] animate-gradient">
              Get in Touch
            </h2>
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <Mail className="w-5 h-5 text-[#00e6e6]" />
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#00e6e6] via-[#00ccff] via-[#4d4dff] to-[#1a1aff] animate-gradient-slow">
                  info@halesai.com
                </span>
              </div>
              <div className="flex items-center space-x-3">
                <Phone className="w-5 h-5 text-[#00e6e6]" />
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#00e6e6] via-[#00ccff] via-[#4d4dff] to-[#1a1aff] animate-gradient-slow">
                  +1 (555) 123-4567
                </span>
              </div>
              <div className="flex items-center space-x-3">
                <MapPin className="w-5 h-5 text-[#00e6e6]" />
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#00e6e6] via-[#00ccff] via-[#4d4dff] to-[#1a1aff] animate-gradient-slow">
                  123 AI Street, Tech City, TC 12345
                </span>
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-[#0a1a2b]/50 to-[#0a0f16]/50 border border-[#00e6e6]/10 rounded-2xl p-8 backdrop-blur-sm">
            <h2 className="text-2xl font-semibold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-[#00e6e6] via-[#00ccff] via-[#4d4dff] to-[#1a1aff] animate-gradient">
              Send us a Message
            </h2>
            <form className="space-y-4">
              <div>
                <input
                  type="text"
                  placeholder="Name"
                  className="w-full px-4 py-2 rounded-lg bg-[#0a1a2b]/30 border border-[#00e6e6]/20 focus:border-[#00e6e6]/50 focus:outline-none text-white placeholder-[#00e6e6]/50"
                />
              </div>
              <div>
                <input
                  type="email"
                  placeholder="Email"
                  className="w-full px-4 py-2 rounded-lg bg-[#0a1a2b]/30 border border-[#00e6e6]/20 focus:border-[#00e6e6]/50 focus:outline-none text-white placeholder-[#00e6e6]/50"
                />
              </div>
              <div>
                <textarea
                  placeholder="Message"
                  rows={4}
                  className="w-full px-4 py-2 rounded-lg bg-[#0a1a2b]/30 border border-[#00e6e6]/20 focus:border-[#00e6e6]/50 focus:outline-none text-white placeholder-[#00e6e6]/50"
                ></textarea>
              </div>
              <button
                type="submit"
                className="w-full px-6 py-3 bg-gradient-to-r from-[#00e6e6] via-[#00ccff] via-[#4d4dff] to-[#1a1aff] rounded-lg font-semibold hover:opacity-90 transition animate-gradient"
              >
                Send Message
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactUs;