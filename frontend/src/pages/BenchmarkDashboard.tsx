import React, { useState, useEffect } from 'react';
import { wsService } from '../services/websocketService';
import { useConversationStore } from '../state/conversationStore';

interface BenchmarkRun {
  id: string;
  timestamp: number;
  text: string;
  model_id: string;
  voice: string;
  ttfa_ms: number | null;
  total_time_ms: number;
  total_bytes: number;
  provider: string;
  is_mock: boolean;
}

const PRESET_BENCHMARK_PROMPTS = [
  { label: 'Short Utterance (5 words)', text: 'Affirmative, the task is complete.' },
  { label: 'Standard Turn (20 words)', text: 'VoicePilot detected the barge-in signal immediately and fenced off the prior generation without dropping WebSocket frames.' },
  { label: 'Complex Paragraph (50 words)', text: 'Speech synthesis in real-time conversational agents requires minimizing Time-to-First-Audio to under two hundred milliseconds. Rime Mist provides ultra-fast generation suitable for live barge-in interruptions, while maintaining crisp phonetic clarity for numbers, addresses, and technical acronyms.' },
];

export const BenchmarkDashboard: React.FC = () => {
  const [runs, setRuns] = useState<BenchmarkRun[]>([]);
  const [running, setRunning] = useState(false);
  const [currentPrompt, setCurrentPrompt] = useState(PRESET_BENCHMARK_PROMPTS[1].text);
  const rimeConfig = useConversationStore((s) => s.rimeConfig);

  useEffect(() => {
    const handler = (msg: any) => {
      if (msg.type === 'benchmark_result') {
        const run: BenchmarkRun = {
          id: `bm-${Date.now()}`,
          timestamp: Date.now(),
          text: msg.text,
          model_id: msg.rime_config?.model_id || 'mist',
          voice: msg.rime_config?.voice || 'amber',
          ttfa_ms: msg.ttfa_ms,
          total_time_ms: msg.total_time_ms,
          total_bytes: msg.total_bytes,
          provider: msg.provider || 'rime',
          is_mock: msg.is_mock,
        };
        setRuns((prev) => [run, ...prev]);
        setRunning(false);
      }
    };

    wsService.on('benchmark_result', handler);
    return () => {
      wsService.off('benchmark_result', handler);
    };
  }, []);

  const handleRunBenchmark = () => {
    if (running) return;
    setRunning(true);
    wsService.send({
      type: 'benchmark_request',
      text: currentPrompt,
    });
  };

  const clearRuns = () => setRuns([]);

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full px-4 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-violet-400">⚡</span> Rime TTS Benchmark Suite
            </h1>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-950/60 text-violet-300 border border-violet-600/30 font-mono">
              Empirical Performance
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Measure streaming TTFA, audio byte throughput, and latency bounds across varying phrase lengths.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {runs.length > 0 && (
            <button
              onClick={clearRuns}
              className="text-xs text-slate-400 hover:text-slate-200 px-3 py-2 rounded-xl bg-slate-800/60 border border-slate-700/50"
            >
              Clear Runs
            </button>
          )}

          <button
            onClick={handleRunBenchmark}
            disabled={running}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:brightness-110 text-white text-xs font-semibold shadow-lg shadow-violet-950/50 transition-all disabled:opacity-50"
          >
            <span>{running ? '⏳' : '⚡'}</span>
            <span>{running ? 'Measuring Synthesis...' : 'Run Benchmark Trial'}</span>
          </button>
        </div>
      </div>

      {/* Preset Selector */}
      <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-3">
        <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
          Select Benchmark Utterance
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {PRESET_BENCHMARK_PROMPTS.map((p, i) => (
            <button
              key={i}
              onClick={() => setCurrentPrompt(p.text)}
              className={`p-3 rounded-xl border text-left text-xs transition-all ${
                currentPrompt === p.text
                  ? 'bg-violet-950/50 border-violet-500/60 text-violet-200'
                  : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:text-slate-300'
              }`}
            >
              <div className="font-semibold text-slate-200">{p.label}</div>
              <div className="text-[11px] text-slate-500 line-clamp-2 mt-1">"{p.text}"</div>
            </button>
          ))}
        </div>

        <textarea
          value={currentPrompt}
          onChange={(e) => setCurrentPrompt(e.target.value)}
          rows={2}
          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500 font-mono"
        />
      </div>

      {/* Benchmark Results Table */}
      <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 overflow-hidden shadow-xl">
        <div className="px-4 py-3 border-b border-slate-800/80 bg-slate-900/80 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
            Recorded Benchmark Trials
          </span>
          <span className="text-[11px] font-mono text-slate-400">
            Target TTFA: &lt;150ms
          </span>
        </div>

        {runs.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            No trials recorded yet. Select an utterance and click "Run Benchmark Trial" above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-slate-400 font-mono border-b border-slate-800/60">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Model & Voice</th>
                  <th className="py-3 px-4">TTFA (1st Chunk)</th>
                  <th className="py-3 px-4">Total Synthesis</th>
                  <th className="py-3 px-4">PCM Data</th>
                  <th className="py-3 px-4">Throughput</th>
                  <th className="py-3 px-4">Engine</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {runs.map((r) => {
                  const throughputKBps = r.total_time_ms > 0
                    ? ((r.total_bytes / 1024) / (r.total_time_ms / 1000)).toFixed(1)
                    : '—';

                  return (
                    <tr key={r.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 text-slate-500">
                        {new Date(r.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-violet-300">{r.model_id}</span>
                        <span className="text-slate-500"> / {r.voice}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`font-bold ${
                          (r.ttfa_ms || 0) < 150 ? 'text-emerald-400' : 'text-amber-400'
                        }`}>
                          {r.ttfa_ms != null ? `${r.ttfa_ms.toFixed(0)} ms` : '—'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-200">
                        {r.total_time_ms.toFixed(0)} ms
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        {(r.total_bytes / 1024).toFixed(1)} KB
                      </td>
                      <td className="py-3 px-4 text-blue-400 font-semibold">
                        {throughputKBps} KB/s
                      </td>
                      <td className="py-3 px-4">
                        {r.is_mock ? (
                          <span className="px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-500/40 text-[10px]">
                            Simulated
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-500/40 text-[10px]">
                            Rime Cloud
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
