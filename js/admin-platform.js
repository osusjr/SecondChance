// ============================================================================
// Admin sections: promotions, content, notifications,
// admins & roles, audit trail, platform settings
// ============================================================================

import {
  sb, session, money, num, date, ago, esc, badge, titleCase, initials,
  toast, modal, confirmAction, empty, downloadCsv, errorMessage,
} from './sc-core.js';
import { toolbar, table, wireToolbar, adminAction } from './sc-admin.js';
import { askText } from './admin-core.js';
import { PERMISSIONS } from './config.js';

const cur = ctx => ctx.settings?.currency || 'JOD';

// ---------------------------------------------------------------------------
// 9. PROMOTIONS
// ---------------------------------------------------------------------------
async function promotions({ setContent, setTitle, ctx }) {
  setTitle('Promotions', 'Discount codes, banners and featured collections');

  const root = setContent(toolbar({
    tabs: [
      { value: 'codes', label: 'Discount codes', active: true },
      { value: 'banners', label: 'Banners' },
      { value: 'collections', label: 'Collections' },
      { value: 'featured', label: 'Featured sellers' },
    ],
    search: false,
    extra: '<button class="sc-btn sc-btn-primary sc-btn-sm" data-new>Create</button>',
  }) + '<div data-list></div>');

  let current = 'codes';

  const load = async ({ filter }) => {
    current = filter;
    const host = root.querySelector('[data-list]');
    host.innerHTML = '<div class="sc-skeleton" style="height:180px"></div>';

    if (filter === 'codes') {
      const { data } = await sb.from('discount_codes').select('*').order('created_at', { ascending: false });
      host.innerHTML = table({
        columns: [{ label: 'Code' }, { label: 'Discount' }, { label: 'Minimum' },
                  { label: 'Used' }, { label: 'Runs until' }, { label: 'Status' }, { label: '' }],
        emptyTitle: 'No discount codes',
        emptyText: 'Create one to run a campaign.',
        rows: (data || []).map(d => `<tr>
          <td><span style="font-weight:600;letter-spacing:.03em">${esc(d.code)}</span></td>
          <td class="sc-sm">${d.type === 'percent' ? d.value + '%'
            : d.type === 'fixed' ? money(d.value, cur(ctx)) : 'Free shipping'}</td>
          <td class="sc-sm">${d.min_order ? money(d.min_order, cur(ctx)) : '—'}</td>
          <td class="sc-sm">${num(d.used_count)}${d.max_uses ? ` / ${d.max_uses}` : ''}</td>
          <td class="sc-sm sc-muted">${d.ends_at ? date(d.ends_at) : 'No end date'}</td>
          <td>${d.is_active ? '<span class="sc-badge sc-badge-ok">Live</span>' : '<span class="sc-badge">Off</span>'}</td>
          <td class="sc-cell-actions">
            <button class="sc-btn sc-btn-ghost sc-btn-xs" data-toggle="discount_codes:${d.id}:${d.is_active}">
              ${d.is_active ? 'Turn off' : 'Turn on'}</button>
            <button class="sc-btn sc-btn-danger sc-btn-xs" data-del="discount_codes:${d.id}">Delete</button>
          </td></tr>`),
      });
    }

    if (filter === 'banners') {
      const { data } = await sb.from('banners').select('*').order('sort_order');
      host.innerHTML = table({
        columns: [{ label: 'Banner' }, { label: 'Placement' }, { label: 'Runs' }, { label: 'Status' }, { label: '' }],
        emptyTitle: 'No banners',
        rows: (data || []).map(b => `<tr>
          <td><p style="font-weight:500">${esc(b.title)}</p>
            <p class="sc-xs sc-muted">${esc(b.subtitle || '')}</p></td>
          <td class="sc-sm">${esc(titleCase(b.placement))}</td>
          <td class="sc-sm sc-muted">${b.starts_at ? date(b.starts_at) : 'Now'} → ${b.ends_at ? date(b.ends_at) : 'Open'}</td>
          <td>${b.is_active ? '<span class="sc-badge sc-badge-ok">Live</span>' : '<span class="sc-badge">Off</span>'}</td>
          <td class="sc-cell-actions">
            <button class="sc-btn sc-btn-ghost sc-btn-xs" data-toggle="banners:${b.id}:${b.is_active}">
              ${b.is_active ? 'Turn off' : 'Turn on'}</button>
            <button class="sc-btn sc-btn-danger sc-btn-xs" data-del="banners:${b.id}">Delete</button>
          </td></tr>`),
      });
    }

    if (filter === 'collections') {
      const { data } = await sb.from('featured_collections')
        .select('*, items:featured_collection_items(listing_id)').order('sort_order');
      host.innerHTML = table({
        columns: [{ label: 'Collection' }, { label: 'Pieces' }, { label: 'Status' }, { label: '' }],
        emptyTitle: 'No collections',
        emptyText: 'Group listings into an edit for the homepage.',
        rows: (data || []).map(c => `<tr>
          <td><p style="font-weight:500">${esc(c.title)}</p>
            <p class="sc-xs sc-muted">/${esc(c.slug)}</p></td>
          <td class="sc-sm">${num(c.items?.length || 0)}</td>
          <td>${c.is_active ? '<span class="sc-badge sc-badge-ok">Live</span>' : '<span class="sc-badge">Off</span>'}</td>
          <td class="sc-cell-actions">
            <button class="sc-btn sc-btn-ghost sc-btn-xs" data-toggle="featured_collections:${c.id}:${c.is_active}">
              ${c.is_active ? 'Turn off' : 'Turn on'}</button>
            <button class="sc-btn sc-btn-danger sc-btn-xs" data-del="featured_collections:${c.id}">Delete</button>
          </td></tr>`),
      });
    }

    if (filter === 'featured') {
      const { data } = await sb.from('featured_sellers')
        .select('*, seller:profiles(username, full_name, city)').order('sort_order');
      host.innerHTML = table({
        columns: [{ label: 'Seller' }, { label: 'Headline' }, { label: 'Status' }, { label: '' }],
        emptyTitle: 'No featured sellers',
        rows: (data || []).map(f => `<tr>
          <td class="sc-sm">${esc(f.seller?.username || f.seller?.full_name || '—')}</td>
          <td class="sc-sm">${esc(f.headline || '—')}</td>
          <td>${f.is_active ? '<span class="sc-badge sc-badge-ok">Live</span>' : '<span class="sc-badge">Off</span>'}</td>
          <td class="sc-cell-actions">
            <button class="sc-btn sc-btn-danger sc-btn-xs" data-del-featured="${f.seller_id}">Remove</button>
          </td></tr>`),
      });
    }

    host.querySelectorAll('[data-toggle]').forEach(b => b.addEventListener('click', async () => {
      const [tbl, id, active] = b.dataset.toggle.split(':');
      await adminAction(() => sb.from(tbl).update({ is_active: active !== 'true' }).eq('id', id), 'Updated.');
      load({ filter });
    }));

    host.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
      const [tbl, id] = b.dataset.del.split(':');
      if (!await confirmAction('Delete this?', 'It cannot be brought back.', 'Delete', true)) return;
      await adminAction(() => sb.from(tbl).delete().eq('id', id), 'Deleted.');
      load({ filter });
    }));

    host.querySelectorAll('[data-del-featured]').forEach(b => b.addEventListener('click', async () => {
      await adminAction(() => sb.from('featured_sellers').delete().eq('seller_id', b.dataset.delFeatured), 'Removed.');
      load({ filter });
    }));
  };

  wireToolbar(root, load);
  await load({ filter: 'codes' });

  root.querySelector('[data-new]')?.addEventListener('click', async () => {
    if (current === 'codes') return createCode(() => load({ filter: current }), ctx);
    if (current === 'banners') return createBanner(() => load({ filter: current }));
    if (current === 'collections') return createCollection(() => load({ filter: current }));
    if (current === 'featured') return addFeaturedSeller(() => load({ filter: current }));
  });
}

async function createCode(reload, ctx) {
  const result = await modal({
    title: 'New discount code',
    body: `<form class="sc-stack">
      <div class="sc-field"><label class="sc-label">Code</label>
        <input class="sc-input" name="code" required placeholder="WELCOME10"
               style="text-transform:uppercase;letter-spacing:.05em"></div>
      <div class="sc-grid sc-grid-2">
        <div class="sc-field"><label class="sc-label">Type</label>
          <select class="sc-select" name="type">
            <option value="percent">Percentage off</option>
            <option value="fixed">Fixed amount off</option>
                      </select></div>
        <div class="sc-field"><label class="sc-label">Value</label>
          <input class="sc-input" name="value" type="number" step="0.01" required value="10"></div>
      </div>
      <div class="sc-grid sc-grid-2">
        <div class="sc-field"><label class="sc-label">Minimum order</label>
          <input class="sc-input" name="min_order" type="number" step="0.01" value="0"></div>
        <div class="sc-field"><label class="sc-label">Maximum uses</label>
          <input class="sc-input" name="max_uses" type="number" placeholder="Unlimited"></div>
      </div>
      <div class="sc-field"><label class="sc-label">Runs until</label>
        <input class="sc-input" name="ends_at" type="date"></div>
    </form>`,
    actions: [{ label: 'Cancel', value: false }, { label: 'Create code', value: true, kind: 'sc-btn-primary' }],
  });
  if (result?.value !== true) return;
  const v = result.values;
  if (!v.code) return toast('Give the code a name.', 'danger');

  await adminAction(() => sb.from('discount_codes').insert({
    code: v.code.toUpperCase().trim(), type: v.type, value: Number(v.value),
    min_order: Number(v.min_order) || 0,
    max_uses: v.max_uses ? Number(v.max_uses) : null,
    ends_at: v.ends_at || null, created_by: session.user.id,
  }), 'Code created.');
  reload();
}

async function createBanner(reload) {
  const result = await modal({
    title: 'New banner',
    body: `<form class="sc-stack">
      <div class="sc-field"><label class="sc-label">Title</label>
        <input class="sc-input" name="title" required></div>
      <div class="sc-field"><label class="sc-label">Subtitle</label>
        <input class="sc-input" name="subtitle"></div>
      <div class="sc-field"><label class="sc-label">Image URL</label>
        <input class="sc-input" name="image_url" placeholder="https://…"></div>
      <div class="sc-field"><label class="sc-label">Links to</label>
        <input class="sc-input" name="link_url" placeholder="catalog-bags.html"></div>
      <div class="sc-field"><label class="sc-label">Where it shows</label>
        <select class="sc-select" name="placement">
          <option value="homepage_hero">Homepage hero</option>
          <option value="homepage_strip">Homepage strip</option>
          <option value="announcement_bar">Announcement bar</option>
          <option value="category_top">Top of a category</option>
          <option value="sell_page">Sell page</option>
        </select></div>
    </form>`,
    actions: [{ label: 'Cancel', value: false }, { label: 'Create banner', value: true, kind: 'sc-btn-primary' }],
  });
  if (result?.value !== true) return;
  await adminAction(() => sb.from('banners').insert({
    ...result.values, created_by: session.user.id,
  }), 'Banner created.');
  reload();
}

async function createCollection(reload) {
  const result = await modal({
    title: 'New collection',
    body: `<form class="sc-stack">
      <div class="sc-field"><label class="sc-label">Title</label>
        <input class="sc-input" name="title" required placeholder="Quiet luxury"></div>
      <div class="sc-field"><label class="sc-label">Description</label>
        <textarea class="sc-textarea" name="description"></textarea></div>
    </form>`,
    actions: [{ label: 'Cancel', value: false }, { label: 'Create collection', value: true, kind: 'sc-btn-primary' }],
  });
  if (result?.value !== true) return;
  const slug = result.values.title.toLowerCase().replace(/[^\w]+/g, '-').replace(/^-|-$/g, '');
  await adminAction(() => sb.from('featured_collections').insert({
    ...result.values, slug, created_by: session.user.id,
  }), 'Collection created.');
  reload();
}

async function addFeaturedSeller(reload) {
  const username = await askText('Feature a seller', 'Their username', false);
  if (!username) return;
  const { data: profile } = await sb.from('profiles')
    .select('id').eq('username', username.replace('@', '')).maybeSingle();
  if (!profile) return toast('No member with that username.', 'danger');

  const headline = await askText('Headline', 'A line about them', false);
  await adminAction(() => sb.from('featured_sellers').insert({
    seller_id: profile.id, headline, is_active: true,
  }), 'Seller featured.');
  reload();
}

// ---------------------------------------------------------------------------
// 10. CONTENT MANAGEMENT
// ---------------------------------------------------------------------------
async function content({ setContent, setTitle }) {
  setTitle('Content', 'The words on the site, editable without a deploy');

  const root = setContent(toolbar({
    tabs: [
      { value: 'pages', label: 'Pages', active: true },
      { value: 'blocks', label: 'Homepage text' },
      { value: 'faqs', label: 'FAQs' },
      { value: 'blog', label: 'Blog' },
    ],
    search: false,
    extra: '<button class="sc-btn sc-btn-primary sc-btn-sm" data-new>Add</button>',
  }) + '<div data-list></div>');

  let current = 'pages';

  const load = async ({ filter }) => {
    current = filter;
    const host = root.querySelector('[data-list]');
    host.innerHTML = '<div class="sc-skeleton" style="height:180px"></div>';

    if (filter === 'pages') {
      const { data } = await sb.from('content_pages').select('*').order('slug');
      host.innerHTML = table({
        columns: [{ label: 'Page' }, { label: 'Status' }, { label: 'Updated' }, { label: '' }],
        emptyTitle: 'No pages',
        rows: (data || []).map(p => `<tr>
          <td><p style="font-weight:500">${esc(p.title)}</p>
            <p class="sc-xs sc-muted">/${esc(p.slug)}</p></td>
          <td>${badge(p.status)}</td>
          <td class="sc-sm sc-muted">${date(p.updated_at)}</td>
          <td class="sc-cell-actions">
            <button class="sc-btn sc-btn-ghost sc-btn-xs" data-edit-page="${p.id}">Edit</button></td>
        </tr>`),
      });

      host.querySelectorAll('[data-edit-page]').forEach(b => b.addEventListener('click', async () => {
        const p = data.find(x => x.id === b.dataset.editPage);
        const result = await modal({
          size: 'lg', title: `Edit: ${p.title}`,
          body: `<form class="sc-stack">
            <div class="sc-field"><label class="sc-label">Title</label>
              <input class="sc-input" name="title" value="${esc(p.title)}"></div>
            <div class="sc-field"><label class="sc-label">Body</label>
              <textarea class="sc-textarea" name="body" style="min-height:280px;font-family:ui-monospace,monospace;font-size:13px">${esc(p.body || '')}</textarea>
              <p class="sc-hint">Plain text or simple HTML.</p></div>
            <div class="sc-field"><label class="sc-label">Status</label>
              <select class="sc-select" name="status">
                ${['draft', 'published', 'archived'].map(s =>
                  `<option value="${s}" ${s === p.status ? 'selected' : ''}>${titleCase(s)}</option>`).join('')}
              </select></div>
          </form>`,
          actions: [{ label: 'Cancel', value: false }, { label: 'Save page', value: true, kind: 'sc-btn-primary' }],
        });
        if (result?.value !== true) return;
        await adminAction(() => sb.from('content_pages').update({
          ...result.values, updated_by: session.user.id,
          published_at: result.values.status === 'published' ? new Date().toISOString() : p.published_at,
        }).eq('id', p.id), 'Page saved.');
        load({ filter });
      }));
    }

    if (filter === 'blocks') {
      const { data } = await sb.from('content_blocks').select('*').order('key');
      host.innerHTML = table({
        columns: [{ label: 'What it is' }, { label: 'Current text' }, { label: '' }],
        emptyTitle: 'No text blocks',
        rows: (data || []).map(b => `<tr>
          <td><p style="font-weight:500">${esc(b.label)}</p>
            <p class="sc-xs sc-muted">${esc(b.key)}</p></td>
          <td class="sc-sm sc-truncate" style="max-width:340px">${esc(b.value || '')}</td>
          <td class="sc-cell-actions">
            <button class="sc-btn sc-btn-ghost sc-btn-xs" data-edit-block="${b.id}">Edit</button></td>
        </tr>`),
      });

      host.querySelectorAll('[data-edit-block]').forEach(b => b.addEventListener('click', async () => {
        const block = data.find(x => x.id === b.dataset.editBlock);
        const value = await askText(block.label, block.value || '');
        if (value === null) return;
        await adminAction(() => sb.from('content_blocks')
          .update({ value, updated_by: session.user.id, updated_at: new Date().toISOString() })
          .eq('id', block.id), 'Saved.');
        load({ filter });
      }));
    }

    if (filter === 'faqs') {
      const { data } = await sb.from('faqs').select('*').order('sort_order');
      host.innerHTML = table({
        columns: [{ label: 'Question' }, { label: 'Category' }, { label: 'Status' }, { label: '' }],
        emptyTitle: 'No FAQs',
        rows: (data || []).map(f => `<tr>
          <td><p style="font-weight:500">${esc(f.question)}</p>
            <p class="sc-xs sc-muted sc-truncate" style="max-width:320px">${esc(f.answer)}</p></td>
          <td class="sc-sm">${esc(f.category || '—')}</td>
          <td>${f.is_active ? '<span class="sc-badge sc-badge-ok">Live</span>' : '<span class="sc-badge">Hidden</span>'}</td>
          <td class="sc-cell-actions">
            <button class="sc-btn sc-btn-ghost sc-btn-xs" data-toggle-faq="${f.id}:${f.is_active}">
              ${f.is_active ? 'Hide' : 'Show'}</button>
            <button class="sc-btn sc-btn-danger sc-btn-xs" data-del-faq="${f.id}">Delete</button></td>
        </tr>`),
      });

      host.querySelectorAll('[data-toggle-faq]').forEach(b => b.addEventListener('click', async () => {
        const [id, active] = b.dataset.toggleFaq.split(':');
        await adminAction(() => sb.from('faqs').update({ is_active: active !== 'true' }).eq('id', id), 'Updated.');
        load({ filter });
      }));
      host.querySelectorAll('[data-del-faq]').forEach(b => b.addEventListener('click', async () => {
        if (!await confirmAction('Delete this FAQ?', 'It cannot be brought back.', 'Delete', true)) return;
        await adminAction(() => sb.from('faqs').delete().eq('id', b.dataset.delFaq), 'Deleted.');
        load({ filter });
      }));
    }

    if (filter === 'blog') {
      const { data } = await sb.from('blog_posts').select('*').order('created_at', { ascending: false });
      host.innerHTML = table({
        columns: [{ label: 'Post' }, { label: 'Status' }, { label: 'Published' }, { label: '' }],
        emptyTitle: 'No posts yet',
        emptyText: 'Write about authentication, brands or how to price a piece.',
        rows: (data || []).map(p => `<tr>
          <td><p style="font-weight:500">${esc(p.title)}</p>
            <p class="sc-xs sc-muted">/${esc(p.slug)}</p></td>
          <td>${badge(p.status)}</td>
          <td class="sc-sm sc-muted">${p.published_at ? date(p.published_at) : '—'}</td>
          <td class="sc-cell-actions">
            <button class="sc-btn sc-btn-danger sc-btn-xs" data-del-post="${p.id}">Delete</button></td>
        </tr>`),
      });
      host.querySelectorAll('[data-del-post]').forEach(b => b.addEventListener('click', async () => {
        if (!await confirmAction('Delete this post?', 'It cannot be brought back.', 'Delete', true)) return;
        await adminAction(() => sb.from('blog_posts').delete().eq('id', b.dataset.delPost), 'Deleted.');
        load({ filter });
      }));
    }
  };

  wireToolbar(root, load);
  await load({ filter: 'pages' });

  root.querySelector('[data-new]')?.addEventListener('click', async () => {
    if (current === 'faqs') {
      const result = await modal({
        title: 'New FAQ',
        body: `<form class="sc-stack">
          <div class="sc-field"><label class="sc-label">Question</label>
            <input class="sc-input" name="question" required></div>
          <div class="sc-field"><label class="sc-label">Answer</label>
            <textarea class="sc-textarea" name="answer" required></textarea></div>
          <div class="sc-field"><label class="sc-label">Category</label>
            <input class="sc-input" name="category" value="general"></div>
        </form>`,
        actions: [{ label: 'Cancel', value: false }, { label: 'Add FAQ', value: true, kind: 'sc-btn-primary' }],
      });
      if (result?.value !== true) return;
      await adminAction(() => sb.from('faqs').insert({
        ...result.values, updated_by: session.user.id,
      }), 'FAQ added.');
      return load({ filter: current });
    }

    if (current === 'pages' || current === 'blog') {
      const title = await askText(current === 'blog' ? 'New post title' : 'New page title', '', false);
      if (!title) return;
      const slug = title.toLowerCase().replace(/[^\w]+/g, '-').replace(/^-|-$/g, '');
      const tbl = current === 'blog' ? 'blog_posts' : 'content_pages';
      await adminAction(() => sb.from(tbl).insert(
        current === 'blog'
          ? { title, slug, author_id: session.user.id }
          : { title, slug, updated_by: session.user.id }
      ), 'Created.');
      return load({ filter: current });
    }

    toast('Homepage text blocks are fixed. Edit the ones that are there.');
  });
}

// ---------------------------------------------------------------------------
// 11. NOTIFICATIONS
// ---------------------------------------------------------------------------
async function notifications({ setContent, setTitle }) {
  setTitle('Notifications', 'Message everyone, or just buyers or sellers');

  const render = async () => {
    const { data: campaigns } = await sb.from('notification_campaigns')
      .select('*, author:profiles(username, full_name)')
      .order('created_at', { ascending: false }).limit(40);

    const root = setContent(`
      <div class="sc-grid sc-grid-2" style="align-items:start">
        <form class="sc-card sc-stack" id="notif-form">
          <h2 class="sc-h2">Send a notification</h2>
          <div class="sc-field"><label class="sc-label">Who gets it</label>
            <select class="sc-select" name="audience">
              <option value="all">Everyone</option>
              <option value="sellers">Sellers only</option>
              <option value="buyers">Buyers only</option>
            </select></div>
          <div class="sc-field"><label class="sc-label">Title</label>
            <input class="sc-input" name="title" required maxlength="80"
                   placeholder="New drop: vintage Chanel"></div>
          <div class="sc-field"><label class="sc-label">Message</label>
            <textarea class="sc-textarea" name="body" required maxlength="300"
              placeholder="Keep it short. People read these on a phone."></textarea></div>
          <div class="sc-field"><label class="sc-label">Links to <span class="sc-muted sc-xs">optional</span></label>
            <input class="sc-input" name="link" placeholder="catalog-bags.html"></div>
          <div class="sc-note sc-note-warn">
            This goes to every matching member at once and cannot be recalled.
          </div>
          <button class="sc-btn sc-btn-primary" type="submit">Send notification</button>
        </form>

        <div class="sc-card sc-card-flush">
          <h2 class="sc-h2" style="padding:18px 18px 10px">Sent</h2>
          <div class="sc-table-wrap" style="border:0;border-radius:0"><table class="sc-table">
            <thead><tr><th>Title</th><th>Audience</th><th>Reached</th><th>When</th></tr></thead>
            <tbody>${(campaigns || []).map(c => `<tr>
              <td><p class="sc-sm" style="font-weight:500">${esc(c.title)}</p>
                <p class="sc-xs sc-muted sc-truncate" style="max-width:200px">${esc(c.body)}</p></td>
              <td class="sc-sm">${esc(titleCase(c.audience))}</td>
              <td class="sc-sm">${num(c.recipient_count)}</td>
              <td class="sc-xs sc-muted">${ago(c.created_at)}</td>
            </tr>`).join('') || '<tr><td colspan="4" class="sc-sm sc-muted" style="padding:20px">Nothing sent yet.</td></tr>'}
            </tbody></table></div>
        </div>
      </div>`);

    root.querySelector('#notif-form').addEventListener('submit', async e => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target));
      if (!await confirmAction('Send this notification?',
        `It goes to ${f.audience === 'all' ? 'every member' : f.audience} straight away.`, 'Send')) return;

      const { data, error } = await sb.rpc('admin_send_notification', {
        p_title: f.title, p_body: f.body, p_audience: f.audience, p_link: f.link || null,
      });
      if (error) return toast(errorMessage(error), 'danger');
      toast(`Sent to ${data} member${data === 1 ? '' : 's'}.`, 'ok');
      render();
    });
  };

  await render();
}

// ---------------------------------------------------------------------------
// 13a. ADMINS & ROLES
// ---------------------------------------------------------------------------
async function admins({ setContent, setTitle }) {
  setTitle('Admins & roles', 'Who can get in, and what they can touch');

  const render = async () => {
    const [{ data: staff }, { data: roles }] = await Promise.all([
      sb.from('admin_users')
        .select('*, user:profiles(id, username, full_name), role:admin_roles(id, key, name, permissions)')
        .order('created_at'),
      sb.from('admin_roles').select('*').order('key'),
    ]);

    const root = setContent(`
      <div class="sc-card sc-card-flush">
        <div class="sc-between" style="padding:18px 18px 10px">
          <h2 class="sc-h2">Admin accounts</h2>
          <button class="sc-btn sc-btn-primary sc-btn-sm" data-add-admin>Add an admin</button>
        </div>
        <div class="sc-table-wrap" style="border:0;border-radius:0"><table class="sc-table">
          <thead><tr><th>Person</th><th>Role</th><th>Two-factor</th><th>Last signed in</th><th>Status</th><th></th></tr></thead>
          <tbody>${(staff || []).map(a => `<tr>
            <td><div class="sc-row-tight">
              <span class="sc-avatar">${esc(initials(a.user?.full_name || a.user?.username))}</span>
              <div><p style="font-weight:500">${esc(a.user?.full_name || a.user?.username || '—')}</p>
                <p class="sc-xs sc-muted">${esc(a.user?.username ? '@' + a.user.username : '')}</p></div>
            </div></td>
            <td><span class="sc-badge sc-badge-accent">${esc(a.role?.name || '—')}</span></td>
            <td class="sc-sm">${a.require_otp === false
              ? '<span class="sc-badge sc-badge-warn">Off</span>'
              : '<span class="sc-badge sc-badge-ok">Email code</span>'}</td>
            <td class="sc-sm sc-muted">${a.last_login_at ? ago(a.last_login_at) : 'Never'}</td>
            <td>${a.is_active ? '<span class="sc-badge sc-badge-ok">Active</span>' : '<span class="sc-badge">Disabled</span>'}</td>
            <td class="sc-cell-actions">
              <button class="sc-btn sc-btn-ghost sc-btn-xs" data-role="${a.id}">Change role</button>
              <button class="sc-btn sc-btn-ghost sc-btn-xs" data-otp="${a.id}:${a.require_otp !== false}">
                ${a.require_otp === false ? 'Require code' : 'Skip code'}</button>
              ${a.user?.id === session.user.id ? ''
                : `<button class="sc-btn sc-btn-danger sc-btn-xs" data-revoke="${a.id}">Revoke</button>`}
            </td></tr>`).join('')}
          </tbody></table></div>
      </div>

      <div class="sc-card sc-card-flush" style="margin-top:18px">
        <div class="sc-between" style="padding:18px 18px 10px">
          <h2 class="sc-h2">Roles</h2>
          <button class="sc-btn sc-btn-ghost sc-btn-sm" data-add-role>New role</button>
        </div>
        <div style="padding:0 18px 18px">
          ${(roles || []).map(r => `
            <div style="padding:14px 0;border-bottom:1px solid var(--color-line)">
              <div class="sc-between">
                <div><p class="sc-h3">${esc(r.name)}
                  ${r.is_system ? '<span class="sc-badge">Built in</span>' : ''}</p>
                  <p class="sc-sm sc-muted" style="margin-top:3px">${esc(r.description || '')}</p></div>
                <button class="sc-btn sc-btn-ghost sc-btn-xs" data-edit-role="${r.id}">Permissions</button>
              </div>
              <div class="sc-row-tight" style="margin-top:9px;gap:5px">
                ${r.permissions.includes('*')
                  ? '<span class="sc-badge sc-badge-accent">Full access</span>'
                  : r.permissions.slice(0, 8).map(p => `<span class="sc-badge">${esc(p)}</span>`).join('') +
                    (r.permissions.length > 8 ? `<span class="sc-badge">+${r.permissions.length - 8} more</span>` : '')}
              </div>
            </div>`).join('')}
        </div>
      </div>`);

    root.querySelector('[data-add-admin]')?.addEventListener('click', async () => {
      const result = await modal({
        title: 'Add an admin',
        body: `<p class="sc-lead" style="margin-bottom:14px">
            The person needs an account on the site already. Give their username or email.</p>
          <form class="sc-stack">
            <div class="sc-field"><label class="sc-label">Username or email</label>
              <input class="sc-input" name="who" required></div>
            <div class="sc-field"><label class="sc-label">Role</label>
              <select class="sc-select" name="role_id">
                ${(roles || []).map(r => `<option value="${r.id}">${esc(r.name)}</option>`).join('')}
              </select></div>
            <div class="sc-note sc-note-warn">
              Admins can see member data. Give the narrowest role that lets them do their job.
            </div>
          </form>`,
        actions: [{ label: 'Cancel', value: false }, { label: 'Add admin', value: true, kind: 'sc-btn-primary' }],
      });
      if (result?.value !== true) return;

      // Strip only a leading @ so emails survive; try username first, then email.
      const raw = result.values.who.trim();
      const who = raw.replace(/^@/, '');
      let { data: profile } = await sb.from('profiles')
        .select('id, username, full_name').eq('username', who).maybeSingle();
      if (!profile && raw.includes('@')) {
        ({ data: profile } = await sb.from('profiles')
          .select('id, username, full_name').eq('email', raw).maybeSingle());
      }
      if (!profile) return toast('No member with that username or email. They need to sign up first.', 'danger');

      // If they already hold a role, offer to change it instead of failing
      // on the one-admin-row-per-person constraint.
      const { data: existing } = await sb.from('admin_users')
        .select('id, is_active, role:admin_roles(name)').eq('user_id', profile.id).maybeSingle();

      if (existing) {
        const newRole = (roles || []).find(r => r.id === result.values.role_id);
        const newRoleName = newRole?.name || 'the new role';
        const person = profile.full_name || profile.username || 'They';

        // Same lockout guard as the change-role handler: never demote the
        // last active full-access admin through this side door.
        const row = (staff || []).find(s => s.id === existing.id);
        const losesFull = row?.role?.permissions?.includes('*') && !newRole?.permissions?.includes('*');
        if (losesFull && existing.is_active) {
          const otherFull = (staff || []).filter(s =>
            s.id !== existing.id && s.is_active && s.role?.permissions?.includes('*'));
          if (!otherFull.length)
            return toast('That is the only account with full access. Make someone else Super Admin first.', 'danger');
          if (profile.id === session.user.id &&
              !await confirmAction('Give up full access?',
                'You are changing your own role — the panel will narrow to the new role when it next loads.',
                'Change my role', true)) return;
        }

        if (!await confirmAction('Already an admin',
          `${person} ${existing.is_active ? 'already has' : 'previously had'} admin access as ` +
          `${existing.role?.name || 'another role'}. Change them to ${newRoleName}?`, 'Change role')) return;
        let res;
        try {
          res = await adminAction(() => sb.from('admin_users')
            .update({ role_id: result.values.role_id, is_active: true })
            .eq('id', existing.id).select('id'));
        } catch { return; }
        if (!res?.data?.length)
          return toast('You do not have permission to change roles.', 'danger');
        toast(`Role changed to ${newRoleName}.`, 'ok');
        render();
        return;
      }

      try {
        await adminAction(() => sb.from('admin_users').insert({
          user_id: profile.id, role_id: result.values.role_id, created_by: session.user.id,
        }), 'Admin added.');
      } catch { return; }
      render();
    });

    root.querySelectorAll('[data-role]').forEach(b => b.addEventListener('click', async () => {
      const row = (staff || []).find(s => s.id === b.dataset.role);
      const result = await modal({
        title: 'Change role',
        body: `${row ? `<p class="sc-lead" style="margin-bottom:14px">
            ${esc(row.user?.full_name || row.user?.username || 'This admin')} is currently
            <strong>${esc(row.role?.name || '—')}</strong>.</p>` : ''}
          <form><div class="sc-field"><label class="sc-label">Role</label>
          <select class="sc-select" name="role_id">
            ${(roles || []).map(r =>
              `<option value="${r.id}" ${r.id === row?.role?.id ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}
          </select></div></form>`,
        actions: [{ label: 'Cancel', value: false }, { label: 'Save', value: true, kind: 'sc-btn-primary' }],
      });
      if (result?.value !== true) return;
      if (result.values.role_id === row?.role?.id) return toast('They already have that role.');

      // Never let the last active full-access account be demoted into a
      // lockout. Disabled rows can be re-roled freely.
      const newRole = (roles || []).find(r => r.id === result.values.role_id);
      const losesFull = row?.role?.permissions?.includes('*') && !newRole?.permissions?.includes('*');
      if (losesFull && row?.is_active !== false) {
        const otherFull = (staff || []).filter(s =>
          s.id !== row?.id && s.is_active && s.role?.permissions?.includes('*'));
        if (!otherFull.length)
          return toast('That is the only account with full access. Make someone else Super Admin first.', 'danger');
        if (row?.user?.id === session.user.id &&
            !await confirmAction('Give up full access?',
              'You are changing your own role — the panel will narrow to the new role when it next loads.',
              'Change my role', true)) return;
      }

      let res;
      try {
        res = await adminAction(() => sb.from('admin_users')
          .update({ role_id: result.values.role_id }).eq('id', b.dataset.role).select('id'));
      } catch { return; }
      if (!res?.data?.length)
        return toast('You do not have permission to change roles.', 'danger');
      toast(`Role changed to ${newRole?.name || 'the new role'}. It takes effect when they next open the panel.`, 'ok');
      render();
    }));

    root.querySelectorAll('[data-otp]').forEach(b => b.addEventListener('click', async () => {
      const [id, on] = b.dataset.otp.split(':');
      await adminAction(() => sb.from('admin_users')
        .update({ require_otp: on !== 'true' }).eq('id', id),
        on === 'true' ? 'Second factor turned off for this admin.' : 'Second factor required.');
      render();
    }));

    root.querySelectorAll('[data-revoke]').forEach(b => b.addEventListener('click', async () => {
      if (!await confirmAction('Revoke admin access?',
        'They keep their member account but lose the panel straight away.', 'Revoke', true)) return;
      await adminAction(() => sb.from('admin_users').delete().eq('id', b.dataset.revoke), 'Access revoked.');
      render();
    }));

    root.querySelectorAll('[data-edit-role]').forEach(b => b.addEventListener('click', async () => {
      const role = roles.find(r => r.id === b.dataset.editRole);
      const has = p => role.permissions.includes('*') || role.permissions.includes(p);

      const result = await modal({
        size: 'lg',
        title: `Permissions: ${role.name}`,
        body: `<form>
          ${role.is_system && role.key === 'super_admin'
            ? '<div class="sc-note sc-note-warn" style="margin-bottom:14px">Super Admin always has everything. This cannot be narrowed.</div>' : ''}
          ${Object.entries(PERMISSIONS).map(([group, items]) => `
            <div style="margin-bottom:16px">
              <p class="sc-eyebrow">${esc(group)}</p>
              <div style="margin-top:8px;display:grid;gap:6px">
                ${items.map(([key, label]) => `
                  <label class="sc-check"><input type="checkbox" name="${key}" value="1"
                    ${has(key) ? 'checked' : ''} ${role.key === 'super_admin' ? 'disabled' : ''}>
                    <span class="sc-sm">${esc(label)}
                      <span class="sc-muted sc-xs"> · ${esc(key)}</span></span></label>`).join('')}
              </div>
            </div>`).join('')}
        </form>`,
        actions: role.key === 'super_admin'
          ? [{ label: 'Close', value: false }]
          : [{ label: 'Cancel', value: false }, { label: 'Save permissions', value: true, kind: 'sc-btn-primary' }],
      });
      if (result?.value !== true) return;

      const permissions = Object.keys(result.values).filter(k => result.values[k] === '1');
      await adminAction(() => sb.from('admin_roles')
        .update({ permissions }).eq('id', role.id), 'Permissions saved.');
      render();
    }));

    root.querySelector('[data-add-role]')?.addEventListener('click', async () => {
      const name = await askText('New role name', 'For example: Warehouse', false);
      if (!name) return;
      const key = name.toLowerCase().replace(/[^\w]+/g, '_');
      await adminAction(() => sb.from('admin_roles').insert({
        key, name, description: 'Set the permissions next.', permissions: [],
      }), 'Role created. Set its permissions.');
      render();
    });
  };

  await render();
}

// ---------------------------------------------------------------------------
// 13b. AUDIT TRAIL
// ---------------------------------------------------------------------------
async function audit({ setContent, setTitle, setActions }) {
  setTitle('Audit trail', 'Who did what, and when');
  setActions('<button class="sc-btn sc-btn-ghost sc-btn-sm" data-export>Export</button>');

  const root = setContent(toolbar({
    tabs: [
      { value: 'activity', label: 'Admin actions', active: true },
      { value: 'logins', label: 'Login history' },
    ],
    placeholder: 'Table or record id',
  }) + '<div data-list></div>');

  let cache = [];

  const load = async ({ filter, query }) => {
    const host = root.querySelector('[data-list]');
    host.innerHTML = '<div class="sc-skeleton" style="height:200px"></div>';

    if (filter === 'logins') {
      const { data } = await sb.from('login_history')
        .select('*, user:profiles(username, full_name)')
        .order('created_at', { ascending: false }).limit(150);
      cache = data || [];

      host.innerHTML = table({
        columns: [{ label: 'When' }, { label: 'Who' }, { label: 'Result' }, { label: 'Address' }, { label: 'Device' }],
        emptyTitle: 'No sign-in attempts recorded',
        rows: cache.map(l => `<tr>
          <td class="sc-sm sc-muted">${date(l.created_at, true)}</td>
          <td class="sc-sm">${esc(l.user?.username || l.email || '—')}</td>
          <td>${l.success ? '<span class="sc-badge sc-badge-ok">Success</span>'
            : `<span class="sc-badge sc-badge-danger">Failed</span>`}
            ${l.failure_reason ? `<br><span class="sc-xs sc-muted">${esc(l.failure_reason)}</span>` : ''}</td>
          <td class="sc-xs sc-muted">${esc(l.ip_address || '—')}</td>
          <td class="sc-xs sc-muted sc-truncate" style="max-width:220px">${esc(l.user_agent || '—')}</td>
        </tr>`),
      });
      return;
    }

    let q = sb.from('admin_activity_log')
      .select('*, admin:profiles(username, full_name)')
      .order('created_at', { ascending: false }).limit(150);
    if (query) q = q.or(`entity_type.ilike.%${query}%,entity_id.ilike.%${query}%`);

    const { data } = await q;
    cache = data || [];

    host.innerHTML = table({
      columns: [{ label: 'When' }, { label: 'Admin' }, { label: 'Action' },
                { label: 'Record' }, { label: '' }],
      emptyTitle: 'Nothing logged yet',
      emptyText: 'Every create, edit and delete an admin makes is written here automatically.',
      rows: cache.map(a => `<tr>
        <td class="sc-sm sc-muted">${date(a.created_at, true)}</td>
        <td class="sc-sm">${esc(a.admin?.username || a.admin?.full_name || 'System')}</td>
        <td>${badge(a.action === 'delete' ? 'rejected' : a.action === 'insert' ? 'active' : 'draft',
          titleCase(a.action))}</td>
        <td class="sc-sm">${esc(titleCase(a.entity_type || '—'))}
          <br><span class="sc-xs sc-muted">${esc((a.entity_id || '').slice(0, 8))}</span></td>
        <td class="sc-cell-actions">
          <button class="sc-btn sc-btn-ghost sc-btn-xs" data-diff="${a.id}">See change</button></td>
      </tr>`),
    });

    host.querySelectorAll('[data-diff]').forEach(b => b.addEventListener('click', () => {
      const entry = cache.find(x => String(x.id) === b.dataset.diff);
      modal({
        size: 'lg',
        title: `${titleCase(entry.action)} on ${titleCase(entry.entity_type || '')}`,
        body: `<dl class="sc-kv"><dt>Admin</dt><dd>${esc(entry.admin?.username || 'System')}</dd>
            <dt>When</dt><dd>${date(entry.created_at, true)}</dd>
            <dt>Record</dt><dd>${esc(entry.entity_id || '—')}</dd></dl>
          <div class="sc-grid sc-grid-2" style="margin-top:16px">
            <div><p class="sc-eyebrow">Before</p>
              <pre style="background:var(--color-surface);padding:12px;border-radius:10px;overflow:auto;
                max-height:300px;font-size:11px;margin-top:6px">${esc(JSON.stringify(entry.before_data, null, 2) || 'Nothing')}</pre></div>
            <div><p class="sc-eyebrow">After</p>
              <pre style="background:var(--color-surface);padding:12px;border-radius:10px;overflow:auto;
                max-height:300px;font-size:11px;margin-top:6px">${esc(JSON.stringify(entry.after_data, null, 2) || 'Deleted')}</pre></div>
          </div>`,
        actions: [{ label: 'Close', value: 'close' }],
      });
    }));
  };

  wireToolbar(root, load);
  await load({ filter: 'activity', query: '' });

  document.querySelector('[data-export]')?.addEventListener('click', () =>
    downloadCsv('secondchance-audit.csv', cache.map(a => ({
      when: a.created_at, admin: a.admin?.username || a.user?.username,
      action: a.action, entity: a.entity_type, record: a.entity_id,
      ip: a.ip_address, success: a.success,
    }))));
}

// ---------------------------------------------------------------------------
// PLATFORM SETTINGS
// ---------------------------------------------------------------------------
async function settings({ setContent, setTitle, ctx }) {
  setTitle('Settings', 'The numbers the whole marketplace runs on');

  const { data: s } = await sb.from('platform_settings').select('*').maybeSingle();

  const root = setContent(`
    <form class="sc-card sc-stack sc-mid" id="settings-form" style="margin:0">
      <h2 class="sc-h2">Money</h2>
      <div class="sc-grid sc-grid-2">
        <div class="sc-field"><label class="sc-label">Commission rate</label>
          <div class="sc-prefix"><span class="sc-prefix-tag">%</span>
            <input class="sc-input" name="commission_rate" type="number" step="0.1"
                   value="${(Number(s.commission_rate) * 100).toFixed(1)}"></div>
          <p class="sc-hint">Taken from the seller when a buyer accepts.</p></div>
        <div class="sc-field"><label class="sc-label">Buyer Protection rate</label>
          <div class="sc-prefix"><span class="sc-prefix-tag">%</span>
            <input class="sc-input" name="buyer_protection_rate" type="number" step="0.1"
                   value="${(Number(s.buyer_protection_rate) * 100).toFixed(1)}"></div>
          <p class="sc-hint">Added on top of the price, paid by the buyer.</p></div>
      </div>
      <div class="sc-grid sc-grid-2">
        <div class="sc-field"><label class="sc-label">Buyer Protection minimum</label>
          <input class="sc-input" name="buyer_protection_min" type="number" step="0.01"
                 value="${s.buyer_protection_min}"></div>
      </div>

      <hr class="sc-divider">
      <h2 class="sc-h2">Rules</h2>
      <div class="sc-grid sc-grid-2">
        <div class="sc-field"><label class="sc-label">Authentication threshold</label>
          <div class="sc-prefix"><span class="sc-prefix-tag">${esc(s.currency)}</span>
            <input class="sc-input" name="authentication_threshold" type="number" step="1"
                   value="${s.authentication_threshold}"></div>
          <p class="sc-hint">Anything at or above this price gets checked before it changes hands.</p></div>
        <div class="sc-field"><label class="sc-label">Payout hold</label>
          <div class="sc-prefix"><span class="sc-prefix-tag">days</span>
            <input class="sc-input" name="payout_hold_days" type="number"
                   value="${s.payout_hold_days}"></div>
          <p class="sc-hint">How long after acceptance a payout is scheduled.</p></div>
      </div>
      <div class="sc-field"><label class="sc-label">Free listings per new seller</label>
        <input class="sc-input" name="free_listings_per_seller" type="number"
               value="${s.free_listings_per_seller}"></div>

      <label class="sc-check"><input type="checkbox" name="require_listing_approval"
        ${s.require_listing_approval ? 'checked' : ''}>
        <span>Every listing needs an admin decision before it goes live.</span></label>
      <label class="sc-check"><input type="checkbox" name="maintenance_mode"
        ${s.maintenance_mode ? 'checked' : ''}>
        <span>Maintenance mode — the site shows a holding page to visitors.</span></label>

      <button class="sc-btn sc-btn-primary" type="submit">Save settings</button>
    </form>`);

  root.querySelector('#settings-form').addEventListener('submit', async e => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    await adminAction(() => sb.from('platform_settings').update({
      commission_rate: Number(f.commission_rate) / 100,
      buyer_protection_rate: Number(f.buyer_protection_rate) / 100,
      buyer_protection_min: Number(f.buyer_protection_min),
      authentication_threshold: Number(f.authentication_threshold),
      payout_hold_days: Number(f.payout_hold_days),
      free_listings_per_seller: Number(f.free_listings_per_seller),
      require_listing_approval: !!f.require_listing_approval,
      maintenance_mode: !!f.maintenance_mode,
      updated_by: session.user.id, updated_at: new Date().toISOString(),
    }).eq('id', true), 'Settings saved.');
  });
}

export default { promotions, content, notifications, admins, audit, settings };
