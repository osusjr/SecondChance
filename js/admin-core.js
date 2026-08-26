// ============================================================================
// Admin sections: dashboard, analytics, listings, authentication, taxonomy
// ============================================================================

import {
  sb, session, money, num, date, ago, esc, badge, titleCase,
  toast, modal, confirmAction, empty, publicUrl, downloadCsv, errorMessage,
} from './sc-core.js';
import { toolbar, table, wireToolbar, adminAction, refreshCounts } from './sc-admin.js';

const cur = ctx => ctx.settings?.currency || 'JOD';

// ---------------------------------------------------------------------------
// 1. DASHBOARD
// ---------------------------------------------------------------------------
async function dashboard({ setContent, setTitle, setActions, ctx }) {
  setTitle('Dashboard', 'The last 30 days across the marketplace');
  setActions(`<select class="sc-select" data-range style="width:150px;min-height:34px;padding:6px 30px 6px 11px;font-size:13px">
    <option value="7">Last 7 days</option>
    <option value="30" selected>Last 30 days</option>
    <option value="90">Last 90 days</option>
    <option value="365">Last year</option>
  </select>`);

  const draw = async days => {
    const [{ data: s }, { data: activity }] = await Promise.all([
      sb.rpc('admin_dashboard_stats', { p_days: Number(days) }),
      sb.rpc('admin_recent_activity', { p_limit: 14 }),
    ]);
    const c = s?.currency || cur(ctx);

    const tile = (label, value, note, accent) => `
      <div class="sc-stat ${accent ? 'sc-stat-accent' : ''}">
        <span class="sc-stat-label">${label}</span>
        <span class="sc-stat-value">${value}</span>
        ${note ? `<span class="sc-stat-note">${note}</span>` : ''}</div>`;

    const queue = (label, count, target) => `
      <button class="sc-stat" data-jump="${target}" style="text-align:left;cursor:pointer;border:0;
        ${count ? 'background:var(--color-accent-tint)' : ''}">
        <span class="sc-stat-label">${label}</span>
        <span class="sc-stat-value" style="${count ? 'color:var(--color-accent)' : ''}">${num(count)}</span>
        <span class="sc-stat-note">${count ? 'Needs a decision' : 'All clear'}</span></button>`;

    setContent(`
      <section>
        <p class="sc-eyebrow">Money</p>
        <div class="sc-grid sc-grid-4" style="margin-top:10px">
          ${tile('Total sales', money(s.total_sales, c), `${money(s.sales_period, c)} this period`)}
          ${tile('Commission earned', money(s.commission_earned, c), null, true)}
          ${tile('Pending payouts', money(s.pending_payouts, c), `${num(s.payout_count)} waiting`)}
          ${tile('Average order', money(s.avg_order_value, c))}
        </div>
      </section>

      <section style="margin-top:26px">
        <p class="sc-eyebrow">Needs you</p>
        <div class="sc-grid sc-grid-4" style="margin-top:10px">
          ${queue('Listings to review', s.pending_listings, 'listings')}
          ${queue('Items to authenticate', s.pending_auth, 'verification')}
          ${queue('Seller applications', s.pending_sellers, 'sellers')}
          ${queue('Open reports', s.open_reports, 'reports')}
        </div>
      </section>

      <section style="margin-top:26px">
        <p class="sc-eyebrow">Marketplace</p>
        <div class="sc-grid sc-grid-4" style="margin-top:10px">
          ${tile('Members', num(s.total_users), `${num(s.new_users)} new this period`)}
          ${tile('Active sellers', num(s.active_sellers), `${num(s.total_sellers)} approved`)}
          ${tile('Live listings', num(s.active_listings))}
          ${tile('Items sold', num(s.items_sold), `${num(s.items_sold_period)} this period`)}
        </div>
      </section>

      <section style="margin-top:26px">
        <div class="sc-card">
          <h2 class="sc-h2">Recent activity</h2>
          <div style="margin-top:12px">
            ${activity?.length ? activity.map(a => `
              <div class="sc-between" style="padding:9px 0;border-bottom:1px solid var(--color-line)">
                <div class="sc-grow sc-row-tight">
                  ${badge(a.kind, titleCase(a.kind))}
                  <div style="min-width:0">
                    <p class="sc-sm sc-truncate">${esc(a.title || '')}</p>
                    <p class="sc-xs sc-muted sc-truncate">${esc(a.detail || '')}</p></div>
                </div>
                <span class="sc-xs sc-muted">${ago(a.at)}</span>
              </div>`).join('')
              : '<p class="sc-sm sc-muted">Nothing yet.</p>'}
          </div>
        </div>
      </section>`);

    document.querySelectorAll('[data-jump]').forEach(b =>
      b.addEventListener('click', () => { location.hash = b.dataset.jump; }));
  };

  await draw(30);
  document.querySelector('[data-range]')?.addEventListener('change', e => draw(e.target.value));
}

// ---------------------------------------------------------------------------
// 12. ANALYTICS
// ---------------------------------------------------------------------------
async function analytics({ setContent, setTitle, setActions, ctx }) {
  setTitle('Analytics', 'Sales, brands and growth');
  setActions('<button class="sc-btn sc-btn-ghost sc-btn-sm" data-export>Download report</button>');

  const [{ data: monthly }, { data: brands }, { data: categories }, { data: stats }] = await Promise.all([
    sb.rpc('admin_sales_by_month', { p_months: 12 }),
    sb.rpc('admin_top_brands', { p_limit: 8 }),
    sb.rpc('admin_top_categories', { p_limit: 8 }),
    sb.rpc('admin_dashboard_stats', { p_days: 30 }),
  ]);
  const c = cur(ctx);
  const peak = Math.max(...(monthly || []).map(m => Number(m.revenue)), 1);

  const rankTable = (rows, labelKey) => rows?.length
    ? `<table class="sc-table"><thead><tr><th>${labelKey === 'brand' ? 'Brand' : 'Category'}</th>
        <th style="text-align:right">Listed</th><th style="text-align:right">Sold</th>
        <th style="text-align:right">Revenue</th></tr></thead><tbody>
        ${rows.map(r => `<tr><td>${esc(r[labelKey])}</td>
          <td class="sc-cell-num">${num(r.listings)}</td>
          <td class="sc-cell-num">${num(r.sold)}</td>
          <td class="sc-cell-num sc-money">${money(r.revenue, c)}</td></tr>`).join('')}
      </tbody></table>`
    : '<p class="sc-sm sc-muted" style="padding:16px">No sales recorded yet.</p>';

  setContent(`
    <div class="sc-card">
      <h2 class="sc-h2">Revenue by month</h2>
      ${monthly?.length ? `
        <div class="sc-chart" style="margin-top:18px">
          ${monthly.map(m => `
            <div class="sc-chart-col" title="${money(m.revenue, c)} · ${num(m.orders)} orders">
              <div class="sc-chart-bar" style="height:${Math.max(2, Number(m.revenue) / peak * 140)}px"></div>
              <span class="sc-chart-label">${new Date(m.month).toLocaleDateString('en-GB', { month: 'short' })}</span>
            </div>`).join('')}
        </div>
        <div class="sc-grid sc-grid-3" style="margin-top:20px">
          <div><p class="sc-eyebrow">Total revenue</p>
            <p class="sc-money-lg">${money(monthly.reduce((a, m) => a + Number(m.revenue), 0), c)}</p></div>
          <div><p class="sc-eyebrow">Commission</p>
            <p class="sc-money-lg" style="color:var(--color-accent)">${money(monthly.reduce((a, m) => a + Number(m.commission), 0), c)}</p></div>
          <div><p class="sc-eyebrow">Orders</p>
            <p class="sc-money-lg">${num(monthly.reduce((a, m) => a + Number(m.orders), 0))}</p></div>
        </div>`
        : empty('No sales yet', 'This chart fills in as orders come through.')}
    </div>

    <div class="sc-grid sc-grid-2" style="margin-top:18px;align-items:start">
      <div class="sc-card sc-card-flush">
        <h2 class="sc-h2" style="padding:18px 18px 6px">Most popular brands</h2>
        <div style="overflow-x:auto">${rankTable(brands, 'brand')}</div></div>
      <div class="sc-card sc-card-flush">
        <h2 class="sc-h2" style="padding:18px 18px 6px">Most popular categories</h2>
        <div style="overflow-x:auto">${rankTable(categories, 'category')}</div></div>
    </div>

    <div class="sc-grid sc-grid-4" style="margin-top:18px">
      <div class="sc-stat"><span class="sc-stat-label">Average order value</span>
        <span class="sc-stat-value">${money(stats?.avg_order_value, c)}</span></div>
      <div class="sc-stat"><span class="sc-stat-label">Active sellers</span>
        <span class="sc-stat-value">${num(stats?.active_sellers)}</span></div>
      <div class="sc-stat"><span class="sc-stat-label">Unsold inventory</span>
        <span class="sc-stat-value">${num(stats?.active_listings)}</span></div>
      <div class="sc-stat"><span class="sc-stat-label">New members</span>
        <span class="sc-stat-value">${num(stats?.new_users)}</span>
        <span class="sc-stat-note">Last 30 days</span></div>
    </div>`);

  document.querySelector('[data-export]')?.addEventListener('click', () => {
    downloadCsv(`secondchance-revenue-${new Date().toISOString().slice(0, 10)}.csv`,
      (monthly || []).map(m => ({
        month: String(m.month).slice(0, 7), orders: m.orders,
        revenue: m.revenue, commission: m.commission,
      })));
  });
}

// ---------------------------------------------------------------------------
// 3. LISTING MANAGEMENT
// ---------------------------------------------------------------------------
async function listings({ setContent, setTitle, setActions, ctx }) {
  setTitle('Listings', 'Review, approve and manage everything on the marketplace');
  setActions('<button class="sc-btn sc-btn-ghost sc-btn-sm" data-export>Export</button>');

  const tabs = [
    { value: 'pending_review', label: 'Awaiting review', active: true, count: ctx.counts.pending_listings },
    { value: 'active', label: 'Live' },
    { value: 'draft', label: 'Drafts' },
    { value: 'reserved', label: 'Reserved' },
    { value: 'sold', label: 'Sold' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'flagged', label: 'Flagged' },
    { value: 'all', label: 'Everything' },
  ];

  const root = setContent(toolbar({ tabs, placeholder: 'Title, reference or seller' }) +
    '<div data-list></div>');

  let rowsCache = [];

  const load = async ({ filter, query }) => {
    const host = root.querySelector('[data-list]');
    host.innerHTML = '<div class="sc-skeleton" style="height:200px"></div>';

    let q = sb.from('listings')
      .select(`id, reference, title, status, price, created_at, is_featured, is_flagged,
               authentication_status, rejection_reason, custom_brand,
               brand:brands(name), category:categories(name),
               seller:profiles!listings_seller_id_fkey(id, username, full_name, seller_status),
               images:listing_images(storage_path, slot)`)
      .order('created_at', { ascending: false }).limit(120);

    if (filter === 'flagged') q = q.eq('is_flagged', true);
    else if (filter !== 'all') q = q.eq('status', filter);
    if (query) q = q.or(`title.ilike.%${query}%,reference.ilike.%${query}%`);

    const { data, error } = await q;
    if (error) { host.innerHTML = `<div class="sc-note sc-note-danger">${esc(errorMessage(error))}</div>`; return; }
    rowsCache = data || [];

    host.innerHTML = table({
      columns: [{ label: 'Piece' }, { label: 'Seller' }, { label: 'Status' },
                { label: 'Price', align: 'right' }, { label: 'Listed' }, { label: '' }],
      emptyTitle: filter === 'pending_review' ? 'Review queue is clear' : 'Nothing here',
      emptyText: filter === 'pending_review'
        ? 'Every submitted listing has had a decision.' : 'Try a different filter.',
      rows: rowsCache.map(l => {
        const front = l.images?.find(i => i.slot === 'front') || l.images?.[0];
        return `<tr>
          <td><div class="sc-row-tight">
            <img class="sc-thumb" src="${front ? publicUrl('listing-photos', front.storage_path) : ''}" alt="" loading="lazy">
            <div style="min-width:0"><p style="font-weight:500" class="sc-truncate">${esc(l.title)}</p>
              <p class="sc-xs sc-muted">${esc(l.reference || '')} · ${esc(l.brand?.name || l.custom_brand || 'No brand')} · ${esc(l.category?.name || '—')}</p>
              ${l.is_flagged ? '<span class="sc-badge sc-badge-danger" style="margin-top:3px">Flagged</span>' : ''}
            </div></div></td>
          <td><p class="sc-sm">${esc(l.seller?.username || l.seller?.full_name || '—')}</p>
            <p class="sc-xs sc-muted">${esc(titleCase(l.seller?.seller_status || 'none'))}</p></td>
          <td>${badge(l.status)}${l.authentication_status === 'passed'
            ? '<br><span class="sc-badge sc-badge-ok" style="margin-top:4px">Authenticated</span>' : ''}</td>
          <td class="sc-cell-num sc-money">${money(l.price, cur(ctx))}</td>
          <td class="sc-sm sc-muted">${date(l.created_at)}</td>
          <td class="sc-cell-actions">
            <button class="sc-btn sc-btn-ghost sc-btn-xs" data-open="${l.id}">Open</button>
          </td></tr>`;
      }),
    });

    host.querySelectorAll('[data-open]').forEach(b =>
      b.addEventListener('click', () => openListing(b.dataset.open, ctx, () => load({ filter, query }))));
  };

  const getState = wireToolbar(root, load);
  await load({ filter: 'pending_review', query: '' });

  document.querySelector('[data-export]')?.addEventListener('click', () => {
    downloadCsv('secondchance-listings.csv', rowsCache.map(l => ({
      reference: l.reference, title: l.title, brand: l.brand?.name || l.custom_brand, category: l.category?.name,
      seller: l.seller?.username, status: l.status, price: l.price, listed: l.created_at,
    })));
  });
}

async function openListing(id, ctx, reload) {
  const { data: l } = await sb.from('listings')
    .select(`*, brand:brands(name), category:categories(name), condition:conditions(label),
             seller:profiles!listings_seller_id_fkey(id, username, full_name, phone, city, area, seller_status),
             images:listing_images(storage_path, slot, sort_order),
             moderation:listing_moderation(decision, reason_code, notes, created_at)`)
    .eq('id', id).single();
  if (!l) return toast('That listing has gone.', 'danger');

  const canModerate = session.can('listings.moderate');
  const photos = (l.images || []).sort((a, b) => a.sort_order - b.sort_order);

  const result = await modal({
    size: 'lg',
    title: l.title,
    body: `
      <div class="sc-row-tight" style="margin-bottom:14px">
        ${badge(l.status)} ${l.is_flagged ? '<span class="sc-badge sc-badge-danger">Flagged</span>' : ''}
        ${l.is_featured ? '<span class="sc-badge sc-badge-accent">Featured</span>' : ''}
        <span class="sc-badge">${esc(l.reference || '')}</span>
      </div>

      <div class="sc-photos">${photos.length
        ? photos.map(p => p.slot === 'video' || /\.(mp4|mov|webm)$/i.test(p.storage_path)
            ? `<video src="${esc(publicUrl('listing-photos', p.storage_path))}" controls playsinline preload="metadata"
                 style="width:100%;border-radius:10px;background:#101114"></video>`
            : `<a href="${publicUrl('listing-photos', p.storage_path)}" target="_blank" rel="noopener">
            <img src="${publicUrl('listing-photos', p.storage_path)}" alt="${esc(p.slot || '')}" loading="lazy"></a>`).join('')
        : '<p class="sc-sm sc-muted">No photos uploaded.</p>'}</div>

      <dl class="sc-kv" style="margin-top:18px">
        <dt>Seller</dt><dd>${esc(l.seller?.username || l.seller?.full_name || '—')}
          ${l.seller?.seller_status === 'approved' ? '<span class="sc-badge sc-badge-ok">Verified</span>' : ''}</dd>
        <dt>Brand</dt><dd>${esc(l.brand?.name || l.custom_brand || '—')}
          ${!l.brand && l.custom_brand ? '<span class="sc-badge sc-badge-warn">Typed by seller</span>' : ''}</dd>
        <dt>Category</dt><dd>${esc(l.category?.name || '—')}</dd>
        <dt>Condition</dt><dd>${esc(l.condition?.label || l.condition_code || '—')}</dd>
        <dt>Size</dt><dd>${esc(l.size_label || '—')}</dd>
        <dt>Colour</dt><dd>${esc(l.color || '—')}</dd>
        <dt>Price</dt><dd class="sc-money">${money(l.price, cur(ctx))}${l.original_retail
          ? ` <span class="sc-muted sc-xs">retail ${money(l.original_retail, cur(ctx))}</span>` : ''}</dd>
        <dt>Authentication</dt><dd>${badge(l.authentication_status)}</dd>
        <dt>Submitted</dt><dd>${date(l.created_at, true)}</dd>
        <dt>Views</dt><dd>${num(l.view_count)} · ${num(l.favorite_count)} saved</dd>
      </dl>

      ${l.description ? `<div style="margin-top:16px"><p class="sc-eyebrow">Seller notes</p>
        <p class="sc-lead" style="margin-top:5px">${esc(l.description)}</p></div>` : ''}

      ${l.rejection_reason ? `<div class="sc-note sc-note-danger" style="margin-top:14px">
        <strong>Rejected:</strong> ${esc(l.rejection_reason)}</div>` : ''}

      ${l.moderation?.length ? `<div style="margin-top:16px"><p class="sc-eyebrow">History</p>
        ${l.moderation.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map(m =>
          `<p class="sc-xs sc-muted" style="margin-top:5px">${date(m.created_at, true)} —
            ${esc(titleCase(m.decision))}${m.reason_code ? ': ' + esc(m.reason_code) : ''}</p>`).join('')}
      </div>` : ''}`,
    actions: canModerate ? [
      { label: 'Close', value: 'close' },
      { label: 'Request info', value: 'info' },
      { label: l.is_flagged ? 'Remove flag' : 'Flag', value: 'flag' },
      ...(l.status === 'active' ? [
        { label: l.is_featured ? 'Unfeature' : 'Feature', value: 'feature' },
        { label: 'Mark reserved', value: 'reserve' },
        { label: 'Mark sold', value: 'sold' },
        { label: 'Remove', value: 'remove', kind: 'sc-btn-danger' },
      ] : []),
      ...(['pending_review', 'draft', 'rejected'].includes(l.status) ? [
        { label: 'Reject', value: 'reject', kind: 'sc-btn-danger' },
        { label: 'Approve', value: 'approve', kind: 'sc-btn-primary' },
      ] : []),
    ] : [{ label: 'Close', value: 'close' }],
  });

  if (!result || result.value === 'close') return;
  const action = result.value;

  if (action === 'approve') {
    await adminAction(() => sb.rpc('admin_moderate_listing',
      { p_listing: id, p_decision: 'approved' }), 'Listing approved and live.');
  }

  if (action === 'reject') {
    const reason = await askReason('Why is this being rejected?', [
      'Photos are unclear or incomplete',
      'Missing the label or serial shot',
      'Condition does not match the photos',
      'Brand cannot be verified',
      'Price is unrealistic',
      'Prohibited item',
      'Suspected counterfeit',
    ]);
    if (!reason) return;
    await adminAction(() => sb.rpc('admin_moderate_listing',
      { p_listing: id, p_decision: 'rejected', p_reason: reason }), 'Listing rejected and the seller told why.');
  }

  if (action === 'remove') {
    const reason = await askReason('Why is this coming down?', [
      'Reported by a buyer', 'Counterfeit confirmed', 'Sold elsewhere', 'Seller request', 'Policy breach',
    ]);
    if (!reason) return;
    await adminAction(() => sb.rpc('admin_moderate_listing',
      { p_listing: id, p_decision: 'removed', p_reason: reason }), 'Listing removed.');
  }

  if (action === 'flag') {
    await adminAction(() => sb.rpc('admin_moderate_listing', {
      p_listing: id, p_decision: l.is_flagged ? 'unflagged' : 'flagged',
      p_reason: l.is_flagged ? null : 'Flagged for a closer look',
    }), l.is_flagged ? 'Flag removed.' : 'Flagged.');
  }

  if (action === 'feature') {
    await adminAction(() => sb.from('listings')
      .update({ is_featured: !l.is_featured }).eq('id', id),
      l.is_featured ? 'No longer featured.' : 'Featured on the homepage.');
  }

  if (action === 'reserve' || action === 'sold') {
    await adminAction(() => sb.from('listings')
      .update({ status: action === 'reserve' ? 'reserved' : 'sold' }).eq('id', id),
      action === 'reserve' ? 'Marked reserved.' : 'Marked sold.');
  }

  if (action === 'info') {
    const message = await askText('What do you need from the seller?',
      'For example: a clearer shot of the interior stamp.');
    if (!message) return;
    await adminAction(async () => {
      await sb.from('listing_info_requests').insert({ listing_id: id, admin_id: session.user.id, message });
      return sb.from('notifications').insert({
        user_id: l.seller_id, type: 'listing_info',
        title: 'We need one more thing', body: message, link_url: 'account.html?tab=listings',
      });
    }, 'Request sent to the seller.');
  }

  reload?.();
}

// ---------------------------------------------------------------------------
// 4. AUTHENTICATION / QUALITY CONTROL
// ---------------------------------------------------------------------------
async function verification({ setContent, setTitle, ctx }) {
  setTitle('Authentication', `Everything priced over ${money(ctx.settings?.authentication_threshold, cur(ctx))} is checked before it changes hands`);

  const tabs = [
    { value: 'pending', label: 'Waiting', active: true, count: ctx.counts.pending_auth },
    { value: 'in_progress', label: 'In progress' },
    { value: 'passed', label: 'Passed' },
    { value: 'failed', label: 'Failed' },
    { value: 'all', label: 'Everything' },
  ];

  const root = setContent(toolbar({ tabs, placeholder: 'Title or reference' }) + '<div data-list></div>');

  const load = async ({ filter, query }) => {
    const host = root.querySelector('[data-list]');
    host.innerHTML = '<div class="sc-skeleton" style="height:180px"></div>';

    let q = sb.from('listings')
      .select(`id, reference, title, price, authentication_status, created_at, custom_brand,
               brand:brands(name), seller:profiles!listings_seller_id_fkey(username, full_name),
               images:listing_images(storage_path, slot),
               checks:authentication_checks(id, status, verdict, notes, certificate_no, completed_at)`)
      .neq('authentication_status', 'not_required')
      .order('created_at', { ascending: false }).limit(100);

    if (filter !== 'all') q = q.eq('authentication_status', filter);
    if (query) q = q.or(`title.ilike.%${query}%,reference.ilike.%${query}%`);

    const { data } = await q;

    host.innerHTML = table({
      columns: [{ label: 'Piece' }, { label: 'Seller' }, { label: 'Value', align: 'right' },
                { label: 'Status' }, { label: 'Certificate' }, { label: '' }],
      emptyTitle: 'Nothing waiting',
      emptyText: 'Items appear here once they are priced above the authentication threshold.',
      rows: (data || []).map(l => {
        const front = l.images?.find(i => i.slot === 'front') || l.images?.[0];
        const check = l.checks?.[0];
        return `<tr>
          <td><div class="sc-row-tight">
            <img class="sc-thumb" src="${front ? publicUrl('listing-photos', front.storage_path) : ''}" alt="" loading="lazy">
            <div><p style="font-weight:500">${esc(l.title)}</p>
              <p class="sc-xs sc-muted">${esc(l.reference || '')} · ${esc(l.brand?.name || l.custom_brand || '—')}</p></div>
          </div></td>
          <td class="sc-sm">${esc(l.seller?.username || l.seller?.full_name || '—')}</td>
          <td class="sc-cell-num sc-money">${money(l.price, cur(ctx))}</td>
          <td>${badge(l.authentication_status)}</td>
          <td class="sc-xs sc-muted">${esc(check?.certificate_no || '—')}</td>
          <td class="sc-cell-actions">
            <button class="sc-btn sc-btn-ghost sc-btn-xs" data-check="${l.id}">
              ${l.authentication_status === 'pending' ? 'Start check' : 'Open'}</button>
          </td></tr>`;
      }),
    });

    host.querySelectorAll('[data-check]').forEach(b =>
      b.addEventListener('click', () => runCheck(b.dataset.check, ctx, () => load({ filter, query }))));
  };

  wireToolbar(root, load);
  await load({ filter: 'pending', query: '' });
}

const CHECKLIST = [
  ['stitching', 'Stitching is even and correct for the house'],
  ['hardware', 'Hardware weight, finish and engraving'],
  ['serial', 'Serial or date code present and consistent'],
  ['label', 'Interior label font and placement'],
  ['leather', 'Material grain and smell'],
  ['lining', 'Lining fabric and construction'],
  ['dustbag', 'Dust bag, box or papers included'],
  ['condition', 'Condition matches what the seller described'],
];

async function runCheck(listingId, ctx, reload) {
  const { data: l } = await sb.from('listings')
    .select(`id, title, reference, price, description, condition_code, custom_brand,
             brand:brands(name), images:listing_images(storage_path, slot),
             seller:profiles!listings_seller_id_fkey(username, full_name)`)
    .eq('id', listingId).single();
  if (!l) return;

  await sb.from('listings').update({ authentication_status: 'in_progress' }).eq('id', listingId);

  const result = await modal({
    size: 'lg',
    title: `Authenticate: ${l.title}`,
    body: `
      <p class="sc-sm sc-muted">${esc(l.reference || '')} · ${esc(l.brand?.name || l.custom_brand || '—')} ·
        ${money(l.price, cur(ctx))} · from ${esc(l.seller?.username || l.seller?.full_name || '—')}</p>

      <div class="sc-photos" style="margin-top:14px">
        ${(l.images || []).map(p => p.slot === 'video' || /\.(mp4|mov|webm)$/i.test(p.storage_path)
          ? `<video src="${esc(publicUrl('listing-photos', p.storage_path))}" controls playsinline preload="metadata"
               style="width:100%;border-radius:10px;background:#101114"></video>`
          : `<a href="${publicUrl('listing-photos', p.storage_path)}" target="_blank" rel="noopener">
          <img src="${publicUrl('listing-photos', p.storage_path)}" alt="${esc(p.slot || '')}" loading="lazy"></a>`).join('')}
      </div>

      ${l.description ? `<p class="sc-lead" style="margin-top:14px">${esc(l.description)}</p>` : ''}

      <form style="margin-top:18px">
        <p class="sc-eyebrow">Checklist</p>
        <div style="margin-top:10px;display:grid;gap:7px">
          ${CHECKLIST.map(([key, label]) => `
            <label class="sc-check"><input type="checkbox" name="${key}" value="1">
              <span class="sc-sm">${esc(label)}</span></label>`).join('')}
        </div>
        <div class="sc-field" style="margin-top:16px">
          <label class="sc-label">Condition as received</label>
          <input class="sc-input" name="condition_confirmed"
                 placeholder="Matches the listing, or describe the difference">
        </div>
        <div class="sc-field" style="margin-top:12px">
          <label class="sc-label">Notes</label>
          <textarea class="sc-textarea" name="notes"
            placeholder="What you checked, and anything the buyer should know."></textarea>
        </div>
      </form>`,
    actions: [
      { label: 'Save for later', value: 'later' },
      { label: 'Inconclusive', value: 'inconclusive' },
      { label: 'Counterfeit', value: 'counterfeit', kind: 'sc-btn-danger' },
      { label: 'Authentic', value: 'authentic', kind: 'sc-btn-primary' },
    ],
  });

  if (!result || result.value === 'later') return reload?.();

  const checklist = Object.fromEntries(
    CHECKLIST.map(([key]) => [key, result.values[key] === '1']));

  await adminAction(() => sb.rpc('admin_record_authentication', {
    p_listing: listingId,
    p_verdict: result.value,
    p_checklist: checklist,
    p_notes: [result.values.condition_confirmed, result.values.notes].filter(Boolean).join(' — '),
  }), result.value === 'authentic'
      ? 'Marked authentic. Certificate issued.'
      : result.value === 'counterfeit'
      ? 'Marked counterfeit. The listing has come down.'
      : 'Recorded as inconclusive.');

  reload?.();
}

// ---------------------------------------------------------------------------
// TAXONOMY — categories, brands, conditions, sizes
// ---------------------------------------------------------------------------
async function taxonomy({ setContent, setTitle, setActions }) {
  setTitle('Categories & brands', 'The lists sellers choose from when they list a piece');

  const render = async () => {
    const [cats, brands, conds, sizes] = await Promise.all([
      sb.from('categories').select('*').order('sort_order'),
      sb.from('brands').select('*').order('sort_order'),
      sb.from('conditions').select('*').order('sort_order'),
      sb.from('sizes').select('*, category:categories(name)').order('sort_order'),
    ]);

    const list = (title, rows, kind, cols) => `
      <div class="sc-card sc-card-flush">
        <div class="sc-between" style="padding:16px 18px 10px">
          <h2 class="sc-h2">${title}</h2>
          <button class="sc-btn sc-btn-ghost sc-btn-xs" data-add="${kind}">Add</button>
        </div>
        <div class="sc-table-wrap" style="border:0;border-radius:0"><table class="sc-table">
          <tbody>${(rows.data || []).map(r => `<tr>
            <td><span style="font-weight:500">${esc(r.name || r.label)}</span>
              ${cols ? `<span class="sc-xs sc-muted"> · ${esc(cols(r))}</span>` : ''}</td>
            <td>${r.is_active === false ? '<span class="sc-badge">Hidden</span>' : '<span class="sc-badge sc-badge-ok">Visible</span>'}</td>
            <td class="sc-cell-actions">
              <button class="sc-btn sc-btn-ghost sc-btn-xs" data-toggle="${kind}:${r.id}:${r.is_active}">
                ${r.is_active === false ? 'Show' : 'Hide'}</button>
              <button class="sc-btn sc-btn-ghost sc-btn-xs" data-rename="${kind}:${r.id}">Rename</button>
            </td></tr>`).join('') || '<tr><td class="sc-sm sc-muted">Nothing yet.</td></tr>'}
          </tbody></table></div>
      </div>`;

    const root = setContent(`<div class="sc-grid sc-grid-2" style="align-items:start">
      ${list('Categories', cats, 'categories')}
      ${list('Brands', brands, 'brands', r => r.tier || '')}
      ${list('Conditions', conds, 'conditions')}
      ${list('Sizes', sizes, 'sizes', r => r.category?.name || 'All')}
    </div>`);

    root.querySelectorAll('[data-toggle]').forEach(b => b.addEventListener('click', async () => {
      const [kind, id, active] = b.dataset.toggle.split(':');
      await adminAction(() => sb.from(kind).update({ is_active: active !== 'true' }).eq('id', id), 'Updated.');
      render();
    }));

    root.querySelectorAll('[data-rename]').forEach(b => b.addEventListener('click', async () => {
      const [kind, id] = b.dataset.rename.split(':');
      const field = kind === 'conditions' || kind === 'sizes' ? 'label' : 'name';
      const value = await askText('New name', '');
      if (!value) return;
      await adminAction(() => sb.from(kind).update({ [field]: value }).eq('id', id), 'Renamed.');
      render();
    }));

    root.querySelectorAll('[data-add]').forEach(b => b.addEventListener('click', async () => {
      const kind = b.dataset.add;
      const value = await askText(`Add to ${kind}`, 'Name');
      if (!value) return;
      const slug = value.toLowerCase().replace(/[^\w]+/g, '-').replace(/^-|-$/g, '');
      const payload = kind === 'conditions' ? { code: slug, label: value }
        : kind === 'sizes' ? { label: value }
        : { slug, name: value };
      await adminAction(() => sb.from(kind).insert(payload), 'Added.');
      render();
    }));
  };

  await render();
}

// ---------------------------------------------------------------------------
// Small prompt helpers shared across sections
// ---------------------------------------------------------------------------
export async function askReason(title, presets = []) {
  const result = await modal({
    title,
    body: `<form class="sc-stack">
      ${presets.length ? `<div class="sc-choice">
        ${presets.map((p, i) => `<label><input type="radio" name="preset" value="${esc(p)}" ${i === 0 ? 'checked' : ''}>
          <span class="sc-choice-body"><span class="sc-choice-title">${esc(p)}</span></span></label>`).join('')}
        <label><input type="radio" name="preset" value="">
          <span class="sc-choice-body"><span class="sc-choice-title">Something else</span></span></label>
      </div>` : ''}
      <div class="sc-field"><label class="sc-label">Anything to add?</label>
        <textarea class="sc-textarea" name="extra" placeholder="The seller sees this."></textarea></div>
    </form>`,
    actions: [{ label: 'Cancel', value: false }, { label: 'Confirm', value: true, kind: 'sc-btn-primary' }],
  });
  if (result?.value !== true) return null;
  return [result.values.preset, result.values.extra].filter(Boolean).join(' — ') || 'No reason given';
}

export async function askText(title, placeholder = '', multiline = true) {
  const result = await modal({
    title,
    body: `<form><div class="sc-field">${multiline
      ? `<textarea class="sc-textarea" name="value" placeholder="${esc(placeholder)}" autofocus></textarea>`
      : `<input class="sc-input" name="value" placeholder="${esc(placeholder)}" autofocus>`}</div></form>`,
    actions: [{ label: 'Cancel', value: false }, { label: 'Save', value: true, kind: 'sc-btn-primary' }],
  });
  return result?.value === true ? (result.values.value?.trim() || null) : null;
}

export default { dashboard, analytics, listings, verification, taxonomy };
