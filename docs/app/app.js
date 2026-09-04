let CATALOG = { packs: [], collections: [], categories: [], difficulties: [], tags: [] };

const $ = id => document.getElementById(id);
const hay = v => String(v == null ? '' : v).toLowerCase();

function fillSelect(el, values, allLabel) {
  el.innerHTML = '<option value="">' + allLabel + '</option>' +
    values.map(v => '<option value="' + esc(v) + '">' + esc(v) + '</option>').join('');
}
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

function currentFilter() {
  return {
    collection: $('f-collection').value,
    category: $('f-category').value,
    difficulty: $('f-difficulty').value,
    tag: $('f-tag').value
  };
}
function matches(p, f) {
  if (f.collection && !(p.collections || [p.collection]).includes(f.collection)) return false;
  if (f.category && p.category !== f.category) return false;
  if (f.difficulty && p.difficulty !== f.difficulty) return false;
  if (f.tag && !(p.tags || []).includes(f.tag)) return false;
  return true;
}
function pool() { const f = currentFilter(); return CATALOG.packs.filter(p => matches(p, f)); }

function updateCount() {
  const n = pool().length;
  $('matchcount').textContent = n + ' pack' + (n === 1 ? '' : 's') + ' match';
}

function pickN(arr, n) {
  const p = arr.slice(), out = [];
  while (p.length && out.length < n) out.push(p.splice(Math.floor(Math.random() * p.length), 1)[0]);
  return out;
}

function cardHtml(p) {
  const bits = [];
  if (p.category) bits.push('<b>' + esc(p.category) + '</b>');
  if (p.difficulty) bits.push(esc(p.difficulty));
  if (p.rating != null) bits.push('rated ' + p.rating);
  if (p.creator) bits.push('by ' + esc(p.creator));
  const from = (p.collections || [p.collection]).join(', ');
  const tags = (p.tags || []).slice(0, 8).map(t => '<span class="tag">' + esc(t) + '</span>').join('');
  return '<div class="card">' +
    '<h3>' + esc(p.name) + '</h3>' +
    '<div class="meta">' + bits.join(' · ') + (bits.length ? ' · ' : '') + 'from ' + esc(from) + '</div>' +
    '<div class="codewrap"><span class="code">' + esc(p.code) + '</span>' +
    '<button class="copy" data-code="' + esc(p.code) + '">Copy code</button></div>' +
    (tags ? '<div class="tags">' + tags + '</div>' : '') +
    (p.notes ? '<div class="note">' + esc(p.notes.replace(/\s+/g, ' ').slice(0, 220)) + '</div>' : '') +
    '</div>';
}

function roll() {
  const n = Math.max(1, Math.min(12, Number($('f-n').value) || 1));
  const chosen = pickN(pool(), n);
  const el = $('cards');
  if (!chosen.length) { el.innerHTML = '<div class="empty">No packs match those filters. Loosen them and roll again.</div>'; return; }
  el.innerHTML = chosen.map(cardHtml).join('');
  el.querySelectorAll('button.copy').forEach(b => b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(b.dataset.code); b.textContent = 'Copied ✓'; b.classList.add('done'); }
    catch { b.textContent = b.dataset.code; }
    setTimeout(() => { b.textContent = 'Copy code'; b.classList.remove('done'); }, 1400);
  }));
}

async function init() {
  try {
    CATALOG = await (await fetch('catalog.json')).json();
  } catch { $('sub').textContent = 'could not load catalog'; return; }
  $('sub').textContent = CATALOG.packs.length + ' packs · ' + CATALOG.collections.length + ' collection(s)';
  fillSelect($('f-collection'), CATALOG.collections.map(c => c.name), 'All collections');
  fillSelect($('f-category'), CATALOG.categories, 'All categories');
  fillSelect($('f-difficulty'), CATALOG.difficulties, 'All difficulties');
  fillSelect($('f-tag'), CATALOG.tags, 'All tags');
  ['f-collection', 'f-category', 'f-difficulty', 'f-tag'].forEach(id => $(id).addEventListener('change', updateCount));
  $('roll').addEventListener('click', roll);
  updateCount();
  roll();
}
init();