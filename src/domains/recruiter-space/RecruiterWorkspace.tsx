import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Compass } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import type { Position, Candidate, Language, Company, User, AuthSession } from '@/lib/types';
import * as db from '@/lib/db';
import { ChangePasswordDialog } from '@/components/auth/ChangePasswordDialog';
import { SubscriptionBlockPage } from '@/components/SubscriptionBlockPage';
import { PaymentReminderBanner } from '@/components/PaymentReminderBanner';
import { PaymentPage } from '@/components/PaymentPage';
import { Toaster } from '@/components/ui/sonner';
import { AppShell } from '@/components/layout/AppShell';
import { useTheme } from '@/hooks/use-theme';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { toast } from 'sonner';
import { isSubscriptionExpired, shouldShowPaymentReminder } from '@/lib/payment';
import { logAudit } from '@/lib/auditLog';
import RecruiterAuthGate from './RecruiterAuthGate';
import RecruiterViewRouter from './RecruiterViewRouter';

interface RecruiterWorkspaceProps {
  onSwitchToCandidate: () => void;
}

function ViewSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

/**
 * Kova B2B Recruiter ATS workspace preserving multi-tenant positions, CV OCR scoring,
 * interview generation, billing, and audit logging.
 */
export default function RecruiterWorkspace({ onSwitchToCandidate }: RecruiterWorkspaceProps) {
  const [authSession, setAuthSessionRaw] = useState<AuthSession | null>(() => {
    try {
      return JSON.parse(localStorage.getItem('ats:auth-session') || 'null');
    } catch {
      return null;
    }
  });
  const [language, setLanguageRaw] = useState<Language>(
    () => (localStorage.getItem('ats:language') as Language) || 'fr',
  );
  const [currentCompany, setCurrentCompany] = useState<Company | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [companyUsers, setCompanyUsers] = useState<User[]>([]);
  const [positions, setPositionsRaw] = useState<Position[]>([]);
  const [candidates, setCandidatesRaw] = useState<Candidate[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [activeView, setActiveView] = useState('dashboard');
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showPaymentReminder, setShowPaymentReminder] = useState(false);
  const [showPaymentPage, setShowPaymentPage] = useState(false);

  const posRef = useRef<Position[]>([]);
  const candRef = useRef<Candidate[]>([]);
  const { theme, setTheme } = useTheme();
  const lang = language || 'fr';
  const isAuthenticated = Boolean(authSession?.isAuthenticated);

  const setAuthSession = useCallback((session: AuthSession | null) => {
    setAuthSessionRaw(session);
    if (session) localStorage.setItem('ats:auth-session', JSON.stringify(session));
    else localStorage.removeItem('ats:auth-session');
  }, []);

  const setLanguage = useCallback((nextLang: Language) => {
    setLanguageRaw(nextLang);
    localStorage.setItem('ats:language', nextLang);
  }, []);

  const setPositions = useCallback((updater: Position[] | ((prev: Position[]) => Position[])) => {
    setPositionsRaw((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      db.syncPositions(posRef.current, next).catch(console.error);
      posRef.current = next;
      return next;
    });
  }, []);

  const setCandidates = useCallback((updater: Candidate[] | ((prev: Candidate[]) => Candidate[])) => {
    setCandidatesRaw((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      db.syncCandidates(candRef.current, next).catch(console.error);
      candRef.current = next;
      return next;
    });
  }, []);

  useKeyboardShortcuts([
    { key: '1', alt: true, handler: () => setActiveView('dashboard') },
    { key: '2', alt: true, handler: () => setActiveView('positions') },
    { key: '3', alt: true, handler: () => setActiveView('company') },
    { key: '4', alt: true, handler: () => setActiveView('settings') },
    { key: 'd', ctrl: true, shift: true, handler: () => setTheme(theme === 'dark' ? 'light' : 'dark') },
    { key: 'x', ctrl: true, shift: true, handler: () => setActiveView((v) => (v === 'devtools' ? 'dashboard' : 'devtools')) },
  ]);

  const loadCompanyData = useCallback(async (companyId: string, userId: string) => {
    setDataLoading(true);
    try {
      const [company, users, positionsData] = await Promise.all([
        db.getCompanyById(companyId),
        db.getUsersByCompanyId(companyId),
        db.getPositionsByCompanyId(companyId),
      ]);
      setCurrentCompany(company);
      setCurrentUser(users.find((u) => u.id === userId) ?? null);
      setCompanyUsers(users);
      setPositionsRaw(positionsData);
      posRef.current = positionsData;

      const cands =
        positionsData.length > 0
          ? await db.getCandidatesByPositionIds(positionsData.map((p) => p.id))
          : [];
      setCandidatesRaw(cands);
      candRef.current = cands;
    } catch (error) {
      console.error('Erreur chargement données:', error);
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authSession?.isAuthenticated && authSession.companyId && authSession.userId) {
      void loadCompanyData(authSession.companyId, authSession.userId);
      return;
    }
    setCurrentCompany(null);
    setCurrentUser(null);
    setCompanyUsers([]);
    setPositionsRaw([]);
    setCandidatesRaw([]);
    posRef.current = [];
    candRef.current = [];
    setDataLoading(false);
  }, [authSession?.companyId, authSession?.userId, authSession?.isAuthenticated, loadCompanyData]);

  useEffect(() => {
    if (isAuthenticated && currentCompany) {
      setShowPaymentReminder(shouldShowPaymentReminder(currentCompany));
    }
  }, [isAuthenticated, currentCompany]);

  const handleLogin = (company: Company, user: User) => {
    setCurrentCompany(company);
    setCurrentUser(user);
    setAuthSession({ companyId: company.id, userId: user.id, isAuthenticated: true });
    logAudit({ companyId: company.id, userId: user.id, userName: user.name, action: 'login', entityType: 'session' });
  };

  const handleRegister = (company: Company, user: User) => {
    setCurrentCompany(company);
    setCurrentUser(user);
    setAuthSession({ companyId: company.id, userId: user.id, isAuthenticated: true });
    logAudit({
      companyId: company.id,
      userId: user.id,
      userName: user.name,
      action: 'create',
      entityType: 'company',
      entityId: company.id,
      entityName: company.name,
    });
  };

  const handleLogout = () => {
    if (currentCompany && currentUser) {
      logAudit({
        companyId: currentCompany.id,
        userId: currentUser.id,
        userName: currentUser.name,
        action: 'logout',
        entityType: 'session',
      });
    }
    setAuthSession(null);
    setCurrentCompany(null);
    setCurrentUser(null);
    setActiveView('dashboard');
    toast.success(lang === 'fr' ? 'Déconnexion réussie' : 'Logged out successfully');
  };

  const handleAddUser = async (newUser: User) => {
    await db.createUser(newUser);
    setCompanyUsers((prev) => [...prev, newUser]);
  };

  const handleDeleteUser = async (userId: string) => {
    await db.deleteUser(userId);
    setCompanyUsers((prev) => prev.filter((u) => u.id !== userId));
  };

  const handleUpdateUserRole = async (userId: string, newRole: User['role']) => {
    await db.updateUser(userId, { role: newRole });
    setCompanyUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
  };

  const handlePasswordChanged = async (updatedUser: User) => {
    await db.updateUser(updatedUser.id, updatedUser);
    setCompanyUsers((prev) => prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)));
    if (currentUser?.id === updatedUser.id) setCurrentUser(updatedUser);
  };

  const handleUpdateCompany = async (updated: Company) => {
    await db.updateCompany(updated.id, updated);
    setCurrentCompany(updated);
  };

  if (!isAuthenticated) {
    return (
      <RecruiterAuthGate
        language={lang}
        onLanguageChange={setLanguage}
        onLogin={handleLogin}
        onRegister={handleRegister}
        onSwitchToCandidate={onSwitchToCandidate}
      />
    );
  }

  if (!currentCompany || !currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F6F5F0] p-8">
        {dataLoading ? (
          <div className="w-full max-w-4xl">
            <ViewSkeleton />
          </div>
        ) : (
          <div className="text-center space-y-3">
            <p className="text-sm text-[#525866]">Session expirée</p>
            <button
              type="button"
              onClick={handleLogout}
              className="px-4 py-2 bg-[#0F1419] text-[#F6F5F0] text-xs font-semibold cursor-pointer"
            >
              Se reconnecter
            </button>
          </div>
        )}
      </div>
    );
  }

  if (showPaymentPage) {
    return (
      <div className="min-h-screen bg-[#F6F5F0]">
        <PaymentPage
          company={currentCompany}
          language={lang}
          onUpdateCompany={handleUpdateCompany}
          onCancel={() => setShowPaymentPage(false)}
        />
        <Toaster />
      </div>
    );
  }

  if (isSubscriptionExpired(currentCompany)) {
    return (
      <>
        <SubscriptionBlockPage
          company={currentCompany}
          language={lang}
          onUpgrade={() => setShowPaymentPage(true)}
        />
        <Toaster />
      </>
    );
  }

  return (
    <>
      <div className="bg-[#0F1419] text-[#F6F5F0] px-4 py-1.5 flex items-center justify-between text-xs">
        <span className="font-mono text-[11px]">Kova · Espace Recruteur (ATS)</span>
        <button
          type="button"
          onClick={onSwitchToCandidate}
          className="inline-flex items-center gap-1.5 font-mono text-[11px] hover:underline cursor-pointer"
        >
          <Compass className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Basculer vers Espace Particulier (Radar d&apos;offres)</span>
        </button>
      </div>

      <AppShell
        activeView={activeView}
        onNavigate={setActiveView}
        language={lang}
        onLanguageChange={setLanguage}
        company={currentCompany}
        currentUser={currentUser}
        onLogout={handleLogout}
        onChangePassword={() => setShowChangePassword(true)}
        onUpgrade={() => setShowPaymentPage(true)}
      >
        {showPaymentReminder && (
          <PaymentReminderBanner
            company={currentCompany}
            language={lang}
            onDismiss={() => setShowPaymentReminder(false)}
            onUpgrade={() => setShowPaymentPage(true)}
          />
        )}
        <RecruiterViewRouter
          activeView={activeView}
          company={currentCompany}
          currentUser={currentUser}
          companyUsers={companyUsers}
          positions={positions}
          candidates={candidates}
          language={lang}
          onNavigate={setActiveView}
          setPositions={setPositions}
          setCandidates={setCandidates}
          onUpdateCompany={handleUpdateCompany}
          onAddUser={handleAddUser}
          onDeleteUser={handleDeleteUser}
          onUpdateUserRole={handleUpdateUserRole}
        />
      </AppShell>

      <ChangePasswordDialog
        open={showChangePassword}
        onOpenChange={setShowChangePassword}
        currentUser={currentUser}
        onPasswordChanged={handlePasswordChanged}
        language={lang}
      />
      <Toaster />
    </>
  );
}
