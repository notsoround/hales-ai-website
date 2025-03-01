"use client"

import { useEffect, useRef, useState, useCallback } from 'react';
import Vapi from '@vapi-ai/web';

// Hardcode the values directly
const publicKey = 'e73916ba-515a-4a6e-85ff-dc208385eb9e';
const assistantId = '1ec0bb05-5e47-4f1d-9857-03e1c5d793ec';

const useVapi = () => {
    const [volumeLevel, setVolumeLevel] = useState(0);
    const [isSessionActive, setIsSessionActive] = useState(false);
    const [conversation, setConversation] = useState<{ role: string, text: string }[]>([]);
    const vapiRef = useRef<any>(null);

    const initializeVapi = useCallback(() => {
        try {
            if (!vapiRef.current) {
                console.log('Initializing Vapi with config:', { publicKey, assistantId });
                const vapiInstance = new Vapi(publicKey);
                console.log('Vapi instance created successfully');
                vapiRef.current = vapiInstance;

                vapiInstance.on('call-start', () => {
                    console.log('Vapi call started');
                    setIsSessionActive(true);
                });

                vapiInstance.on('call-end', () => {
                    console.log('Vapi call ended');
                    setIsSessionActive(false);
                    setConversation([]);
                });

                vapiInstance.on('volume-level', (volume: number) => {
                    setVolumeLevel(volume);
                });

                vapiInstance.on('message', (message: any) => {
                    console.log('Vapi message received:', message);
                    if (message.type === 'transcript' && message.transcriptType === 'final') {
                        setConversation((prev) => [
                            ...prev,
                            { role: message.role, text: message.transcript },
                        ]);
                    }
                });

                vapiInstance.on('error', (e: Error) => {
                    console.error('Vapi error details:', {
                        message: e.message,
                        stack: e.stack,
                        name: e.name
                    });
                });
            }
        } catch (error) {
            const err = error as Error;
            console.error('Error initializing Vapi:', {
                message: err.message,
                stack: err.stack,
                name: err.name
            });
        }
    }, []);

    useEffect(() => {
        console.log('useEffect running, initializing Vapi');
        initializeVapi();
        return () => {
            if (vapiRef.current) {
                console.log('Cleaning up Vapi instance');
                vapiRef.current.stop();
                vapiRef.current = null;
            }
        };
    }, [initializeVapi]);

    const toggleCall = async () => {
        try {
            console.log('Toggle call clicked, current state:', {
                isSessionActive,
                hasVapiInstance: !!vapiRef.current
            });
            
            if (!vapiRef.current) {
                console.log('No Vapi instance found, reinitializing');
                initializeVapi();
                // Wait a bit for initialization
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            if (!vapiRef.current) {
                throw new Error('Failed to initialize Vapi instance');
            }
            
            if (isSessionActive) {
                console.log('Stopping Vapi call');
                await vapiRef.current.stop();
            } else {
                console.log('Attempting to start Vapi call with assistant:', assistantId);
                await vapiRef.current.start(assistantId);
                console.log('Vapi call started successfully');
            }
        } catch (err) {
            const error = err as Error;
            console.error('Error toggling Vapi session:', {
                message: error.message,
                stack: error.stack,
                name: error.name
            });
        }
    };

    return { volumeLevel, isSessionActive, conversation, toggleCall };
};

export default useVapi;