import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const root = new URL('../', import.meta.url);
const uiDirectories = ['components', 'contexts', 'hooks', 'screens'];
const bannedClientTerms = /\b(?:Supabase|OneSignal|SecureStore|native module|Expo Go|development build|production build|API route|database schema|environment variable|refresh token|stack trace)\b/i;
// TEMPORARY: remove with the TestFlight push diagnostics block.
const temporaryPushDiagnosticCopy = new Set(['Native module available']);

async function sourceFiles(directory) {
  const entries = await readdir(new URL(`${directory}/`, root), { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const relativePath = `${directory}/${entry.name}`;
    if (entry.isDirectory()) return sourceFiles(relativePath);
    return /\.tsx?$/.test(entry.name) ? [relativePath] : [];
  }));
  return nested.flat();
}

test('client-rendered strings contain no implementation or development details', async () => {
  const files = (await Promise.all(uiDirectories.map(sourceFiles))).flat();
  const violations = [];

  for (const relativePath of files) {
    const source = await readFile(new URL(relativePath, root), 'utf8');
    const sourceFile = ts.createSourceFile(
      relativePath,
      source,
      ts.ScriptTarget.Latest,
      true,
      relativePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );

    const visit = (node) => {
      const isModuleSpecifier = (
        node.parent
        && (ts.isImportDeclaration(node.parent) || ts.isExportDeclaration(node.parent))
        && node.parent.moduleSpecifier === node
      );
      if (
        !isModuleSpecifier
        && (ts.isStringLiteralLike(node) || ts.isJsxText(node))
        && bannedClientTerms.test(node.text)
        && !(
          relativePath === 'screens/subscreens/NotificationSettingsScreen.tsx'
          && temporaryPushDiagnosticCopy.has(node.text.trim())
        )
      ) {
        violations.push(`${relativePath}: ${node.text.trim()}`);
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }

  assert.deepEqual(violations, []);
});

test('mobile UI does not pass raw caught Error messages to client state', async () => {
  const files = (await Promise.all(uiDirectories.map(sourceFiles))).flat();
  const violations = [];

  for (const relativePath of files) {
    const source = await readFile(new URL(relativePath, root), 'utf8');
    if (/instanceof Error[\s\S]{0,100}\.message/.test(source)) violations.push(relativePath);
  }

  assert.deepEqual(violations, []);
});
