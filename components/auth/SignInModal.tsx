'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

interface SignInModalProps {
  onClose?: () => void;
}

export default function SignInModal({ onClose }: SignInModalProps) {
  const t = useTranslations();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const supabase = createClient();
  const router = useRouter();

  // Countdown timer for resend cooldown
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [resendCooldown]);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setMessage('');
    
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        // User will be automatically created if they don't exist
      },
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
    }
    // If successful, user will be redirected to Google OAuth
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    // Send OTP - user will be automatically created if they don't exist
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // shouldCreateUser defaults to true, so users are auto-registered
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
    } else {
      setOtpSent(true);
      setMessage(t('auth.checkEmail'));
      setResendCooldown(60); // 60 seconds cooldown
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    
    setLoading(true);
    setMessage('');

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
    } else {
      setMessage(t('auth.codeResent'));
      setResendCooldown(60); // 60 seconds cooldown
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: 'email',
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
    } else {
      // Successfully signed in
      setMessage(t('auth.successfullySignedIn'));
      // Refresh the page to update auth state
      router.refresh();
      if (onClose) onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-white/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-md overflow-hidden">
        <div className="bg-[#1E3A8A] px-6 py-5 text-center">
          <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-md mx-auto mb-3 p-2">
            <img src="/notextlogo.png" alt={t('common.appName')} className="w-full h-full object-contain" />
          </div>
          <h2 className="text-xl font-bold text-white mb-1">{t('auth.signIn')}</h2>
          <p className="text-blue-100 text-sm">{t('auth.signInDescription')}</p>
        </div>

        <div className="p-6">
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-5 text-center">
            <span className="material-symbols-outlined text-[#1E3A8A] text-xl mb-1">lock</span>
            <p className="text-sm text-[#1E3A8A] font-medium">{t('auth.freeQueryUsed')}</p>
            <p className="text-xs text-blue-700 mt-1">{t('auth.signInToContinue')}</p>
          </div>

          {message && (
            <div className={`mb-4 p-2.5 rounded-lg text-sm ${
              message === t('auth.checkEmail') || message === t('auth.successfullySignedIn')
                ? 'bg-green-50 text-green-800 border border-green-200' 
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              {message}
            </div>
          )}

          {!otpSent ? (
            <div className="space-y-3">
              <button
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1E3A8A] transition-all shadow-sm disabled:opacity-50 cursor-pointer"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                {t('auth.continueWithGoogle')}
              </button>

              <div className="relative flex items-center py-1">
                <div className="grow border-t border-gray-300"></div>
                <span className="shrink-0 mx-4 text-gray-400 text-sm">{t('auth.orSignInWithEmail')}</span>
                <div className="grow border-t border-gray-300"></div>
              </div>

              <form onSubmit={handleEmailSignIn} className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="email">
                    {t('auth.emailAddress')}
                  </label>
                  <input
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#1E3A8A] focus:border-[#1E3A8A] outline-none transition-shadow placeholder-gray-400"
                    id="email"
                    name="email"
                    placeholder={t('auth.emailPlaceholder')}
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#1E3A8A] text-white font-medium py-2.5 px-4 rounded-lg hover:bg-blue-800 transition-colors shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1E3A8A] disabled:opacity-50 cursor-pointer"
                >
                  {loading ? t('auth.sending') : t('auth.sendLoginCode')}
                </button>
              </form>
            </div>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="otp">
                  {t('auth.enterCode')}
                </label>
                <input
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#1E3A8A] focus:border-[#1E3A8A] outline-none transition-shadow placeholder-gray-400 text-center text-2xl tracking-widest font-mono"
                  id="otp"
                  name="otp"
                  placeholder={t('auth.codePlaceholder')}
                  required
                  type="text"
                  maxLength={8}
                  pattern="[0-9]{8}"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  disabled={loading}
                  autoFocus
                />
                <p className="text-xs text-gray-600 mt-2">
                  {t('auth.sentTo', { email })}
                </p>
              </div>
              <button
                type="submit"
                disabled={loading || otp.length !== 8}
                className="w-full bg-[#1E3A8A] text-white font-medium py-2.5 px-4 rounded-lg hover:bg-blue-800 transition-colors shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1E3A8A] disabled:opacity-50 cursor-pointer"
              >
                {loading ? t('auth.verifying') : t('auth.verifyCode')}
              </button>
              
              {/* Resend Code Button */}
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={resendCooldown > 0 || loading}
                className="w-full text-sm text-[#1E3A8A] hover:text-blue-800 py-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {resendCooldown > 0 
                  ? t('auth.resendCodeIn', { seconds: resendCooldown })
                  : t('auth.resendCode')
                }
              </button>
              
              <button
                type="button"
                onClick={() => {
                  setOtpSent(false);
                  setOtp('');
                  setMessage('');
                  setResendCooldown(0);
                }}
                className="w-full text-sm text-gray-600 hover:text-gray-800 py-2 cursor-pointer"
              >
                {t('auth.backToEmail')}
              </button>
            </form>
          )}
        </div>

        <div className="bg-gray-50 px-6 py-3 text-center border-t border-gray-200">
          <p className="text-xs text-gray-500">
            {t('auth.termsAndPrivacy')}
          </p>
        </div>
      </div>
    </div>
  );
}
