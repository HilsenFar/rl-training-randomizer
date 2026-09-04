#!/usr/bin/env node
// scrape.mjs — build a collection from Prejump's public training-pack database.
//
//   node bin/scrape.mjs                     -> collections/prejump.json (all packs)
//   node bin/scrape.mjs --max-pages 5       -> just the first few pages (a sample)
//   node bin/scrape.mjs --sort newest       -> most_popular (default) | newest | likes
//   node bin/scrape.mjs --out collections/my.json
//
// Prejump (https://prejump.com/training-packs) is an Inertia.js/Laravel site. It
// serves the same page as JSON when you send the `X-Inertia` headers, paginated
// 10 packs at a time. This scraper:
//   1. reads the current Inertia asset-version from the page HTML,
//   2. walks the pages asking for JSON,
//   3. re-reads the version if the server says it changed mid-run (409), and
//      retries timeouts, 429s and 5xxs a few times with a backoff,
//   4. writes the packs out in this project's collection format.
//
// It is polite: one request at a time with a short delay. Codes on Prejump are
// public and meant to be pasted into the game — this just collects them.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const BASE = 'https://prejump.com';
const UA = 'rl-training-randomizer scraper (github.com/HilsenFar/rl-training-randomizer)';
const SORTS = { most_popular: 'most_popular', popular: 'most_popular', newest: 'newest', new: 'newest', likes: 'most_liked', most_liked: 'most_liked' };

function args(argv) {
  const a = { sort: 'most_popular', delay: 250, maxPages: Infinity };
  for (let i = 0; i < argv.length; i++) {
    const next = () => argv[++i];
    switch (argv[i]) {
      case '--out': case '-o': a.out = next(); break;
      case '--sort': case '-s': { const s = String(next()).toLowerCase(); a.sort = SORTS[s]; if (!a.sort) { console.error('unknown --sort ' + s + ', using most_popular'); a.sort = 'most_popular'; } break; }
      case '--max-pages': a.maxPages = Math.max(1, parseInt(next(), 10) || 1); break;
      case '--delay': a.delay = Math.max(0, parseInt(next(), 10) || 0); break;
      case '--help': case '-h': a.help = true; break;
    }
  }
  return a;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// One request with a 20 s timeout. Network errors and timeouts are marked
// retryable so the page loop can back off and try again.
async function get(url, headers) {
  try { return await fetch(url, { headers, signal: AbortSignal.timeout(20000) }); }
  catch (e) { const err = new Error(e.name === 'TimeoutError' ? 'timed out after 20 s' : 'network error: ' + (e.message || e)); err.retry = true; throw err; }
}

function decodeEntities(s) {
  return s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

// Read the Inertia asset version out of the initial HTML page.
async function readVersion(sort) {
  const r = await get(`${BASE}/training-packs?sort=${sort}`, { 'User-Agent': UA });
  if (!r.ok) throw new Error('could not load the page HTML (HTTP ' + r.status + ')');
  const html = await r.text();
  const m = html.match(/id="app"[^>]*data-page="([^"]*)"/) || html.match(/data-page="([^"]*)"/);
  if (!m) throw new Error('could not find the Inertia data on the page (the site may have changed)');
  const page = JSON.parse(decodeEntities(m[1]));
  if (!page.version) throw new Error('no Inertia version in the page data');
  return page.version;
}

// Fetch one page of packs as JSON. Returns { packs, lastPage }; throws with
// .stale on a 409 and .retry on errors worth another attempt.
async function fetchPage(sort, page, version) {
  const r = await get(`${BASE}/training-packs?sort=${sort}&page=${page}`,
    { 'User-Agent': UA, 'X-Inertia': 'true', 'X-Inertia-Version': version, Accept: 'application/json' });
  if (r.status === 409) { const e = new Error('inertia version changed'); e.stale = true; throw e; }
  if (r.status === 429 || r.status >= 500) {          // rate limit or server trouble: worth a retry
    const e = new Error('HTTP ' + r.status + ' on page ' + page); e.retry = true;
    const after = Number(r.headers.get('retry-after')); if (after > 0) e.retryAfter = Math.min(after, 60) * 1000;
    throw e;
  }
  if (!r.ok) throw new Error('HTTP ' + r.status + ' on page ' + page);
  const j = await r.json();
  const p = j && j.props && j.props.packs;
  if (!p || !Array.isArray(p.data)) throw new Error('unexpected JSON shape on page ' + page);
  const lastPage = (p.meta && p.meta.last_page) || page;
  return { packs: p.data, lastPage };
}

function toPack(raw) {
  return {
    name: raw.name,
    code: raw.code,
    creator: raw.creator || raw.displayName || null,
    difficulty: raw.difficulty || null,
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    notes: (raw.notes || '').trim() || null,
    likes: Number(raw.likes) || 0,
    plays: Number(raw.plays) || 0,
    shotCount: Number(raw.shotCount) || null
  };
}

async function main() {
  const a = args(process.argv.slice(2));
  if (a.help) {
    console.log('node bin/scrape.mjs [--out <file>] [--sort most_popular|newest|likes] [--max-pages <n>] [--delay <ms>]');
    return;
  }
  const out = a.out ? path.resolve(a.out) : path.join(ROOT, 'collections', 'prejump.json');

  console.error('reading Prejump asset version ...');
  let version = await readVersion(a.sort);

  const packs = [];
  const seen = new Set();
  let page = 1, lastPage = 1, refreshed = false, attempt = 0;

  try {
    while (page <= lastPage && page <= a.maxPages) {
      let res;
      try {
        res = await fetchPage(a.sort, page, version);
      } catch (e) {
        if (e.stale && !refreshed) {           // version rolled over mid-scrape: refresh and retry this page
          console.error('  version changed — refreshing and retrying page ' + page);
          version = await readVersion(a.sort);
          refreshed = true;
          continue;
        }
        if (e.retry && attempt < 3) {          // timeout, network error, 429 or 5xx: back off and retry
          const wait = e.retryAfter || 1000 * 2 ** attempt;
          attempt++;
          console.error('\n  ' + e.message + ', retry ' + attempt + '/3 in ' + Math.round(wait / 1000) + ' s');
          await sleep(wait);
          continue;
        }
        throw e;
      }
      refreshed = false; attempt = 0;          // a good page resets both allowances
      lastPage = res.lastPage;
      for (const raw of res.packs) {
        if (!raw || !raw.code || seen.has(raw.code)) continue;
        seen.add(raw.code);
        packs.push(toPack(raw));
      }
      const cap = Math.min(lastPage, a.maxPages);
      process.stderr.write(`\r  page ${page}/${cap}  (${packs.length} packs)   `);
      page++;
      if (page <= lastPage && page <= a.maxPages) await sleep(a.delay);
    }
  } catch (e) {
    // Keep what was fetched, but never as the real collection file: a partial
    // list must not replace the complete one that ships with the tool.
    if (packs.length) {
      const partial = out.replace(/\.json$/i, '') + '.partial.json';
      fs.mkdirSync(path.dirname(partial), { recursive: true });
      fs.writeFileSync(partial, JSON.stringify(collectionOf(packs), null, 1));
      console.error('\n  kept the ' + packs.length + ' packs fetched so far in ' + partial + ' (' + path.basename(out) + ' was not touched)');
    }
    throw e;
  }
  process.stderr.write('\n');

  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(collectionOf(packs), null, 1));
  console.error('wrote ' + packs.length + ' packs -> ' + out);
}

function collectionOf(packs) {
  return {
    name: 'Prejump training packs',
    source: {
      title: 'Prejump Training Pack Database',
      url: 'https://prejump.com/training-packs',
      fetched: new Date().toISOString().slice(0, 10),
      note: 'Public database scraped with bin/scrape.mjs. difficulty/tags/likes/plays are Prejump\'s own data.'
    },
    count: packs.length,
    packs
  };
}

main().catch(e => { console.error('\nscrape failed: ' + (e.message || e)); process.exit(1); });
