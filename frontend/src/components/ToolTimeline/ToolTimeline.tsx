import React from 'react';
import { useConversationStore } from '../../state/conversationStore';
import type { ToolActivity } from '../../types';

export const ToolTimeline: React.FC = () => {
  const activeTools = useConversationStore((s) => s.activeTools);
  const toolHistory = useConversationStore((s) => s.toolHistory);

  const allTools = [...activeTools, ...toolHistory].slice(-8);

  return (
    <div className="flex flex-col rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md overflow-hidden shadow-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
            Tool Continuity & Fencing
          </span>
          {activeTools.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-mono animate-pulse">
              {activeTools.length} running
            </span>
          )}
        </div>
        <span className="text-[11px] text-slate-500 font-mono">Async Tool Worker</span>
      </div>

      {allTools.length === 0 ? (
        <div className="py-6 text-center text-slate-600 text-xs">
          No tools executed yet. Ask VoicePilot to calculate, set a timer, or query data to see tool fencing in action.
        </div>
      ) : (
        <div className="space-y-2.5">
          {allTools.map((tool: ToolActivity, idx: number) => {
            const isRunning = !tool.end_time;
            const duration = tool.end_time
              ? ((tool.end_time - tool.start_time) * 1000).toFixed(0)
              : null;

            return (
              <div
                key={tool.id || `${tool.tool_name}-${idx}`}
                className={`p-2.5 rounded-xl border text-xs font-mono transition-all ${
                  tool.cancelled
                    ? 'bg-rose-950/20 border-rose-800/40 text-rose-300'
                    : tool.stale
                    ? 'bg-orange-950/20 border-orange-800/40 text-orange-300'
                    : isRunning
                    ? 'bg-amber-950/30 border-amber-500/50 text-amber-200 animate-pulse'
                    : 'bg-slate-800/60 border-slate-700/50 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-100">{tool.tool_name}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-900/80 text-brand-300">
                      {tool.generation_id}
                    </span>
                  </div>
                  <div>
                    {tool.cancelled ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-900/60 text-rose-300 font-sans font-medium">
                        Cancelled (Barge-In)
                      </span>
                    ) : tool.stale ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-900/60 text-orange-300 font-sans font-medium">
                        Stale Result Fenced
                      </span>
                    ) : isRunning ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-900/60 text-amber-300 font-sans font-medium">
                        Executing...
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-900/60 text-emerald-300 font-sans font-medium">
                        Done ({duration}ms)
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 truncate">
                  Args: {JSON.stringify(tool.args)}
                </div>

                {tool.result !== undefined && (
                  <div className="mt-1 pt-1 border-t border-slate-800 text-[11px] text-emerald-400/90 truncate">
                    Res: {JSON.stringify(tool.result)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
