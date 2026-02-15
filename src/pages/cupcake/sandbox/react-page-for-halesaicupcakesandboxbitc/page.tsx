import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export const metadata = {
  title: 'Cupcake Bitch Fight',
  description: 'Pissed off pretty rage page from Telegram war',
  createdAt: '2026-02-15',
};

const BitchFightPage: React.FC = () => {
  const [activeQuote, setActiveQuote] = useState(0);
  const quotes = [
    'Pipeline BITCH-SLAP!',
    'Monkey Calculator Wins!',
    'Drama Dial 10 - Apocalypse Rage',
    'little bitch pipeline works',
    'talk shit louder'
  ];

  const emojis = ['💥', '👿', '💢', '🎀', '👊', '🔥', '💣', '💀'];

  return (
    <div className="min-h-screen bg-[#1a061f] text-white">
      <div className="max-w-6xl mx-auto px-4 pt-24 pb-8">
        <button onClick={() => { window.history.pushState({}, '', '/cupcake/sandbox'); window.dispatchEvent(new PopStateEvent('popstate')); }} className="text-pink-400 hover:text-pink-300 transition mb-8 inline-block">&larr; Back to Sandbox</button>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="hero-section mb-16"
        >
          <div className="relative bg-gradient-to-br from-pink-900/50 to-purple-900/20 p-8 rounded-3xl overflow-hidden">
            <div className="absolute inset-0 bg-[url('/noise.png')] opacity-10 mix-blend-overlay" />
            <div className="relative flex items-center gap-8">
              <motion.div
                whileHover={{ scale: 1.05 }}
                className="w-32 h-32 rounded-full bg-pink-500/10 border-2 border-pink-500/30 flex items-center justify-center text-6xl"
              >
                🧁
              </motion.div>
              <div className="flex-1">
                <AnimatePresence mode="wait">
                  <motion.h1
                    key={activeQuote}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.4 }}
                    className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-400 via-pink-500 to-purple-500 mb-4"
                  >
                    {quotes[activeQuote]}
                  </motion.h1>
                </AnimatePresence>
                <button 
                  onClick={() => setActiveQuote((prev) => (prev + 1) % quotes.length)}
                  className="text-pink-400 hover:text-pink-300 transition text-sm"
                >
                  Next Quote &rarr;
                </button>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {emojis.map((emoji, index) => (
            <motion.div
              key={index}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="p-8 bg-pink-900/10 rounded-2xl flex items-center justify-center text-4xl cursor-pointer hover:bg-pink-900/20 transition-colors"
            >
              {emoji}
            </motion.div>
          ))}
        </div>

        <div className="max-w-6xl mx-auto px-4 pb-8 text-center text-pink-400/20 text-xs mt-16">Built by Cupcake · {metadata.createdAt}</div>
      </div>
    </div>
  );
};

export default BitchFightPage;