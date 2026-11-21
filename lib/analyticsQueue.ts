import { parseAnalyticsEvent, permittedProperties, uuid, type AnalyticsEvent, type AnalyticsEventName } from './analyticsContract';

export type AnalyticsScope = { owner: string | null; consent: string; secret: string; expiresAt?: string };
type Pending = { scope: AnalyticsScope; event: AnalyticsEvent; attempts: number; next: number };
type State = { version: 1; scopes: AnalyticsScope[]; revoked: AnalyticsScope[]; retired: string[]; queue: Pending[]; closed?: boolean; choices?: (string | null)[] };
export type QueueDependencies = {
  credential?(owner: string | null, previous: AnalyticsScope | null, signal: AbortSignal): Promise<AnalyticsScope | null>;
  scopesChanged?(scopes: AnalyticsScope[]): void;
  read(): Promise<string | null>; write(value: string): Promise<void>; random(): string; now(): number;
  send(scope: AnalyticsScope, event: AnalyticsEvent, signal: AbortSignal): Promise<'accepted' | 'rejected' | 'later'>;
  withdraw(scope: AnalyticsScope, signal: AbortSignal): Promise<boolean>;
};
/** One serial storage writer; network never holds the storage lock. */
export function createAnalyticsQueue(d: QueueDependencies) {
  let writes: Promise<unknown> = Promise.resolve(), state: State | null = null;
  let active: AbortController | null = null, draining = false, epoch = 0, credentialRunning = false;
  let credentialFinished: Promise<void> = Promise.resolve();
  const stopped = new Set<string | null>();
  const credentialBlocked = new Set<string | null>();
  const validCredential = (scope: AnalyticsScope) => Number.isFinite(Date.parse(scope.expiresAt ?? '')) && Date.parse(scope.expiresAt!) > d.now();
  const serial = <T>(fn: (s: State) => Promise<T> | T): Promise<T> => {
    const result = writes.catch(() => undefined).then(async () => {
      if (!state) {
        // A temporarily unreadable store is not an empty/corrupt queue. Leave it
        // untouched so the next normal lifecycle opportunity can recover it.
        const saved = await d.read();
        try {
          const raw = JSON.parse(saved ?? 'null');
          state = raw?.version === 1 && Array.isArray(raw.scopes) && raw.scopes.length<=200 && raw.scopes.every(validScope)
            && Array.isArray(raw.revoked) && raw.revoked.length<=200 && raw.revoked.every(validScope)
            && Array.isArray(raw.retired) && raw.retired.length<=200 && raw.retired.every((id:unknown)=>typeof id==='string'&&id.length<=36)
            && (raw.choices===undefined || (Array.isArray(raw.choices) && raw.choices.length<=200 && raw.choices.every((v:unknown)=>v===null || (typeof v==='string' && v.length<=36))))
            && Array.isArray(raw.queue) && raw.queue.length<=200 ? raw : null;
        } catch { /* Corrupt optional storage is discarded, never treated as consent. */ }
        state ??= { version: 1, scopes: [], revoked: [], retired: [], queue: [] };
      }
      state.choices ??= state.scopes.map(s => s.owner);
      state.queue = state.queue.filter(p => p && parseAnalyticsEvent(p.event, d.now()) && Number.isInteger(p.attempts) && p.attempts >= 0 && p.attempts < 8
        && Number.isFinite(p.next) && samescope(state!.scopes, p.scope)).slice(-200);
      const value = await fn(state);
      await d.write(JSON.stringify(state));
      d.scopesChanged?.(state.scopes.filter(s => !stopped.has(s.owner) && !credentialBlocked.has(s.owner) && validCredential(s)));
      return value;
    });
    writes = result;
    return result;
  };
  async function consent(owner: string | null, granted: boolean) {
    // Stop in-flight work synchronously, before a slow storage write/read settles.
    epoch++; active?.abort();
    if (!granted) { stopped.add(owner); d.scopesChanged?.((state?.scopes ?? []).filter(s => !stopped.has(s.owner))); }
    const generation = epoch;
    await serial(s => {
      if (granted && (s.closed || s.retired.includes(owner ?? '') || s.scopes.length+s.revoked.length>=200)) return;
      s.choices = granted ? [...new Set([...(s.choices ?? []), owner])] : (s.choices ?? []).filter(v => v !== owner);
      if (!granted) {
        s.revoked.push(...s.scopes.filter(v => v.owner === owner));
        s.scopes = s.scopes.filter(v => v.owner !== owner);
        s.queue = s.queue.filter(v => v.scope.owner !== owner);
      }
    });
    if (granted) {
      stopped.delete(owner);
      await credential(owner, true, generation);
    }
  }
  async function credential(owner: string | null, explicit: boolean, generation = epoch): Promise<void> {
    if (credentialRunning) {
      // Readiness must wait for the current verification, not snapshot its
      // temporary blocked state. A join never issues a second automatic retry.
      await credentialFinished;
      if (explicit && generation === epoch) return credential(owner, explicit, generation);
      return;
    }
    const previous = await serial(s => s.scopes.find(v => v.owner === owner));
    if (!explicit && (!previous || !validCredential(previous))) {
      credentialBlocked.add(owner);
      d.scopesChanged?.((state?.scopes ?? []).filter(s => !stopped.has(s.owner) && !credentialBlocked.has(s.owner) && validCredential(s)));
      return;
    }
    if (!explicit && !credentialBlocked.has(owner) && Date.parse(previous!.expiresAt!) > d.now()+86400000) return;
    if (credentialRunning) {
      return credential(owner, explicit, generation);
    }
    const allowed = await serial(s => s.scopes.length+s.revoked.length<200 && !s.closed && !s.retired.includes(owner ?? '') && s.choices?.includes(owner));
    if (!allowed || stopped.has(owner) || generation !== epoch) return;
    if (credentialRunning) return credential(owner, explicit, generation);
    credentialRunning = true;
    let finishCredential!: () => void;
    credentialFinished = new Promise<void>(resolve => { finishCredential = resolve; });
    credentialBlocked.add(owner);
    d.scopesChanged?.((state?.scopes ?? []).filter(s => !stopped.has(s.owner) && !credentialBlocked.has(s.owner) && validCredential(s)));
    const controller = new AbortController(); active = controller;
    const timer = setTimeout(() => controller.abort(),8000);
    try {
      const next = await d.credential?.(owner, explicit ? null : previous!, controller.signal);
      if (!next || !validScope(next) || !validCredential(next) || next.owner !== owner) return;
      await serial(s => {
        if (controller.signal.aborted || generation !== epoch || stopped.has(owner) || !s.choices?.includes(owner) || s.retired.includes(owner ?? '')) {
          s.revoked.push(next); return;
        }
        if (explicit && previous && previous.consent !== next.consent) s.revoked.push(previous);
        s.scopes = [...s.scopes.filter(v => v.owner !== owner), next];
        credentialBlocked.delete(owner);
      });
    } catch { /* Consent choice survives, but failed renewal disables collection. */ }
    finally { clearTimeout(timer); credentialRunning=false; finishCredential(); if(active === controller) active=null; }
  }
  async function capture(event: string, properties: unknown, owner: string | null) {
    if (stopped.has(owner) || !permittedProperties(event, properties)) return;
    const timestamp = new Date(d.now()).toISOString(), id = d.random(), generation = epoch;
    await serial(s => {
      const scope = s.scopes.find(v => v.owner === owner);
      if (!scope || !validCredential(scope) || credentialBlocked.has(owner) || s.retired.includes(owner ?? '') || stopped.has(owner) || generation !== epoch) return;
      // Drop oldest optional events at capacity; never block a user action.
      s.queue.push({ scope: { ...scope }, event: { version: 1, id, timestamp, event: event as AnalyticsEventName, properties: { ...properties } }, attempts: 0, next: 0 });
      s.queue = s.queue.slice(-200);
    });
  }
  async function flush(owner?: string | null) {
    if (draining) return;
    draining = true;
    try {
      if(owner !== undefined) await credential(owner, false);
      // Bounded work per foreground/capture/reconnect opportunity; no polling.
      for (let n = 0; n < 10; n++) {
        const generation = epoch;
        const item = await serial(s => ({ revoke: s.revoked[0], pending: s.queue.find(p => p.next <= d.now() && !stopped.has(p.scope.owner) && !credentialBlocked.has(p.scope.owner) && s.scopes.some(scope => samescope([scope],p.scope) && validCredential(scope))
          && (p.scope.owner === null || p.scope.owner === owner)) }));
        if (generation !== epoch || (!item.revoke && !item.pending)) break;
        const controller = new AbortController(); active = controller;
        const timeout = setTimeout(() => controller.abort(), 8000);
        try {
          if (item.revoke) {
            if (!await d.withdraw(item.revoke, controller.signal)) break;
            await serial(s => { s.revoked = s.revoked.filter(v => v.consent !== item.revoke!.consent); });
          } else if (item.pending) {
            const p = item.pending;
            const result = await d.send(p.scope, p.event, controller.signal);
            if (generation !== epoch) break;
            await serial(s => {
              const current = s.queue.find(v => v.event.id === p.event.id);
              if (!current) return;
              if (result !== 'later') s.queue = s.queue.filter(v => v.event.id !== p.event.id);
              else { current.attempts++; current.next = d.now() + Math.min(3600000, 30000 * 2 ** current.attempts); }
            });
            if (result === 'later') break;
          }
        } catch {
          if (item.pending && generation === epoch) await serial(s => {
            const p = s.queue.find(v => v.event.id === item.pending!.event.id);
            if (p) { p.attempts++; p.next = d.now() + Math.min(3600000, 30000 * 2 ** p.attempts); }
          });
          break;
        } finally { clearTimeout(timeout); if (active === controller) active = null; }
      }
    } finally { draining = false; }
  }
  return { consent, capture, flush,
    reconcileCredential(owner: string | null) { return credential(owner, false); },
    consentStatus(owner: string | null) { return serial(s => {
      const granted = !stopped.has(owner) && !s.closed && s.choices?.includes(owner) === true;
      const scope = s.scopes.find(value => value.owner === owner);
      const credentialState = !scope ? 'missing' : !validCredential(scope) ? 'expired'
        : credentialBlocked.has(owner) ? 'unverified' : 'ready';
      // Safe debugger metadata only: no owner IDs, capabilities or storage values.
      return { granted, ready: granted && credentialState === 'ready', credentialState };
    }); },
    consentGranted(owner: string | null) { return serial(s => !stopped.has(owner) && !s.closed && s.choices?.includes(owner) === true); },
    changedAccount() { epoch++; active?.abort(); },
    async retire(owner: string) { await consent(owner, false); await serial(s => {
      if (!s.retired.includes(owner)) {
        if(s.retired.length<200) s.retired.push(owner);
        else s.closed=true; // Never evict an old deletion guard to grant new consent.
      }
    }); },
  };
}

function validScope(value: unknown): value is AnalyticsScope {
  if(!value || typeof value!=='object') return false;
  const s=value as AnalyticsScope;
  return (s.owner===null || (typeof s.owner==='string' && s.owner.length<=36)) && uuid(s.consent)
    && typeof s.secret==='string' && uuid(s.secret.slice(0,36)) && uuid(s.secret.slice(36));
}

function samescope(scopes: AnalyticsScope[], scope: AnalyticsScope | undefined) {
  return Boolean(scope && scopes.some(s => s && s.owner===scope.owner && s.consent===scope.consent && s.secret===scope.secret));
}
