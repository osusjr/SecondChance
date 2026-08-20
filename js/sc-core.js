// ============================================================================
// SecondChance Collective — core runtime
// Shared by every functional page: client, session, formatting, UI primitives.
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.3';
import { SUPABASE_URL, SUPABASE_ANON_KEY, DEFAULTS } from './config.js';

// Fail loudly and legibly if the key has not been filled in. Without this
// the first request comes back "Invalid API key", which reads like a
// Supabase fault rather than a one-line config fix.
const KEY_MISSING = !SUPABASE_ANON_KEY
  || /PASTE_YOUR|YOUR-ANON|YOUR-PROJECT-REF/.test(SUPABASE_ANON_KEY + SUPABASE_URL);

if (KEY_MISSING) {
  const message = 'js/config.js still has a placeholder. Paste your Supabase '
    + 'publishable key (Project Settings → API Keys) into SUPABASE_ANON_KEY.';
  console.error('[SecondChance] ' + message);
  addEventListener('DOMContentLoaded', () => {
    const bar = document.createElement('div');
    bar.setAttribute('role', 'alert');
    bar.style.cssText = 'position:fixed;inset:0 0 auto 0;z-index:9999;padding:12px 16px;'
      + 'background:#872222;color:#fff;font:500 13.5px/1.5 system-ui,sans-serif;text-align:center';
    bar.textContent = message;
    document.body.prepend(bar);
  });
}

// A session stored under a previous key cannot be refreshed after the key is
// swapped, and a client that keeps retrying a dead token stalls every page that
// waits on it. Clear anything that does not belong to the current project.
try {
  const ref = (SUPABASE_URL.match(/https:\/\/([^.]+)\./) || [])[1];
  for (const k of Object.keys(localStorage)) {
    if (k.startsWith('sb-') && k.endsWith('-auth-token') && ref && !k.includes(ref)) {
      localStorage.removeItem(k);
      console.info('[SecondChance] cleared a session from a different project:', k);
    }
  }
} catch { /* private browsing blocks localStorage; nothing to clean */ }

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

// ---------------------------------------------------------------------------
// Session & identity
// ---------------------------------------------------------------------------
const state = { user: null, profile: null, admin: null, settings: null, loaded: false };

export async function loadSession({ force = false } = {}) {
  if (state.loaded && !force) return state;

  const { data: { user } } = await sb.auth.getUser();
  state.user = user || null;
  state.profile = null;
  state.admin = null;

  if (user) {
    const [{ data: profile }, { data: admin }] = await Promise.all([
      sb.from('profiles').select('*').eq('id', user.id).maybeSingle(),
      sb.from('admin_users')
        .select('id, is_active, totp_enabled, role:admin_roles(id, key, name, permissions)')
        .eq('user_id', user.id).eq('is_active', true).maybeSingle(),
    ]);
    state.profile = profile || null;
    state.admin = admin || null;
  }

  state.loaded = true;
  return state;
}

export const session = {
  get user()     { return state.user; },
  get profile()  { return state.profile; },
  get admin()    { return state.admin; },
  get isAuthed() { return !!state.user; },
  get isSeller() { return state.profile?.seller_status === 'approved'; },
  get isAdmin()  { return !!state.admin; },
  get roleName() { return state.admin?.role?.name || null; },
  can(perm) {
    const perms = state.admin?.role?.permissions || [];
    return perms.includes('*') || perms.includes(perm);
  },
};

/**
 * Race a promise against the clock. Supabase calls normally resolve with an
 * {error} rather than throwing, but a dead connection, a stalled auth lock or
 * a blocked CDN can leave one pending forever — and a pending promise on a
 * boot path shows the user a spinner with no end and no explanation.
 */
export function withTimeout(promise, ms = 8000, label = 'request') {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)),
  ]);
}

export const SETTINGS_FALLBACK = {
  commission_rate: DEFAULTS.commissionRate,
  authentication_threshold: DEFAULTS.authThreshold,
  buyer_protection_rate: DEFAULTS.buyerProtectionRate,
  buyer_protection_min: DEFAULTS.buyerProtectionMin,
  currency: DEFAULTS.currency,
};

/**
 * Never throws, never hangs. Settings are presentation detail — a page must
 * still render if they cannot be read.
 */
export async function getSettings() {
  if (state.settings) return state.settings;
  let data = null;
  try {
    ({ data } = await withTimeout(
      sb.from('platform_settings').select('*').maybeSingle(), 6000, 'platform_settings'));
  } catch (err) {
    console.warn('[SecondChance] settings unavailable, using defaults:', err.message);
  }
  state.settings = data || {
    commission_rate: DEFAULTS.commissionRate,
    authentication_threshold: DEFAULTS.authThreshold,
    buyer_protection_rate: DEFAULTS.buyerProtectionRate,
    buyer_protection_min: DEFAULTS.buyerProtectionMin,
    currency: DEFAULTS.currency,
  };
  return state.settings;
}

export async function signOut() {
  await sb.auth.signOut();
  location.href = 'index.html';
}

/** Redirect to sign-in unless the visitor meets the requirement. */
export async function requireAuth({ seller = false, admin = false, perm = null } = {}) {
  await loadSession();
  const back = encodeURIComponent(location.pathname.split('/').pop() + location.search);

  if (!session.isAuthed) { location.href = `signin.html?next=${back}`; return false; }

  if (session.profile?.account_status === 'blocked') {
    document.body.innerHTML = blockedScreen('Your account has been blocked.');
    return false;
  }
  if (session.profile?.account_status === 'suspended') {
    document.body.innerHTML = blockedScreen(
      session.profile.suspended_reason || 'Your account is suspended.');
    return false;
  }
  if (admin && !session.isAdmin) { location.href = 'index.html'; return false; }
  if (perm && !session.can(perm)) {
    document.body.innerHTML = blockedScreen('You do not have access to this area.');
    return false;
  }
  if (seller && !session.isSeller) { location.href = 'seller-apply.html'; return false; }
  return true;
}

function blockedScreen(message) {
  return `<div class="sc" style="min-height:100vh;display:grid;place-items:center;padding:24px">
    <div class="sc-card" style="max-width:420px;text-align:center">
      <h1 class="sc-h2">Access unavailable</h1>
      <p class="sc-lead" style="margin-top:8px">${esc(message)}</p>
      <p style="margin-top:18px"><a class="sc-btn sc-btn-ghost" href="index.html">Back to the site</a>
      <a class="sc-btn sc-btn-ghost" href="help-contact.html">Contact us</a></p>
    </div></div>`;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------
export function money(value, currency = 'JOD') {
  const n = Number(value || 0);
  return `${currency} ${n.toLocaleString('en-JO', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

export function num(value) {
  return Number(value || 0).toLocaleString('en-JO');
}

export function pct(value, digits = 1) {
  return `${(Number(value || 0) * 100).toFixed(digits)}%`;
}

export function date(value, withTime = false) {
  if (!value) return '—';
  const d = new Date(value);
  const opts = { day: 'numeric', month: 'short', year: 'numeric' };
  if (withTime) { opts.hour = '2-digit'; opts.minute = '2-digit'; }
  return d.toLocaleDateString('en-GB', opts);
}

export function ago(value) {
  if (!value) return '—';
  const secs = (Date.now() - new Date(value)) / 1000;
  const steps = [[60, 's'], [3600, 'm', 60], [86400, 'h', 3600], [604800, 'd', 86400]];
  if (secs < 60) return 'just now';
  for (const [limit, unit, div] of steps) {
    if (secs < limit) return `${Math.floor(secs / div)}${unit} ago`;
  }
  return date(value);
}

export function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function initials(name) {
  return String(name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase();
}

export function titleCase(str) {
  return String(str || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// Status → badge class mapping used across the admin tables
const BADGE = {
  active: 'ok', approved: 'ok', passed: 'ok', paid: 'ok', accepted: 'ok', delivered: 'ok', completed: 'ok', resolved: 'ok',
  pending: 'warn', pending_review: 'warn', pending_payout: 'warn', in_progress: 'warn', scheduled: 'warn',
  processing: 'warn', open: 'warn', investigating: 'warn', requested: 'warn', draft: 'info', placed: 'info',
  confirmed: 'info', shipped: 'info', collected: 'info', authenticating: 'info', reserved: 'info',
  rejected: 'danger', failed: 'danger', blocked: 'danger', suspended: 'danger', cancelled: 'danger',
  removed: 'danger', returned: 'danger', refunded: 'danger', counterfeit: 'danger', escalated: 'danger',
  sold: 'accent', featured: 'accent',
};

export function badge(status, label) {
  const key = String(status || '').toLowerCase();
  const kind = BADGE[key] || '';
  return `<span class="sc-badge ${kind ? 'sc-badge-' + kind : ''} sc-badge-dot">${esc(label || titleCase(status))}</span>`;
}

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------
export function publicUrl(bucket, path) {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return sb.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

export async function signedUrl(bucket, path, seconds = 300) {
  if (!path) return '';
  const { data } = await sb.storage.from(bucket).createSignedUrl(path, seconds);
  return data?.signedUrl || '';
}

/** Downscale in the browser before upload — keeps storage costs and load times down. */
export async function compressImage(file, maxEdge = 1600, quality = 0.82) {
  if (!file.type.startsWith('image/')) return file;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;

  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size < 900_000) return file;

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', quality));
  return blob ? new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' }) : file;
}

// ---------------------------------------------------------------------------
// UI primitives
// ---------------------------------------------------------------------------
export function toast(message, kind = '') {
  let host = document.querySelector('.sc-toasts');
  if (!host) {
    host = document.createElement('div');
    host.className = 'sc-toasts sc';
    document.body.appendChild(host);
  }
  const el = document.createElement('div');
  el.className = `sc-toast ${kind ? 'sc-toast-' + kind : ''}`;
  el.setAttribute('role', 'status');
  el.textContent = message;
  host.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 250); }, 3800);
}

/**
 * Modal. `body` is HTML, `actions` is [{label, kind, value}].
 * Resolves with the chosen action's value, or null on dismiss.
 */
export function modal({ title, body, actions = [], size = '', onMount } = {}) {
  return new Promise(resolve => {
    const scrim = document.createElement('div');
    scrim.className = 'sc-modal-scrim sc';
    scrim.innerHTML = `
      <div class="sc-modal ${size === 'lg' ? 'sc-modal-lg' : ''}" role="dialog" aria-modal="true">
        <div class="sc-modal-head">
          <h2 class="sc-h2">${esc(title || '')}</h2>
          <button class="sc-btn sc-btn-ghost sc-btn-icon" data-close aria-label="Close">✕</button>
        </div>
        <div class="sc-modal-body">${body || ''}</div>
        ${actions.length ? `<div class="sc-modal-foot">${actions.map((a, i) =>
          `<button class="sc-btn ${a.kind || 'sc-btn-ghost'}" data-action="${i}">${esc(a.label)}</button>`
        ).join('')}</div>` : ''}
      </div>`;

    const close = value => {
      document.removeEventListener('keydown', onKey);
      scrim.remove();
      resolve(value);
    };
    const onKey = e => { if (e.key === 'Escape') close(null); };

    scrim.addEventListener('click', e => {
      if (e.target === scrim || e.target.closest('[data-close]')) return close(null);
      const btn = e.target.closest('[data-action]');
      if (btn) {
        const action = actions[Number(btn.dataset.action)];
        const form = scrim.querySelector('form');
        const values = form ? Object.fromEntries(new FormData(form)) : {};
        close({ value: action.value ?? action.label, values, close: () => close(null) });
      }
    });

    document.addEventListener('keydown', onKey);
    document.body.appendChild(scrim);
    scrim.querySelector('input, textarea, select, button')?.focus();
    onMount?.(scrim.querySelector('.sc-modal'));
  });
}

export async function confirmAction(title, message, confirmLabel = 'Confirm', danger = false) {
  const result = await modal({
    title,
    body: `<p class="sc-lead">${esc(message)}</p>`,
    actions: [
      { label: 'Cancel', value: false },
      { label: confirmLabel, value: true, kind: danger ? 'sc-btn-danger' : 'sc-btn-primary' },
    ],
  });
  return result?.value === true;
}

/** Wrap an async click handler so the button shows progress and can't double-fire. */
export function busy(button, fn) {
  return async (...args) => {
    if (button.disabled) return;
    const original = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<span class="sc-spinner"></span>${button.dataset.busyLabel || 'Working'}`;
    try { return await fn(...args); }
    finally { button.disabled = false; button.innerHTML = original; }
  };
}

export function empty(title, message, actionHtml = '') {
  return `<div class="sc-empty">
    <p class="sc-empty-title">${esc(title)}</p>
    <p class="sc-sm">${esc(message)}</p>
    ${actionHtml ? `<p style="margin-top:16px">${actionHtml}</p>` : ''}
  </div>`;
}

export function skeletonRows(rows = 5, cols = 4) {
  return Array.from({ length: rows }, () =>
    `<tr>${Array.from({ length: cols }, () =>
      '<td><div class="sc-skeleton" style="height:14px"></div></td>').join('')}</tr>`).join('');
}

/** Friendly wording for the Postgres/Supabase errors users can actually hit. */
export function errorMessage(error) {
  if (!error) return 'Something went wrong.';
  const msg = error.message || String(error);
  if (/duplicate key.*username/i.test(msg)) return 'That username is taken.';
  if (/duplicate key/i.test(msg)) return 'That already exists.';
  if (/row-level security|not authorised|Not authorised/i.test(msg)) return 'You do not have permission to do that.';
  if (/Invalid login credentials/i.test(msg)) return 'That email and password do not match.';
  if (/Email not confirmed/i.test(msg)) return 'Confirm your email address first — check your inbox.';
  if (/User already registered/i.test(msg)) return 'An account with that email already exists.';
  if (/Password should be/i.test(msg)) return 'Use a password of at least 8 characters.';
  if (/Too many codes/i.test(msg)) return 'Too many codes requested. Wait a few minutes and try again.';
  if (/rate limit|too many requests/i.test(msg)) return 'Too many attempts. Wait a moment and try again.';
  if (/no longer available/i.test(msg)) return 'This piece has just been sold.';
  if (/Failed to fetch|NetworkError/i.test(msg)) return 'Cannot reach the server. Check your connection.';
  return msg;
}

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------
export function debounce(fn, wait = 300) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), wait); };
}

export function param(name, fallback = null) {
  return new URLSearchParams(location.search).get(name) ?? fallback;
}

export function setParam(name, value) {
  const url = new URL(location.href);
  if (value == null || value === '') url.searchParams.delete(name);
  else url.searchParams.set(name, value);
  history.replaceState(null, '', url);
}

/** Turn any array of objects into a CSV download — used by the report exports. */
export function downloadCsv(filename, rows) {
  if (!rows?.length) { toast('Nothing to export.'); return; }
  const cols = Object.keys(rows[0]);
  const escapeCell = v => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [cols.join(','), ...rows.map(r => cols.map(c => escapeCell(r[c])).join(','))].join('\n');
  const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
