import { copyFileSync, chmodSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const gitDir = resolve(root, '.git');
const hooksDir = resolve(gitDir, 'hooks');
const sourceHook = resolve(root, '.githooks', 'pre-commit');
const targetHook = resolve(hooksDir, 'pre-commit');

if (!existsSync(gitDir)) {
  console.log('[hooks] skipped — not a git repository');
  process.exit(0);
}

if (!existsSync(sourceHook)) {
  console.warn('[hooks] missing .githooks/pre-commit');
  process.exit(0);
}

mkdirSync(hooksDir, { recursive: true });
copyFileSync(sourceHook, targetHook);

try {
  chmodSync(targetHook, 0o755);
} catch {
  // Windows may not support chmod; git still runs the hook.
}

console.log('[hooks] installed pre-commit (auto version bump)');
