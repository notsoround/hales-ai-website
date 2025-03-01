import React, { useState, useEffect, useRef } from 'react';
import { Send, Mic, X } from 'lucide-react';
import { vapiService } from '../services/VapiService';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  audioUrl?: string;
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
  const [isLoading, setIsLoading] = useState(false);
  const [audioPlayer, setAudioPlayer] = useState<HTMLAudioElement | null>(null);
  const [initializationAttempted, setInitializationAttempted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Initialize audio player
    const player = new Audio();
    setAudioPlayer(player);
    
    // Add welcome message
    if (messages.length === 0) {
      setMessages([
        {
          role: 'assistant',
          content: "Hello! I'm your AI assistant. How can I help you today?",
          timestamp: new Date()
        }
      ]);
    }
    
    // Initialize conversation when component mounts
    const initConversation = async () => {
      if (!initializationAttempted && vapiService.isConfigured()) {
        try {
          await vapiService.initializeConversation();
          setInitializationAttempted(true);
        } catch (error) {
          // Add a system message to inform the user
          setMessages(prev => [
            ...prev, 
            {
              role: 'assistant',
              content: "I'm having trouble connecting to my voice service. You can still chat with me, but voice features might be limited.",
              timestamp: new Date()
            }
          ]);
          setInitializationAttempted(true);
        }
      }
    };
    
    initConversation();
    
    return () => {
      if (player) {
        player.pause();
        player.src = '';
      }
    };
  }, [messages.length, initializationAttempted]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const playAudio = (url: string) => {
    if (audioPlayer && url) {
      audioPlayer.src = url;
      audioPlayer.play().catch(err => {
        console.error('Error playing audio:', err);
      });
    }
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
    
    setIsLoading(true);
    
    try {
      // Check if Vapi service is configured
      if (!vapiService.isConfigured()) {
        // If not configured, use a fallback response
        setTimeout(() => {
          const fallbackResponse = "I'm not fully configured yet. Please check your Vapi.ai API credentials in the .env file.";
          handleAssistantResponse(fallbackResponse);
        }, 1000);
        return;
      }
      
      // Send message to Vapi.ai
      const response = await vapiService.sendMessage(userMessage);
      handleAssistantResponse(response.message, response.audioUrl);
    } catch (error) {
      handleAssistantResponse("Sorry, I encountered an error processing your request. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssistantResponse = (responseText: string, audioUrl?: string) => {
    const assistantMessage: ChatMessage = {
      role: 'assistant',
      content: responseText,
      timestamp: new Date(),
      audioUrl
    };
    
    setMessages(prev => [...prev, assistantMessage]);
    onMessageReceived(responseText);
    
    // Play audio if available
    if (audioUrl) {
      playAudio(audioUrl);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-4 right-4 w-80 h-96 bg-[#0a1a2b] rounded-2xl shadow-xl border border-[#00e6e6]/20 flex flex-col overflow-hidden z-50">
      {/* Header */}
      <div className="p-3 border-b border-[#00e6e6]/20 flex justify-between items-center bg-gradient-to-r from-[#00e6e6]/10 via-[#00ccff]/10 to-[#1a1aff]/10 animate-gradient">
        <h3 className="font-semibold text-[#00e6e6]">Hales AI Assistant</h3>
        <button 
          onClick={onClose}
          className="text-[#00e6e6] hover:text-[#00ccff] transition-colors"
        >
          <X size={18} />
        </button>
      </div>
      
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map((msg, index) => (
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
              <div className="text-xs opacity-50 mt-1 flex justify-between items-center">
                <span>
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                {msg.role === 'assistant' && msg.audioUrl && (
                  <button 
                    onClick={() => playAudio(msg.audioUrl!)}
                    className="ml-2 text-[#00e6e6] hover:text-[#00ccff]"
                  >
                    <Mic size={12} />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
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
          className="w-10 h-10 rounded-full bg-gradient-to-r from-[#00e6e6]/20 via-[#00ccff]/20 to-[#1a1aff]/20 flex items-center justify-center text-[#00e6e6] hover:text-[#00ccff] transition-colors"
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