import React, { useEffect, useState } from 'react';
import { wsService } from './services/websocketService';
import { useConversationStore } from './state/conversationStore';
import { AgentConsole } from './pages/AgentConsole';
import { ObservabilityDashboard } from './pages/ObservabilityDashboard';
import { AcceptanceRunner } from './pages/AcceptanceRunner';
import { PronunciationLab } from './pages/PronunciationLab';
import { BenchmarkDashboard } from './pages/BenchmarkDashboard';

type Tab = 'console' | 'observability' | 'acceptance' | 'pronunciation' | 'benchmark';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('console');
  const connected = useConversationStore((s) => s.connected);
  const resetSession = useConversationStore((s) => s.reset);
  const isDemoRunning = useConversationStore((s) => s.isDemoRunning);
  const setDemoRunning = useConversationStore((s) => s.setDemoRunning);

  useEffect(() => {
    // Automatically connect WebSocket on mount
    wsService.connect();
    return () => {
      wsService.disconnect();
    };
  }, []);

  const handleRunDemo = () => {
    setDemoRunning(true);
    wsService.send({ type: 'start_demo' });
    setActiveTab('console');
    setTimeout(() => setDemoRunning(false), 8000);
  };

  const navTabs: Array<{ id: Tab; label: string; icon: string; badge?: string }> = [
    { id: 'console', label: 'Voice Cockpit', icon: '🎙️' },
    { id: 'observability', label: 'Telemetry & Events', icon: '📊' },
    { id: 'acceptance', label: 'Acceptance Runner', icon: '🛡️', badge: 'Evidence' },
    { id: 'pronunciation', label: 'Pronunciation Lab', icon: '🗣️' },
    { id: 'benchmark', label: 'TTS Benchmark', icon: '⚡' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-brand-500 selection:text-white">
      {/* Top Main Navigation Header */}
      <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 px-4 py-3">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Logo & Branding */}
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-brand-600 via-indigo-600 to-violet-500 flex items-center justify-center shadow-md shadow-brand-500/20">
              <span className="text-lg font-black text-white">VP</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-tight text-white">VoicePilot AI</span>
                <span className="px-1.5 py-0.2 rounded bg-brand-950 text-brand-300 border border-brand-500/30 text-[10px] font-mono">
                  v1.0
                </span>
              </div>
              <div className="text-[11px] text-slate-400">
                Production-grade Real-Time Voice Agent with Rime TTS
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 p-1 rounded-xl bg-slate-900/90 border border-slate-800">
            {navTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <span>{tab.icon}</span>
                <span className="hidden md:inline">{tab.label}</span>
                {tab.badge && (
                  <span className="hidden lg:inline text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 font-mono">
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>

          {/* Right Action Utilities */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleRunDemo}
              disabled={isDemoRunning}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                isDemoRunning
                  ? 'bg-amber-950/40 border-amber-500/50 text-amber-300 animate-pulse'
                  : 'bg-slate-900 hover:bg-slate-800 border-slate-700/60 text-slate-300'
              }`}
              title="Runs an automatic scripted interruption demo"
            >
              <span>🎬</span>
              <span>{isDemoRunning ? 'Running Demo...' : 'Quick Demo'}</span>
            </button>

            <button
              onClick={resetSession}
              className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 text-xs transition-colors"
              title="Reset conversation state and logs"
            >
              Reset
            </button>
          </div>
        </div>
      </header>

      {/* Main Tab View Content */}
      <main className="flex-1 flex flex-col">
        {activeTab === 'console' && <AgentConsole />}
        {activeTab === 'observability' && <ObservabilityDashboard />}
        {activeTab === 'acceptance' && <AcceptanceRunner />}
        {activeTab === 'pronunciation' && <PronunciationLab />}
        {activeTab === 'benchmark' && <BenchmarkDashboard />}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-800/60 py-4 px-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>VoicePilot AI — Real-Time Voice Agent Architecture centered on Rime TTS</span>
          <span className="font-mono text-[11px] text-slate-600">
            FastAPI • WebSocket Duplex • Fenced Generations • React 18
          </span>
        </div>
      </footer>
    </div>
  );
};
