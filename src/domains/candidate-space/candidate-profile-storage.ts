import {
  DEFAULT_CANDIDATE_PROFILE,
  type ApplicationStage,
  type CandidateProfile,
  type TrackedApplication,
} from './candidate-profile-types';

const PROFILE_STORAGE_KEY = 'kova:candidate-profile:v1';
const TRACKER_STORAGE_KEY = 'kova:candidate-applications:v1';

/**
 * Reads the persisted individual candidate profile or returns a clean starter profile.
 */
export function loadCandidateProfile(): CandidateProfile {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return DEFAULT_CANDIDATE_PROFILE;
    const parsed = JSON.parse(raw) as Partial<CandidateProfile>;
    return {
      ...DEFAULT_CANDIDATE_PROFILE,
      ...parsed,
      skills: Array.isArray(parsed.skills) ? parsed.skills : DEFAULT_CANDIDATE_PROFILE.skills,
      targetRoles: Array.isArray(parsed.targetRoles) ? parsed.targetRoles : DEFAULT_CANDIDATE_PROFILE.targetRoles,
      highlights: Array.isArray(parsed.highlights) ? parsed.highlights : DEFAULT_CANDIDATE_PROFILE.highlights,
      languages: Array.isArray(parsed.languages) ? parsed.languages : DEFAULT_CANDIDATE_PROFILE.languages,
    };
  } catch {
    return DEFAULT_CANDIDATE_PROFILE;
  }
}

/**
 * Persists the individual candidate profile locally.
 */
export function saveCandidateProfile(profile: CandidateProfile): CandidateProfile {
  const next: CandidateProfile = {
    ...profile,
    updatedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(next));
  } catch (err) {
    console.error('[kova] Unable to persist candidate profile:', err);
  }
  return next;
}

/**
 * Loads saved/tracked individual job applications.
 */
export function loadTrackedApplications(): TrackedApplication[] {
  try {
    const raw = localStorage.getItem(TRACKER_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as TrackedApplication[]) : [];
  } catch {
    return [];
  }
}

/**
 * Persists the individual application tracker list.
 */
export function saveTrackedApplications(apps: TrackedApplication[]): void {
  try {
    localStorage.setItem(TRACKER_STORAGE_KEY, JSON.stringify(apps));
  } catch (err) {
    console.error('[kova] Unable to persist tracked applications:', err);
  }
}

/**
 * Upserts a tracked application cleanly without mutating the source array.
 */
export function upsertTrackedApplication(
  list: TrackedApplication[],
  entry: Omit<TrackedApplication, 'updatedAt'>,
): TrackedApplication[] {
  const updated: TrackedApplication = { ...entry, updatedAt: new Date().toISOString() };
  const exists = list.some((item) => item.offerId === entry.offerId);
  if (exists) {
    return list.map((item) => (item.offerId === entry.offerId ? updated : item));
  }
  return [updated, ...list];
}

/**
 * Updates the workflow stage of a tracked application.
 */
export function updateApplicationStage(
  list: TrackedApplication[],
  offerId: string,
  stage: ApplicationStage,
): TrackedApplication[] {
  return list.map((item) =>
    item.offerId === offerId ? { ...item, stage, updatedAt: new Date().toISOString() } : item,
  );
}
