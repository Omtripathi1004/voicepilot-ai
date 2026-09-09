import React, { useState, useEffect } from 'react';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import { wsService } from '../services/websocketService';
import { useConversationStore } from '../state/conversationStore';
import { StatusIndicator } from '../components/StatusIndicator/StatusIndicator';
import { WaveformVisualizer } from '../components/WaveformVisualizer/WaveformVisualizer';
import { InterruptButton } from '../components/InterruptButton/InterruptButton';
import { VoiceSelector } from '../components/VoiceSelector/VoiceSelector';
import { ConversationTranscript } from '../components/ConversationTranscript/ConversationTranscript';
import { ToolTimeline } from '../components/ToolTimeline/ToolTimeline';
import { MetricsPanel } from '../components/MetricsPanel/MetricsPanel';

export const AgentConsole: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const status = useConversationStore((s) => s.status);
  const connected = useConversationStore((s) => s.connected);
  const isPlaying = useConversationStore((s) => s.isPlaying);

  const {
    isListening,
    audioLevel,
    interimTranscript,
    isSupported,
    error: micError,
    toggleListening,
  } = useVoiceRecorder({
    onTranscript: (spoken) => {
      if (spoken.trim()) {
        wsService.sendUserSpeech(spoken.trim(), false);
      }
    },
  });

  // Handle keyboard shortcuts (Escape or Space to interrupt)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === 'Escape' || (e.key === ' ' && isPlaying)) {
        e.preventDefault();
        wsService.sendInterrupt();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying]);

  const handleSendText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    wsService.sendUserSpeech(inputText.trim(), false);
    setInputText('');
  };

  const handleQuickPrompt = (prompt: string) => {
    wsService.sendUserSpeech(prompt, false);
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full px-4 py-6">
      {/* Top Cockpit Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md shadow-xl">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold tracking-tight text-white flex items-center gap-2">
              <span className="text-2xl">🎙️</span> VoicePilot AI
            </h1>
            <span className="px-2 py-0.5 rounded-full bg-violet-950/80 text-violet-300 border border-violet-600/40 text-[10px] font-mono font-semibold">
              Rime Mist Native
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Real-Time Interruptible Voice Agent • Generation-Fenced Cancellation • Sub-150ms TTFA
          </p>
        </div>

        <StatusIndicator />
      </div>

      {/* Main Grid: Left Stage (Voice & Transcript), Right Telemetry (Tools, Metrics, Voice Config) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (7 cols): Active Audio Interaction & Dialogue */}
        <div className="lg:col-span-7 flex flex-col gap-5">
          {/* Waveform & Audio Stage */}
          <div className="flex flex-col gap-3 p-5 rounded-3xl bg-gradient-to-b from-slate-900/90 to-slate-950/90 border border-slate-800/80 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 uppercase tracking-wider">
                <span>Acoustic Waveform</span>
                {isListening && (
                  <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-mono">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                    Mic Live
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-500 font-mono">
                {audioLevel.rms > 0 ? `RMS: ${(audioLevel.rms * 100).toFixed(1)}%` : 'No Signal'}
              </div>
            </div>

            <WaveformVisualizer micLevel={audioLevel.rms} />

            {/* Interim Transcript Live Display */}
            {interimTranscript && (
              <div className="px-3 py-2 rounded-xl bg-slate-800/60 border border-slate-700/60 text-xs text-slate-300 italic flex items-center gap-2 animate-pulse">
                <span className="text-slate-500">Heard:</span>
                <span>"{interimTranscript}"</span>
              </div>
            )}

            {/* Primary Action Controls: Mic Toggle & Barge-In Button */}
            <div className="flex flex-wrap items-center justify-center sm:justify-between gap-4 pt-2">
              <div className="flex items-center gap-3">
                {/* Push to Talk / Mic Toggle */}
                <button
                  onClick={toggleListening}
                  className={`group relative flex items-center gap-2.5 px-6 py-3.5 rounded-2xl font-semibold text-sm transition-all duration-200 shadow-xl select-none ${
                    isListening
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-emerald-950/60 ring-2 ring-emerald-400/50 scale-105'
                      : 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white hover:brightness-110 shadow-indigo-950/50'
                  }`}
                >
                  <span className="text-lg">
                    {isListening ? '⏹' : '🎙'}
                  </span>
                  <span>{isListening ? 'Stop Listening' : 'Start Voice Conversation'}</span>
                </button>

                {!isSupported && (
                  <span className="text-xs text-amber-400 max-w-xs">
                    (Web Speech API not detected; type prompts below)
                  </span>
                )}
                {micError && (
                  <span className="text-xs text-rose-400">{micError}</span>
                )}
              </div>

              {/* Instant Barge-In Interrupt Button */}
              <InterruptButton size="large" />
            </div>
          </div>

          {/* Transcript Component */}
          <div className="h-[420px]">
            <ConversationTranscript />
          </div>

          {/* Text Input for Hybrid Interaction */}
          <form
            onSubmit={handleSendText}
            className="flex items-center gap-2 p-2 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-lg"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Or type a command... (e.g. 'Compute 48 * 16' or 'Explain TTS latency')"
              className="flex-1 px-4 py-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            />
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white text-xs font-semibold tracking-wide transition-all shadow-md"
            >
              Speak via Rime
            </button>
          </form>

          {/* Quick Scenario Buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs font-medium text-slate-500">Try testing:</span>
            {[
              'Give me a long 4-sentence overview of quantum computing',
              'Calculate (144 * 25) + 380',
              'Set a 15-second timer for tea',
              'Simulate test delay of 4 seconds',
            ].map((p, idx) => (
              <button
                key={idx}
                onClick={() => handleQuickPrompt(p)}
                className="text-[11px] px-3 py-1 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition-all hover:text-white"
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Right Column (5 cols): Voice Engine & Telemetry Suite */}
        <div className="lg:col-span-5 flex flex-col gap-5">
          {/* Rime Voice Config Panel */}
          <VoiceSelector />

          {/* Real-Time Metrics & Latency Breakdown */}
          <MetricsPanel />

          {/* Tool Execution Timeline & Fencing Proof */}
          <ToolTimeline />
        </div>
      </div>
    </div>
  );
};
