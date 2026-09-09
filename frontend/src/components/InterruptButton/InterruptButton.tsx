import React, { useState } from 'react';
import { wsService } from '../../services/websocketService';
import { useConversationStore } from '../../state/conversationStore';

interface InterruptButtonProps {
  size?: 'normal' | 'large';
  className?: string;
}

export const InterruptButton: React.FC<InterruptButtonProps> = ({
  size = 'normal',
  className = '',
}) => {
  const status = useConversationStore((s) => s.status);
  const interruptionCount = useConversationStore((s) => s.interruptionCount);
  const currentGen = useConversationStore((s) => s.currentGenerationId);
  const [justClicked, setJustClicked] = useState(false);

  const isInterruptible = status === 'SPEAKING' || status === 'PROCESSING' || status === 'TOOL_EXECUTION';

  const handleInterrupt = () => {
    setJustClicked(true);
    setTimeout(() => setJustClicked(false), 600);
    wsService.sendInterrupt();
  };

  const isLarge = size === 'large';

  return (
    <div className={`flex flex-col items-center gap-1.5 ${className}`}>
      <button
        onClick={handleInterrupt}
        className={`group relative flex items-center justify-center font-semibold transition-all duration-200 select-none shadow-lg active:scale-95 ${
          isLarge
            ? 'px-7 py-3.5 rounded-2xl text-base'
            : 'px-5 py-2.5 rounded-xl text-sm'
        } ${
          isInterruptible
            ? 'bg-gradient-to-r from-rose-600 via-rose-500 to-amber-600 text-white shadow-rose-900/40 hover:shadow-rose-600/30 hover:brightness-110 ring-2 ring-rose-400/50'
            : 'bg-slate-800/80 text-slate-400 border border-slate-700/60 hover:bg-slate-700/80 hover:text-slate-200'
        } ${justClicked ? 'ring-4 ring-rose-500 scale-95' : ''}`}
        title="Trigger immediate barge-in interruption (Cancels current audio & increments fencing generation ID)"
      >
        {/* Glow effect */}
        {isInterruptible && (
          <span className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-rose-500 to-orange-500 opacity-40 blur-sm group-hover:opacity-75 transition-opacity" />
        )}

        <div className="relative flex items-center gap-2">
          <span className={`text-lg transition-transform ${isInterruptible ? 'animate-bounce' : ''}`}>
            ✋
          </span>
          <span className="tracking-wide">
            {isInterruptible ? 'INTERRUPT (Barge-In)' : 'Barge-In Ready'}
          </span>
          {interruptionCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-rose-950/80 border border-rose-500/40 text-xs font-mono text-rose-300">
              {interruptionCount}
            </span>
          )}
        </div>
      </button>

      <div className="flex items-center gap-2 text-[11px] text-slate-400">
        <span>Fencing Gen: <code className="text-brand-400 font-mono">{currentGen || 'gen-0'}</code></span>
        <span className="text-slate-600">•</span>
        <span>Space / Esc</span>
      </div>
    </div>
  );
};
