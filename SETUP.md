# SecondChance Collective — setup

Everything here runs on your Supabase project `yjlfiotjrjkfwxzjrkcf`.
Work through the steps in order. It takes about twenty minutes.

---

## Step 1 — Put your publishable key in the config file

Open `js/config.js`. The project URL is already filled in. You need one more value.

**Supabase dashboard → Project Settings → API Keys**

Your project is new enough that it almost certainly uses the **new key format**.
Look on the **API Keys** tab for the **Publishable key** — it starts with
`sb_publishable_`. If there isn't one yet, click **Create new API keys**.

If instead you see a **Legacy API Keys** tab with an `anon` key starting with `eyJ`,
that works too — either key is fine.

Paste it into line 18:

```js
export const SUPABASE_ANON_KEY = 'sb_publishable_…';
```

**This key is meant to be public.** It ships to every visitor's browser, and that is
fine — Row Level Security is what actually protects your data.

**Never put the secret key in this file.** That is `sb_secret_…` (or the legacy
`service_role` key). It bypasses every security policy. If it reaches the browser,
anyone can read your members' phone numbers, ID documents and payout details. If you
have already pasted it somewhere public, rotate it in the dashboard immediately.

### Check the key works before moving on

Run this in a terminal, substituting your key:

```bash
curl "https://yjlfiotjrjkfwxzjrkcf.supabase.co/rest/v1/categories?select=name&limit=1" \
  -H "apikey: YOUR_KEY_HERE"
```

A JSON array back means the key is good. `{"message":"Invalid API key"}` means it is
wrong, truncated, or has stray whitespace — copy it again with the dashboard's copy
button rather than selecting by hand.

## Step 2 — Run the database migrations

Open **SQL Editor** in the Supabase dashboard. Run the files in `supabase/`
**in this exact order**, one at a time, waiting for each to finish:

| Order | File | What it builds |
|---|---|---|
| 1 | `01_schema_core.sql` | Members, sellers, listings, photos, authentication, admin roles, OTP |
| 2 | `02_schema_commerce.sql` | Orders, payments, payouts, returns, disputes, reports, content, notifications |
| 3 | `03_functions.sql` | Commission maths, order flow, permission checks, OTP, admin reports |
| 4 | `04_rls.sql` | Row Level Security on all 45 tables |
| 5 | `05_storage.sql` | Photo and document buckets, with per-user access rules |
| 6 | `06_seed.sql` | Admin roles, categories, brands, conditions, sizes, pages, FAQs |
| 7 | `07_remove_delivery.sql` | Removes shipping columns and rebuilds `place_order` |
| 8 | `08_phone_identity.sql` | (superseded by 09, still run it) phone-identity era |
| 9 | `09_email_identity.sql` | Makes email the identity; the mobile number stays as a contact field |

Paste the whole file each time and press **Run**. Green means it worked.

If one fails partway, fix the error and re-run **that file only** — the scripts use
`if not exists` throughout, so re-running is safe.

---

## Step 3 — Create the storage buckets

`05_storage.sql` writes the access policies, but the buckets themselves are made in
the dashboard. Go to **Storage → New bucket** and create these six:

| Bucket | Public? | File size limit |
|---|---|---|
| `listing-photos` | Public | 10 MB |
| `avatars` | Public | 2 MB |
| `banners` | Public | 5 MB |
| `kyc-documents` | **Private** | 10 MB |
| `auth-evidence` | **Private** | 10 MB |
| `dispute-files` | **Private** | 10 MB |

The private three hold national ID scans, selfies and dispute evidence. Getting
`kyc-documents` wrong would expose your members' identity documents, so double-check
that one shows **Private**.

---

## Step 4 — Turn on email code sign-in

Your email address is your account. There are two ways in:

| | How | When |
|---|---|---|
| **Password** | Email + password | Every day. Instant. |
| **Email code** | Email, six digits sent to the inbox | First sign-up, and when a password is forgotten |

Sign-up creates the account with a password, but Supabase leaves it
**unconfirmed** until the emailed code is verified — and an unconfirmed account
**cannot sign in with its password**. That is the mechanism that stops someone
using an account they never verified.

The mobile number is still asked for at sign-up — buyers use it to reach the
seller after a sale — but it is a contact field, not the identity, and no SMS
is ever sent. There is no SMS provider to configure and nothing to pay per
message.

### There is no reset link

Forgetting a password means: get a code → sign in with it → set a new one. The
site walks people through it and opens the password dialog automatically once
they land.

### Turn it on

**Authentication → Providers → Email**
1. Make sure **Email** is enabled (it is by default)
2. Enable **Confirm email** — without it the whole gate above does nothing

### Put the code in the emails

Supabase's default templates send a confirmation **link**. The site verifies
six-digit **codes**, so the templates must contain one.

**Authentication → Email Templates** — in both **Confirm signup** and
**Magic Link**, make sure the body includes:

```html
<p>Your SecondChance code is:</p>
<h2>{{ .Token }}</h2>
```

You can delete `{{ .ConfirmationURL }}` for codes only, or leave both —
`auth-callback.html` still handles old-style links gracefully.

### Two defaults worth checking

**OTP expiry** defaults to 3600 seconds for email. Fine as it is — codes live
an hour, and the resend button on the code page enforces its own cooldown.

**Built-in email is rate-limited.** Supabase sends only a handful of auth
emails per hour through its own sender — enough while building, not for
launch. Before real members arrive, set your own sender under **Project
Settings → Authentication → SMTP Settings**. Resend, Postmark and Amazon SES
all work.

### Test it

Sign up with your own address. The first codes often land in spam until your
sending domain warms up — check there before assuming delivery failed.

## Step 5 — Make yourself the first admin

Sign up on the site normally at `signup.html`. Then in the SQL Editor:

```sql
insert into admin_users (user_id, role_id)
select p.id, r.id
from profiles p, admin_roles r
where p.email = 'you@example.com'   -- ← the email you signed up with
  and r.key = 'super_admin';
```

Then open `admin.html`. You should see the dashboard.

From there you can add every other admin through **Admins & roles** without touching
SQL again.

---

## Step 6 — Make OTP codes actually send

This is the one piece that is **not finished**, and you need to decide how to handle it.

`issue_otp()` generates a six-digit code, hashes it, stores it, and returns it to the
caller. Right now nothing delivers it to the person. In development the code is
returned to the browser so you can test the flow end to end. **That is not safe for
production** — anyone could read their own code out of the network tab, or worse,
request one for another account.

You have two options:

**Member sign-in is already covered.** It uses Supabase's built-in email codes
(that is Step 4) and never touches `issue_otp()`. This step only matters for
**admin 2FA**.

**Option A — leave admin 2FA off for now (simplest).** Nothing to build.

**Option B — an Edge Function.**
Write a small Edge Function that calls `issue_otp()` with the service role key and
sends the result by email, returning only "sent" to the browser. Then point the
admin sign-in at the function instead of the RPC.

Until one of these is in place, admin sign-in still works — just leave **Require
code** switched off for admin accounts in **Admins & roles**, and switch it on once
delivery works.

---

## Step 7 — Check your security posture

Once the migrations are in, run the Supabase linter:

**Dashboard → Advisors → Security Advisor**

It flags anything with RLS missing or a policy that is too loose. It should come back
clean. Run it again any time you add a table.

---

## What is in the box

### Pages

| File | What it is |
|---|---|
| `signin.html` / `signup.html` | Sign in and register |
| `verify-otp.html` | Six-digit code entry |
| `forgot-password.html` / `reset-password.html` | Password recovery |
| `account.html` | Member area — listings, purchases, sales, payouts, saved, notifications, settings |
| `sell.html` | Your original page, now wired to real photo upload and the database |
| `browse.html` | Live catalogue with filters, driven by the listings table |
| `item.html` | Live listing page with checkout |
| `admin.html` | The admin panel |

Your original 88 pages still work and now share the session — the "Sign in" button in
the header becomes a real account menu once someone is logged in.

### Admin panel

Eighteen sections: Dashboard, Analytics, Listings, Verification, Taxonomy, Members,
Sellers, Orders, Returns & disputes, Payments, Payouts, Reports, Promotions, Content,
Notifications, Admins & roles, Audit trail, Settings.

Seven roles ship ready to use. Each one only sees the sections it has permission for:

| Role | What they can reach |
|---|---|
| **Super Admin** | Everything, including other admins |
| **Operations** | Listings, orders, members, sellers, returns |
| **Moderator** | Listings and reports |
| **Authenticator** | The verification queue only |
| **Finance** | Payments, payouts, analytics |
| **Support** | Orders, returns, reports, members (read-only) |
| **Content Editor** | Content, promotions, notifications |

You can edit any role's permissions, or create your own, in **Admins & roles**.

### How the money works

Commission is calculated **in the database**, never in the browser, so a modified page
cannot change what the platform takes. The defaults match your existing copy:

- 12% commission, taken from the seller
- Buyer Protection charged on top, paid by the buyer
- Authentication required at JOD 350 and above
- Payouts scheduled 3 days after the buyer accepts

All of these are editable in **Admin → Settings** and take effect immediately.

---

## Before you launch

- [ ] Turn **Confirm email** back on
- [ ] Set up real SMTP — the default sender will not cope
- [ ] Solve OTP delivery (Step 6) before switching on admin 2FA
- [ ] Run the Security Advisor and clear anything it flags
- [ ] Rotate the `anon` key if it was ever pasted somewhere public
- [ ] Wire a real payment provider — orders currently record a payment *intent* and
      an admin marks it paid. For live card payments you need a processor that works
      in Jordan; CliQ and cash on delivery work as they are.
- [ ] Replace the 42 demo item pages (`item-l001.html` … `item-l042.html`) once you
      have real listings, and point your catalogue links at `browse.html`

---

## If something breaks

**"Could not load listings"** — the anon key in `js/config.js` is wrong or missing.

**"permission denied for table …"** — `04_rls.sql` did not run, or ran before the
tables existed. Re-run files 1–4 in order.

**Admin panel says you have no access** — the `admin_users` row from Step 5 did not
get created. Check the username matched exactly.

**Photos upload but do not appear** — the bucket is set to Private when it should be
Public. Check `listing-photos` in Storage.
