// VoicePilot AI — Global Application State (Zustand)
import { create } from 'zustand';
import type {
  ConversationStatus,
  ConversationTurn,
  TurnMetrics,
  SessionMetrics,
  RimeConfig,
  ObservabilityEvent,
  ToolActivity,
  AcceptanceTestResult,
  WsMessage,
} from '../types';

interface ConversationStore {
  // Connection state
  connected: boolean;
  sessionId: string | null;
  wsUrl: string;

  // Conversation state
  status: ConversationStatus;
  turns: ConversationTurn[];
  currentGenerationId: string | null;
  currentTurnId: string | null;

  // Audio state
  isPlaying: boolean;
  audioQueue: string[]; // base64 chunks
  currentAudioGenerationId: string | null;

  // Rime / Voice config
  rimeConfig: RimeConfig | null;
  isMock: boolean;

  // Metrics
  lastTurnMetrics: TurnMetrics | null;
  sessionMetrics: SessionMetrics | null;
  ttfaHistory: number[];
  interruptionCount: number;
  staleRejectionCount: number;

  // Tools
  activeTools: ToolActivity[];
  toolHistory: ToolActivity[];

  // Observability
  events: ObservabilityEvent[];

  // Acceptance test
  acceptanceResult: AcceptanceTestResult | null;
  isRunningAcceptance: boolean;

  // Demo mode
  isDemoRunning: boolean;

  // Actions
  setConnected: (v: boolean) => void;
  setSessionId: (id: string | null) => void;
  setStatus: (s: ConversationStatus) => void;
  addTurn: (turn: ConversationTurn) => void;
  updateGenerationId: (id: string) => void;
  setRimeConfig: (config: RimeConfig, isMock: boolean) => void;
  setMetrics: (metrics: TurnMetrics, session: SessionMetrics) => void;
  addEvent: (event: ObservabilityEvent) => void;
  addToolActivity: (tool: ToolActivity) => void;
  completeToolActivity: (toolName: string, result: unknown, cancelled?: boolean, stale?: boolean) => void;
  setAcceptanceResult: (result: AcceptanceTestResult) => void;
  setIsRunningAcceptance: (v: boolean) => void;
  recordInterruption: (oldGen: string, newGen: string) => void;
  recordStaleRejection: (source: string) => void;
  setDemoRunning: (v: boolean) => void;
  setIsPlaying: (v: boolean) => void;
  clearAudioQueue: () => void;
  reset: () => void;
}

const BACKEND_URL = (import.meta as any).env?.VITE_BACKEND_URL || 'http://localhost:8000';
const WS_URL = BACKEND_URL.replace(/^http/, 'ws');

export const useConversationStore = create<ConversationStore>((set, get) => ({
  connected: false,
  sessionId: null,
  wsUrl: `${WS_URL}/ws/voice`,

  status: 'IDLE',
  turns: [],
  currentGenerationId: null,
  currentTurnId: null,

  isPlaying: false,
  audioQueue: [],
  currentAudioGenerationId: null,

  rimeConfig: null,
  isMock: true,

  lastTurnMetrics: null,
  sessionMetrics: null,
  ttfaHistory: [],
  interruptionCount: 0,
  staleRejectionCount: 0,

  activeTools: [],
  toolHistory: [],

  events: [],

  acceptanceResult: null,
  isRunningAcceptance: false,

  isDemoRunning: false,

  setConnected: (v) => set({ connected: v }),
  setSessionId: (id) => set({ sessionId: id }),
  setStatus: (s) => set({ status: s }),

  addTurn: (turn) => set((state) => ({
    turns: [...state.turns.slice(-50), turn], // keep last 50
  })),

  updateGenerationId: (id) => set({ currentGenerationId: id }),

  setRimeConfig: (config, isMock) => set({ rimeConfig: config, isMock }),

  setMetrics: (metrics, session) => {
    const ttfa = metrics.ttfa_ms;
    set((state) => ({
      lastTurnMetrics: metrics,
      sessionMetrics: session,
      ttfaHistory: ttfa != null
        ? [...state.ttfaHistory.slice(-19), ttfa]
        : state.ttfaHistory,
    }));
  },

  addEvent: (event) => set((state) => ({
    events: [...state.events.slice(-200), event],
  })),

  addToolActivity: (tool) => set((state) => ({
    activeTools: [...state.activeTools, tool],
  })),

  completeToolActivity: (toolName, result, cancelled = false, stale = false) => {
    set((state) => {
      const updated = state.activeTools.map((t) =>
        t.tool_name === toolName && !t.end_time
          ? { ...t, end_time: Date.now() / 1000, result, cancelled, stale }
          : t
      );
      const completed = updated.filter((t) => t.tool_name === toolName && t.end_time);
      return {
        activeTools: updated.filter((t) => !t.end_time),
        toolHistory: [...state.toolHistory.slice(-20), ...completed],
      };
    });
  },

  setAcceptanceResult: (result) => set({ acceptanceResult: result, isRunningAcceptance: false }),
  setIsRunningAcceptance: (v) => set({ isRunningAcceptance: v }),

  recordInterruption: (oldGen, newGen) => set((state) => ({
    interruptionCount: state.interruptionCount + 1,
    currentGenerationId: newGen,
  })),

  recordStaleRejection: (source) => set((state) => ({
    staleRejectionCount: state.staleRejectionCount + 1,
  })),

  setDemoRunning: (v) => set({ isDemoRunning: v }),
  setIsPlaying: (v) => set({ isPlaying: v }),
  clearAudioQueue: () => set({ audioQueue: [] }),

  reset: () => set({
    turns: [],
    status: 'IDLE',
    events: [],
    activeTools: [],
    toolHistory: [],
    acceptanceResult: null,
    lastTurnMetrics: null,
    interruptionCount: 0,
    staleRejectionCount: 0,
    ttfaHistory: [],
  }),
}));
