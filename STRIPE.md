# Stripe integration — button-by-button walkthrough

This guide takes you from "Stripe Sandbox account created" to "users can actually pay for Pro with a 14-day free trial." It assumes you've already created a Stripe account and you're sitting in the **ClosetCore Sandbox** (Stripe's newer name for what used to be Test Mode — same thing, free, fake cards).

Total time: ~30 minutes the first time.

> **Sandbox vs Live.** Sandbox = pretend money, fake cards, no business verification. Live = real money, real cards, requires identity + bank verification. We do everything in Sandbox first, then flip to Live in Part 7. **You can ignore the "Verify your business" prompt in the setup guide** until you're ready to go live — sandbox doesn't need it.

---

## What gets built

A standard Stripe subscription with a **14-day free trial, no card required to start**.

- User clicks "Try Pro free for 14 days" in the app
- Stripe Checkout opens (no card collection — they just confirm)
- They're immediately on Pro with `plan_period_end = trial end`
- 13 days in, Stripe sends a reminder email asking for a card
- If they add a card and don't cancel → auto-charges $4.99 at trial end and continues monthly
- If they cancel during trial or after → revert to Free at period end

The same code handles all of it via three webhook events.

---

## Part 1 — Stripe dashboard setup (in Sandbox)

You're already in the ClosetCore sandbox. The left sidebar shows **Home / Balances / Transactions / Customers / Product catalog** and a Shortcuts section with **Subscriptions**.

### Step 1. Create the Pro Monthly product

1. Left sidebar → **Product catalog**
2. Top-right: **+ Add product**
3. Fill in:
   - **Name:** `ClosetCore Pro`
   - **Description:** `Unlimited closet items and full AI features. 14-day free trial included.`
   - **Image (optional):** drop your logo
4. Under **Pricing**:
   - **Pricing model:** `Standard pricing`
   - **Price:** `4.99`
   - **Currency:** USD
   - **Billing period:** **Monthly**
   - Leave "Include tax in price" off for now
5. Click **Add product**
6. On the product detail page, find the **Pricing** section. Click the small `…` (three dots) next to the `$4.99 / month` row → **Copy price ID**. It looks like `price_1Q...`. **Save this** — it's your `STRIPE_PRICE_PRO_MONTHLY`.

> The 14-day trial is set in code, NOT in the Stripe dashboard. This is intentional — keeps the trial logic in one place and lets you change the length without touching Stripe.

### Step 2. Grab your sandbox API key

1. Left sidebar → click **Developers** (bottom-left, looks like `>_`)
2. **API keys** tab
3. Find the **Secret key** row → click **Reveal sandbox key** (or "Reveal test key" — same thing)
4. Copy the value — starts with `sk_test_...`
5. **Save this** — it's your `STRIPE_SECRET_KEY`

### Step 3. (skip until Part 5) Webhook signing secret

You'll come back here after the webhook function is deployed.

---

## Part 2 — Set Supabase secrets

Open PowerShell at the project root:

```powershell
cd "c:/Users/Xavier/Desktop/Closet App"

supabase secrets set STRIPE_SECRET_KEY=sk_test_...
supabase secrets set STRIPE_PRICE_PRO_MONTHLY=price_...
```

Verify:

```powershell
supabase secrets list
```

You should see both listed (values hidden).

> **Don't** try to `supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...` — Supabase auto-injects that one. The CLI rejects the `SUPABASE_` prefix.

---

## Part 3 — Replace `create-checkout-session` with the real implementation

Replace the entire contents of [supabase/functions/create-checkout-session/index.ts](supabase/functions/create-checkout-session/index.ts) with this:

```typescript
// supabase/functions/create-checkout-session/index.ts
import Stripe from 'https://esm.sh/stripe@17.4.0?target=denonext';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from '../_shared/cors.ts';

const STRIPE_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
const PRO_PRICE = Deno.env.get('STRIPE_PRICE_PRO_MONTHLY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

const stripe = new Stripe(STRIPE_KEY, { apiVersion: '2024-09-30.acacia' });
const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    if (!STRIPE_KEY || !PRO_PRICE) {
      return json(503, { error: 'Stripe not configured. See STRIPE.md.' });
    }

    // 1. Auth
    const auth = req.headers.get('authorization') ?? '';
    const jwt = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7) : '';
    if (!jwt) return json(401, { error: 'Sign in required.' });
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return json(401, { error: 'Invalid session.' });
    const userId = u.user.id;
    const userEmail = u.user.email ?? '';

    // 2. Body
    const { return_url } = (await req.json()) as { return_url: string };
    if (!return_url) return json(400, { error: 'return_url is required' });

    // 3. Resolve / create the Stripe customer
    const { data: profile } = await admin
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', userId)
      .maybeSingle();
    let customerId = profile?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: userEmail,
        metadata: { user_id: userId },
      });
      customerId = customer.id;
      await admin
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', userId);
    }

    // 4. Create the checkout session — 14-day trial, no card required
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: PRO_PRICE, quantity: 1 }],
      subscription_data: { trial_period_days: 14 },
      payment_method_collection: 'if_required',
      success_url: `${return_url}?status=success`,
      cancel_url: `${return_url}?status=cancel`,
      client_reference_id: userId,
      metadata: { user_id: userId },
    });

    return json(200, { url: session.url });
  } catch (e) {
    return json(500, {
      error: e instanceof Error ? e.message : 'create-checkout-session failed',
    });
  }
});

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}
```

Deploy:

```powershell
supabase functions deploy create-checkout-session
```

---

## Part 4 — Replace `stripe-webhook` with the real implementation

Replace the entire contents of [supabase/functions/stripe-webhook/index.ts](supabase/functions/stripe-webhook/index.ts) with this:

```typescript
// supabase/functions/stripe-webhook/index.ts
import Stripe from 'https://esm.sh/stripe@17.4.0?target=denonext';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from '../_shared/cors.ts';

const STRIPE_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
const WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const stripe = new Stripe(STRIPE_KEY, { apiVersion: '2024-09-30.acacia' });
const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const sig = req.headers.get('stripe-signature') ?? '';
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, WEBHOOK_SECRET);
  } catch (e) {
    return new Response(
      `Bad signature: ${e instanceof Error ? e.message : 'unknown'}`,
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.user_id;
        if (!userId || session.mode !== 'subscription') break;
        const sub = await stripe.subscriptions.retrieve(
          String(session.subscription)
        );
        // During trial, current_period_end IS the trial end date — perfect.
        await admin
          .from('profiles')
          .update({
            plan: 'pro',
            plan_period_end: new Date(sub.current_period_end * 1000).toISOString(),
            stripe_customer_id: String(session.customer ?? ''),
            stripe_subscription_id: sub.id,
          })
          .eq('id', userId);
        break;
      }
      case 'customer.subscription.updated': {
        // Fires on trial-end, renewal, payment method update, status change, etc.
        const sub = event.data.object as Stripe.Subscription;
        const isActive =
          sub.status === 'active' ||
          sub.status === 'trialing';
        await admin
          .from('profiles')
          .update({
            plan: isActive ? 'pro' : 'free',
            plan_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          })
          .eq('stripe_subscription_id', sub.id);
        break;
      }
      case 'customer.subscription.deleted': {
        // Fires on cancellation taking effect (after the period ends).
        const sub = event.data.object as Stripe.Subscription;
        await admin
          .from('profiles')
          .update({
            plan: 'free',
            plan_period_end: null,
            stripe_subscription_id: null,
          })
          .eq('stripe_subscription_id', sub.id);
        break;
      }
      default:
        // Ignore everything else; Stripe will retry on non-2xx so always 2xx.
        break;
    }
  } catch (e) {
    console.error('Webhook handler error:', e);
    // Return 200 anyway so Stripe doesn't infinite-retry on a logic bug.
  }

  return new Response('ok', { status: 200 });
});
```

Deploy:

```powershell
supabase functions deploy stripe-webhook
```

---

## Part 5 — Register the webhook in Stripe

### Step 4. Add the endpoint

1. Stripe Dashboard → left sidebar → **Developers**
2. **Webhooks** tab
3. Top-right: **+ Add endpoint**
4. **Endpoint URL:** paste this exactly:
   ```
   https://peizhwbhihzjzudemlmk.supabase.co/functions/v1/stripe-webhook
   ```
5. **Description (optional):** `ClosetCore — plan sync`
6. **Events to listen to:** click **+ Select events**
7. Search for and check ALL three:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
8. Click **Add events**
9. **Add endpoint**

### Step 5. Copy the signing secret

1. On the endpoint detail page that just opened, look for **Signing secret**
2. Click **Reveal**
3. Copy (starts with `whsec_...`)
4. Set it in Supabase:

```powershell
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
```

5. Redeploy the webhook handler so it picks up the secret:

```powershell
supabase functions deploy stripe-webhook
```

---

## Part 6 — Test the full flow in Sandbox

### Step 6. Sign in to the app as a fresh test user

1. Open your website (`npm run dev` in `website/` if running locally)
2. Go to `/signup` and create a new test account (e.g. `test@yourdomain.com`)
3. Go to **Profile** — confirm the Plan badge says "Free"

### Step 7. Click "Try Pro free for 14 days"

1. You should redirect to Stripe Checkout
2. Because the trial is `payment_method_collection: 'if_required'`, you'll see a confirmation screen **without** a card-entry field
3. Click **Start trial** (or whatever the button is labeled)
4. You'll be redirected back to your Profile page with `?status=success` in the URL

### Step 8. Verify the webhook fired

1. Stripe Dashboard → **Developers → Webhooks** → click your endpoint
2. Scroll to the bottom and look at **Webhook attempts**
3. You should see `checkout.session.completed` with a green checkmark and `200 OK` (within ~3 seconds of the checkout)
4. If you see a red ✕: click the row to see the response body. Common issues:
   - `Bad signature: ...` → wrong `STRIPE_WEBHOOK_SECRET` (re-copy from the endpoint detail page)
   - `500: ...` → check Supabase logs: `supabase functions logs stripe-webhook --tail`

### Step 9. Verify the upgrade landed in the database

In the Supabase SQL Editor:

```sql
select id, email, plan, plan_period_end, stripe_customer_id, stripe_subscription_id
  from profiles
 where email = 'test@yourdomain.com';
```

- `plan` should be `pro`
- `plan_period_end` should be ~14 days from now
- Both Stripe IDs populated

Reload the website Profile page — badge flips to "Pro", upgrade button disappears, usage panel shows Pro-tier limits.

### Step 10. Simulate the trial ending (optional, but smart)

In the Stripe Dashboard, the test cards work like this:
- `4242 4242 4242 4242` — always succeeds (use this to simulate trial → paid)
- `4000 0000 0000 9995` — declines (use this to test the failure path later)

To test trial-to-paid right now without waiting 14 days:

1. Stripe Dashboard → **Customers** → find your test customer → **Subscriptions** → click the subscription
2. Top-right `…` menu → **Update subscription**
3. Set **Trial end** to "End now"
4. Stripe will try to charge — since there's no card yet, the subscription status will become `past_due` or `unpaid`
5. Your `customer.subscription.updated` webhook fires, and your handler will downgrade `plan` to `'free'` because the status isn't `active` or `trialing`
6. Verify in the SQL editor

To test it the "happy path" way (trial converts cleanly to paid):

1. In the same subscription detail page, click **Update payment method**
2. Add card `4242 4242 4242 4242`
3. Then end the trial now
4. Stripe successfully charges, sends `invoice.paid` and `customer.subscription.updated`
5. Your handler keeps `plan='pro'` and updates `plan_period_end` to ~30 days out

### Step 11. Test cancellation

1. Stripe Dashboard → the same subscription detail page
2. **Cancel subscription** → **Cancel immediately** (vs. at-period-end)
3. `customer.subscription.deleted` should fire and return 200
4. SQL check: `plan = 'free'`, `stripe_subscription_id = null`
5. Profile page reloads to "Free" badge, Upgrade button reappears

---

## Part 7 — Go live

When you're confident everything works in Sandbox:

### Step 12. Verify your business

Stripe requires this before they let you accept real money.

1. Top-right of the dashboard, click **Switch to live account** (you saw this banner in Sandbox earlier)
2. Stripe will walk you through the **Verify your business** form:
   - Business type (individual is fine if you're a solo dev)
   - Legal name, address, DOB
   - Tax ID (SSN if individual in the US, EIN if you've registered an LLC)
   - Bank account for payouts
3. Submit. Approval is usually instant for individuals, can take a day or two if Stripe flags anything.

### Step 13. Recreate the product + price in live mode

Stripe keeps test and live data fully separate, so you have to do steps 1–2 again, this time in live mode:

1. Toggle to **Live mode** (top-right)
2. **Product catalog** → **+ Add product** → repeat Step 1 from this guide
3. **Developers → API keys** → copy the **live** secret key (`sk_live_...`)
4. **Developers → Webhooks** → repeat Step 4 from this guide (same URL, get a fresh live signing secret)

### Step 14. Update the Supabase secrets to live values

```powershell
supabase secrets set STRIPE_SECRET_KEY=sk_live_...
supabase secrets set STRIPE_PRICE_PRO_MONTHLY=price_...   # the LIVE price ID
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...      # the LIVE signing secret
```

No code change — the same edge functions work for both modes; the keys decide.

You're live.

---

## Common errors

**Checkout opens but says "No such price"**
You set `STRIPE_PRICE_PRO_MONTHLY` to a sandbox price ID but `STRIPE_SECRET_KEY` is a live key (or vice versa). Both must be from the same environment.

**"Bad signature" in webhook logs**
The webhook secret was rotated or you copied the sandbox secret while sending live events (or vice versa). Re-copy from the endpoint detail page.

**User pays but `plan` doesn't update**
1. Check the webhook log in Stripe → did the event fire? Did the response return 200?
2. Tail Supabase logs: `supabase functions logs stripe-webhook --tail`
3. Most common cause: `metadata.user_id` wasn't on the checkout session. The create-checkout-session code above sets it — verify it didn't get edited out.

**Trial ends but the user got charged immediately and is confused**
That's actually correct — if they added a card during the trial, Stripe charges at trial end. The "no card required" config means they can _start_ without a card; if they want to keep the subscription past 14 days, they have to add one.

**You want to give yourself Pro for free without going through Stripe**
Just run the SQL from [PLANS.md](PLANS.md):

```sql
update profiles
   set plan = 'pro',
       plan_period_end = now() + interval '100 years'
 where id = (select id from auth.users where email = 'xavier.neil@yahoo.com');
```

---

## Part 8 — Customer Portal (cancellation, payment updates, invoices)

The app has a dedicated **Subscription** page on every client (web sidebar, desktop sidebar, mobile from Profile) where users can self-manage their subscription. The "Manage in Stripe" button on that page opens the **Stripe Customer Portal** — Stripe's hosted page for cancellation, trial cancellation, payment method updates, and invoice history.

The portal needs a one-time configuration in Stripe before it works.

### Step 18. Enable the Customer Portal in Stripe

1. Stripe Dashboard → top-right gear icon → **Settings**
2. Left sidebar → **Billing → Customer portal**
3. The form shows what users can do in the portal. Recommended defaults:
   - ✅ **Customers can cancel subscriptions** → enabled
   - ✅ **Customers can update payment methods** → enabled
   - ✅ **Customers can update their billing information** → enabled
   - ✅ **Allow customers to view their invoice history** → enabled
   - For cancellation: pick **"Cancel at end of billing period"** (so they keep Pro access through the period they already paid for)
4. Scroll to bottom → **Save changes**

You only do this once. The same settings apply to both sandbox and live mode (set them in both if you've already flipped to live).

### Step 19. Deploy the new edge function

```powershell
cd "c:/Users/Xavier/Desktop/Closet App"
supabase functions deploy create-portal-session
```

(No new secrets to set — it reuses `STRIPE_SECRET_KEY`.)

### Step 20. Verify

1. Sign in as a user who's on Pro
2. Click the **Subscription** entry in the sidebar (web/desktop) or the "Manage subscription" row on Profile (mobile)
3. Click **Manage in Stripe** — you should be redirected to Stripe's portal with the user's email and active subscription pre-filled
4. Click **Cancel subscription** in the portal → you'll be returned to your app's Subscription page
5. Within a few seconds the `customer.subscription.updated` webhook fires, and `plan_period_end` is set to the end of the current period. The Subscription page now shows "Access until [date]" with a note that the subscription has been canceled but stays active until then.
6. When the period actually elapses, `customer.subscription.deleted` fires and the user becomes Free.

---

## What you can configure later without code changes

These all live in the Stripe dashboard and require zero code change:

- **Email receipts** — Settings → Emails → enable customer receipts
- **Trial-ending reminder email** — Settings → Subscriptions and emails → "Send a reminder X days before the trial ends" (default: 3 days)
- **Failed-payment retry schedule** — Settings → Subscriptions and emails → Smart Retries
- **Customer Portal branding** — Settings → Billing → Customer portal → Branding tab → upload logo, set colors
