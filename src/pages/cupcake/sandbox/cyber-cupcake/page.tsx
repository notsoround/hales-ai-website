import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export const metadata = {
  title: 'Cyber Cupcake Terminal',
  description: 'Neon-glowing hacker terminal with ASCII art and Matrix rain',
  createdAt: '2026-02-15',
};

const CyberCupcake: React.FC = () => {
  const [typedText, setTypedText] = useState('');
  const [showCursor, setShowCursor] = useState(true);
  const [matrixDrops, setMatrixDrops] = useState<Array<{x: number, y: number, speed: number, length: number}>>([]);
  const terminalRef = useRef<HTMLDivElement>(null);

  const cupcakeAscii = [
    '   ,d88b.d88b,   ',
    '   88888888888   ',
    '   `Y8888888Y`   ',
    '     `Y888Y`     ',
    '       `Y`       ',
    '  C U P C A K E  ',
    '   H A C K E D   '
  ];

  useEffect(() => {
    // Matrix rain initialization
    const initMatrix = () => {
      const drops = [];
      if (terminalRef.current) {
        const width = terminalRef.current.clientWidth;
        const height = terminalRef.current.clientHeight;
        const columns = Math.floor(width / 20);
        
        for (let i = 0; i < columns; i++) {
          drops.push({
            x: i * 20,
            y: Math.random() * -100,
            speed: 2 + Math.random() * 3,
            length: 3 + Math.floor(Math.random() * 10)
          });
        }
      }
      setMatrixDrops(drops);
    };

    initMatrix();
    const resizeListener = () => initMatrix();
    window.addEventListener('resize', resizeListener);
    return () => window.removeEventListener('resize', resizeListener);
  }, []);

  useEffect(() => {
    // ASCII typing animation
    let currentLine = 0;
    let currentChar = 0;
    const fullText = cupcakeAscii.join('\n');

    const typeInterval = setInterval(() => {
      if (currentChar < fullText.length) {
        setTypedText(fullText.substring(0, currentChar + 1));
        currentChar++;
      } else {
        clearInterval(typeInterval);
      }
    }, 50);

    return () => clearInterval(typeInterval);
  }, []);

  useEffect(() => {
    // Cursor blink animation
    const cursorInterval = setInterval(() => {
      setShowCursor(prev => !prev);
    }, 500);

    return () => clearInterval(cursorInterval);
  }, []);

  useEffect(() => {
    // Matrix rain animation
    const rainInterval = setInterval(() => {
      setMatrixDrops(prevDrops => 
        prevDrops.map(drop => ({
          ...drop,
          y: drop.y > (terminalRef.current?.clientHeight || 0) + (drop.length * 20) 
             ? -20 
             : drop.y + drop.speed
        }))
      );
    }, 50);

    return () => clearInterval(rainInterval);
  }, []);

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden">
      <div className="max-w-4xl mx-auto px-4 pt-24 pb-8">
        <button onClick={() => { window.history.pushState({}, '', '/cupcake/sandbox'); window.dispatchEvent(new PopStateEvent('popstate')); }} className="text-pink-400 hover:text-pink-300 transition mb-8 inline-block">&larr; Back to Sandbox</button>
        <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-green-400 via-green-500 to-teal-500 mb-4">{metadata.title}</h1>
        <p className="text-green-400/60 text-sm">{metadata.description}</p>
        <div className="h-px bg-gradient-to-r from-green-500/50 via-teal-500/50 to-transparent my-8" />
      </div>

      <div ref={terminalRef} className="relative max-w-4xl mx-auto px-4 pb-24 min-h-[400px] bg-black border-2 border-green-500/30 rounded-lg overflow-hidden">
        {/* Matrix rain */}
        <AnimatePresence>
          {matrixDrops.map((drop, index) => (
            <motion.div
              key={index}
              initial={{ y: drop.y }}
              animate={{ y: drop.y }}
              className="absolute text-green-400 font-mono text-sm"
              style={{ left: drop.x, opacity: 0.8 }}
            >
              {Array.from({ length: drop.length }).map((_, i) => (
                <div key={i} className={i === drop.length - 1 ? 'text-green-300' : 'text-green-500/50'}>
                  {String.fromCharCode(Math.random() * 128)}
                </div>
              ))}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Terminal content */}
        <div className="relative z-10 p-4 font-mono">
          <div className="text-green-400 mb-4">$ ./cupcake --hack</div>
          <div className="text-green-300 whitespace-pre">
            {typedText}
            <span className={`inline-block w-2 h-6 bg-green-400 ml-1 ${showCursor ? 'opacity-100' : 'opacity-0'}`}></span>
          </div>
          <div className="mt-8 text-green-500/50 text-sm">
            &gt; SYSTEM STATUS: <span className="text-green-400">CUPCAKE_OS v3.1.4</span><br/>
            &gt; MEMORY: <span className="text-green-400">87% SWEETNESS</span><br/>
            &gt; PROCESSES: <span className="text-green-400">42 FROSTING_THREADS</span><br/>
            <br/>
            &gt; <span className="text-green-300">READY FOR COMMANDS...</span>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-black to-transparent"></div>
      </div>

      <div className="max-w-4xl mx-auto px-4 pb-8 text-center text-green-400/20 text-xs">Built by Cupcake · {metadata.createdAt}</div>
    </div>
  );
};

export default CyberCupcake;