import { supabase } from './supabase';

export type PlanAction = { id: string; title: string; instruction: string; route: 'Journal' | 'BreathingSession' };
export type PlanCompletion = { actionNumber: number; completedOn: string; completedAt: string; timezone: string };
export type AvailablePlan = { state: 'available'; currentDate: string; timezone: string; receipt: PlanCompletion | null;
  plan: { id: string; version: 'mind-plan-v1'; copyStatus: 'draft'; variant: string; createdAt: string;
    startedOn: string; actions: PlanAction[]; completions: PlanCompletion[]; completed: boolean;
    nextAction: number | null; canComplete: boolean } };
export type MindPlanResult = AvailablePlan | { state: 'locked' | 'not_started' | 'unavailable' | 'unauthorized' }
  | { state: 'conflict'; reason: 'plan_mismatch' | 'action_out_of_order' | 'daily_limit' };
export type PlanOperation = { kind: 'start' } | { kind: 'complete'; planId: string; actionNumber: number };
const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
  && Number.isFinite(Date.parse(v + 'T00:00:00Z')) && new Date(v + 'T00:00:00Z').toISOString().slice(0, 10) === v;
const isInstant = (v: unknown) => typeof v === 'string' && Number.isFinite(Date.parse(v));
const isId = (v: unknown) => typeof v === 'string' && /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(v);
const text = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
function completion(v: any): PlanCompletion {
  if (!v || !Number.isInteger(v.actionNumber) || v.actionNumber < 1 || v.actionNumber > 7
    || !isDate(v.completedOn) || !isInstant(v.completedAt) || !text(v.timezone)) throw Error('Invalid plan');
  return { actionNumber: v.actionNumber, completedOn: v.completedOn, completedAt: v.completedAt, timezone: v.timezone };
}
/** Allowlist the Batch 2 response; never retain unexpected restricted fields. */
export function parseMindPlan(v: any): MindPlanResult {
  if (['locked', 'not_started', 'unavailable', 'unauthorized'].includes(v?.state)) return { state: v.state };
  if (v?.state === 'conflict' && ['plan_mismatch', 'action_out_of_order', 'daily_limit'].includes(v.reason)) {
    return { state: 'conflict', reason: v.reason };
  }
  const p = v?.plan;
  if (v?.state !== 'available' || !isDate(v.currentDate) || !text(v.timezone) || !p || !isId(p.id)
    || p.version !== 'mind-plan-v1' || p.copyStatus !== 'draft' || !['balanced', 'gentle', 'presence'].includes(p.variant)
    || !isInstant(p.createdAt) || !isDate(p.startedOn) || !Array.isArray(p.actions) || p.actions.length !== 7
    || !Array.isArray(p.completions) || p.completions.length > 7) throw Error('Invalid plan');
  const actions: PlanAction[] = p.actions.map((a: any) => {
    if (!a || !text(a.id) || !text(a.title) || !text(a.instruction) || !['Journal', 'BreathingSession'].includes(a.route)) throw Error('Invalid action');
    return { id: a.id, title: a.title, instruction: a.instruction, route: a.route };
  });
  if (new Set(actions.map(a => a.id)).size !== 7) throw Error('Invalid actions');
  const completions: PlanCompletion[] = p.completions.map(completion);
  if (completions.some((c, i) => c.actionNumber !== i + 1 || (i > 0 && c.completedOn <= completions[i - 1].completedOn))
    || p.completed !== (completions.length === 7) || p.nextAction !== (p.completed ? null : completions.length + 1)
    || p.canComplete !== (!p.completed && (!completions.length || v.currentDate > completions[completions.length - 1].completedOn))) throw Error('Invalid progression');
  const receipt = v.receipt == null ? null : completion(v.receipt);
  if (receipt && !completions.some(c => JSON.stringify(c) === JSON.stringify(receipt))) throw Error('Invalid receipt');
  return { state: 'available', currentDate: v.currentDate, timezone: v.timezone, receipt,
    plan: { id: p.id, version: p.version, copyStatus: p.copyStatus, variant: p.variant, createdAt: p.createdAt,
      startedOn: p.startedOn, actions, completions, completed: p.completed, nextAction: p.nextAction, canComplete: p.canComplete } };
}

export async function requestMindPlan(owner: string, operation: PlanOperation | null, signal: AbortSignal): Promise<MindPlanResult> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener('abort', abort);
  if (signal.aborted) abort();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async () => {
        const { data, error } = await supabase.auth.getSession();
        if (error || data.session?.user.id !== owner || controller.signal.aborted) throw Error('Account changed');
        const base = (process.env.EXPO_PUBLIC_WEB_URL ?? 'https://www.dadhealth.co.uk').replace(/\/$/, '');
        const response = await fetch(`${base}/api/mind/plan${operation ? '/' + operation.kind : ''}`, {
          method: operation ? 'POST' : 'GET', signal: controller.signal,
          headers: { Authorization: `Bearer ${data.session.access_token}`, ...(operation ? { 'Content-Type': 'application/json' } : {}) },
          ...(operation ? { body: JSON.stringify(operation.kind === 'start' ? {} : { planId: operation.planId, actionNumber: operation.actionNumber }) } : {}),
        });
        const result = parseMindPlan(await response.json());
        const expected = result.state === 'locked' ? 403 : result.state === 'unavailable' ? 503
          : result.state === 'unauthorized' ? 401 : result.state === 'conflict' ? 409 : 200;
        if (response.status !== expected || controller.signal.aborted) throw Error('Plan unavailable');
        return result;
      })(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => { abort(); reject(Error('Plan unavailable')); }, 15000); }),
    ]);
  } finally { clearTimeout(timer); signal.removeEventListener('abort', abort); }
}

export type PlanView = { result: MindPlanResult | null; loading: boolean; busy: boolean; verified: boolean;
  uncertain: PlanOperation | null; canRetryOperation: boolean; error: string | null };
export const PLAN_UNAVAILABLE = 'Your plan is temporarily unavailable.';
export const PLAN_UNCERTAIN = 'We couldn’t confirm your progress yet.';
export function operationSaved(result: MindPlanResult, operation: PlanOperation) {
  return result.state === 'available' && (operation.kind === 'start' || (result.plan.id === operation.planId
    && result.plan.completions.some(c => c.actionNumber === operation.actionNumber)));
}
/** Component-owned state machine. A mutation supersedes reads, never the reverse. */
export function createMindPlanController(owner: string, request: typeof requestMindPlan, emit: (view: PlanView) => void) {
  let view: PlanView = { result: null, loading: false, busy: false, verified: false, uncertain: null, canRetryOperation: false, error: null };
  let epoch = 0, disposed = false, offline = false;
  let active: AbortController | null = null;
  const publish = (patch: Partial<PlanView>) => { view = { ...view, ...patch }; if (!disposed) emit(view); };
  const invalidate = () => {
    ++epoch; active?.abort(); active = null;
    publish({ result: null, loading: false, busy: false, verified: false, canRetryOperation: false,
      error: view.uncertain ? PLAN_UNCERTAIN : null });
  };
  async function refresh() {
    if (disposed || view.busy || offline) return;
    const version = ++epoch; active?.abort(); const controller = new AbortController(); active = controller;
    const valid = () => !disposed && version === epoch;
    publish({ loading: true });
    try {
      const result = await request(owner, null, controller.signal);
      if (!valid()) return;
      if (result.state === 'unavailable' || result.state === 'unauthorized' || result.state === 'conflict') throw Error('Unavailable');
      const pending = view.uncertain;
      const saved = pending && operationSaved(result, pending);
      // A negative read allows only an explicit retry of the SAME idempotent operation.
      const absent = pending && (pending.kind === 'start' ? result.state === 'not_started'
        : result.state === 'available' && result.plan.id === pending.planId && result.plan.nextAction === pending.actionNumber && result.plan.canComplete);
      publish({ result, loading: false, verified: result.state !== 'locked', uncertain: saved ? null : pending,
        canRetryOperation: Boolean(absent), error: pending && !saved ? PLAN_UNCERTAIN : null });
    } catch {
      if (valid()) publish({ result: null, loading: false, verified: false, canRetryOperation: false,
        error: view.uncertain ? PLAN_UNCERTAIN : PLAN_UNAVAILABLE });
    }
  }
  async function mutate(operation: PlanOperation) {
    if (disposed || offline || view.busy || !view.verified) return;
    if (view.uncertain && (!view.canRetryOperation || JSON.stringify(operation) !== JSON.stringify(view.uncertain))) return;
    const result = view.result;
    if (operation.kind === 'start' ? result?.state !== 'not_started' : result?.state !== 'available'
      || result.plan.id !== operation.planId || result.plan.nextAction !== operation.actionNumber || !result.plan.canComplete) return;
    const version = ++epoch; active?.abort(); const controller = new AbortController(); active = controller;
    const valid = () => !disposed && version === epoch;
    publish({ busy: true, loading: false, uncertain: operation, canRetryOperation: false, error: null });
    try {
      const next = await request(owner, operation, controller.signal);
      if (!valid()) return;
      if (operationSaved(next, operation)) {
        publish({ result: next, busy: false, verified: true, uncertain: null, error: null }); return;
      }
      if (next.state === 'locked') {
        publish({ result: next, busy: false, verified: false, error: null }); return;
      }
      if (next.state === 'conflict') publish({ uncertain: null });
    } catch { /* A transport failure does not establish whether the write committed. */ }
    if (!valid()) return;
    publish({ busy: false, error: view.uncertain ? PLAN_UNCERTAIN : null });
    await refresh();
  }
  return { refresh, mutate, invalidate, get: () => view,
    setOffline(value: boolean) { offline = value; if (value) invalidate(); },
    dispose() { disposed = true; ++epoch; active?.abort(); },
  };
}

export type PlanDestination = { owner: string; planId: string; actionNumber: number; action: PlanAction };
export function planDestination(owner: string, result: MindPlanResult | null, actionNumber: number): PlanDestination | null {
  if (result?.state !== 'available' || !Number.isInteger(actionNumber) || actionNumber < 1 || actionNumber > 7) return null;
  if (actionNumber > result.plan.completions.length && !(actionNumber === result.plan.nextAction && result.plan.canComplete)) return null;
  return { owner, planId: result.plan.id, actionNumber, action: result.plan.actions[actionNumber - 1] };
}
export function validPlanDestination(target: PlanDestination, owner: string | undefined, result: MindPlanResult | null) {
  const current = owner ? planDestination(owner, result, target.actionNumber) : null;
  return current && target.owner === owner && target.planId === current.planId && JSON.stringify(target.action) === JSON.stringify(current.action);
}
