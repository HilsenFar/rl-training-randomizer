// catalog.mjs — load every collection under collections/ and merge them.
//
// A "collection" is one JSON file. You add your own by dropping a new file in
// the collections/ folder — no code changes. The format is documented in
// collections/README.md; the short version is:
//
//   { "name": "...", "source": { ... }, "packs": [ { "name", "code", ... } ] }
//
// This loader is deliberately forgiving: it accepts the handful of field names
// that different pack lists use in the wild (note/notes, likes as a rating,
// etc.), normalizes them to one shape, throws away anything without a usable
// training-pack code, and merges duplicates that appear in more than one file.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Rocket League training pack codes are four groups of four hex characters:
//   e.g. 2D89-9321-42D2-48BA
export const CODE_RE = /^[0-9A-F]{4}(?:-[0-9A-F]{4}){3}$/i;

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_DIR = path.join(HERE, '..', 'collections');

function str(v) { return v == null ? null : String(v).trim() || null; }
function num(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }

// Turn one raw pack entry (in whatever dialect its file used) into our shape.
function normalizePack(raw, collectionName, source) {
  if (!raw || typeof raw !== 'object') return null;
  const code = str(raw.code);
  if (!code || !CODE_RE.test(code)) return null;         // no code, no pack
  const name = str(raw.name) || str(raw.title) || 'Unnamed pack';

  let tags = Array.isArray(raw.tags) ? raw.tags.map(str).filter(Boolean) : [];

  return {
    name,
    code: code.toUpperCase(),
    creator: str(raw.creator) || str(raw.author) || null,
    category: str(raw.category) || null,
    difficulty: str(raw.difficulty) || null,
    rating: num(raw.rating),
    tags,
    notes: str(raw.notes) || str(raw.note) || str(raw.description) || null,
    collection: collectionName,
    source: source || null
  };
}

function loadFile(file) {
  let data;
  try { data = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { return { name: path.basename(file), packs: [], error: 'unreadable: ' + (e.message || e) }; }
  const collectionName = str(data.name) || path.basename(file).replace(/\.json$/i, '');
  const source = data.source || null;
  const rawPacks = Array.isArray(data.packs) ? data.packs : (Array.isArray(data) ? data : []);
  const packs = [];
  let skipped = 0;
  for (const r of rawPacks) {
    const p = normalizePack(r, collectionName, source);
    if (p) packs.push(p); else skipped++;
  }
  return { name: collectionName, file: path.basename(file), source, packs, skipped };
}

/**
 * Load and merge all collections.
 * @param {object} [opts]
 * @param {string} [opts.dir]  collections directory (default: ./collections)
 * @param {(m:string)=>void} [opts.warn]
 * @returns {{ packs: Array, collections: Array }}
 */
export function loadCatalog(opts = {}) {
  const dir = opts.dir || DEFAULT_DIR;
  const warn = opts.warn || (() => {});
  let files = [];
  try { files = fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith('.json')).sort(); }
  catch { warn('collections directory not found: ' + dir); }

  const collections = [];
  const byCode = new Map();

  for (const f of files) {
    const c = loadFile(path.join(dir, f));
    if (c.error) { warn(f + ': ' + c.error); continue; }
    if (c.skipped) warn(f + ': skipped ' + c.skipped + ' entr' + (c.skipped === 1 ? 'y' : 'ies') + ' with no valid code');
    collections.push({ name: c.name, file: c.file, count: c.packs.length, source: c.source });
    for (const p of c.packs) {
      const existing = byCode.get(p.code);
      if (existing) {
        // Same pack in two files: keep the first, but remember it lives in both
        // and merge any extra tags so filters still find it.
        if (!existing.collections.includes(p.collection)) existing.collections.push(p.collection);
        for (const t of p.tags) if (!existing.tags.includes(t)) existing.tags.push(t);
      } else {
        byCode.set(p.code, { ...p, collections: [p.collection] });
      }
    }
  }

  return { packs: [...byCode.values()], collections };
}
