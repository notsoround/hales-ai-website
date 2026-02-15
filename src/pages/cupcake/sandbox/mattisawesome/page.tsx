import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export const metadata = {
  title: 'MattIsAwesome Tetris',
  description: 'The state of the art Tetris experience with Matt floating around in the background. Absolutely over the top awesome design!',
  createdAt: '2026-02-15',
};

const MattIsAwesome: React.FC = () => {
  const [grid, setGrid] = useState(Array(20).fill(Array(10).fill(0)));
  const [piece, setPiece] = useState({ shape: [[1]], position: [0, 5] });
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const gameAreaRef = useRef<HTMLDivElement>(null);

  const shapes = useMemo(() => [
    [[1, 1, 1, 1]],
    [[1, 1], [1, 1]],
    [[0, 1, 0], [1, 1, 1]],
    [[1, 0], [1, 0], [1, 1]],
    [[0, 1], [0, 1], [1, 1]]
  ], []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameOver) return;
      const [row, col] = piece.position;
      switch (e.key) {
        case 'ArrowLeft': setPiece({ ...piece, position: [row, Math.max(col - 1, 0)] }); break;
        case 'ArrowRight': setPiece({ ...piece, position: [row, Math.min(col + 1, 9 - piece.shape[0].length + 1)] }); break;
        case 'ArrowDown': setPiece({ ...piece, position: [row + 1, col] }); break;
        case 'ArrowUp': setPiece({ ...piece, shape: rotateShape(piece.shape) }); break;
        default: break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [piece, gameOver]);

  useEffect(() => {
    const gameLoop = setInterval(() => {
      if (gameOver) return;
      const [row, col] = piece.position;
      if (row + piece.shape.length >= 20 || collisionCheck(row + 1, col)) {
        const newGrid = placePiece(grid, piece);
        setGrid(clearRows(newGrid));
        setPiece({ shape: shapes[Math.floor(Math.random() * shapes.length)], position: [0, 5] });
        if (collisionCheck(0, 5)) setGameOver(true);
      } else {
        setPiece({ ...piece, position: [row + 1, col] });
      }
    }, 1000);

    return () => clearInterval(gameLoop);
  }, [piece, grid, gameOver, shapes]);

  const collisionCheck = (row: number, col: number) => {
    return piece.shape.some((r, i) => r.some((c, j) => c && grid[row + i]?.[col + j]));
  };

  const placePiece = (grid: number[][], piece: { shape: number[][], position: number[] }) => {
    const newGrid = grid.map(row => [...row]);
    piece.shape.forEach((r, i) => r.forEach((c, j) => {
      if (c) newGrid[piece.position[0] + i][piece.position[1] + j] = 1;
    }));
    return newGrid;
  };

  const clearRows = (grid: number[][]) => {
    const newGrid = grid.filter(row => row.some(cell => !cell));
    const clearedRows = 20 - newGrid.length;
    if (clearedRows) setScore(score + clearedRows * 100);
    return [...Array(clearedRows).fill(Array(10).fill(0)), ...newGrid];
  };

  const rotateShape = (shape: number[][]) => {
    return shape[0].map((_, i) => shape.map(row => row[i]).reverse());
  };

  return (
    <div className="min-h-screen bg-[#0a0f16] text-white relative overflow-hidden">
      <div className="max-w-4xl mx-auto px-4 pt-24 pb-8">
        <button onClick={() => { window.history.pushState({}, '', '/cupcake/sandbox'); window.dispatchEvent(new PopStateEvent('popstate')); }} className="text-pink-400 hover:text-pink-300 transition mb-8 inline-block">&larr; Back to Sandbox</button>
        <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-400 via-pink-500 to-purple-500 mb-4">{metadata.title}</h1>
        <p className="text-pink-400/60 text-sm">{metadata.description}</p>
        <div className="h-px bg-gradient-to-r from-pink-500/50 via-purple-500/50 to-transparent my-8" />
      </div>
      <div className="max-w-4xl mx-auto px-4 pb-24">
        <div className="relative">
          <div className="absolute inset-0 blur-[100px] opacity-30">
            <motion.div 
              initial={{ x: -200, y: -100 }}
              animate={{ x: [0, 100, -100, 0], y: [0, 50, -50, 0] }}
              transition={{ duration: 20, repeat: Infinity, repeatType: 'mirror' }}
              className="absolute w-64 h-64 bg-gradient-to-r from-pink-500/50 to-purple-500/50 rounded-full"
            />
          </div>
          <div ref={gameAreaRef} className="relative grid grid-cols-10 gap-1 w-[300px] h-[600px] mx-auto border-4 border-pink-500/20 rounded-lg p-2">
            {grid.map((row, i) => row.map((cell, j) => (
              <div key={`${i}-${j}`} className={`w-full h-full ${cell ? 'bg-pink-500' : 'bg-pink-500/10'} rounded-sm transition-all duration-100`} />
            )))}
            {piece.shape.map((row, i) => row.map((cell, j) => cell && (
              <div key={`piece-${i}-${j}`} style={{ transform: `translate(${piece.position[1] * 100}%, ${piece.position[0] * 100}%)` }} className={`absolute w-[10%] h-[5%] bg-pink-500 rounded-sm transition-transform duration-100`} />
            )))}
          </div>
          <div className="mt-4 text-center text-pink-400">
            <p className="text-xl">Score: {score}</p>
            {gameOver && <p className="text-2xl mt-4 bg-clip-text text-transparent bg-gradient-to-r from-pink-400 to-purple-500">Game Over!</p>}
          </div>
        </div>
      </div>
      <div className="max-w-4xl mx-auto px-4 pb-8 text-center text-pink-400/20 text-xs">Built by Cupcake · {metadata.createdAt}</div>
    </div>
  );
};

export default MattIsAwesome;