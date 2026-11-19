import React, { lazy, Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import type { Candidate, Company, Language, Position, User } from '@/lib/types';
import { DashboardView } from '@/components/DashboardView';
import { CompanyManagement } from '@/components/CompanyManagement';
import { SettingsView } from '@/components/SettingsView';
import { DevTools } from '@/components/DevTools';

const PositionsView = lazy(() => import('@/components/PositionsView'));
const HistoryView = lazy(() => import('@/components/HistoryView'));
const FAQView = lazy(() => import('@/components/FAQView'));

export interface RecruiterViewRouterProps {
  activeView: string;
  company: Company;
  currentUser: User;
  companyUsers: User[];
  positions: Position[];
  candidates: Candidate[];
  language: Language;
  onNavigate: (view: string) => void;
  setPositions: (updater: Position[] | ((prev: Position[]) => Position[])) => void;
  setCandidates: (updater: Candidate[] | ((prev: Candidate[]) => Candidate[])) => void;
  onUpdateCompany: (updated: Company) => Promise<void>;
  onAddUser: (newUser: User) => Promise<void>;
  onDeleteUser: (userId: string) => Promise<void>;
  onUpdateUserRole: (userId: string, newRole: User['role']) => Promise<void>;
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
 * Dispatches active Kova B2B Recruiter ATS views with lazy code-splitting.
 */
export default function RecruiterViewRouter({
  activeView,
  company,
  currentUser,
  companyUsers,
  positions,
  candidates,
  language,
  onNavigate,
  setPositions,
  setCandidates,
  onUpdateCompany,
  onAddUser,
  onDeleteUser,
  onUpdateUserRole,
}: RecruiterViewRouterProps) {
  if (activeView === 'positions') {
    return (
      <Suspense fallback={<ViewSkeleton />}>
        <PositionsView
          positions={positions}
          setPositions={setPositions}
          candidates={candidates}
          setCandidates={setCandidates}
          companyId={company.id}
          language={language}
        />
      </Suspense>
    );
  }
  if (activeView === 'history') {
    return (
      <Suspense fallback={<ViewSkeleton />}>
        <HistoryView positions={positions} candidates={candidates} language={language} onNavigate={onNavigate} />
      </Suspense>
    );
  }
  if (activeView === 'company') {
    return (
      <CompanyManagement
        company={company}
        currentUser={currentUser}
        allUsers={companyUsers}
        positionsCount={positions.length}
        candidatesCount={candidates.length}
        language={language}
        onUpdateCompany={onUpdateCompany}
        onAddUser={onAddUser}
        onDeleteUser={onDeleteUser}
        onUpdateUserRole={onUpdateUserRole}
      />
    );
  }
  if (activeView === 'faq') {
    return (
      <Suspense fallback={<ViewSkeleton />}>
        <FAQView language={language} onNavigate={onNavigate} />
      </Suspense>
    );
  }
  if (activeView === 'settings') return <SettingsView language={language} />;
  if (activeView === 'devtools') return <DevTools language={language} />;
  return (
    <DashboardView positions={positions} candidates={candidates} language={language} onNavigate={onNavigate} />
  );
}
