// VoicePilot AI — useVoiceRecorder Hook
// Handles microphone access, VAD, and speech recognition via Web Speech API.
import { useCallback, useEffect, useRef, useState } from 'react';
import { wsService } from '../services/websocketService';
import { useConversationStore } from '../state/conversationStore';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

type SpeechRecognition = any;
type SpeechRecognitionEvent = any;
type SpeechRecognitionErrorEvent = any;

interface UseVoiceRecorderOptions {
  onTranscript?: (text: string) => void;
  autoRestart?: boolean;
}

export interface AudioLevel {
  rms: number;
  peak: number;
  bars: number[];
}

export function useVoiceRecorder(options: UseVoiceRecorderOptions = {}) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState<AudioLevel>({ rms: 0, peak: 0, bars: Array(20).fill(0) });
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const isListeningRef = useRef(false);

  const store = useConversationStore();

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognition);
    return () => stopListening();
  }, []);

  const startAudioAnalysis = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const updateLevel = () => {
        if (!analyserRef.current) return;
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteTimeDomainData(data);

        let sumSq = 0;
        let peak = 0;
        for (const v of data) {
          const norm = (v - 128) / 128;
          sumSq += norm * norm;
          if (Math.abs(norm) > peak) peak = Math.abs(norm);
        }
        const rms = Math.sqrt(sumSq / data.length);

        // Build waveform bars
        const barCount = 20;
        const step = Math.floor(data.length / barCount);
        const bars = Array.from({ length: barCount }, (_, i) => {
          const slice = data.slice(i * step, (i + 1) * step);
          const avg = slice.reduce((s, v) => s + Math.abs(v - 128), 0) / slice.length;
          return avg / 128;
        });

        setAudioLevel({ rms, peak, bars });
        animFrameRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();
    } catch (e) {
      setError('Microphone access denied. Please allow microphone access.');
    }
  }, []);

  const startListening = useCallback(async () => {
    if (isListeningRef.current) return;

    const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Speech recognition not supported in this browser. Use Chrome or Edge.');
      return;
    }

    setError(null);
    await startAudioAnalysis();

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    let pendingSpeech = '';
    let speechTimer: ReturnType<typeof setTimeout> | null = null;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      // 1. Acoustic Echo / Self-Loop Prevention:
      // When the assistant is actively speaking, ignore speaker bleed so the AI does not talk to itself!
      const currentStore = useConversationStore.getState();
      const isAssistantSpeaking =
        currentStore.isPlaying ||
        currentStore.status === 'SPEAKING' ||
        (typeof window !== 'undefined' && window.speechSynthesis && window.speechSynthesis.speaking);

      let rawChunk = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        rawChunk += ' ' + event.results[i][0].transcript;
      }
      const rawChunkLower = rawChunk.toLowerCase().trim();

      if (isAssistantSpeaking) {
        // Check if user is speaking an intentional barge-in command
        if (/\b(stop|wait|cancel|hold on|pause|hush|interrupt|quiet)\b/i.test(rawChunkLower)) {
          wsService.sendInterrupt();
          setInterimTranscript('');
          pendingSpeech = '';
          if (speechTimer) clearTimeout(speechTimer);
        }
        // Discard speaker output so it doesn't loop
        return;
      }

      let interim = '';
      let currentFinal = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          currentFinal += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      setInterimTranscript(interim);

      if (currentFinal) {
        pendingSpeech += (pendingSpeech ? ' ' : '') + currentFinal.trim();
      }

      // Reset debounce timer on any new speech input
      if (speechTimer) clearTimeout(speechTimer);

      // Debounce: Wait 1100ms of quiet before sending the finalized speech (allows natural pauses between words)
      speechTimer = setTimeout(() => {
        const fullText = (pendingSpeech || (interim.length > 5 ? interim : '')).trim();
        pendingSpeech = '';

        // Ignore short filler noise or single stray syllables
        if (fullText.length >= 3 && !/^(uh|um|er|ah|eh|oh)$/i.test(fullText)) {
          setTranscript(fullText);
          setInterimTranscript('');
          const wasInterrupted = store.status === 'INTERRUPTED';

          if (options.onTranscript) {
            options.onTranscript(fullText);
          } else {
            wsService.sendUserSpeech(fullText, wasInterrupted);
          }
        }
      }, 1100);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'no-speech') return; // normal
      setError(`Speech recognition error: ${event.error}`);
    };

    recognition.onend = () => {
      if (speechTimer) clearTimeout(speechTimer);
      if (isListeningRef.current && options.autoRestart !== false) {
        // Auto-restart for continuous listening
        setTimeout(() => {
          if (isListeningRef.current) {
            recognition.start();
          }
        }, 100);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    isListeningRef.current = true;
    setIsListening(true);
  }, [startAudioAnalysis, options, store.status]);

  const stopListening = useCallback(() => {
    isListeningRef.current = false;
    recognitionRef.current?.stop();
    recognitionRef.current = null;

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    analyserRef.current = null;
    setIsListening(false);
    setAudioLevel({ rms: 0, peak: 0, bars: Array(20).fill(0) });
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) stopListening();
    else startListening();
  }, [isListening, startListening, stopListening]);

  return {
    isListening,
    isSupported,
    error,
    audioLevel,
    transcript,
    interimTranscript,
    startListening,
    stopListening,
    toggleListening,
  };
}
