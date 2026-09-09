import React, { useState } from 'react';
import { useConversationStore } from '../state/conversationStore';
import { ObservabilityLog } from '../components/ObservabilityLog/ObservabilityLog';

export const ObservabilityDashboard: React.FC = () => {
  const events = useConversationStore((s) => s.events);
  const interruptionCount = useConversationStore((s) => s.interruptionCount);
  const staleRejectionCount = useConversationStore((s) => s.staleRejectionCount);
  const lastTurnMetrics = useConversationStore((s) => s.lastTurnMetrics);
  const ttfaHistory = useConversationStore((s) => s.ttfaHistory);

  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const exportTelemetry = () => {
    const data = {
      export_timestamp: new Date().toISOString(),
      total_events: events.length,
      interruption_count: interruptionCount,
      stale_rejections_fenced: staleRejectionCount,
      ttfa_history_ms: ttfaHistory,
      latest_turn_metrics: lastTurnMetrics,
      events: events,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `voicepilot-telemetry-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 3000);
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full px-4 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-violet-400">📊</span> Real-Time Observability & Fencing Evidence
            </h1>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-950/60 text-violet-300 border border-violet-600/30 font-mono">
              Live Stream
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Deterministic audit log of generation fences, TTS chunk cancellation, and sub-second barge-in recovery.
          </p>
        </div>

        <button
          onClick={exportTelemetry}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shadow-lg shadow-violet-950/50 transition-all active:scale-95"
        >
          <span>📥</span>
          <span>{downloadSuccess ? 'Downloaded!' : 'Export Telemetry JSON'}</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800/80">
          <div className="text-xs font-medium text-slate-400">Events Streamed</div>
          <div className="text-2xl font-extrabold font-mono text-white mt-1">
            {events.length}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">In-memory buffer (200 limit)</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800/80">
          <div className="text-xs font-medium text-slate-400">Barge-In Interruptions</div>
          <div className="text-2xl font-extrabold font-mono text-rose-400 mt-1">
            {interruptionCount}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Clean cutoffs detected</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800/80">
          <div className="text-xs font-medium text-slate-400">Stale Audio Chunks Fenced</div>
          <div className="text-2xl font-extrabold font-mono text-amber-400 mt-1">
            {staleRejectionCount}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Ghost audio rejected</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800/80">
          <div className="text-xs font-medium text-slate-400">Average TTFA</div>
          <div className="text-2xl font-extrabold font-mono text-violet-300 mt-1">
            {ttfaHistory.length > 0
              ? `${(ttfaHistory.reduce((a, b) => a + b, 0) / ttfaHistory.length).toFixed(0)} ms`
              : 'N/A'}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Time to First Audio chunk</div>
        </div>
      </div>

      {/* Main Observability Component */}
      <div className="h-[600px]">
        <ObservabilityLog />
      </div>
    </div>
  );
};
