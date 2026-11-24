// Transient coordination only. Durable daily prompt state remains the existing
// owner-scoped prompt receipt; a restart uses that same ordinary prompt path.
let owner: string | undefined;
let incomplete = true;
let handoff: string | undefined;
// First-run tour (brief 06): shown once, right after onboarding, before the first check-in.
let tour: string | undefined;
export function setupOwner(next: string | undefined, complete: boolean | null) {
  if (owner !== next) { owner = next; handoff = undefined; tour = undefined; }
  incomplete = complete !== true;
}
export function beginInitialCheckIn(id: string) { if (id === owner) { handoff = id; tour = id; } }
export function firstRunTourPending(id?: string) { return Boolean(id && id === owner && tour === id); }
export function finishFirstRunTour(id: string) { if (id === owner) tour = undefined; }
export function initialCheckInPending(id?: string) { return Boolean(id && id === owner && handoff === id); }
export function finishInitialCheckIn(id: string) { if (id === owner) handoff = undefined; }
export function setupBlocksUpgrade(id?: string) { return Boolean(id && id === owner && (incomplete || handoff === id)); }
