// ============================================================================
// SecondChance Collective — configuration
//
// Fill in your publishable key below. Get it from:
//   Supabase dashboard → Project Settings → API Keys → Publishable key
//
// It starts with `sb_publishable_`. If you only see legacy keys, use the
// `anon` key from the "Legacy API Keys" tab instead — both work.
//
// This key is DESIGNED to be public. It ships to every visitor's browser,
// and Row Level Security is what actually protects your data.
//
// NEVER put the secret key (`sb_secret_...`) or the legacy `service_role`
// key in this file. Those bypass all security.
// ============================================================================

export const SUPABASE_URL = 'https://yjlfiotjrjkfwxzjrkcf.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_jPV9ToHbfjGdHgVFPxbU2Q_cOzWSh50';

// ---------------------------------------------------------------------------
// Business constants. These are display defaults only — the authoritative
// values live in the platform_settings table and are loaded at runtime, so
// changing them in Admin → Settings updates the whole site.
// ---------------------------------------------------------------------------
export const DEFAULTS = {
  currency: 'JOD',
  commissionRate: 0.12,
  authThreshold: 350,
  buyerProtectionRate: 0.05,
  buyerProtectionMin: 3,
};

export const CITIES = [
  'Amman', 'Zarqa', 'Irbid', 'Aqaba', 'Madaba', 'Salt',
  'Jerash', 'Ajloun', 'Karak', 'Mafraq', 'Tafilah', "Ma'an",
];

export const PAYMENT_METHODS = [
  { value: 'card',         label: 'Card',            note: 'Visa or Mastercard' },
  { value: 'cliq',         label: 'CliQ',            note: 'Instant bank transfer' },
  { value: 'efawateercom', label: 'eFAWATEERcom',    note: 'Pay through your bank' },
  { value: 'cod',          label: 'Cash on delivery', note: 'Pay the courier' },
];

export const PHOTO_SLOTS = [
  { slot: 'front',  label: 'Front',  note: 'Whole piece, straight on' },
  { slot: 'back',   label: 'Back',   note: 'Including the base' },
  { slot: 'detail', label: 'Detail', note: 'Hardware or stitching' },
  { slot: 'label',  label: 'Label',  note: 'Interior stamp or serial' },
];

// Every permission the admin panel understands, grouped for the roles screen.
export const PERMISSIONS = {
  'Users': [
    ['users.view', 'View members'],
    ['users.manage', 'Edit member details'],
    ['users.suspend', 'Suspend or block members'],
    ['users.approve_sellers', 'Approve seller accounts'],
  ],
  'Listings': [
    ['listings.view', 'View all listings'],
    ['listings.moderate', 'Approve, reject and edit listings'],
    ['listings.authenticate', 'Record authentication results'],
    ['taxonomy.manage', 'Manage categories, brands and sizes'],
  ],
  'Orders': [
    ['orders.view', 'View orders'],
    ['orders.manage', 'Change order status'],
    ['orders.returns', 'Handle returns and refunds'],
    ['orders.disputes', 'Resolve disputes'],
  ],
  'Money': [
    ['payments.view', 'View transactions'],
    ['payments.manage', 'Adjust transactions'],
    ['payments.payouts', 'Approve and send payouts'],
  ],
  'Platform': [
    ['reports.manage', 'Handle reports and complaints'],
    ['promotions.manage', 'Discount codes, banners, collections'],
    ['content.manage', 'Pages, FAQs, blog'],
    ['notifications.send', 'Send notifications'],
    ['analytics.view', 'View analytics'],
    ['settings.manage', 'Change platform settings'],
  ],
  'Administration': [
    ['admin.manage_admins', 'Add and remove admins'],
    ['admin.manage_roles', 'Create and edit roles'],
    ['admin.view_audit', 'View audit trail and login history'],
  ],
};
