import React, { useState, useEffect, useRef } from 'react';
import { Send, Mic } from 'lucide-react';
import useVapi from '../hooks/use-vapi';

interface ChatMessage {
  role: string;
  content: string;
  timestamp: Date;
}

interface ChatInterfaceProps {
  onMessageSent: (message: string) => void;
  onMessageReceived: (message: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export function ChatInterface({ onMessageSent, onMessageReceived, isOpen, onClose }: ChatInterfaceProps) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { isSessionActive, conversation, toggleCall } = useVapi();

  if (!isOpen) return null;

  // Convert Vapi conversation to chat messages
  useEffect(() => {
    const newMessages = conversation.map(msg => ({
      role: msg.role,
      content: msg.text,
      timestamp: new Date()
    }));
    setMessages(newMessages);
  }, [conversation]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = input.trim();
    setInput('');
    
    // Add user message to chat
    const newUserMessage: ChatMessage = {
      role: 'user',
      content: userMessage,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, newUserMessage]);
    onMessageSent(userMessage);
    
    // Start Vapi call if not active
    if (!isSessionActive) {
      await toggleCall();
    }
  };

  return (
    <div className="fixed bottom-4 right-4 w-80 h-96 bg-[#0a1a2b] rounded-2xl shadow-xl border border-[#00e6e6]/20 flex flex-col overflow-hidden z-50">
      {/* Header */}
      <div className="p-3 border-b border-[#00e6e6]/20 flex justify-between items-center bg-gradient-to-r from-[#00e6e6]/10 via-[#00ccff]/10 to-[#1a1aff]/10 animate-gradient">
        <h3 className="font-semibold text-[#00e6e6]">Hales AI Assistant</h3>
        <button
          onClick={onClose}
          className="w-6 h-6 rounded-full flex items-center justify-center text-[#00e6e6] hover:text-[#00ccff] transition-colors"
        >
          ✕
        </button>
      </div>
      
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center text-[#00e6e6]/50 mt-10">
            <p>How can I assist you today?</p>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div 
              key={index} 
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div 
                className={`max-w-[80%] p-3 rounded-2xl ${
                  msg.role === 'user' 
                    ? 'bg-gradient-to-r from-[#00e6e6]/20 via-[#00ccff]/20 to-[#1a1aff]/20 text-white' 
                    : 'bg-[#0a0f16] text-[#00e6e6]'
                }`}
              >
                <p>{msg.content}</p>
                <div className="text-xs opacity-50 mt-1">
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))
        )}
        {isSessionActive && (
          <div className="flex justify-start">
            <div className="bg-[#0a0f16] p-3 rounded-2xl max-w-[80%]">
              <div className="flex space-x-2">
                <div className="w-2 h-2 rounded-full bg-[#00e6e6] animate-pulse"></div>
                <div className="w-2 h-2 rounded-full bg-[#00ccff] animate-pulse delay-150"></div>
                <div className="w-2 h-2 rounded-full bg-[#1a1aff] animate-pulse delay-300"></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-[#00e6e6]/20 flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 bg-[#0a0f16] border border-[#00e6e6]/20 rounded-full px-4 py-2 focus:outline-none focus:border-[#00e6e6] text-white"
        />
        <button
          type="button"
          onClick={toggleCall}
          className={`w-10 h-10 rounded-full ${
            isSessionActive 
              ? 'bg-gradient-to-r from-[#ff0000]/20 via-[#ff0000]/20 to-[#ff0000]/20 text-[#ff0000]' 
              : 'bg-gradient-to-r from-[#00e6e6]/20 via-[#00ccff]/20 to-[#1a1aff]/20 text-[#00e6e6]'
          } flex items-center justify-center hover:text-[#00ccff] transition-colors`}
        >
          <Mic size={18} />
        </button>
        <button
          type="submit"
          className="w-10 h-10 rounded-full bg-gradient-to-r from-[#00e6e6] via-[#00ccff] to-[#1a1aff] flex items-center justify-center text-white hover:opacity-90 transition-opacity animate-gradient"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}