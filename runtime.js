// Filter & sort runtime for the static SecondChance Collective copy.
// Self-configuring: wires whatever controls exist on the current page.
// Item links match with or without the .html suffix, so the same file works
// from a local folder and on hosts (like Netlify) whose "Pretty URLs"
// optimization rewrites "item-l003.html" to "/item-l003" at deploy time.
(function () {
  const UI = {"pillOff":"inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-[background-color,color,border-color,transform] duration-300 ease-(--ease-fluid) active:scale-[0.98] border-line bg-canvas text-ink hover:border-ink/40 hover:bg-surface ","pillOn":"inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-[background-color,color,border-color,transform] duration-300 ease-(--ease-fluid) active:scale-[0.98] border-accent bg-accent text-accent-contrast hover:bg-accent/88 ","authOff":"inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-[background-color,color,border-color,transform] duration-300 ease-(--ease-fluid) active:scale-[0.98] border-line bg-canvas text-ink hover:border-ink/40 hover:bg-surface ","authOn":"inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-[background-color,color,border-color,transform] duration-300 ease-(--ease-fluid) active:scale-[0.98] border-accent bg-accent text-accent-contrast hover:bg-accent/88 "};
  const ITEM_RE = /(?:item-l\d+(?:\.html)?|\/items\/l\d+)\/?$/;
  const PILL_CATS = {
    Bags: 'bags', Womenswear: 'womenswear', Menswear: 'menswear', Shoes: 'shoes',
    Watches: 'watches', Jewellery: 'jewellery', Accessories: 'accessories', Vintage: 'vintage'
  };
  const isItemLink = a => a && ITEM_RE.test(a.getAttribute('href') || '');
  const anchors = [...document.querySelectorAll('a[href]')].filter(isItemLink);
  if (!anchors.length) return;
  const gridVotes = new Map();
  anchors.forEach(a => {
    const g = a.closest('[class*="grid"]');
    if (g) gridVotes.set(g, (gridVotes.get(g) || 0) + 1);
  });
  if (!gridVotes.size) return;
  const grid = [...gridVotes.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const defaultCat = document.body.getAttribute('data-default-cat') || 'unknown';
  const itemAnchor = el => {
    if (el.matches && el.matches('a[href]') && isItemLink(el)) return el;
    return [...el.querySelectorAll('a[href]')].find(isItemLink) || null;
  };
  const cards = [...grid.children]
    .map((el, i) => {
      const a = itemAnchor(el);
      if (!a) return null;
      const priceMatch = el.textContent.match(/JOD\s?([\d,]+(?:\.\d+)?)/);
      return {
        el, order: i,
        id: ((a.getAttribute('href') || '').match(/l\d+/) || [])[0] || String(i),
        price: priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : 0,
        auth: /authenticated/i.test(el.textContent),
        cat: a.getAttribute('data-cat') || defaultCat
      };
    })
    .filter(Boolean);
  if (!cards.length) return;
  const sec = grid.closest('section') || document.body;
  const sortSelect = [...sec.querySelectorAll('select')]
    .find(s => [...s.options].some(o => /price/i.test(o.value)));
  const authBtn = [...sec.querySelectorAll('button')].find(b => /authenticated only/i.test(b.textContent));
  const pills = [...sec.querySelectorAll('button')].filter(b => PILL_CATS[b.textContent.trim()]);
  const moreBtn = [...sec.querySelectorAll('button')].find(b => /show \d+ more/i.test(b.textContent));
  const countEl = [...sec.querySelectorAll('p, div, span')]
    .find(e => !e.children.length && /\d+\s+pieces across every category/i.test(e.textContent));
  const newRank = new Map((window.SC_NEW_ORDER || []).map((id, i) => [id, i]));
  const state = {
    cats: new Set(), authOnly: false,
    sort: sortSelect ? sortSelect.value : 'popular',
    shown: moreBtn ? 12 : cards.length
  };
  function sorted() {
    const list = [...cards];
    if (state.sort === 'newest' && newRank.size) list.sort((a, b) => (newRank.has(a.id) ? newRank.get(a.id) : 99) - (newRank.has(b.id) ? newRank.get(b.id) : 99));
    else if (state.sort === 'price-asc') list.sort((a, b) => a.price - b.price);
    else if (state.sort === 'price-desc') list.sort((a, b) => b.price - a.price);
    else list.sort((a, b) => a.order - b.order);
    return list;
  }
  function passes(c) {
    if (state.authOnly && !c.auth) return false;
    if (state.cats.size && !state.cats.has(c.cat)) return false;
    return true;
  }
  function render() {
    const list = sorted();
    const visible = list.filter(passes);
    list.forEach(c => { grid.appendChild(c.el); c.el.style.display = 'none'; });
    visible.slice(0, state.shown).forEach(c => { c.el.style.display = ''; });
    if (moreBtn) {
      const remaining = visible.length - state.shown;
      moreBtn.style.display = remaining > 0 ? '' : 'none';
      if (remaining > 0) moreBtn.textContent = 'Show ' + Math.min(12, remaining) + ' more';
    }
    if (countEl) {
      const filtered = state.cats.size || state.authOnly;
      countEl.textContent = visible.length + ' piece' + (visible.length === 1 ? '' : 's') +
        (filtered ? ' matching your filters' : ' across every category');
    }
    let empty = document.getElementById('sc-empty');
    if (!visible.length) {
      if (!empty) {
        empty = document.createElement('p');
        empty.id = 'sc-empty';
        empty.textContent = 'No pieces match your filters.';
        empty.style.cssText = 'grid-column:1/-1;text-align:center;padding:48px 0;opacity:.6;';
        grid.appendChild(empty);
      }
    } else if (empty) empty.remove();
  }
  if (sortSelect) sortSelect.addEventListener('change', e => {
    state.sort = e.target.value; state.shown = moreBtn ? 12 : cards.length; render();
  });
  if (authBtn) authBtn.addEventListener('click', () => {
    state.authOnly = !state.authOnly;
    state.shown = moreBtn ? 12 : cards.length;
    authBtn.className = state.authOnly ? UI.authOn : UI.authOff;
    render();
  });
  pills.forEach(btn => btn.addEventListener('click', () => {
    const cat = PILL_CATS[btn.textContent.trim()];
    if (state.cats.has(cat)) state.cats.delete(cat); else state.cats.add(cat);
    state.shown = moreBtn ? 12 : cards.length;
    btn.className = state.cats.has(cat) ? UI.pillOn : UI.pillOff;
    render();
  }));
  if (moreBtn) moreBtn.addEventListener('click', () => { state.shown += 12; render(); });
  if (sortSelect || authBtn || pills.length || moreBtn) render();
})();
