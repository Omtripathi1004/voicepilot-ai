import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../state/authStore';

export const GmailNotificationToast: React.FC = () => {
  const notification = useAuthStore((s) => s.activeNotification);
  const clearNotification = useAuthStore((s) => s.clearNotification);
  const verifyOtp = useAuthStore((s) => s.verifyOtp);
  const authStep = useAuthStore((s) => s.authStep);

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!notification) return;
    setCopied(false);
    const timer = setTimeout(() => {
      clearNotification();
    }, 20000);
    return () => clearTimeout(timer);
  }, [notification, clearNotification]);

  if (!notification) return null;

  const handleCopyAndAutofill = () => {
    navigator.clipboard?.writeText(notification.code);
    setCopied(true);
    if (authStep === 'otp_verify') {
      verifyOtp(notification.code);
    }
  };

  return (
    <div className="fixed top-5 right-5 z-[100] max-w-sm w-full animate-in slide-in-from-top-5 duration-300">
      <div className="p-4 rounded-2xl bg-slate-900/95 border border-red-500/40 shadow-2xl backdrop-blur-xl flex flex-col gap-3 relative overflow-hidden">
        {/* Top gradient stripe */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 via-amber-500 to-blue-500" />

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-red-500/20 border border-red-500/40 flex items-center justify-center text-xs text-red-400">
              ✉️
            </div>
            <span className="text-xs font-semibold text-slate-200">Gmail • Security Alert</span>
            <span className="text-[10px] text-slate-400 font-mono">Just now</span>
          </div>
          <button
            onClick={clearNotification}
            className="text-slate-400 hover:text-white text-xs p-1 rounded-md hover:bg-slate-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col gap-1">
          <div className="text-xs font-medium text-slate-300">
            VoicePilot Verification Code for <span className="text-white font-semibold font-mono">{notification.email}</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Use this one-time password (OTP) to authenticate your session:
          </p>
          <div className="mt-1.5 flex items-center justify-between p-2 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-lg font-mono font-extrabold tracking-widest text-brand-300">
              {notification.code}
            </span>
            <button
              onClick={handleCopyAndAutofill}
              className="px-3 py-1 rounded-lg bg-red-600/30 hover:bg-red-600/50 border border-red-500/40 text-red-200 font-semibold text-[11px] transition-all"
            >
              {copied ? '✓ Verified!' : 'Auto-fill OTP →'}
            </button>
          </div>
        </div>

        <div className="text-[9px] text-slate-500 flex items-center justify-between">
          <span>Valid for 10 minutes</span>
          <span>Google Workspace Integration</span>
        </div>
      </div>
    </div>
  );
};
