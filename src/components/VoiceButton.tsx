import { useEffect, useCallback, useState } from 'react';
import { Mic, Square } from 'lucide-react';
import useVapi from '../hooks/use-vapi';

interface VoiceButtonProps {
  onStart?: () => void;
  onStop?: () => void;
  onMessage?: (message: string) => void;
  className?: string;
}

export function VoiceButton({ onStart, onStop, onMessage, className = '' }: VoiceButtonProps) {
  const STATES = {
    INITIAL: 'initial',
    HOVER: 'hover',
    LOADING: 'loading',
    TALKING: 'talking',
    STOPPING: 'stopping',
  };

  const [buttonState, setButtonState] = useState(STATES.INITIAL);
  const [isHovering, setIsHovering] = useState(false);
  const { volumeLevel, isSessionActive, conversation, toggleCall } = useVapi();

  // State machine transitions
  useEffect(() => {
    switch (buttonState) {
      case STATES.LOADING:
        if (isSessionActive) setButtonState(STATES.TALKING);
        break;
      case STATES.STOPPING:
        if (!isSessionActive) setButtonState(STATES.INITIAL);
        break;
      case STATES.TALKING:
        if (!isSessionActive) setButtonState(STATES.INITIAL);
        break;
      case STATES.INITIAL:
      case STATES.HOVER:
        if (isSessionActive) setButtonState(STATES.TALKING);
        break;
    }
  }, [isSessionActive, buttonState, STATES]);

  // Hover state
  useEffect(() => {
    if (buttonState === STATES.INITIAL && isHovering) {
      setButtonState(STATES.HOVER);
    } else if (buttonState === STATES.HOVER && !isHovering) {
      setButtonState(STATES.INITIAL);
    }
  }, [isHovering, buttonState, STATES]);

  // Loading/stopping timeout guard
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    if (buttonState === STATES.LOADING || buttonState === STATES.STOPPING) {
      timeoutId = setTimeout(() => {
        setButtonState(isSessionActive ? STATES.TALKING : STATES.INITIAL);
      }, 5000);
    }
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [buttonState, isSessionActive, STATES]);

  // Surface assistant messages
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

  const isTalking = buttonState === STATES.TALKING;
  const isBusy = buttonState === STATES.LOADING || buttonState === STATES.STOPPING;

  const label = (() => {
    switch (buttonState) {
      case STATES.HOVER: return 'Tap to start a live call';
      case STATES.LOADING: return 'Connecting…';
      case STATES.TALKING: return 'Live — tap to end';
      case STATES.STOPPING: return 'Ending call…';
      default: return 'Talk to our AI';
    }
  })();

  // 7 waveform bars, center-weighted, driven by live volume
  const bars = [0.45, 0.7, 0.9, 1, 0.9, 0.7, 0.45];
  const vol = Math.min(volumeLevel ?? 0, 1);

  return (
    <div className={`relative flex flex-col items-center ${className}`}>
      {/* Rotating conic ring */}
      <div className="relative w-32 h-32">
        <div
          className={`absolute -inset-1 rounded-full transition-opacity duration-500 ${isTalking ? 'opacity-100' : 'opacity-60'}`}
          style={{
            background: 'conic-gradient(from 0deg, #00F0FF, #7000FF, #FF0055, #00F0FF)',
            animation: `spin ${isTalking ? 3 : 9}s linear infinite`,
            filter: 'blur(6px)',
          }}
        />
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: 'conic-gradient(from 180deg, #00F0FF, #7000FF, #FF0055, #00F0FF)',
            animation: `spin ${isTalking ? 3 : 9}s linear infinite`,
            padding: '2px',
            WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
          }}
        />

        {/* Orb core */}
        <button
          onClick={handleClick}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
          disabled={isBusy}
          aria-label={label}
          className={`absolute inset-[3px] rounded-full flex items-center justify-center transition-all duration-300 backdrop-blur-xl border border-white/10 ${
            isTalking
              ? 'bg-[#0A0F1E]/80 shadow-[0_0_60px_rgba(0,240,255,0.35)]'
              : 'bg-[#0A0F1E]/90 hover:bg-[#101830]/90 shadow-[0_0_40px_rgba(112,0,255,0.2)] hover:shadow-[0_0_50px_rgba(0,240,255,0.3)]'
          } ${isBusy ? 'cursor-wait' : 'cursor-pointer'}`}
        >
          {isBusy ? (
            <div className="w-7 h-7 border-[3px] border-primary border-t-transparent rounded-full animate-spin" />
          ) : isTalking ? (
            <div className="flex items-end justify-center gap-[5px] h-10">
              {bars.map((weight, i) => (
                <span
                  key={i}
                  className="w-[5px] rounded-full bg-gradient-to-t from-primary to-secondary"
                  style={{
                    height: `${Math.max(14, (14 + 80 * weight * vol))}%`,
                    transition: 'height 0.12s ease-out',
                  }}
                />
              ))}
            </div>
          ) : (
            <Mic size={34} className="text-primary drop-shadow-[0_0_12px_rgba(0,240,255,0.6)]" />
          )}
        </button>

        {/* Stop hint while talking */}
        {isTalking && (
          <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-accent/90 border border-white/20 flex items-center justify-center shadow-lg pointer-events-none">
            <Square size={12} className="text-white" fill="currentColor" />
          </div>
        )}
      </div>

      {/* Label */}
      <div className="mt-5 text-center select-none">
        <p className={`text-sm font-semibold tracking-wide transition-colors duration-300 ${isTalking ? 'text-primary' : 'text-white/90'}`}>
          {label}
        </p>
        <p className="mt-1 text-xs text-gray-500">
          {isTalking ? 'You’re talking to Hales AI right now' : 'Live demo · no signup · ~30 seconds'}
        </p>
      </div>
    </div>
  );
}
