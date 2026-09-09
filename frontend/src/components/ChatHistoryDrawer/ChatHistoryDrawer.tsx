import React from 'react';
import { useAuthStore, type ChatSession } from '../../state/authStore';
import { useConversationStore } from '../../state/conversationStore';

interface ChatHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChatHistoryDrawer: React.FC<ChatHistoryDrawerProps> = ({ isOpen, onClose }) => {
  const currentUser = useAuthStore((s) => s.currentUser);
  const savedSessions = useAuthStore((s) => s.savedSessions);
  const activeSessionId = useAuthStore((s) => s.activeSessionId);
  const loadSession = useAuthStore((s) => s.loadSession);
  const createNewChat = useAuthStore((s) => s.createNewChat);
  const deleteSession = useAuthStore((s) => s.deleteSession);
  const setTurns = useConversationStore((s) => s.reset);
  const addTurn = useConversationStore((s) => s.addTurn);

  if (!isOpen) return null;

  const handleSelectSession = (session: ChatSession) => {
    loadSession(session.id);
    setTurns();
    session.turns.forEach((t) => addTurn(t));
    onClose();
  };

  const handleNewChat = () => {
    createNewChat();
    setTurns();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-slate-900 border-l border-slate-800 h-full p-6 flex flex-col gap-4 shadow-2xl overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">🗂️</span>
            <div>
              <h3 className="text-sm font-bold text-white">Saved Conversations</h3>
              <p className="text-[11px] text-slate-400 font-mono">User: {currentUser?.id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-lg p-1 rounded-lg hover:bg-slate-800"
          >
            ✕
          </button>
        </div>

        {/* New Chat Button */}
        <button
          onClick={handleNewChat}
          className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:brightness-110 font-semibold text-xs text-white shadow-md shadow-brand-600/30 transition-all"
        >
          <span>＋</span>
          <span>Start New Conversation</span>
        </button>

        {/* Sessions List */}
        <div className="flex flex-col gap-2.5 flex-1 overflow-y-auto mt-2">
          {savedSessions.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
              <span className="text-3xl opacity-40">💬</span>
              <span>No saved chats yet for this user.</span>
              <span>Start speaking or typing to save automatically!</span>
            </div>
          ) : (
            savedSessions.map((session) => {
              const isActive = session.id === activeSessionId;
              const dateStr = new Date(session.updatedAt).toLocaleDateString([], {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={session.id}
                  onClick={() => handleSelectSession(session)}
                  className={`group relative p-3 rounded-xl border text-left cursor-pointer transition-all flex flex-col gap-1 ${
                    isActive
                      ? 'bg-brand-950/40 border-brand-500/50 shadow-md shadow-brand-500/10'
                      : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-800/50 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-xs text-slate-200 truncate group-hover:text-white">
                      {session.title}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSession(session.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-400 p-1 text-xs transition-opacity"
                      title="Delete chat"
                    >
                      🗑️
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                    <span>{session.turns.length} messages</span>
                    <span>{dateStr}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
