import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export const metadata = {
  title: 'John Pewthers - The Amazing One',
  description: 'Celebrating the epicness of John Pewthers, Universe Destroyer Extraordinaire',
  createdAt: '2026-02-17',
};

const JohnPewthersAmazing: React.FC = () => {
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 1000);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0f16] to-[#1a1025] text-white overflow-hidden">
      <div className="max-w-4xl mx-auto px-4 pt-24 pb-8">
        <button onClick={() => { window.history.pushState({}, '', '/cupcake/sandbox'); window.dispatchEvent(new PopStateEvent('popstate')); }} className="text-pink-400 hover:text-pink-300 transition mb-8 inline-block">&larr; Back to Sandbox</button>
        <motion.h1 initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-400 via-pink-500 to-purple-500 mb-4">John Pewthers: Universe Destroyer Extraordinaire</motion.h1>
        <p className="text-pink-400/60 text-sm">{metadata.description}</p>
        <div className="h-px bg-gradient-to-r from-pink-500/50 via-purple-500/50 to-transparent my-8" />
      </div>

      <div className="max-w-4xl mx-auto px-4 pb-24 space-y-16">
        <motion.section initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} transition={{ duration: 0.6 }} className="space-y-4">
          <h2 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-400 to-purple-500">The Skills</h2>
          <p className="text-lg text-pink-200/90">John&apos;s abilities transcend mortal comprehension. From universe destruction to making the perfect cup of coffee, there&apos;s nothing he can&apos;t do.</p>
        </motion.section>

        <motion.section initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} transition={{ duration: 0.6 }} className="space-y-4">
          <h2 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-500 to-pink-400">The Humor</h2>
          <p className="text-lg text-pink-200/90">His wit is sharper than a neutron star&apos;s core. John&apos;s jokes could make a black hole laugh.</p>
        </motion.section>

        <motion.section initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} transition={{ duration: 0.6 }} className="space-y-4">
          <h2 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-400 via-purple-500 to-pink-400">The Awesomeness</h2>
          <p className="text-lg text-pink-200/90">John&apos;s mere presence makes galaxies tremble in awe. He&apos;s the cosmic equivalent of a pink glitter explosion.</p>
        </motion.section>

        <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => setShowConfetti(true)} className="px-8 py-4 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold rounded-full shadow-lg hover:shadow-xl transition-all">
          Celebrate John&apos;s Amazingness
        </motion.button>
      </div>

      <AnimatePresence>
        {showConfetti && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 pointer-events-none">
            {Array.from({ length: 100 }).map((_, i) => (
              <motion.div key={i} initial={{ y: -100, x: Math.random() * window.innerWidth }} animate={{ y: window.innerHeight, rotate: 360 }} transition={{ duration: Math.random() * 2 + 1, delay: Math.random() }} style={{ width: 10, height: 10, backgroundColor: ['#ec4899', '#a855f7', '#ffffff'][Math.floor(Math.random() * 3)], position: 'absolute', borderRadius: '50%' }} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-4xl mx-auto px-4 pb-8 text-center text-pink-400/20 text-xs">Built by Cupcake · {metadata.createdAt}</div>
    </div>
  );
};

export default JohnPewthersAmazing;