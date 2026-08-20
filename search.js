// Client-side search for SecondChance Collective.
// Wires the search boxes (header, mobile, "Refine your search") so submitting
// one takes you to search.html?q=... and filters the rendered cards, plus the
// focus dropdown showing recent and trending searches.
(function () {
  // Cosmetic cleanup: the static export left behind React "loading
  // skeleton" placeholders that never get removed (no hydration JS to
  // remove them). Hide them everywhere so pages don't show a fake
  // "Loading results" grid under the real one.
  document.querySelectorAll('[aria-hidden="true"].animate-pulse').forEach(function (n) {
    n.style.display = 'none';
  });

  const forms = [...document.querySelectorAll('form[role="search"]')];
  if (!forms.length) return;

  const onSearchPage = document.body.hasAttribute('data-search-page');
  const params = new URLSearchParams(location.search);
  const initialQ = params.get('q') || '';
  
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ---- recent searches (localStorage) ----
  const RECENT_KEY = 'sc_recent_searches';
  function getRecent() {
    try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch (e) { return []; }
  }
  function addRecent(q) {
    if (!q) return;
    let list = getRecent().filter(function (r) { return r.q.toLowerCase() !== q.toLowerCase(); });
    list.unshift({ q: q });
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 5))); } catch (e) {}
  }

  // ---- the focus dropdown (Recent / Trending) ----
  const TRENDING = ['Birkin', 'Cartier Love', 'Cassette bag', 'Tabi flats', 'Kaftan'];

  const CLOCK_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="size-3.5 shrink-0" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>';
  const TREND_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="size-3.5 shrink-0" aria-hidden="true"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline><polyline points="16 7 22 7 22 13"></polyline></svg>';

  function panelHTML() {
    const recent = getRecent();
    let html = '';

    if (recent.length) {
      html += '<div class="mt-5 border-t border-line pt-5">' +
        '<h3 class="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">' + CLOCK_SVG + '<span>Recent</span></h3>' +
        '<div class="mt-3">' +
        recent.map(function (r) {
          return '<button type="button" data-recent-q="' + escapeHtml(r.q) + '" class="block w-full rounded-(--radius-inner) px-2 py-1.5 text-left text-sm text-ink transition-colors hover:bg-surface">' + escapeHtml(r.q) + '</button>';
        }).join('') +
        '</div></div>';
    }

    html += '<div class="mt-5 border-t border-line pt-5">' +
      '<h3 class="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">' + TREND_SVG + '<span>Trending in Jordan</span></h3>' +
      '<div class="mt-3 flex flex-wrap gap-2">' +
      TRENDING.map(function (t) {
        return '<button type="button" data-trend="' + escapeHtml(t) + '" class="inline-flex shrink-0 items-center rounded-full border border-line bg-canvas px-3.5 py-2 text-sm font-medium text-ink transition-colors hover:border-ink/40 hover:bg-surface">' + escapeHtml(t) + '</button>';
      }).join('') +
      '</div></div>';

    return html;
  }

  const panelClosers = [];
  function closeAllPanels() { panelClosers.forEach(function (fn) { fn(); }); }

  function attachPanel(form) {
    const input = form.querySelector('[data-search-input]');
    if (!input) return;
    const wrap = form.closest('.relative') || form.parentElement;
    const panel = document.createElement('div');
    panel.className = 'hidden absolute inset-x-0 top-full z-50 mt-1.5 rounded-(--radius-card) border border-line bg-canvas p-5 shadow-(--shadow-panel)';
    wrap.appendChild(panel);

    function open() {
      closeAllPanels();
      panel.innerHTML = panelHTML();
      panel.classList.remove('hidden');
    }
    function close() { panel.classList.add('hidden'); }
    panelClosers.push(close);

    input.addEventListener('focus', open);
    input.addEventListener('click', function (e) { e.stopPropagation(); open(); });
    input.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    document.addEventListener('click', function (e) {
      if (!wrap.contains(e.target)) close();
    });

    panel.addEventListener('click', function (e) {
      const trendBtn = e.target.closest('[data-trend]');
      const recentBtn = e.target.closest('[data-recent-q]');
      if (trendBtn) {
        input.value = trendBtn.getAttribute('data-trend');
        close();
        runSearch(input.value);
      } else if (recentBtn) {
        const q = recentBtn.getAttribute('data-recent-q');
        input.value = q;
        close();
        runSearch(q);
      }
    });
  }

  // Keep every search box on the page in sync with the current query.
  forms.forEach(function (f) {
    const input = f.querySelector('[data-search-input]');
    if (input && initialQ) input.value = initialQ;
  });

  function runSearch(query) {
    const q = (query || '').trim();
    if (q) addRecent(q);
    if (!onSearchPage) {
      const qs = [];
      if (q) qs.push('q=' + encodeURIComponent(q));
      
      location.href = 'search.html' + (qs.length ? '?' + qs.join('&') : '');
      return;
    }
    const url = new URL(location.href);
    if (q) url.searchParams.set('q', q); else url.searchParams.delete('q');
    url.searchParams.delete('mode');
    history.replaceState(null, '', url);
    filter(q);
  }

  forms.forEach(function (f) {
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      const input = f.querySelector('[data-search-input]');
      closeAllPanels();
      runSearch(input ? input.value : '');
    });
        attachPanel(f);
  });

  if (!onSearchPage) return;

  // ---- search.html only: filter the rendered grid client-side ----
  const heading = document.querySelector('#main h1');
  const countEl = heading ? heading.nextElementSibling : null;
  const originalHeading = heading ? heading.textContent : '';

  const anchors = [...document.querySelectorAll('#main a[href^="item-l"], #main a[href*="/items/l"]')];
  const seen = new Set();
  const cards = anchors.reduce(function (acc, a) {
    const el = a.closest('article');
    if (!el || seen.has(el)) return acc;
    seen.add(el);
    const alt = (el.querySelector('img') && el.querySelector('img').getAttribute('alt')) || '';
    acc.push({ el: el, text: (alt + ' ' + el.textContent).toLowerCase() });
    return acc;
  }, []);
  const grid = cards.length ? cards[0].el.parentElement : null;

  function filter(query) {
    if (!grid) return;
    const trimmed = query.trim();
    const tokens = trimmed.toLowerCase().split(/\s+/).filter(Boolean);
    let visible = 0;
    cards.forEach(function (c) {
      const match = !tokens.length || tokens.every(function (t) { return c.text.indexOf(t) !== -1; });
      c.el.style.display = match ? '' : 'none';
      if (match) visible++;
    });

    if (heading) heading.textContent = tokens.length ? 'Search results' : originalHeading;
    if (countEl) {
      countEl.textContent = visible + (visible === 1 ? ' piece' : ' pieces') +
        (tokens.length ? ' for \u201c' + trimmed + '\u201d' : '');
    }

    const old = document.getElementById('sc-search-empty');
    if (old) old.remove();

    if (!visible) {
      const notice = document.createElement('p');
      notice.id = 'sc-search-empty';
      notice.style.cssText = 'grid-column:1/-1;text-align:center;padding:48px 0;opacity:.6;';
      notice.textContent = tokens.length
        ? 'No pieces match \u201c' + trimmed + '\u201d. Try a different brand, item or keyword.'
        : 'No pieces match your filters.';
      grid.appendChild(notice);
    }
  }

  if (initialQ) filter(initialQ);
})();
