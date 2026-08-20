// ============================================================================
// SecondChance Collective — "List an item"
//
// This enhances the markup that is already on sell.html rather than replacing
// it: the fields there already carry the right ids and names, so we switch the
// prototype notice off, turn the four photo tiles into real upload targets,
// and wire the submit.
// ============================================================================

import {
  sb, session, loadSession, getSettings, toast, esc, money,
  compressImage, errorMessage, modal,
} from './sc-core.js';
import { PHOTO_SLOTS } from './config.js';

const files = new Map();          // slot -> File
let settings = null;
let taxonomy = { brands: [], categories: [], conditions: [] };

const CONDITION_BY_LABEL = {
  'New with tags': 'new_with_tags',
  'New without tags': 'new_without_tags',
  'Very good': 'very_good',
  'Good': 'good',
  'Fair': 'fair',
};

// ---------------------------------------------------------------------------
export async function initSell() {
  const form = document.querySelector('#main form') || document.querySelector('form:not([role=search])');
  if (!form) return;

  await loadSession();
  settings = await getSettings();

  if (!session.isAuthed) return showSignInGate(form);

  await loadTaxonomy();
  enableForm(form);
  buildPhotoTiles(form);
  wireConditions(form);
  wirePayoutPreview(form);
  wireSubmit(form);
  await restoreDraft(form);
}

// ---------------------------------------------------------------------------
function showSignInGate(form) {
  const notice = document.createElement('div');
  notice.className = 'sc';
  notice.innerHTML = `
    <div class="sc-note sc-note-info" style="margin-bottom:20px">
      <strong>Sign in to list a piece.</strong>
      Your listing, photos and payout details stay with your account.
      <p style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
        <a class="sc-btn sc-btn-primary sc-btn-sm" href="signin.html?next=sell.html">Sign in</a>
        <a class="sc-btn sc-btn-ghost sc-btn-sm" href="signup.html">Create an account</a>
      </p>
    </div>`;
  form.parentNode.insertBefore(notice, form);
  form.style.opacity = '.5';
  form.style.pointerEvents = 'none';
}

async function loadTaxonomy() {
  const [brands, categories, conditions] = await Promise.all([
    sb.from('brands').select('id,name,slug').eq('is_active', true).order('sort_order'),
    sb.from('categories').select('id,name,slug').eq('is_active', true).order('sort_order'),
    sb.from('conditions').select('code,label').eq('is_active', true).order('sort_order'),
  ]);
  taxonomy = {
    brands: brands.data || [],
    categories: categories.data || [],
    conditions: conditions.data || [],
  };

  // Replace the hard-coded option lists with what is actually in the database
  const brandSelect = document.getElementById('brand');
  if (brandSelect && taxonomy.brands.length) {
    brandSelect.innerHTML = '<option value="">Choose one</option>' +
      taxonomy.brands.map(b => `<option value="${b.id}">${esc(b.name)}</option>`).join('');
  }
  const catSelect = document.getElementById('category');
  if (catSelect && taxonomy.categories.length) {
    catSelect.innerHTML = '<option value="">Choose one</option>' +
      taxonomy.categories.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
  }
}

function enableForm(form) {
  form.querySelectorAll('[disabled]').forEach(el => el.removeAttribute('disabled'));
  form.querySelectorAll('.cursor-not-allowed').forEach(el => el.classList.remove('cursor-not-allowed'));
  document.getElementById('sell-disabled')?.remove();

  // the visible "Not wired up yet" panel
  [...document.querySelectorAll('#main *')].forEach(el => {
    if (el.children.length === 0 && /not wired up yet/i.test(el.textContent)) {
      el.closest('div[class*="rounded"], aside, section')?.remove();
    }
  });
}

// ---------------------------------------------------------------------------
// Photos — turn the four static tiles into upload targets
// ---------------------------------------------------------------------------
function buildPhotoTiles(form) {
  const tiles = [...form.querySelectorAll('div[class*="aspect-square"]')].slice(0, 4);
  if (!tiles.length) return;

  tiles.forEach((tile, index) => {
    const spec = PHOTO_SLOTS[index] || { slot: `extra${index}`, label: 'Photo', note: '' };
    tile.classList.add('sc');
    tile.style.position = 'relative';
    tile.style.cursor = 'pointer';
    tile.dataset.slot = spec.slot;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp';
    input.setAttribute('aria-label', `${spec.label} photo`);
    Object.assign(input.style, {
      position: 'absolute', inset: '0', width: '100%', height: '100%',
      opacity: '0', cursor: 'pointer', zIndex: '3',
    });
    tile.appendChild(input);

    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) return toast('That photo is over 10 MB. Try a smaller one.', 'danger');
      await attachPhoto(tile, spec, await compressImage(file));
    });

    tile.addEventListener('dragover', e => { e.preventDefault(); tile.style.borderColor = 'var(--color-accent)'; });
    tile.addEventListener('dragleave', () => { tile.style.borderColor = ''; });
    tile.addEventListener('drop', async e => {
      e.preventDefault();
      tile.style.borderColor = '';
      const file = e.dataTransfer.files?.[0];
      if (file?.type.startsWith('image/')) await attachPhoto(tile, spec, await compressImage(file));
    });
  });
}

async function attachPhoto(tile, spec, file) {
  files.set(spec.slot, file);

  tile.querySelector('[data-preview]')?.remove();
  const preview = document.createElement('div');
  preview.setAttribute('data-preview', '');
  Object.assign(preview.style, { position: 'absolute', inset: '0', zIndex: '2' });
  preview.innerHTML = `
    <img src="${URL.createObjectURL(file)}" alt="${esc(spec.label)}"
         style="width:100%;height:100%;object-fit:cover;border-radius:inherit">
    <button type="button" data-clear aria-label="Remove ${esc(spec.label)} photo"
      style="position:absolute;top:8px;right:8px;width:26px;height:26px;border:0;border-radius:999px;
             background:rgba(16,17,20,.72);color:#fff;cursor:pointer;font-size:14px;line-height:1;z-index:4">✕</button>
    <span style="position:absolute;left:8px;bottom:8px;background:rgba(16,17,20,.72);color:#fff;
                 font-size:10px;padding:2px 7px;border-radius:999px">${esc(spec.label)}</span>`;

  preview.querySelector('[data-clear]').addEventListener('click', e => {
    e.stopPropagation();
    files.delete(spec.slot);
    preview.remove();
    const input = tile.querySelector('input[type=file]');
    if (input) input.value = '';
  });

  tile.appendChild(preview);
}

// ---------------------------------------------------------------------------
function wireConditions(form) {
  form.querySelectorAll('input[name=condition]').forEach(radio => {
    const label = radio.closest('label');
    const text = label?.querySelector('span')?.textContent?.trim();
    radio.value = CONDITION_BY_LABEL[text] || (text || '').toLowerCase().replace(/\s+/g, '_');
  });
}

// Live "what you take home" figures on the existing sidebar
function wirePayoutPreview(form) {
  const price = form.querySelector('#price');
  if (!price) return;

  const aside = document.querySelector('aside');
  const update = () => {
    const value = parseFloat(String(price.value).replace(/[^\d.]/g, '')) || 0;
    if (!aside || !value) return;

    const rate = Number(settings.commission_rate || 0.12);
    const commission = Math.round(value * rate * 100) / 100;
    const takeHome = Math.round((value - commission) * 100) / 100;

    let box = aside.querySelector('[data-payout-live]');
    if (!box) {
      box = document.createElement('div');
      box.setAttribute('data-payout-live', '');
      box.className = 'sc sc-panel';
      box.style.marginBottom = '16px';
      aside.prepend(box);
    }
    const needsAuth = value >= Number(settings.authentication_threshold || 350);
    box.innerHTML = `
      <p class="sc-eyebrow">On this price</p>
      <dl class="sc-kv" style="margin-top:10px">
        <dt>Buyer pays</dt><dd class="sc-money">${money(value, settings.currency)}</dd>
        <dt>Commission (${(rate * 100).toFixed(0)}%)</dt><dd class="sc-money">− ${money(commission, settings.currency)}</dd>
        <dt>You receive</dt><dd class="sc-money-lg" style="color:var(--color-accent)">${money(takeHome, settings.currency)}</dd>
      </dl>
      <p class="sc-hint" style="margin-top:10px">${needsAuth
        ? 'Over the authentication threshold, so we collect and check this piece in Amman first.'
        : 'Under the authentication threshold. It ships straight to the buyer.'}</p>`;
  };

  price.addEventListener('input', update);
  update();
}

// ---------------------------------------------------------------------------
// Submit
// ---------------------------------------------------------------------------
function readForm(form) {
  const get = id => form.querySelector('#' + id)?.value?.trim() || '';
  return {
    brand_id: get('brand') || null,
    category_id: get('category') || null,
    title: get('title'),
    size_label: get('size') || null,
    color: get('colour') || null,
    description: get('notes') || null,
    price: parseFloat(String(get('price')).replace(/[^\d.]/g, '')) || 0,
    original_retail: parseFloat(String(get('retail')).replace(/[^\d.]/g, '')) || null,
    condition_code: form.querySelector('input[name=condition]:checked')?.value || null,
  };
}

function validate(data, { draft }) {
  const problems = [];
  if (!data.title) problems.push('Add a model or description so buyers can find it.');
  if (!draft) {
    if (!data.brand_id) problems.push('Choose a brand.');
    if (!data.category_id) problems.push('Choose a category.');
    if (!data.condition_code) problems.push('Choose a condition.');
    if (!data.price || data.price <= 0) problems.push('Set an asking price.');
    if (!files.has('front')) problems.push('Add the front photo.');
    if (!files.has('label')) problems.push('Add the label photo — authentication starts from it.');
  }
  return problems;
}

function wireSubmit(form) {
  const buttons = [...form.querySelectorAll('button')];
  const publish = buttons.find(b => /publish listing/i.test(b.textContent));
  const draft = buttons.find(b => /save as draft/i.test(b.textContent));

  publish?.addEventListener('click', e => { e.preventDefault(); submit(form, publish, false); });
  draft?.addEventListener('click', e => { e.preventDefault(); submit(form, draft, true); });
  form.addEventListener('submit', e => { e.preventDefault(); if (publish) submit(form, publish, false); });

  // keep a local copy so a refresh doesn't lose the typing
  form.addEventListener('input', () => {
    try { localStorage.setItem('sc_listing_draft', JSON.stringify(readForm(form))); } catch {}
  });
}

async function submit(form, button, isDraft) {
  const data = readForm(form);
  const problems = validate(data, { draft: isDraft });

  if (problems.length) {
    await modal({
      title: isDraft ? 'Add a title first' : 'A few things are missing',
      body: `<ul class="sc-lead" style="padding-left:18px;display:grid;gap:6px">
               ${problems.map(p => `<li>${esc(p)}</li>`).join('')}</ul>`,
      actions: [{ label: 'Got it', value: 'ok', kind: 'sc-btn-primary' }],
    });
    return;
  }

  const original = button.innerHTML;
  button.disabled = true;
  button.innerHTML = `<span class="sc-spinner"></span>${isDraft ? 'Saving' : 'Publishing'}`;

  try {
    const { data: listing, error } = await sb.from('listings').insert({
      seller_id: session.user.id,
      ...data,
      currency: settings.currency || 'JOD',
      status: isDraft ? 'draft' : 'pending_review',
    }).select('id, reference').single();
    if (error) throw error;

    // upload the photos under {uid}/{listing}/… so the storage policy matches
    const uploads = [...files.entries()].map(async ([slot, file], index) => {
      const path = `${session.user.id}/${listing.id}/${slot}.jpg`;
      const { error: upErr } = await sb.storage.from('listing-photos')
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      return { listing_id: listing.id, storage_path: path, slot, sort_order: index };
    });

    const rows = await Promise.all(uploads);
    if (rows.length) {
      const { error: imgErr } = await sb.from('listing_images').insert(rows);
      if (imgErr) throw imgErr;
    }

    localStorage.removeItem('sc_listing_draft');

    await modal({
      title: isDraft ? 'Draft saved' : 'Listing submitted',
      body: `<p class="sc-lead">${isDraft
        ? 'It is in your account under Drafts. Finish it whenever you like.'
        : `Reference <strong>${esc(listing.reference || '')}</strong>. Our team reviews listings before they reach the feed — usually within a day. You will get a notification either way.`}</p>`,
      actions: [
        { label: 'List another', value: 'again' },
        { label: 'View my listings', value: 'account', kind: 'sc-btn-primary' },
      ],
    }).then(result => {
      if (result?.value === 'account') location.href = 'account.html?tab=listings';
      else location.reload();
    });
  } catch (err) {
    button.disabled = false;
    button.innerHTML = original;
    toast(errorMessage(err), 'danger');
  }
}

async function restoreDraft(form) {
  try {
    const saved = JSON.parse(localStorage.getItem('sc_listing_draft') || 'null');
    if (!saved?.title) return;
    const set = (id, value) => { const el = form.querySelector('#' + id); if (el && value) el.value = value; };
    set('title', saved.title); set('size', saved.size_label); set('colour', saved.color);
    set('notes', saved.description); set('price', saved.price); set('retail', saved.original_retail);
    set('brand', saved.brand_id); set('category', saved.category_id);
    if (saved.condition_code) {
      const radio = form.querySelector(`input[name=condition][value="${saved.condition_code}"]`);
      if (radio) radio.checked = true;
    }
    form.querySelector('#price')?.dispatchEvent(new Event('input'));
  } catch {}
}
