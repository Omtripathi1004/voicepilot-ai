import React from 'react';
import { useConversationStore } from '../../state/conversationStore';
import type { ConversationStatus } from '../../types';

interface StatusConfig {
  label: string;
  color: string;
  bg: string;
  border: string;
  ringColor: string;
  icon: string;
  pulse: boolean;
}

const STATUS_CONFIGS: Record<ConversationStatus, StatusConfig> = {
  IDLE: {
    label: 'Ready / Standby',
    color: 'text-slate-400',
    bg: 'bg-slate-800/60',
    border: 'border-slate-700/50',
    ringColor: 'ring-slate-500/20',
    icon: '●',
    pulse: false,
  },
  LISTENING: {
    label: 'Listening (Mic Active)',
    color: 'text-emerald-400',
    bg: 'bg-emerald-950/40',
    border: 'border-emerald-500/40',
    ringColor: 'ring-emerald-400/40',
    icon: '🎙',
    pulse: true,
  },
  PROCESSING: {
    label: 'Reasoning & Synthesis',
    color: 'text-blue-400',
    bg: 'bg-blue-950/40',
    border: 'border-blue-500/40',
    ringColor: 'ring-blue-400/40',
    icon: '⚡',
    pulse: true,
  },
  TOOL_EXECUTION: {
    label: 'Executing Tools',
    color: 'text-amber-400',
    bg: 'bg-amber-950/40',
    border: 'border-amber-500/40',
    ringColor: 'ring-amber-400/40',
    icon: '⚙',
    pulse: true,
  },
  SPEAKING: {
    label: 'Rime TTS Speaking',
    color: 'text-violet-400',
    bg: 'bg-violet-950/40',
    border: 'border-violet-500/40',
    ringColor: 'ring-violet-400/40',
    icon: '🔊',
    pulse: true,
  },
  INTERRUPTED: {
    label: 'Barge-In Interrupted',
    color: 'text-rose-400',
    bg: 'bg-rose-950/40',
    border: 'border-rose-500/40',
    ringColor: 'ring-rose-400/40',
    icon: '✋',
    pulse: true,
  },
  CANCELLING: {
    label: 'Fencing & Cancelling Stale',
    color: 'text-orange-400',
    bg: 'bg-orange-950/40',
    border: 'border-orange-500/40',
    ringColor: 'ring-orange-400/40',
    icon: '🛡',
    pulse: true,
  },
  ERROR: {
    label: 'Error / Recovering',
    color: 'text-red-400',
    bg: 'bg-red-950/40',
    border: 'border-red-500/40',
    ringColor: 'ring-red-400/40',
    icon: '⚠️',
    pulse: false,
  },
};

export const StatusIndicator: React.FC = () => {
  const status = useConversationStore((s) => s.status);
  const connected = useConversationStore((s) => s.connected);
  const currentGen = useConversationStore((s) => s.currentGenerationId);
  const rimeConfig = useConversationStore((s) => s.rimeConfig);
  const isMock = useConversationStore((s) => s.isMock);

  const cfg = STATUS_CONFIGS[status] || STATUS_CONFIGS.IDLE;

  return (
    <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
      {/* Primary Status Pill */}
      <div
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full border backdrop-blur-md shadow-sm transition-all duration-300 ${cfg.bg} ${cfg.border}`}
      >
        <span
          className={`relative flex h-2.5 w-2.5 items-center justify-center`}
        >
          {cfg.pulse && (
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                status === 'SPEAKING'
                  ? 'bg-violet-400'
                  : status === 'LISTENING'
                  ? 'bg-emerald-400'
                  : status === 'INTERRUPTED'
                  ? 'bg-rose-400'
                  : 'bg-blue-400'
              }`}
            />
          )}
          <span
            className={`relative inline-flex rounded-full h-2 w-2 ${
              status === 'SPEAKING'
                ? 'bg-violet-400'
                : status === 'LISTENING'
                ? 'bg-emerald-400'
                : status === 'INTERRUPTED'
                ? 'bg-rose-400'
                : status === 'TOOL_EXECUTION'
                ? 'bg-amber-400'
                : status === 'IDLE'
                ? 'bg-slate-400'
                : 'bg-blue-400'
            }`}
          />
        </span>
        <span className="text-xs font-semibold tracking-wide uppercase">
          {cfg.icon}
        </span>
        <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
      </div>

      {/* Generation Fencing Pill */}
      {currentGen && (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/80 border border-slate-700/60 text-xs font-mono text-slate-300 shadow-inner">
          <span className="text-[10px] uppercase tracking-wider text-slate-400">GEN</span>
          <span className="text-brand-300 font-bold">{currentGen}</span>
        </div>
      )}

      {/* Rime Voice Pill */}
      {rimeConfig && (
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-950/40 border border-violet-700/40 text-xs text-violet-200">
          <span className="text-violet-400 text-xs">✨ Rime:</span>
          <span className="font-medium text-violet-100">{rimeConfig.voice}</span>
          <span className="text-[10px] px-1 py-0.2 rounded bg-violet-900/80 text-violet-300">
            {rimeConfig.model_id}
          </span>
          {isMock && (
            <span className="text-[9px] px-1 py-0.2 rounded bg-amber-900/80 text-amber-300 uppercase tracking-wider">
              Sim
            </span>
          )}
        </div>
      )}

      {/* WS Connection Pill */}
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400">
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            connected ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-rose-500'
          }`}
        />
        <span>{connected ? 'WS Online' : 'WS Reconnecting'}</span>
      </div>
    </div>
  );
};
