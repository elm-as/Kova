import React, { useState } from 'react';
import CandidateWorkspace from './domains/candidate-space/CandidateWorkspace';
import RecruiterWorkspace from './domains/recruiter-space/RecruiterWorkspace';

type WorkspaceMode = 'candidate' | 'recruiter';

const MODE_STORAGE_KEY = 'kova:workspace-mode';

function resolveInitialMode(): WorkspaceMode {
  if (typeof window === 'undefined') return 'candidate';
  const param = new URLSearchParams(window.location.search).get('mode');
  if (param === 'recruiter' || param === 'candidate') return param;
  const stored = localStorage.getItem(MODE_STORAGE_KEY);
  return stored === 'recruiter' ? 'recruiter' : 'candidate';
}

/**
 * Dual-mode Kova root shell bridging Individual Job Radar & Coach (B2C)
 * and Multi-Tenant Recruiter ATS (B2B).
 */
export default function App() {
  const [mode, setMode] = useState<WorkspaceMode>(resolveInitialMode);

  const switchMode = (next: WorkspaceMode) => {
    setMode(next);
    try {
      localStorage.setItem(MODE_STORAGE_KEY, next);
    } catch {
      // Ignore storage quota errors in private browsing modes
    }
  };

  if (mode === 'recruiter') {
    return <RecruiterWorkspace onSwitchToCandidate={() => switchMode('candidate')} />;
  }

  return <CandidateWorkspace onSwitchToRecruiter={() => switchMode('recruiter')} />;
}
