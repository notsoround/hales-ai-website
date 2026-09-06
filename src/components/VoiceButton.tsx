import { useEffect, useCallback, useState } from 'react';
import { Mic, Square } from 'lucide-react';
import useVapi from '../hooks/use-vapi';

interface VoiceButtonProps {
  onStart?: () => void;
  onStop?: () => void;
  onMessage?: (message: string) => void;
  className?: string;
  compact?: boolean;
}

export function VoiceButton({ onStart, onStop, onMessage, className = '', compact = false }: VoiceButtonProps) {
  const [isHovering, setIsHovering] = useState(false);
  const { volumeLevel, isSessionActive, isConnecting, error, conversation, toggleCall } = useVapi();

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
    if (isSessionActive || isConnecting) onStop?.();
    else onStart?.();
    await toggleCall();
  }, [isSessionActive, isConnecting, onStart, onStop, toggleCall]);
  const isTalking = isSessionActive;
  const isBusy = isConnecting && !isTalking;
  const label = isTalking ? 'Live — tap to end' : isBusy ? 'Connecting — cancel' : isHovering ? 'Tap to start a live call' : 'Talk to our AI';

  // 7 waveform bars, center-weighted, driven by live volume
  const bars = [0.45, 0.7, 0.9, 1, 0.9, 0.7, 0.45];
  const vol = Math.min(volumeLevel ?? 0, 1);

  if (compact) return <div className="hx-voice-control"><button type="button" onClick={handleClick} aria-pressed={isTalking} className="hx-compact-voice">
    {isTalking ? <Square size={16}/> : <Mic size={18}/>}
    <span>{label}</span>
    <span className="hx-mini-wave" aria-hidden="true">{bars.map((weight, index) => <i key={index} style={{height: `${4 + (isTalking ? vol * 22 : 4) * weight}px`}}/>)}</span>
  </button>{error && <p className="hx-voice-error" role="status">{error}</p>}</div>;

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

      {error && <p className="max-w-xs text-sm text-amber-200" role="status">{error}</p>}
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
