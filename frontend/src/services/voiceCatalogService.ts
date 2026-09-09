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

class VoiceCatalogServiceFrontend {
  private models: string[] = [];
  private languages: string[] = [];
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
      this.models = modelsData.models || [];
      this.languages = langsData.languages || [];
      this.loaded = true;
    } catch (e) {
      console.warn('[VoiceCatalog] Failed to load catalog:', e);
    }
  }

  async getVoicesForModel(modelId: string): Promise<VoiceEntry[]> {
    if (!this.voicesByModel[modelId]) {
      try {
        const res = await fetch(`${BACKEND_URL}/catalog/voices?model_id=${encodeURIComponent(modelId)}`);
        const data = await res.json();
        this.voicesByModel[modelId] = data.voices || [];
      } catch (e) {
        console.warn('[VoiceCatalog] Failed to load voices for model:', modelId, e);
        this.voicesByModel[modelId] = [];
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
      return rawList.map((v: any) =>
        typeof v === 'string'
          ? { voice_id: v, model_id: 'mist', language: 'en', display_name: v }
          : v
      );
    } catch (e) {
      console.warn('[VoiceCatalog] Failed to fetch voices:', e);
      return [];
    }
  }

  getModels(): string[] { return this.models; }
  getLanguages(): string[] { return this.languages; }
}

export const voiceCatalogService = new VoiceCatalogServiceFrontend();
