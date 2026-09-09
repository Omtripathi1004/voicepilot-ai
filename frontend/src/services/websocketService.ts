// VoicePilot AI — WebSocket Service
// Handles connection, message routing, and reconnection logic.
import { useConversationStore } from '../state/conversationStore';
import type { WsMessage, ConversationTurn, ObservabilityEvent } from '../types';

class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private sessionId: string | null = null;
  private messageHandlers: Map<string, ((msg: WsMessage) => void)[]> = new Map();
  private audioContext: AudioContext | null = null;
  private audioBufferQueue: AudioBuffer[] = [];
  private isPlayingAudio = false;
  private currentAudioGenId: string | null = null;

  connect(url?: string): void {
    const store = useConversationStore.getState();
    const wsUrl = url || store.wsUrl;

    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('[WebSocket] Connected');
      store.setConnected(true);
    };

    this.ws.onclose = (e) => {
      console.log('[WebSocket] Disconnected:', e.code, e.reason);
      store.setConnected(false);
      // Auto-reconnect after 2s
      this.reconnectTimer = setTimeout(() => this.connect(wsUrl), 2000);
    };

    this.ws.onerror = (e) => {
      console.error('[WebSocket] Error:', e);
    };

    this.ws.onmessage = (event) => {
      try {
        const msg: WsMessage = JSON.parse(event.data);
        this.handleMessage(msg);
      } catch (e) {
        console.error('[WebSocket] Parse error:', e);
      }
    };
  }

  disconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
  }

  off(type: string, handler: (msg: any) => void): void {
    const list = this.messageHandlers.get(type);
    if (list) {
      this.messageHandlers.set(type, list.filter((h) => h !== handler));
    }
  }

  send(msg: WsMessage | Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else {
      console.warn('[WebSocket] Cannot send — not connected');
    }
  }

  sendUserSpeech(text: string, wasInterrupted = false): void {
    this.send({ type: 'user_speech', text, was_interrupted: wasInterrupted });
  }

  sendInterrupt(): void {
    // Stop audio immediately
    this.stopAudioPlayback();
    this.send({ type: 'interrupt' });
  }

  sendDemoStart(): void {
    this.send({ type: 'demo_start' });
  }

  sendAcceptanceTest(): void {
    this.send({ type: 'acceptance_test' });
    useConversationStore.getState().setIsRunningAcceptance(true);
  }

  sendGetCatalog(): void {
    this.send({ type: 'get_catalog' });
  }

  sendGetMetrics(): void {
    this.send({ type: 'get_metrics' });
  }

  sendGetEvents(): void {
    this.send({ type: 'get_events', limit: 100 });
  }

  sendUpdateVoice(model: string, voice: string, language: string): void {
    this.send({ type: 'update_voice', model, voice, language });
  }

  sendPronunciationTest(fixtureId: string): void {
    this.send({ type: 'pronunciation_test', fixture_id: fixtureId });
  }

  sendBenchmark(text: string): void {
    this.send({ type: 'benchmark_request', text });
  }

  private handleMessage(msg: WsMessage): void {
    const store = useConversationStore.getState();

    // Call any registered message handlers
    const handlers = this.messageHandlers.get(msg.type) || [];
    handlers.forEach((h) => h(msg));

    switch (msg.type) {
      case 'voice_config':
        store.setRimeConfig(
          msg.rime_config as any,
          msg.is_mock as boolean,
        );
        if (msg.session_id) store.setSessionId(msg.session_id as string);
        break;

      case 'state_change':
        if (msg.status) store.setStatus(msg.status as any);
        if (msg.current_generation_id) store.updateGenerationId(msg.current_generation_id as string);
        break;

      case 'user_turn':
        store.addTurn({
          id: msg.turn_id as string,
          role: 'user',
          text: msg.text as string,
          generationId: msg.generation_id as string,
          timestamp: Date.now() / 1000,
        });
        store.updateGenerationId(msg.generation_id as string);
        break;

      case 'agent_response':
        store.addTurn({
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          text: msg.text as string,
          generationId: msg.generation_id as string,
          timestamp: Date.now() / 1000,
          toolName: msg.tool_name as string | undefined,
        });
        break;

      case 'audio_chunk':
        // Play audio chunk — check generation before queuing
        const currentGen = store.currentGenerationId;
        if (msg.generation_id === currentGen || !currentGen) {
          this.queueAudioChunk(msg.data as string, msg.generation_id as string);
        }
        break;

      case 'audio_complete':
        store.setIsPlaying(false);
        break;

      case 'interruption_ack':
        store.recordInterruption(
          msg.old_generation_id as string,
          msg.new_generation_id as string,
        );
        this.stopAudioPlayback();
        break;

      case 'stale_rejected':
        store.recordStaleRejection(msg.source as string);
        break;

      case 'tool_start':
        store.addToolActivity({
          id: `tool-${Date.now()}`,
          tool_name: msg.tool_name as string,
          args: (msg.args || {}) as any,
          start_time: Date.now() / 1000,
          generation_id: msg.generation_id as string,
        });
        break;

      case 'tool_complete':
        store.completeToolActivity(msg.tool_name as string, msg.result);
        break;

      case 'metrics':
        if (msg.turn_metrics) {
          store.setMetrics(msg.turn_metrics as any, msg.session_summary as any);
        }
        break;

      case 'observability_event':
        store.addEvent(msg.event as ObservabilityEvent);
        break;

      case 'acceptance_result':
        store.setAcceptanceResult(msg.result as any);
        break;

      case 'demo_started':
        store.setDemoRunning(true);
        break;

      case 'demo_complete':
        store.setDemoRunning(false);
        break;

      case 'error':
        console.error('[Backend Error]:', msg.message);
        break;
    }
  }

  on(type: string, handler: (msg: WsMessage) => void): () => void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, []);
    }
    this.messageHandlers.get(type)!.push(handler);
    return () => {
      const handlers = this.messageHandlers.get(type) || [];
      this.messageHandlers.set(type, handlers.filter((h) => h !== handler));
    };
  }

  private async getAudioContext(): Promise<AudioContext> {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      this.audioContext = new AudioContext({ sampleRate: 22050 });
    }
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
    return this.audioContext;
  }

  private async queueAudioChunk(base64Data: string, generationId: string): Promise<void> {
    const store = useConversationStore.getState();

    // Reject stale chunks
    if (this.currentAudioGenId && this.currentAudioGenId !== generationId) {
      console.log('[Audio] Rejecting stale chunk for gen:', generationId);
      store.recordStaleRejection('audio_chunk_frontend');
      return;
    }

    this.currentAudioGenId = generationId;
    store.setIsPlaying(true);

    try {
      const ctx = await this.getAudioContext();
      const binary = atob(base64Data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

      const audioBuffer = await ctx.decodeAudioData(bytes.buffer.slice(0));
      this.audioBufferQueue.push(audioBuffer);

      if (!this.isPlayingAudio) {
        await this.playNextBuffer();
      }
    } catch (e) {
      // Some chunks may be partial/invalid — log and continue
      console.warn('[Audio] Decode error:', e);
    }
  }

  private async playNextBuffer(): Promise<void> {
    if (this.audioBufferQueue.length === 0) {
      this.isPlayingAudio = false;
      useConversationStore.getState().setIsPlaying(false);
      return;
    }

    this.isPlayingAudio = true;
    const ctx = await this.getAudioContext();
    const buffer = this.audioBufferQueue.shift()!;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.onended = () => this.playNextBuffer();
    source.start();
  }

  stopAudioPlayback(): void {
    this.audioBufferQueue = [];
    this.isPlayingAudio = false;
    this.currentAudioGenId = null;

    // Stop AudioContext sources
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
    useConversationStore.getState().setIsPlaying(false);
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// Singleton
export const wsService = new WebSocketService();
