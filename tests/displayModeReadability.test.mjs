import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

// Brief 07 light/dark review: no text may disappear in either phone display mode.
// app.json pins iOS to the light interface style while every screen is dark (#0A0A0A),
// so native iOS pickers must be told to draw light text, or they render dark-on-dark.
const root = fileURLToPath(new URL('..', import.meta.url));
const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (/\.tsx?$/.test(name)) files.push(path);
  }
};
walk(join(root, 'screens'));
walk(join(root, 'components'));

test('app keeps one fixed interface style on a dark canvas', () => {
  const app = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8')).expo;
  assert.equal(app.userInterfaceStyle, 'light');
  assert.equal(app.backgroundColor, '#0A0A0A');
});

test('every native date/time picker draws with the dark variant', () => {
  const pickers = [];
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    // Lazy match to the self-closing end, so inline arrow functions (=>) inside props are included.
    for (const match of text.matchAll(/<DateTimePicker\b[\s\S]*?\/>/g)) pickers.push([file.slice(root.length), match[0]]);
  }
  assert.ok(pickers.length >= 3, `expected the activity, milestone and reminder pickers, found ${pickers.length}`);
  for (const [file, tag] of pickers) assert.match(tag, /themeVariant="dark"/, `${file} picker lacks themeVariant="dark"`);
});
