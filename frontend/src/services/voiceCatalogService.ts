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

const DEFAULT_VOICES: VoiceEntry[] = [
  { voice_id: 'amber', model_id: 'mist', language: 'en', gender: 'Female', flagship: true, display_name: 'Amber (Flagship Natural)' },
  { voice_id: 'marsh', model_id: 'mist', language: 'en', gender: 'Male', flagship: true, display_name: 'Marsh (Warm Conversational)' },
  { voice_id: 'crest', model_id: 'mist', language: 'en', gender: 'Male', flagship: false, display_name: 'Crest (Crisp Authoritative)' },
  { voice_id: 'glade', model_id: 'mist', language: 'en', gender: 'Female', flagship: false, display_name: 'Glade (Gentle Assistant)' },
  { voice_id: 'bayou', model_id: 'arcana', language: 'en', gender: 'Male', flagship: true, display_name: 'Bayou (Arcana Expressive)' },
  { voice_id: 'haven', model_id: 'arcana', language: 'en', gender: 'Female', flagship: true, display_name: 'Haven (Arcana Cinematic)' },
  { voice_id: 'echo', model_id: 'mist', language: 'es', gender: 'Female', flagship: false, display_name: 'Echo (Spanish Multilingual)' },
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
    if (!this.voicesByModel[modelId]) {
      try {
        const res = await fetch(`${BACKEND_URL}/catalog/voices?model_id=${encodeURIComponent(modelId)}`);
        const data = await res.json();
        if (data.voices?.length) {
          this.voicesByModel[modelId] = data.voices;
        } else {
          this.voicesByModel[modelId] = DEFAULT_VOICES.filter((v) => v.model_id === modelId);
        }
      } catch (e) {
        this.voicesByModel[modelId] = DEFAULT_VOICES.filter((v) => v.model_id === modelId);
      }
    }
    return this.voicesByModel[modelId];
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
        return rawList.map((v: any) =>
          typeof v === 'string'
            ? { voice_id: v, model_id: 'mist', language: 'en', display_name: v }
            : v
        );
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
