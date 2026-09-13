// ============================================================================
// SecondChance Collective — browse / catalogue
// ============================================================================

import {
  sb, loadSession, money, num, esc, publicUrl, empty, debounce, param, getSettings,
  withTimeout,
} from './sc-core.js';

const PAGE = 24;

const state = {
  brands: new Set(),
  categories: new Set(),
  conditions: new Set(),
  colors: new Set(),
  sizes: new Set(),
  min: null,
  max: null,
  q: '',
  sort: 'new',
  page: 0,
  total: 0,
  currency: 'JOD',
};

export async function initBrowse() {
  // Neither of these gates the page: a signed-out visitor browses the same
  // catalogue, and settings only affect the currency label.
  loadSession().catch(() => {});
  getSettings().then(s => { state.currency = s.currency || 'JOD'; }).catch(() => {});

  // deep links from the catalog/brand pages and the homepage edits
  const cat = param('category');
  const brand = param('brand');
  const q = param('q');
  if (cat) state.categories.add(cat);
  if (brand) state.brands.add(brand);
  if (q) state.q = q;
  if (param('min') && !isNaN(Number(param('min')))) state.min = Number(param('min'));
  if (param('max') && !isNaN(Number(param('max')))) state.max = Number(param('max'));

  // These two live outside the filter panel, so they bind once here —
  // renderFilters can re-run (clear, retry) without stacking listeners.
  document.getElementById('br-sort').addEventListener('change', e => {
    state.sort = e.target.value;
    load(true);
  });
  document.getElementById('br-more').addEventListener('click', () => {
    state.page += 1;
    load(false);
  });

  await renderFilters();
  await load(true);
}

// ---------------------------------------------------------------------------
// The option lists are fetched once and kept — in memory for this page view,
// and in localStorage across visits — so a slow or failed refetch (the panel
// re-renders on "Clear filters") can never blank the filters out again.
let taxonomy = null;

async function loadFilterTaxonomy() {
  if (taxonomy) return taxonomy;

  try {
    const res = await withTimeout(Promise.all([
      sb.from('brands').select('slug, name').eq('is_active', true).order('name'),
      sb.from('categories').select('slug, name').eq('is_active', true).order('sort_order'),
      sb.from('conditions').select('code, label').order('sort_order'),
      sb.from('colors').select('name').eq('is_active', true).order('sort_order'),
      // sizes are seller-typed, so the filter offers whatever is actually live
      sb.from('listings').select('size_label').eq('status', 'active')
        .not('size_label', 'is', null).limit(400),
    ]), 8000, 'filters');
    if (res.slice(0, 3).some(r => r.error)) throw res.find(r => r.error).error;
    const [brands, categories, conditions, colors] = res.slice(0, 4).map(r => r.data || []);
    // categories are seeded and never legitimately empty, so an empty answer
    // is a failed fetch in disguise — fall back to the cache instead
    if (!categories.length) throw new Error('empty taxonomy');
    const counts = {};
    for (const row of res[4].data || []) {
      const label = String(row.size_label || '').trim();
      if (label) counts[label] = (counts[label] || 0) + 1;
    }
    const sizes = Object.keys(counts).sort((a, b) => counts[b] - counts[a]).slice(0, 24)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    taxonomy = { brands, categories, conditions, colors, sizes };
    try { localStorage.setItem('sc_filter_options', JSON.stringify(taxonomy)); } catch {}
  } catch (err) {
    console.error('[SecondChance] filters failed:', err);
    try {
      const cached = JSON.parse(localStorage.getItem('sc_filter_options') || 'null');
      if (cached?.categories?.length) taxonomy = cached;
    } catch {}
  }
  return taxonomy;
}

async function renderFilters() {
  const t = await loadFilterTaxonomy();
  const { brands = [], categories = [], conditions = [], colors = [], sizes = [] } = t || {};

  const host = document.getElementById('br-filters');
  host.innerHTML = `
    <div class="sc-field">
      <input class="sc-input" id="br-q" placeholder="Search pieces" value="${esc(state.q)}">
    </div>

    ${t ? '' : `<div class="sc-note sc-note-warn" style="margin:10px 0">
      The filter lists did not load.
      <button class="sc-btn sc-btn-ghost sc-btn-xs" id="br-retry" type="button"
        style="margin-top:8px">Try again</button>
    </div>`}

    ${categories.length ? `<div class="br-group">
      <p>Category</p>
      <div class="br-opts">${categories.map(c => `
        <label><input type="checkbox" data-f="categories" value="${esc(c.slug)}"
          ${state.categories.has(c.slug) ? 'checked' : ''}>${esc(c.name)}</label>`).join('')}</div>
    </div>` : ''}

    ${brands.length ? `<div class="br-group">
      <p>Brand</p>
      <div class="br-opts">${brands.map(b => `
        <label><input type="checkbox" data-f="brands" value="${esc(b.slug)}"
          ${state.brands.has(b.slug) ? 'checked' : ''}>${esc(b.name)}</label>`).join('')}</div>
    </div>` : ''}

    ${conditions.length ? `<div class="br-group">
      <p>Condition</p>
      <div class="br-opts">${conditions.map(c => `
        <label><input type="checkbox" data-f="conditions" value="${esc(c.code)}"
          ${state.conditions.has(c.code) ? 'checked' : ''}>${esc(c.label)}</label>`).join('')}</div>
    </div>` : ''}

    ${sizes.length ? `<div class="br-group">
      <p>Size</p>
      <div class="br-opts">${sizes.map(s => `
        <label><input type="checkbox" data-f="sizes" value="${esc(s)}"
          ${state.sizes.has(s) ? 'checked' : ''}>${esc(s)}</label>`).join('')}</div>
    </div>` : ''}

    ${colors.length ? `<div class="br-group">
      <p>Colour</p>
      <div class="br-opts">${colors.map(c => `
        <label><input type="checkbox" data-f="colors" value="${esc(c.name)}"
          ${state.colors.has(c.name) ? 'checked' : ''}>${esc(c.name)}</label>`).join('')}</div>
    </div>` : ''}

    <div class="br-group">
      <p>Price (${esc(state.currency)})</p>
      <div class="sc-row-tight">
        <input class="sc-input" id="br-min" type="number" placeholder="Min" min="0" style="width:50%"
          value="${state.min ?? ''}">
        <input class="sc-input" id="br-max" type="number" placeholder="Max" min="0" style="width:50%"
          value="${state.max ?? ''}">
      </div>
    </div>

    <button class="sc-btn sc-btn-ghost sc-btn-sm sc-btn-block" id="br-clear">Clear filters</button>`;

  host.querySelectorAll('[data-f]').forEach(box => box.addEventListener('change', () => {
    const set = state[box.dataset.f];
    box.checked ? set.add(box.value) : set.delete(box.value);
    load(true);
  }));

  const price = debounce(() => {
    state.min = Number(document.getElementById('br-min').value) || null;
    state.max = Number(document.getElementById('br-max').value) || null;
    load(true);
  }, 450);
  host.querySelector('#br-min').addEventListener('input', price);
  host.querySelector('#br-max').addEventListener('input', price);

  host.querySelector('#br-q').addEventListener('input', debounce(e => {
    state.q = e.target.value.trim();
    load(true);
  }, 350));

  host.querySelector('#br-clear').addEventListener('click', () => {
    state.brands.clear(); state.categories.clear(); state.conditions.clear();
    state.colors.clear(); state.sizes.clear();
    state.min = state.max = null; state.q = '';
    renderFilters();
    load(true);
  });

  host.querySelector('#br-retry')?.addEventListener('click', () => renderFilters());
}

// ---------------------------------------------------------------------------
async function load(reset) {
  if (reset) state.page = 0;

  const grid = document.getElementById('br-grid');
  const countEl = document.getElementById('br-count');
  const moreBtn = document.getElementById('br-more');

  if (reset) {
    grid.innerHTML = Array.from({ length: 8 }, () =>
      '<div><div class="sc-skeleton" style="aspect-ratio:4/5;border-radius:16px"></div>' +
      '<div class="sc-skeleton" style="height:14px;margin-top:9px;width:60%"></div></div>').join('');
    countEl.textContent = 'Loading…';
  }

  // Only force the brand join when filtering by brand — listings with a
  // seller-typed brand (custom_brand, no brand_id) must still appear.
  let q = sb.from('listings')
    .select(`id, title, price, original_retail, status, is_featured, authentication_status, view_count, custom_brand,
             brand:brands${state.brands.size ? '!inner' : ''}(name, slug), category:categories!inner(name, slug),
             condition:conditions(code, label),
             images:listing_images(storage_path, slot, sort_order)`, { count: 'exact' })
    .eq('status', 'active');

  if (state.categories.size) q = q.in('category.slug', [...state.categories]);
  if (state.brands.size) q = q.in('brand.slug', [...state.brands]);
  if (state.conditions.size) q = q.in('condition_code', [...state.conditions]);
  if (state.colors.size) q = q.in('color', [...state.colors]);
  if (state.sizes.size) q = q.in('size_label', [...state.sizes]);
  if (state.min != null) q = q.gte('price', state.min);
  if (state.max != null) q = q.lte('price', state.max);
  if (state.q) q = q.textSearch('search_vector', state.q, { type: 'websearch', config: 'english' });

  const order = {
    new: ['published_at', false],
    price_asc: ['price', true],
    price_desc: ['price', false],
    popular: ['view_count', false],
  }[state.sort];
  q = q.order(order[0], { ascending: order[1], nullsFirst: false });

  const from = state.page * PAGE;
  let data, error, count;
  try {
    ({ data, error, count } = await withTimeout(
      q.range(from, from + PAGE - 1), 10000, 'listings'));
  } catch (err) {
    error = err;
  }

  if (error) {
    console.error('[SecondChance] browse failed:', error);
    grid.innerHTML = `<div style="grid-column:1/-1">${empty('Could not load listings',
      esc(error.message || String(error)) +
      ' — open diagnostics.html to see which part is failing.')}</div>`;
    countEl.textContent = '';
    moreBtn.hidden = true;
    return;
  }

  state.total = count || 0;

  const cards = (data || []).map(l => {
    const photo = (l.images || []).filter(p => p.slot !== 'video')
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0];
    const off = l.original_retail && l.original_retail > l.price
      ? Math.round((1 - l.price / l.original_retail) * 100) : 0;
    return `<a class="br-card" href="item.html?id=${esc(l.id)}">
      <div style="position:relative">
        ${photo
          ? `<img src="${publicUrl('listing-photos', photo.storage_path)}" alt="${esc(l.title)}" loading="lazy">`
          : '<div class="br-ph"></div>'}
        ${l.authentication_status === 'passed'
          ? '<span class="sc-badge sc-badge-ok br-tag">Authenticated</span>'
          : l.is_featured ? '<span class="sc-badge sc-badge-accent br-tag">Featured</span>' : ''}
      </div>
      <p class="sc-xs sc-muted" style="margin-top:9px">${esc(l.brand?.name || l.custom_brand || '')}</p>
      <p class="sc-sm sc-truncate" style="font-weight:500;margin-top:2px">${esc(l.title)}</p>
      <p class="sc-sm sc-money" style="margin-top:3px">${money(l.price, state.currency)}
        ${off > 0 ? `<span class="sc-xs" style="color:var(--color-muted);text-decoration:line-through;margin-inline-start:5px">${money(l.original_retail, state.currency)}</span>
          <span class="sc-xs" style="color:var(--sc-ok);margin-inline-start:4px">${off}% off</span>` : ''}</p>
      ${l.condition ? `<p class="sc-xs sc-muted" style="margin-top:2px">${esc(l.condition.label)}</p>` : ''}
    </a>`;
  }).join('');

  if (reset) {
    grid.innerHTML = cards || '';
    if (!data?.length) {
      grid.innerHTML = `<div style="grid-column:1/-1">${empty('Nothing matches',
        'Try widening the price range or clearing a filter.')}</div>`;
    }
  } else {
    grid.insertAdjacentHTML('beforeend', cards);
  }

  const shown = Math.min(from + PAGE, state.total);
  countEl.textContent = state.total
    ? `${num(shown)} of ${num(state.total)} piece${state.total === 1 ? '' : 's'}`
    : 'No pieces yet';
  moreBtn.hidden = shown >= state.total;
}
