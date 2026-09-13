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
import { PHOTO_SLOTS, VIDEO_SLOT, MAX_VIDEO_MB } from './config.js';

const ALL_SLOTS = [...PHOTO_SLOTS, VIDEO_SLOT];
const files = new Map();          // tile key (front/back/…/extra1…/video) -> File

// The exact types the storage bucket accepts — the file-picker `accept`
// attribute is advisory and never applies to drag-and-drop, so both paths
// check against these before attaching.
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];

// Photos run through compressImage first (it converts anything the browser
// can decode into a 1600px JPEG), so the check sees what would actually
// upload. Returns the vetted file, or null after showing a toast.
async function vetMedia(file, isVideo) {
  if (isVideo) {
    if (!VIDEO_TYPES.includes(file.type)) { toast('Videos need to be MP4, MOV or WEBM.', 'danger'); return null; }
    if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
      toast(`That video is over ${MAX_VIDEO_MB} MB. Trim it or lower the quality.`, 'danger'); return null;
    }
    return file;
  }
  const processed = await compressImage(file);
  if (!PHOTO_TYPES.includes(processed.type)) { toast('Photos need to be JPG, PNG or WEBP.', 'danger'); return null; }
  if (processed.size > 10 * 1024 * 1024) { toast('That photo is over 10 MB. Try a smaller one.', 'danger'); return null; }
  return processed;
}
let settings = null;
let taxonomy = { brands: [], categories: [], conditions: [], colors: [] };

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

  // Without the live brand/category lists the form would submit names where
  // the database expects ids — keep it locked and offer a reload instead.
  if (!await loadTaxonomy()) return showTaxonomyError(form);
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
  const [brands, categories, conditions, colors] = await Promise.all([
    sb.from('brands').select('id,name,slug').eq('is_active', true).order('sort_order'),
    sb.from('categories').select('id,name,slug').eq('is_active', true).order('sort_order'),
    sb.from('conditions').select('code,label').eq('is_active', true).order('sort_order'),
    sb.from('colors').select('name').eq('is_active', true).order('sort_order'),
  ]);
  if (brands.error || categories.error || conditions.error) return false;
  taxonomy = {
    brands: brands.data || [],
    categories: categories.data || [],
    conditions: conditions.data || [],
    // Colour is optional, so a failed colours query keeps the free-text field
    // instead of locking the whole form.
    colors: colors.error ? [] : (colors.data || []),
  };

  // Replace the hard-coded suggestion lists with what is actually in the database.
  // The brand field is a free-text input backed by a datalist, so sellers can
  // type a brand that is not listed yet.
  const brandList = document.getElementById('brand-options');
  if (brandList && taxonomy.brands.length) {
    brandList.innerHTML = taxonomy.brands
      .map(b => `<option value="${esc(b.name)}"></option>`).join('');
  }
  const catSelect = document.getElementById('category');
  if (catSelect && taxonomy.categories.length) {
    catSelect.innerHTML = '<option value="">Choose one</option>' +
      taxonomy.categories.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
  }

  // The colour field ships as free text; with the list loaded it becomes a
  // dropdown so colours stay consistent and filterable.
  const colourInput = document.getElementById('colour');
  if (colourInput && colourInput.tagName === 'INPUT' && taxonomy.colors.length) {
    const select = document.createElement('select');
    select.id = 'colour';
    select.name = 'colour';
    select.className = colourInput.className;
    select.innerHTML = '<option value="">Choose one</option>' +
      taxonomy.colors.map(c => `<option value="${esc(c.name)}">${esc(c.name)}</option>`).join('');
    const hint = colourInput.parentElement?.querySelector('p');
    if (hint) hint.textContent = 'Pick the closest match.';
    colourInput.replaceWith(select);
  }
  return taxonomy.categories.length > 0;
}

function showTaxonomyError(form) {
  const notice = document.createElement('div');
  notice.className = 'sc';
  notice.innerHTML = `
    <div class="sc-note sc-note-warn" style="margin-bottom:20px">
      <strong>Could not load the listing form.</strong>
      The brand and category lists did not load — check your connection and
      <a href="sell.html" style="text-decoration:underline">reload the page</a>.
    </div>`;
  form.parentNode.insertBefore(notice, form);
  form.style.opacity = '.5';
  form.style.pointerEvents = 'none';
}

// Case- and accent-insensitive match of typed text against the known brands,
// so "toteme", "TOTÊME" and "Totême" all resolve to the same row.
function normalizeBrand(text) {
  return String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '');
}
function matchBrand(text) {
  const wanted = normalizeBrand(text);
  if (!wanted) return null;
  return taxonomy.brands.find(b =>
    normalizeBrand(b.name) === wanted || normalizeBrand(b.slug) === wanted) || null;
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
const tileBySlot = new Map();     // slot key -> tile element
const specBySlot = new Map();     // slot key -> slot spec
let swapFrom = null;              // slot armed for a swap, or null

function buildPhotoTiles(form) {
  const tiles = [...form.querySelectorAll('div[class*="aspect-square"]')].slice(0, ALL_SLOTS.length);
  if (!tiles.length) return;

  tiles.forEach((tile, index) => {
    const spec = ALL_SLOTS[index] || { slot: `extra${index}`, label: 'Photo', note: '' };
    const isVideo = spec.slot === 'video';
    tile.classList.add('sc');
    tile.style.position = 'relative';
    tile.style.cursor = 'pointer';
    tile.dataset.slot = spec.slot;
    tileBySlot.set(spec.slot, tile);
    specBySlot.set(spec.slot, spec);

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = isVideo ? 'video/mp4,video/quicktime,video/webm' : 'image/jpeg,image/png,image/webp';
    input.setAttribute('aria-label', `${spec.label} ${isVideo ? 'video' : 'photo'}`);
    Object.assign(input.style, {
      position: 'absolute', inset: '0', width: '100%', height: '100%',
      opacity: '0', cursor: 'pointer', zIndex: '3',
    });
    tile.appendChild(input);

    // While a swap is armed, a tap on any other photo tile completes the swap
    // instead of opening the file picker. Capture phase so it runs before the
    // input's default; preventDefault keeps the picker shut.
    tile.addEventListener('click', e => {
      if (!swapFrom) return;
      e.preventDefault();
      e.stopPropagation();
      if (spec.slot === 'video' || swapFrom === 'video') {
        toast('The video stays in its own box — swapping only works between photos.', 'danger');
        disarmSwap();
        return;
      }
      if (swapFrom === spec.slot) { disarmSwap(); return; }
      performSwap(swapFrom, spec.slot);
    }, true);

    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      const vetted = await vetMedia(file, isVideo);
      if (vetted) attachPhoto(tile, spec, vetted);
    });

    tile.addEventListener('dragover', e => { e.preventDefault(); tile.style.borderColor = 'var(--color-accent)'; });
    tile.addEventListener('dragleave', () => { tile.style.borderColor = ''; });
    tile.addEventListener('drop', async e => {
      e.preventDefault();
      tile.style.borderColor = '';
      const file = e.dataTransfer.files?.[0];
      if (!file) return;
      const vetted = await vetMedia(file, isVideo);
      if (vetted) attachPhoto(tile, spec, vetted);
    });
  });
}

function disarmSwap() {
  if (swapFrom) tileBySlot.get(swapFrom)?.style.removeProperty('outline');
  swapFrom = null;
}

function performSwap(a, b) {
  const fa = files.get(a), fb = files.get(b);
  if (fa) files.set(b, fa); else files.delete(b);
  if (fb) files.set(a, fb); else files.delete(a);
  disarmSwap();
  renderPreview(a);
  renderPreview(b);
}

function attachPhoto(tile, spec, file) {
  files.set(spec.slot, file);
  renderPreview(spec.slot);
}

// Draw (or clear) the preview for a slot from whatever is in `files`.
function renderPreview(slot) {
  const tile = tileBySlot.get(slot);
  const spec = specBySlot.get(slot);
  if (!tile || !spec) return;

  tile.querySelector('[data-preview]')?.remove();
  const input = tile.querySelector('input[type=file]');
  if (input) input.value = '';

  const file = files.get(slot);
  if (!file) return;

  const preview = document.createElement('div');
  preview.setAttribute('data-preview', '');
  // Above the invisible file input so its buttons actually receive taps;
  // the container itself lets clicks fall through, so tapping the picture
  // still opens the picker to replace it.
  Object.assign(preview.style, { position: 'absolute', inset: '0', zIndex: '4', pointerEvents: 'none' });
  const url = URL.createObjectURL(file);
  const mediaTag = file.type.startsWith('video/')
    ? `<video src="${url}" muted playsinline
         style="width:100%;height:100%;object-fit:cover;border-radius:inherit"></video>`
    : `<img src="${url}" alt="${esc(spec.label)}"
         style="width:100%;height:100%;object-fit:cover;border-radius:inherit">`;
  const btnStyle = 'width:30px;height:30px;border:0;border-radius:999px;background:rgba(16,17,20,.78);'
    + 'color:#fff;cursor:pointer;font-size:15px;line-height:1;pointer-events:auto;display:grid;place-items:center';
  preview.innerHTML = `
    ${mediaTag}
    <button type="button" data-clear aria-label="Remove ${esc(spec.label)} ${slot === 'video' ? 'video' : 'photo'}"
      style="position:absolute;top:8px;right:8px;${btnStyle}">✕</button>
    ${slot === 'video' ? '' : `
    <button type="button" data-swap aria-label="Swap ${esc(spec.label)} photo with another box"
      style="position:absolute;top:8px;left:8px;${btnStyle}">⇄</button>`}
    <span style="position:absolute;left:8px;bottom:8px;background:rgba(16,17,20,.72);color:#fff;
                 font-size:10px;padding:2px 7px;border-radius:999px">${esc(spec.label)}</span>`;

  preview.querySelector('[data-clear]').addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    disarmSwap();
    files.delete(slot);
    renderPreview(slot);
  });

  preview.querySelector('[data-swap]')?.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    if (swapFrom === slot) { disarmSwap(); return; }
    if (swapFrom) { performSwap(swapFrom, slot); return; }
    swapFrom = slot;
    tile.style.outline = '2px solid var(--color-accent)';
    toast('Now tap the photo to swap it with. Tap ⇄ again to cancel.');
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
    box.innerHTML = `
      <p class="sc-eyebrow">On this price</p>
      <dl class="sc-kv" style="margin-top:10px">
        <dt>Your listing price</dt><dd class="sc-money">${money(value, settings.currency)}</dd>
        <dt>Platform fee (${(rate * 100).toFixed(0)}%)</dt><dd class="sc-money">− ${money(commission, settings.currency)}</dd>
        <dt>You'll receive</dt><dd class="sc-money-lg" style="color:var(--color-accent)">${money(takeHome, settings.currency)}</dd>
      </dl>
      <p class="sc-hint" style="margin-top:10px">You hand it to the buyer directly, and the payout is released once they accept.</p>`;
  };

  price.addEventListener('input', update);
  update();
}

// ---------------------------------------------------------------------------
// Submit
// ---------------------------------------------------------------------------
function readForm(form) {
  const get = id => form.querySelector('#' + id)?.value?.trim() || '';
  const typedBrand = get('brand');
  const brandMatch = matchBrand(typedBrand);
  return {
    brand_id: brandMatch ? brandMatch.id : null,
    custom_brand: brandMatch || !typedBrand ? null : typedBrand.slice(0, 80),
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

// Publishing requires the whole form filled in; only drafts may be partial.
function validate(data, { draft }) {
  const problems = [];
  if (!data.title) problems.push('Add a model or description so buyers can find it.');
  if (!draft) {
    if (!data.brand_id && !data.custom_brand) problems.push('Choose a brand — or type it if it is not in the list.');
    if (!data.category_id) problems.push('Choose a category.');
    if (!data.condition_code) problems.push('Choose a condition.');
    if (!data.size_label) problems.push('Add the size as marked on the item.');
    if (!data.color) problems.push('Pick a colour.');
    if (!data.description) problems.push('Tell buyers a little more in the description.');
    if (!data.price || data.price <= 0) problems.push('Set an asking price.');
    if (!data.original_retail) problems.push('Add the original retail price.');
    if (!files.has('front')) problems.push('Add the front photo.');
    if (!files.has('back')) problems.push('Add the back photo.');
    if (!files.has('detail')) problems.push('Add the detail photo.');
    if (!files.has('label')) problems.push('Add the label photo — buyers look for it first.');
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

  // If the media upload fails after the listings row exists, remove the row
  // again — otherwise every retry would create another copy in the queue.
  let created = null;
  const discardStranded = async id => {
    try {
      await sb.from('listings').update({ status: 'draft' }).eq('id', id);
      await sb.from('listings').delete().eq('id', id);
    } catch { /* best effort */ }
  };

  try {
    const { data: listing, error } = await sb.from('listings').insert({
      seller_id: session.user.id,
      ...data,
      currency: settings.currency || 'JOD',
      status: isDraft ? 'draft' : 'pending_review',
    }).select('id, reference').single();
    if (error) throw error;
    created = listing;

    // upload the media under {uid}/{listing}/… so the storage policy matches
    const EXT = {
      'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
      'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm',
    };
    const uploads = [...files.entries()].map(async ([key, file], index) => {
      const ext = EXT[file.type] || (file.type.startsWith('video/') ? 'mp4' : 'jpg');
      const path = `${session.user.id}/${listing.id}/${key}.${ext}`;
      const { error: upErr } = await sb.storage.from('listing-photos')
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      // The DB slot check allows front/back/detail/label/extra/video —
      // the numbered extra tiles all store as 'extra'. The video sorts last.
      return {
        listing_id: listing.id,
        storage_path: path,
        slot: /^extra\d+$/.test(key) ? 'extra' : key,
        sort_order: key === 'video' ? 99 : index,
      };
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
    if (created) await discardStranded(created.id);
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
    // The brand field shows the name; older drafts stored only the id.
    const brandName = saved.custom_brand
      || taxonomy.brands.find(b => b.id === saved.brand_id)?.name || '';
    set('brand', brandName); set('category', saved.category_id);
    if (saved.condition_code) {
      const radio = form.querySelector(`input[name=condition][value="${saved.condition_code}"]`);
      if (radio) radio.checked = true;
    }
    form.querySelector('#price')?.dispatchEvent(new Event('input'));
  } catch {}
}
