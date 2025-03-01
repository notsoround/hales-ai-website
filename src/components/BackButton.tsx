import React from 'react';
import { ArrowLeft } from 'lucide-react';

interface BackButtonProps {
  onBack: () => void;
}

const BackButton = ({ onBack }: BackButtonProps) => {
  return (
    <button
      onClick={onBack}
      className="fixed top-24 left-4 z-50 p-3 rounded-full bg-gradient-to-r from-[#00e6e6]/10 via-[#00ccff]/10 via-[#4d4dff]/10 to-[#1a1aff]/10 hover:from-[#00e6e6]/20 hover:via-[#00ccff]/20 hover:via-[#4d4dff]/20 hover:to-[#1a1aff]/20 border border-[#00e6e6]/20 transition-all duration-300 group"
    >
      <ArrowLeft className="w-6 h-6 text-[#00e6e6] group-hover:scale-110 transition-transform" />
      <span className="sr-only">Back to Home</span>
    </button>
  );
};

export default BackButton;