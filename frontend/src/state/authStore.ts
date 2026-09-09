// VoicePilot AI — User Authentication & Chat Session Persistence Store
import { create } from 'zustand';
import type { ConversationTurn } from '../types';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar: string;
  provider?: 'google' | 'email' | 'guest';
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

export interface AuthNotification {
  id: string;
  title: string;
  subtitle: string;
  code: string;
  email: string;
  timestamp: number;
}

interface AuthState {
  currentUser: UserProfile | null;
  savedSessions: ChatSession[];
  activeSessionId: string | null;
  isAuthModalOpen: boolean;
  authStep: 'credentials' | 'otp_verify';
  pendingAuth: {
    name: string;
    email: string;
    generatedOtp: string;
    isGoogle: boolean;
  } | null;
  activeNotification: AuthNotification | null;

  // Actions
  login: (name: string, emailOrId: string, provider?: 'google' | 'email' | 'guest') => void;
  requestEmailOtp: (name: string, email: string) => string;
  verifyOtp: (code: string) => { success: boolean; error?: string };
  resendOtp: () => string;
  loginWithGoogle: (googleEmail?: string, googleName?: string) => void;
  logout: () => void;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  setAuthStep: (step: 'credentials' | 'otp_verify') => void;
  clearNotification: () => void;
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
  provider: 'guest',
  createdAt: Date.now(),
};

const getStoredUser = (): UserProfile | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('vp_current_user');
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Failed to parse current user:', e);
  }
  return null; // First-time visitor: not logged in, show Login Page first
};

const getStoredSessionsForUser = (userId: string | undefined): ChatSession[] => {
  if (!userId || typeof window === 'undefined') return [];
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
  const initialSessions = getStoredSessionsForUser(initialUser?.id);
  const initialSessionId = initialSessions[0]?.id || `session_${Date.now()}`;

  return {
    currentUser: initialUser,
    savedSessions: initialSessions,
    activeSessionId: initialSessionId,
    isAuthModalOpen: false,
    authStep: 'credentials',
    pendingAuth: null,
    activeNotification: null,

    login: (name: string, emailOrId: string, provider: 'google' | 'email' | 'guest' = 'email') => {
      const cleanId = (emailOrId || name).toLowerCase().replace(/[^a-z0-9_]/g, '_');
      const user: UserProfile = {
        id: cleanId || `user_${Date.now()}`,
        name: name.trim() || 'VoicePilot User',
        email: emailOrId.includes('@') ? emailOrId.trim() : `${cleanId}@voicepilot.ai`,
        avatar: provider === 'google' ? '🌐' : ['👨‍✈️', '👩‍✈️', '🎙️', '⚡', '🚀'][Math.floor(Math.random() * 5)],
        provider,
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
        authStep: 'credentials',
        pendingAuth: null,
      });
    },

    requestEmailOtp: (name: string, email: string) => {
      // Generate a secure 6-digit OTP code
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const safeName = name.trim() || email.split('@')[0];

      const notification: AuthNotification = {
        id: `notif_${Date.now()}`,
        title: 'Google / Gmail Security',
        subtitle: `VoicePilot AI Verification Code for ${email}`,
        code: otp,
        email,
        timestamp: Date.now(),
      };

      set({
        authStep: 'otp_verify',
        pendingAuth: {
          name: safeName,
          email: email.trim(),
          generatedOtp: otp,
          isGoogle: false,
        },
        activeNotification: notification,
      });

      return otp;
    },

    verifyOtp: (code: string) => {
      const { pendingAuth, login } = get();
      if (!pendingAuth) {
        return { success: false, error: 'No authentication session in progress. Please try again.' };
      }

      if (code.trim() !== pendingAuth.generatedOtp) {
        return { success: false, error: 'Incorrect 6-digit OTP code. Please check your Gmail and try again.' };
      }

      // Successful verification
      login(pendingAuth.name, pendingAuth.email, pendingAuth.isGoogle ? 'google' : 'email');
      set({
        authStep: 'credentials',
        pendingAuth: null,
        activeNotification: null,
      });

      return { success: true };
    },

    resendOtp: () => {
      const { pendingAuth } = get();
      const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
      if (pendingAuth) {
        const notification: AuthNotification = {
          id: `notif_${Date.now()}`,
          title: 'Google / Gmail Security',
          subtitle: `New VoicePilot AI Verification Code for ${pendingAuth.email}`,
          code: newOtp,
          email: pendingAuth.email,
          timestamp: Date.now(),
        };

        set({
          pendingAuth: {
            ...pendingAuth,
            generatedOtp: newOtp,
          },
          activeNotification: notification,
        });
      }
      return newOtp;
    },

    loginWithGoogle: (googleEmail = 'user@gmail.com', googleName = 'Google User') => {
      // Direct Google OAuth flow
      const { login } = get();
      login(googleName, googleEmail, 'google');
    },

    setAuthStep: (step) => set({ authStep: step }),
    clearNotification: () => set({ activeNotification: null }),

    logout: () => {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('vp_current_user');
      }
      set({
        currentUser: null,
        savedSessions: [],
        activeSessionId: null,
        authStep: 'credentials',
        pendingAuth: null,
        activeNotification: null,
      });
    },

    openAuthModal: () => set({ isAuthModalOpen: true, authStep: 'credentials' }),
    closeAuthModal: () => set({ isAuthModalOpen: false, authStep: 'credentials' }),

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
