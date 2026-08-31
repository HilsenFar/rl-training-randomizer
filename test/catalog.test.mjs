// Tests for the catalog loader and the picker. No network needed.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadCatalog, CODE_RE } from '../lib/catalog.mjs';
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

test('filterPacks matches case-insensitive substrings', () => {
  const packs = [
    { name: 'One', code: 'A', category: 'AERIALS', difficulty: 'Gold', tags: ['Saves'], rating: 48, collection: 'c', collections: ['c'] },
    { name: 'Two', code: 'B', category: 'DEFENCE', difficulty: 'Silver', tags: [], rating: 20, collection: 'c', collections: ['c'] }
  ];
  assert.equal(filterPacks(packs, { category: 'aerial' }).length, 1);
  assert.equal(filterPacks(packs, { tag: 'save' }).length, 1);
  assert.equal(filterPacks(packs, { minRating: 40 }).length, 1);
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

test('the shipped collections load and every code is valid', () => {
  const { packs, collections } = loadCatalog(); // default ./collections
  assert.ok(collections.length >= 1);
  assert.ok(packs.length >= 1);
  for (const p of packs) assert.ok(CODE_RE.test(p.code), 'bad code: ' + p.code);
});
