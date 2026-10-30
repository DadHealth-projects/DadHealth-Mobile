import { supabase } from './supabase';

const likeMutationLocks = new Set<string>();

export async function toggleCommunityPostLike(userId: string, postId: string, liked: boolean): Promise<string | null> {
  const key = `${userId}:${postId}`;
  if (likeMutationLocks.has(key)) return null;
  likeMutationLocks.add(key);
  try {
    const result = liked
      ? await supabase.from('likes').delete().eq('user_id', userId).eq('post_id', postId).select('post_id')
      : await supabase.from('likes').upsert({ user_id: userId, post_id: postId }, { onConflict: 'user_id,post_id', ignoreDuplicates: true }).select('post_id');
    return result.error ? 'We could not update this like.' : null;
  } catch {
    return 'We could not update this like. Please try again.';
  } finally {
    likeMutationLocks.delete(key);
  }
}

export async function toggleCommunityPostSave(userId: string, postId: string, saved: boolean): Promise<string | null> {
  try {
    const result = saved
      ? await supabase.from('saved_posts').delete().eq('user_id', userId).eq('post_id', postId)
      : await supabase.from('saved_posts').insert({ user_id: userId, post_id: postId });
    return result.error ? 'We could not update this saved post.' : null;
  } catch {
    return 'We could not update this saved post. Please try again.';
  }
}

export async function deleteCommunityPost(userId: string, postId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc('delete_own_community_post', { p_post_id: postId });
    return error || data !== true ? 'We could not delete this post.' : null;
  } catch {
    return 'We could not delete this post. Please try again.';
  }
}
