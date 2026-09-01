#!/usr/bin/env node
// build-site.mjs — generate the in-browser roller for the website (docs/app/).
//
// GitHub Pages can't run the local server, but it doesn't need to: the
// collections are static JSON. This script bakes them into one catalog.json
// and copies the web UI next to it, with its one server call swapped for that
// file. Everything under docs/app/ is generated — edit public/ and
// collections/, then re-run:
//
//   node bin/build-site.mjs
//
// and commit the result. The hosted roller lives at /app/ on the site.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCatalog } from '../lib/catalog.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const OUT = path.join(ROOT, 'docs', 'app');

fs.mkdirSync(OUT, { recursive: true });

// 1. The catalog, same shape the local server serves at /api/catalog.
const { packs, collections } = loadCatalog({ warn: m => console.error('note: ' + m) });
const catalog = {
  packs,
  collections,
  categories: [...new Set(packs.map(p => p.category).filter(Boolean))].sort(),
  difficulties: [...new Set(packs.map(p => p.difficulty).filter(Boolean))],
  tags: [...new Set(packs.flatMap(p => p.tags || []))].sort()
};
fs.writeFileSync(path.join(OUT, 'catalog.json'), JSON.stringify(catalog));

// 2. The UI, verbatim — only the data URL changes.
fs.copyFileSync(path.join(ROOT, 'public', 'index.html'), path.join(OUT, 'index.html'));
const app = fs.readFileSync(path.join(ROOT, 'public', 'app.js'), 'utf8');
if (!app.includes("'/api/catalog'")) throw new Error("public/app.js no longer fetches '/api/catalog' — update this script");
fs.writeFileSync(path.join(OUT, 'app.js'), app.replace("'/api/catalog'", "'catalog.json'"));

console.log('docs/app: ' + packs.length + ' packs across ' + collections.length + ' collection(s)');
