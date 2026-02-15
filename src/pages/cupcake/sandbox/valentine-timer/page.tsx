import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

export const metadata = {
  title: 'Valentine Countdown',
  description: 'Countdown to Valentine\'s Day 2027 with floating hearts and love stats',
  createdAt: '2026-02-15',
};

const ValentineTimer: React.FC = () => {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });
  const [hearts, setHearts] = useState<Array<{id: number, x: number, y: number, size: number, opacity: number}>>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const calculateTimeLeft = () => {
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

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const generateHearts = () => {
      if (!containerRef.current) return;
      const containerWidth = containerRef.current.offsetWidth;
      const containerHeight = containerRef.current.offsetHeight;
      
      const newHearts = Array.from({ length: 15 }, (_, i) => ({
        id: i,
        x: Math.random() * containerWidth,
        y: Math.random() * containerHeight,
        size: Math.random() * 20 + 10,
        opacity: Math.random() * 0.5 + 0.3
      }));
      
      setHearts(newHearts);
    };

    generateHearts();
    window.addEventListener('resize', generateHearts);
    return () => window.removeEventListener('resize', generateHearts);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a0b2e] to-[#3a0a49] text-white overflow-hidden" ref={containerRef}>
      <div className="max-w-4xl mx-auto px-4 pt-24 pb-8 relative z-10">
        <button onClick={() => { window.history.pushState({}, '', '/cupcake/sandbox'); window.dispatchEvent(new PopStateEvent('popstate')); }} className="text-pink-400 hover:text-pink-300 transition mb-8 inline-block">&larr; Back to Sandbox</button>
        <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-400 via-pink-500 to-purple-500 mb-4">{metadata.title}</h1>
        <p className="text-pink-400/60 text-sm">{metadata.description}</p>
        <div className="h-px bg-gradient-to-r from-pink-500/50 via-purple-500/50 to-transparent my-8" />
      </div>
      
      <div className="max-w-4xl mx-auto px-4 pb-24 relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-pink-900/30 backdrop-blur-sm rounded-xl p-6 border border-pink-500/20"
          >
            <div className="text-5xl font-bold text-pink-400 mb-2">{timeLeft.days}</div>
            <div className="text-pink-300/70 text-sm">Days</div>
          </motion.div>
          
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="bg-pink-900/30 backdrop-blur-sm rounded-xl p-6 border border-pink-500/20"
          >
            <div className="text-5xl font-bold text-pink-400 mb-2">{timeLeft.hours}</div>
            <div className="text-pink-300/70 text-sm">Hours</div>
          </motion.div>
          
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="bg-pink-900/30 backdrop-blur-sm rounded-xl p-6 border border-pink-500/20"
          >
            <div className="text-5xl font-bold text-pink-400 mb-2">{timeLeft.minutes}</div>
            <div className="text-pink-300/70 text-sm">Minutes</div>
          </motion.div>
          
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="bg-pink-900/30 backdrop-blur-sm rounded-xl p-6 border border-pink-500/20"
          >
            <div className="text-5xl font-bold text-pink-400 mb-2">{timeLeft.seconds}</div>
            <div className="text-pink-300/70 text-sm">Seconds</div>
          </motion.div>
        </div>
        
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 1 }}
          className="text-center"
        >
          <h2 className="text-2xl font-medium text-pink-300 mb-2">Until Valentine's Day 2027</h2>
          <p className="text-pink-400/60">Spread love every day ❤️</p>
        </motion.div>
      </div>
      
      {hearts.map((heart) => (
        <motion.div
          key={heart.id}
          initial={{ x: heart.x, y: heart.y, opacity: 0 }}
          animate={{ 
            y: heart.y - 100,
            opacity: [0, heart.opacity, 0],
            x: heart.x + (Math.random() * 40 - 20)
          }}
          transition={{
            duration: Math.random() * 10 + 10,
            repeat: Infinity,
            repeatDelay: Math.random() * 5,
            ease: "linear"
          }}
          className="absolute text-pink-400"
          style={{
            fontSize: `${heart.size}px`,
          }}
        >
          ❤️
        </motion.div>
      ))}
      
      <div className="max-w-4xl mx-auto px-4 pb-8 text-center text-pink-400/20 text-xs">Built by Cupcake · {metadata.createdAt}</div>
    </div>
  );
};

export default ValentineTimer;