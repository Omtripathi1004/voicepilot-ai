import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../../state/authStore';

export const AuthModal: React.FC = () => {
  const isAuthModalOpen = useAuthStore((s) => s.isAuthModalOpen);
  const closeAuthModal = useAuthStore((s) => s.closeAuthModal);
  const currentUser = useAuthStore((s) => s.currentUser);
  const authStep = useAuthStore((s) => s.authStep);
  const setAuthStep = useAuthStore((s) => s.setAuthStep);
  const pendingAuth = useAuthStore((s) => s.pendingAuth);
  const requestEmailOtp = useAuthStore((s) => s.requestEmailOtp);
  const verifyOtp = useAuthStore((s) => s.verifyOtp);
  const resendOtp = useAuthStore((s) => s.resendOtp);
  const loginWithGoogle = useAuthStore((s) => s.loginWithGoogle);
  const logout = useAuthStore((s) => s.logout);
  const savedSessions = useAuthStore((s) => s.savedSessions);

  // Form State
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [name, setName] = useState(currentUser?.name || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(60);

  // Input refs for 6 OTP boxes
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Countdown timer for OTP resend
  useEffect(() => {
    let timer: any;
    if (authStep === 'otp_verify' && countdown > 0) {
      timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [authStep, countdown]);

  if (!isAuthModalOpen) return null;

  const handleCredentialsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const targetEmail = email.trim();
    if (!targetEmail || !targetEmail.includes('@')) {
      setErrorMsg('Please provide a valid email address (e.g. user@gmail.com).');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      requestEmailOtp(name.trim() || targetEmail.split('@')[0], targetEmail);
      setCountdown(60);
      setOtpDigits(['', '', '', '', '', '']);
      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 100);
    }, 450);
  };

  const handleOtpChange = (index: number, value: string) => {
    setErrorMsg(null);
    const cleaned = value.replace(/[^0-9]/g, '');

    // Handle paste of 6 digits
    if (cleaned.length > 1) {
      const slice = cleaned.slice(0, 6).split('');
      const newDigits = [...otpDigits];
      slice.forEach((d, i) => {
        if (i < 6) newDigits[i] = d;
      });
      setOtpDigits(newDigits);
      const nextFocus = Math.min(slice.length, 5);
      otpInputRefs.current[nextFocus]?.focus();
      return;
    }

    const newDigits = [...otpDigits];
    newDigits[index] = cleaned;
    setOtpDigits(newDigits);

    // Auto-advance
    if (cleaned && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const fullOtp = otpDigits.join('');
    if (fullOtp.length !== 6) {
      setErrorMsg('Please enter all 6 digits of the OTP verification code.');
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      const res = verifyOtp(fullOtp);
      if (!res.success) {
        setErrorMsg(res.error || 'Invalid OTP. Please check your Gmail and try again.');
      }
    }, 350);
  };

  const handleResend = () => {
    if (countdown > 0) return;
    setErrorMsg(null);
    resendOtp();
    setCountdown(60);
    setOtpDigits(['', '', '', '', '', '']);
    otpInputRefs.current[0]?.focus();
  };

  const handleGoogleSignIn = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      const googleUserEmail = email.includes('@gmail.com') ? email : 'omtripathi1004@gmail.com';
      const googleUserName = name || 'Om Tripathi';
      loginWithGoogle(googleUserEmail, googleUserName);
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800/90 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl flex flex-col gap-5 relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute -top-20 -right-20 w-48 h-48 bg-violet-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={closeAuthModal}
          className="absolute top-5 right-5 text-slate-400 hover:text-white text-lg p-1.5 rounded-xl hover:bg-slate-800/60 transition-colors z-10"
          title="Close"
        >
          ✕
        </button>

        {/* STEP 1: CREDENTIALS / SIGN IN */}
        {authStep === 'credentials' ? (
          <>
            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-brand-600 via-indigo-600 to-violet-500 flex items-center justify-center text-2xl shadow-lg shadow-brand-500/30">
                {currentUser?.avatar || '🎙️'}
              </div>
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">
                  {isRegisterMode ? 'Create VoicePilot Account' : 'Sign In to VoicePilot AI'}
                </h2>
                <p className="text-xs text-slate-400">
                  Secure voice cockpit access with 2FA email verification.
                </p>
              </div>
            </div>

            {/* Current status if already logged in */}
            {currentUser && currentUser.provider !== 'guest' && (
              <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-400 font-mono">Current Account:</span>
                  <span className="text-sm font-bold text-white">{currentUser.name}</span>
                  <span className="text-[11px] text-brand-400 font-mono truncate max-w-[220px]">
                    {currentUser.email}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={logout}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
                >
                  Sign Out
                </button>
              </div>
            )}

            {/* Google Sign-In Button */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 font-semibold text-xs shadow-md transition-all active:scale-[0.99]"
            >
              {/* Google 4-color SVG */}
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              Continue with Google Account
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 my-1">
              <div className="flex-1 h-[1px] bg-slate-800" />
              <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">
                or with email & password
              </span>
              <div className="flex-1 h-[1px] bg-slate-800" />
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-300 text-xs flex items-center gap-2 animate-shake">
                <span>⚠️</span>
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleCredentialsSubmit} className="flex flex-col gap-3">
              {isRegisterMode && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Your Name:
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Om Tripathi"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Gmail / Email ID:
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="yourname@gmail.com"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all"
                  />
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500 text-xs">
                    📧
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Password:
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-200 text-xs"
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  A 6-digit OTP code will be sent to your Gmail to complete sign-in.
                </span>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-2 w-full py-3 px-4 rounded-xl bg-gradient-to-r from-brand-600 via-indigo-600 to-violet-600 hover:brightness-110 font-semibold text-xs text-white shadow-lg shadow-brand-600/30 transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span className="animate-pulse">Generating OTP...</span>
                ) : (
                  <>
                    <span>Send 6-Digit OTP to Gmail</span>
                    <span>→</span>
                  </>
                )}
              </button>

              <div className="flex items-center justify-center pt-2 text-xs text-slate-400">
                <span>
                  {isRegisterMode ? 'Already have an account? ' : "Don't have an account? "}
                </span>
                <button
                  type="button"
                  onClick={() => setIsRegisterMode(!isRegisterMode)}
                  className="text-brand-400 hover:text-brand-300 font-semibold ml-1 underline transition-colors"
                >
                  {isRegisterMode ? 'Sign In' : 'Create Account'}
                </button>
              </div>
            </form>
          </>
        ) : (
          /* STEP 2: 6-DIGIT EMAIL OTP VERIFICATION */
          <div className="flex flex-col gap-4">
            <button
              type="button"
              onClick={() => setAuthStep('credentials')}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 w-fit transition-colors"
            >
              <span>←</span>
              <span>Back to Login</span>
            </button>

            <div className="text-center flex flex-col items-center">
              <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-3xl mb-3 shadow-inner">
                ✉️
              </div>
              <h2 className="text-lg font-bold text-white">Check Your Gmail Inbox</h2>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                We sent a 6-digit verification code to:
              </p>
              <span className="text-xs font-mono text-brand-300 font-semibold bg-brand-950/60 px-2.5 py-1 rounded-lg border border-brand-500/30 mt-1">
                {pendingAuth?.email}
              </span>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-300 text-xs flex items-center gap-2 animate-shake">
                <span>⚠️</span>
                <span>{errorMsg}</span>
              </div>
            )}

            {/* 6 Individual Digit Boxes */}
            <form onSubmit={handleOtpSubmit} className="flex flex-col gap-4">
              <div className="flex justify-center items-center gap-2 sm:gap-2.5 my-2">
                {otpDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => (otpInputRefs.current[idx] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    className="w-11 h-12 text-center text-lg font-mono font-bold bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/50 transition-all"
                  />
                ))}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 font-semibold text-xs text-white shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2"
              >
                {loading ? 'Verifying...' : 'Verify OTP & Enter Cockpit'}
              </button>

              <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                <span>Didn't receive the email?</span>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={countdown > 0}
                  className={`font-semibold transition-colors ${
                    countdown > 0
                      ? 'text-slate-500 cursor-not-allowed'
                      : 'text-brand-400 hover:text-brand-300 underline'
                  }`}
                >
                  {countdown > 0 ? `Resend in ${countdown}s` : 'Resend OTP Code'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
