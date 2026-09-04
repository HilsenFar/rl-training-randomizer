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
import { trySign } from './tools/sign.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(HERE, 'dist');
const OUT = path.join(DIST, 'rl-training-randomizer');
const LAUNCHER_BIN = path.join(HERE, 'launcher', 'bin', 'Release');

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

// Build the tray launcher (the exe a user double-clicks — and the file that
// carries the release signature).
console.log('[build] building the launcher (dotnet build -c Release) ...');
execFileSync('dotnet', ['build', path.join(HERE, 'launcher', 'RLRoll.csproj'), '-c', 'Release', '-v', 'quiet', '-nologo'],
  { stdio: 'inherit' });
if (!fs.existsSync(path.join(LAUNCHER_BIN, 'RLRoll.exe'))) throw new Error('RLRoll.exe not found after build');

rmrf(OUT);
fs.mkdirSync(OUT, { recursive: true });

// Source folders that make up the tool.
for (const d of ['bin', 'lib', 'public', 'collections']) cpDir(path.join(HERE, d), path.join(OUT, d));

// Launchers + docs.
cp(path.join(LAUNCHER_BIN, 'RLRoll.exe'), path.join(OUT, 'RLRoll.exe'));
cp(path.join(HERE, 'launcher', 'icon.ico'), path.join(OUT, 'icon.ico'));
for (const f of ['start.cmd', 'roll.cmd', 'scrape.cmd', 'README.md', 'LICENSE', 'THIRD-PARTY-NOTICES.md']) {
  const s = path.join(HERE, f);
  if (!fs.existsSync(s)) continue;
  // Batch files ship with CRLF whatever the checkout used: cmd.exe misreads
  // LF-only lines with non-ASCII text on OEM code pages.
  if (f.endsWith('.cmd')) fs.writeFileSync(path.join(OUT, f), fs.readFileSync(s, 'utf8').replace(/\r?\n/g, '\r\n'));
  else cp(s, path.join(OUT, f));
}

// Bundle the Node runtime.
cp(process.execPath, path.join(OUT, 'node', 'node.exe'));

// Sign the shipped exe (no-op without the maintainer's signing.local.json).
await trySign([path.join(OUT, 'RLRoll.exe')]);

// Zip it.
const zip = path.join(DIST, 'rl-training-randomizer.zip');
rmrf(zip);
log('zipping ...');
// Not Compress-Archive: on Windows PowerShell 5.1 it writes entry names with
// backslashes, which unzip and macOS extract as flat files. ZipFile does the
// same unless its UseBackslash switch is turned off first.
execFileSync('powershell', ['-NoProfile', '-Command',
  "[AppContext]::SetSwitch('Switch.System.IO.Compression.ZipFile.UseBackslash', $false); " +
  'Add-Type -AssemblyName System.IO.Compression.FileSystem; ' +
  `[IO.Compression.ZipFile]::CreateFromDirectory('${OUT}', '${zip}')`], { stdio: 'inherit' });

const mb = (fs.statSync(zip).size / 1048576).toFixed(1);
log('done: ' + zip + ' (' + mb + ' MB)');
