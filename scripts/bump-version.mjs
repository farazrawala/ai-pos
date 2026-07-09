import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkgPath = resolve(root, 'package.json');
const versionPath = resolve(root, 'src/version.json');

const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
const current = String(pkg.version || '1.0.0').trim();
const parts = current.split('.').map((n) => Number.parseInt(n, 10) || 0);

while (parts.length < 3) parts.push(0);
parts[2] += 1;

const nextVersion = parts.join('.');
const builtAt = new Date().toISOString();

let previousBuild = 0;
try {
  const existing = JSON.parse(readFileSync(versionPath, 'utf8'));
  previousBuild = Number(existing.build) || 0;
} catch {
  previousBuild = 0;
}

const versionInfo = {
  version: nextVersion,
  build: previousBuild + 1,
  builtAt,
};

pkg.version = nextVersion;

writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
writeFileSync(versionPath, `${JSON.stringify(versionInfo, null, 2)}\n`);

console.log(`[version] bumped to v${nextVersion} (build ${versionInfo.build})`);
