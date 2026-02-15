import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Mic, Volume2 } from 'lucide-react';
import { gsap } from 'gsap';
import useVapi from '../hooks/use-vapi';

interface VoiceButtonProps {
  onStart?: () => void;
  onStop?: () => void;
  onMessage?: (message: string) => void;
  className?: string;
}

export function VoiceButton({ onStart, onStop, onMessage, className = '' }: VoiceButtonProps) {
  // Button states
  const STATES = {
    INITIAL: 'initial',
    HOVER: 'hover',
    LOADING: 'loading',
    TALKING: 'talking',
    STOPPING: 'stopping'
  };

  const [buttonState, setButtonState] = useState(STATES.INITIAL);
  const [isHovering, setIsHovering] = useState(false);
  const { volumeLevel, isSessionActive, conversation, toggleCall } = useVapi();
  const textRef = useRef<HTMLSpanElement>(null);

  // State machine transitions
  useEffect(() => {
    switch (buttonState) {
      case STATES.LOADING:
        if (isSessionActive) {
          setButtonState(STATES.TALKING);
        }
        break;
      case STATES.STOPPING:
        if (!isSessionActive) {
          setButtonState(STATES.INITIAL);
        }
        break;
      case STATES.TALKING:
        if (!isSessionActive) {
          setButtonState(STATES.INITIAL);
        }
        break;
      case STATES.INITIAL:
      case STATES.HOVER:
        if (isSessionActive) {
          setButtonState(STATES.TALKING);
        }
        break;
    }
  }, [isSessionActive, buttonState, STATES]);

  // Handle hover state
  useEffect(() => {
    if (buttonState === STATES.INITIAL && isHovering) {
      setButtonState(STATES.HOVER);
    } else if (buttonState === STATES.HOVER && !isHovering) {
      setButtonState(STATES.INITIAL);
    }
  }, [isHovering, buttonState, STATES]);

  // Handle loading timeout
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    if (buttonState === STATES.LOADING || buttonState === STATES.STOPPING) {
      timeoutId = setTimeout(() => {
        setButtonState(isSessionActive ? STATES.TALKING : STATES.INITIAL);
      }, 5000); // Reset state after 5 seconds if no response
    }
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [buttonState, isSessionActive, STATES]);

  // Pulse animation for the button
  useEffect(() => {
    if (!isSessionActive && textRef.current) {
      const timeline = gsap.timeline({ repeat: -1 });
      timeline.to(textRef.current, {
        scale: 1.03,
        duration: 0.8,
        ease: "power1.inOut"
      });
      timeline.to(textRef.current, {
        scale: 1,
        duration: 0.8,
        ease: "power1.inOut"
      });

      return () => {
        timeline.kill();
      };
    }
  }, [isSessionActive]);

  // Handle messages
  useEffect(() => {
    if (conversation.length > 0) {
      const lastMessage = conversation[conversation.length - 1];
      if (onMessage && lastMessage.role === 'assistant') {
        onMessage(lastMessage.text);
      }
    }
  }, [conversation, onMessage]);

  const handleClick = useCallback(async () => {
    try {
      if (!isSessionActive) {
        setButtonState(STATES.LOADING);
        onStart?.();
        await toggleCall().catch(() => {
          setButtonState(STATES.INITIAL);
          throw new Error('Failed to start call');
        });
      } else {
        setButtonState(STATES.STOPPING);
        onStop?.();
        await toggleCall().catch(() => {
          setButtonState(STATES.TALKING);
          throw new Error('Failed to stop call');
        });
      }
    } catch (error) {
      console.error('Error handling voice button click:', error);
    }
  }, [isSessionActive, onStart, onStop, toggleCall]);

  const handleMouseEnter = () => {
    setIsHovering(true);
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
  };

  const getButtonText = () => {
    switch (buttonState) {
      case STATES.INITIAL:
        return "PRESS TO TALK";
      case STATES.HOVER:
        return "GIVE IT A TRY";
      case STATES.LOADING:
        return "GIVE IT A SEC..";
      case STATES.TALKING:
        return "PRESS TO STOP";
      case STATES.STOPPING:
        return "STOPPING...";
      default:
        return "PRESS TO TALK";
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* Floating particles around the button */}
      <div className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 rounded-full bg-primary/30"
            style={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              animation: `float ${3 + Math.random() * 4}s linear ${Math.random() * 5}s infinite`
            }}
          />
        ))}
      </div>

      <button
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        disabled={buttonState === STATES.LOADING || buttonState === STATES.STOPPING}
        className={`relative group overflow-hidden rounded-full border border-primary/30 px-8 py-4 transition-all duration-300 w-full glass-panel ${buttonState === STATES.TALKING
            ? 'bg-gradient-to-r from-primary/20 via-secondary/20 to-primary/20 animate-gradient shadow-[0_0_30px_rgba(0,230,230,0.3)]'
            : 'bg-surface/30 hover:bg-surface/50 hover:border-primary/50'
          }`}
      >
        <div className="flex items-center justify-between w-full">
          <span ref={textRef} className="font-mono text-white tracking-wider font-bold">
            {getButtonText()}
          </span>

          <div className="flex items-center justify-center w-8 h-8 ml-4">
            {buttonState === STATES.TALKING ? (
              <div className="relative">
                <Volume2 size={20} className="text-primary" />
                <div
                  className="absolute inset-0 bg-primary rounded-full opacity-20 animate-pulse"
                  style={{
                    transform: `scale(${1 + volumeLevel / 100})`,
                    transition: 'transform 0.1s ease-out'
                  }}
                />
              </div>
            ) : (
              <Mic size={20} className="text-primary animate-pulse" />
            )}
          </div>
        </div>

        {/* Background glow effect */}
        <div
          className="absolute inset-0 bg-gradient-to-r from-primary/5 via-secondary/5 to-primary/5 animate-gradient"
          style={{
            opacity: buttonState === STATES.TALKING ? 0.5 : 0.2
          }}
        />

        {/* Loading/Stopping overlay */}
        {(buttonState === STATES.LOADING || buttonState === STATES.STOPPING) && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm rounded-full">
            {buttonState === STATES.LOADING ? (
              <div className="flex space-x-3">
                <div className="h-3 w-3 bg-primary rounded-full animate-[pulse_0.6s_ease-in-out_infinite]"></div>
                <div className="h-3 w-3 bg-primary rounded-full animate-[pulse_0.6s_ease-in-out_0.2s_infinite]"></div>
                <div className="h-3 w-3 bg-primary rounded-full animate-[pulse_0.6s_ease-in-out_0.4s_infinite]"></div>
              </div>
            ) : (
              <div className="w-6 h-6 border-[3px] border-primary border-t-transparent rounded-full animate-spin"></div>
            )}
          </div>
        )}
      </button>
    </div>
  );
}