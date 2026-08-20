// ============================================================================
// SecondChance Collective — admin shell
// Sections are permission-gated: a role only ever sees what it can act on.
// ============================================================================

import {
  sb, session, requireAuth, getSettings, signOut,
  esc, toast, errorMessage, param, setParam, empty, skeletonRows,
} from './sc-core.js';

export const ctx = { settings: null, counts: {} };

// ---------------------------------------------------------------------------
// Section registry — [key, label, permission, group]
// ---------------------------------------------------------------------------
const SECTIONS = [
  ['dashboard',     'Dashboard',        null,                    'Overview'],
  ['analytics',     'Analytics',        'analytics.view',        'Overview'],

  ['listings',      'Listings',         'listings.view',         'Marketplace'],
  ['verification',  'Authentication',   'listings.authenticate', 'Marketplace'],
  ['taxonomy',      'Categories & brands', 'taxonomy.manage',    'Marketplace'],

  ['users',         'Members',          'users.view',            'People'],
  ['sellers',       'Sellers',          'users.view',            'People'],

  ['orders',        'Orders',           'orders.view',           'Commerce'],
  ['returns',       'Returns & disputes', 'orders.returns',      'Commerce'],
  ['payments',      'Payments',         'payments.view',         'Commerce'],
  ['payouts',       'Payouts',          'payments.payouts',      'Commerce'],

  ['reports',       'Reports',          'reports.manage',        'Trust'],

  ['promotions',    'Promotions',       'promotions.manage',     'Growth'],
  ['content',       'Content',          'content.manage',        'Growth'],
  ['notifications', 'Notifications',    'notifications.send',    'Growth'],

  ['admins',        'Admins & roles',   'admin.manage_admins',   'Security'],
  ['audit',         'Audit trail',      'admin.view_audit',      'Security'],
  ['settings',      'Settings',         'settings.manage',       'Security'],
];

const BADGE_KEYS = {
  listings: 'pending_listings', verification: 'pending_auth', sellers: 'pending_sellers',
  reports: 'open_reports', payouts: 'payout_count', returns: 'open_returns',
};

let modules = {};

// ---------------------------------------------------------------------------
export async function initAdmin() {
  if (!await requireAuth({ admin: true })) return;
  ctx.settings = await getSettings();

  document.getElementById('admin-role').textContent = session.roleName || 'Admin';
  document.getElementById('admin-signout').addEventListener('click', signOut);

  // pull in the section implementations
  const [core, commerce, platform] = await Promise.all([
    import('./admin-core.js'), import('./admin-commerce.js'), import('./admin-platform.js'),
  ]);
  modules = { ...core.default, ...commerce.default, ...platform.default };

  await refreshCounts();
  buildNav();
  wireResponsiveNav();

  window.addEventListener('hashchange', () => route());
  await route();
}

export async function refreshCounts() {
  const { data } = await sb.rpc('admin_dashboard_stats', { p_days: 30 });
  ctx.counts = data || {};
  return ctx.counts;
}

// ---------------------------------------------------------------------------
function visibleSections() {
  return SECTIONS.filter(([, , perm]) => !perm || session.can(perm));
}

function buildNav() {
  const nav = document.getElementById('admin-nav');
  const allowed = visibleSections();
  let html = '';
  let group = null;

  for (const [key, label, , sectionGroup] of allowed) {
    if (sectionGroup !== group) {
      group = sectionGroup;
      html += `<p class="sc-nav-group">${esc(group)}</p>`;
    }
    const count = ctx.counts[BADGE_KEYS[key]];
    html += `<button class="sc-nav-item" type="button" data-section="${key}">
      <span>${esc(label)}</span>
      ${count ? `<span class="sc-nav-count">${count}</span>` : ''}
    </button>`;
  }
  nav.innerHTML = html;

  nav.addEventListener('click', e => {
    const btn = e.target.closest('[data-section]');
    if (!btn) return;
    location.hash = btn.dataset.section;
    document.getElementById('admin-sidebar').classList.remove('is-open');
    document.querySelector('.sc-scrim')?.remove();
  });
}

function wireResponsiveNav() {
  const toggle = document.getElementById('admin-menu');
  const sidebar = document.getElementById('admin-sidebar');

  const sync = () => { toggle.style.display = window.innerWidth < 1024 ? '' : 'none'; };
  sync();
  window.addEventListener('resize', sync);

  toggle.addEventListener('click', () => {
    sidebar.classList.add('is-open');
    const scrim = document.createElement('div');
    scrim.className = 'sc-scrim';
    scrim.addEventListener('click', () => { sidebar.classList.remove('is-open'); scrim.remove(); });
    document.body.appendChild(scrim);
  });
}

// ---------------------------------------------------------------------------
export async function route() {
  const key = (location.hash.replace('#', '') || 'dashboard').split('?')[0];
  const section = visibleSections().find(([k]) => k === key);

  if (!section) {
    if (key !== 'dashboard') { location.hash = 'dashboard'; return; }
    setContent(`<div class="sc-note sc-note-warn">Your role does not have access to any sections yet.</div>`);
    return;
  }

  document.querySelectorAll('[data-section]').forEach(b =>
    b.classList.toggle('is-active', b.dataset.section === key));

  setTitle(section[1], '');
  document.getElementById('admin-actions').innerHTML = '';
  setContent('<div class="sc-skeleton" style="height:200px"></div>');

  const render = modules[key];
  if (!render) return setContent(`<div class="sc-note sc-note-warn">This section is not available.</div>`);

  try {
    await render({ setContent, setTitle, setActions, ctx, reload: route });
  } catch (err) {
    console.error(err);
    setContent(`<div class="sc-note sc-note-danger">${esc(errorMessage(err))}</div>`);
  }
}

// ---------------------------------------------------------------------------
// Shell helpers shared by every section
// ---------------------------------------------------------------------------
export function setContent(html) {
  const el = document.getElementById('admin-content');
  el.innerHTML = html;
  el.scrollTop = 0;
  return el;
}

export function setTitle(title, subtitle = '') {
  document.getElementById('admin-title').textContent = title;
  document.getElementById('admin-subtitle').textContent = subtitle;
}

export function setActions(html) {
  document.getElementById('admin-actions').innerHTML = html;
  return document.getElementById('admin-actions');
}

/** Filter/search bar used at the top of most list screens. */
export function toolbar({ tabs = [], search = true, placeholder = 'Search', extra = '' } = {}) {
  return `<div class="sc-between" style="margin-bottom:16px;align-items:flex-end">
    ${tabs.length ? `<div class="sc-tabs" data-filter-tabs>${tabs.map(t =>
      `<button class="sc-tab ${t.active ? 'is-active' : ''}" data-filter="${esc(t.value)}">
        ${esc(t.label)}${t.count != null ? `<span class="sc-tab-count">${t.count}</span>` : ''}</button>`
    ).join('')}</div>` : '<div></div>'}
    <div class="sc-row-tight">
      ${extra}
      ${search ? `<input class="sc-input" data-search placeholder="${esc(placeholder)}"
        style="width:230px;min-height:36px;padding:7px 12px;font-size:13px">` : ''}
    </div>
  </div>`;
}

export function table({ columns, rows, emptyTitle, emptyText }) {
  if (!rows?.length) return empty(emptyTitle || 'Nothing here yet', emptyText || 'Nothing matches these filters.');
  return `<div class="sc-table-wrap"><table class="sc-table">
    <thead><tr>${columns.map(c =>
      `<th ${c.align === 'right' ? 'style="text-align:right"' : ''}>${esc(c.label)}</th>`).join('')}</tr></thead>
    <tbody>${rows.join('')}</tbody></table></div>`;
}

export function loadingTable(cols = 5) {
  return `<div class="sc-table-wrap"><table class="sc-table"><tbody>${skeletonRows(6, cols)}</tbody></table></div>`;
}

/** Wire the toolbar's tabs + debounced search to a re-render callback. */
export function wireToolbar(root, onChange) {
  let filter = root.querySelector('[data-filter-tabs] .is-active')?.dataset.filter ?? 'all';
  let query = '';
  let timer;

  root.querySelector('[data-filter-tabs]')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-filter]');
    if (!btn) return;
    filter = btn.dataset.filter;
    root.querySelectorAll('[data-filter]').forEach(b => b.classList.toggle('is-active', b === btn));
    onChange({ filter, query });
  });

  root.querySelector('[data-search]')?.addEventListener('input', e => {
    clearTimeout(timer);
    query = e.target.value.trim();
    timer = setTimeout(() => onChange({ filter, query }), 320);
  });

  return () => ({ filter, query });
}

/** Every admin action goes through here so nothing escapes the audit trail. */
export async function adminAction(fn, successMessage) {
  try {
    const result = await fn();
    if (result?.error) throw result.error;
    if (successMessage) toast(successMessage, 'ok');
    await refreshCounts();
    buildNav();
    return result;
  } catch (err) {
    toast(errorMessage(err), 'danger');
    throw err;
  }
}

export function pager(page, total, perPage = 25) {
  const pages = Math.ceil(total / perPage);
  if (pages <= 1) return '';
  return `<div class="sc-row" style="justify-content:center;margin-top:18px">
    <button class="sc-btn sc-btn-ghost sc-btn-sm" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>Previous</button>
    <span class="sc-sm sc-muted">Page ${page} of ${pages}</span>
    <button class="sc-btn sc-btn-ghost sc-btn-sm" data-page="${page + 1}" ${page >= pages ? 'disabled' : ''}>Next</button>
  </div>`;
}
