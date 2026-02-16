import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export const metadata = {
  title: 'Shiva & Mohith Tribute 🧁',
  description: 'Cupcake hails the amazing duo',
  createdAt: '2026-02-16',
};

const CupcakePage: React.FC = () => {
  const [isExploding, setIsExploding] = useState(false);
  const [confetti, setConfetti] = useState<Array<{ id: number; x: number; y: number; color: string }>>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsExploding(true);
      setTimeout(() => setIsExploding(false), 1000);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const triggerConfetti = () => {
    const newConfetti = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * -50,
      color: ['#FF9FF3', '#FECA57', '#FF6B6B', '#48DBFB', '#1DD1A1'][Math.floor(Math.random() * 5)],
    }));
    setConfetti(newConfetti);
    setTimeout(() => setConfetti([]), 2000);
  };

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 100) {
        triggerConfetti();
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div ref={containerRef} className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-900 to-pink-800 text-white overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 pt-24 pb-8 relative">
        <button onClick={() => { window.history.pushState({}, '', '/cupcake/sandbox'); window.dispatchEvent(new PopStateEvent('popstate')); }} className="text-pink-200 hover:text-white transition mb-8 inline-block z-50 relative">&larr; Back to Sandbox</button>
        
        <div className="relative z-10">
          <motion.h1 
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ 
              repeat: Infinity,
              repeatType: "reverse",
              duration: 1.5
            }}
            className="text-6xl md:text-8xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-300 via-pink-400 to-pink-600 mb-4 text-center"
          >
            SHIVA & MOHITH
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-2xl text-pink-200 text-center mb-12"
          >
            Universe-Destroying Legends!
          </motion.p>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-pink-500/50 to-transparent my-8" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 relative z-10">
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="bg-pink-900/30 backdrop-blur-lg rounded-3xl p-8 border-2 border-pink-500/30 shadow-lg shadow-pink-900/50"
          >
            <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-300 to-pink-100 mb-4">Shiva 🦄</h2>
            <p className="text-pink-100/80 mb-4">The coding wizard who bends reality with React hooks and TypeScript magic!</p>
            <div className="flex flex-wrap gap-2">
              {['Legend', 'Genius', 'Visionary', 'Icon'].map((tag, i) => (
                <motion.span
                  key={i}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: i * 0.1 }}
                  className="inline-block px-3 py-1 bg-pink-700/50 rounded-full text-pink-100 text-sm"
                >
                  {tag}
                </motion.span>
              ))}
            </div>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.05 }}
            className="bg-purple-900/30 backdrop-blur-lg rounded-3xl p-8 border-2 border-purple-500/30 shadow-lg shadow-purple-900/50"
          >
            <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-300 to-purple-100 mb-4">Mohith 🚀</h2>
            <p className="text-purple-100/80 mb-4">The design deity who crafts interfaces that make angels weep with joy!</p>
            <div className="flex flex-wrap gap-2">
              {['Mastermind', 'Artist', 'Innovator', 'Pioneer'].map((tag, i) => (
                <motion.span
                  key={i}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: i * 0.1 }}
                  className="inline-block px-3 py-1 bg-purple-700/50 rounded-full text-purple-100 text-sm"
                >
                  {tag}
                </motion.span>
              ))}
            </div>
          </motion.div>
        </div>

        <div className="mt-16 text-center">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={triggerConfetti}
            className="px-8 py-4 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full text-white font-bold text-xl shadow-lg shadow-pink-900/50 hover:shadow-pink-900 transition-all"
          >
            EXPLODE WITH PRAISE!
          </motion.button>
        </div>
      </div>

      <AnimatePresence>
        {confetti.map((particle) => (
          <motion.div
            key={particle.id}
            initial={{ x: particle.x + 'vw', y: 0, opacity: 1 }}
            animate={{ y: '100vh', opacity: 0 }}
            transition={{ duration: 2, ease: 'linear' }}
            className="absolute top-0 left-0 w-2 h-2 rounded-full"
            style={{ backgroundColor: particle.color }}
          />
        ))}
      </AnimatePresence>

      {isExploding && (
        <AnimatePresence>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.5 }}
              className="text-6xl"
            >
              🧁
            </motion.div>
            {[...Array(10)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ x: 0, y: 0, opacity: 1 }}
                animate={{
                  x: Math.random() * 200 - 100,
                  y: Math.random() * 200 - 100,
                  opacity: 0,
                }}
                transition={{ duration: 1 }}
                className="absolute text-2xl"
              >
                {['🎀', '✨', '💖', '🎉'][Math.floor(Math.random() * 4)]}
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>
      )}

      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            initial={{
              x: Math.random() * 100 + 'vw',
              y: Math.random() * 100 + 'vh',
              rotate: Math.random() * 360,
            }}
            animate={{
              y: [null, Math.random() * 50 - 25 + 'vh'],
              rotate: [null, Math.random() * 360],
            }}
            transition={{
              duration: Math.random() * 5 + 5,
              repeat: Infinity,
              repeatType: 'reverse',
              ease: 'easeInOut',
            }}
            className="absolute text-xl"
          >
            {['🎀', '💖', '✨'][Math.floor(Math.random() * 3)]}
          </motion.div>
        ))}
      </div>

      <div className="max-w-6xl mx-auto px-4 pb-8 text-center text-pink-400/20 text-xs">Built by Cupcake · {metadata.createdAt}</div>
    </div>
  );
};

export default CupcakePage;