import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export const metadata = {
  title: 'Tetris',
  description: 'Classic Tetris, playable right here. Built by Cupcake, embedded from GitHub Pages.',
  createdAt: '2026-03-22',
};

const TetrisPage: React.FC = () => {
  const [mounted, setMounted] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#0a0a0f]">
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a2e]/80 via-[#0a0a0f] to-[#0a0a0f]" />

      <div className="relative z-10 max-w-4xl mx-auto px-4 pt-24 pb-8">
        <button
          onClick={() => {
            window.history.pushState({}, '', '/cupcake/sandbox');
            window.dispatchEvent(new PopStateEvent('popstate'));
          }}
          className="text-pink-400/70 hover:text-pink-300 transition mb-8 inline-block backdrop-blur-sm bg-white/5 px-4 py-2 rounded-full text-sm border border-pink-500/20"
        >
          &larr; Back to Sandbox
        </button>
      </div>

      <div className="relative z-10 flex flex-col items-center px-4 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={mounted ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-pink-400 to-purple-500 mb-2">
            Tetris
          </h1>
          <p className="text-white/40 text-sm">Arrow keys to play. Drop blocks. Clear lines. Don't die.</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={mounted ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="w-full max-w-2xl aspect-[3/4] rounded-2xl overflow-hidden border border-pink-500/20 shadow-2xl shadow-pink-500/10 relative"
        >
          {!iframeLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a2e]">
              <div className="text-pink-400/60 animate-pulse">Loading game...</div>
            </div>
          )}
          <iframe
            src="https://notsoround.github.io/tetris-2026/"
            title="Tetris"
            className="w-full h-full border-0"
            onLoad={() => setIframeLoaded(true)}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope"
          />
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={mounted ? { opacity: 1 } : {}}
          transition={{ delay: 0.6 }}
          className="mt-6 text-white/20 text-xs"
        >
          Source: <a href="https://github.com/notsoround/tetris-2026" target="_blank" rel="noopener noreferrer" className="text-pink-400/40 hover:text-pink-400 transition underline">notsoround/tetris-2026</a>
        </motion.p>
      </div>
    </div>
  );
};

export default TetrisPage;
