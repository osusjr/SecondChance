// ============================================================================
// SecondChance Collective — listing detail and checkout
// ============================================================================

import {
  sb, session, loadSession, getSettings,
  money, num, date, esc, badge, titleCase, initials,
  toast, modal, empty, publicUrl, errorMessage, param,
} from './sc-core.js';
import { CITIES, PAYMENT_METHODS } from './config.js';

let listing = null;
let settings = null;

// A listing carries up to ten photos and one optional video (slot 'video').
const isVideoMedia = p => p?.slot === 'video' || /\.(mp4|mov|webm)$/i.test(p?.storage_path || '');

function mainMediaHtml(p) {
  if (!p) return '<img class="it-main-img" id="it-main" alt="" src="">';
  const url = esc(publicUrl('listing-photos', p.storage_path));
  return isVideoMedia(p)
    ? `<video class="it-main-img" id="it-main" controls playsinline preload="metadata" src="${url}"></video>`
    : `<img class="it-main-img" id="it-main" alt="${esc(listing?.title || '')}" src="${url}">`;
}

export async function initItem() {
  const id = param('id');
  const root = document.getElementById('item-root');

  if (!id) {
    root.innerHTML = empty('No listing chosen', 'Pick a piece from the shop.',
      '<a class="sc-btn sc-btn-primary" href="index.html">Browse listings</a>');
    return;
  }

  await loadSession();
  settings = await getSettings();

  const { data, error } = await sb.from('listings')
    .select(`*, brand:brands(name, slug), category:categories(name, slug),
             condition:conditions(label, description),
             seller:profiles!listings_seller_id_fkey(id, username, full_name, avatar_url, city, area, seller_status, created_at),
             images:listing_images(storage_path, slot, sort_order),
             checks:authentication_checks(status, verdict, certificate_no, completed_at)`)
    .eq('id', id).maybeSingle();

  if (error || !data) {
    root.innerHTML = empty('This piece has gone', 'It may have sold or been taken down.',
      '<a class="sc-btn sc-btn-primary" href="index.html">Browse listings</a>');
    return;
  }

  listing = data;
  document.title = `${data.title} · SecondChance Collective`;

  render(root);
  sb.rpc('bump_listing_view', { p_listing: id }).then(() => {}, () => {});
}

// ---------------------------------------------------------------------------
function render(root) {
  const l = listing;
  const c = settings.currency || 'JOD';
  const photos = (l.images || []).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const authenticated = l.checks?.some(k => k.verdict === 'authentic');
  const isMine = session.user?.id === l.seller_id;
  const available = l.status === 'active';

  const protection = Math.max(
    Math.round(l.price * Number(settings.buyer_protection_rate || 0.05) * 100) / 100,
    Number(settings.buyer_protection_min || 3));

  root.innerHTML = `
    <nav class="sc-sm sc-muted" style="margin-bottom:18px">
      <a href="index.html">Home</a> ·
      ${l.category ? `<a href="catalog-${esc(l.category.slug)}.html">${esc(l.category.name)}</a> · ` : ''}
      <span>${esc(l.title)}</span>
    </nav>

    <div class="it-grid">
      <div class="it-gallery">
        <div id="it-main-wrap">${mainMediaHtml(photos[0])}</div>
        ${photos.length > 1 ? `<div class="it-thumbs">${photos.map((p, i) =>
          `<button type="button" data-photo="${i}" class="${i === 0 ? 'is-active' : ''}"
             aria-label="${esc(isVideoMedia(p) ? 'Video' : p.slot || 'Photo ' + (i + 1))}">
             ${isVideoMedia(p)
               ? '<span class="it-thumb-video" aria-hidden="true">▶</span>'
               : `<img src="${esc(publicUrl('listing-photos', p.storage_path))}" alt="" loading="lazy">`}</button>`
        ).join('')}</div>` : ''}
      </div>

      <div class="it-side sc-stack">
        <div>
          <div class="sc-row-tight" style="margin-bottom:10px">
            ${authenticated ? '<span class="sc-badge sc-badge-ok sc-badge-dot">Authenticated</span>' : ''}
            ${l.is_featured ? '<span class="sc-badge sc-badge-accent">Featured</span>' : ''}
            ${!available ? badge(l.status) : ''}
          </div>
          ${l.brand || l.custom_brand ? `<p class="sc-eyebrow">${esc(l.brand?.name || l.custom_brand)}</p>` : ''}
          <h1 class="sc-h1" style="margin-top:5px">${esc(l.title)}</h1>
          <p class="it-price" style="margin-top:12px">${money(l.price, c)}
            ${l.original_retail ? `<span class="it-retail">${money(l.original_retail, c)}</span>` : ''}</p>
          ${l.original_retail ? `<p class="sc-xs" style="color:var(--sc-ok);margin-top:3px">
            ${Math.round((1 - l.price / l.original_retail) * 100)}% below retail</p>` : ''}
        </div>

        <dl class="sc-kv">
          ${l.condition ? `<dt>Condition</dt><dd>${esc(l.condition.label)}
            <span class="sc-xs sc-muted">${esc(l.condition.description || '')}</span></dd>` : ''}
          ${l.size_label ? `<dt>Size</dt><dd>${esc(l.size_label)}</dd>` : ''}
          ${l.color ? `<dt>Colour</dt><dd>${esc(l.color)}</dd>` : ''}
          ${l.category ? `<dt>Category</dt><dd>${esc(l.category.name)}</dd>` : ''}
          <dt>Reference</dt><dd>${esc(l.reference || '—')}</dd>
        </dl>

        ${l.description ? `<div>
          <p class="sc-eyebrow">From the seller</p>
          <p class="sc-lead" style="margin-top:6px">${esc(l.description)}</p></div>` : ''}

        <div class="sc-panel">
          <p class="sc-eyebrow">What you pay</p>
          <dl class="sc-kv" style="margin-top:10px">
            <dt>Item</dt><dd class="sc-money">${money(l.price, c)}</dd>
            <dt>Buyer Protection</dt><dd class="sc-money">${money(protection, c)}</dd>
            <dt>Total</dt><dd class="sc-money-lg">${money(l.price + protection, c)}</dd>
          </dl>
          <p class="sc-hint" style="margin-top:10px">
            Buyer Protection holds your payment until you have the piece and accept it.<br>
            You arrange the handover with the seller once the order is confirmed.</p>
        </div>

        ${available && !isMine ? `
          <button class="sc-btn sc-btn-primary sc-btn-block" style="height:48px" data-buy>Buy it now</button>
          <div class="sc-row-tight">
            <button class="sc-btn sc-btn-ghost sc-grow" data-save>
              ${session.isAuthed ? 'Save this piece' : 'Sign in to save'}</button>
            <button class="sc-btn sc-btn-ghost sc-grow" data-report>Report</button>
          </div>`
        : isMine ? `<div class="sc-note sc-note-info">This is your listing.
            <a href="account.html?tab=listings" style="text-decoration:underline">Manage it</a>.</div>`
        : `<div class="sc-note sc-note-warn">
            ${l.status === 'sold' ? 'This piece has sold.' : 'This piece is not available.'}</div>
           <a class="sc-btn sc-btn-ghost sc-btn-block" href="index.html">Find something similar</a>`}

        <div class="sc-card" style="padding:16px">
          <div class="sc-row-tight">
            ${l.seller?.avatar_url
              ? `<img class="sc-avatar" style="width:40px;height:40px" src="${esc(l.seller.avatar_url)}" alt="">`
              : `<span class="sc-avatar" style="width:40px;height:40px;background:var(--color-accent);color:#fff">
                   ${esc(initials(l.seller?.full_name || l.seller?.username))}</span>`}
            <div class="sc-grow">
              <p class="sc-sm" style="font-weight:500">${esc(l.seller?.username || l.seller?.full_name || 'Member')}</p>
              <p class="sc-xs sc-muted">${esc([l.seller?.area, l.seller?.city].filter(Boolean).join(', ') || 'Jordan')}
                · joined ${date(l.seller?.created_at)}</p>
            </div>
            ${l.seller?.seller_status === 'approved'
              ? '<span class="sc-badge sc-badge-ok">Verified</span>' : ''}
          </div>
        </div>

        <p class="sc-xs sc-muted">${num(l.view_count)} views · ${num(l.favorite_count)} saved</p>
      </div>
    </div>`;

  wire(root);
}

// ---------------------------------------------------------------------------
function wire(root) {
  const photos = (listing.images || []).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  root.querySelectorAll('[data-photo]').forEach(btn => btn.addEventListener('click', () => {
    const photo = photos[Number(btn.dataset.photo)];
    document.getElementById('it-main-wrap').innerHTML = mainMediaHtml(photo);
    root.querySelectorAll('[data-photo]').forEach(b => b.classList.toggle('is-active', b === btn));
  }));

  root.querySelector('[data-buy]')?.addEventListener('click', checkout);

  root.querySelector('[data-save]')?.addEventListener('click', async () => {
    if (!session.isAuthed) { location.href = `signin.html?next=item.html`; return; }
    const { error } = await sb.from('favorites')
      .insert({ user_id: session.user.id, listing_id: listing.id });
    if (error && !/duplicate/i.test(error.message)) return toast(errorMessage(error), 'danger');
    toast(error ? 'Already saved.' : 'Saved to your account.', 'ok');
  });

  root.querySelector('[data-report]')?.addEventListener('click', async () => {
    if (!session.isAuthed) { location.href = `signin.html?next=item.html`; return; }
    const result = await modal({
      title: 'Report this listing',
      body: `<form class="sc-stack">
        <div class="sc-field"><label class="sc-label">What is the problem?</label>
          <select class="sc-select" name="category">
            <option value="counterfeit">I think it is counterfeit</option>
            <option value="misleading">The description is misleading</option>
            <option value="prohibited">It should not be sold here</option>
            <option value="inappropriate">Inappropriate photos or wording</option>
            <option value="other">Something else</option>
          </select></div>
        <div class="sc-field"><label class="sc-label">Tell us more</label>
          <textarea class="sc-textarea" name="description" required></textarea></div>
      </form>
      <p class="sc-hint" style="margin-top:12px">
        Reports go to our trust team, never to the seller, and are never attributed to you.</p>`,
      actions: [{ label: 'Cancel', value: false }, { label: 'Send report', value: true, kind: 'sc-btn-primary' }],
    });
    if (result?.value !== true) return;
    const { error } = await sb.from('reports').insert({
      reporter_id: session.user.id, target_type: 'listing', target_listing_id: listing.id,
      category: result.values.category, description: result.values.description,
    });
    toast(error ? errorMessage(error) : 'Report sent. Thank you.', error ? 'danger' : 'ok');
  });
}

// ---------------------------------------------------------------------------
async function checkout() {
  if (!session.isAuthed) {
    location.href = `signin.html?next=item.html`;
    return;
  }

  const p = session.profile || {};
  const c = settings.currency || 'JOD';
  const protection = Math.max(
    Math.round(listing.price * Number(settings.buyer_protection_rate || 0.05) * 100) / 100,
    Number(settings.buyer_protection_min || 3));
  const total = listing.price + protection;

  const result = await modal({
    size: 'lg',
    title: 'Checkout',
    body: `
      <div class="sc-panel" style="margin-bottom:18px">
        <div class="sc-between">
          <div><p class="sc-sm" style="font-weight:500">${esc(listing.title)}</p>
            <p class="sc-xs sc-muted">${esc(listing.brand?.name || listing.custom_brand || '')} · ${esc(listing.reference || '')}</p></div>
          <p class="sc-money-lg">${money(total, c)}</p>
        </div>
      </div>

      <form class="sc-stack">
        <p class="sc-eyebrow">How the seller reaches you</p>
        <div class="sc-field"><label class="sc-label">Full name</label>
          <input class="sc-input" name="name" required value="${esc(p.full_name || '')}"></div>
        <div class="sc-field"><label class="sc-label">Mobile number</label>
          <input class="sc-input" name="phone" required value="${esc(p.phone || '')}" placeholder="07 9999 9999"></div>
        <div class="sc-field"><label class="sc-label">City</label>
          <select class="sc-select" name="city" required>
            ${CITIES.map(x => `<option ${p.city === x ? 'selected' : ''}>${x}</option>`).join('')}
          </select></div>
        <div class="sc-field"><label class="sc-label">Note for the seller <span class="sc-muted sc-xs">optional</span></label>
          <input class="sc-input" name="notes" placeholder="When and where suits you"></div>

        <hr class="sc-divider">
        <p class="sc-eyebrow">How you pay</p>
        <div class="sc-choice">
          ${PAYMENT_METHODS.map((m, i) => `
            <label><input type="radio" name="method" value="${m.value}" ${i === 0 ? 'checked' : ''}>
              <span class="sc-choice-body">
                <span class="sc-choice-title">${esc(m.label)}</span>
                <span class="sc-choice-desc">${esc(m.note)}</span></span></label>`).join('')}
        </div>

        <div class="sc-field"><label class="sc-label">Discount code <span class="sc-muted sc-xs">optional</span></label>
          <input class="sc-input" name="discount" placeholder="Enter a code"></div>

        <div class="sc-note sc-note-info">
          Your payment is held until the piece reaches you and you accept it.
          ${listing.price >= Number(settings.authentication_threshold || 350)
            ? ' This piece is authenticated in Amman before the handover, which adds a day or two.' : ''}
        </div>
      </form>`,
    actions: [
      { label: 'Cancel', value: false },
      { label: `Place order · ${money(total, c)}`, value: true, kind: 'sc-btn-primary' },
    ],
  });

  if (result?.value !== true) return;
  const v = result.values;

  if (!v.name || !v.phone) {
    return toast('We need your name and mobile number.', 'danger');
  }

  const { data: orderId, error } = await sb.rpc('place_order', {
    p_listing: listing.id,
    p_method: v.method,
    p_name: v.name, p_phone: v.phone, p_city: v.city,
    p_notes: v.notes || null,
    p_discount_code: v.discount || null,
  });

  if (error) return toast(errorMessage(error), 'danger');

  await modal({
    title: 'Order placed',
    body: `<p class="sc-lead">
        We have told the seller.${listing.price >= Number(settings.authentication_threshold || 350)
          ? ' The piece goes to our authenticators in Amman first, then you arrange the handover between you.'
          : ' You can arrange the handover between you now.'}
      </p>
      <p class="sc-lead" style="margin-top:10px">
        You will get updates at every step, and your payment stays protected until you accept it.</p>`,
    actions: [{ label: 'See my order', value: 'go', kind: 'sc-btn-primary' }],
  });

  location.href = 'account.html?tab=orders';
}
