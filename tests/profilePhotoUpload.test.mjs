import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const screen = await readFile(new URL('../screens/subscreens/ProfileScreen.tsx', import.meta.url), 'utf8');

test('profile photo source is capped at 20 MB and converted to compact JPEG before upload', () => {
  assert.match(screen, /MAX_SOURCE_PHOTO_SIZE\s*=\s*20\s*\*\s*1024\s*\*\s*1024/);
  assert.match(screen, /resize: \{ width: 800, height: 800 \}/);
  assert.match(screen, /format: ImageManipulator\.SaveFormat\.JPEG/);
  assert.match(screen, /MAX_FUNCTION_UPLOAD_SIZE\s*=\s*4\s*\*\s*1024\s*\*\s*1024/);
  assert.match(screen, /form\.append\('photo', imageBlob, 'profile\.jpg'\)/);
  assert.doesNotMatch(screen, /['"]Content-Type['"]\s*:/);
});

test('profile photo failures show distinct safe messages', () => {
  assert.match(screen, /unsupported_image_format/);
  assert.match(screen, /This photo is not a supported image/);
  assert.match(screen, /Upload is too large/);
  assert.match(screen, /Upload failed\. Check your connection/);
  assert.match(screen, /The server could not save your photo/);
});
