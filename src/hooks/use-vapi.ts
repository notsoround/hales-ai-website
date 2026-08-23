"use client"

import { useEffect, useRef, useState, useCallback } from 'react';
import VapiImport from '@vapi-ai/web';

// Vite/CJS interop: @vapi-ai/web is CJS (`exports.default = Vapi`). Depending
// on the bundler, the default import is either the constructor or
// `{ default: Constructor }`. `new imported(key)` then becomes
// `new Module.default(key)` in the live bundle and throws
// "X.default is not a constructor".
type VapiCtor = new (publicKey: string) => {
    on: (event: string, handler: (...args: any[]) => void) => void;
    start: (assistantId: string) => Promise<unknown>;
    stop: () => void;
};

function resolveVapiCtor(mod: unknown): VapiCtor {
    let current: any = mod;
    for (let i = 0; i < 4 && current; i += 1) {
        if (typeof current === 'function') return current as VapiCtor;
        current = current.default;
    }
    throw new Error('Vapi web SDK export is not a constructor');
}

const Vapi = resolveVapiCtor(VapiImport);

// Public *web* token (not VAPI_API_KEY) + public marketing assistant.
// Token is origin-locked to hales.ai / localhost and allowlisted to this
// assistant only — it cannot start Cupcake or any other agent.
const publicKey = '28a2818f-aba9-4e01-a0f7-315e6d8ce914';
const assistantId = '05b176e0-5a95-4777-baf1-612922bfeded';

const useVapi = () => {
    const [volumeLevel, setVolumeLevel] = useState(0);
    const [isSessionActive, setIsSessionActive] = useState(false);
    const [conversation, setConversation] = useState<{ role: string, text: string }[]>([]);
    const vapiRef = useRef<InstanceType<VapiCtor> | null>(null);

    const initializeVapi = useCallback(() => {
        if (typeof window === 'undefined') return;
        try {
            if (!vapiRef.current) {
                const vapiInstance = new Vapi(publicKey);
                vapiRef.current = vapiInstance;

                vapiInstance.on('call-start', () => {
                    setIsSessionActive(true);
                });

                vapiInstance.on('call-end', () => {
                    setIsSessionActive(false);
                    setConversation([]);
                });

                vapiInstance.on('volume-level', (volume: number) => {
                    setVolumeLevel(volume);
                });

                vapiInstance.on('message', (message: any) => {
                    if (message.type === 'transcript' && message.transcriptType === 'final') {
                        setConversation((prev) => [
                            ...prev,
                            { role: message.role, text: message.transcript },
                        ]);
                    }
                });

                vapiInstance.on('error', (e: Error) => {
                    console.error('Vapi error:', e?.message || e);
                });
            }
        } catch (error) {
            const err = error as Error;
            console.error('Error initializing Vapi:', err.message);
        }
    }, []);

    useEffect(() => {
        initializeVapi();
        return () => {
            if (vapiRef.current) {
                vapiRef.current.stop();
                vapiRef.current = null;
            }
        };
    }, [initializeVapi]);

    const toggleCall = async () => {
        try {
            if (!vapiRef.current) {
                initializeVapi();
            }

            if (!vapiRef.current) {
                throw new Error('Failed to initialize Vapi instance');
            }

            if (isSessionActive) {
                vapiRef.current.stop();
            } else {
                await vapiRef.current.start(assistantId);
            }
        } catch (err) {
            const error = err as Error;
            console.error('Error toggling Vapi session:', error.message);
            throw error;
        }
    };

    return { volumeLevel, isSessionActive, conversation, toggleCall };
};

export default useVapi;
