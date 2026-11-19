import React, { useState } from 'react';
import { ArrowLeft, Globe } from 'lucide-react';
import type { Company, Language, User } from '@/lib/types';
import { LoginForm } from '@/components/auth/LoginForm';
import { RegistrationForm } from '@/components/auth/RegistrationForm';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';
import { Toaster } from '@/components/ui/sonner';

interface RecruiterAuthGateProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
  onLogin: (company: Company, user: User) => void;
  onRegister: (company: Company, user: User) => void;
  onSwitchToCandidate: () => void;
}

/**
 * Clean light architectural authentication gate for Kova's B2B Recruiter ATS workspace,
 * with instant one-click return to the Individual Job Radar & Coach space.
 */
export default function RecruiterAuthGate({
  language,
  onLanguageChange,
  onLogin,
  onRegister,
  onSwitchToCandidate,
}: RecruiterAuthGateProps) {
  const [authView, setAuthView] = useState<'login' | 'register' | 'forgot'>('login');

  return (
    <div className="min-h-screen bg-[#F6F5F0] text-[#0F1419] flex flex-col">
      <header className="border-b border-[#0F1419]/12 bg-[#FFFFFF]">
        <div className="max-w-[1440px] mx-auto px-5 sm:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onSwitchToCandidate}
              className="inline-flex items-center gap-2 px-3.5 py-2 border border-[#0F1419]/15 bg-[#F6F5F0] text-xs font-semibold text-[#0F1419] hover:bg-[#0F1419] hover:text-[#F6F5F0] transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Espace Particulier (Radar)</span>
            </button>
            <div className="hidden sm:flex items-center gap-2.5">
              <span className="w-7 h-7 bg-[#0F1419] text-[#F6F5F0] font-mono text-xs font-semibold flex items-center justify-center">
                K
              </span>
              <span className="font-semibold text-sm text-[#0F1419]">Kova · ATS Recruteur</span>
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 border border-[#0F1419]/15 bg-[#F6F5F0] px-2 py-1">
            <Globe className="w-3.5 h-3.5 text-[#525866]" aria-hidden="true" />
            {(['fr', 'en', 'es'] as const).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => onLanguageChange(code)}
                className={`px-2 py-0.5 font-mono text-[11px] uppercase cursor-pointer ${
                  language === code ? 'bg-[#0F1419] text-[#F6F5F0]' : 'text-[#525866] hover:text-[#0F1419]'
                }`}
              >
                {code}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-5 py-10">
        <div className="w-full max-w-md space-y-6">
          <div className="space-y-1.5 text-center">
            <p className="font-mono text-[11px] text-[#525866] uppercase tracking-wider">
              Kova · Espace Entreprise &amp; Cabinets
            </p>
            <h1 className="font-editorial text-4xl text-[#0F1419]">
              Pilotage <em className="italic text-[#0F1419]/65">Recrutement IA</em>
            </h1>
          </div>

          {authView === 'login' && (
            <LoginForm
              onLogin={onLogin}
              onCreateAccount={() => setAuthView('register')}
              onForgotPassword={() => setAuthView('forgot')}
              language={language}
            />
          )}
          {authView === 'register' && (
            <RegistrationForm
              onRegister={onRegister}
              onBack={() => setAuthView('login')}
              language={language}
            />
          )}
          {authView === 'forgot' && (
            <ForgotPasswordForm onBack={() => setAuthView('login')} language={language} />
          )}
        </div>
      </main>

      <Toaster />
    </div>
  );
}
