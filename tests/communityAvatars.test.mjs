import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('community photos are circular while initials and anonymous fallbacks stay square', async () => {
  const avatar = await read('../components/community/CommunityAuthorAvatar.tsx');
  const photoStart = avatar.indexOf('if (showPhoto');
  const fallbackStart = avatar.indexOf('\n  return (', photoStart);
  const photoBranch = avatar.slice(photoStart, fallbackStart);
  const fallbackBranch = avatar.slice(fallbackStart);
  assert.match(photoBranch, /rounded-full/);
  assert.match(photoBranch, /onError=\{\(\) => setImageFailed\(true\)\}/);
  assert.doesNotMatch(fallbackBranch, /rounded-full/);
  assert.match(fallbackBranch, /anonymous \? 'A' : initials/);
  assert.match(avatar, /const showPhoto = !anonymous && Boolean\(avatarUrl\) && !imageFailed/);
});

test('feed, trending, posts, comments and nested replies use privacy-filtered author photos', async () => {
  const [avatarLoader, feed, postDetails, community] = await Promise.all([
    read('../lib/communityAuthorAvatars.ts'),
    read('../hooks/useCommunityFeed.ts'),
    read('../screens/subscreens/CommunityPostThreadScreen.tsx'),
    read('../screens/CommunityScreen.tsx'),
  ]);
  assert.match(avatarLoader, /p_post_ids: postIds, p_comment_ids: commentIds/);
  assert.match(feed, /avatar_url: row\.anonymous === true \? null : avatarUrls\.get\(String\(row\.id\)\)/);
  assert.match(postDetails, /avatar_url: row\.anonymous === true \? null : avatarUrls\.get\(String\(row\.id\)\)/);
  assert.match(postDetails, /avatar_url: anonymous \? null : avatarUrls\.get\(id\)/);
  assert.match(postDetails, /CommunityAuthorAvatar avatarUrl=\{comment\.avatar_url\}/);
  assert.match(community, /CommunityAuthorAvatar avatarUrl=\{post\.avatar_url\}/);
  assert.match(community, /anonymous: row\.anonymous === true/);
});
