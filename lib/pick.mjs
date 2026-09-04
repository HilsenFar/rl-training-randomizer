// pick.mjs — filter a catalog and pull random training packs from it.
//
// Filtering is all case-insensitive substring matching, so `--category aerial`
// finds "AERIALS" and `--tag save` finds the "Saves" tag. `pickRandom` returns
// distinct packs (never the same one twice in a roll). Every pack in the pool
// has the same chance; a rating is shown on the card but never filters or
// weights the draw, since most packs (Prejump's) have none.

function hay(v) { return String(v == null ? '' : v).toLowerCase(); }

/**
 * @param {Array} packs
 * @param {object} f
 * @param {string} [f.collection]
 * @param {string} [f.category]
 * @param {string} [f.difficulty]
 * @param {string} [f.tag]
 * @param {string} [f.creator]
 * @param {string} [f.text]        matches name/notes/creator/tags
 */
export function filterPacks(packs, f = {}) {
  return packs.filter(p => {
    if (f.collection && !(p.collections || [p.collection]).some(c => hay(c).includes(hay(f.collection)))) return false;
    if (f.category && !hay(p.category).includes(hay(f.category))) return false;
    if (f.difficulty && !hay(p.difficulty).includes(hay(f.difficulty))) return false;
    if (f.creator && !hay(p.creator).includes(hay(f.creator))) return false;
    if (f.tag && !(p.tags || []).some(t => hay(t).includes(hay(f.tag)))) return false;
    if (f.text) {
      const t = hay(f.text);
      const inTags = (p.tags || []).some(x => hay(x).includes(t));
      if (!hay(p.name).includes(t) && !hay(p.notes).includes(t) && !hay(p.creator).includes(t) && !inTags) return false;
    }
    return true;
  });
}

// A tiny seedable PRNG (mulberry32) so `--seed` gives repeatable rolls.
export function rng(seed) {
  if (seed == null) return Math.random;
  let a = (seed >>> 0) || 1;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Draw up to `count` distinct packs.
 * @param {Array} packs
 * @param {object} [opts]
 * @param {number} [opts.count=1]
 * @param {()=>number} [opts.random=Math.random]
 */
export function pickRandom(packs, opts = {}) {
  const count = Math.max(1, Math.floor(opts.count || 1));
  const random = opts.random || Math.random;
  const pool = packs.slice();
  const out = [];
  while (pool.length && out.length < count) {
    const idx = Math.floor(random() * pool.length);
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}
