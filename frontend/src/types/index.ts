// VoicePilot AI — TypeScript Types

export type ConversationStatus =
  | 'IDLE'
  | 'LISTENING'
  | 'PROCESSING'
  | 'TOOL_EXECUTION'
  | 'SPEAKING'
  | 'INTERRUPTED'
  | 'CANCELLING'
  | 'ERROR';

export type TurnRole = 'user' | 'assistant' | 'tool' | 'system';

export interface ConversationTurn {
  id: string;
  role: TurnRole;
  text: string;
  generationId: string;
  timestamp: number;
  interrupted?: boolean;
  toolName?: string;
}

export interface TurnMetrics {
  turn_id: string;
  generation_id: string;
  ttfa_ms: number | null;
  stt_latency_ms: number | null;
  reasoning_latency_ms: number | null;
  tool_latency_ms: number | null;
  tts_latency_ms: number | null;
  end_to_end_latency_ms: number | null;
  interruption_detection_latency_ms: number | null;
  audio_stop_latency_ms: number | null;
  stale_rejections: number;
}

export interface SessionMetrics {
  total_events: number;
  total_stale_rejections: number;
  total_interruptions: number;
  session_id: string;
}

export interface RimeConfig {
  model_id: string;
  voice: string;
  language: string;
  endpoint: string;
  audio_format: string;
  region: string | null;
  provider: string;
}

export interface VoiceEntry {
  voice_id: string;
  model_id: string;
  language: string;
  gender?: string;
  age?: string;
  dialect?: string;
  flagship?: boolean;
  display_name: string;
}

export interface ObservabilityEvent {
  event_type: string;
  timestamp: number;
  data: Record<string, unknown>;
  session_id: string;
  turn_id: string;
  generation_id: string;
}

export interface ToolActivity {
  id: string;
  tool_name: string;
  args: Record<string, unknown>;
  start_time: number;
  end_time?: number;
  result?: unknown;
  cancelled?: boolean;
  stale?: boolean;
  generation_id: string;
}

export interface AcceptanceTestResult {
  test_id: string;
  timestamp: number;
  steps: Array<{
    name: string;
    passed: boolean;
    detail: string;
    measured: unknown;
    timestamp: number;
  }>;
  passed: boolean;
  failures: string[];
  stale_rejections_observed: number;
  generation_ids: string[];
  summary: {
    total_steps: number;
    passed_steps: number;
    failed_steps: number;
    overall: 'PASS' | 'FAIL';
    stale_rejections: number;
    generation_id_chain: string[];
    revised_response_text: string;
  };
}

export interface PronunciationFixture {
  id: string;
  category: string;
  text: string;
  notes: string;
}

export type WsMessageType =
  | 'state_change'
  | 'agent_thinking'
  | 'tool_start'
  | 'tool_complete'
  | 'agent_response'
  | 'audio_chunk'
  | 'audio_complete'
  | 'interruption_ack'
  | 'stale_rejected'
  | 'metrics'
  | 'observability_event'
  | 'error'
  | 'pong'
  | 'voice_config'
  | 'voice_updated'
  | 'acceptance_result'
  | 'catalog_data'
  | 'pronunciation_result'
  | 'benchmark_result'
  | 'user_turn'
  | 'events_data'
  | 'demo_started'
  | 'demo_complete';

export interface WsMessage {
  type: WsMessageType;
  [key: string]: unknown;
}
