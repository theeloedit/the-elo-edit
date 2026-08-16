# The Elo Edit — website

A lightweight, mobile-first site: buyers swipe through listings Instagram-Stories-style and tap "Buy" to DM the seller directly. Sellers submit items through a form; you approve, reject, or mark sold from a private admin dashboard.

No payment processing — this is purely a catalog + connection layer, matching how the platform already works.

## Pages

- `index.html` — buyer story feed (public)
- `submit.html` — seller submission form (public)
- `admin.html` — your curation dashboard (login required)

## One-time setup

### 1. Create a Supabase project
Go to [supabase.com](https://supabase.com) → New project (free tier is plenty).

### 2. Run the schema
Supabase dashboard → **SQL Editor** → New query → paste the contents of `sql/schema.sql` → **Run**.

This creates the `listings` table, the security rules (buyers can only see items marked "live", sellers can only submit — not edit or approve), and the `listing-photos` storage bucket.

### 3. Create your admin login
Supabase dashboard → **Authentication → Users → Add user** → enter your email + a password. This is the only account that should exist — anyone who logs into `admin.html` with valid credentials has full curation access.

### 4. Connect the site to Supabase
Supabase dashboard → **Project Settings → API** → copy the **Project URL** and **anon public** key.

Open `js/supabaseClient.js` and paste them in:

```js
const SUPABASE_URL = "https://xxxxx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOi...";
```

### 5. Deploy to Vercel
Free tier, no credit card. Two options:

**Option A — drag and drop (easiest):** Go to [vercel.com/new](https://vercel.com/new), drag the whole `the-elo-edit` folder onto the page. Done — you'll get a live `*.vercel.app` URL.

**Option B — give me a deploy token:** Create one at [vercel.com/account/tokens](https://vercel.com/account/tokens) and share it with me here (paste it in chat) and I'll deploy it for you directly and hand you back the live link.

### 6. Later: connect a real domain
Once you own a domain, add it under the Vercel project → **Settings → Domains**. No code changes needed.

## Day to day

- Sellers go to `yoursite.com/submit.html` (link this from your Instagram bio/highlights)
- New submissions land in your **Pending** tab in `admin.html`
- Approve → goes live on `index.html` immediately for buyers
- Mark **Sold** once a seller confirms a sale — buyers won't be able to buy it anymore
- Nothing here touches money — buyers and sellers still complete the sale over Instagram DM, same as today

## Notes / next steps

- Branding is currently placeholder (cream/charcoal/terracotta) since the new logo direction is still in progress — swap colors in `css/style.css` once that's settled
- Consider adding your Instagram handle as a "message Mary" fallback link on `index.html` if you want a backup contact path
- If submission volume grows, you may want email notifications on new pending items (Supabase Edge Functions can do this) — flag if you want that added
