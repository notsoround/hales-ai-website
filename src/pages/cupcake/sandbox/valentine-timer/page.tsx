import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

export const metadata = {
  title: 'Valentine Countdown Timer',
  description: 'Countdown to Valentine\'s Day 2027 with floating hearts and love-themed stats',
  createdAt: '2026-02-15',
};

const ValentineTimer: React.FC = () => {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });

  const calculateTimeLeft = () => {
    const targetDate = new Date('2027-02-14T00:00:00');
    const now = new Date();
    const difference = targetDate.getTime() - now.getTime();

    const days = Math.floor(difference / (1000 * 60 * 60 * 24));
    const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((difference % (1000 * 60)) / 1000);

    setTimeLeft({ days, hours, minutes, seconds });
  };

  useEffect(() => {
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, []);

  const hearts = useRef(Array.from({ length: 30 }).map(() => ({
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    size: Math.random() * 20 + 10,
    duration: Math.random() * 5 + 3
  })));

  return (
    <div className="min-h-screen bg-[#0a0f16] text-white overflow-hidden">
      <div className="max-w-4xl mx-auto px-4 pt-24 pb-8">
        <button onClick={() => { window.history.pushState({}, '', '/cupcake/sandbox'); window.dispatchEvent(new PopStateEvent('popstate')); }} className="text-pink-400 hover:text-pink-300 transition mb-8 inline-block">&larr; Back to Sandbox</button>
        <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-400 via-pink-500 to-purple-500 mb-4">{metadata.title}</h1>
        <p className="text-pink-400/60 text-sm">{metadata.description}</p>
        <div className="h-px bg-gradient-to-r from-pink-500/50 via-purple-500/50 to-transparent my-8" />
      </div>
      <div className="max-w-4xl mx-auto px-4 pb-24">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
          <StatCard label="Days" value={timeLeft.days} />
          <StatCard label="Hours" value={timeLeft.hours} />
          <StatCard label="Minutes" value={timeLeft.minutes} />
          <StatCard label="Seconds" value={timeLeft.seconds} />
        </div>
      </div>
      {hearts.current.map((heart, i) => (
        <motion.div
          key={i}
          className="absolute text-pink-500"
          style={{ left: heart.x, top: heart.y, fontSize: heart.size }}
          initial={{ y: -100 }}
          animate={{ y: window.innerHeight }}
          transition={{ duration: heart.duration, repeat: Infinity, ease: 'linear' }}
        >
          ❤️
        </motion.div>
      ))}
      <div className="max-w-4xl mx-auto px-4 pb-8 text-center text-pink-400/20 text-xs">Built by Cupcake · {metadata.createdAt}</div>
    </div>
  );
};

const StatCard: React.FC<{ label: string, value: number }> = ({ label, value }) => {
  return (
    <div className="bg-pink-900/20 rounded-lg p-6 text-center">
      <div className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-400 to-purple-500">{value}</div>
      <div className="text-pink-400/60 text-sm mt-2">{label}</div>
    </div>
  );
};

export default ValentineTimer;