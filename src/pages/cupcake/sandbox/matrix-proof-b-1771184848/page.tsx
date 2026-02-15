import React from 'react';

export const metadata = {
  title: 'Matrix Build Proof',
  description: 'A tiny proof of the matrix build system.',
  createdAt: '2026-02-15',
};

const MatrixProofB1771184848: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#0a0f16] text-white">
      <div className="max-w-4xl mx-auto px-4 pt-24 pb-8">
        <button onClick={() => { window.history.pushState({}, '', '/cupcake/sandbox'); window.dispatchEvent(new PopStateEvent('popstate')); }} className="text-pink-400 hover:text-pink-300 transition mb-8 inline-block">&larr; Back to Sandbox</button>
        <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-400 via-pink-500 to-purple-500 mb-4">{metadata.title}</h1>
        <p className="text-pink-400/60 text-sm">{metadata.description}</p>
        <div className="h-px bg-gradient-to-r from-pink-500/50 via-purple-500/50 to-transparent my-8" />
      </div>
      <div className="max-w-4xl mx-auto px-4 pb-24">
        <div className="bg-black/20 p-8 rounded-lg border border-pink-500/20">
          <p className="text-pink-400/80 font-mono text-center animate-pulse">The matrix is always watching.</p>
        </div>
      </div>
      <div className="max-w-4xl mx-auto px-4 pb-8 text-center text-pink-400/20 text-xs">Built by Cupcake · {metadata.createdAt}</div>
    </div>
  );
};

export default MatrixProofB1771184848;