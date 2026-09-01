// ============================================================================
// SecondChance Collective — header session state
//
// Runs on every page of the existing static site. It finds the "Sign in"
// control that the static export left behind and turns it into a real account
// menu once someone is signed in.
// ============================================================================

import { sb, session, loadSession, signOut, esc, initials, ago } from './sc-core.js';

const ICON = {
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" width="18" height="18" aria-hidden="true"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" width="13" height="13" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" width="19" height="19" aria-hidden="true"><path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/></svg>',
};

const MENU_STYLE = `
.sc-usermenu { position: relative; }
.sc-usermenu-btn {
  display: inline-flex; align-items: center; gap: 7px;
  border: 0; background: none; cursor: pointer; font: inherit; font-size: 14px; font-weight: 500;
  color: var(--color-ink); padding: 7px 11px; border-radius: 999px;
  transition: background-color .25s;
}
.sc-usermenu-btn:hover { background: var(--color-surface); }
.sc-usermenu-avatar {
  width: 26px; height: 26px; border-radius: 999px; flex: none;
  background: var(--color-accent); color: #fff;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 10.5px; font-weight: 600; letter-spacing: .02em;
  object-fit: cover;
}
.sc-usermenu-pop {
  position: absolute; right: 0; top: calc(100% + 8px); z-index: 90;
  min-width: 238px; padding: 7px;
  background: var(--color-canvas); border: 1px solid var(--color-line);
  border-radius: 16px; box-shadow: var(--shadow-panel);
}
.sc-usermenu-head { padding: 10px 11px 11px; border-bottom: 1px solid var(--color-line); margin-bottom: 5px; }
.sc-usermenu-name { font-size: 13.5px; font-weight: 500; }
.sc-usermenu-mail { font-size: 11.5px; color: var(--color-muted); margin-top: 1px;
  overflow: hidden; text-overflow: ellipsis; }
.sc-usermenu-role { display: inline-block; margin-top: 7px; font-size: 10.5px; font-weight: 500;
  padding: 2px 8px; border-radius: 999px; background: var(--color-accent-tint); color: var(--color-accent-strong); }
.sc-usermenu-link {
  display: flex; align-items: center; gap: 9px; width: 100%;
  padding: 8px 11px; border-radius: 10px; border: 0; background: none;
  font: inherit; font-size: 13.5px; color: var(--color-ink); text-align: left; cursor: pointer;
  transition: background-color .18s;
}
.sc-usermenu-link:hover { background: var(--color-surface); }
.sc-usermenu-sep { height: 1px; background: var(--color-line); margin: 5px 0; }
.sc-usermenu-count { margin-left: auto; font-size: 11px; font-variant-numeric: tabular-nums;
  background: var(--color-accent); color: #fff; padding: 1px 7px; border-radius: 999px; }
.sc-bell { position: relative; }
.sc-bell-dot { position: absolute; top: 6px; right: 6px; width: 7px; height: 7px;
  border-radius: 999px; background: var(--color-accent); border: 1.5px solid var(--color-canvas); }
`;

export async function initNav() {
  if (!document.getElementById('sc-nav-style')) {
    const style = document.createElement('style');
    style.id = 'sc-nav-style';
    style.textContent = MENU_STYLE;
    document.head.appendChild(style);
  }

  await loadSession();
  // A transient failure loading the profile would leave the menu showing the
  // "Your account" fallback (initials "YA") — retry once before rendering.
  if (session.user && !session.profile) await loadSession({ force: true });
  const anchors = findSignInControls();

  if (!session.isAuthed) {
    anchors.forEach(el => {
      const link = document.createElement('a');
      link.href = 'signin.html';
      link.className = el.className;
      link.innerHTML = el.innerHTML;
      el.replaceWith(link);
    });
    return;
  }

  const unread = await unreadCount();
  anchors.forEach(el => el.replaceWith(buildMenu(unread)));
  fixSellLinks();
  markActiveNav();
}

/** The static export renders "Sign in" as a dropdown trigger with no handler. */
function findSignInControls() {
  return [...document.querySelectorAll('button, a')].filter(el => {
    const text = el.textContent.trim();
    return text === 'Sign in' || text === 'Sign in / Register' || text === 'Account';
  });
}

async function unreadCount() {
  const { count } = await sb.from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', session.user.id).is('read_at', null);
  return count || 0;
}

function buildMenu(unread) {
  const p = session.profile || {};
  // Prefer real identity; the email's local part beats a literal
  // "Your account" (whose initials read as "YA" in the avatar).
  const name = p.full_name || p.username
    || (session.user?.email || '').split('@')[0] || 'Your account';
  const wrap = document.createElement('div');
  wrap.className = 'sc-usermenu sc';

  const avatar = p.avatar_url
    ? `<img class="sc-usermenu-avatar" src="${esc(p.avatar_url)}" alt="">`
    : `<span class="sc-usermenu-avatar">${esc(initials(name))}</span>`;

  wrap.innerHTML = `
    <button class="sc-usermenu-btn" type="button" aria-expanded="false" aria-haspopup="true">
      ${avatar}<span class="sc-usermenu-label">${esc((p.username || name).split(' ')[0])}</span>${ICON.chevron}
    </button>
    <div class="sc-usermenu-pop" hidden>
      <div class="sc-usermenu-head">
        <p class="sc-usermenu-name">${esc(name)}</p>
        <p class="sc-usermenu-mail">${esc(session.user.email || '')}</p>
        ${session.isAdmin ? `<span class="sc-usermenu-role">${esc(session.roleName)}</span>`
          : p.seller_status === 'approved' ? '<span class="sc-usermenu-role">Verified seller</span>'
          : p.seller_status === 'pending' ? '<span class="sc-usermenu-role">Seller review pending</span>' : ''}
      </div>
      <a class="sc-usermenu-link" href="account.html">Your account</a>
      <a class="sc-usermenu-link" href="account.html?tab=listings">Your listings</a>
      <a class="sc-usermenu-link" href="account.html?tab=orders">Orders</a>
      <a class="sc-usermenu-link" href="account.html?tab=favorites">Saved pieces</a>
      <a class="sc-usermenu-link" href="account.html?tab=notifications">
        Notifications${unread ? `<span class="sc-usermenu-count">${unread}</span>` : ''}
      </a>
      ${session.isAdmin ? `<div class="sc-usermenu-sep"></div>
        <a class="sc-usermenu-link" href="admin.html"><strong>Admin panel</strong></a>` : ''}
      <div class="sc-usermenu-sep"></div>
      <a class="sc-usermenu-link" href="account.html?tab=settings">Settings</a>
      <button class="sc-usermenu-link" type="button" data-signout>Sign out</button>
    </div>`;

  const btn = wrap.querySelector('.sc-usermenu-btn');
  const pop = wrap.querySelector('.sc-usermenu-pop');

  const close = () => { pop.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
  btn.addEventListener('click', e => {
    e.stopPropagation();
    const open = pop.hidden;
    pop.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', e => { if (!wrap.contains(e.target)) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  wrap.querySelector('[data-signout]').addEventListener('click', signOut);

  return wrap;
}

/** "Sell now" should go to sign-in first for signed-out visitors. */
function fixSellLinks() {
  document.querySelectorAll('a[href="sell.html"], a[href$="/sell"]').forEach(a => {
    if (!session.isAuthed) a.href = 'signin.html?next=sell.html';
  });
}

function markActiveNav() {
  const here = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('header a[href]').forEach(a => {
    if (a.getAttribute('href') === here) a.setAttribute('aria-current', 'page');
  });
}

// Keep every open tab in sync when someone signs in or out elsewhere.
//
// This must never call location.reload(). onAuthStateChange fires SIGNED_IN on
// every page load that restores a session, and SIGNED_OUT whenever a stored
// token fails to refresh — so reloading here means load → event → reload,
// forever. Compare who is actually signed in instead, and re-render in place.
let lastUserId;

sb.auth.onAuthStateChange((event, authSession) => {
  const id = authSession?.user?.id ?? null;

  // The first callback only tells us the starting state; it is not a change.
  if (lastUserId === undefined) { lastUserId = id; return; }

  // TOKEN_REFRESHED and repeat SIGNED_IN events carry the same user.
  if (id === lastUserId) return;
  lastUserId = id;

  if (/signin|signup|verify-otp|reset-password|forgot-password/.test(location.pathname)) return;

  loadSession({ force: true })
    .then(() => initNav())
    .catch(() => { /* the nav is cosmetic; never let it break the page */ });
});
