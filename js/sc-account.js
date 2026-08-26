// ============================================================================
// SecondChance Collective — member account
// ============================================================================

import {
  sb, session, requireAuth, getSettings, signOut,
  money, num, date, ago, esc, badge, initials, titleCase,
  toast, modal, confirmAction, empty, errorMessage, publicUrl, param, setParam,
  USERNAME_RE, USERNAME_RULE, cleanUsername,
} from './sc-core.js';
import { CITIES } from './config.js';

let settings = null;
let summary = null;

const TABS = [
  { key: 'overview',      label: 'Overview' },
  { key: 'listings',      label: 'Your listings' },
  { key: 'orders',        label: 'Purchases' },
  { key: 'sales',         label: 'Sales' },
  { key: 'payouts',       label: 'Payouts' },
  { key: 'favorites',     label: 'Saved' },
  { key: 'notifications', label: 'Notifications' },
  { key: 'settings',      label: 'Settings' },
];

export async function initAccount() {
  if (!await requireAuth()) return;
  settings = await getSettings();

  const { data } = await sb.rpc('my_seller_summary');
  summary = data || {};

  renderHero();
  renderTabs();
  await show(param('tab') || 'overview');
}

// ---------------------------------------------------------------------------
function renderHero() {
  const p = session.profile || {};
  const name = p.full_name || p.username || 'Your account';
  const sellerBadge =
    p.seller_status === 'approved' ? '<span class="sc-badge sc-badge-ok sc-badge-dot">Verified seller</span>'
    : p.seller_status === 'pending' ? '<span class="sc-badge sc-badge-warn sc-badge-dot">Seller review pending</span>'
    : p.seller_status === 'rejected' ? '<span class="sc-badge sc-badge-danger sc-badge-dot">Seller application declined</span>'
    : '';

  document.getElementById('acct-hero').innerHTML = `
    <div class="sc-row" style="gap:14px">
      ${p.avatar_url
        ? `<img class="sc-avatar" style="width:52px;height:52px" src="${esc(p.avatar_url)}" alt="">`
        : `<span class="sc-avatar" style="width:52px;height:52px;font-size:17px;background:var(--color-accent);color:#fff">${esc(initials(name))}</span>`}
      <div class="sc-grow">
        <h1 class="sc-h1" style="font-size:25px">${esc(name)}</h1>
        <p class="sc-sm sc-muted" style="margin-top:3px">
          ${esc(session.user.email)}${p.city ? ' · ' + esc(p.city) : ''} · Member since ${date(p.created_at)}
        </p>
      </div>
      <div class="sc-row-tight">
        ${sellerBadge}
        ${session.isAdmin ? '<a class="sc-btn sc-btn-dark sc-btn-sm" href="admin.html">Admin panel</a>' : ''}
      </div>
    </div>`;
}

function renderTabs() {
  const host = document.getElementById('acct-tabs');
  host.innerHTML = TABS.map(t =>
    `<button class="acct-tab" role="tab" data-tab="${t.key}">${esc(t.label)}</button>`).join('');
  host.addEventListener('click', e => {
    const btn = e.target.closest('[data-tab]');
    if (btn) show(btn.dataset.tab);
  });
}

async function show(key) {
  if (!TABS.some(t => t.key === key)) key = 'overview';
  setParam('tab', key === 'overview' ? null : key);
  document.querySelectorAll('.acct-tab').forEach(b =>
    b.classList.toggle('is-active', b.dataset.tab === key));

  const body = document.getElementById('acct-body');
  body.innerHTML = '<div class="sc-skeleton" style="height:180px"></div>';

  try {
    const render = {
      overview: renderOverview, listings: renderListings, orders: renderOrders,
      sales: renderSales, payouts: renderPayouts, favorites: renderFavorites,
      notifications: renderNotifications, settings: renderSettings,
    }[key];
    body.innerHTML = await render();
    wire(key, body);
  } catch (err) {
    body.innerHTML = `<div class="sc-note sc-note-danger">${esc(errorMessage(err))}</div>`;
  }
}

// ---------------------------------------------------------------------------
async function renderOverview() {
  const [{ data: orders }, { data: listings }] = await Promise.all([
    sb.from('orders').select('id, order_no, status, total, created_at, listing:listings(title)')
      .eq('buyer_id', session.user.id).order('created_at', { ascending: false }).limit(4),
    sb.from('listings').select('id, title, status, price, created_at')
      .eq('seller_id', session.user.id).order('created_at', { ascending: false }).limit(4),
  ]);

  const stat = (label, value, note) => `
    <div class="sc-stat"><span class="sc-stat-label">${label}</span>
      <span class="sc-stat-value">${value}</span>
      ${note ? `<span class="sc-stat-note">${note}</span>` : ''}</div>`;

  return `
    <div class="sc-grid sc-grid-4">
      ${stat('Live listings', num(summary.listed_active), summary.in_review ? `${summary.in_review} in review` : '')}
      ${stat('Sold', num(summary.sold))}
      ${stat('Earned', money(summary.earnings, settings.currency))}
      ${stat('Pending payout', money(summary.pending_payout, settings.currency))}
    </div>

    ${session.profile?.seller_status === 'none' ? `
      <div class="sc-note sc-note-info" style="margin-top:18px">
        <strong>Get verified to sell faster.</strong>
        Verified sellers skip the queue and can take payouts by bank transfer or CliQ.
        <p style="margin-top:10px"><button class="sc-btn sc-btn-primary sc-btn-sm" data-apply-seller>Apply to sell</button></p>
      </div>` : ''}

    <div class="sc-grid sc-grid-2" style="margin-top:18px">
      <div class="sc-card">
        <div class="sc-between"><h2 class="sc-h2">Recent listings</h2>
          <button class="sc-btn sc-btn-ghost sc-btn-xs" data-goto="listings">See all</button></div>
        <div style="margin-top:14px">
          ${listings?.length ? listings.map(l => `
            <div class="sc-between" style="padding:9px 0;border-bottom:1px solid var(--color-line)">
              <div class="sc-grow"><p class="sc-sm sc-truncate">${esc(l.title)}</p>
                <p class="sc-xs sc-muted">${date(l.created_at)}</p></div>
              <div class="sc-row-tight">${badge(l.status)}<span class="sc-money sc-sm">${money(l.price, settings.currency)}</span></div>
            </div>`).join('')
            : empty('Nothing listed yet', 'Your first listing takes about five minutes.',
                    '<a class="sc-btn sc-btn-primary sc-btn-sm" href="sell.html">List an item</a>')}
        </div>
      </div>

      <div class="sc-card">
        <div class="sc-between"><h2 class="sc-h2">Recent orders</h2>
          <button class="sc-btn sc-btn-ghost sc-btn-xs" data-goto="orders">See all</button></div>
        <div style="margin-top:14px">
          ${orders?.length ? orders.map(o => `
            <div class="sc-between" style="padding:9px 0;border-bottom:1px solid var(--color-line)">
              <div class="sc-grow"><p class="sc-sm sc-truncate">${esc(o.listing?.title || o.order_no)}</p>
                <p class="sc-xs sc-muted">${o.order_no} · ${date(o.created_at)}</p></div>
              <div class="sc-row-tight">${badge(o.status)}<span class="sc-money sc-sm">${money(o.total, settings.currency)}</span></div>
            </div>`).join('')
            : empty('No orders yet', 'When you buy something it shows up here.',
                    '<a class="sc-btn sc-btn-ghost sc-btn-sm" href="index.html">Start browsing</a>')}
        </div>
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
async function renderListings() {
  const { data } = await sb.from('listings')
    .select('id, reference, title, status, price, view_count, favorite_count, created_at, rejection_reason, authentication_status, images:listing_images(storage_path, slot)')
    .eq('seller_id', session.user.id).order('created_at', { ascending: false });

  if (!data?.length) {
    return empty('No listings yet', 'List a piece and it goes to our team for review.',
      '<a class="sc-btn sc-btn-primary" href="sell.html">List an item</a>');
  }

  return `
    <div class="sc-between" style="margin-bottom:14px">
      <h2 class="sc-h2">${data.length} listing${data.length === 1 ? '' : 's'}</h2>
      <a class="sc-btn sc-btn-primary sc-btn-sm" href="sell.html">List another</a>
    </div>
    <div class="sc-table-wrap"><table class="sc-table">
      <thead><tr><th>Piece</th><th>Status</th><th class="sc-cell-num">Price</th>
        <th class="sc-cell-num">Views</th><th class="sc-cell-num">Saved</th><th></th></tr></thead>
      <tbody>${data.map(l => {
        const front = l.images?.find(i => i.slot === 'front') || l.images?.[0];
        return `<tr>
          <td><div class="acct-listing">
            <img src="${front ? publicUrl('listing-photos', front.storage_path) : ''}" alt="" loading="lazy">
            <div><p style="font-weight:500">${esc(l.title)}</p>
              <p class="sc-xs sc-muted">${esc(l.reference || '')} · ${date(l.created_at)}</p>
              ${l.status === 'rejected' && l.rejection_reason
                ? `<p class="sc-xs" style="color:var(--sc-danger);margin-top:3px">${esc(l.rejection_reason)}</p>` : ''}
            </div></div></td>
          <td>${badge(l.status)}
            ${l.authentication_status === 'passed' ? '<br><span class="sc-badge sc-badge-ok" style="margin-top:4px">Authenticated</span>' : ''}</td>
          <td class="sc-cell-num sc-money">${money(l.price, settings.currency)}</td>
          <td class="sc-cell-num">${num(l.view_count)}</td>
          <td class="sc-cell-num">${num(l.favorite_count)}</td>
          <td class="sc-cell-actions">
            ${['draft', 'rejected'].includes(l.status)
              ? `<button class="sc-btn sc-btn-ghost sc-btn-xs" data-submit-listing="${l.id}">Submit</button>` : ''}
            ${['draft', 'rejected'].includes(l.status)
              ? `<button class="sc-btn sc-btn-danger sc-btn-xs" data-delete-listing="${l.id}">Delete</button>` : ''}
            ${l.status === 'active'
              ? `<a class="sc-btn sc-btn-ghost sc-btn-xs" href="item.html?id=${l.id}">View</a>` : ''}
          </td></tr>`;
      }).join('')}</tbody></table></div>`;
}

// ---------------------------------------------------------------------------
async function renderOrders() {
  const { data } = await sb.from('orders')
    .select('id, order_no, status, payment_status, total, created_at, listing:listings(title), seller:profiles!orders_seller_id_fkey(username, full_name)')
    .eq('buyer_id', session.user.id).order('created_at', { ascending: false });

  if (!data?.length) return empty('No purchases yet', 'Orders appear here with tracking and Buyer Protection status.',
    '<a class="sc-btn sc-btn-primary" href="index.html">Browse listings</a>');

  return `<div class="sc-stack">${data.map(o => `
    <div class="sc-card">
      <div class="sc-between">
        <div><p class="sc-eyebrow">${esc(o.order_no)}</p>
          <h3 class="sc-h3" style="margin-top:4px">${esc(o.listing?.title || 'Item removed')}</h3>
          <p class="sc-xs sc-muted" style="margin-top:3px">
            From ${esc(o.seller?.username || o.seller?.full_name || 'seller')} · ${date(o.created_at)}</p></div>
        <div style="text-align:right">
          <p class="sc-money-lg">${money(o.total, settings.currency)}</p>
          <div class="sc-row-tight" style="justify-content:flex-end;margin-top:6px">${badge(o.status)}</div></div>
      </div>
      <div class="sc-row-tight" style="margin-top:14px">
        ${o.status === 'delivered'
          ? `<button class="sc-btn sc-btn-primary sc-btn-sm" data-accept-order="${o.id}">Accept the piece</button>
             <button class="sc-btn sc-btn-ghost sc-btn-sm" data-return-order="${o.id}">Open a return</button>` : ''}
        ${['placed', 'confirmed'].includes(o.status)
          ? `<button class="sc-btn sc-btn-ghost sc-btn-sm" data-cancel-order="${o.id}">Request cancellation</button>` : ''}
        <button class="sc-btn sc-btn-ghost sc-btn-sm" data-report-order="${o.id}">Report a problem</button>
      </div>
    </div>`).join('')}</div>`;
}

// ---------------------------------------------------------------------------
async function renderSales() {
  const { data } = await sb.from('orders')
    .select('id, order_no, status, total, item_price, commission_amount, seller_amount, created_at, listing:listings(title), buyer:profiles!orders_buyer_id_fkey(username, full_name)')
    .eq('seller_id', session.user.id).order('created_at', { ascending: false });

  if (!data?.length) return empty('No sales yet', 'Once a buyer takes one of your pieces it shows up here with the payout breakdown.');

  return `
    <div class="sc-table-wrap"><table class="sc-table">
      <thead><tr><th>Order</th><th>Piece</th><th>Status</th>
        <th class="sc-cell-num">Sold for</th><th class="sc-cell-num">Commission</th><th class="sc-cell-num">You get</th></tr></thead>
      <tbody>${data.map(o => `<tr>
        <td><span class="sc-sm">${esc(o.order_no)}</span><br><span class="sc-xs sc-muted">${date(o.created_at)}</span></td>
        <td><p class="sc-sm sc-truncate" style="max-width:220px">${esc(o.listing?.title || '—')}</p>
          <p class="sc-xs sc-muted">${esc(o.buyer?.username || o.buyer?.full_name || 'buyer')}</p></td>
        <td>${badge(o.status)}</td>
        <td class="sc-cell-num sc-money">${money(o.item_price, settings.currency)}</td>
        <td class="sc-cell-num sc-money" style="color:var(--color-muted)">− ${money(o.commission_amount, settings.currency)}</td>
        <td class="sc-cell-num sc-money" style="color:var(--color-accent)">${money(o.seller_amount, settings.currency)}</td>
      </tr>`).join('')}</tbody></table></div>`;
}

// ---------------------------------------------------------------------------
async function renderPayouts() {
  const { data } = await sb.from('payouts').select('*')
    .eq('seller_id', session.user.id).order('created_at', { ascending: false });

  const head = `
    <div class="sc-grid sc-grid-3" style="margin-bottom:18px">
      <div class="sc-stat"><span class="sc-stat-label">Pending</span>
        <span class="sc-stat-value">${money(summary.pending_payout, settings.currency)}</span></div>
      <div class="sc-stat"><span class="sc-stat-label">Paid out</span>
        <span class="sc-stat-value">${money(summary.paid_out, settings.currency)}</span></div>
      <div class="sc-stat"><span class="sc-stat-label">Total earned</span>
        <span class="sc-stat-value">${money(summary.earnings, settings.currency)}</span></div>
    </div>`;

  if (!data?.length) return head + empty('No payouts yet',
    'A payout is scheduled once a buyer accepts a piece you sold.');

  return head + `<div class="sc-table-wrap"><table class="sc-table">
    <thead><tr><th>Reference</th><th>Scheduled</th><th>Method</th><th>Status</th><th class="sc-cell-num">Amount</th></tr></thead>
    <tbody>${data.map(p => `<tr>
      <td class="sc-sm">${esc(p.payout_no || '—')}</td>
      <td class="sc-sm">${date(p.scheduled_for)}</td>
      <td class="sc-sm">${esc(titleCase(p.method || 'Bank transfer'))}</td>
      <td>${badge(p.status)}</td>
      <td class="sc-cell-num sc-money">${money(p.amount, settings.currency)}</td>
    </tr>`).join('')}</tbody></table></div>`;
}

// ---------------------------------------------------------------------------
async function renderFavorites() {
  const { data } = await sb.from('favorites')
    .select('listing_id, created_at, listing:listings(id, title, price, status, images:listing_images(storage_path, slot))')
    .eq('user_id', session.user.id).order('created_at', { ascending: false });

  const items = (data || []).filter(f => f.listing);
  if (!items.length) return empty('Nothing saved', 'Tap the heart on a listing to keep it here.',
    '<a class="sc-btn sc-btn-primary" href="index.html">Browse listings</a>');

  return `<div class="sc-grid sc-grid-cards">${items.map(f => {
    const front = f.listing.images?.find(i => i.slot === 'front') || f.listing.images?.[0];
    return `<a class="sc-card sc-card-flush" href="item.html?id=${f.listing.id}" style="display:block">
      <img src="${front ? publicUrl('listing-photos', front.storage_path) : ''}" alt=""
           style="width:100%;aspect-ratio:4/5;object-fit:cover;background:var(--color-product)" loading="lazy">
      <div style="padding:12px">
        <p class="sc-sm sc-truncate">${esc(f.listing.title)}</p>
        <div class="sc-between" style="margin-top:6px">
          <span class="sc-money">${money(f.listing.price, settings.currency)}</span>
          ${f.listing.status !== 'active' ? badge(f.listing.status) : ''}
        </div>
      </div></a>`;
  }).join('')}</div>`;
}

// ---------------------------------------------------------------------------
async function renderNotifications() {
  const { data } = await sb.from('notifications').select('*')
    .eq('user_id', session.user.id).order('created_at', { ascending: false }).limit(60);

  sb.from('notifications').update({ read_at: new Date().toISOString() })
    .eq('user_id', session.user.id).is('read_at', null).then(() => {}, () => {});

  if (!data?.length) return empty('Nothing yet', 'Listing decisions, order updates and payouts land here.');

  return `<div class="sc-stack">${data.map(n => `
    <div class="sc-card" style="padding:15px 18px;${n.read_at ? '' : 'border-left:3px solid var(--color-accent)'}">
      <div class="sc-between">
        <p class="sc-h3">${esc(n.title)}</p>
        <span class="sc-xs sc-muted">${ago(n.created_at)}</span>
      </div>
      ${n.body ? `<p class="sc-sm sc-muted" style="margin-top:5px">${esc(n.body)}</p>` : ''}
      ${n.link_url ? `<p style="margin-top:10px"><a class="sc-btn sc-btn-ghost sc-btn-xs" href="${esc(n.link_url)}">Open</a></p>` : ''}
    </div>`).join('')}</div>`;
}

// ---------------------------------------------------------------------------
async function renderSettings() {
  const p = session.profile || {};
  return `
    <div class="sc-grid sc-grid-2" style="align-items:start">
      <form class="sc-card sc-stack" id="profile-form">
        <h2 class="sc-h2">Your details</h2>
        <div class="sc-field"><label class="sc-label" for="s-name">Full name</label>
          <input class="sc-input" id="s-name" name="full_name" value="${esc(p.full_name || '')}"></div>
        <div class="sc-field"><label class="sc-label" for="s-username">Username</label>
          <input class="sc-input" id="s-username" name="username" value="${esc(p.username || '')}"></div>
        <div class="sc-field"><label class="sc-label" for="s-phone">Mobile number</label>
          <input class="sc-input" id="s-phone" name="phone" value="${esc(p.phone || '')}">
          <p class="sc-hint">Buyers use it to reach you after a sale.</p></div>
        <div class="sc-field"><label class="sc-label" for="s-city">City</label>
          <select class="sc-select" id="s-city" name="city">
            <option value="">Choose one</option>
            ${CITIES.map(c => `<option ${p.city === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select></div>
        <div class="sc-field"><label class="sc-label" for="s-area">Area</label>
          <input class="sc-input" id="s-area" name="area" value="${esc(p.area || '')}"></div>
        <div class="sc-field"><label class="sc-label" for="s-address">Pickup address</label>
          <textarea class="sc-textarea" id="s-address" name="address_line">${esc(p.address_line || '')}</textarea>
          <p class="sc-hint">Buyers use this to reach you after a sale. Changing it needs a new code.</p></div>
        <div class="sc-field"><label class="sc-label" for="s-bio">About you</label>
          <textarea class="sc-textarea" id="s-bio" name="bio">${esc(p.bio || '')}</textarea></div>
        <label class="sc-check"><input type="checkbox" name="marketing_opt_in" ${p.marketing_opt_in ? 'checked' : ''}>
          <span>Send me occasional emails about new arrivals and offers.</span></label>
        <button class="sc-btn sc-btn-primary" type="submit">Save changes</button>
      </form>

      <div class="sc-stack">
        <div class="sc-card">
          <h2 class="sc-h2">Security</h2>
          <dl class="sc-kv" style="margin-top:14px">
            <dt>Email</dt><dd>${esc(session.user.email)}</dd>
            <dt>Email verified</dt><dd>${p.email_verified ? 'Yes' : 'No'}</dd>
            <dt>Email verified</dt><dd>${p.email_verified ? 'Yes' : 'No'}</dd>
            <dt>Identity</dt><dd>${p.identity_verified ? 'Verified' : 'Not submitted'}</dd>
          </dl>
          <div class="sc-row-tight" style="margin-top:16px">
            <button class="sc-btn sc-btn-ghost sc-btn-sm" data-change-password>Change password</button>
            <button class="sc-btn sc-btn-ghost sc-btn-sm" data-signout-all>Sign out</button>
          </div>
        </div>

        ${p.seller_status === 'none' ? `
          <div class="sc-card">
            <h2 class="sc-h2">Selling</h2>
            <p class="sc-lead" style="margin-top:8px">
              Verified sellers get faster listing approval and can take payouts by bank transfer or CliQ.</p>
            <button class="sc-btn sc-btn-primary sc-btn-sm" style="margin-top:14px" data-apply-seller>Apply to sell</button>
          </div>` : ''}

        <div class="sc-card">
          <h2 class="sc-h2">Your data</h2>
          <p class="sc-lead" style="margin-top:8px">
            Download everything we hold about your account, or close it for good.</p>
          <div class="sc-row-tight" style="margin-top:14px">
            <button class="sc-btn sc-btn-ghost sc-btn-sm" data-export-data>Download my data</button>
            <button class="sc-btn sc-btn-danger sc-btn-sm" data-delete-account>Close account</button>
          </div>
        </div>
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Event wiring
// ---------------------------------------------------------------------------
function wire(tab, root) {
  root.querySelectorAll('[data-goto]').forEach(b =>
    b.addEventListener('click', () => show(b.dataset.goto)));

  root.querySelectorAll('[data-apply-seller]').forEach(b =>
    b.addEventListener('click', applyToSell));

  root.querySelectorAll('[data-submit-listing]').forEach(b => b.addEventListener('click', async () => {
    const { error } = await sb.from('listings')
      .update({ status: 'pending_review' }).eq('id', b.dataset.submitListing);
    if (error) return toast(errorMessage(error), 'danger');
    toast('Sent for review.', 'ok');
    show('listings');
  }));

  root.querySelectorAll('[data-delete-listing]').forEach(b => b.addEventListener('click', async () => {
    if (!await confirmAction('Delete this listing?', 'This cannot be undone.', 'Delete', true)) return;
    const { error } = await sb.from('listings').delete().eq('id', b.dataset.deleteListing);
    if (error) return toast(errorMessage(error), 'danger');
    toast('Listing deleted.');
    show('listings');
  }));

  root.querySelectorAll('[data-accept-order]').forEach(b => b.addEventListener('click', async () => {
    if (!await confirmAction('Accept this piece?',
      'Accepting releases the payment to the seller and closes Buyer Protection on this order.',
      'Accept')) return;
    const { error } = await sb.from('orders').update({ status: 'accepted' }).eq('id', b.dataset.acceptOrder);
    if (error) return toast(errorMessage(error), 'danger');
    toast('Accepted. Thank you.', 'ok');
    show('orders');
  }));

  root.querySelectorAll('[data-return-order]').forEach(b =>
    b.addEventListener('click', () => openReturn(b.dataset.returnOrder)));
  root.querySelectorAll('[data-cancel-order]').forEach(b =>
    b.addEventListener('click', () => requestCancel(b.dataset.cancelOrder)));
  root.querySelectorAll('[data-report-order]').forEach(b =>
    b.addEventListener('click', () => reportProblem(b.dataset.reportOrder)));

  if (tab === 'settings') wireSettings(root);
}

function wireSettings(root) {
  root.querySelector('#profile-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    const uname = cleanUsername(f.username);
    if (uname && !USERNAME_RE.test(uname))
      return toast(USERNAME_RULE, 'danger');
    const { error } = await sb.from('profiles').update({
      full_name: f.full_name || null,
      username: uname.toLowerCase() || null,
      phone: f.phone || null,
      city: f.city || null,
      area: f.area || null,
      address_line: f.address_line || null,
      bio: f.bio || null,
      marketing_opt_in: !!f.marketing_opt_in,
    }).eq('id', session.user.id);
    if (error) return toast(errorMessage(error), 'danger');
    toast('Saved.', 'ok');
  });

  // Arriving from the forgotten-password flow: open the dialog straight away
  // rather than leaving someone who just proved their number to go hunting.
  if (param('setpassword')) {
    setTimeout(() => root.querySelector('[data-change-password]')?.click(), 120);
    history.replaceState(null, '', 'account.html?tab=settings');
  }

  root.querySelector('[data-change-password]')?.addEventListener('click', async () => {
    const result = await modal({
      title: 'Change password',
      body: `<form class="sc-stack">
        <div class="sc-field"><label class="sc-label">New password</label>
          <input class="sc-input" name="password" type="password" minlength="8" required></div>
        <div class="sc-field"><label class="sc-label">Confirm</label>
          <input class="sc-input" name="confirm" type="password" required></div></form>`,
      actions: [{ label: 'Cancel', value: false }, { label: 'Save password', value: true, kind: 'sc-btn-primary' }],
    });
    if (result?.value !== true) return;
    const { password, confirm } = result.values;
    if (password.length < 8) return toast('Use at least 8 characters.', 'danger');
    if (password !== confirm) return toast('The two passwords do not match.', 'danger');
    const { error } = await sb.auth.updateUser({ password });
    toast(error ? errorMessage(error) : 'Password changed.', error ? 'danger' : 'ok');
  });

  root.querySelector('[data-signout-all]')?.addEventListener('click', signOut);

  root.querySelector('[data-export-data]')?.addEventListener('click', async () => {
    const [profile, listings, orders] = await Promise.all([
      sb.from('profiles').select('*').eq('id', session.user.id).maybeSingle(),
      sb.from('listings').select('*').eq('seller_id', session.user.id),
      sb.from('orders').select('*').eq('buyer_id', session.user.id),
    ]);
    const blob = new Blob([JSON.stringify({
      profile: profile.data, listings: listings.data, orders: orders.data,
      exported_at: new Date().toISOString(),
    }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'secondchance-my-data.json';
    a.click();
  });

  root.querySelector('[data-delete-account]')?.addEventListener('click', async () => {
    if (!await confirmAction('Close your account?',
      'Your live listings come down straight away. Orders in progress have to finish first, and we keep transaction records as the law requires.',
      'Close account', true)) return;
    await sb.from('listings').update({ status: 'removed' })
      .eq('seller_id', session.user.id).in('status', ['active', 'pending_review', 'draft']);
    await sb.from('profiles').update({ account_status: 'suspended', suspended_reason: 'Closed by member' })
      .eq('id', session.user.id);
    toast('Account closed.');
    setTimeout(signOut, 900);
  });
}

// ---------------------------------------------------------------------------
async function applyToSell() {
  const result = await modal({
    title: 'Apply to sell',
    body: `<p class="sc-lead" style="margin-bottom:16px">
        We check this once so buyers know who they are dealing with. It usually takes a day.</p>
      <form class="sc-stack">
        <div class="sc-field"><label class="sc-label">Full legal name</label>
          <input class="sc-input" name="legal_name" required value="${esc(session.profile?.full_name || '')}"></div>
        <div class="sc-field"><label class="sc-label">National ID or passport number</label>
          <input class="sc-input" name="national_id" required></div>
        <div class="sc-field"><label class="sc-label">How would you like payouts?</label>
          <select class="sc-select" name="payout_method">
            <option value="bank_transfer">Bank transfer</option>
            <option value="cliq">CliQ</option>
          </select></div>
        <div class="sc-field"><label class="sc-label">IBAN or CliQ alias</label>
          <input class="sc-input" name="iban" required placeholder="JO00 XXXX 0000 0000 0000 0000 0000"></div>
        <div class="sc-field"><label class="sc-label">Pickup address</label>
          <textarea class="sc-textarea" name="pickup_address" required>${esc(session.profile?.address_line || '')}</textarea></div>
      </form>`,
    actions: [{ label: 'Cancel', value: false }, { label: 'Submit application', value: true, kind: 'sc-btn-primary' }],
  });
  if (result?.value !== true) return;

  const v = result.values;
  if (!v.legal_name || !v.national_id || !v.iban) return toast('Fill in every field.', 'danger');

  const { error } = await sb.from('seller_applications').insert({
    user_id: session.user.id,
    legal_name: v.legal_name, national_id: v.national_id,
    payout_method: v.payout_method,
    iban: v.payout_method === 'bank_transfer' ? v.iban : null,
    cliq_alias: v.payout_method === 'cliq' ? v.iban : null,
    pickup_address: v.pickup_address,
  });
  if (error) return toast(errorMessage(error), 'danger');

  await sb.from('profiles').update({ seller_status: 'pending' }).eq('id', session.user.id);
  toast('Application sent. We will let you know within a day.', 'ok');
  location.reload();
}

async function openReturn(orderId) {
  const result = await modal({
    title: 'Open a return',
    body: `<form class="sc-stack">
      <div class="sc-field"><label class="sc-label">What is wrong?</label>
        <select class="sc-select" name="reason_code">
          <option value="not_as_described">Not as described</option>
          <option value="counterfeit">I think it is counterfeit</option>
          <option value="damaged">It arrived damaged</option>
          <option value="wrong_item">Wrong item</option>
          <option value="other">Something else</option>
        </select></div>
      <div class="sc-field"><label class="sc-label">Tell us more</label>
        <textarea class="sc-textarea" name="description" required
          placeholder="What did you expect, and what turned up?"></textarea></div>
    </form>`,
    actions: [{ label: 'Cancel', value: false }, { label: 'Open return', value: true, kind: 'sc-btn-primary' }],
  });
  if (result?.value !== true) return;

  const { error } = await sb.from('returns').insert({
    order_id: orderId, buyer_id: session.user.id,
    reason_code: result.values.reason_code,
    reason: result.values.reason_code,
    description: result.values.description,
  });
  toast(error ? errorMessage(error) : 'Return opened. Our team will be in touch.', error ? 'danger' : 'ok');
  if (!error) show('orders');
}

async function requestCancel(orderId) {
  const result = await modal({
    title: 'Request cancellation',
    body: `<form><div class="sc-field"><label class="sc-label">Why are you cancelling?</label>
      <textarea class="sc-textarea" name="reason" required></textarea></div></form>`,
    actions: [{ label: 'Keep order', value: false }, { label: 'Request cancellation', value: true, kind: 'sc-btn-danger' }],
  });
  if (result?.value !== true) return;

  const { error } = await sb.from('order_cancellations').insert({
    order_id: orderId, requested_by: session.user.id,
    requester_role: 'buyer', reason: result.values.reason,
  });
  toast(error ? errorMessage(error) : 'Cancellation requested.', error ? 'danger' : 'ok');
}

async function reportProblem(orderId) {
  const result = await modal({
    title: 'Report a problem',
    body: `<form class="sc-stack">
      <div class="sc-field"><label class="sc-label">What kind of problem?</label>
        <select class="sc-select" name="category">
          <option value="counterfeit">Counterfeit concern</option>
          <option value="misleading">Listing was misleading</option>
          <option value="fraud">Fraud or scam</option>
          <option value="harassment">Behaviour from the seller</option>
          <option value="other">Something else</option>
        </select></div>
      <div class="sc-field"><label class="sc-label">Details</label>
        <textarea class="sc-textarea" name="description" required></textarea></div></form>`,
    actions: [{ label: 'Cancel', value: false }, { label: 'Send report', value: true, kind: 'sc-btn-primary' }],
  });
  if (result?.value !== true) return;

  const { error } = await sb.from('reports').insert({
    reporter_id: session.user.id, target_type: 'order', target_order_id: orderId,
    category: result.values.category, description: result.values.description,
  });
  toast(error ? errorMessage(error) : 'Report sent. It goes to our trust team, never to the seller.',
    error ? 'danger' : 'ok');
}
