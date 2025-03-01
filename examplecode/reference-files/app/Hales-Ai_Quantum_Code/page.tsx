"use client";

import { useEffect, useRef, useState } from 'react';
import './styles.css';

// Constants
const INCREASE_RATE = 500000; // Rate of increase per 50ms
const prophecies = [
  "Through this portal, witness the dance of entangled qubits",
  "Dare to collapse the quantum realm's mysteries",
  "In superposition lies the truth of reality",
  "Two qubits, one destiny, infinite possibilities",
  "Where classical ends, quantum begins",
  "The multiverse awaits your observation"
];

const explanations = [
  (results: Record<string, number>) => 
    `🌌 NOW YOU'VE DONE IT! You just collapsed the quantum wavefunction! Both qubits decided to chill in their ground state (|00⟩), while in those universes, they got excited and jumped to |11⟩. Schrödinger's cat is both laughing and facepalming right now!`,
  
  (results: Record<string, number>) => 
    `🎲 HOLY QUANTUM CHAOS! You just forced all those quantum measurements to pick a side! The results show that the 00 universe went "meh"  and 11 universes  went "WOOHOO!" (|11⟩). Einstein is probably rolling in his quantum grave!`,
  
  (results: Record<string, number>) => 
    `🌟 MULTIVERSE ALERT! Your quantum meddling just created a split in reality! In all those timelines, both qubits are playing it cool in |00⟩, while in the alternative realities, they're having a party in |11⟩. Somewhere in the multiverse, a butterfly just caused a hurricane by quantum tunneling through a black hole!`,
  
  (results: Record<string, number>) => 
    `⚛️ QUANTUM SHENANIGANS DETECTED! You just entangled two qubits so hard that the quantum physicists felt a disturbance in the force! The results show measurements of |00⟩ (boring classical reality) and '11' measurements of |11⟩ (party time in quantum land). Even the Heisenberg Uncertainty Principle is uncertain about what just happened!`,
  
  (results: Record<string, number>) => 
    `🎭 REALITY CHECK: You just made  quantum measurements without breaking this universe! However the others are toast! In '00 the qubits chose to Netflix and chill (|00⟩), and 11 they decided to hit the quantum dance floor (|11⟩). The Copenhagen Interpretation is both impressed and confused!`
];

export default function HalesAIQuantumCode() {
  // Audio refs
  const backgroundMusicRef = useRef<HTMLAudioElement>(null);
  const hoverSoundRef = useRef<HTMLAudioElement>(null);
  const clickSoundRef = useRef<HTMLAudioElement>(null);
  const explanationHoverSoundRef = useRef<HTMLAudioElement>(null);
  const explanationClickSoundRef = useRef<HTMLAudioElement>(null);

  // State management
  const [collapseCount, setCollapseCount] = useState(0);
  const [universeCount, setUniverseCount] = useState(0);
  const [showSoundMessage, setShowSoundMessage] = useState(true);
  const [measurementText, setMeasurementText] = useState("Awaiting quantum manifestation...");
  const [showExplanation, setShowExplanation] = useState(false);
  const [explanationText, setExplanationText] = useState("");
  const [currentProphecy, setCurrentProphecy] = useState(prophecies[0]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [quantumStates, setQuantumStates] = useState("");
  const [currentResults, setCurrentResults] = useState<Record<string, number> | null>(null);

  // Refs for animation
  const autoIncrementRef = useRef(false);
  const lastUpdateTimeRef = useRef(0);

  // Sound initialization
  useEffect(() => {
    const initializeSound = async () => {
      if (backgroundMusicRef.current) {
        backgroundMusicRef.current.volume = 0;
        backgroundMusicRef.current.muted = false;
        try {
          await backgroundMusicRef.current.play();
          // Fade in volume
          let vol = 0;
          const fadeIn = setInterval(() => {
            if (vol < 0.9) {
              vol += 0.1;
              if (backgroundMusicRef.current) {
                backgroundMusicRef.current.volume = vol;
              }
            } else {
              clearInterval(fadeIn);
            }
          }, 100);
        } catch (error) {
          console.error('Error playing background music:', error);
        }
      }
      setShowSoundMessage(false);
    };

    document.addEventListener('click', initializeSound, { once: true });
    return () => document.removeEventListener('click', initializeSound);
  }, []);

  // Prophecy rotation
  useEffect(() => {
    const interval = setInterval(() => {
      const nextIndex = (prophecies.indexOf(currentProphecy) + 1) % prophecies.length;
      setCurrentProphecy(prophecies[nextIndex]);
    }, 8000);

    return () => clearInterval(interval);
  }, [currentProphecy]);

  // Auto increment universe counter
  useEffect(() => {
    if (!autoIncrementRef.current) return;

    const updateCounter = (currentTime: number) => {
      const elapsed = currentTime - lastUpdateTimeRef.current;
      if (elapsed >= 50) { // Every 50ms
        setUniverseCount(prev => prev + INCREASE_RATE);
        lastUpdateTimeRef.current = currentTime;
      }
      requestAnimationFrame(updateCounter);
    };

    requestAnimationFrame(updateCounter);
  }, []);

  // Quantum measurement simulation
  const getQuantumMeasurement = async () => {
    try {
      console.log('Fetching quantum measurements from server...');
      const response = await fetch('http://127.0.0.1:5000/quantum-measurement', {
        method: 'GET'
      });
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      const data = await response.json();
      
      // Convert the quantum results to our expected format
      const results: Record<string, number> = {
        '00': data['00'] || 0,
        '11': data['11'] || 0
      };
      console.log('Received quantum measurements:', data, 'Formatted results:', results);
      return results;
    } catch (error) {
      console.error('Error fetching quantum measurements:', error);
      console.log('Falling back to equal superposition...');
      setMeasurementText('Error connecting to quantum server, using simulated results');
      return { '00': 512, '11': 512 }; // Fallback to equal superposition if server fails
    }
  };

  // Display quantum states with animation
  const displayQuantumStates = (results: Record<string, number>) => {
    setCurrentResults(results);
    let counter00 = 0;
    let counter11 = 0;
    const finalCount00 = results['00'];
    const finalCount11 = results['11'];
    const totalFrames = 50;
    let currentFrame = 0;

    const animation = setInterval(() => {
      if (currentFrame >= totalFrames) {
        clearInterval(animation);
        setIsProcessing(false);
        setMeasurementText('Quantum state collapsed!');
        return;
      }

      counter00 = Math.floor((finalCount00 / totalFrames) * currentFrame);
      counter11 = Math.floor((finalCount11 / totalFrames) * currentFrame);

      setQuantumStates(`|00⟩: ${counter00} measurements\n|11⟩: ${counter11} measurements`);
      currentFrame++;
    }, 50);
  };

  const handleCollapseClick = async () => {
    if (isProcessing) return;

    setIsProcessing(true);
    if (clickSoundRef.current) {
      clickSoundRef.current.currentTime = 0;
      clickSoundRef.current.play().catch(() => {});
    }

    // Update counters
    setCollapseCount(prev => prev + 1);
    const destroyedUniverses = Math.floor(136556430 * Math.random());
    setUniverseCount(prev => prev + destroyedUniverses);

    // Start auto-increment if not started
    if (!autoIncrementRef.current) {
      autoIncrementRef.current = true;
      lastUpdateTimeRef.current = performance.now();
    }

    // Reset displays
    setShowExplanation(false);
    setMeasurementText('Collapsing quantum wavefunction...');
    setQuantumStates('');

    // Simulate measurement with delay
    setTimeout(async () => {
      const results = await getQuantumMeasurement();
      displayQuantumStates(results);
    }, 1500);
  };

  const handleExplanationClick = () => {
    if (explanationClickSoundRef.current) {
      explanationClickSoundRef.current.currentTime = 0;
      explanationClickSoundRef.current.play().catch(() => {});
    }

    if (currentResults) {
      const randomExplanation = explanations[Math.floor(Math.random() * explanations.length)];
      setExplanationText(randomExplanation(currentResults));
      setShowExplanation(true);
    }
  };

  return (
    <>
      {/* Audio elements */}
      <audio ref={backgroundMusicRef} loop preload="auto" muted>
        <source src="/Hales-Ai_Quantum_Code/sounds/Quantum2_background_sound.mp3" type="audio/mp3" />
      </audio>
      <audio ref={hoverSoundRef} src="/Hales-Ai_Quantum_Code/sounds/hover_sound.mp3" preload="auto" />
      <audio ref={clickSoundRef} src="/Hales-Ai_Quantum_Code/sounds/on_click_sound.mp3" preload="auto" />
      <audio ref={explanationHoverSoundRef} src="/Hales-Ai_Quantum_Code/sounds/what_happened.mp3" preload="auto" />
      <audio ref={explanationClickSoundRef} src="/Hales-Ai_Quantum_Code/sounds/all_hail.mp3" preload="auto" />

      {/* Sound message */}
      {showSoundMessage && (
        <div className="sound-message">
          Click anywhere to enable quantum sounds
        </div>
      )}

      {/* Background */}
      <div className="universe-bg">
        <div className="stars" />
        <div className="multiverse-rings" />
      </div>

      {/* Main interface */}
      <main className="quantum-interface">
        <div className="quantum-counters">
          <div className="counter-display">
            <span>Universes Collapsed:</span>
            <span>{collapseCount.toLocaleString()}</span>
          </div>
          <div className="counter-display">
            <span>Total Universes Destroyed:</span>
            <span>{universeCount.toLocaleString()}</span>
          </div>
        </div>

        <div className="quantum-button-container">
          <button 
            className={`quantum-button ${isProcessing ? 'processing' : ''}`}
            onClick={handleCollapseClick}
            onMouseEnter={() => {
              if (hoverSoundRef.current) {
                hoverSoundRef.current.currentTime = 0;
                hoverSoundRef.current.play().catch(() => {});
              }
            }}
            disabled={isProcessing}
          >
            <div className="button-glow" />
            <div className="button-core" />
            <span className="button-text">COLLAPSE THE WAVEFUNCTION</span>
          </button>
        </div>

        <div className="oracle-text">
          <p className="prophecy">{currentProphecy}</p>
          <div className="result-display">
            <div className="measurement-text">{measurementText}</div>
            <div className="quantum-states" style={{ whiteSpace: 'pre' }}>{quantumStates}</div>
          </div>
          
          {!showExplanation && !isProcessing && quantumStates && (
            <button 
              className="explanation-button"
              onClick={handleExplanationClick}
              onMouseEnter={() => {
                if (explanationHoverSoundRef.current) {
                  explanationHoverSoundRef.current.currentTime = 0;
                  explanationHoverSoundRef.current.play().catch(() => {});
                }
              }}
            >
              WHAT THE HELL JUST HAPPENED?!
            </button>
          )}
          
          {showExplanation && (
            <div className="quantum-explanation visible">
              <div className="explanation-text">{explanationText}</div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}