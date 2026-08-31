// build.mjs — assemble a ready-to-run release of the randomizer.
//
// Output: dist/rl-training-randomizer/ (unzip and double-click start.cmd)
//     and dist/rl-training-randomizer.zip (the release asset).
//
// The zip bundles a copy of node.exe so it runs with nothing installed.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(HERE, 'dist');
const OUT = path.join(DIST, 'rl-training-randomizer');

const log = (...a) => console.log('[build]', ...a);
function rmrf(p) { fs.rmSync(p, { recursive: true, force: true }); }
function cp(from, to) { fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(from, to); }
function cpDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const s = path.join(from, e.name), d = path.join(to, e.name);
    if (e.isDirectory()) cpDir(s, d); else cp(s, d);
  }
}

rmrf(OUT);
fs.mkdirSync(OUT, { recursive: true });

// Source folders that make up the tool.
for (const d of ['bin', 'lib', 'public', 'collections']) cpDir(path.join(HERE, d), path.join(OUT, d));

// Launchers + docs.
for (const f of ['start.cmd', 'roll.cmd', 'scrape.cmd', 'README.md', 'LICENSE', 'THIRD-PARTY-NOTICES.md']) {
  const s = path.join(HERE, f);
  if (fs.existsSync(s)) cp(s, path.join(OUT, f));
}

// Bundle the Node runtime.
cp(process.execPath, path.join(OUT, 'node', 'node.exe'));

// Zip it.
const zip = path.join(DIST, 'rl-training-randomizer.zip');
rmrf(zip);
log('zipping ...');
execFileSync('powershell', ['-NoProfile', '-Command',
  `Compress-Archive -Path '${OUT}\\*' -DestinationPath '${zip}' -Force`], { stdio: 'inherit' });

const mb = (fs.statSync(zip).size / 1048576).toFixed(1);
log('done: ' + zip + ' (' + mb + ' MB)');
