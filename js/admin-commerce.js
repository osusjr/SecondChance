// ============================================================================
// Admin sections: members, sellers, orders, returns & disputes,
// payments, payouts, reports & complaints
// ============================================================================

import {
  sb, session, money, num, date, ago, esc, badge, titleCase, initials,
  toast, modal, confirmAction, empty, downloadCsv, errorMessage, signedUrl,
} from './sc-core.js';
import { toolbar, table, wireToolbar, adminAction } from './sc-admin.js';
import { askReason, askText } from './admin-core.js';

const cur = ctx => ctx.settings?.currency || 'JOD';

// ---------------------------------------------------------------------------
// 2. USER MANAGEMENT
// ---------------------------------------------------------------------------
async function users({ setContent, setTitle, setActions, ctx }) {
  setTitle('Members', 'Everyone with an account, buyers and sellers');
  setActions('<button class="sc-btn sc-btn-ghost sc-btn-sm" data-export>Export</button>');

  const tabs = [
    { value: 'all', label: 'Everyone', active: true },
    { value: 'buyers', label: 'Buyers' },
    { value: 'sellers', label: 'Sellers' },
    { value: 'pending', label: 'Seller applications', count: ctx.counts.pending_sellers },
    { value: 'suspended', label: 'Suspended' },
  ];

  const root = setContent(toolbar({ tabs, placeholder: 'Name, username or city' }) + '<div data-list></div>');
  let cache = [];

  const load = async ({ filter, query }) => {
    const host = root.querySelector('[data-list]');
    host.innerHTML = '<div class="sc-skeleton" style="height:200px"></div>';

    if (filter === 'pending') return loadApplications(host, ctx, () => load({ filter, query }));

    let q = sb.from('profiles')
      .select('id, username, full_name, phone, city, area, is_seller, seller_status, account_status, email_verified, phone_verified, identity_verified, created_at, last_seen_at')
      .order('created_at', { ascending: false }).limit(150);

    if (filter === 'sellers') q = q.eq('seller_status', 'approved');
    if (filter === 'buyers') q = q.neq('seller_status', 'approved');
    if (filter === 'suspended') q = q.in('account_status', ['suspended', 'blocked']);
    if (query) q = q.or(`full_name.ilike.%${query}%,username.ilike.%${query}%,city.ilike.%${query}%`);

    const { data } = await q;
    cache = data || [];

    host.innerHTML = table({
      columns: [{ label: 'Member' }, { label: 'Location' }, { label: 'Type' },
                { label: 'Verified' }, { label: 'Status' }, { label: 'Joined' }, { label: '' }],
      emptyTitle: 'No members match',
      rows: cache.map(u => `<tr>
        <td><div class="sc-row-tight">
          <span class="sc-avatar">${esc(initials(u.full_name || u.username))}</span>
          <div><p style="font-weight:500">${esc(u.full_name || '—')}</p>
            <p class="sc-xs sc-muted">${esc(u.username ? '@' + u.username : '')}</p></div>
        </div></td>
        <td class="sc-sm">${esc([u.area, u.city].filter(Boolean).join(', ') || '—')}</td>
        <td>${u.seller_status === 'approved'
          ? '<span class="sc-badge sc-badge-accent">Seller</span>'
          : '<span class="sc-badge">Buyer</span>'}</td>
        <td class="sc-xs sc-muted">
          ${u.email_verified ? 'Email' : ''}${u.phone_verified ? ' · Phone' : ''}${u.identity_verified ? ' · ID' : ''}
          ${!u.email_verified && !u.phone_verified ? 'None' : ''}</td>
        <td>${badge(u.account_status)}</td>
        <td class="sc-sm sc-muted">${date(u.created_at)}</td>
        <td class="sc-cell-actions">
          <button class="sc-btn sc-btn-ghost sc-btn-xs" data-user="${u.id}">Open</button></td>
      </tr>`),
    });

    host.querySelectorAll('[data-user]').forEach(b =>
      b.addEventListener('click', () => openUser(b.dataset.user, ctx, () => load({ filter, query }))));
  };

  wireToolbar(root, load);
  await load({ filter: 'all', query: '' });

  document.querySelector('[data-export]')?.addEventListener('click', () =>
    downloadCsv('secondchance-members.csv', cache.map(u => ({
      name: u.full_name, username: u.username, city: u.city,
      seller_status: u.seller_status, account_status: u.account_status, joined: u.created_at,
    }))));
}

async function loadApplications(host, ctx, reload) {
  const { data } = await sb.from('seller_applications')
    .select('*, user:profiles!seller_applications_user_id_fkey(id, username, full_name, phone, city, created_at)')
    .eq('status', 'pending').order('created_at', { ascending: false });

  host.innerHTML = table({
    columns: [{ label: 'Applicant' }, { label: 'Legal name' }, { label: 'Payout' },
              { label: 'Submitted' }, { label: '' }],
    emptyTitle: 'No applications waiting',
    emptyText: 'Every seller application has had a decision.',
    rows: (data || []).map(a => `<tr>
      <td><p style="font-weight:500">${esc(a.user?.username || a.user?.full_name || '—')}</p>
        <p class="sc-xs sc-muted">${esc(a.user?.city || '')} ${esc(a.user?.phone || '')}</p></td>
      <td class="sc-sm">${esc(a.legal_name || '—')}</td>
      <td class="sc-sm">${esc(titleCase(a.payout_method || '—'))}</td>
      <td class="sc-sm sc-muted">${date(a.created_at)}</td>
      <td class="sc-cell-actions">
        <button class="sc-btn sc-btn-ghost sc-btn-xs" data-app="${a.id}">Review</button></td>
    </tr>`),
  });

  host.querySelectorAll('[data-app]').forEach(b => b.addEventListener('click', async () => {
    const app = data.find(x => x.id === b.dataset.app);
    const idUrl = app.id_document_path ? await signedUrl('kyc-documents', app.id_document_path) : '';

    const result = await modal({
      title: 'Seller application',
      body: `<dl class="sc-kv">
          <dt>Member</dt><dd>${esc(app.user?.username || app.user?.full_name || '—')}</dd>
          <dt>Legal name</dt><dd>${esc(app.legal_name || '—')}</dd>
          <dt>ID number</dt><dd>${esc(app.national_id || '—')}</dd>
          <dt>Payout method</dt><dd>${esc(titleCase(app.payout_method || '—'))}</dd>
          <dt>IBAN / CliQ</dt><dd>${esc(app.iban || app.cliq_alias || '—')}</dd>
          <dt>Pickup address</dt><dd>${esc(app.pickup_address || '—')}</dd>
          <dt>Submitted</dt><dd>${date(app.created_at, true)}</dd>
        </dl>
        ${idUrl ? `<p style="margin-top:14px"><a class="sc-btn sc-btn-ghost sc-btn-sm"
          href="${esc(idUrl)}" target="_blank" rel="noopener">View ID document</a></p>` : ''}
        <div class="sc-note sc-note-warn" style="margin-top:16px">
          Check the ID matches the legal name, and that the payout details belong to the same person.
        </div>`,
      actions: [
        { label: 'Close', value: 'close' },
        { label: 'Reject', value: 'reject', kind: 'sc-btn-danger' },
        { label: 'Approve seller', value: 'approve', kind: 'sc-btn-primary' },
      ],
    });

    if (result?.value === 'approve') {
      await adminAction(() => sb.rpc('admin_review_seller',
        { p_application: app.id, p_approve: true }), 'Seller approved.');
      reload();
    }
    if (result?.value === 'reject') {
      const reason = await askReason('Why is this being declined?', [
        'ID document is unclear', 'Name does not match the ID',
        'Payout details do not match the applicant', 'Incomplete application',
      ]);
      if (!reason) return;
      await adminAction(() => sb.rpc('admin_review_seller',
        { p_application: app.id, p_approve: false, p_reason: reason }), 'Application declined.');
      reload();
    }
  }));
}

async function openUser(id, ctx, reload) {
  const [{ data: u }, { data: stats }] = await Promise.all([
    sb.from('profiles').select('*').eq('id', id).single(),
    sb.rpc('admin_seller_summary', { p_seller: id }),
  ]);
  if (!u) return;

  const [{ data: orders }, { data: listings }, { data: reportsAgainst }] = await Promise.all([
    sb.from('orders').select('order_no, status, total, created_at')
      .or(`buyer_id.eq.${id},seller_id.eq.${id}`).order('created_at', { ascending: false }).limit(8),
    sb.from('listings').select('id, title, status, price').eq('seller_id', id)
      .order('created_at', { ascending: false }).limit(8),
    sb.from('reports').select('id, category, status, created_at').eq('target_user_id', id).limit(8),
  ]);

  const canManage = session.can('users.suspend');

  const result = await modal({
    size: 'lg',
    title: u.full_name || u.username || 'Member',
    body: `
      <div class="sc-row-tight" style="margin-bottom:14px">
        ${badge(u.account_status)}
        ${u.seller_status !== 'none' ? badge(u.seller_status, 'Seller: ' + titleCase(u.seller_status)) : ''}
        ${u.identity_verified ? '<span class="sc-badge sc-badge-ok">ID verified</span>' : ''}
      </div>

      <dl class="sc-kv">
        <dt>Username</dt><dd>${esc(u.username || '—')}</dd>
        <dt>Phone</dt><dd>${esc(u.phone || '—')} ${u.phone_verified ? '<span class="sc-badge sc-badge-ok">Verified</span>' : ''}</dd>
        <dt>Location</dt><dd>${esc([u.area, u.city].filter(Boolean).join(', ') || '—')}</dd>
        <dt>Address</dt><dd>${esc(u.address_line || '—')}</dd>
        <dt>Joined</dt><dd>${date(u.created_at, true)}</dd>
        <dt>Last seen</dt><dd>${u.last_seen_at ? ago(u.last_seen_at) : '—'}</dd>
        ${u.suspended_reason ? `<dt>Suspension reason</dt><dd>${esc(u.suspended_reason)}</dd>` : ''}
      </dl>

      <div class="sc-grid sc-grid-4" style="margin-top:18px">
        <div class="sc-stat"><span class="sc-stat-label">Listed</span>
          <span class="sc-stat-value">${num(stats?.listed_total)}</span></div>
        <div class="sc-stat"><span class="sc-stat-label">Sold</span>
          <span class="sc-stat-value">${num(stats?.sold)}</span></div>
        <div class="sc-stat"><span class="sc-stat-label">Earned</span>
          <span class="sc-stat-value">${money(stats?.earnings, cur(ctx))}</span></div>
        <div class="sc-stat"><span class="sc-stat-label">Reports</span>
          <span class="sc-stat-value" style="${stats?.reports ? 'color:var(--sc-danger)' : ''}">${num(stats?.reports)}</span></div>
      </div>

      ${listings?.length ? `<div style="margin-top:18px"><p class="sc-eyebrow">Recent listings</p>
        ${listings.map(l => `<div class="sc-between" style="padding:7px 0;border-bottom:1px solid var(--color-line)">
          <span class="sc-sm sc-truncate">${esc(l.title)}</span>
          <span class="sc-row-tight">${badge(l.status)}<span class="sc-money sc-sm">${money(l.price, cur(ctx))}</span></span>
        </div>`).join('')}</div>` : ''}

      ${orders?.length ? `<div style="margin-top:18px"><p class="sc-eyebrow">Recent orders</p>
        ${orders.map(o => `<div class="sc-between" style="padding:7px 0;border-bottom:1px solid var(--color-line)">
          <span class="sc-sm">${esc(o.order_no)} · ${date(o.created_at)}</span>
          <span class="sc-row-tight">${badge(o.status)}<span class="sc-money sc-sm">${money(o.total, cur(ctx))}</span></span>
        </div>`).join('')}</div>` : ''}

      ${reportsAgainst?.length ? `<div class="sc-note sc-note-warn" style="margin-top:16px">
        <strong>${reportsAgainst.length} report${reportsAgainst.length === 1 ? '' : 's'} against this member.</strong>
        ${reportsAgainst.map(r => `<br>${esc(titleCase(r.category))} — ${esc(titleCase(r.status))}, ${date(r.created_at)}`).join('')}
      </div>` : ''}`,
    actions: canManage ? [
      { label: 'Close', value: 'close' },
      ...(u.seller_status === 'approved'
        ? [{ label: 'Revoke seller status', value: 'revoke' }] : []),
      ...(u.account_status === 'active'
        ? [{ label: 'Suspend', value: 'suspend' },
           { label: 'Block', value: 'block', kind: 'sc-btn-danger' }]
        : [{ label: 'Reinstate', value: 'reinstate', kind: 'sc-btn-primary' }]),
    ] : [{ label: 'Close', value: 'close' }],
  });

  if (!result || result.value === 'close') return;

  if (result.value === 'reinstate') {
    await adminAction(() => sb.rpc('admin_set_user_status',
      { p_user: id, p_status: 'active', p_reason: null }), 'Member reinstated.');
  }

  if (result.value === 'suspend' || result.value === 'block') {
    const reason = await askReason(
      result.value === 'block' ? 'Why is this account being blocked?' : 'Why is this account being suspended?',
      ['Repeated policy breaches', 'Counterfeit items', 'Fraud or payment abuse',
       'Harassment of other members', 'Failed identity checks']);
    if (!reason) return;
    if (!await confirmAction(
      result.value === 'block' ? 'Block this member?' : 'Suspend this member?',
      'Their live listings come down straight away and they cannot sign in.',
      titleCase(result.value), true)) return;

    await adminAction(() => sb.rpc('admin_set_user_status',
      { p_user: id, p_status: result.value === 'block' ? 'blocked' : 'suspended', p_reason: reason }),
      result.value === 'block' ? 'Member blocked.' : 'Member suspended.');
  }

  if (result.value === 'revoke') {
    const reason = await askText('Why is seller status being revoked?');
    if (!reason) return;
    await adminAction(() => sb.from('profiles')
      .update({ seller_status: 'suspended', is_seller: false }).eq('id', id), 'Seller status revoked.');
  }

  reload?.();
}

// ---------------------------------------------------------------------------
// 7. SELLER MANAGEMENT
// ---------------------------------------------------------------------------
async function sellers({ setContent, setTitle, setActions, ctx }) {
  setTitle('Sellers', 'Performance, earnings and standing');
  setActions('<button class="sc-btn sc-btn-ghost sc-btn-sm" data-export>Export</button>');

  const root = setContent(toolbar({
    tabs: [
      { value: 'approved', label: 'Approved', active: true },
      { value: 'pending', label: 'Pending', count: ctx.counts.pending_sellers },
      { value: 'suspended', label: 'Suspended' },
      { value: 'all', label: 'Everyone selling' },
    ],
    placeholder: 'Name or username',
  }) + '<div data-list></div>');

  let cache = [];

  const load = async ({ filter, query }) => {
    const host = root.querySelector('[data-list]');
    host.innerHTML = '<div class="sc-skeleton" style="height:200px"></div>';

    let q = sb.from('profiles')
      .select('id, username, full_name, city, seller_status, account_status, created_at')
      .neq('seller_status', 'none').order('created_at', { ascending: false }).limit(100);
    if (filter !== 'all') q = q.eq('seller_status', filter);
    if (query) q = q.or(`full_name.ilike.%${query}%,username.ilike.%${query}%`);

    const { data } = await q;
    const withStats = await Promise.all((data || []).map(async s => ({
      ...s, stats: (await sb.rpc('admin_seller_summary', { p_seller: s.id })).data || {},
    })));
    cache = withStats;

    host.innerHTML = table({
      columns: [{ label: 'Seller' }, { label: 'Live' }, { label: 'Sold' },
                { label: 'Earnings', align: 'right' }, { label: 'Commission', align: 'right' },
                { label: 'Owed', align: 'right' }, { label: 'Standing' }, { label: '' }],
      emptyTitle: 'No sellers here yet',
      rows: withStats.map(s => `<tr>
        <td><div class="sc-row-tight">
          <span class="sc-avatar">${esc(initials(s.full_name || s.username))}</span>
          <div><p style="font-weight:500">${esc(s.username || s.full_name || '—')}</p>
            <p class="sc-xs sc-muted">${esc(s.city || '')}</p></div></div></td>
        <td class="sc-cell-num">${num(s.stats.listed_active)}</td>
        <td class="sc-cell-num">${num(s.stats.sold)}</td>
        <td class="sc-cell-num sc-money">${money(s.stats.earnings, cur(ctx))}</td>
        <td class="sc-cell-num sc-money" style="color:var(--color-accent)">${money(s.stats.commission, cur(ctx))}</td>
        <td class="sc-cell-num sc-money">${money(s.stats.pending_payout, cur(ctx))}</td>
        <td>${badge(s.seller_status)}
          ${s.stats.reports ? `<br><span class="sc-badge sc-badge-danger" style="margin-top:3px">${s.stats.reports} report${s.stats.reports === 1 ? '' : 's'}</span>` : ''}</td>
        <td class="sc-cell-actions">
          <button class="sc-btn sc-btn-ghost sc-btn-xs" data-user="${s.id}">Open</button></td>
      </tr>`),
    });

    host.querySelectorAll('[data-user]').forEach(b =>
      b.addEventListener('click', () => openUser(b.dataset.user, ctx, () => load({ filter, query }))));
  };

  wireToolbar(root, load);
  await load({ filter: 'approved', query: '' });

  document.querySelector('[data-export]')?.addEventListener('click', () =>
    downloadCsv('secondchance-sellers.csv', cache.map(s => ({
      seller: s.username || s.full_name, city: s.city, status: s.seller_status,
      live: s.stats.listed_active, sold: s.stats.sold,
      earnings: s.stats.earnings, commission: s.stats.commission, owed: s.stats.pending_payout,
    }))));
}

// ---------------------------------------------------------------------------
// 5. ORDERS & SALES
// ---------------------------------------------------------------------------
async function orders({ setContent, setTitle, setActions, ctx }) {
  setTitle('Orders', 'Every sale, its money and where the piece is');
  setActions('<button class="sc-btn sc-btn-ghost sc-btn-sm" data-export>Export</button>');

  const root = setContent(toolbar({
    tabs: [
      { value: 'all', label: 'All', active: true },
      { value: 'placed', label: 'New' },
      { value: 'confirmed', label: 'Confirmed' },
      { value: 'authenticating', label: 'In authentication' },
      { value: 'ready', label: 'Ready for handover' },
      { value: 'accepted', label: 'Accepted' },
      { value: 'cancelled', label: 'Cancelled' },
    ],
    placeholder: 'Order number',
  }) + '<div data-list></div>');

  let cache = [];

  const load = async ({ filter, query }) => {
    const host = root.querySelector('[data-list]');
    host.innerHTML = '<div class="sc-skeleton" style="height:200px"></div>';

    let q = sb.from('orders')
      .select(`id, order_no, status, payment_status, payment_method,
               item_price, total, commission_amount, seller_amount, created_at,
               listing:listings(title), buyer:profiles!orders_buyer_id_fkey(username, full_name),
               seller:profiles!orders_seller_id_fkey(username, full_name)`)
      .order('created_at', { ascending: false }).limit(120);
    if (filter !== 'all') q = q.eq('status', filter);
    if (query) q = q.ilike('order_no', `%${query}%`);

    const { data } = await q;
    cache = data || [];

    host.innerHTML = table({
      columns: [{ label: 'Order' }, { label: 'Piece' }, { label: 'Buyer' }, { label: 'Seller' },
                { label: 'Payment' }, { label: 'Status' }, { label: 'Total', align: 'right' }, { label: '' }],
      emptyTitle: 'No orders match',
      rows: cache.map(o => `<tr>
        <td><p class="sc-sm" style="font-weight:500">${esc(o.order_no)}</p>
          <p class="sc-xs sc-muted">${date(o.created_at)}</p></td>
        <td class="sc-sm sc-truncate" style="max-width:180px">${esc(o.listing?.title || '—')}</td>
        <td class="sc-sm">${esc(o.buyer?.username || o.buyer?.full_name || '—')}</td>
        <td class="sc-sm">${esc(o.seller?.username || o.seller?.full_name || '—')}</td>
        <td>${badge(o.payment_status)}<br><span class="sc-xs sc-muted">${esc(titleCase(o.payment_method))}</span></td>
        <td>${badge(o.status)}</td>
        <td class="sc-cell-num sc-money">${money(o.total, cur(ctx))}</td>
        <td class="sc-cell-actions">
          <button class="sc-btn sc-btn-ghost sc-btn-xs" data-order="${o.id}">Open</button></td>
      </tr>`),
    });

    host.querySelectorAll('[data-order]').forEach(b =>
      b.addEventListener('click', () => openOrder(b.dataset.order, ctx, () => load({ filter, query }))));
  };

  wireToolbar(root, load);
  await load({ filter: 'all', query: '' });

  document.querySelector('[data-export]')?.addEventListener('click', () =>
    downloadCsv('secondchance-orders.csv', cache.map(o => ({
      order_no: o.order_no, date: o.created_at, item: o.listing?.title,
      buyer: o.buyer?.username, seller: o.seller?.username,
      status: o.status, payment: o.payment_status, method: o.payment_method,
      item_price: o.item_price, total: o.total,
      commission: o.commission_amount, seller_amount: o.seller_amount,
    }))));
}

const ORDER_FLOW = ['placed', 'confirmed', 'authenticating', 'ready', 'accepted'];

async function openOrder(id, ctx, reload) {
  const { data: o } = await sb.from('orders')
    .select(`*, listing:listings(id, title, reference),
             buyer:profiles!orders_buyer_id_fkey(username, full_name, phone),
             seller:profiles!orders_seller_id_fkey(username, full_name, phone),
             events:order_events(status, note, created_at)`)
    .eq('id', id).single();
  if (!o) return;

  const canManage = session.can('orders.manage');
  const c = cur(ctx);

  const result = await modal({
    size: 'lg',
    title: `Order ${o.order_no}`,
    body: `
      <div class="sc-row-tight" style="margin-bottom:16px">
        ${badge(o.status)} ${badge(o.payment_status, 'Payment: ' + titleCase(o.payment_status))}
              </div>

      <div class="sc-grid sc-grid-2" style="align-items:start">
        <div>
          <p class="sc-eyebrow">The piece</p>
          <p class="sc-h3" style="margin-top:5px">${esc(o.listing?.title || 'Removed')}</p>
          <p class="sc-xs sc-muted">${esc(o.listing?.reference || '')}</p>

          <p class="sc-eyebrow" style="margin-top:16px">People</p>
          <dl class="sc-kv" style="margin-top:5px">
            <dt>Buyer</dt><dd>${esc(o.buyer?.username || o.buyer?.full_name || '—')}<br>
              <span class="sc-xs sc-muted">${esc(o.buyer?.phone || '')}</span></dd>
            <dt>Seller</dt><dd>${esc(o.seller?.username || o.seller?.full_name || '—')}<br>
              <span class="sc-xs sc-muted">${esc(o.seller?.phone || '')}</span></dd>
          </dl>

          <p class="sc-eyebrow" style="margin-top:16px">Contact</p>
          <dl class="sc-kv" style="margin-top:5px">
            <dt>Name</dt><dd>${esc(o.contact_name || '—')}</dd>
            <dt>Phone</dt><dd>${esc(o.contact_phone || '—')}</dd>
            <dt>Note</dt><dd>${esc(o.contact_note || '—')}</dd>
          </dl>
        </div>

        <div>
          <div class="sc-panel">
            <p class="sc-eyebrow">Money</p>
            <dl class="sc-kv" style="margin-top:10px">
              <dt>Item</dt><dd class="sc-money">${money(o.item_price, c)}</dd>
              <dt>Buyer Protection</dt><dd class="sc-money">${money(o.buyer_protection_fee, c)}</dd>
                ${Number(o.discount_amount) ? `<dt>Discount</dt><dd class="sc-money">− ${money(o.discount_amount, c)}</dd>` : ''}
              <dt>Buyer paid</dt><dd class="sc-money-lg">${money(o.total, c)}</dd>
            </dl>
            <hr class="sc-divider" style="margin:14px 0">
            <dl class="sc-kv">
              <dt>Commission (${(Number(o.commission_rate) * 100).toFixed(0)}%)</dt>
              <dd class="sc-money" style="color:var(--color-accent)">${money(o.commission_amount, c)}</dd>
              <dt>Seller receives</dt><dd class="sc-money">${money(o.seller_amount, c)}</dd>
            </dl>
          </div>

          <p class="sc-eyebrow" style="margin-top:16px">Timeline</p>
          <div style="margin-top:8px">
            ${(o.events || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
              .map(e => `<p class="sc-xs" style="padding:5px 0;border-bottom:1px solid var(--color-line)">
                <strong>${esc(titleCase(e.status))}</strong>
                <span class="sc-muted"> · ${date(e.created_at, true)}</span>
                ${e.note ? `<br><span class="sc-muted">${esc(e.note)}</span>` : ''}</p>`).join('')
              || '<p class="sc-xs sc-muted">No events yet.</p>'}
          </div>
        </div>
      </div>

      ${canManage ? `<form style="margin-top:18px">
        <div class="sc-grid sc-grid-2">
          <div class="sc-field"><label class="sc-label">Move to</label>
            <select class="sc-select" name="status">
              ${ORDER_FLOW.concat(['cancelled', 'returned', 'refunded']).map(s =>
                `<option value="${s}" ${s === o.status ? 'selected' : ''}>${titleCase(s)}</option>`).join('')}
            </select></div>
        </div>
        <div class="sc-field" style="margin-top:12px"><label class="sc-label">Payment status</label>
          <select class="sc-select" name="payment_status">
            ${['pending', 'authorized', 'paid', 'failed', 'refunded', 'partially_refunded'].map(s =>
              `<option value="${s}" ${s === o.payment_status ? 'selected' : ''}>${titleCase(s)}</option>`).join('')}
          </select></div>
      </form>` : ''}`,
    actions: canManage
      ? [{ label: 'Close', value: false }, { label: 'Save changes', value: true, kind: 'sc-btn-primary' }]
      : [{ label: 'Close', value: false }],
  });

  if (result?.value !== true) return;
  const v = result.values;

  await adminAction(() => sb.from('orders').update({
    status: v.status,
    payment_status: v.payment_status,
  }).eq('id', id), 'Order updated.');

  reload?.();
}

// ---------------------------------------------------------------------------
// 5b. RETURNS & DISPUTES
// ---------------------------------------------------------------------------
async function returns({ setContent, setTitle, ctx }) {
  setTitle('Returns & disputes', 'Where an order has gone wrong');

  const root = setContent(toolbar({
    tabs: [
      { value: 'returns', label: 'Returns', active: true, count: ctx.counts.open_returns },
      { value: 'disputes', label: 'Disputes', count: ctx.counts.open_disputes },
      { value: 'cancellations', label: 'Cancellation requests' },
    ],
    search: false,
  }) + '<div data-list></div>');

  const load = async ({ filter }) => {
    const host = root.querySelector('[data-list]');
    host.innerHTML = '<div class="sc-skeleton" style="height:180px"></div>';

    if (filter === 'returns') {
      const { data } = await sb.from('returns')
        .select('*, order:orders(order_no, total, listing:listings(title)), buyer:profiles!returns_buyer_id_fkey(username, full_name)')
        .order('created_at', { ascending: false }).limit(80);

      host.innerHTML = table({
        columns: [{ label: 'Order' }, { label: 'Buyer' }, { label: 'Reason' },
                  { label: 'Status' }, { label: 'Opened' }, { label: '' }],
        emptyTitle: 'No returns open',
        rows: (data || []).map(r => `<tr>
          <td><p class="sc-sm" style="font-weight:500">${esc(r.order?.order_no || '—')}</p>
            <p class="sc-xs sc-muted sc-truncate" style="max-width:180px">${esc(r.order?.listing?.title || '')}</p></td>
          <td class="sc-sm">${esc(r.buyer?.username || r.buyer?.full_name || '—')}</td>
          <td class="sc-sm">${esc(titleCase(r.reason_code || r.reason))}</td>
          <td>${badge(r.status)}</td>
          <td class="sc-sm sc-muted">${date(r.created_at)}</td>
          <td class="sc-cell-actions">
            <button class="sc-btn sc-btn-ghost sc-btn-xs" data-return="${r.id}">Open</button></td>
        </tr>`),
      });

      host.querySelectorAll('[data-return]').forEach(b => b.addEventListener('click', async () => {
        const r = data.find(x => x.id === b.dataset.return);
        const result = await modal({
          title: `Return on ${r.order?.order_no || 'order'}`,
          body: `<dl class="sc-kv">
              <dt>Piece</dt><dd>${esc(r.order?.listing?.title || '—')}</dd>
              <dt>Order total</dt><dd class="sc-money">${money(r.order?.total, cur(ctx))}</dd>
              <dt>Reason</dt><dd>${esc(titleCase(r.reason_code || r.reason))}</dd>
              <dt>Opened</dt><dd>${date(r.created_at, true)}</dd>
            </dl>
            <p class="sc-lead" style="margin-top:14px">${esc(r.description || 'No description given.')}</p>
            <form style="margin-top:16px">
              <div class="sc-field"><label class="sc-label">Refund amount</label>
                <input class="sc-input" name="refund_amount" type="number" step="0.01"
                       value="${r.refund_amount || r.order?.total || ''}"></div>
              <div class="sc-field" style="margin-top:12px"><label class="sc-label">Notes</label>
                <textarea class="sc-textarea" name="admin_notes">${esc(r.admin_notes || '')}</textarea></div>
            </form>`,
          actions: [
            { label: 'Close', value: 'close' },
            { label: 'Reject return', value: 'rejected', kind: 'sc-btn-danger' },
            { label: 'Approve return', value: 'approved', kind: 'sc-btn-primary' },
            { label: 'Mark refunded', value: 'refunded', kind: 'sc-btn-primary' },
          ],
        });
        if (!result || result.value === 'close') return;

        await adminAction(async () => {
          await sb.from('returns').update({
            status: result.value,
            refund_amount: Number(result.values.refund_amount) || null,
            admin_notes: result.values.admin_notes,
            reviewed_by: session.user.id, reviewed_at: new Date().toISOString(),
          }).eq('id', r.id);

          if (result.value === 'refunded') {
            await sb.from('orders').update({ status: 'refunded', payment_status: 'refunded' })
              .eq('id', r.order_id);
            await sb.from('transactions').insert({
              order_id: r.order_id, user_id: r.buyer_id, type: 'refund', status: 'completed',
              amount: Number(result.values.refund_amount) || 0,
              description: 'Refund on ' + (r.order?.order_no || ''), processed_at: new Date().toISOString(),
            });
          }
          return { error: null };
        }, 'Return updated.');
        load({ filter });
      }));
      return;
    }

    if (filter === 'disputes') {
      const { data } = await sb.from('disputes')
        .select('*, order:orders(order_no, total)').order('created_at', { ascending: false }).limit(80);

      host.innerHTML = table({
        columns: [{ label: 'Order' }, { label: 'Subject' }, { label: 'Opened by' },
                  { label: 'Status' }, { label: 'Raised' }, { label: '' }],
        emptyTitle: 'No disputes',
        rows: (data || []).map(d => `<tr>
          <td class="sc-sm">${esc(d.order?.order_no || '—')}</td>
          <td class="sc-sm">${esc(d.subject)}</td>
          <td class="sc-sm">${esc(titleCase(d.opener_role || '—'))}</td>
          <td>${badge(d.status)}</td>
          <td class="sc-sm sc-muted">${date(d.created_at)}</td>
          <td class="sc-cell-actions">
            <button class="sc-btn sc-btn-ghost sc-btn-xs" data-dispute="${d.id}">Open</button></td>
        </tr>`),
      });

      host.querySelectorAll('[data-dispute]').forEach(b => b.addEventListener('click', async () => {
        const d = data.find(x => x.id === b.dataset.dispute);
        const result = await modal({
          title: d.subject,
          body: `<p class="sc-lead">${esc(d.description || '')}</p>
            <form style="margin-top:16px">
              <div class="sc-field"><label class="sc-label">Resolve in favour of</label>
                <select class="sc-select" name="favour">
                  <option value="buyer">Buyer</option><option value="seller">Seller</option>
                  <option value="split">Split</option><option value="none">Neither</option>
                </select></div>
              <div class="sc-field" style="margin-top:12px"><label class="sc-label">Resolution</label>
                <textarea class="sc-textarea" name="resolution" required></textarea></div>
            </form>`,
          actions: [{ label: 'Close', value: false }, { label: 'Resolve', value: true, kind: 'sc-btn-primary' }],
        });
        if (result?.value !== true) return;
        await adminAction(() => sb.from('disputes').update({
          status: 'resolved', resolution: result.values.resolution,
          resolved_in_favour_of: result.values.favour,
          resolved_by: session.user.id, resolved_at: new Date().toISOString(),
        }).eq('id', d.id), 'Dispute resolved.');
        load({ filter });
      }));
      return;
    }

    const { data } = await sb.from('order_cancellations')
      .select('*, order:orders(order_no, total, status)').order('created_at', { ascending: false }).limit(80);

    host.innerHTML = table({
      columns: [{ label: 'Order' }, { label: 'Requested by' }, { label: 'Reason' },
                { label: 'Status' }, { label: '' }],
      emptyTitle: 'No cancellation requests',
      rows: (data || []).map(c => `<tr>
        <td class="sc-sm">${esc(c.order?.order_no || '—')}</td>
        <td class="sc-sm">${esc(titleCase(c.requester_role || '—'))}</td>
        <td class="sc-sm">${esc(c.reason)}</td>
        <td>${badge(c.status)}</td>
        <td class="sc-cell-actions">
          ${c.status === 'pending' ? `
            <button class="sc-btn sc-btn-ghost sc-btn-xs" data-cancel-approve="${c.id}:${c.order_id}">Approve</button>
            <button class="sc-btn sc-btn-ghost sc-btn-xs" data-cancel-reject="${c.id}">Reject</button>` : ''}
        </td></tr>`),
    });

    host.querySelectorAll('[data-cancel-approve]').forEach(b => b.addEventListener('click', async () => {
      const [cid, oid] = b.dataset.cancelApprove.split(':');
      await adminAction(async () => {
        await sb.from('order_cancellations').update({
          status: 'approved', reviewed_by: session.user.id, reviewed_at: new Date().toISOString(),
        }).eq('id', cid);
        return sb.from('orders').update({ status: 'cancelled' }).eq('id', oid);
      }, 'Order cancelled.');
      load({ filter });
    }));

    host.querySelectorAll('[data-cancel-reject]').forEach(b => b.addEventListener('click', async () => {
      await adminAction(() => sb.from('order_cancellations').update({
        status: 'rejected', reviewed_by: session.user.id, reviewed_at: new Date().toISOString(),
      }).eq('id', b.dataset.cancelReject), 'Request rejected.');
      load({ filter });
    }));
  };

  wireToolbar(root, load);
  await load({ filter: 'returns' });
}

// ---------------------------------------------------------------------------
// 6. PAYMENTS & COMMISSION
// ---------------------------------------------------------------------------
async function payments({ setContent, setTitle, setActions, ctx }) {
  setTitle('Payments', 'Every movement of money through the platform');
  setActions('<button class="sc-btn sc-btn-ghost sc-btn-sm" data-export>Download financial report</button>');

  const root = setContent(toolbar({
    tabs: [
      { value: 'all', label: 'Everything', active: true },
      { value: 'payment', label: 'Payments in' },
      { value: 'commission', label: 'Commission' },
      { value: 'payout', label: 'Payouts' },
      { value: 'refund', label: 'Refunds' },
    ],
    placeholder: 'Description or reference',
  }) + '<div data-summary></div><div data-list style="margin-top:16px"></div>');

  const { data: stats } = await sb.rpc('admin_dashboard_stats', { p_days: 30 });
  root.querySelector('[data-summary]').innerHTML = `
    <div class="sc-grid sc-grid-4">
      <div class="sc-stat"><span class="sc-stat-label">Gross sales</span>
        <span class="sc-stat-value">${money(stats?.total_sales, cur(ctx))}</span></div>
      <div class="sc-stat sc-stat-accent"><span class="sc-stat-label">Commission earned</span>
        <span class="sc-stat-value">${money(stats?.commission_earned, cur(ctx))}</span></div>
      <div class="sc-stat"><span class="sc-stat-label">Owed to sellers</span>
        <span class="sc-stat-value">${money(stats?.pending_payouts, cur(ctx))}</span></div>
      <div class="sc-stat"><span class="sc-stat-label">Average order</span>
        <span class="sc-stat-value">${money(stats?.avg_order_value, cur(ctx))}</span></div>
    </div>`;

  let cache = [];

  const load = async ({ filter, query }) => {
    const host = root.querySelector('[data-list]');
    host.innerHTML = '<div class="sc-skeleton" style="height:200px"></div>';

    let q = sb.from('transactions')
      .select('*, order:orders(order_no), user:profiles(username, full_name)')
      .order('created_at', { ascending: false }).limit(150);
    if (filter !== 'all') q = q.eq('type', filter);
    if (query) q = q.ilike('description', `%${query}%`);

    const { data } = await q;
    cache = data || [];

    host.innerHTML = table({
      columns: [{ label: 'Date' }, { label: 'Type' }, { label: 'Order' }, { label: 'Member' },
                { label: 'Method' }, { label: 'Status' }, { label: 'Amount', align: 'right' }],
      emptyTitle: 'No transactions yet',
      emptyText: 'Transactions are written automatically as orders move through.',
      rows: cache.map(t => `<tr>
        <td class="sc-sm sc-muted">${date(t.created_at, true)}</td>
        <td>${badge(t.type, titleCase(t.type))}</td>
        <td class="sc-sm">${esc(t.order?.order_no || '—')}</td>
        <td class="sc-sm">${esc(t.user?.username || t.user?.full_name || '—')}</td>
        <td class="sc-sm">${esc(titleCase(t.method || '—'))}</td>
        <td>${badge(t.status)}</td>
        <td class="sc-cell-num sc-money" style="${t.type === 'commission' ? 'color:var(--color-accent)' : ''}">
          ${t.type === 'refund' || t.type === 'payout' ? '− ' : ''}${money(t.amount, cur(ctx))}</td>
      </tr>`),
    });
  };

  wireToolbar(root, load);
  await load({ filter: 'all', query: '' });

  document.querySelector('[data-export]')?.addEventListener('click', () =>
    downloadCsv(`secondchance-finance-${new Date().toISOString().slice(0, 10)}.csv`,
      cache.map(t => ({
        date: t.created_at, type: t.type, order: t.order?.order_no,
        member: t.user?.username, method: t.method, status: t.status,
        amount: t.amount, currency: t.currency, reference: t.provider_ref,
      }))));
}

// ---------------------------------------------------------------------------
// 6b. PAYOUTS
// ---------------------------------------------------------------------------
async function payouts({ setContent, setTitle, setActions, ctx }) {
  setTitle('Payouts', 'What we owe sellers, and what has gone out');
  setActions('<button class="sc-btn sc-btn-ghost sc-btn-sm" data-export>Export</button>');

  const root = setContent(toolbar({
    tabs: [
      { value: 'pending', label: 'Due', active: true, count: ctx.counts.payout_count },
      { value: 'scheduled', label: 'Scheduled' },
      { value: 'processing', label: 'Processing' },
      { value: 'paid', label: 'Paid' },
      { value: 'on_hold', label: 'On hold' },
      { value: 'all', label: 'Everything' },
    ],
    search: false,
    extra: '<button class="sc-btn sc-btn-primary sc-btn-sm" data-pay-all>Mark selected paid</button>',
  }) + '<div data-list></div>');

  let cache = [];

  const load = async ({ filter }) => {
    const host = root.querySelector('[data-list]');
    host.innerHTML = '<div class="sc-skeleton" style="height:200px"></div>';

    let q = sb.from('payouts')
      .select('*, seller:profiles!payouts_seller_id_fkey(id, username, full_name, phone)')
      .order('scheduled_for', { ascending: true }).limit(120);
    if (filter !== 'all') q = q.eq('status', filter);

    const { data } = await q;
    cache = data || [];
    const total = cache.reduce((sum, p) => sum + Number(p.amount), 0);

    host.innerHTML = `
      <div class="sc-note sc-note-info" style="margin-bottom:14px">
        ${cache.length} payout${cache.length === 1 ? '' : 's'} · ${money(total, cur(ctx))} in total
      </div>` + table({
      columns: [{ label: '' }, { label: 'Reference' }, { label: 'Seller' }, { label: 'Method' },
                { label: 'Scheduled' }, { label: 'Status' }, { label: 'Amount', align: 'right' }, { label: '' }],
      emptyTitle: 'Nothing to pay',
      emptyText: 'Payouts are created automatically when a buyer accepts a piece.',
      rows: cache.map(p => `<tr>
        <td><input type="checkbox" data-pick="${p.id}" ${p.status === 'paid' ? 'disabled' : ''}></td>
        <td class="sc-sm">${esc(p.payout_no || '—')}</td>
        <td><p class="sc-sm" style="font-weight:500">${esc(p.seller?.username || p.seller?.full_name || '—')}</p>
          <p class="sc-xs sc-muted">${esc(p.iban || p.cliq_alias || p.seller?.phone || '')}</p></td>
        <td class="sc-sm">${esc(titleCase(p.method || 'Bank transfer'))}</td>
        <td class="sc-sm sc-muted">${date(p.scheduled_for)}</td>
        <td>${badge(p.status)}</td>
        <td class="sc-cell-num sc-money">${money(p.amount, cur(ctx))}</td>
        <td class="sc-cell-actions">
          ${p.status !== 'paid' ? `
            <button class="sc-btn sc-btn-ghost sc-btn-xs" data-pay="${p.id}">Mark paid</button>
            <button class="sc-btn sc-btn-ghost sc-btn-xs" data-hold="${p.id}">Hold</button>` : ''}
        </td></tr>`),
    });

    host.querySelectorAll('[data-pay]').forEach(b => b.addEventListener('click', () => markPaid([b.dataset.pay], load, filter)));
    host.querySelectorAll('[data-hold]').forEach(b => b.addEventListener('click', async () => {
      await adminAction(() => sb.rpc('admin_process_payout',
        { p_payout: b.dataset.hold, p_status: 'on_hold' }), 'Payout put on hold.');
      load({ filter });
    }));
  };

  const markPaid = async (ids, reloadFn, filter) => {
    const reference = await askText('Transfer reference', 'Bank reference or CliQ transaction id', false);
    if (reference === null) return;
    for (const id of ids) {
      await sb.rpc('admin_process_payout', { p_payout: id, p_status: 'paid', p_reference: reference });
    }
    toast(`${ids.length} payout${ids.length === 1 ? '' : 's'} marked paid.`, 'ok');
    reloadFn({ filter });
  };

  const getState = wireToolbar(root, load);
  await load({ filter: 'pending' });

  root.querySelector('[data-pay-all]')?.addEventListener('click', () => {
    const ids = [...root.querySelectorAll('[data-pick]:checked')].map(c => c.dataset.pick);
    if (!ids.length) return toast('Pick at least one payout first.');
    markPaid(ids, load, getState().filter);
  });

  document.querySelector('[data-export]')?.addEventListener('click', () =>
    downloadCsv('secondchance-payouts.csv', cache.map(p => ({
      payout_no: p.payout_no, seller: p.seller?.username, amount: p.amount,
      method: p.method, iban: p.iban, cliq: p.cliq_alias,
      status: p.status, scheduled: p.scheduled_for, paid_at: p.processed_at, reference: p.reference,
    }))));
}

// ---------------------------------------------------------------------------
// 8. REPORTS & COMPLAINTS
// ---------------------------------------------------------------------------
async function reports({ setContent, setTitle, ctx }) {
  setTitle('Reports', 'What members have flagged to the trust team');

  const root = setContent(toolbar({
    tabs: [
      { value: 'open', label: 'Open', active: true, count: ctx.counts.open_reports },
      { value: 'investigating', label: 'Investigating' },
      { value: 'escalated', label: 'Escalated' },
      { value: 'resolved', label: 'Resolved' },
      { value: 'dismissed', label: 'Dismissed' },
      { value: 'all', label: 'Everything' },
    ],
    search: false,
  }) + '<div data-list></div>');

  const load = async ({ filter }) => {
    const host = root.querySelector('[data-list]');
    host.innerHTML = '<div class="sc-skeleton" style="height:180px"></div>';

    let q = sb.from('reports')
      .select(`*, reporter:profiles!reports_reporter_id_fkey(username, full_name),
               listing:listings(id, title), target_user:profiles!reports_target_user_id_fkey(username, full_name)`)
      .order('created_at', { ascending: false }).limit(100);
    if (filter !== 'all') q = q.eq('status', filter);

    const { data } = await q;

    host.innerHTML = table({
      columns: [{ label: 'What' }, { label: 'About' }, { label: 'Reported by' },
                { label: 'Priority' }, { label: 'Status' }, { label: 'When' }, { label: '' }],
      emptyTitle: filter === 'open' ? 'Nothing open' : 'No reports here',
      emptyText: 'Reports from buyers and sellers land here.',
      rows: (data || []).map(r => `<tr>
        <td><p class="sc-sm" style="font-weight:500">${esc(titleCase(r.category))}</p>
          <p class="sc-xs sc-muted sc-truncate" style="max-width:200px">${esc(r.description || '')}</p></td>
        <td class="sc-sm">${esc(r.listing?.title || r.target_user?.username || titleCase(r.target_type))}</td>
        <td class="sc-sm">${esc(r.reporter?.username || r.reporter?.full_name || 'Anonymous')}</td>
        <td>${badge(r.priority === 'urgent' ? 'rejected' : r.priority === 'high' ? 'pending' : 'draft', titleCase(r.priority))}</td>
        <td>${badge(r.status)}</td>
        <td class="sc-sm sc-muted">${ago(r.created_at)}</td>
        <td class="sc-cell-actions">
          <button class="sc-btn sc-btn-ghost sc-btn-xs" data-report="${r.id}">Open</button></td>
      </tr>`),
    });

    host.querySelectorAll('[data-report]').forEach(b => b.addEventListener('click', async () => {
      const r = data.find(x => x.id === b.dataset.report);
      const result = await modal({
        title: `Report: ${titleCase(r.category)}`,
        body: `<dl class="sc-kv">
            <dt>About</dt><dd>${esc(r.listing?.title || r.target_user?.username || titleCase(r.target_type))}</dd>
            <dt>Reported by</dt><dd>${esc(r.reporter?.username || r.reporter?.full_name || 'Anonymous')}</dd>
            <dt>Raised</dt><dd>${date(r.created_at, true)}</dd>
            <dt>Priority</dt><dd>${esc(titleCase(r.priority))}</dd>
          </dl>
          <p class="sc-lead" style="margin-top:14px">${esc(r.description || 'No detail given.')}</p>
          ${r.listing ? `<p style="margin-top:12px">
            <button class="sc-btn sc-btn-ghost sc-btn-sm" data-open-listing="${r.listing.id}">Open the listing</button></p>` : ''}
          <form style="margin-top:16px">
            <div class="sc-field"><label class="sc-label">What did you do?</label>
              <select class="sc-select" name="action_taken">
                <option value="">Nothing yet</option>
                <option>Listing removed</option>
                <option>Seller warned</option>
                <option>Seller suspended</option>
                <option>Buyer refunded</option>
                <option>No action needed</option>
              </select></div>
            <div class="sc-field" style="margin-top:12px"><label class="sc-label">Resolution notes</label>
              <textarea class="sc-textarea" name="resolution">${esc(r.resolution || '')}</textarea></div>
          </form>`,
        actions: [
          { label: 'Close', value: 'close' },
          { label: 'Investigating', value: 'investigating' },
          { label: 'Escalate', value: 'escalated' },
          { label: 'Dismiss', value: 'dismissed' },
          { label: 'Resolve', value: 'resolved', kind: 'sc-btn-primary' },
        ],
        onMount: el => {
          el.querySelector('[data-open-listing]')?.addEventListener('click', () => {
            location.hash = 'listings';
          });
        },
      });
      if (!result || result.value === 'close') return;

      await adminAction(() => sb.from('reports').update({
        status: result.value,
        action_taken: result.values.action_taken || null,
        resolution: result.values.resolution || null,
        assigned_to: session.user.id,
        resolved_by: ['resolved', 'dismissed'].includes(result.value) ? session.user.id : null,
        resolved_at: ['resolved', 'dismissed'].includes(result.value) ? new Date().toISOString() : null,
      }).eq('id', r.id), 'Report updated.');
      load({ filter });
    }));
  };

  wireToolbar(root, load);
  await load({ filter: 'open' });
}

export default { users, sellers, orders, returns, payments, payouts, reports };
