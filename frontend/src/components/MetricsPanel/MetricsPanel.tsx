import React from 'react';
import { useConversationStore } from '../../state/conversationStore';

export const MetricsPanel: React.FC = () => {
  const lastMetrics = useConversationStore((s) => s.lastTurnMetrics);
  const sessionMetrics = useConversationStore((s) => s.sessionMetrics);
  const ttfaHistory = useConversationStore((s) => s.ttfaHistory);
  const interruptionCount = useConversationStore((s) => s.interruptionCount);
  const staleRejectionCount = useConversationStore((s) => s.staleRejectionCount);

  // Compute average TTFA
  const avgTtfa = ttfaHistory.length > 0
    ? (ttfaHistory.reduce((a, b) => a + b, 0) / ttfaHistory.length).toFixed(0)
    : null;

  return (
    <div className="flex flex-col gap-3 p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md shadow-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
            Latency & Fencing Metrics
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-950/60 text-brand-300 border border-brand-500/30 font-mono">
            Live Telemetry
          </span>
        </div>
        {avgTtfa && (
          <span className="text-xs font-mono text-violet-400">
            Avg TTFA: <strong className="text-violet-200">{avgTtfa}ms</strong>
          </span>
        )}
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {/* TTFA */}
        <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
          <div className="text-[11px] font-medium text-slate-400">TTFA (1st Audio)</div>
          <div className="text-lg font-bold font-mono text-violet-300 mt-0.5">
            {lastMetrics?.ttfa_ms != null ? `${lastMetrics.ttfa_ms.toFixed(0)} ms` : '—'}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Target: &lt;150ms</div>
        </div>

        {/* E2E Latency */}
        <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
          <div className="text-[11px] font-medium text-slate-400">End-to-End Latency</div>
          <div className="text-lg font-bold font-mono text-blue-300 mt-0.5">
            {lastMetrics?.end_to_end_latency_ms != null
              ? `${lastMetrics.end_to_end_latency_ms.toFixed(0)} ms`
              : '—'}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Full Turn Roundtrip</div>
        </div>

        {/* Interruptions */}
        <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
          <div className="text-[11px] font-medium text-slate-400">Barge-In Interruptions</div>
          <div className="text-lg font-bold font-mono text-rose-400 mt-0.5">
            {interruptionCount || sessionMetrics?.total_interruptions || 0}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Recovered cleanly</div>
        </div>

        {/* Stale Rejections */}
        <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
          <div className="text-[11px] font-medium text-slate-400">Stale Audio Fenced</div>
          <div className="text-lg font-bold font-mono text-amber-400 mt-0.5">
            {staleRejectionCount || sessionMetrics?.total_stale_rejections || 0}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Ghost speech prevented</div>
        </div>
      </div>

      {/* Latency Pipeline Breakdown */}
      {lastMetrics && (
        <div className="pt-2 border-t border-slate-800/60">
          <div className="text-[11px] font-medium text-slate-400 mb-2">Turn Latency Breakdown</div>
          <div className="grid grid-cols-4 gap-2 text-center text-xs font-mono">
            <div className="p-1.5 rounded bg-slate-800/40 border border-slate-700/30">
              <span className="text-[10px] text-slate-500 block">STT</span>
              <span className="text-slate-300">{lastMetrics.stt_latency_ms?.toFixed(0) ?? '—'} ms</span>
            </div>
            <div className="p-1.5 rounded bg-slate-800/40 border border-slate-700/30">
              <span className="text-[10px] text-slate-500 block">Reasoning</span>
              <span className="text-slate-300">{lastMetrics.reasoning_latency_ms?.toFixed(0) ?? '—'} ms</span>
            </div>
            <div className="p-1.5 rounded bg-slate-800/40 border border-slate-700/30">
              <span className="text-[10px] text-slate-500 block">Rime TTS</span>
              <span className="text-violet-300">{lastMetrics.tts_latency_ms?.toFixed(0) ?? '—'} ms</span>
            </div>
            <div className="p-1.5 rounded bg-slate-800/40 border border-slate-700/30">
              <span className="text-[10px] text-slate-500 block">Audio Cut</span>
              <span className="text-rose-300">{lastMetrics.audio_stop_latency_ms?.toFixed(0) ?? '—'} ms</span>
            </div>
          </div>
        </div>
      )}

      {/* TTFA Sparkline History */}
      {ttfaHistory.length > 0 && (
        <div className="pt-2 border-t border-slate-800/60">
          <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
            <span>TTFA History (Last {ttfaHistory.length} turns)</span>
            <span>Latest: {ttfaHistory[ttfaHistory.length - 1].toFixed(0)} ms</span>
          </div>
          <div className="h-8 flex items-end gap-1.5 pt-1">
            {ttfaHistory.map((val, i) => {
              const maxVal = Math.max(...ttfaHistory, 300);
              const heightPercent = Math.max(15, Math.min(100, (val / maxVal) * 100));
              return (
                <div
                  key={i}
                  className="flex-1 bg-gradient-to-t from-violet-600 to-indigo-400 rounded-t transition-all hover:brightness-125"
                  style={{ height: `${heightPercent}%` }}
                  title={`Turn ${i + 1}: ${val.toFixed(0)}ms`}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
