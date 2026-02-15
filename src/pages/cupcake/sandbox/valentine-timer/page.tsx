import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

export const metadata = {
  title: 'Valentine Countdown',
  description: 'Animated countdown to Valentine\'s Day 2027 with floating hearts and love stats',
  createdAt: '2026-02-15',
};

const ValentineTimer: React.FC = () => {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });
  const [hearts, setHearts] = useState<Array<{ id: number; x: number; y: number; size: number; opacity: number; delay: number }>>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Generate initial hearts
    const initialHearts = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 20 + 10,
      opacity: Math.random() * 0.5 + 0.3,
      delay: Math.random() * 5
    }));
    setHearts(initialHearts);

    // Update countdown
    const updateCountdown = () => {
      const now = new Date();
      const nextValentine = new Date(now.getFullYear() + 1, 1, 14);
      if (now.getMonth() > 1 || (now.getMonth() === 1 && now.getDate() > 14)) {
        nextValentine.setFullYear(nextValentine.getFullYear() + 1);
      }

      const diff = nextValentine.getTime() - now.getTime();
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft({ days, hours, minutes, seconds });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, []);

  const addHeart = () => {
    if (containerRef.current) {
      const newHeart = {
        id: Date.now(),
        x: Math.random() * 100,
        y: 0,
        size: Math.random() * 20 + 10,
        opacity: Math.random() * 0.5 + 0.3,
        delay: 0
      };
      setHearts(prev => [...prev, newHeart]);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a0b2e] to-[#0a0f16] text-white overflow-hidden" ref={containerRef}>
      <div className="max-w-4xl mx-auto px-4 pt-24 pb-8 relative">
        <button onClick={() => { window.history.pushState({}, '', '/cupcake/sandbox'); window.dispatchEvent(new PopStateEvent('popstate')); }} className="text-pink-400 hover:text-pink-300 transition mb-8 inline-block">&larr; Back to Sandbox</button>
        <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-400 via-pink-500 to-purple-500 mb-4">{metadata.title}</h1>
        <p className="text-pink-400/60 text-sm">{metadata.description}</p>
        <div className="h-px bg-gradient-to-r from-pink-500/50 via-purple-500/50 to-transparent my-8" />
      </div>

      <div className="max-w-4xl mx-auto px-4 pb-24">
        <div className="relative h-96 mb-16 overflow-hidden rounded-xl bg-gradient-to-br from-pink-900/20 to-purple-900/20 border border-pink-800/30 backdrop-blur-sm">
          {hearts.map(heart => (
            <motion.div
              key={heart.id}
              className="absolute text-pink-400"
              style={{
                left: `${heart.x}%`,
                top: `${heart.y}%`,
                fontSize: `${heart.size}px`,
                opacity: heart.opacity
              }}
              initial={{ y: -50 }}
              animate={{ y: '100vh' }}
              transition={{
                duration: 10 + Math.random() * 10,
                delay: heart.delay,
                repeat: Infinity,
                repeatDelay: Math.random() * 5
              }}
              onAnimationComplete={addHeart}
            >
              ❤️
            </motion.div>
          ))}

          <div className="absolute inset-0 flex flex-col items-center justify-center p-8">
            <h2 className="text-2xl font-medium text-pink-300 mb-6">Countdown to Valentine's Day 2027</h2>
            <div className="grid grid-cols-4 gap-4 w-full max-w-2xl">
              {Object.entries(timeLeft).map(([unit, value]) => (
                <motion.div 
                  key={unit}
                  className="bg-gradient-to-br from-pink-900/40 to-purple-900/40 rounded-lg p-4 text-center border border-pink-800/30"
                  whileHover={{ scale: 1.05 }}
                >
                  <div className="text-4xl font-bold text-pink-300 mb-1">{value}</div>
                  <div className="text-xs uppercase tracking-wider text-pink-400/60">{unit}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <motion.div 
            className="bg-gradient-to-br from-pink-900/20 to-purple-900/20 rounded-xl p-6 border border-pink-800/30 backdrop-blur-sm"
            whileHover={{ y: -5 }}
          >
            <div className="text-5xl font-bold text-pink-400 mb-2">143M</div>
            <div className="text-pink-300/80">Valentine's Cards Exchanged</div>
          </motion.div>

          <motion.div 
            className="bg-gradient-to-br from-pink-900/20 to-purple-900/20 rounded-xl p-6 border border-pink-800/30 backdrop-blur-sm"
            whileHover={{ y: -5 }}
          >
            <div className="text-5xl font-bold text-pink-400 mb-2">58%</div>
            <div className="text-pink-300/80">People Who Celebrate</div>
          </motion.div>

          <motion.div 
            className="bg-gradient-to-br from-pink-900/20 to-purple-900/20 rounded-xl p-6 border border-pink-800/30 backdrop-blur-sm"
            whileHover={{ y: -5 }}
          >
            <div className="text-5xl font-bold text-pink-400 mb-2">$25B</div>
            <div className="text-pink-300/80">Spent on Valentine's</div>
          </motion.div>

          <motion.div 
            className="bg-gradient-to-br from-pink-900/20 to-purple-900/20 rounded-xl p-6 border border-pink-800/30 backdrop-blur-sm"
            whileHover={{ y: -5 }}
          >
            <div className="text-5xl font-bold text-pink-400 mb-2">6M</div>
            <div className="text-pink-300/80">Marriage Proposals</div>
          </motion.div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 pb-8 text-center text-pink-400/20 text-xs">Built by Cupcake · {metadata.createdAt}</div>
    </div>
  );
};

export default ValentineTimer;