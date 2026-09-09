import React, { useState } from 'react';
import { wsService } from '../services/websocketService';
import { useConversationStore } from '../state/conversationStore';
import type { AcceptanceTestResult } from '../types';

export const AcceptanceRunner: React.FC = () => {
  const acceptanceResult = useConversationStore((s) => s.acceptanceResult);
  const isRunning = useConversationStore((s) => s.isRunningAcceptance);
  const setIsRunning = useConversationStore((s) => s.setIsRunningAcceptance);
  const setAcceptanceResult = useConversationStore((s) => s.setAcceptanceResult);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const runAcceptanceSuite = async () => {
    setErrorMsg(null);
    setIsRunning(true);

    try {
      // First try sending over WebSocket
      if (wsService.isConnected) {
        wsService.send({ type: 'run_acceptance' });
      } else {
        // Fallback to REST endpoint
        const backendUrl = (import.meta as any).env?.VITE_BACKEND_URL || 'http://localhost:8000';
        const res = await fetch(`${backendUrl}/api/acceptance/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!res.ok) {
          throw new Error(`Acceptance run failed with status: ${res.status}`);
        }
        const data: AcceptanceTestResult = await res.json();
        setAcceptanceResult(data);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to trigger acceptance test');
      setIsRunning(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full px-4 py-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-emerald-400">🛡️</span> Acceptance Test Harness & Reproducible Evidence
            </h1>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-300 border border-emerald-600/30 font-mono">
              Fencing Verification
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Automated proof fixture verifying generation fencing, immediate audio cut-off, and stale chunk rejection.
          </p>
        </div>

        <button
          onClick={runAcceptanceSuite}
          disabled={isRunning}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all shadow-xl active:scale-95 ${
            isRunning
              ? 'bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-700'
              : 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:brightness-110 shadow-emerald-950/50'
          }`}
        >
          <span>{isRunning ? '⏳' : '▶'}</span>
          <span>{isRunning ? 'Executing Test Scenario...' : 'Run Full Acceptance Scenario'}</span>
        </button>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-950/50 border border-rose-600/50 text-rose-200 text-xs">
          <strong>Error:</strong> {errorMsg}
        </div>
      )}

      {/* Summary Results Card if Available */}
      {acceptanceResult && (
        <div
          className={`p-5 rounded-2xl border transition-all shadow-xl ${
            acceptanceResult.passed
              ? 'bg-emerald-950/30 border-emerald-500/50 shadow-emerald-950/30'
              : 'bg-rose-950/30 border-rose-500/50 shadow-rose-950/30'
          }`}
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{acceptanceResult.passed ? '✅' : '❌'}</span>
              <div>
                <h3 className="text-base font-bold text-white">
                  {acceptanceResult.passed
                    ? 'Acceptance Verification: PASSED'
                    : 'Acceptance Verification: FAILED'}
                </h3>
                <p className="text-xs text-slate-400">
                  {acceptanceResult.passed
                    ? 'All generation fencing guarantees, audio cutoff boundaries, and stale rejections strictly satisfied.'
                    : `${acceptanceResult.failures?.length || 1} assertions failed.`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 font-mono text-xs">
              <div className="px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800">
                <span className="text-slate-500">Steps: </span>
                <span className="text-emerald-400 font-bold">
                  {acceptanceResult.summary?.passed_steps || 0}
                </span>
                <span className="text-slate-500"> / {acceptanceResult.summary?.total_steps || 0}</span>
              </div>

              <div className="px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800">
                <span className="text-slate-500">Stale Rejections: </span>
                <span className="text-amber-400 font-bold">
                  {acceptanceResult.stale_rejections_observed}
                </span>
              </div>
            </div>
          </div>

          {/* Generation ID Chain Display */}
          {acceptanceResult.generation_ids && acceptanceResult.generation_ids.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center gap-2 text-xs">
              <span className="text-slate-400 font-medium">Fencing Generation Chain:</span>
              <div className="flex items-center gap-1.5 font-mono">
                {acceptanceResult.generation_ids.map((gid, idx) => (
                  <React.Fragment key={gid}>
                    <span className="px-2 py-0.5 rounded bg-brand-950/80 border border-brand-500/40 text-brand-300 font-semibold">
                      {gid}
                    </span>
                    {idx < acceptanceResult.generation_ids.length - 1 && (
                      <span className="text-slate-600">→</span>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step by Step Breakdown */}
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider px-1">
          Scenario Steps & Verification Log
        </h3>

        {(!acceptanceResult || !acceptanceResult.steps || acceptanceResult.steps.length === 0) ? (
          <div className="p-8 rounded-2xl bg-slate-900/40 border border-slate-800/80 text-center text-slate-500 text-xs">
            No acceptance run recorded yet. Click "Run Full Acceptance Scenario" above to execute the automated proof suite.
          </div>
        ) : (
          <div className="space-y-3">
            {acceptanceResult.steps.map((step, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl bg-slate-900/70 border border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 font-mono text-xs"
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 text-sm">{step.passed ? '🟢' : '🔴'}</span>
                  <div>
                    <div className="font-semibold text-slate-200 font-sans text-sm">
                      {idx + 1}. {step.name}
                    </div>
                    <div className="text-slate-400 mt-0.5">{step.detail}</div>
                  </div>
                </div>

                {step.measured !== undefined && (
                  <div className="px-3 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-brand-300 truncate max-w-xs sm:max-w-md">
                    {typeof step.measured === 'object'
                      ? JSON.stringify(step.measured)
                      : String(step.measured)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
