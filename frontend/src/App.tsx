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

  const [showConfigModal, setShowConfigModal] = useState(false);
  const wsUrl = useConversationStore((s) => s.wsUrl);
  const setWsUrl = useConversationStore((s) => s.setWsUrl);
  const [customWsUrl, setCustomWsUrl] = useState(wsUrl);

  const handleRunDemo = () => {
    setActiveTab('console');
    wsService.sendDemoStart();
  };

  const handleSaveConnection = (e: React.FormEvent) => {
    e.preventDefault();
    if (customWsUrl.trim()) {
      setWsUrl(customWsUrl.trim());
      wsService.disconnect();
      wsService.connect(customWsUrl.trim());
      setShowConfigModal(false);
    }
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
                  : 'bg-gradient-to-r from-violet-600 to-brand-600 hover:brightness-110 text-white shadow-md shadow-brand-600/20 border-violet-500/40'
              }`}
              title="Runs an automatic real-time interruption demo"
            >
              <span>🎬</span>
              <span>{isDemoRunning ? 'Running Demo...' : 'Quick Demo'}</span>
            </button>

            <button
              onClick={() => setShowConfigModal(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs transition-colors"
              title="Configure Backend WebSocket Server URL"
            >
              <span className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-amber-400 animate-ping'}`} />
              <span className="hidden sm:inline">Settings</span>
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

      {/* Connection Config Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>⚙️</span> Backend Connection Settings
              </h3>
              <button
                onClick={() => setShowConfigModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              VoicePilot AI connects via duplex WebSocket. When hosted on Vercel, you can connect to your local backend, Docker container, or deployed cloud server (e.g., Railway/Render).
            </p>

            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs">
              <span className="text-slate-400">Current Status:</span>
              <span className={`font-semibold ${connected ? 'text-emerald-400' : 'text-amber-400'}`}>
                {connected ? '● Live Backend Connected' : '● Standalone Simulation Mode Active'}
              </span>
            </div>

            <form onSubmit={handleSaveConnection} className="flex flex-col gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  WebSocket Server Endpoint:
                </label>
                <input
                  type="text"
                  value={customWsUrl}
                  onChange={(e) => setCustomWsUrl(e.target.value)}
                  placeholder="wss://your-backend.railway.app/ws/voice"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setCustomWsUrl('ws://localhost:8000/ws/voice');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300"
                >
                  Set Localhost
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 font-semibold text-xs text-white shadow-md shadow-brand-600/30"
                >
                  Save & Connect
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
