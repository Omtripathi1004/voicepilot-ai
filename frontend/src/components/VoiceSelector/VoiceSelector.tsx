import React, { useEffect, useState } from 'react';
import { voiceCatalogService, type VoiceEntry } from '../../services/voiceCatalogService';
import { wsService } from '../../services/websocketService';
import { useConversationStore } from '../../state/conversationStore';

export const VoiceSelector: React.FC = () => {
  const rimeConfig = useConversationStore((s) => s.rimeConfig);
  const isMock = useConversationStore((s) => s.isMock);
  const [voices, setVoices] = useState<VoiceEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>(rimeConfig?.model_id || 'mist');
  const [selectedVoice, setSelectedVoice] = useState<string>(rimeConfig?.voice || 'amber');
  const [previewing, setPreviewing] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    voiceCatalogService.fetchVoices()
      .then((data) => {
        if (mounted && data.length > 0) {
          setVoices(data);
        }
      })
      .catch((err) => {
        console.warn('Could not fetch voices from catalog:', err);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  // Filter voices by model
  const filteredVoices = voices.filter(
    (v) => !v.model_id || v.model_id.toLowerCase() === selectedModel.toLowerCase()
  );

  const displayList = filteredVoices.length > 0 ? filteredVoices : voices;

  const handleModelChange = (modelId: string) => {
    setSelectedModel(modelId);
    // Find matching voice for this model
    const match = voices.find((v) => v.model_id.toLowerCase() === modelId.toLowerCase());
    const voiceId = match ? match.voice_id : selectedVoice;
    setSelectedVoice(voiceId);

    wsService.sendUpdateVoice(modelId, voiceId, rimeConfig?.language || 'eng');
  };

  const handleVoiceChange = (voiceId: string) => {
    setSelectedVoice(voiceId);
    wsService.sendUpdateVoice(selectedModel, voiceId, rimeConfig?.language || 'eng');
  };

  const handlePreview = async (voice: VoiceEntry) => {
    if (voice.sample_audio_url) {
      setPreviewing(voice.voice_id);
      const audio = new Audio(voice.sample_audio_url);
      audio.onended = () => setPreviewing(null);
      audio.onerror = () => setPreviewing(null);
      audio.play().catch(() => setPreviewing(null));
    }
  };

  return (
    <div className="flex flex-col gap-3 p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md shadow-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-200">Rime TTS Engine</span>
          {isMock ? (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-950/80 border border-amber-500/40 text-amber-400 font-medium">
              Offline / Demo Synthesizer
            </span>
          ) : (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 font-medium">
              Live Rime Cloud
            </span>
          )}
        </div>
        {loading && <span className="text-xs text-slate-500 animate-pulse">Syncing catalog...</span>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Model Selection */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">
            Model Architecture
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleModelChange('mist')}
              className={`px-3 py-2 rounded-xl text-xs font-medium border text-left transition-all ${
                selectedModel === 'mist'
                  ? 'bg-violet-950/60 border-violet-500/60 text-violet-200 shadow-md shadow-violet-950/50'
                  : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="font-semibold text-violet-300">Rime Mist</div>
              <div className="text-[10px] text-slate-400">Ultra-low latency (~75ms TTFA)</div>
            </button>

            <button
              onClick={() => handleModelChange('arcana')}
              className={`px-3 py-2 rounded-xl text-xs font-medium border text-left transition-all ${
                selectedModel === 'arcana'
                  ? 'bg-violet-950/60 border-violet-500/60 text-violet-200 shadow-md shadow-violet-950/50'
                  : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="font-semibold text-violet-300">Rime Arcana</div>
              <div className="text-[10px] text-slate-400">Cinematic / High Expressivity</div>
            </button>
          </div>
        </div>

        {/* Voice Persona Dropdown */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">
            Voice Persona
          </label>
          <div className="relative">
            <select
              value={selectedVoice}
              onChange={(e) => handleVoiceChange(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700/80 text-xs text-slate-200 font-medium appearance-none focus:outline-none focus:ring-2 focus:ring-violet-500/50"
            >
              {displayList.map((v) => (
                <option key={v.voice_id} value={v.voice_id} className="bg-slate-900 text-slate-200">
                  {v.display_name || v.voice_id} {v.gender ? `(${v.gender}, ${v.language})` : ''}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-400">
              ▼
            </div>
          </div>
        </div>
      </div>

      {/* Selected Voice Details Chip */}
      {selectedVoice && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/60 text-[11px] text-slate-400">
          <div className="flex items-center gap-2">
            <span>Voice ID: <code className="text-violet-300 font-mono">{selectedVoice}</code></span>
            <span>•</span>
            <span>PCM 24kHz / Linear 16-bit</span>
          </div>
          {displayList.find((v) => v.voice_id === selectedVoice)?.sample_audio_url && (
            <button
              onClick={() => {
                const item = displayList.find((v) => v.voice_id === selectedVoice);
                if (item) handlePreview(item);
              }}
              disabled={previewing === selectedVoice}
              className="px-2 py-0.5 rounded bg-violet-900/50 hover:bg-violet-800/60 text-violet-300 text-[10px] transition-colors"
            >
              {previewing === selectedVoice ? 'Playing...' : '▶ Sample Preview'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
