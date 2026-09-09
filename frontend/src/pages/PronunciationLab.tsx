import React, { useEffect, useState } from 'react';
import { wsService } from '../services/websocketService';
import { useConversationStore } from '../state/conversationStore';

interface Fixture {
  id: string;
  category: string;
  text: string;
  notes: string;
}

export const PronunciationLab: React.FC = () => {
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [loading, setLoading] = useState(false);
  const [customText, setCustomText] = useState('');
  const [activeFixtureId, setActiveFixtureId] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, { duration_ms: number; audioUrl?: string }>>({});
  const rimeConfig = useConversationStore((s) => s.rimeConfig);

  useEffect(() => {
    const backendUrl = (import.meta as any).env?.VITE_BACKEND_URL || 'http://localhost:8000';
    setLoading(true);
    fetch(`${backendUrl}/pronunciation/fixtures`)
      .then((res) => res.json())
      .then((data) => {
        if (data.fixtures) setFixtures(data.fixtures);
      })
      .catch((err) => {
        console.warn('Failed to load fixtures via REST:', err);
      })
      .finally(() => setLoading(false));
  }, []);

  // Listen for WebSocket pronunciation_result
  useEffect(() => {
    const handler = (msg: any) => {
      if (msg.type === 'pronunciation_result') {
        const fId = msg.fixture?.id || 'custom';
        let audioUrl: string | undefined;
        if (msg.audio_base64) {
          const blob = new Blob(
            [Uint8Array.from(atob(msg.audio_base64), (c) => c.charCodeAt(0))],
            { type: 'audio/wav' }
          );
          audioUrl = URL.createObjectURL(blob);
        }
        setResults((prev) => ({
          ...prev,
          [fId]: {
            duration_ms: msg.synthesis_time_ms,
            audioUrl,
          },
        }));
        setActiveFixtureId(null);
      }
    };

    wsService.on('pronunciation_result', handler);
    return () => {
      wsService.off('pronunciation_result', handler);
    };
  }, []);

  const handleTestFixture = (fixture: Fixture) => {
    setActiveFixtureId(fixture.id);
    wsService.send({
      type: 'pronunciation_test',
      fixture_id: fixture.id,
    });
  };

  const handleTestCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customText.trim()) return;
    setActiveFixtureId('custom');
    wsService.send({
      type: 'pronunciation_test',
      text: customText.trim(),
    });
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full px-4 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-violet-400">🗣️</span> Rime Pronunciation & Speech Normalization Lab
            </h1>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-950/60 text-violet-300 border border-violet-600/30 font-mono">
              Phonetic Evaluator
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Test spoken tokenization, currencies, acronyms, dates, foreign names, and voice naturalness with Rime TTS.
          </p>
        </div>

        {rimeConfig && (
          <div className="px-3 py-1.5 rounded-xl bg-slate-800/70 border border-slate-700/60 text-xs text-slate-300">
            Active: <span className="text-violet-300 font-semibold">{rimeConfig.voice}</span> ({rimeConfig.model_id})
          </div>
        )}
      </div>

      {/* Custom Sentence Testing Bar */}
      <form
        onSubmit={handleTestCustom}
        className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800/80 shadow-lg flex flex-col sm:flex-row gap-3 items-center"
      >
        <input
          type="text"
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          placeholder="Test custom phrase (e.g. 'Route 66 to Albuquerque at 9:45 PM cost $49.99')"
          className="flex-1 w-full px-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
        />
        <button
          type="submit"
          disabled={!customText.trim() || activeFixtureId === 'custom'}
          className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-xs font-semibold tracking-wide transition-all shadow-md shadow-violet-950/50"
        >
          {activeFixtureId === 'custom' ? 'Synthesizing...' : 'Synthesize Custom Speech'}
        </button>
      </form>

      {/* Fixture Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading && <div className="text-xs text-slate-500 py-8 text-center col-span-2">Loading fixtures...</div>}

        {fixtures.map((fixture) => {
          const res = results[fixture.id];
          const isCurrentActive = activeFixtureId === fixture.id;

          return (
            <div
              key={fixture.id}
              className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md flex flex-col justify-between gap-3 shadow-md hover:border-slate-700 transition-all"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-slate-800 text-violet-300 font-mono">
                    {fixture.category}
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">{fixture.id}</span>
                </div>

                <div className="text-sm font-medium text-slate-200 mt-2 leading-relaxed">
                  "{fixture.text}"
                </div>

                <div className="text-[11px] text-slate-400 mt-1 italic">
                  Note: {fixture.notes}
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-800/60 mt-2">
                <div>
                  {res && (
                    <span className="text-[11px] text-emerald-400 font-mono">
                      ✓ Synthesized in {res.duration_ms.toFixed(0)} ms
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {res?.audioUrl && (
                    <audio src={res.audioUrl} controls className="h-7 w-36 scale-90" />
                  )}

                  <button
                    onClick={() => handleTestFixture(fixture)}
                    disabled={isCurrentActive}
                    className="px-3 py-1.5 rounded-lg bg-violet-900/50 hover:bg-violet-800/60 text-violet-200 text-xs font-medium border border-violet-700/40 transition-all disabled:opacity-40"
                  >
                    {isCurrentActive ? 'Synthesizing...' : '▶ Synthesize'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
