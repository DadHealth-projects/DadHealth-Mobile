import { supabase } from './supabase';

export type CommunityAuthorContribution = {
  contribution_id: string;
  kind: 'post' | 'comment';
  anonymous: boolean;
};

export async function loadCommunityAuthorAvatars(contributions: readonly CommunityAuthorContribution[]) {
  const postIds = [...new Set(contributions.filter((item) => item.kind === 'post' && !item.anonymous).map((item) => item.contribution_id))];
  const commentIds = [...new Set(contributions.filter((item) => item.kind === 'comment' && !item.anonymous).map((item) => item.contribution_id))];

  if (postIds.length === 0 && commentIds.length === 0) return new Map<string, string>();

  const { data, error } = await supabase.rpc('get_community_author_avatars', { p_post_ids: postIds, p_comment_ids: commentIds });
  if (error || !Array.isArray(data)) return new Map<string, string>();

  const avatars = new Map<string, string>();
  for (const row of data as Array<{ user_id?: unknown; avatar_url?: unknown }>) {
    if (typeof row.contribution_id === 'string' && typeof row.avatar_url === 'string' && row.avatar_url.trim()) {
      avatars.set(row.contribution_id, row.avatar_url.trim());
    }
  }
  return avatars;
}
