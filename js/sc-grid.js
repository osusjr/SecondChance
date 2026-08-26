// ============================================================================
// SecondChance Collective — live grid hydration
//
// The prototype's hardcoded product cards are gone. Every grid that held them
// now carries data-sc-grid with the filter implied by its page, and this fills
// it from the listings table. One module covers the homepage, the eight
// category pages, the fourteen brand pages and the price-band searches.
// ============================================================================

import { sb, money, esc, publicUrl, getSettings, withTimeout } from './sc-core.js';

let currency = 'JOD';

const card = l => {
  const photo = (l.images || []).filter(p => p.slot !== 'video')
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0];
  const off = l.original_retail && l.original_retail > l.price
    ? Math.round((1 - l.price / l.original_retail) * 100) : 0;

  return `<article class="group relative pt-3.5">
    <a href="item.html?id=${esc(l.id)}" style="display:block;color:inherit;text-decoration:none">
      <div style="position:relative">
        ${photo
          ? `<img src="${publicUrl('listing-photos', photo.storage_path)}"
                 alt="${esc(l.title)}" loading="lazy"
                 style="width:100%;aspect-ratio:4/5;object-fit:cover;display:block;
                        border-radius:var(--radius-inner);background:var(--color-product)">`
          : `<div style="width:100%;aspect-ratio:4/5;border-radius:var(--radius-inner);
                        background:var(--color-product)"></div>`}
        ${l.authentication_status === 'passed'
          ? `<span class="sc-badge sc-badge-ok" style="position:absolute;top:9px;left:9px">Authenticated</span>`
          : l.is_featured
            ? `<span class="sc-badge sc-badge-accent" style="position:absolute;top:9px;left:9px">Featured</span>`
            : ''}
      </div>
      <p class="sc-xs sc-muted" style="margin-top:9px">${esc(l.brand?.name || l.custom_brand || '')}</p>
      <p class="sc-sm sc-truncate" style="font-weight:500;margin-top:2px">${esc(l.title)}</p>
      <p class="sc-sm sc-money" style="margin-top:3px">${money(l.price, currency)}
        ${off > 0
          ? `<span class="sc-xs" style="color:var(--sc-ok);margin-inline-start:5px">${off}% off</span>`
          : ''}</p>
      ${l.condition ? `<p class="sc-xs sc-muted" style="margin-top:2px">${esc(l.condition.label)}</p>` : ''}
    </a>
  </article>`;
};

async function fill(grid) {
  let filter = {};
  try { filter = JSON.parse(grid.dataset.scGrid || '{}'); } catch { /* keep empty */ }

  const limit = filter.limit || 12;

  let q = sb.from('listings')
    .select(`id, title, price, original_retail, is_featured, authentication_status, custom_brand,
             brand:brands${filter.brand ? '!inner' : ''}(name, slug),
             category:categories${filter.category ? '!inner' : ''}(name, slug),
             condition:conditions(label),
             images:listing_images(storage_path, slot, sort_order)`)
    .eq('status', 'active')
    .limit(limit);

  if (filter.category) q = q.eq('category.slug', filter.category);
  if (filter.brand) q = q.eq('brand.slug', filter.brand);
  if (filter.min != null) q = q.gte('price', filter.min);
  if (filter.max != null) q = q.lte('price', filter.max);

  q = q.order(filter.sort === 'new' ? 'published_at' : 'published_at',
              { ascending: false, nullsFirst: false });

  let data, error;
  try {
    ({ data, error } = await withTimeout(q, 10000, 'listings'));
  } catch (err) {
    error = err;
  }

  if (error) {
    console.error('[SecondChance] grid failed:', error);
    grid.innerHTML = `<div style="grid-column:1/-1;padding:26px 0">
        <p class="sc-sm" style="color:var(--sc-danger,#b3261e)">Could not load listings.</p>
        <p class="sc-xs sc-muted" style="margin-top:5px">${esc(error.message || String(error))}</p>
        <p class="sc-xs sc-muted" style="margin-top:8px">
          Open <a href="diagnostics.html" style="text-decoration:underline">diagnostics.html</a>
          to see which part is failing.</p>
      </div>`;
    return;
  }

  if (!data?.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;padding:38px 0;text-align:center">
        <p class="sc-h3">Nothing here yet</p>
        <p class="sc-sm sc-muted" style="margin-top:6px">
          The first pieces will appear as soon as they are approved.</p>
        <a class="sc-btn sc-btn-primary sc-btn-sm" style="margin-top:16px" href="sell.html">
          List the first one</a>
      </div>`;
    return;
  }

  grid.innerHTML = data.map(card).join('');
}

export async function initGrids() {
  const grids = document.querySelectorAll('[data-sc-grid]');
  if (!grids.length) return;

  // Start filling immediately. Settings only decide how a price is formatted,
  // so waiting on them before showing anything trades a whole page of content
  // for a currency symbol.
  grids.forEach(g => fill(g).catch(err => {
    console.error('[SecondChance] grid crashed:', err);
    g.innerHTML = `<p class="sc-sm sc-muted" style="grid-column:1/-1;padding:26px 0">
      Could not load listings. See diagnostics.html.</p>`;
  }));

  try {
    currency = (await getSettings()).currency || 'JOD';
  } catch { /* the fallback inside getSettings already covers this */ }
}

// ---------------------------------------------------------------------------
// Live counts
//
// The prototype shipped hard numbers — "2.6k pieces authenticated", per-brand
// inventory — that were never true. On a site taking real money those are a
// claim you cannot support, so each one is now a placeholder filled from the
// database. A count of zero hides its whole line rather than announcing it.
// ---------------------------------------------------------------------------
const compact = n => n >= 1000
  ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'k'
  : String(n);

async function countOf(build) {
  try {
    const { count, error } = await withTimeout(build(), 8000, 'count');
    return error ? null : (count ?? 0);
  } catch { return null; }
}

export async function initCounts() {
  const slots = [...document.querySelectorAll('[data-sc-count]')];
  if (!slots.length) return;

  const kinds = new Set(slots.map(s => s.dataset.scCount));
  const totals = {};

  await Promise.all([
    kinds.has('live') || kinds.has('brand')
      ? countOf(() => sb.from('listings').select('id', { count: 'exact', head: true })
          .eq('status', 'active')).then(n => { totals.live = n; })
      : null,
    kinds.has('authenticated')
      ? countOf(() => sb.from('listings').select('id', { count: 'exact', head: true })
          .eq('authentication_status', 'passed')).then(n => { totals.authenticated = n; })
      : null,
    kinds.has('members')
      ? countOf(() => sb.from('profiles').select('id', { count: 'exact', head: true })
          .eq('account_status', 'active')).then(n => { totals.members = n; })
      : null,
  ].filter(Boolean));

  // per-brand counts, one query each but only for brands actually on the page
  const brandSlots = slots.filter(s => s.dataset.scBrand);
  const brandCounts = {};
  await Promise.all([...new Set(brandSlots.map(s => s.dataset.scBrand))].map(async slug => {
    brandCounts[slug] = await countOf(() => sb.from('listings')
      .select('id, brand:brands!inner(slug)', { count: 'exact', head: true })
      .eq('status', 'active').eq('brand.slug', slug));
  }));

  for (const slot of slots) {
    const kind = slot.dataset.scCount;
    const n = kind === 'brand' ? brandCounts[slot.dataset.scBrand] : totals[kind];

    // Unknown or zero: say nothing rather than boast about an empty shelf.
    if (n === null || n === undefined || n === 0) {
      const line = slot.closest('p, li, div');
      if (line && line.textContent.trim().length < 60) line.hidden = true;
      else slot.hidden = true;
      continue;
    }

    slot.hidden = false;
    slot.textContent = kind === 'brand' ? `${compact(n)} pieces` : compact(n);
  }
}
