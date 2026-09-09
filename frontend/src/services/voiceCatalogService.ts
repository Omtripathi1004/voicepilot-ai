// VoicePilot AI — Voice Catalog Service (frontend)
// Fetches catalog from backend API and caches results.

export interface VoiceEntry {
  voice_id: string;
  model_id: string;
  language: string;
  gender?: string;
  age?: string;
  dialect?: string;
  flagship?: boolean;
  display_name: string;
  sample_audio_url?: string;
}

const BACKEND_URL = (import.meta as any).env?.VITE_BACKEND_URL || 'http://localhost:8000';

export const DEFAULT_VOICES: VoiceEntry[] = [
  { voice_id: 'amber', model_id: 'mist', language: 'en', gender: 'Female', flagship: true, display_name: 'Amber (Flagship Natural - Female)' },
  { voice_id: 'marsh', model_id: 'mist', language: 'en', gender: 'Male', flagship: true, display_name: 'Marsh (Warm Conversational - Male)' },
  { voice_id: 'crest', model_id: 'mist', language: 'en', gender: 'Male', flagship: false, display_name: 'Crest (Crisp Authoritative - Male)' },
  { voice_id: 'glade', model_id: 'mist', language: 'en', gender: 'Female', flagship: false, display_name: 'Glade (Gentle Assistant - Female)' },
  { voice_id: 'luna', model_id: 'mist', language: 'en', gender: 'Female', flagship: false, display_name: 'Luna (Bright & Clear - Female)' },
  { voice_id: 'marcus', model_id: 'mist', language: 'en', gender: 'Male', flagship: false, display_name: 'Marcus (Deep Executive - Male)' },
  { voice_id: 'bayou', model_id: 'arcana', language: 'en', gender: 'Male', flagship: true, display_name: 'Bayou (Arcana Expressive - Male)' },
  { voice_id: 'haven', model_id: 'arcana', language: 'en', gender: 'Female', flagship: true, display_name: 'Haven (Arcana Cinematic - Female)' },
  { voice_id: 'david', model_id: 'arcana', language: 'en', gender: 'Male', flagship: false, display_name: 'David (Resonant Cinematic - Male)' },
  { voice_id: 'echo', model_id: 'mist', language: 'es', gender: 'Female', flagship: false, display_name: 'Echo (Spanish Multilingual - Female)' },
];

class VoiceCatalogServiceFrontend {
  private models: string[] = ['mist', 'arcana'];
  private languages: string[] = ['en', 'es', 'fr', 'de'];
  private voicesByModel: Record<string, VoiceEntry[]> = {};
  private loaded = false;

  async loadCatalog(): Promise<void> {
    if (this.loaded) return;
    try {
      const [modelsRes, langsRes] = await Promise.all([
        fetch(`${BACKEND_URL}/catalog/models`),
        fetch(`${BACKEND_URL}/catalog/languages`),
      ]);
      const modelsData = await modelsRes.json();
      const langsData = await langsRes.json();
      if (modelsData.models?.length) this.models = modelsData.models;
      if (langsData.languages?.length) this.languages = langsData.languages;
      this.loaded = true;
    } catch (e) {
      console.warn('[VoiceCatalog] Failed to load catalog via REST, using defaults:', e);
    }
  }

  async getVoicesForModel(modelId: string): Promise<VoiceEntry[]> {
    const list = await this.fetchVoices();
    return list.filter((v) => (v.model_id || 'mist').toLowerCase() === modelId.toLowerCase());
  }

  async getVoicesForModelAndLanguage(modelId: string, language: string): Promise<VoiceEntry[]> {
    const voices = await this.getVoicesForModel(modelId);
    return voices.filter((v) => v.language === language);
  }

  async fetchVoices(): Promise<VoiceEntry[]> {
    try {
      const res = await fetch(`${BACKEND_URL}/api/voices`);
      const data = await res.json();
      const rawList = data.voices || [];
      if (rawList.length > 0) {
        // Map backend voices, preserving curated male/female metadata if matching
        const defaultMap = new Map(DEFAULT_VOICES.map((v) => [v.voice_id.toLowerCase(), v]));
        const enriched: VoiceEntry[] = [];
        const seen = new Set<string>();

        // Always put curated voices first
        for (const cv of DEFAULT_VOICES) {
          enriched.push(cv);
          seen.add(cv.voice_id.toLowerCase());
        }

        // Add additional voices from backend
        for (const item of rawList) {
          const id = (typeof item === 'string' ? item : item.voice_id || item.id || '').toLowerCase();
          if (!id || seen.has(id)) continue;
          seen.add(id);

          if (typeof item === 'string') {
            const isMale = ['marsh', 'crest', 'bayou', 'marcus', 'david', 'james', 'male', 'guy', 'mark'].some((m) => id.includes(m));
            enriched.push({
              voice_id: item,
              model_id: 'mist',
              language: 'en',
              gender: isMale ? 'Male' : 'Female',
              display_name: `${item.charAt(0).toUpperCase() + item.slice(1)} (${isMale ? 'Male' : 'Female'})`,
            });
          } else {
            enriched.push(item);
          }
        }
        return enriched;
      }
      return DEFAULT_VOICES;
    } catch (e) {
      console.info('[VoiceCatalog] Backend offline, serving built-in Rime voices');
      return DEFAULT_VOICES;
    }
  }

  getModels(): string[] { return this.models; }
  getLanguages(): string[] { return this.languages; }
}

export const voiceCatalogService = new VoiceCatalogServiceFrontend();
