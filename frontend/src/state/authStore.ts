// VoicePilot AI — User Authentication & Chat Session Persistence Store
import { create } from 'zustand';
import type { ConversationTurn } from '../types';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar: string;
  createdAt: number;
}

export interface ChatSession {
  id: string;
  userId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  turns: ConversationTurn[];
}

interface AuthState {
  currentUser: UserProfile | null;
  savedSessions: ChatSession[];
  activeSessionId: string | null;
  isAuthModalOpen: boolean;

  // Actions
  login: (name: string, emailOrId: string) => void;
  logout: () => void;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  createNewChat: () => string;
  loadSession: (sessionId: string) => ChatSession | null;
  saveCurrentSessionTurns: (turns: ConversationTurn[]) => void;
  deleteSession: (sessionId: string) => void;
}

const DEFAULT_USER: UserProfile = {
  id: 'pilot_user_1',
  name: 'Pilot Commander',
  email: 'pilot@voicepilot.ai',
  avatar: '👨‍✈️',
  createdAt: Date.now(),
};

const getStoredUser = (): UserProfile => {
  if (typeof window === 'undefined') return DEFAULT_USER;
  try {
    const raw = localStorage.getItem('vp_current_user');
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Failed to parse current user:', e);
  }
  return DEFAULT_USER;
};

const getStoredSessionsForUser = (userId: string): ChatSession[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`vp_sessions_${userId}`);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Failed to parse sessions:', e);
  }
  return [];
};

export const useAuthStore = create<AuthState>((set, get) => {
  const initialUser = getStoredUser();
  const initialSessions = getStoredSessionsForUser(initialUser.id);
  const initialSessionId = initialSessions[0]?.id || `session_${Date.now()}`;

  return {
    currentUser: initialUser,
    savedSessions: initialSessions,
    activeSessionId: initialSessionId,
    isAuthModalOpen: false,

    login: (name: string, emailOrId: string) => {
      const cleanId = (emailOrId || name).toLowerCase().replace(/[^a-z0-9_]/g, '_');
      const user: UserProfile = {
        id: cleanId || `user_${Date.now()}`,
        name: name.trim() || 'VoicePilot User',
        email: emailOrId.includes('@') ? emailOrId.trim() : `${cleanId}@voicepilot.ai`,
        avatar: ['👨‍✈️', '👩‍✈️', '🎙️', '⚡', '🚀'][Math.floor(Math.random() * 5)],
        createdAt: Date.now(),
      };

      if (typeof window !== 'undefined') {
        localStorage.setItem('vp_current_user', JSON.stringify(user));
      }

      const userSessions = getStoredSessionsForUser(user.id);
      const newSessionId = userSessions[0]?.id || `session_${Date.now()}`;

      set({
        currentUser: user,
        savedSessions: userSessions,
        activeSessionId: newSessionId,
        isAuthModalOpen: false,
      });
    },

    logout: () => {
      const guest = DEFAULT_USER;
      if (typeof window !== 'undefined') {
        localStorage.setItem('vp_current_user', JSON.stringify(guest));
      }
      const guestSessions = getStoredSessionsForUser(guest.id);
      set({
        currentUser: guest,
        savedSessions: guestSessions,
        activeSessionId: guestSessions[0]?.id || `session_${Date.now()}`,
      });
    },

    openAuthModal: () => set({ isAuthModalOpen: true }),
    closeAuthModal: () => set({ isAuthModalOpen: false }),

    createNewChat: () => {
      const { currentUser, savedSessions } = get();
      if (!currentUser) return '';

      const newId = `session_${Date.now()}`;
      const newSession: ChatSession = {
        id: newId,
        userId: currentUser.id,
        title: `Chat Session ${savedSessions.length + 1}`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        turns: [],
      };

      const updated = [newSession, ...savedSessions];
      if (typeof window !== 'undefined') {
        localStorage.setItem(`vp_sessions_${currentUser.id}`, JSON.stringify(updated));
      }

      set({
        savedSessions: updated,
        activeSessionId: newId,
      });
      return newId;
    },

    loadSession: (sessionId: string) => {
      const { savedSessions } = get();
      const match = savedSessions.find((s) => s.id === sessionId);
      if (match) {
        set({ activeSessionId: sessionId });
        return match;
      }
      return null;
    },

    saveCurrentSessionTurns: (turns: ConversationTurn[]) => {
      const { currentUser, savedSessions, activeSessionId } = get();
      if (!currentUser || turns.length === 0) return;

      const sid = activeSessionId || `session_${Date.now()}`;
      const firstUserTurn = turns.find((t) => t.role === 'user');
      const title = firstUserTurn
        ? firstUserTurn.text.slice(0, 36) + (firstUserTurn.text.length > 36 ? '...' : '')
        : `Chat Session`;

      const existingIndex = savedSessions.findIndex((s) => s.id === sid);
      let updated: ChatSession[];

      if (existingIndex >= 0) {
        updated = [...savedSessions];
        updated[existingIndex] = {
          ...updated[existingIndex],
          turns,
          title: updated[existingIndex].title.startsWith('Chat Session') ? title : updated[existingIndex].title,
          updatedAt: Date.now(),
        };
      } else {
        const newSession: ChatSession = {
          id: sid,
          userId: currentUser.id,
          title,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          turns,
        };
        updated = [newSession, ...savedSessions];
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem(`vp_sessions_${currentUser.id}`, JSON.stringify(updated));
      }

      set({ savedSessions: updated, activeSessionId: sid });
    },

    deleteSession: (sessionId: string) => {
      const { currentUser, savedSessions, activeSessionId } = get();
      if (!currentUser) return;

      const updated = savedSessions.filter((s) => s.id !== sessionId);
      if (typeof window !== 'undefined') {
        localStorage.setItem(`vp_sessions_${currentUser.id}`, JSON.stringify(updated));
      }

      const nextId = updated[0]?.id || `session_${Date.now()}`;
      set({
        savedSessions: updated,
        activeSessionId: activeSessionId === sessionId ? nextId : activeSessionId,
      });
    },
  };
});
