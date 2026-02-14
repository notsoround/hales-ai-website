import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';

type PageType = 'home' | 'get-started' | 'learn-more' | 'matts-tasklist' | 'quantum-code' | 'about-us' | 'contact-us' | 'elite-ops' | 'cupcake-test' | 'cupcake';

interface HamburgerMenuProps {
  onNavigate: (page: PageType) => void;
  currentPage: PageType;
}

const HamburgerMenu: React.FC<HamburgerMenuProps> = ({ onNavigate, currentPage }) => {
  const [isOpen, setIsOpen] = useState(false);

  const menuItems: Array<{ id: string; label: string; value: PageType }> = [
    { id: 'task-list', label: 'Task List', value: 'matts-tasklist' },
    { id: 'quantum-code', label: 'Quantum Code', value: 'quantum-code' },
    { id: 'about-us', label: 'About Us', value: 'about-us' },
    { id: 'contact-us', label: 'Contact Us', value: 'contact-us' },
    { id: 'elite-ops', label: 'Elite Ops', value: 'elite-ops' },
    { id: 'cupcake-test', label: '🧁 Cupcake Demo', value: 'cupcake-test' },
    { id: 'cupcake', label: '🧁 Cupcake Dashboard', value: 'cupcake' },
  ];

  const handleMenuClick = (value: PageType) => {
    onNavigate(value);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-lg bg-gradient-to-r from-[#00e6e6]/10 via-[#00ccff]/10 via-[#4d4dff]/10 to-[#1a1aff]/10 border border-[#00e6e6]/20 hover:border-[#00e6e6]/40 transition-all duration-200 hover:scale-105"
        aria-label="Toggle menu"
      >
        {isOpen ? (
          <X className="w-6 h-6 text-[#00e6e6]" />
        ) : (
          <Menu className="w-6 h-6 text-[#00e6e6]" />
        )}
      </button>

      <div
        className={`absolute top-[120%] right-0 w-48 rounded-lg bg-gradient-to-br from-[#0a1a2b]/95 to-[#0a0f16]/95 border border-[#00e6e6]/20 backdrop-blur-lg transform transition-all duration-300 ease-in-out ${
          isOpen
            ? 'opacity-100 translate-y-0 pointer-events-auto scale-100'
            : 'opacity-0 -translate-y-4 pointer-events-none scale-95'
        }`}
      >
        <div className="py-2">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleMenuClick(item.value)}
              className={`w-full px-4 py-2 text-left transition-colors duration-200 ${
                currentPage === item.value
                  ? 'bg-gradient-to-r from-[#00e6e6]/20 to-[#1a1aff]/20 text-[#00e6e6]'
                  : 'hover:bg-gradient-to-r hover:from-[#00e6e6]/10 hover:to-[#1a1aff]/10 text-white/90 hover:text-[#00e6e6]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Overlay to close menu when clicking outside */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[-1]"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

export default HamburgerMenu;