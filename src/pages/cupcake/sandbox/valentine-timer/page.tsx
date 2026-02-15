import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export const metadata = {
  title: 'Valentine Countdown',
  description: 'Countdown to the next Valentine\'s Day with floating hearts and love stats',
  createdAt: '2026-02-15',
};

const ValentineTimer: React.FC = () => {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });

  const [hearts, setHearts] = useState<Array<{id: number, x: number, y: number, size: number, delay: number}>>([]);

  useEffect(() => {
    // Generate random hearts
    const generateHearts = () => {
      const newHearts = [];
      for (let i = 0; i < 30; i++) {
        newHearts.push({
          id: i,
          x: Math.random() * 100,
          y: Math.random() * 100,
          size: Math.random() * 20 + 10,
          delay: Math.random() * 5
        });
      }
      setHearts(newHearts);
    };

    generateHearts();

    // Calculate time until next Valentine's Day
    const calculateTimeLeft = () => {
      const now = new Date();
      let nextValentine = new Date(now.getFullYear(), 1, 14);
      
      if (now > nextValentine) {
        nextValentine = new Date(now.getFullYear() + 1, 1, 14);
      }

      const difference = nextValentine.getTime() - now.getTime();
      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((difference / 1000 / 60) % 60);
      const seconds = Math.floor((difference / 1000) % 60);

      setTimeLeft({ days, hours, minutes, seconds });
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a0b2e] to-[#0a0f16] text-white overflow-hidden">
      <div className="max-w-4xl mx-auto px-4 pt-24 pb-8 relative">
        <button 
          onClick={() => { 
            window.history.pushState({}, '', '/cupcake/sandbox'); 
            window.dispatchEvent(new PopStateEvent('popstate')); 
          }} 
          className="text-pink-400 hover:text-pink-300 transition mb-8 inline-block"
        >
          &larr; Back to Sandbox
        </button>
        
        <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-400 via-pink-500 to-purple-500 mb-4">
          {metadata.title}
        </h1>
        <p className="text-pink-400/60 text-sm">{metadata.description}</p>
        <div className="h-px bg-gradient-to-r from-pink-500/50 via-purple-500/50 to-transparent my-8" />
      </div>

      <div className="max-w-4xl mx-auto px-4 pb-24 relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-2xl font-semibold text-pink-300 mb-6">Next Valentine's Day</h2>
          <div className="grid grid-cols-4 gap-4 max-w-2xl mx-auto">
            <motion.div 
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ repeat: Infinity, repeatType: "reverse", duration: 1.5 }}
              className="bg-gradient-to-br from-pink-500/20 to-purple-600/20 p-6 rounded-xl backdrop-blur-sm border border-pink-500/20"
            >
              <div className="text-5xl font-bold text-pink-400">{timeLeft.days}</div>
              <div className="text-sm text-pink-300/80">Days</div>
            </motion.div>
            <motion.div 
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ repeat: Infinity, repeatType: "reverse", duration: 1.5, delay: 0.2 }}
              className="bg-gradient-to-br from-pink-500/20 to-purple-600/20 p-6 rounded-xl backdrop-blur-sm border border-pink-500/20"
            >
              <div className="text-5xl font-bold text-pink-400">{timeLeft.hours}</div>
              <div className="text-sm text-pink-300/80">Hours</div>
            </motion.div>
            <motion.div 
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ repeat: Infinity, repeatType: "reverse", duration: 1.5, delay: 0.4 }}
              className="bg-gradient-to-br from-pink-500/20 to-purple-600/20 p-6 rounded-xl backdrop-blur-sm border border-pink-500/20"
            >
              <div className="text-5xl font-bold text-pink-400">{timeLeft.minutes}</div>
              <div className="text-sm text-pink-300/80">Minutes</div>
            </motion.div>
            <motion.div 
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ repeat: Infinity, repeatType: "reverse", duration: 1.5, delay: 0.6 }}
              className="bg-gradient-to-br from-pink-500/20 to-purple-600/20 p-6 rounded-xl backdrop-blur-sm border border-pink-500/20"
            >
              <div className="text-5xl font-bold text-pink-400">{timeLeft.seconds}</div>
              <div className="text-sm text-pink-300/80">Seconds</div>
            </motion.div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          <div className="bg-gradient-to-br from-pink-500/10 to-purple-600/10 p-6 rounded-xl backdrop-blur-sm border border-pink-500/20">
            <h3 className="text-xl font-semibold text-pink-300 mb-2">Global Love Stats</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-pink-200/80">Cards Sent</span>
                <span className="font-mono">145M+</span>
              </div>
              <div className="flex justify-between">
                <span className="text-pink-200/80">Roses Given</span>
                <span className="font-mono">250M+</span>
              </div>
              <div className="flex justify-between">
                <span className="text-pink-200/80">Chocolate Sales</span>
                <span className="font-mono">$1.8B+</span>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-pink-500/10 to-purple-600/10 p-6 rounded-xl backdrop-blur-sm border border-pink-500/20">
            <h3 className="text-xl font-semibold text-pink-300 mb-2">Romantic Facts</h3>
            <ul className="space-y-2 text-sm text-pink-200/80">
              <li>• 6M+ proposals happen on V-Day</li>
              <li>• Teachers receive most cards</li>
              <li>• 15% women send themselves flowers</li>
              <li>• First heart-shaped box in 1861</li>
            </ul>
          </div>

          <div className="bg-gradient-to-br from-pink-500/10 to-purple-600/10 p-6 rounded-xl backdrop-blur-sm border border-pink-500/20">
            <h3 className="text-xl font-semibold text-pink-300 mb-2">Love Languages</h3>
            <div className="space-y-3">
              {['Words of Affirmation', 'Quality Time', 'Receiving Gifts', 'Acts of Service', 'Physical Touch'].map((lang, i) => (
                <div key={i} className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-pink-400 mr-2"></div>
                  <span className="text-sm text-pink-200/80">{lang}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="text-center">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="bg-gradient-to-r from-pink-500 to-purple-600 px-8 py-3 rounded-full font-medium shadow-lg shadow-pink-500/30"
          >
            Share Your Love
          </motion.button>
        </div>
      </div>

      {/* Floating hearts */}
      {hearts.map((heart) => (
        <motion.div
          key={heart.id}
          initial={{ y: heart.y - 10, opacity: 0 }}
          animate={{ 
            y: heart.y + 10, 
            opacity: [0, 1, 0],
            x: [heart.x, heart.x + (Math.random() * 20 - 10)]
          }}
          transition={{ 
            duration: 5 + Math.random() * 10,
            repeat: Infinity,
            delay: heart.delay,
            ease: "linear"
          }}
          style={{
            left: `${heart.x}%`,
            top: `${heart.y}%`,
            fontSize: `${heart.size}px`
          }}
          className="absolute text-pink-400 pointer-events-none"
        >
          ❤️
        </motion.div>
      ))}

      <div className="max-w-4xl mx-auto px-4 pb-8 text-center text-pink-400/20 text-xs">
        Built by Cupcake · {metadata.createdAt}
      </div>
    </div>
  );
};

export default ValentineTimer;