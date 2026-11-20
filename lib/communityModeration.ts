import { createClient } from '@supabase/supabase-js';
import { supabase } from './supabase';
import {
  finishCommunityVisibilityChange,
  readCommunityVisibilityChange,
  rememberCommunityVisibilityChange,
  type CommunityVisibilityChange,
} from './offlineStorage';

export type ModerationTarget = { kind: 'post' | 'comment'; id: string };
export const reportReasons = [
  ['bullying', 'Bullying / harassment'], ['hate', 'Hate / discrimination'],
  ['harmful', 'Harmful / dangerous content'], ['spam', 'Spam / scam'], ['other', 'Something else'],
] as const;
export type CommunityVisibilityResult = {
  change: CommunityVisibilityChange;
  accepted: boolean;
};

const listeners = new Set<
  (owner: string, ready: boolean, result?: CommunityVisibilityResult) => void
>();
const revisions = new Map<string, number>();
export const communityRevision = (owner?: string) => owner ? revisions.get(owner) ?? 0 : 0;
export function subscribeCommunityModeration(
  listener: (
  owner: string,
  ready: boolean,
  result?: CommunityVisibilityResult,
) => void,
) {
  listeners.add(listener);

  void supabase.auth.getSession().then(({ data }) => {
    if (data.session && listeners.has(listener)) {
      void reconcileCommunityVisibility(data.session.user.id)
        .catch(() => undefined);
    }
  }).catch(() => undefined);

  return () => { listeners.delete(listener); };
}
async function ownerSession(owner: string) {
  const { data, error } = await supabase.auth.getSession();
  if (error || data.session?.user.id !== owner || !data.session.access_token) throw Error('Sign in to continue.');
  const token = data.session.access_token;
  return createClient(process.env.EXPO_PUBLIC_SUPABASE_URL!, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!, { accessToken: async () => token, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
const running = new Map<string, Promise<boolean>>();
const retryTimers = new Map<string, ReturnType<typeof setTimeout>>();

function invalidateViews(
  owner: string,
  ready: boolean,
  result?: CommunityVisibilityResult,
) {
  if (!ready) revisions.set(owner, communityRevision(owner) + 1);
  listeners.forEach(listener => listener(owner, ready, result));
}

function retryVisibility(owner: string) {
  if (retryTimers.has(owner) || !listeners.size) return;

  const timer = setTimeout(() => {
    retryTimers.delete(owner);

    void supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user.id === owner && listeners.size) {
        void reconcileCommunityVisibility(owner).catch(() => undefined);
      }
    }).catch(() => retryVisibility(owner));
  }, 5000);

  retryTimers.set(owner, timer);
}

function reconcileVisibility(owner: string): Promise<boolean> {
  const active = running.get(owner);
  if (active) return active;

  const work = (async () => {
    const change = await readCommunityVisibilityChange(owner);
    if (!change) return true;

    const client = await ownerSession(owner);
    invalidateViews(owner, false);

    const block = change.kind === 'block';
    const result = await client.rpc(
      block ? 'block_community_author' : 'unblock_community_author',
      change.kind === 'block'
        ? { p_kind: change.target.kind, p_id: change.target.id }
        : { p_block_id: change.id },
    ).abortSignal(AbortSignal.timeout(15000));

    const accepted =
      !result.error &&
      result.data?.state === (block ? 'blocked' : 'unblocked') &&
      (!block || typeof result.data.id === 'string');

    // Explicit SQL rejection settles this attempt. Transport failures,
    // expired sessions and malformed responses remain recoverable.
    const rejected =
      result.error &&
      ['22023', '42501', '23503'].includes(result.error.code);

    if (!accepted && !rejected) {
      throw Error('community_change_unconfirmed');
    }

    // Never settle account A's recovery while account B is signed in.
    await ownerSession(owner);
    await finishCommunityVisibilityChange(owner, change);

    invalidateViews(owner, false);
invalidateViews(owner, true, { change, accepted });
return accepted;
  })();

  const tracked: Promise<boolean> = work.catch(error => {
    retryVisibility(owner);
    throw error;
  }).finally(() => {
    if (running.get(owner) === tracked) running.delete(owner);
  });

  running.set(owner, tracked);
  return tracked;
}

export async function reconcileCommunityVisibility(owner?: string) {
  if (owner) await reconcileVisibility(owner);
}

async function changeVisibility(
  owner: string,
  change: CommunityVisibilityChange,
) {
  await ownerSession(owner);

  try {
    await rememberCommunityVisibilityChange(owner, change);
    invalidateViews(owner, false);

    if (!await reconcileVisibility(owner)) {
      throw Error('community_change_rejected');
    }
  } catch {
    retryVisibility(owner);
    throw Error(
      'We couldn’t confirm this change yet. It will be checked automatically.',
    );
  }
}
export async function reportCommunity(owner: string, target: ModerationTarget, reason: string, explanation: string) {
  if (!reportReasons.some(([key]) => key === reason) || [...explanation].length > 1000) throw Error('Check your report details.');
  const client = await ownerSession(owner);
  const { data, error } = await client.rpc('submit_community_report', { p_kind: target.kind, p_id: target.id, p_reason: reason, p_explanation: explanation });
  if (error) throw Error(error.code === 'P0001' ? 'You’ve reached the report limit. You can submit another report later.' : 'We couldn’t confirm your report. Your explanation is still here.');
  if (data?.state !== 'received' || typeof data.id !== 'string') throw Error('We couldn’t confirm your report.');
  return data.id as string;
}
export async function blockCommunity(
  owner: string,
  target: ModerationTarget,
) {
  await changeVisibility(owner, { kind: 'block', target });
}
export type BlockedAccount = { id: string; label: string; createdAt: string };
export async function readCommunityBlocks(owner: string): Promise<BlockedAccount[]> {
  const client = await ownerSession(owner);
  const { data, error } = await client.rpc('list_community_blocks');
  if (error || !Array.isArray(data) || data.some(row => typeof row.id !== 'string' || row.label !== 'Blocked dad' || typeof row.createdAt !== 'string')) throw Error('We couldn’t load your blocked accounts.');
  return data.map(row => ({ id: row.id, label: 'Blocked dad', createdAt: row.createdAt }));
}
export async function unblockCommunity(owner: string, id: string) {
  await changeVisibility(owner, { kind: 'unblock', id });
}
