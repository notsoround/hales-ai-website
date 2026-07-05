import React, { useState, useEffect, useRef } from 'react';
import { Send, X, Sparkles } from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatInterfaceProps {
  onMessageSent: (message: string) => void;
  onMessageReceived: (message: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

const CHAT_WEBHOOK = 'https://automate.hales.ai/webhook/cupcake-web';

async function askHalesAI(message: string): Promise<string> {
  const res = await fetch(CHAT_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      command: message,
      context: 'Public chat widget on hales.ai — visitor question. Be helpful, concise, and professional about Hales AI services (AI telephony, voice cloning, workflow automation, smart scheduling, web development).',
      source: 'website-chat',
      timestamp: Date.now(),
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.reply || data.result || data.results?.[0]?.result || "Thanks! We'll get back to you shortly.";
}

export function ChatInterface({ onMessageSent, onMessageReceived, isOpen, onClose }: ChatInterfaceProps) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: "Hey! I'm the Hales AI assistant. Ask me anything about AI phone agents, automation, or what we can build for you.",
      timestamp: new Date(),
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: text, timestamp: new Date() }]);
    onMessageSent(text);
    setIsLoading(true);

    try {
      const reply = await askHalesAI(text);
      setMessages((prev) => [...prev, { role: 'assistant', content: reply, timestamp: new Date() }]);
      onMessageReceived(reply);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: "Hmm, I couldn't reach the server just now. Email matt@hales.ai and we'll get right back to you.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-24 right-4 sm:right-6 z-50 w-[calc(100vw-2rem)] max-w-md">
      <div className="rounded-3xl border border-white/10 bg-[#0A0F1E]/95 backdrop-blur-xl shadow-2xl shadow-primary/10 overflow-hidden flex flex-col max-h-[70vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-gradient-to-r from-primary/10 to-secondary/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <Sparkles size={16} className="text-black" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">Hales AI</div>
              <div className="text-[11px] text-primary/80 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" /> Online
              </div>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close chat" className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-[240px]">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-gradient-to-r from-primary/90 to-secondary/90 text-black font-medium rounded-br-md'
                    : 'bg-white/[0.06] border border-white/10 text-gray-200 rounded-bl-md'
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="px-4 py-3 rounded-2xl rounded-bl-md bg-white/[0.06] border border-white/10 flex gap-1.5">
                <span className="w-2 h-2 rounded-full bg-primary/70 animate-bounce [animation-delay:0ms]" />
                <span className="w-2 h-2 rounded-full bg-primary/70 animate-bounce [animation-delay:150ms]" />
                <span className="w-2 h-2 rounded-full bg-primary/70 animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="p-3 border-t border-white/10 flex gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about AI phone agents, pricing…"
            className="flex-1 px-4 py-3 rounded-2xl bg-black/30 border border-white/10 focus:border-primary/50 focus:outline-none text-sm text-white placeholder-gray-600"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            aria-label="Send message"
            className="px-4 rounded-2xl bg-gradient-to-r from-primary to-secondary text-black disabled:opacity-40 hover:scale-105 transition-transform"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
