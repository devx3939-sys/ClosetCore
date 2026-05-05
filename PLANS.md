# Plans, quotas, and Stripe integration

This document describes the Free / Pro / Lifetime plan system that's already wired up across the website, mobile, and desktop apps — and the two-step process to turn on real Stripe payments later.

---

## Today

The plan infrastructure is fully built. Every AI feature is metered server-side, the Profile screen shows usage with progress bars, and the Pricing page lists the real limits. Without Stripe configured, **every account is treated as Free** and the "Upgrade" buttons return a clear "not configured yet" error — but everything else works.

### Limits

| Feature | Free | Pro ($4.99/mo) | Lifetime ($99) |
|---|---|---|---|
| Closet items | 30 | unlimited | unlimited |
| AI auto-fill from photo | 10 / month | 200 / month | 200 / month |
| AI scan whole closet | 1 / month | 20 / month | 20 / month |
| AI outfit photo | 5 / month | 100 / month | 100 / month |
| AI outfit suggestions | 5 / month | 100 / month | 100 / month |
| AI palette analysis | 1 / lifetime | 10 / month | 10 / month |
| Find online photo | 5 / month | unlimited | unlimited |

To change a limit, edit **two** files at once (they have to stay in sync):
- `supabase/functions/_shared/plans.ts` (server)
- `app/shared/plans.ts` (clients)

Then redeploy the edge functions.

### How enforcement works

1. Every AI edge function (`analyze-item`, `analyze-outfit`, `analyze-closet`, `analyze-palette`, `suggest-outfits`, `find-item-image`) calls `enforceQuota(req, '<feature>')` before the AI call.
2. `enforceQuota` resolves the user from the JWT, looks up their effective plan via the `effective_plan` SQL function, and atomically increments the `usage_counters` row via the `check_and_increment_usage` Postgres function (row-locked, race-safe).
3. If over the limit, returns HTTP 429 with a structured `quota` payload. The client wrapper (`lib/ai.ts → invoke`) recognizes this and throws a `QuotaExceededError` so the UI can show a paywall.
4. Item-count limit is enforced by a Postgres trigger on `closet_items` insert — can't be bypassed by hitting the database directly.

### Granting yourself Pro access without Stripe

Until Stripe is wired, you can manually upgrade yourself (or any specific user) by running this in the Supabase SQL editor:

```sql
-- Grant Lifetime to a user by email
update profiles
   set plan = 'lifetime',
       lifetime_purchased_at = now()
 where id = (select id from auth.users where email = 'xavier.neil@yahoo.com');

-- Or grant Pro for a year
update profiles
   set plan = 'pro',
       plan_period_end = now() + interval '1 year'
 where id = (select id from auth.users where email = 'someone@example.com');

-- Or downgrade back to free
update profiles
   set plan = 'free',
       plan_period_end = null,
       lifetime_purchased_at = null
 where id = (select id from auth.users where email = 'someone@example.com');
```

The Profile screen, all the AI buttons, and the trigger all read from this column instantly. No client code change needed.

---

## Wiring Stripe (when you're ready)

Two stub edge functions are already in place: `create-checkout-session` and `stripe-webhook`. They return a clear "not configured" error today. To turn payments on:

### 1. Create Stripe products

In the Stripe dashboard:
- **Pro Monthly** — recurring, $4.99/month → copy the price ID (`price_xxx`)
- **Closet Lifetime** — one-time, $99 → copy the price ID

### 2. Set the secrets

```powershell
supabase secrets set STRIPE_SECRET_KEY=sk_live_...
supabase secrets set STRIPE_PRICE_PRO_MONTHLY=price_...
supabase secrets set STRIPE_PRICE_LIFETIME=price_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...   # set after step 4
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...     # for the webhook handler
```

### 3. Implement the two stubs

`supabase/functions/create-checkout-session/index.ts`:
- Verify the caller (same JWT pattern as `enforceQuota`).
- Look up `stripe_customer_id` on the user's profile; create a Stripe customer if missing.
- Call `stripe.checkout.sessions.create` with `mode: 'subscription'` for Pro or `mode: 'payment'` for Lifetime, the appropriate `line_items: [{ price: priceId, quantity: 1 }]`, `success_url`, `cancel_url`, and `metadata: { user_id, plan }`.
- Return `{ url: session.url }`.

`supabase/functions/stripe-webhook/index.ts`:
- Verify the signature header against `STRIPE_WEBHOOK_SECRET`.
- Switch on `event.type`:
  - **`checkout.session.completed`** with `mode === 'payment'` → set `plan='lifetime'`, `lifetime_purchased_at = now()`, save `stripe_customer_id`.
  - **`checkout.session.completed`** with `mode === 'subscription'` → set `plan='pro'`, `plan_period_end = subscription.current_period_end`, save customer + subscription IDs.
  - **`customer.subscription.updated`** → refresh `plan_period_end`.
  - **`customer.subscription.deleted`** → set `plan='free'`, `plan_period_end=null`, clear `stripe_subscription_id`.
- Always return 200 quickly.

Both handlers have detailed TODO comments inline.

### 4. Deploy + register webhook

```powershell
supabase functions deploy create-checkout-session
supabase functions deploy stripe-webhook
```

Then in the Stripe dashboard → Developers → Webhooks → **Add endpoint**:
- URL: `https://peizhwbhihzjzudemlmk.supabase.co/functions/v1/stripe-webhook`
- Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`

Copy the new signing secret and set `STRIPE_WEBHOOK_SECRET`.

### 5. The clients are already done

The website / mobile / desktop Profile screens all call `ai.startCheckout({ plan, return_url })` and redirect to `url`. Once the stubs return real Stripe URLs, the upgrade flow works end-to-end with no client changes.

---

## Schema reference

`supabase/schema-3-plans.sql` contains everything new:

- `profiles.plan` — `'free' | 'pro' | 'lifetime'`
- `profiles.plan_period_end` — when Pro subscription expires
- `profiles.lifetime_purchased_at` — set once, never expires
- `profiles.stripe_customer_id`, `profiles.stripe_subscription_id`
- `usage_counters` table — one row per (user, feature, period_key)
- `check_and_increment_usage(user, feature, period_key, limit)` — atomic, race-safe
- `effective_plan(user)` — handles lifetime / expired-pro logic
- `enforce_item_limit` trigger on `closet_items` — Free-plan 30-item cap

Run the migration in the Supabase SQL editor before deploying the new edge functions.
