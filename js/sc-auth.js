// ============================================================================
// SecondChance Collective — authentication
//
// Identity is an email address. Two ways in:
//
//   · email + password   — the everyday path, instant
//   · email + six-digit code — first sign-up, and the way back in when a
//                              password is forgotten
//
// Sign-up creates the account but Supabase leaves it unconfirmed until the
// emailed code is verified, and an unconfirmed account cannot sign in with its
// password. That is what stops someone using an account they never verified.
//
// There is no reset link. Forgetting a password means getting a code,
// signing in with it, and setting a new one in settings.
//
// The mobile number is still collected at sign-up — buyers use it to reach
// the seller after a sale — but it is a contact field, not the identity.
// ============================================================================

import { sb, session, loadSession, toast, esc, errorMessage, param } from './sc-core.js';

const PENDING = 'sc-pending-email';
const RESEND_WAIT = 45;

const setBusy = (form, on, label) => {
  const btn = form.querySelector('[type=submit]');
  if (!btn) return;
  btn.disabled = on;
  if (on) { btn.dataset.idle = btn.textContent; btn.textContent = label || 'One moment…'; }
  else if (btn.dataset.idle) btn.textContent = btn.dataset.idle;
};

const showError = (form, message) => {
  let box = form.querySelector('[data-error]');
  if (!box) {
    box = document.createElement('div');
    box.setAttribute('data-error', '');
    box.className = 'sc-note sc-note-danger';
    form.prepend(box);
  }
  box.textContent = message;
  box.hidden = false;
};

const clearError = form => { const b = form.querySelector('[data-error]'); if (b) b.hidden = true; };
// Jordan mobile numbers are 07X XXX XXXX locally, +9627XXXXXXXX in E.164.
// People type them every possible way, so normalise rather than reject.
export function toE164(raw) {
  let d = (raw || '').replace(/[^\d+]/g, '');
  if (d.startsWith('+')) d = d.slice(1);
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('962')) d = d.slice(3);
  d = d.replace(/^0+/, '');
  return d.length === 9 && /^7[789]/.test(d) ? '+962' + d : null;
}

// Deliberately length-first. Composition rules push people toward
// Passw0rd! and away from anything actually hard to guess.
export function passwordProblem(pw) {
  if (!pw || pw.length < 8) return 'Passwords need at least 8 characters.';
  if (pw.length > 72) return 'That password is too long. 72 characters is the limit.';
  if (/^\d+$/.test(pw)) return 'Use more than just numbers.';
  return null;
}

// Light-touch on purpose: the real validation is whether the code arrives.
export const cleanEmail = raw => {
  const e = (raw || '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
};

async function requestCode(email, { createUser = true, meta = null } = {}) {
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: createUser, ...(meta ? { data: meta } : {}) },
  });
  if (error) throw error;
  sessionStorage.setItem(PENDING, email);
}

// ---------------------------------------------------------------------------
export function initSignUp() {
  const form = document.getElementById('signup-form');
  if (!form) return;

  form.addEventListener('submit', async e => {
    e.preventDefault();
    clearError(form);
    const f = Object.fromEntries(new FormData(form));

    const email = cleanEmail(f.email);
    if (!email) return showError(form,
      'Enter a valid email address — your sign-in code goes there.');
    const phone = toE164(f.phone);
    if (!phone) return showError(form,
      'That does not look like a Jordanian mobile number. It should start 077, 078 or 079.');
    if (!f.full_name?.trim()) return showError(form, 'We need your name.');
    if (f.username && !/^[a-z0-9_]{3,20}$/i.test(f.username))
      return showError(form, 'Usernames are 3-20 letters, numbers or underscores.');
    const pwProblem = passwordProblem(f.password);
    if (pwProblem) return showError(form, pwProblem);
    if (f.password !== f.confirm) return showError(form, 'The two passwords do not match.');
    if (!form.querySelector('[name=terms]')?.checked)
      return showError(form, 'Please accept the terms to continue.');

    setBusy(form, true, 'Sending your code…');
    try {
      if (f.username) {
        const { data: taken } = await sb.from('profiles')
          .select('id').eq('username', f.username.toLowerCase()).maybeSingle();
        if (taken) { setBusy(form, false); return showError(form, 'That username is taken.'); }
      }

      // These land in raw_user_meta_data; handle_new_user copies them into
      // profiles when the account is actually created.
      const { error } = await sb.auth.signUp({
        email,
        password: f.password,
        options: {
          data: {
            full_name: f.full_name.trim(),
            username: f.username ? f.username.toLowerCase() : null,
            phone,
            city: f.city || null,
          },
        },
      });
      if (error) throw error;

      sessionStorage.setItem(PENDING, email);
      sessionStorage.setItem('sc-pending-new', '1');
      location.href = `verify-otp.html?email=${encodeURIComponent(email)}`;
    } catch (err) {
      setBusy(form, false);
      showError(form, errorMessage(err));
    }
  });
}

// ---------------------------------------------------------------------------
export function initSignIn() {
  const form = document.getElementById('signin-form');
  if (!form) return;

  const next = () => param('next');

  form.addEventListener('submit', async e => {
    e.preventDefault();
    clearError(form);
    const f = Object.fromEntries(new FormData(form));

    const email = cleanEmail(f.email);
    if (!email) return showError(form, 'Enter the email address you signed up with.');
    if (!f.password) return showError(form, 'Enter your password, or ask for a code instead.');

    setBusy(form, true, 'Signing you in…');
    const { data, error } = await sb.auth.signInWithPassword({ email, password: f.password });

    if (error) {
      setBusy(form, false);
      // Supabase does not distinguish these on purpose, and neither should we:
      // saying which half was wrong tells an attacker which addresses exist.
      if (/not confirmed|confirm/i.test(error.message)) {
        return showError(form,
          'That email has not been confirmed yet. Ask for a code to finish setting up.');
      }
      return showError(form, 'That email and password do not match.');
    }

    sb.from('login_history')
      .insert({ user_id: data.user.id, success: true, method: 'password' })
      .then(() => {}, () => {});

    await loadSession({ force: true });
    location.href = next() || 'account.html';
  });

  // --- the way in when the password is gone, or was never set -------------
  form.querySelector('[data-use-code]')?.addEventListener('click', async () => {
    clearError(form);
    const email = cleanEmail(new FormData(form).get('email'));
    if (!email) return showError(form, 'Enter your email address first.');

    const btn = form.querySelector('[data-use-code]');
    btn.disabled = true;
    btn.textContent = 'Sending…';
    try {
      await requestCode(email, { createUser: true });
      location.href = `verify-otp.html?email=${encodeURIComponent(email)}`
        + (next() ? `&next=${encodeURIComponent(next())}` : '');
    } catch (err) {
      btn.disabled = false;
      btn.textContent = 'Email me a code instead';
      showError(form, errorMessage(err));
    }
  });
}

// ---------------------------------------------------------------------------
export function initVerifyOtp() {
  const form = document.getElementById('otp-form');
  if (!form) return;

  const email = param('email') || sessionStorage.getItem(PENDING) || '';
  const label = form.querySelector('[data-otp-email]');
  if (label) label.textContent = email || 'your inbox';
  if (!email) { location.replace('signin.html'); return; }

  const boxes = [...form.querySelectorAll('[data-otp-box]')];
  const collect = () => boxes.map(b => b.value).join('');

  boxes.forEach((box, i) => {
    box.setAttribute('inputmode', 'numeric');
    box.setAttribute('autocomplete', i === 0 ? 'one-time-code' : 'off');
    box.setAttribute('maxlength', '1');

    box.addEventListener('input', () => {
      box.value = box.value.replace(/\D/g, '').slice(0, 1);
      if (box.value && i < boxes.length - 1) boxes[i + 1].focus();
      if (collect().length === 6) form.requestSubmit();
    });

    box.addEventListener('keydown', e => {
      if (e.key === 'Backspace' && !box.value && i > 0) boxes[i - 1].focus();
      if (e.key === 'ArrowLeft' && i > 0) boxes[i - 1].focus();
      if (e.key === 'ArrowRight' && i < boxes.length - 1) boxes[i + 1].focus();
    });

    box.addEventListener('paste', e => {
      e.preventDefault();
      const digits = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);
      digits.split('').forEach((d, k) => { if (boxes[k]) boxes[k].value = d; });
      boxes[Math.min(digits.length, 5)].focus();
      if (digits.length === 6) form.requestSubmit();
    });
  });

  boxes[0]?.focus();

  form.addEventListener('submit', async e => {
    e.preventDefault();
    clearError(form);
    const token = collect();
    if (token.length !== 6) return showError(form, 'Enter all six digits.');

    setBusy(form, true, 'Checking…');
    const { data, error } = await sb.auth.verifyOtp({ email, token, type: 'email' });

    if (error) {
      setBusy(form, false);
      boxes.forEach(b => { b.value = ''; });
      boxes[0].focus();
      return showError(form, /expired|invalid/i.test(error.message)
        ? 'That code is wrong or has expired. Ask for a new one.'
        : errorMessage(error));
    }

    sessionStorage.removeItem(PENDING);
    const isNew = sessionStorage.getItem('sc-pending-new');
    sessionStorage.removeItem('sc-pending-new');

    await loadSession({ force: true });
    sb.from('login_history')
      .insert({ user_id: data.user.id, success: true, method: 'email_otp' })
      .then(() => {}, () => {});

    if (param('setpassword')) { location.href = 'account.html?tab=settings&setpassword=1'; return; }
    location.href = param('next') || (isNew ? 'account.html?welcome=1' : 'account.html');
  });

  const resend = form.querySelector('[data-resend]');
  if (!resend) return;

  let left = 0;
  const tick = () => {
    if (left <= 0) { resend.disabled = false; resend.textContent = 'Send a new code'; return; }
    resend.disabled = true;
    resend.textContent = `Send a new code in ${left}s`;
    left -= 1;
    setTimeout(tick, 1000);
  };

  resend.addEventListener('click', async () => {
    if (left > 0) return;
    try {
      await requestCode(email, { createUser: true });
      toast('New code sent.', 'ok');
      left = RESEND_WAIT;
      tick();
    } catch (err) {
      toast(errorMessage(err), 'danger');
    }
  });
}

// ---------------------------------------------------------------------------
// No passwords any more. These stay so old bookmarks do not dead-end.
// ---------------------------------------------------------------------------
export function initForgotPassword() {
  const form = document.getElementById('forgot-form');
  if (!form) return;

  form.addEventListener('submit', async e => {
    e.preventDefault();
    clearError(form);
    const email = cleanEmail(new FormData(form).get('email'));
    if (!email) return showError(form, 'That does not look like an email address.');

    setBusy(form, true, 'Sending your code…');
    try {
      // Not createUser: someone who mistypes their own address should not end
      // up silently registered under an address that is not theirs.
      await requestCode(email, { createUser: false });
      location.href = `verify-otp.html?email=${encodeURIComponent(email)}&setpassword=1`;
    } catch (err) {
      setBusy(form, false);
      showError(form, errorMessage(err));
    }
  });
}

export function initResetPassword() {
  const form = document.getElementById('reset-form');
  if (!form) return;
  form.innerHTML = `<div class="sc-note sc-note-info">
      There is no reset link. Get a code by email, sign in with it,
      then set a new password in your settings.
    </div>
    <a class="sc-btn sc-btn-primary sc-btn-block" style="margin-top:14px" href="forgot-password.html">
      Email me a code</a>`;
}

export function initAuthPage() {
  initSignUp(); initSignIn(); initVerifyOtp(); initForgotPassword(); initResetPassword();
}

// ---------------------------------------------------------------------------
export async function initAuthCallback() {
  const root = document.getElementById('cb-root');
  const query = new URLSearchParams(location.search);
  const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
  const get = k => query.get(k) || hash.get(k);

  const done = (title, body, actions) => {
    root.innerHTML = `<a class="cb-mark" href="index.html">SecondChance collective<i>.</i></a>
      <h1 class="sc-h2">${esc(title)}</h1>
      <p class="sc-lead" style="margin-top:8px">${esc(body)}</p>
      <div class="sc-stack" style="margin-top:22px">${actions}</div>`;
  };

  try {
    if (get('token_hash')) {
      const { error } = await sb.auth.verifyOtp({
        token_hash: get('token_hash'), type: get('type') || 'email',
      });
      if (error) throw error;
    } else if (query.get('code')) {
      const { error } = await sb.auth.exchangeCodeForSession(query.get('code'));
      if (error) throw error;
    }

    const { data } = await sb.auth.getSession();
    if (!data.session) {
      return done('Nothing to confirm',
        'Signing in now uses a six-digit code sent to your email instead of a link.',
        '<a class="sc-btn sc-btn-primary" href="signin.html">Get a code</a>');
    }

    await loadSession({ force: true });
    done('You are signed in', 'Your email is confirmed.',
      `<a class="sc-btn sc-btn-primary" href="account.html">Go to your account</a>
       <a class="sc-btn sc-btn-ghost" href="index.html">Start browsing</a>`);
  } catch {
    done('That link has expired',
      'Links are single use. Signing in now uses a six-digit code sent to your email.',
      '<a class="sc-btn sc-btn-primary" href="signin.html">Get a code</a>');
  }
}
