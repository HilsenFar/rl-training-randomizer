#!/usr/bin/env node
// serve.mjs — a tiny local web UI for rolling training packs.
//
//   node bin/serve.mjs            -> http://127.0.0.1:8343
//
// It serves the page in public/ and one JSON endpoint, /api/catalog, with every
// pack from your collections. All the rolling and filtering happens in the page,
// so there is no round-trip per roll. Localhost only; nothing leaves the machine.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCatalog } from '../lib/catalog.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(HERE, '..', 'public');
const PORT = Number(process.env.PORT) || 8343;

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.json': 'application/json' };

function catalog() {
  const { packs, collections } = loadCatalog({ warn: m => console.error('note: ' + m) });
  const categories = [...new Set(packs.map(p => p.category).filter(Boolean))].sort();
  const difficulties = [...new Set(packs.map(p => p.difficulty).filter(Boolean))];
  const tags = [...new Set(packs.flatMap(p => p.tags || []))].sort();
  return { packs, collections, categories, difficulties, tags };
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/catalog') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(catalog()));
    return;
  }
  let file = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\/+/, '');
  const full = path.join(PUBLIC, file);
  if (!full.startsWith(PUBLIC)) { res.writeHead(403); res.end(); return; }
  fs.readFile(full, (err, buf) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(full)] || 'application/octet-stream' });
    res.end(buf);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  const c = catalog();
  console.log('RL training randomizer — http://127.0.0.1:' + PORT);
  console.log(c.packs.length + ' packs across ' + c.collections.length + ' collection(s). Ctrl+C to stop.');
});
