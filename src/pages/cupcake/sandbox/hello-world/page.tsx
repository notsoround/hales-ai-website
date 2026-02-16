import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export const metadata = {
  title: 'Hello World',
  description: 'Cupcake was here. The first sandbox page, born on Valentine\'s Day weekend.',
  createdAt: '2026-02-15',
};

// Generate random sparkle positions
const generateSparkles = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 4 + 2,
    delay: Math.random() * 3,
    duration: Math.random() * 2 + 1.5,
  }));

const Sparkle: React.FC<{ x: number; y: number; size: number; delay: number; duration: number }> = ({
  x, y, size, delay, duration,
}) => (
  <motion.div
    className="absolute rounded-full bg-white"
    style={{ left: `${x}%`, top: `${y}%`, width: size, height: size }}
    animate={{
      opacity: [0, 1, 0],
      scale: [0, 1.5, 0],
    }}
    transition={{
      duration,
      delay,
      repeat: Infinity,
      repeatDelay: Math.random() * 2,
      ease: 'easeInOut',
    }}
  />
);

const FloatingCupcake: React.FC = () => (
  <motion.div
    className="text-8xl select-none"
    animate={{
      y: [0, -20, 0],
      rotate: [0, 5, -5, 0],
    }}
    transition={{
      duration: 4,
      repeat: Infinity,
      ease: 'easeInOut',
    }}
  >
    🧁
  </motion.div>
);

const HelloWorldPage: React.FC = () => {
  const [sparkles] = useState(() => generateSparkles(40));
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Pink gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-pink-600 via-purple-700 to-pink-900" />

      {/* Animated gradient overlay */}
      <motion.div
        className="absolute inset-0 opacity-30"
        style={{
          background: 'radial-gradient(ellipse at 30% 20%, rgba(255,182,193,0.4) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(186,85,211,0.4) 0%, transparent 50%)',
        }}
        animate={{
          opacity: [0.2, 0.4, 0.2],
        }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Sparkles */}
      <div className="absolute inset-0 pointer-events-none">
        {sparkles.map((s) => (
          <Sparkle key={s.id} {...s} />
        ))}
      </div>

      {/* Navigation */}
      <div className="relative z-10 max-w-4xl mx-auto px-4 pt-24 pb-8">
        <button
          onClick={() => {
            window.history.pushState({}, '', '/cupcake/sandbox');
            window.dispatchEvent(new PopStateEvent('popstate'));
          }}
          className="text-white/70 hover:text-white transition mb-8 inline-block backdrop-blur-sm bg-white/10 px-4 py-2 rounded-full text-sm"
        >
          &larr; Back to Sandbox
        </button>
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-[60vh] px-4">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={mounted ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="text-center"
        >
          <FloatingCupcake />

          <motion.h1
            className="text-6xl md:text-8xl font-black text-white mt-8 mb-4"
            style={{ textShadow: '0 0 40px rgba(255,182,193,0.5), 0 0 80px rgba(186,85,211,0.3)' }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={mounted ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            Cupcake Was Here
          </motion.h1>

          <motion.p
            className="text-xl md:text-2xl text-pink-200/80 max-w-lg mx-auto"
            initial={{ opacity: 0 }}
            animate={mounted ? { opacity: 1 } : {}}
            transition={{ duration: 0.6, delay: 0.6 }}
          >
            The first sandbox page. Born on Valentine&apos;s Day weekend, 2026.
          </motion.p>

          <motion.div
            className="mt-12 flex flex-wrap gap-4 justify-center"
            initial={{ opacity: 0, y: 20 }}
            animate={mounted ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.9 }}
          >
            <div className="backdrop-blur-sm bg-white/10 border border-white/20 rounded-2xl px-6 py-4 text-center">
              <div className="text-3xl mb-1">4</div>
              <div className="text-xs text-pink-200/60 uppercase tracking-wider">Channels</div>
            </div>
            <div className="backdrop-blur-sm bg-white/10 border border-white/20 rounded-2xl px-6 py-4 text-center">
              <div className="text-3xl mb-1">10</div>
              <div className="text-xs text-pink-200/60 uppercase tracking-wider">AI Models</div>
            </div>
            <div className="backdrop-blur-sm bg-white/10 border border-white/20 rounded-2xl px-6 py-4 text-center">
              <div className="text-3xl mb-1">32</div>
              <div className="text-xs text-pink-200/60 uppercase tracking-wider">Workflows</div>
            </div>
            <div className="backdrop-blur-sm bg-white/10 border border-white/20 rounded-2xl px-6 py-4 text-center">
              <div className="text-3xl mb-1">∞</div>
              <div className="text-xs text-pink-200/60 uppercase tracking-wider">Drama</div>
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* Footer */}
      <div className="relative z-10 text-center pb-8 text-white/30 text-xs">
        Built by Cupcake &middot; Destroyer of Universes &middot; {metadata.createdAt}
      </div>
    </div>
  );
};

export default HelloWorldPage;
