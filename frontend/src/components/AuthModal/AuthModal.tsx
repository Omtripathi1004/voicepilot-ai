import React, { useState } from 'react';
import { useAuthStore } from '../../state/authStore';

export const AuthModal: React.FC = () => {
  const isAuthModalOpen = useAuthStore((s) => s.isAuthModalOpen);
  const closeAuthModal = useAuthStore((s) => s.closeAuthModal);
  const currentUser = useAuthStore((s) => s.currentUser);
  const login = useAuthStore((s) => s.login);
  const logout = useAuthStore((s) => s.logout);
  const savedSessions = useAuthStore((s) => s.savedSessions);

  const [name, setName] = useState(currentUser?.name || '');
  const [userIdOrEmail, setUserIdOrEmail] = useState(currentUser?.id || '');
  const [isRegisterMode, setIsRegisterMode] = useState(false);

  if (!isAuthModalOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    login(name.trim(), userIdOrEmail.trim() || name.toLowerCase().replace(/\s+/g, '_'));
  };

  const handleQuickLogin = (demoName: string, demoId: string) => {
    login(demoName, demoId);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl flex flex-col gap-5 relative">
        {/* Close Button */}
        <button
          onClick={closeAuthModal}
          className="absolute top-5 right-5 text-slate-400 hover:text-white text-lg p-1 rounded-lg hover:bg-slate-800 transition-colors"
          title="Close"
        >
          ✕
        </button>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-brand-600 via-indigo-600 to-violet-500 flex items-center justify-center text-2xl shadow-lg shadow-brand-500/30">
            {currentUser?.avatar || '🎙️'}
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">
              {currentUser ? 'User Account & Chat Cloud' : 'Sign in to VoicePilot AI'}
            </h2>
            <p className="text-xs text-slate-400">
              Conversations are linked and saved permanently to your User ID.
            </p>
          </div>
        </div>

        {/* Current User Status Banner */}
        {currentUser && (
          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[11px] text-slate-400 font-mono">Logged in as:</span>
              <span className="text-sm font-bold text-white">{currentUser.name}</span>
              <span className="text-[11px] text-brand-400 font-mono">ID: {currentUser.id}</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/30 font-mono">
                {savedSessions.length} {savedSessions.length === 1 ? 'chat saved' : 'chats saved'}
              </span>
            </div>
          </div>
        )}

        {/* Login / Switch Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Your Name / Callsign:
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Om Tripathi"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              User ID or Email:
            </label>
            <input
              type="text"
              value={userIdOrEmail}
              onChange={(e) => setUserIdOrEmail(e.target.value)}
              placeholder="e.g. om_tripathi or om@domain.com"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            />
            <span className="text-[10px] text-slate-500 mt-1 block">
              Used as the unique key to store and retrieve your conversation history.
            </span>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="submit"
              className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:brightness-110 font-semibold text-xs text-white shadow-lg shadow-brand-600/30 transition-all"
            >
              {currentUser?.id === userIdOrEmail ? 'Update Profile' : 'Sign In / Switch Account'}
            </button>
            {currentUser && (
              <button
                type="button"
                onClick={logout}
                className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs transition-colors"
                title="Log out and return to Guest Commander"
              >
                Sign Out
              </button>
            )}
          </div>
        </form>

        {/* Quick Demo Accounts */}
        <div className="border-t border-slate-800/80 pt-3 flex flex-col gap-2">
          <span className="text-[11px] font-semibold text-slate-400">Quick Profile Switch:</span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleQuickLogin('Om Tripathi', 'om_tripathi')}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs flex items-center gap-1.5 border border-slate-700/60 transition-all"
            >
              <span>👨‍💻</span>
              <span>Om Tripathi (Personal)</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('Test Pilot', 'pilot_test')}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs flex items-center gap-1.5 border border-slate-700/60 transition-all"
            >
              <span>🚀</span>
              <span>Test Pilot</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
