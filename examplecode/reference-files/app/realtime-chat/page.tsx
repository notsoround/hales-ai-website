"use client";

import { useEffect, useRef, useState } from 'react';
import './styles.css';

interface Message {
  text: string;
  isUser: boolean;
}

export default function RealtimeChat() {
  // State
  const [status, setStatus] = useState('Click the button to start voice chat');
  const [isRecording, setIsRecording] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [buttonDisabled, setButtonDisabled] = useState(false);

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const conversationRef = useRef<HTMLDivElement>(null);

  const cleanup = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setButtonDisabled(false);
    setIsRecording(false);
  };

  const setupWebSocket = async () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      wsRef.current = new WebSocket('wss://hales-realtime-chat.onrender.com');

      wsRef.current.onmessage = async (event) => {
        if (typeof event.data === 'string') {
          setMessages(prev => [...prev, { text: event.data, isUser: false }]);
          if (conversationRef.current) {
            conversationRef.current.scrollTop = conversationRef.current.scrollHeight;
          }
        } else {
          const audioBlob = new Blob([event.data], { type: 'audio/mpeg' });
          const audioUrl = URL.createObjectURL(audioBlob);
          const audio = new Audio(audioUrl);
          await audio.play();
          setStatus('Listening... (Will disconnect after 30s of silence)');
          setTimeout(startRecording, 500); // Add slight delay before starting recording
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setStatus('Error processing message. Please try again.');
        cleanup();
        setButtonDisabled(false);
      };

      wsRef.current.onclose = () => {
        setStatus('Connection closed. Click Start Chat to begin new session.');
        cleanup();
        setButtonDisabled(false);
      };

      await new Promise<void>((resolve) => {
        if (wsRef.current) {
          wsRef.current.onopen = () => {
            setStatus('Connected! Starting voice chat...');
            resolve();
          };
        }
      });
    }
  };

  const startRecording = async () => {
    if (isRecording) return;

    try {
      if (!streamRef.current) {
        streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioContextRef.current = new AudioContext();
        analyserRef.current = audioContextRef.current.createAnalyser();
        const microphone = audioContextRef.current.createMediaStreamSource(streamRef.current);
        microphone.connect(analyserRef.current);
        analyserRef.current.fftSize = 2048;
      }

      audioChunksRef.current = [];
      mediaRecorderRef.current = new MediaRecorder(streamRef.current);
      setIsRecording(true);

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        setIsRecording(false);
        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(audioBlob);
            setStatus('Processing your message...');
          }
        }
      };

      let silenceStart: number | null = null;

      const checkSilence = () => {
        if (!isRecording) return;
        const analyser = analyserRef.current;
        if (!analyser) return;
        
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(dataArray);
        const sum = dataArray.reduce((a, b) => a + b, 0);
        const average = sum / bufferLength;

        if (average < 10) {
          if (!silenceStart) silenceStart = Date.now();
          else if (Date.now() - silenceStart > 2000) {
            mediaRecorderRef.current?.stop();
            silenceStart = null;
            return;
          }
        } else {
          silenceStart = null;
        }

        requestAnimationFrame(checkSilence);
      };

      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => {
        if (wsRef.current) {
          wsRef.current.close();
        }
        cleanup();
        setStatus('Disconnected due to 60s silence. Click Start Chat to begin new session.');
      }, 60000);

      mediaRecorderRef.current.start();
      setStatus('Recording... Speak now');
      checkSilence();

    } catch (error) {
      console.error('Error in startRecording:', error);
      setStatus('Error accessing microphone. Please ensure microphone permissions are granted.');
      cleanup();
    }
  };

  const handleStartClick = async () => {
    try {
      setButtonDisabled(true);
      await setupWebSocket();
      await startRecording();
    } catch (error) {
      console.error('Error starting chat:', error);
      setStatus('Error starting chat. Please try again.');
      cleanup();
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      cleanup();
    };
  }, []);

  return (
    <>
      <div className="wave-background" />
      <div className="container">
        <h1>Matts Realtime ChatGPT Voice Bot</h1>
        <div className="status">{status}</div>
        <div className="button-container">
          <button
            className="start-button"
            onClick={handleStartClick}
            disabled={buttonDisabled}
          >
            Start Chat
          </button>
          <button
            className="toggle-button"
            onClick={() => setShowChat(!showChat)}
          >
            {showChat ? 'Hide Chat' : 'Show Chat'}
          </button>
        </div>
        {showChat && (
          <div className="conversation-container" ref={conversationRef}>
            {messages.map((message, index) => (
              <div
                key={index}
                className={`message ${message.isUser ? 'user-message' : 'ai-message'}`}
              >
                {message.text}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}