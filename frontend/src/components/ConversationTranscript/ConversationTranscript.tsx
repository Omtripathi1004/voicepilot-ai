import React, { useEffect, useRef } from 'react';
import { useConversationStore } from '../../state/conversationStore';
import type { ConversationTurn } from '../../types';

export const ConversationTranscript: React.FC = () => {
  const turns = useConversationStore((s) => s.turns);
  const status = useConversationStore((s) => s.status);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [turns, status]);

  return (
    <div className="flex flex-col h-full rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md overflow-hidden shadow-lg">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/80 bg-slate-900/80">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
            Live Dialogue Transcript
          </span>
          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] text-slate-400 font-mono">
            {turns.length} turns
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Fencing Active</span>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth"
      >
        {turns.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center text-slate-500 space-y-2">
            <span className="text-3xl">🎙️</span>
            <p className="text-sm font-medium">No conversation history yet.</p>
            <p className="text-xs text-slate-600 max-w-sm">
              Press the Microphone button or type below. VoicePilot will respond with streaming Rime TTS speech and real-time barge-in support.
            </p>
          </div>
        ) : (
          turns.map((turn: ConversationTurn) => (
            <div
              key={turn.id}
              className={`flex flex-col ${
                turn.role === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              <div className="flex items-center gap-2 mb-1 px-1 text-[11px] text-slate-500">
                <span className="font-semibold text-slate-400">
                  {turn.role === 'user' ? 'You' : turn.role === 'assistant' ? 'VoicePilot AI' : 'Tool Execution'}
                </span>
                <span>•</span>
                <span className="font-mono text-brand-400/80 text-[10px]">{turn.generationId}</span>
                <span>•</span>
                <span>
                  {new Date(turn.timestamp < 1e12 ? turn.timestamp * 1000 : turn.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </span>
              </div>

              <div
                className={`relative max-w-[85%] rounded-2xl p-3.5 text-sm shadow-md transition-all ${
                  turn.role === 'user'
                    ? 'bg-brand-600/90 text-white rounded-tr-sm border border-brand-500/50'
                    : turn.role === 'tool'
                    ? 'bg-amber-950/40 text-amber-200 rounded-tl-sm border border-amber-500/30 font-mono text-xs'
                    : 'bg-slate-800/90 text-slate-100 rounded-tl-sm border border-slate-700/60'
                } ${turn.interrupted ? 'ring-2 ring-rose-500/80 border-rose-500/80' : ''}`}
              >
                <div className="whitespace-pre-wrap leading-relaxed">{turn.text}</div>

                {/* Interruption Badge */}
                {turn.interrupted && (
                  <div className="mt-2.5 pt-2 border-t border-rose-500/30 flex items-center gap-1.5 text-xs text-rose-300 font-medium">
                    <span className="text-rose-400">⚡</span>
                    <span>Interrupted by User Barge-In (Stale speech cut)</span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {/* Dynamic Status typing/speaking indicator at the bottom */}
        {status === 'PROCESSING' && (
          <div className="flex items-center gap-2 text-xs text-blue-400 animate-pulse px-2">
            <span className="inline-block w-2 h-2 rounded-full bg-blue-400" />
            <span>VoicePilot is reasoning and preparing Rime speech...</span>
          </div>
        )}
        {status === 'TOOL_EXECUTION' && (
          <div className="flex items-center gap-2 text-xs text-amber-400 animate-pulse px-2">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-400" />
            <span>Executing integrated tool action...</span>
          </div>
        )}
      </div>
    </div>
  );
};
