import React, { useState, useMemo } from 'react';
import { useConversationStore } from '../../state/conversationStore';
import type { ObservabilityEvent } from '../../types';

export const ObservabilityLog: React.FC = () => {
  const events = useConversationStore((s) => s.events);
  const [filter, setFilter] = useState<'all' | 'interruption' | 'tts' | 'tool' | 'fencing'>('all');
  const [search, setSearch] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      const matchesSearch =
        search === '' ||
        e.event_type.toLowerCase().includes(search.toLowerCase()) ||
        JSON.stringify(e.data).toLowerCase().includes(search.toLowerCase()) ||
        (e.generation_id && e.generation_id.toLowerCase().includes(search.toLowerCase()));

      if (!matchesSearch) return false;

      if (filter === 'interruption') {
        return e.event_type.includes('interrupt') || e.event_type.includes('cancel');
      }
      if (filter === 'tts') {
        return e.event_type.includes('audio') || e.event_type.includes('tts') || e.event_type.includes('first_chunk');
      }
      if (filter === 'tool') {
        return e.event_type.includes('tool');
      }
      if (filter === 'fencing') {
        return e.event_type.includes('stale') || e.event_type.includes('reject') || e.event_type.includes('fence');
      }
      return true;
    });
  }, [events, filter, search]);

  const getEventBadgeClass = (type: string) => {
    if (type.includes('interrupt')) return 'bg-rose-950/60 border-rose-600/50 text-rose-300';
    if (type.includes('stale') || type.includes('reject')) return 'bg-amber-950/60 border-amber-600/50 text-amber-300';
    if (type.includes('tts') || type.includes('audio')) return 'bg-violet-950/60 border-violet-600/50 text-violet-300';
    if (type.includes('tool')) return 'bg-blue-950/60 border-blue-600/50 text-blue-300';
    if (type.includes('state')) return 'bg-emerald-950/60 border-emerald-600/50 text-emerald-300';
    return 'bg-slate-800/80 border-slate-700/50 text-slate-300';
  };

  return (
    <div className="flex flex-col h-full rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md overflow-hidden shadow-lg">
      <div className="p-3 border-b border-slate-800/80 bg-slate-900/80 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
              Telemetry & Event Log
            </span>
            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] text-slate-400 font-mono">
              {filteredEvents.length} events
            </span>
          </div>

          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
              autoScroll
                ? 'bg-emerald-950/40 border-emerald-600/40 text-emerald-400'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            {autoScroll ? '● Live Following' : '⏸ Paused'}
          </button>
        </div>

        {/* Filters and search */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {(['all', 'interruption', 'tts', 'tool', 'fencing'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 rounded-lg capitalize text-[11px] transition-all ${
                filter === f
                  ? 'bg-brand-600 text-white font-medium shadow-sm'
                  : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
              }`}
            >
              {f === 'fencing' ? '🛡️ Fencing / Stale' : f}
            </button>
          ))}

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search payload..."
            className="flex-1 min-w-[120px] px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2 font-mono text-xs">
        {filteredEvents.length === 0 ? (
          <div className="text-center py-10 text-slate-600 text-xs">
            No telemetry events matching current filter.
          </div>
        ) : (
          filteredEvents.map((evt: ObservabilityEvent, i: number) => (
            <div
              key={i}
              className="p-2 rounded-xl bg-slate-900/90 border border-slate-800/70 hover:border-slate-700/80 transition-colors"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded border text-[10px] font-semibold uppercase tracking-wider ${getEventBadgeClass(
                      evt.event_type
                    )}`}
                  >
                    {evt.event_type}
                  </span>
                  {evt.generation_id && (
                    <span className="text-[10px] text-brand-400 font-semibold">
                      {evt.generation_id}
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-slate-500">
                  {new Date(evt.timestamp * 1000).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </span>
              </div>

              {evt.data && Object.keys(evt.data).length > 0 && (
                <pre className="mt-1 text-[11px] text-slate-400 bg-slate-950/60 p-1.5 rounded-lg overflow-x-auto whitespace-pre-wrap break-all">
                  {JSON.stringify(evt.data, null, 2)}
                </pre>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
