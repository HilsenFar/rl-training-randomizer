// Tests for the catalog loader and the picker. No network needed.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadCatalog, sortDifficulties, CODE_RE, DEFAULT_DIR } from '../lib/catalog.mjs';
import { filterPacks, pickRandom, rng } from '../lib/pick.mjs';

function tmpDir(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rltr-'));
  for (const [name, obj] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), JSON.stringify(obj));
  return dir;
}

test('CODE_RE accepts real codes and rejects junk', () => {
  assert.ok(CODE_RE.test('2D89-9321-42D2-48BA'));
  assert.ok(CODE_RE.test('f43a-8231-0b8f-b9fa'));
  assert.ok(!CODE_RE.test('2D89-9321-42D2'));
  assert.ok(!CODE_RE.test('not-a-code'));
});

test('loader normalizes fields and skips codeless entries', () => {
  const dir = tmpDir({
    'a.json': {
      name: 'A', packs: [
        { name: 'Good', code: '2d89-9321-42d2-48ba', note: 'hi', author: 'Bob' },
        { name: 'No code' },
        { title: 'Aliased', code: 'F43A-8231-0B8F-B9FA', description: 'via title/description' }
      ]
    }
  });
  const { packs, collections } = loadCatalog({ dir });
  assert.equal(collections.length, 1);
  assert.equal(packs.length, 2);
  const good = packs.find(p => p.code === '2D89-9321-42D2-48BA');
  assert.equal(good.notes, 'hi');
  assert.equal(good.creator, 'Bob');
  assert.equal(good.collection, 'A');
  const aliased = packs.find(p => p.name === 'Aliased');
  assert.equal(aliased.notes, 'via title/description');
});

test('loader merges the same code across collections', () => {
  const dir = tmpDir({
    'a.json': { name: 'A', packs: [{ name: 'Shared', code: 'AAAA-BBBB-CCCC-DDDD', tags: ['x'] }] },
    'b.json': { name: 'B', packs: [{ name: 'Shared', code: 'AAAA-BBBB-CCCC-DDDD', tags: ['y'] }] }
  });
  const { packs } = loadCatalog({ dir });
  assert.equal(packs.length, 1);
  assert.deepEqual(packs[0].collections.sort(), ['A', 'B']);
  assert.deepEqual(packs[0].tags.sort(), ['x', 'y']);
});

test('loader fills empty fields from a later file with the same code', () => {
  const dir = tmpDir({
    'a.json': { name: 'A', packs: [{ name: 'Shadow Defense', code: '5CCE-FB29-7B05-A0B1', difficulty: 'Gold' }] },
    'b.json': { name: 'B', packs: [{ name: 'Shadow Defense (rated)', code: '5CCE-FB29-7B05-A0B1', rating: 20, category: 'DEFENCE', difficulty: 'Platinum' }] }
  });
  const { packs } = loadCatalog({ dir });
  assert.equal(packs.length, 1);
  assert.equal(packs[0].name, 'Shadow Defense');      // the first file wins for fields it has
  assert.equal(packs[0].difficulty, 'Gold');
  assert.equal(packs[0].rating, 20);                   // empty fields come from the second
  assert.equal(packs[0].category, 'DEFENCE');
  assert.equal(filterPacks(packs, { category: 'defence' }).length, 1);
});

test('loader treats null and empty ratings as unrated', () => {
  const dir = tmpDir({
    'a.json': { name: 'A', packs: [
      { name: 'Null', code: 'AAAA-BBBB-CCCC-0001', rating: null },
      { name: 'Empty', code: 'AAAA-BBBB-CCCC-0002', rating: '' },
      { name: 'Zero', code: 'AAAA-BBBB-CCCC-0003', rating: 0 }
    ] }
  });
  const { packs } = loadCatalog({ dir });
  assert.equal(packs.find(p => p.name === 'Null').rating, null);
  assert.equal(packs.find(p => p.name === 'Empty').rating, null);
  assert.equal(packs.find(p => p.name === 'Zero').rating, 0);
});

test('sortDifficulties follows the rank ladder and puts unknown names last', () => {
  assert.deepEqual(
    sortDifficulties(['Grand Champion', 'Gold', 'Supersonic Legend', 'Diamond', 'Platinum', 'Champion', 'Bronze', 'Silver']),
    ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Champion', 'Grand Champion', 'Supersonic Legend']);
  assert.deepEqual(sortDifficulties(['Zeta', 'gold', 'Alpha']), ['gold', 'Alpha', 'Zeta']);
});

test('filterPacks matches case-insensitive substrings', () => {
  const packs = [
    { name: 'One', code: 'A', category: 'AERIALS', difficulty: 'Gold', tags: ['Saves'], rating: 48, collection: 'c', collections: ['c'] },
    { name: 'Two', code: 'B', category: 'DEFENCE', difficulty: 'Silver', tags: [], rating: 20, collection: 'c', collections: ['c'] }
  ];
  assert.equal(filterPacks(packs, { category: 'aerial' }).length, 1);
  assert.equal(filterPacks(packs, { tag: 'save' }).length, 1);
  assert.equal(filterPacks(packs, { difficulty: 'gold' })[0].name, 'One');
});

test('pickRandom returns distinct packs and respects count', () => {
  const packs = Array.from({ length: 5 }, (_, i) => ({ name: 'p' + i, code: 'c' + i }));
  const picked = pickRandom(packs, { count: 3, random: rng(1) });
  assert.equal(picked.length, 3);
  assert.equal(new Set(picked.map(p => p.code)).size, 3);
});

test('rng is deterministic for a given seed', () => {
  const a = pickRandom(Array.from({ length: 20 }, (_, i) => ({ code: '' + i })), { count: 5, random: rng(99) });
  const b = pickRandom(Array.from({ length: 20 }, (_, i) => ({ code: '' + i })), { count: 5, random: rng(99) });
  assert.deepEqual(a.map(p => p.code), b.map(p => p.code));
});

test('the shipped collections load without warnings and keep every valid code', () => {
  const warns = [];
  const { packs, collections } = loadCatalog({ warn: m => warns.push(m) }); // default ./collections
  assert.deepEqual(warns, []);
  assert.ok(collections.length >= 2);
  assert.ok(packs.length >= 2000);
  // One pack per unique valid code across the raw files (2,373 as shipped).
  const raw = new Set();
  for (const c of collections) {
    for (const p of JSON.parse(fs.readFileSync(path.join(DEFAULT_DIR, c.file), 'utf8')).packs) {
      const code = String(p.code || '').trim();
      if (CODE_RE.test(code)) raw.add(code.toUpperCase());
    }
  }
  assert.equal(packs.length, raw.size);
});

test('the category filter still reaches the categorised packs after the merge', () => {
  const { packs } = loadCatalog();
  const lander = JSON.parse(fs.readFileSync(path.join(DEFAULT_DIR, 'reddit-lander1984.json'), 'utf8')).packs;
  const rawAerials = lander.filter(p => /aerial/i.test(p.category || '')).length;
  assert.ok(rawAerials > 1);
  assert.equal(filterPacks(packs, { category: 'aerial' }).length, rawAerials);
});

test('a roll over the whole catalog can land on packs without a rating', () => {
  const { packs } = loadCatalog();
  const unrated = packs.filter(p => p.rating == null);
  assert.ok(unrated.length > 0);                       // Prejump packs carry no rating
  // No filter and no weighting: with the shipped mix (most packs unrated) a
  // 20-pack roll must include unrated ones, whatever the seed.
  const picked = pickRandom(filterPacks(packs, {}), { count: 20, random: rng(7) });
  assert.equal(picked.length, 20);
  assert.ok(picked.some(p => p.rating == null));
});
