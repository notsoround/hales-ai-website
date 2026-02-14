import React from 'react';
import { motion } from 'framer-motion';

const CupcakeTest = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #ff69b4 0%, #ff1493 30%, #c71585 60%, #0a0f16 100%)' }}
    >
      {/* Floating cupcakes background */}
      {[...Array(12)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute text-4xl select-none pointer-events-none"
          initial={{
            x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1000),
            y: -50,
            rotate: 0,
            opacity: 0.6,
          }}
          animate={{
            y: typeof window !== 'undefined' ? window.innerHeight + 100 : 1100,
            rotate: 360,
            opacity: [0.6, 0.8, 0.4],
          }}
          transition={{
            duration: 8 + Math.random() * 6,
            repeat: Infinity,
            delay: Math.random() * 5,
            ease: 'linear',
          }}
        >
          🧁
        </motion.div>
      ))}

      {/* Glowing orb */}
      <div className="absolute w-[500px] h-[500px] bg-gradient-to-r from-pink-400 via-pink-500 to-fuchsia-600 rounded-full filter blur-[120px] opacity-30 animate-pulse" />

      {/* Main content */}
      <motion.div
        className="relative z-10 text-center px-6 max-w-2xl"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      >
        {/* Avatar */}
        <motion.div
          className="text-8xl mb-6"
          animate={{ rotate: [0, -5, 5, -5, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          🧁
        </motion.div>

        {/* Title */}
        <h1 className="text-5xl md:text-7xl font-black text-white mb-4 tracking-tight"
          style={{ textShadow: '0 0 40px rgba(255, 105, 180, 0.8), 0 0 80px rgba(255, 20, 147, 0.4)' }}
        >
          Cupcake owns this site now.
        </h1>

        {/* Subtitle */}
        <motion.p
          className="text-xl md:text-2xl text-pink-100 mb-10 font-medium"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.6 }}
        >
          Pink bows, zero bullshit. What universe you wanna wreck today?
        </motion.p>

        {/* CTA Button */}
        <motion.a
          href="https://t.me/CupcakeApocalypseBot"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-3 px-10 py-5 bg-white text-pink-600 font-bold text-xl rounded-full shadow-2xl hover:shadow-pink-500/50 transition-all duration-300 hover:scale-105 active:scale-95"
          whileHover={{ scale: 1.05, boxShadow: '0 0 60px rgba(255, 105, 180, 0.6)' }}
          whileTap={{ scale: 0.95 }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
        >
          <span>Talk to Cupcake</span>
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
          </svg>
        </motion.a>

        {/* Built by line */}
        <motion.p
          className="mt-12 text-pink-200/60 text-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.5 }}
        >
          Built by{' '}
          <a href="https://hales.ai" className="text-pink-200 hover:text-white underline transition-colors">
            Hales AI
          </a>
          {' '}— Powered by OpenClaw + Claude + DeepSeek
        </motion.p>
      </motion.div>
    </div>
  );
};

export default CupcakeTest;
