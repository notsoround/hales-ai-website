import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export const metadata = {
  title: 'Happy Birthday Austin - 27 Cupcake Style 🧁',
  description: 'A super cupcake-y celebration for Austin&apos;s 27th birthday!',
  createdAt: '2026-02-18',
};

const HappyBirthdayAustin27: React.FC = () => {
  const [exploding, setExploding] = useState(false);
  const [confetti, setConfetti] = useState<Array<{ id: number; x: number; y: number; color: string }>>([]);
  const [balloons, setBalloons] = useState<Array<{ id: number; x: number; y: number; speed: number }>>([]);
  const [hearts, setHearts] = useState<Array<{ id: number; x: number; y: number; size: number }>>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Generate initial balloons
    const initialBalloons = Array.from({ length: 15 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      speed: 0.5 + Math.random() * 0.5
    }));
    setBalloons(initialBalloons);

    // Generate initial hearts
    const initialHearts = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 0.5 + Math.random() * 1.5
    }));
    setHearts(initialHearts);

    // Balloon animation
    const balloonInterval = setInterval(() => {
      setBalloons(prev => prev.map(b => ({
        ...b,
        y: (b.y - b.speed) % 100
      })));
    }, 50);

    // Heart animation
    const heartInterval = setInterval(() => {
      setHearts(prev => prev.map(h => ({
        ...h,
        y: (h.y - 0.2) % 100,
        x: h.x + (Math.random() * 0.4 - 0.2)
      })));
    }, 100);

    return () => {
      clearInterval(balloonInterval);
      clearInterval(heartInterval);
    };
  }, []);

  const triggerExplosion = () => {
    setExploding(true);
    
    // Generate confetti
    const newConfetti = Array.from({ length: 100 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      color: ['bg-pink-400', 'bg-purple-400', 'bg-yellow-300', 'bg-blue-300'][Math.floor(Math.random() * 4)]
    }));
    setConfetti(newConfetti);

    setTimeout(() => {
      setExploding(false);
    }, 2000);
  };

  const ageFacts = [
    '27 is the cube of 3 (3×3×3)',
    '27 is a perfect cube number',
    '27 is the atomic number of cobalt',
    '27 is the number of bones in the human hand',
    '27 is considered the &apos;age of maturity&apos; in some cultures'
  ];

  const [currentFact, setCurrentFact] = useState(0);

  useEffect(() => {
    const factInterval = setInterval(() => {
      setCurrentFact((prev) => (prev + 1) % ageFacts.length);
    }, 3000);
    return () => clearInterval(factInterval);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-purple-100 text-pink-900 overflow-hidden" ref={containerRef}>
      <div className="max-w-4xl mx-auto px-4 pt-24 pb-8 relative">
        <button onClick={() => { window.history.pushState({}, '', '/cupcake/sandbox'); window.dispatchEvent(new PopStateEvent('popstate')); }} className="text-pink-600 hover:text-pink-500 transition mb-8 inline-block">&larr; Back to Sandbox</button>
        
        <motion.h1 
          className="text-5xl md:text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-500 via-purple-500 to-pink-500 mb-6 text-center"
          animate={{
            scale: [1, 1.05, 1],
            textShadow: ['0 0 0px rgba(236, 72, 153, 0)', '0 0 20px rgba(236, 72, 153, 0.5)', '0 0 0px rgba(236, 72, 153, 0)']
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            repeatType: 'reverse'
          }}
        >
          Happy Birthday Austin! 🎉🧁<br />
          <span className="text-4xl md:text-5xl">27 & Fabulous!</span>
        </motion.h1>

        <div className="relative h-64 my-12">
          {/* Balloons */}
          {balloons.map((balloon) => (
            <motion.div
              key={balloon.id}
              className="absolute w-12 h-16 rounded-full"
              style={{
                left: `${balloon.x}%`,
                top: `${balloon.y}%`,
                background: `radial-gradient(circle at 30% 30%, white, ${['#f472b6', '#a78bfa', '#fbbf24', '#60a5fa'][balloon.id % 4]})`,
                transform: `rotate(${balloon.id * 10}deg)`
              }}
              animate={{
                y: [0, -10, 0],
                rotate: [balloon.id * 10, balloon.id * 10 + 5, balloon.id * 10]
              }}
              transition={{
                duration: 2 + Math.random(),
                repeat: Infinity,
                repeatType: 'reverse'
              }}
            >
              <div className="absolute bottom-0 left-1/2 w-0.5 h-8 bg-pink-300 transform -translate-x-1/2"></div>
            </motion.div>
          ))}

          {/* Cupcake */}
          <motion.div 
            className="absolute left-1/2 bottom-0 transform -translate-x-1/2 cursor-pointer"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={triggerExplosion}
          >
            <div className="w-24 h-16 bg-pink-300 rounded-b-full"></div>
            <div className="w-32 h-12 bg-pink-400 rounded-t-full relative">
              <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 w-16 h-16 bg-pink-200 rounded-full flex items-center justify-center">
                <div className="w-12 h-12 bg-pink-500 rounded-full flex items-center justify-center">
                  <div className="w-8 h-8 bg-pink-600 rounded-full"></div>
                </div>
              </div>
              <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 w-8 h-8 bg-pink-300 rotate-45"></div>
            </div>
          </motion.div>

          {/* Exploding cupcakes */}
          <AnimatePresence>
            {exploding && (
              <>
                {Array.from({ length: 5 }).map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute left-1/2 bottom-0 transform -translate-x-1/2"
                    initial={{ scale: 0, opacity: 1 }}
                    animate={{ 
                      scale: [0, 1, 0.5], 
                      opacity: [1, 1, 0],
                      y: [-100, -200, -300],
                      x: [-100 + i * 50, -150 + i * 75, -200 + i * 100]
                    }}
                    transition={{ duration: 1.5 }}
                  >
                    <div className="w-16 h-10 bg-pink-300 rounded-b-full"></div>
                    <div className="w-20 h-8 bg-pink-400 rounded-t-full relative">
                      <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 w-12 h-12 bg-pink-200 rounded-full flex items-center justify-center">
                        <div className="w-8 h-8 bg-pink-500 rounded-full"></div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </>
            )}
          </AnimatePresence>

          {/* Confetti */}
          {confetti.map((c) => (
            <motion.div
              key={c.id}
              className={`absolute w-2 h-2 ${c.color} rounded-full`}
              style={{
                left: `${c.x}%`,
                top: `${c.y}%`,
              }}
              initial={{ y: 0, opacity: 1 }}
              animate={{ 
                y: 100,
                opacity: 0,
                x: c.x + (Math.random() * 20 - 10)
              }}
              transition={{ duration: 2 }}
            />
          ))}

          {/* Hearts */}
          {hearts.map((heart) => (
            <motion.div
              key={heart.id}
              className="absolute text-pink-400"
              style={{
                left: `${heart.x}%`,
                top: `${heart.y}%`,
                fontSize: `${heart.size}rem`,
              }}
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.8, 1, 0.8]
              }}
              transition={{
                duration: 2 + Math.random(),
                repeat: Infinity,
                repeatType: 'reverse'
              }}
            >
              ❤️
            </motion.div>
          ))}
        </div>

        <div className="bg-white/50 backdrop-blur-sm rounded-2xl p-6 mt-12 shadow-lg border border-pink-200">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-pink-600 mb-2">Fun Facts About 27</h2>
            <motion.p
              key={currentFact}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-pink-700 italic"
            >
              {ageFacts[currentFact]}
            </motion.p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <motion.div
                key={i}
                className="bg-pink-100 rounded-xl p-4 text-center border-2 border-pink-200"
                whileHover={{ scale: 1.05, rotate: [0, -5, 5, 0] }}
              >
                <div className="text-4xl mb-2">
                  {['🎂', '🎉', '🧁', '🎁', '🎈', '✨'][i]}
                </div>
                <div className="text-sm font-medium text-pink-600">
                  {['Sweet', 'Fun', 'Yummy', 'Gifts', 'Party', 'Magic'][i]}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
      <div className="max-w-4xl mx-auto px-4 pb-8 text-center text-pink-600/30 text-xs">Built by Cupcake · {metadata.createdAt}</div>
    </div>
  );
};

export default HappyBirthdayAustin27;