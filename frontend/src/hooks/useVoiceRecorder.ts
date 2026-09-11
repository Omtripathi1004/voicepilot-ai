// VoicePilot AI — useVoiceRecorder Hook
// Robust microphone access, VAD waveform analysis, and speech recognition
// with mobile support (iOS Safari, Android Chrome) and clear user guidance.
import { useCallback, useEffect, useRef, useState } from 'react';
import { wsService } from '../services/websocketService';
import { useConversationStore } from '../state/conversationStore';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
    webkitAudioContext: any;
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
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const isListeningRef = useRef(false);
  const speechTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSpeechRef = useRef('');

  const store = useConversationStore();

  useEffect(() => {
    const SpeechRecognition =
      (typeof window !== 'undefined' && (window.SpeechRecognition || (window as any).webkitSpeechRecognition)) || null;
    setIsSupported(!!SpeechRecognition);
    return () => {
      stopListening();
    };
  }, []);

  const startAudioAnalysis = useCallback(async () => {
    try {
      // Use standard getUserMedia with mobile-friendly constraints
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      };

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('navigator.mediaDevices.getUserMedia is not supported or page is not served over HTTPS.');
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtxClass();
      audioCtxRef.current = audioCtx;

      // Resume context if suspended (common mobile Safari / Chrome autoplay policy)
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume().catch(() => {});
      }

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const updateLevel = () => {
        if (!analyserRef.current) return;
        const data = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteTimeDomainData(data);

        let sumSq = 0;
        let peak = 0;
        for (let i = 0; i < data.length; i++) {
          const norm = (data[i] - 128) / 128;
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
    } catch (e: any) {
      console.warn('[useVoiceRecorder] Audio analysis warning:', e);
      if (e?.name === 'NotAllowedError' || e?.name === 'PermissionDeniedError') {
        setError('Microphone permission was denied. Please allow microphone permissions in your mobile browser settings.');
      } else if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
        setError('Microphone requires a secure HTTPS connection. Please use HTTPS on mobile.');
      }
      // Speech recognition might still function even if AudioContext visualization has issues
    }
  }, []);

  const dispatchSpokenText = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (trimmed.length < 2) return;
      // Filter filler sounds
      if (/^(uh|um|er|ah|eh|oh|hmm)$/i.test(trimmed)) return;

      setTranscript(trimmed);
      setInterimTranscript('');
      const wasInterrupted = store.status === 'INTERRUPTED';

      if (options.onTranscript) {
        options.onTranscript(trimmed);
      } else {
        wsService.sendUserSpeech(trimmed, wasInterrupted);
      }
    },
    [options, store.status]
  );

  const startListening = useCallback(async () => {
    if (isListeningRef.current) return;

    const SpeechRecClass =
      (typeof window !== 'undefined' && (window.SpeechRecognition || (window as any).webkitSpeechRecognition)) || null;

    if (!SpeechRecClass) {
      setError(
        'Speech recognition is not supported in this mobile browser. For best results on mobile, use Google Chrome (Android) or Safari (iOS).'
      );
      return;
    }

    setError(null);
    await startAudioAnalysis();

    try {
      const recognition = new SpeechRecClass();
      // On mobile browsers, continuous mode can be flaky; setting continuous false on mobile often performs better,
      // but continuous with auto-restart is robust if supported.
      const isMobile = typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
      recognition.continuous = !isMobile; // Mobile engines work best with discrete utterances that restart seamlessly
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 1;

      pendingSpeechRef.current = '';

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        // Acoustic Echo / Self-Loop Prevention:
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
          // Check intentional barge-in words
          if (/\b(stop|wait|cancel|hold on|pause|hush|interrupt|quiet|shut up)\b/i.test(rawChunkLower)) {
            wsService.sendInterrupt();
            setInterimTranscript('');
            pendingSpeechRef.current = '';
            if (speechTimerRef.current) clearTimeout(speechTimerRef.current);
          }
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
          pendingSpeechRef.current += (pendingSpeechRef.current ? ' ' : '') + currentFinal.trim();
        }

        if (speechTimerRef.current) clearTimeout(speechTimerRef.current);

        // Debounce: on mobile or desktop, wait for a short silence before firing
        const debounceDelay = isMobile ? 800 : 950;
        speechTimerRef.current = setTimeout(() => {
          const fullText = (pendingSpeechRef.current || interim).trim();
          pendingSpeechRef.current = '';
          if (fullText) {
            dispatchSpokenText(fullText);
          }
        }, debounceDelay);
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.warn('[useVoiceRecorder] recognition error:', event.error);
        if (event.error === 'no-speech') {
          // Normal when silent, don't show error banner
          return;
        }
        if (event.error === 'not-allowed') {
          setError('Microphone permission blocked. Please enable microphone access in browser settings.');
          stopListening();
          return;
        }
        if (event.error === 'network') {
          setError('Network issue with speech recognition engine. Ensure internet access.');
          return;
        }
        setError(`Speech recognition notice: ${event.error}`);
      };

      recognition.onend = () => {
        if (speechTimerRef.current) clearTimeout(speechTimerRef.current);

        // If there was speech remaining when mobile speech recognition ended, dispatch it!
        if (pendingSpeechRef.current) {
          const speechToSend = pendingSpeechRef.current;
          pendingSpeechRef.current = '';
          dispatchSpokenText(speechToSend);
        }

        // Auto-restart if user hasn't toggled off
        if (isListeningRef.current && options.autoRestart !== false) {
          setTimeout(() => {
            if (isListeningRef.current) {
              try {
                recognition.start();
              } catch (err) {
                // If start() fails because recognition is already running or browser threw
                console.info('[useVoiceRecorder] restart attempt');
              }
            }
          }, 150);
        } else {
          setIsListening(false);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
      isListeningRef.current = true;
      setIsListening(true);
    } catch (err: any) {
      console.error('[useVoiceRecorder] start error:', err);
      setError(err?.message || 'Could not start voice recognition.');
      setIsListening(false);
    }
  }, [startAudioAnalysis, options, dispatchSpokenText]);

  const stopListening = useCallback(() => {
    isListeningRef.current = false;
    if (speechTimerRef.current) {
      clearTimeout(speechTimerRef.current);
      speechTimerRef.current = null;
    }

    try {
      recognitionRef.current?.stop();
    } catch (e) {
      // ignore
    }
    recognitionRef.current = null;

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
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
