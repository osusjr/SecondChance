// ============================================================================
// SecondChance Collective — browse / catalogue
// ============================================================================

import {
  sb, loadSession, money, num, esc, publicUrl, empty, debounce, param, getSettings,
} from './sc-core.js';

const PAGE = 24;

const state = {
  brands: new Set(),
  categories: new Set(),
  conditions: new Set(),
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

  // deep links from the existing catalog-*.html and brand-*.html pages
  const cat = param('category');
  const brand = param('brand');
  const q = param('q');
  if (cat) state.categories.add(cat);
  if (brand) state.brands.add(brand);
  if (q) state.q = q;

  await renderFilters();
  await load(true);
}

// ---------------------------------------------------------------------------
async function renderFilters() {
  let brands = [], categories = [], conditions = [];
  try {
    const res = await withTimeout(Promise.all([
      sb.from('brands').select('slug, name').eq('is_active', true).order('name'),
      sb.from('categories').select('slug, name').eq('is_active', true).order('sort_order'),
      sb.from('conditions').select('code, label').order('sort_order'),
    ]), 8000, 'filters');
    [brands, categories, conditions] = res.map(r => r.data || []);
  } catch (err) {
    console.error('[SecondChance] filters failed:', err);
  }

  const host = document.getElementById('br-filters');
  host.innerHTML = `
    <div class="sc-field">
      <input class="sc-input" id="br-q" placeholder="Search pieces" value="${esc(state.q)}">
    </div>

    <div class="br-group">
      <p>Category</p>
      <div class="br-opts">${(categories || []).map(c => `
        <label><input type="checkbox" data-f="categories" value="${esc(c.slug)}"
          ${state.categories.has(c.slug) ? 'checked' : ''}>${esc(c.name)}</label>`).join('')}</div>
    </div>

    <div class="br-group">
      <p>Brand</p>
      <div class="br-opts">${(brands || []).map(b => `
        <label><input type="checkbox" data-f="brands" value="${esc(b.slug)}"
          ${state.brands.has(b.slug) ? 'checked' : ''}>${esc(b.name)}</label>`).join('')}</div>
    </div>

    <div class="br-group">
      <p>Condition</p>
      <div class="br-opts">${(conditions || []).map(c => `
        <label><input type="checkbox" data-f="conditions" value="${esc(c.code)}"
          ${state.conditions.has(c.code) ? 'checked' : ''}>${esc(c.label)}</label>`).join('')}</div>
    </div>

    <div class="br-group">
      <p>Price (${esc(state.currency)})</p>
      <div class="sc-row-tight">
        <input class="sc-input" id="br-min" type="number" placeholder="Min" min="0" style="width:50%">
        <input class="sc-input" id="br-max" type="number" placeholder="Max" min="0" style="width:50%">
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
    state.min = state.max = null; state.q = '';
    renderFilters();
    load(true);
  });

  document.getElementById('br-sort').addEventListener('change', e => {
    state.sort = e.target.value;
    load(true);
  });

  document.getElementById('br-more').addEventListener('click', () => {
    state.page += 1;
    load(false);
  });
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

  let q = sb.from('listings')
    .select(`id, title, price, original_retail, status, is_featured, authentication_status, view_count,
             brand:brands!inner(name, slug), category:categories!inner(name, slug),
             condition:conditions(code, label),
             images:listing_images(storage_path, sort_order)`, { count: 'exact' })
    .eq('status', 'active');

  if (state.categories.size) q = q.in('category.slug', [...state.categories]);
  if (state.brands.size) q = q.in('brand.slug', [...state.brands]);
  if (state.conditions.size) q = q.in('condition_code', [...state.conditions]);
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
    const photo = (l.images || []).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0];
    const off = l.original_retail
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
      <p class="sc-xs sc-muted" style="margin-top:9px">${esc(l.brand?.name || '')}</p>
      <p class="sc-sm sc-truncate" style="font-weight:500;margin-top:2px">${esc(l.title)}</p>
      <p class="sc-sm sc-money" style="margin-top:3px">${money(l.price, state.currency)}
        ${off > 0 ? `<span class="sc-xs" style="color:var(--sc-ok);margin-left:5px">${off}% off</span>` : ''}</p>
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
