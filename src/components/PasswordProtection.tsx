import React, { useState } from 'react';

interface PasswordProtectionProps {
  onSuccess: () => void;
  correctPassword: string;
}

const PasswordProtection: React.FC<PasswordProtectionProps> = ({ onSuccess, correctPassword }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === correctPassword) {
      onSuccess();
    } else {
      setError(true);
      setPassword('');
      setTimeout(() => setError(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0f16] flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-[#0a1a2b]/50 to-[#0a0f16]/50 border border-[#00e6e6]/20 rounded-2xl p-8 backdrop-blur-sm w-full max-w-md">
        <h2 className="text-2xl font-bold text-center mb-6 bg-clip-text text-transparent bg-gradient-to-r from-[#00e6e6] via-[#00ccff] via-[#4d4dff] to-[#1a1aff] animate-gradient">
          Elite Access Required
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className={`w-full px-4 py-2 rounded-lg bg-[#0a1a2b]/30 border ${
                error ? 'border-red-500' : 'border-[#00e6e6]/20'
              } focus:border-[#00e6e6]/50 focus:outline-none text-white placeholder-[#00e6e6]/50 transition-colors duration-200`}
            />
          </div>
          {error && (
            <p className="text-red-500 text-sm text-center">
              Incorrect password. Please try again.
            </p>
          )}
          <button
            type="submit"
            className="w-full px-6 py-3 bg-gradient-to-r from-[#00e6e6] via-[#00ccff] via-[#4d4dff] to-[#1a1aff] rounded-lg font-semibold text-white hover:opacity-90 transition animate-gradient"
          >
            Access Elite Ops
          </button>
        </form>
      </div>
    </div>
  );
};

export default PasswordProtection;