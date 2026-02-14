import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// --- Types ---
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  status?: 'sending' | 'sent' | 'error';
}

// --- Auth Gate ---
const AUTH_KEY = 'cupcake_auth_token';
const AUTH_EXPIRY_KEY = 'cupcake_auth_expiry';
const VALID_PASSWORD = 'CupcakeDestroyer2026!';

function isAuthenticated(): boolean {
  const token = localStorage.getItem(AUTH_KEY);
  const expiry = localStorage.getItem(AUTH_EXPIRY_KEY);
  if (!token || !expiry) return false;
  return Date.now() < parseInt(expiry);
}

function authenticate(password: string): boolean {
  if (password === VALID_PASSWORD) {
    localStorage.setItem(AUTH_KEY, btoa(password + Date.now()));
    localStorage.setItem(AUTH_EXPIRY_KEY, String(Date.now() + 24 * 60 * 60 * 1000)); // 24h
    return true;
  }
  return false;
}

function logout() {
  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(AUTH_EXPIRY_KEY);
}

// --- n8n Webhook for Cupcake commands ---
const N8N_WEBHOOK = 'https://automate.hales.ai/webhook/cupcake-web';

async function sendToCupcake(message: string): Promise<string> {
  try {
    const res = await fetch(N8N_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        command: message, 
        context: 'Web dashboard at hales.ai/cupcake',
        source: 'web',
        timestamp: Date.now()
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.reply || data.result || data.results?.[0]?.result || 'Command sent to Cupcake.';
  } catch (err) {
    console.error('Cupcake API error:', err);
    throw err;
  }
}

// --- Login Screen ---
const LoginScreen: React.FC<{ onLogin: () => void }> = ({ onLogin }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isShaking, setIsShaking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (authenticate(password)) {
      onLogin();
    } else {
      setError('Wrong password, sweetie. Try harder.');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 600);
      setPassword('');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #0a0f16 0%, #1a0a2e 30%, #2d1b4e 60%, #0a0f16 100%)' }}>
      
      {/* Animated background orbs */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute w-[600px] h-[600px] -top-40 -right-40 bg-pink-500/10 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute w-[400px] h-[400px] -bottom-20 -left-20 bg-fuchsia-500/10 rounded-full blur-[80px] animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md px-6"
      >
        <motion.div 
          className={`bg-gray-900/80 backdrop-blur-xl border border-pink-500/20 rounded-2xl p-8 shadow-2xl ${isShaking ? 'animate-shake' : ''}`}
          animate={isShaking ? { x: [-10, 10, -10, 10, 0] } : {}}
          transition={{ duration: 0.4 }}
        >
          <div className="text-center mb-8">
            <motion.div 
              className="text-6xl mb-4"
              animate={{ rotate: [0, -5, 5, -5, 0] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              🧁
            </motion.div>
            <h1 className="text-3xl font-black text-white mb-2">Cupcake</h1>
            <p className="text-pink-300/60 text-sm">Pink bows, zero bullshit. Authenticate to enter.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                ref={inputRef}
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                placeholder="Password"
                className="w-full px-4 py-3 bg-gray-800/50 border border-pink-500/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-pink-500/50 focus:ring-2 focus:ring-pink-500/20 transition-all"
              />
            </div>
            
            <AnimatePresence>
              {error && (
                <motion.p 
                  initial={{ opacity: 0, height: 0 }} 
                  animate={{ opacity: 1, height: 'auto' }} 
                  exit={{ opacity: 0, height: 0 }}
                  className="text-pink-400 text-sm text-center"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <motion.button
              type="submit"
              className="w-full py-3 bg-gradient-to-r from-pink-600 to-fuchsia-600 text-white font-bold rounded-xl hover:from-pink-500 hover:to-fuchsia-500 transition-all shadow-lg shadow-pink-500/20"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Enter the Cupcake Zone
            </motion.button>
          </form>

          <p className="text-gray-600 text-xs text-center mt-6">
            Built by <a href="https://hales.ai" className="text-pink-500/40 hover:text-pink-400 transition-colors">Hales AI</a>
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
};

// --- Chat Message Component ---
const ChatBubble: React.FC<{ message: Message; isLatest: boolean }> = ({ message, isLatest }) => {
  const isUser = message.role === 'user';
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}
    >
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-fuchsia-600 flex items-center justify-center mr-2 mt-1 flex-shrink-0 text-sm">
          🧁
        </div>
      )}
      <div className={`max-w-[75%] px-4 py-3 rounded-2xl ${
        isUser 
          ? 'bg-pink-600/80 text-white rounded-br-sm' 
          : 'bg-gray-800/80 text-gray-100 border border-pink-500/10 rounded-bl-sm'
      }`}>
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
        <div className={`flex items-center gap-2 mt-1 ${isUser ? 'justify-end' : 'justify-start'}`}>
          <span className="text-[10px] opacity-40">
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          {message.status === 'sending' && (
            <span className="text-[10px] text-pink-400 animate-pulse">sending...</span>
          )}
        </div>
      </div>
    </motion.div>
  );
};

// --- Typing Indicator ---
const TypingIndicator: React.FC = () => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="flex items-center gap-2 mb-3"
  >
    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-fuchsia-600 flex items-center justify-center flex-shrink-0 text-sm">
      🧁
    </div>
    <div className="bg-gray-800/80 border border-pink-500/10 rounded-2xl rounded-bl-sm px-4 py-3">
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-2 h-2 bg-pink-400 rounded-full"
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
          />
        ))}
      </div>
    </div>
  </motion.div>
);

// --- Quick Actions ---
const quickActions = [
  { icon: '📧', label: 'Check Email', command: '/email check inbox' },
  { icon: '📅', label: 'Calendar', command: '/calendar today' },
  { icon: '🎨', label: 'Draw', command: '/draw ' },
  { icon: '🌐', label: 'Research', command: '/research ' },
  { icon: '📞', label: 'Call Me', command: '/call Matt' },
  { icon: '🔥', label: 'Drama +', command: '/drama 11' },
];

// --- Main Dashboard ---
const CupcakeDashboard: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: "Hey! I'm Cupcake. Pink bows, zero bullshit. What universe you wanna wreck today?\n\nI can check your email, manage your calendar, draw images, research anything, make phone calls, or just chat. Try the quick actions below or type anything.",
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, scrollToBottom]);

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;
    
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
      status: 'sent',
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const reply = await sendToCupcake(text.trim());
      const assistantMsg: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: reply,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch {
      const errorMsg: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: "Hmm, something broke. The webhook might be down, or n8n is having a moment. Try again?",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleQuickAction = (command: string) => {
    if (command.endsWith(' ')) {
      setInput(command);
      inputRef.current?.focus();
    } else {
      sendMessage(command);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="h-screen flex" style={{ background: 'linear-gradient(180deg, #0a0f16 0%, #0d1117 100%)' }}>
      {/* Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25 }}
              className="fixed left-0 top-0 bottom-0 w-72 bg-gray-900/95 backdrop-blur-xl border-r border-pink-500/10 z-50 p-5 flex flex-col"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🧁</span>
                  <span className="text-white font-bold text-lg">Cupcake</span>
                </div>
                <button onClick={() => setSidebarOpen(false)} className="text-gray-400 hover:text-white">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-1 flex-1">
                <p className="text-gray-500 text-xs uppercase tracking-wider mb-3 px-3">Connected Services</p>
                {[
                  { icon: '📧', label: 'Gmail (matt@hales.ai)', status: 'active' },
                  { icon: '📅', label: 'Google Calendar', status: 'active' },
                  { icon: '👥', label: 'Contacts (Airtable)', status: 'active' },
                  { icon: '📱', label: 'Telegram Bot', status: 'active' },
                  { icon: '📞', label: 'Vapi Voice (+1-872-666-9598)', status: 'active' },
                  { icon: '🎤', label: 'ElevenLabs TTS', status: 'active' },
                  { icon: '🔗', label: 'n8n Workflows (28)', status: 'active' },
                  { icon: '🧠', label: 'DeepSeek R1 (primary)', status: 'active' },
                  { icon: '🎨', label: 'Image Gen (Nano Banana)', status: 'active' },
                ].map((service) => (
                  <div key={service.label} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-800/50 transition-colors">
                    <span className="text-sm">{service.icon}</span>
                    <span className="text-gray-300 text-sm flex-1">{service.label}</span>
                    <div className={`w-2 h-2 rounded-full ${service.status === 'active' ? 'bg-green-400' : 'bg-gray-600'}`} />
                  </div>
                ))}
              </div>

              <div className="border-t border-gray-800 pt-4 mt-4">
                <button
                  onClick={onLogout}
                  className="w-full px-3 py-2 text-left text-gray-400 hover:text-pink-400 text-sm rounded-lg hover:bg-gray-800/50 transition-colors"
                >
                  🚪 Logout
                </button>
                <a
                  href="https://t.me/CupcakeApocalypseBot"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full px-3 py-2 text-left text-gray-400 hover:text-pink-400 text-sm rounded-lg hover:bg-gray-800/50 transition-colors"
                >
                  💬 Open in Telegram
                </a>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800/50 bg-gray-900/50 backdrop-blur-sm">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800/50 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-fuchsia-600 flex items-center justify-center text-sm">
            🧁
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-white font-semibold text-sm">Cupcake</h2>
            <p className="text-green-400 text-xs">Online — DeepSeek R1</p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="tel:+18726669598"
              className="p-2 text-gray-400 hover:text-pink-400 rounded-lg hover:bg-gray-800/50 transition-colors"
              title="Call Cupcake"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </a>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
          {messages.map((msg, i) => (
            <ChatBubble key={msg.id} message={msg} isLatest={i === messages.length - 1} />
          ))}
          <AnimatePresence>
            {isTyping && <TypingIndicator />}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Actions */}
        <div className="px-4 py-2 flex gap-2 overflow-x-auto scrollbar-hide">
          {quickActions.map((action) => (
            <motion.button
              key={action.label}
              onClick={() => handleQuickAction(action.command)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800/60 border border-pink-500/10 rounded-full text-gray-300 text-xs hover:bg-pink-600/20 hover:border-pink-500/30 hover:text-pink-200 transition-all whitespace-nowrap flex-shrink-0"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <span>{action.icon}</span>
              <span>{action.label}</span>
            </motion.button>
          ))}
        </div>

        {/* Input Area */}
        <div className="px-4 py-3 border-t border-gray-800/50 bg-gray-900/50 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Talk to Cupcake..."
              className="flex-1 px-4 py-3 bg-gray-800/50 border border-gray-700/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-pink-500/40 focus:ring-2 focus:ring-pink-500/10 transition-all text-sm"
              disabled={isTyping}
            />
            <motion.button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isTyping}
              className="p-3 bg-gradient-to-r from-pink-600 to-fuchsia-600 text-white rounded-xl disabled:opacity-30 disabled:cursor-not-allowed hover:from-pink-500 hover:to-fuchsia-500 transition-all"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Main Page Component ---
const CupcakePage: React.FC = () => {
  const [authed, setAuthed] = useState(isAuthenticated());

  const handleLogout = () => {
    logout();
    setAuthed(false);
  };

  if (!authed) {
    return <LoginScreen onLogin={() => setAuthed(true)} />;
  }

  return <CupcakeDashboard onLogout={handleLogout} />;
};

export default CupcakePage;
