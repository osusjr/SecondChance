// ============================================================================
// SecondChance Collective — mobile navigation
//
// The exported markup has a hamburger button but no panel behind it: the
// export stripped the React handlers and never emitted a drawer. This builds
// one, wires it to the existing button, and leaves the desktop hover menus in
// menus.js alone.
// ============================================================================

import { sb, session, esc } from './sc-core.js';

const CATEGORIES = [
  ['Bags', 'catalog-bags.html'],
  ['Womenswear', 'catalog-womenswear.html'],
  ['Menswear', 'catalog-menswear.html'],
  ['Shoes', 'catalog-shoes.html'],
  ['Watches', 'catalog-watches.html'],
  ['Jewellery', 'catalog-jewellery.html'],
  ['Accessories', 'catalog-accessories.html'],
  ['Vintage', 'catalog-vintage.html'],
];

const HELP = [
  ['How it works', 'about.html'],
  ['Authentication', 'authentication.html'],
  ['Buyer Protection', 'help-buyer-protection.html'],
  ['Help centre', 'help-centre.html'],
];

const CSS = `
.scm-scrim{position:fixed;inset:0;z-index:80;background:rgba(16,17,20,.42);
  opacity:0;transition:opacity .22s var(--ease-fluid,ease);backdrop-filter:blur(2px)}
.scm-scrim.is-open{opacity:1}
.scm{position:fixed;inset-block:0;inset-inline-start:0;z-index:81;width:min(88vw,360px);
  background:var(--color-canvas,#fff);display:flex;flex-direction:column;
  transform:translateX(-100%);transition:transform .26s var(--ease-fluid,cubic-bezier(.32,.72,0,1));
  box-shadow:0 0 44px rgba(16,17,20,.16)}
[dir=rtl] .scm{transform:translateX(100%)}
.scm.is-open{transform:translateX(0)}
.scm-top{display:flex;align-items:center;justify-content:space-between;gap:12px;
  padding:16px 18px;border-bottom:1px solid var(--color-line,#e7e8eb);flex:0 0 auto}
.scm-mark{font-family:var(--font-bricolage),sans-serif;font-size:15px;font-weight:600;
  letter-spacing:-.01em;color:var(--color-ink,#101114);text-decoration:none}
.scm-mark i{font-style:normal;color:var(--color-accent,#872222)}
.scm-x{inline-size:36px;block-size:36px;border:0;background:none;border-radius:999px;
  display:grid;place-items:center;cursor:pointer;color:var(--color-muted,#62666f)}
.scm-x:hover{background:var(--color-surface,#f7f7f8);color:var(--color-ink,#101114)}
.scm-body{flex:1 1 auto;overflow-y:auto;overscroll-behavior:contain;padding:14px 10px 24px}
.scm-eyebrow{font-size:10.5px;text-transform:uppercase;letter-spacing:.11em;font-weight:500;
  color:var(--color-muted,#62666f);padding:14px 12px 6px;margin:0}
.scm a.scm-row,.scm button.scm-row{display:flex;align-items:center;gap:10px;width:100%;
  padding:11px 12px;border:0;background:none;border-radius:12px;text-align:start;
  font-size:14.5px;color:var(--color-ink,#101114);text-decoration:none;cursor:pointer;
  font-family:inherit;transition:background-color .16s}
.scm a.scm-row:hover,.scm button.scm-row:hover{background:var(--color-surface,#f7f7f8)}
.scm-row .scm-chev{margin-inline-start:auto;color:var(--color-muted,#62666f)}
[dir=rtl] .scm-row .scm-chev{transform:scaleX(-1)}
.scm-sep{height:1px;background:var(--color-line,#e7e8eb);margin:12px 12px}
.scm-foot{flex:0 0 auto;padding:14px 18px;border-top:1px solid var(--color-line,#e7e8eb);
  display:grid;gap:9px}
.scm-cta{display:flex;align-items:center;justify-content:center;height:42px;border-radius:999px;
  font-size:14px;font-weight:500;text-decoration:none;cursor:pointer;border:1px solid transparent;
  font-family:inherit;transition:background-color .18s,border-color .18s}
.scm-cta-primary{background:var(--color-accent,#872222);color:#fff}
.scm-cta-primary:hover{background:var(--color-accent-strong,#6d1b1b)}
.scm-cta-ghost{border-color:var(--color-line,#e7e8eb);color:var(--color-ink,#101114);background:none}
.scm-cta-ghost:hover{background:var(--color-surface,#f7f7f8)}
.scm-who{display:flex;align-items:center;gap:10px;padding:12px;border-radius:14px;
  background:var(--color-surface,#f7f7f8);margin:2px 12px 6px}
.scm-av{inline-size:34px;block-size:34px;border-radius:999px;display:grid;place-items:center;
  background:var(--color-accent,#872222);color:#fff;font-size:12.5px;font-weight:600;flex:0 0 auto}
@media (min-width:768px){.scm,.scm-scrim{display:none}}
@media (prefers-reduced-motion:reduce){.scm,.scm-scrim{transition-duration:.01ms}}
`;

const chev = `<svg class="scm-chev" width="15" height="15" viewBox="0 0 24 24" fill="none"
  stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"
  aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>`;

let drawer, scrim, lastFocus;

function open() {
  lastFocus = document.activeElement;
  scrim.hidden = false;
  drawer.hidden = false;
  // force a frame so the transition runs
  requestAnimationFrame(() => {
    scrim.classList.add('is-open');
    drawer.classList.add('is-open');
  });
  document.body.style.overflow = 'hidden';
  drawer.querySelector('.scm-x')?.focus();
  document.querySelectorAll('[aria-label="Menu"]').forEach(b => b.setAttribute('aria-expanded', 'true'));
}

function close() {
  scrim.classList.remove('is-open');
  drawer.classList.remove('is-open');
  document.body.style.overflow = '';
  document.querySelectorAll('[aria-label="Menu"]').forEach(b => b.setAttribute('aria-expanded', 'false'));
  setTimeout(() => { scrim.hidden = true; drawer.hidden = true; }, 260);
  lastFocus?.focus?.();
}

function build() {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  scrim = document.createElement('div');
  scrim.className = 'scm-scrim';
  scrim.hidden = true;
  scrim.addEventListener('click', close);

  drawer = document.createElement('nav');
  drawer.className = 'scm';
  drawer.hidden = true;
  drawer.setAttribute('aria-label', 'Menu');

  const p = session.profile;
  const who = session.isAuthed
    ? `<div class="scm-who">
         <span class="scm-av">${esc((p?.full_name || p?.username || session.user?.email || '?').trim()[0]?.toUpperCase() || '?')}</span>
         <div style="min-width:0">
           <p style="font-size:13.5px;font-weight:500;margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
             ${esc(p?.full_name || p?.username || (session.user?.email || '').split('@')[0] || 'Your account')}</p>
           <p style="font-size:11.5px;margin:2px 0 0;color:var(--color-muted,#62666f)">
             ${session.isAdmin ? 'Admin' : session.isSeller ? 'Seller' : 'Member'}</p>
         </div></div>`
    : '';

  drawer.innerHTML = `
    <div class="scm-top">
      <a class="scm-mark" href="index.html">SecondChance collective<i>.</i></a>
      <button class="scm-x" type="button" aria-label="Close menu">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="1.75" stroke-linecap="round" aria-hidden="true">
          <path d="M18 6 6 18M6 6l12 12"/></svg>
      </button>
    </div>

    <div class="scm-body">
      ${who}
      <a class="scm-row" href="browse.html"><strong>Shop all</strong>${chev}</a>

      <p class="scm-eyebrow">Categories</p>
      ${CATEGORIES.map(([l, h]) => `<a class="scm-row" href="${h}">${esc(l)}${chev}</a>`).join('')}

      <div class="scm-sep"></div>
      <p class="scm-eyebrow">Your account</p>
      ${session.isAuthed ? `
        <a class="scm-row" href="account.html">Overview${chev}</a>
        <a class="scm-row" href="account.html?tab=listings">Your listings${chev}</a>
        <a class="scm-row" href="account.html?tab=orders">Purchases${chev}</a>
        <a class="scm-row" href="account.html?tab=favorites">Saved${chev}</a>
        ${session.isAdmin ? `<a class="scm-row" href="admin.html">Admin panel${chev}</a>` : ''}
      ` : `
        <a class="scm-row" href="signin.html">Sign in${chev}</a>
        <a class="scm-row" href="signup.html">Create an account${chev}</a>
      `}

      <div class="scm-sep"></div>
      <p class="scm-eyebrow">Help</p>
      ${HELP.map(([l, h]) => `<a class="scm-row" href="${h}">${esc(l)}${chev}</a>`).join('')}

      <div class="scm-sep"></div>
      <button class="scm-row" type="button" data-lang-toggle>
        <span data-lang-label>English / العربية</span>${chev}</button>
    </div>

    <div class="scm-foot">
      <a class="scm-cta scm-cta-primary" href="sell.html">List an item</a>
      ${session.isAuthed
        ? '<button class="scm-cta scm-cta-ghost" type="button" data-menu-signout>Sign out</button>'
        : '<a class="scm-cta scm-cta-ghost" href="signin.html">Sign in</a>'}
    </div>`;

  document.body.append(scrim, drawer);

  drawer.querySelector('.scm-x').addEventListener('click', close);
  drawer.querySelector('[data-menu-signout]')?.addEventListener('click', async () => {
    await sb.auth.signOut();
    location.href = 'index.html';
  });

  // trap escape, and keep focus inside while open
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && drawer.classList.contains('is-open')) close();
    if (e.key !== 'Tab' || !drawer.classList.contains('is-open')) return;
    const items = drawer.querySelectorAll('a[href], button:not([disabled])');
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  // close on resize up to desktop, so state cannot get stuck
  addEventListener('resize', () => {
    if (innerWidth >= 768 && drawer.classList.contains('is-open')) close();
  });
}

export function initMenu() {
  const buttons = [...document.querySelectorAll('button[aria-label="Menu"]')];
  if (!buttons.length) return;

  build();

  buttons.forEach(btn => {
    btn.setAttribute('type', 'button');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', 'sc-mobile-menu');
    btn.addEventListener('click', e => {
      e.preventDefault();
      drawer.classList.contains('is-open') ? close() : open();
    });
  });

  drawer.id = 'sc-mobile-menu';
}
