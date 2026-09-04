#!/usr/bin/env node
// randomize.mjs — roll random Rocket League training packs from your collections.
//
// Examples:
//   node bin/randomize.mjs                     one random pack from everything
//   node bin/randomize.mjs --n 3               three random packs
//   node bin/randomize.mjs --category aerials  only aerial packs
//   node bin/randomize.mjs --difficulty gold --tag saves
//   node bin/randomize.mjs --list-collections
//   node bin/randomize.mjs --list-categories

import { loadCatalog } from '../lib/catalog.mjs';
import { filterPacks, pickRandom, rng } from '../lib/pick.mjs';

function parseArgs(argv) {
  const a = { n: 1, flags: new Set() };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const next = () => argv[++i];
    switch (k) {
      case '--n': case '-n': case '--count': a.n = Math.max(1, parseInt(next(), 10) || 1); break;
      case '--collection': case '-c': a.collection = next(); break;
      case '--category': a.category = next(); break;
      case '--difficulty': case '-d': a.difficulty = next(); break;
      case '--tag': case '-t': a.tag = next(); break;
      case '--creator': a.creator = next(); break;
      case '--search': case '-s': a.text = next(); break;
      case '--seed': a.seed = parseInt(next(), 10); break;
      case '--dir': a.dir = next(); break;
      case '--list-collections': a.flags.add('list-collections'); break;
      case '--list-categories': a.flags.add('list-categories'); break;
      case '--json': a.flags.add('json'); break;
      case '--help': case '-h': a.flags.add('help'); break;
      default: if (k.startsWith('-')) { console.error('unknown option: ' + k); process.exit(2); }
    }
  }
  return a;
}

const HELP = `rl-training-randomizer — roll random Rocket League training packs

Usage: node bin/randomize.mjs [options]

  -n, --count <n>        how many packs to roll (default 1)
  -c, --collection <s>   only from collections matching <s>
      --category <s>     only packs whose category matches <s>
  -d, --difficulty <s>   only packs whose difficulty matches <s>
  -t, --tag <s>          only packs with a tag matching <s>
      --creator <s>      only packs by a creator matching <s>
  -s, --search <s>       match name / notes / creator / tags
      --seed <n>         repeatable roll
      --dir <path>       collections directory (default ./collections)
      --json             print machine-readable JSON
      --list-collections list collections and how many packs each has
      --list-categories  list the categories present
  -h, --help             this help

Add your own packs by dropping a JSON file in the collections/ folder —
see collections/README.md for the format.`;

function fmtPack(p, i) {
  const bits = [];
  if (p.category) bits.push(p.category);
  if (p.difficulty) bits.push(p.difficulty);
  if (p.rating != null) bits.push('rated ' + p.rating);
  if (p.creator) bits.push('by ' + p.creator);
  const meta = bits.length ? '   (' + bits.join(' · ') + ')' : '';
  const from = (p.collections || [p.collection]).join(', ');
  let out = `\n  ${i}. ${p.name}${meta}\n     code:  ${p.code}\n     from:  ${from}`;
  if (p.notes) out += `\n     note:  ${p.notes.replace(/\s+/g, ' ').slice(0, 140)}`;
  return out;
}

function main() {
  const a = parseArgs(process.argv.slice(2));
  if (a.flags.has('help')) { console.log(HELP); return; }

  const { packs, collections } = loadCatalog({ dir: a.dir, warn: m => console.error('note: ' + m) });

  if (a.flags.has('list-collections')) {
    console.log('\nCollections (' + collections.length + '):');
    for (const c of collections) console.log('  ' + String(c.count).padStart(4) + '  ' + c.name + '   [' + c.file + ']');
    console.log('  ' + String(packs.length).padStart(4) + '  (unique packs after merge)\n');
    return;
  }
  if (a.flags.has('list-categories')) {
    const cats = {};
    for (const p of packs) if (p.category) cats[p.category] = (cats[p.category] || 0) + 1;
    console.log('\nCategories:');
    for (const [k, v] of Object.entries(cats).sort((x, y) => y[1] - x[1])) console.log('  ' + String(v).padStart(4) + '  ' + k);
    console.log('');
    return;
  }

  if (!packs.length) { console.error('No packs found. Add a collection JSON under collections/ (see collections/README.md).'); process.exit(1); }

  const pool = filterPacks(packs, a);
  if (!pool.length) { console.error('No packs match those filters. Loosen them, or check --list-categories / --list-collections.'); process.exit(1); }

  const chosen = pickRandom(pool, { count: a.n, random: rng(a.seed) });

  if (a.flags.has('json')) { console.log(JSON.stringify(chosen, null, 2)); return; }

  console.log(`\nRolled ${chosen.length} pack${chosen.length === 1 ? '' : 's'} from ${pool.length} matching (of ${packs.length} total):`);
  chosen.forEach((p, i) => console.log(fmtPack(p, i + 1)));
  console.log('\nIn Rocket League:  Training > Custom Training > Use Code  →  paste the code above.\n');
}

main();
