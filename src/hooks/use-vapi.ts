"use client"

import { useEffect, useRef, useState, useCallback } from 'react';
import VapiImport from '@vapi-ai/web';

// Vite/CJS interop: @vapi-ai/web is CJS (`exports.default = Vapi`). Depending
// on the bundler, the default import is either the constructor or
// `{ default: Constructor }`. `new imported(key)` then becomes
// `new Module.default(key)` in the live bundle and throws
// "X.default is not a constructor".
type VoiceMessage = { type?: string; transcriptType?: string; role?: string; transcript?: string };
type VapiEvents = {
    'call-start': () => void;
    'call-end': () => void;
    'volume-level': (volume: number) => void;
    message: (message: VoiceMessage) => void;
    error: (error: unknown) => void;
};
type VapiCtor = new (publicKey: string) => {
    on: <K extends keyof VapiEvents>(event: K, handler: VapiEvents[K]) => void;
    start: (assistantId: string) => Promise<unknown>;
    stop: () => Promise<void>;
};

function resolveVapiCtor(mod: unknown): VapiCtor {
    let current: unknown = mod;
    for (let i = 0; i < 4 && current; i += 1) {
        if (typeof current === 'function') return current as VapiCtor;
        if (typeof current !== 'object' || !('default' in current)) break;
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

function announceVoice(active: boolean, level = 0) {
    window.dispatchEvent(new CustomEvent('hales:voice-level', { detail: { active, level } }));
}

const useVapi = () => {
    const [volumeLevel, setVolumeLevel] = useState(0);
    const [isSessionActive, setIsSessionActive] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState('');
    const [conversation, setConversation] = useState<{ role: string, text: string }[]>([]);
    const vapiRef = useRef<InstanceType<VapiCtor> | null>(null);
    const mounted = useRef(false);
    const active = useRef(false);
    const pending = useRef(false);
    const cancelled = useRef(false);
    const stopFailed = useRef(false);
    const stopping = useRef(new WeakMap<InstanceType<VapiCtor>, Promise<void>>());

    const stopInstance = useCallback((instance: InstanceType<VapiCtor>) => {
        const operation = (async () => {
            try {
                await instance.stop();
                if (mounted.current && vapiRef.current === instance) stopFailed.current = false;
            } catch {
                if (mounted.current && vapiRef.current === instance) {
                    stopFailed.current = true;
                    setError('Voice could not fully stop. Press the voice button again to retry ending the call, or close this tab to release the microphone.');
                }
            }
        })();
        stopping.current.set(instance, operation);
        void operation.then(() => {
            if (stopping.current.get(instance) === operation) stopping.current.delete(instance);
        });
        return operation;
    }, []);

    useEffect(() => {
        mounted.current = true;
        const instance = new Vapi(publicKey);
        vapiRef.current = instance;
        const current = () => mounted.current && vapiRef.current === instance;
        const reset = () => {
            active.current = false;
            setIsSessionActive(false);
            setVolumeLevel(0);
            announceVoice(false);
        };
        instance.on('call-start', () => {
            if (!current() || cancelled.current) { void stopInstance(instance); return; }
            active.current = true;
            setIsSessionActive(true);
            setIsConnecting(false);
            announceVoice(true);
        });
        instance.on('call-end', () => {
            if (!current()) return;
            cancelled.current = true;
            reset();
            setConversation([]);
        });
        instance.on('volume-level', (volume: number) => {
            if (!current() || !active.current || cancelled.current) return;
            const level = Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 0;
            setVolumeLevel(level);
            announceVoice(true, level);
        });
        instance.on('message', (message: VoiceMessage) => {
            if (!current() || cancelled.current) return;
            if (message.type === 'transcript' && message.transcriptType === 'final' && typeof message.transcript === 'string') {
                setConversation(prev => [...prev.slice(-39), { role: message.role ?? 'assistant', text: message.transcript! }]);
            }
        });
        instance.on('error', (event: unknown) => {
            if (!current() || cancelled.current) return;
            if (event && typeof event === 'object' && 'type' in event &&
                (event.type === 'audio-processing-setup-error' || event.type === 'audio-processor-recovery-error')) return;
            cancelled.current = true;
            reset();
            setError('Voice could not connect. Check microphone permission and your connection, then try again.');
            void stopInstance(instance);
        });
        return () => {
            mounted.current = false;
            cancelled.current = true;
            vapiRef.current = null;
            void stopInstance(instance);
            announceVoice(false);
        };
    }, [stopInstance]);

    const toggleCall = useCallback(async () => {
        const instance = vapiRef.current;
        if (!instance) return;
        const current = () => mounted.current && vapiRef.current === instance;
        const closing = stopping.current.get(instance);
        if (closing) { await closing; return; }
        if (active.current || pending.current || stopFailed.current) {
            cancelled.current = true;
            active.current = false;
            setIsSessionActive(false);
            setVolumeLevel(0);
            setConversation([]);
            announceVoice(false);
            await stopInstance(instance);
            return;
        }
        pending.current = true;
        cancelled.current = false;
        setIsConnecting(true);
        setError('');
        const timer = window.setTimeout(() => {
            if (!current() || active.current || cancelled.current) return;
            cancelled.current = true;
            setError('The voice connection is taking too long. You can keep exploring or use text chat.');
            announceVoice(false);
            void stopInstance(instance);
        }, 25000);
        try {
            const result = await instance.start(assistantId);
            if (!current() || cancelled.current) { await stopInstance(instance); return; }
            if (!result) throw new Error('Voice connection unavailable');
        } catch {
            if (current() && !cancelled.current) {
                cancelled.current = true;
                active.current = false;
                setIsSessionActive(false);
                setVolumeLevel(0);
                announceVoice(false);
                setError('Voice could not connect. Check microphone permission and your connection, then try again.');
                await stopInstance(instance);
            }
        } finally {
            window.clearTimeout(timer);
            pending.current = false;
            if (current()) setIsConnecting(false);
        }
    }, [stopInstance]);

    return { volumeLevel, isSessionActive, isConnecting, error, conversation, toggleCall };
};

export default useVapi;
