// ============================================================================
// SecondChance Collective — newsletter signups
//
// Wires any <form data-newsletter> on the page: one email field, one insert
// into newsletter_subscribers, and a note in place of a redirect. Duplicate
// signups are treated as success — the reader is on the list either way.
// ============================================================================

import { sb } from './sc-core.js';

export function initNewsletter() {
  document.querySelectorAll('form[data-newsletter]').forEach(form => {
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const email = (new FormData(form).get('email') || '').toString().trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return say(form, 'That does not look like an email address.');

      const button = form.querySelector('button[type=submit]');
      if (button) button.disabled = true;
      const { error } = await sb.from('newsletter_subscribers').insert({ email });
      if (button) button.disabled = false;

      if (error && !/duplicate/i.test(error.message)) {
        return say(form, 'Could not sign you up just now — try again in a moment.');
      }
      form.querySelector('input[name=email]').value = '';
      say(form, error ? 'You are already on the list.' : 'You are in. The first paper is on its way.');
    });
  });
}

function say(form, message) {
  const note = form.querySelector('[data-newsletter-note]');
  if (!note) return;
  note.textContent = message;
  note.hidden = false;
}
