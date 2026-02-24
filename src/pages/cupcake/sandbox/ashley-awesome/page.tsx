import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export const metadata = {
  title: 'Ashley is freaking awesome',
  description: 'A cosmic celebration of the most amazing person in the universe',
  createdAt: '2026-02-24',
};

const AshleyAwesome: React.FC = () => {
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; size: number; speed: number; color: string }>>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const generateParticles = () => {
      if (!containerRef.current) return;
      const { width, height } = containerRef.current.getBoundingClientRect();
      const particleCount = 50;
      const newParticles = Array.from({ length: particleCount }, (_, i) => ({
        id: i,
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 5 + 2,
        speed: Math.random() * 2 + 0.5,
        color: Math.random() > 0.5 ? 'bg-pink-500' : 'bg-yellow-400',
      }));
      setParticles(newParticles);
    };

    generateParticles();
    window.addEventListener('resize', generateParticles);
    return () => window.removeEventListener('resize', generateParticles);
  }, []);

  useEffect(() => {
    const moveParticles = () => {
      setParticles(prev => prev.map(p => ({
        ...p,
        y: (p.y + p.speed) % (containerRef.current?.clientHeight || window.innerHeight),
      })));
    };

    const interval = setInterval(moveParticles, 50);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-800 to-amber-900 text-white overflow-hidden" ref={containerRef}>
      <div className="max-w-4xl mx-auto px-4 pt-24 pb-8 relative z-10">
        <button onClick={() => { window.history.pushState({}, '', '/cupcake/sandbox'); window.dispatchEvent(new PopStateEvent('popstate')); }} className="text-pink-200 hover:text-white transition mb-8 inline-block backdrop-blur-sm bg-white/10 px-4 py-2 rounded-full">&larr; Back to Sandbox</button>
        
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-6xl md:text-8xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-300 via-yellow-200 to-pink-400 mb-6 leading-tight"
        >
          Ashley is freaking <span className="text-shadow-glow">awesome</span>
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.8 }}
          className="text-pink-200/80 text-xl mb-12"
        >
          A cosmic celebration of the most amazing person in the universe
        </motion.p>

        <div className="h-px bg-gradient-to-r from-transparent via-pink-400/50 to-transparent my-12" />

        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.8 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16"
        >
          {['Awesome', 'Brilliant', 'Incredible'].map((word, i) => (
            <div key={i} className="bg-gradient-to-br from-pink-500/20 to-yellow-500/20 backdrop-blur-sm p-6 rounded-2xl border border-pink-400/30">
              <motion.div 
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
                className="text-4xl font-bold text-yellow-300 mb-4"
              >
                {word}
              </motion.div>
              <p className="text-pink-200/80">
                Because Ashley is {word.toLowerCase()} in every possible way!
              </p>
            </div>
          ))}
        </motion.div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9, duration: 0.8 }}
          className="relative"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-pink-500/10 to-yellow-500/10 rounded-2xl blur-xl"></div>
          <div className="relative bg-gradient-to-br from-pink-900/50 to-yellow-900/50 backdrop-blur-sm p-8 rounded-2xl border border-pink-400/30">
            <h2 className="text-3xl font-bold text-yellow-200 mb-4">Why Ashley Rules</h2>
            <ul className="space-y-4">
              {[
                'She&apos;s got the best personality in the galaxy',
                'Her smile could power a small city',
                'She makes everything 10x better just by being there',
                'She&apos;s the human equivalent of a golden retriever puppy',
                'Her awesomeness defies all known laws of physics'
              ].map((item, i) => (
                <motion.li 
                  key={i}
                  whileHover={{ scale: 1.02, x: 10 }}
                  className="flex items-start gap-3 text-pink-200"
                >
                  <span className="text-yellow-400 text-xl">✧</span> {item}
                </motion.li>
              ))}
            </ul>
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {particles.map(particle => (
          <motion.div
            key={particle.id}
            initial={{ opacity: 0, y: particle.y }}
            animate={{ 
              opacity: [0, 0.8, 0],
              y: particle.y,
              x: particle.x + Math.sin(Date.now() * 0.001 * particle.speed) * 20
            }}
            transition={{ 
              duration: 10 + particle.speed * 5,
              repeat: Infinity,
              repeatType: 'loop'
            }}
            className={`absolute rounded-full ${particle.color} shadow-lg shadow-pink-500/50`}
            style={{
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              left: `${particle.x}px`,
              top: `${particle.y}px`,
            }}
          />
        ))}
      </AnimatePresence>

      <div className="max-w-4xl mx-auto px-4 pb-8 text-center text-pink-200/30 text-xs relative z-10">Built by Cupcake · {metadata.createdAt}</div>
    </div>
  );
};

export default AshleyAwesome;