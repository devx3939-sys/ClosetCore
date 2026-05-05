# Stripe integration — button-by-button walkthrough

This guide takes you from "no Stripe account" to "users can actually pay for Pro and Lifetime." The plan infrastructure (database columns, quota enforcement, client UI, edge function stubs) is already in place — you just have to swap the stubs for real Stripe calls and tell Stripe where to send webhooks.

Total time: ~45 minutes the first time. If you've shipped Stripe before, ~15.

> Test in Stripe **test mode** first. The dashboard has a toggle in the top-right. Test mode uses fake cards (`4242 4242 4242 4242`) and costs $0. You can run through this entire guide in test mode without spending anything, then flip to live mode when you're ready to take real money.

---

## Part 1 — Stripe dashboard setup

### Step 1. Create a Stripe account

1. Go to **https://stripe.com**
2. Click **Start now** (top right)
3. Enter email + full name + password → **Create account**
4. Verify the email Stripe sends
5. You'll land in the Stripe Dashboard. Top-right corner: confirm the **Test mode** toggle is ON (it'll glow). We'll stay in test mode for the entire guide until step 14.

### Step 2. Create the Pro Monthly product

1. Left sidebar → **Catalog → Product catalog**
2. Top-right: **+ Create product**
3. Fill in:
   - **Name:** `ClosetCore Pro`
   - **Description (optional):** `Pro plan with unlimited closet items and full AI features.`
   - **Image (optional):** drop your logo
4. Under **Pricing**:
   - **Pricing model:** Standard
   - **Price:** `4.99`
   - **Currency:** USD
   - **Billing period:** Monthly
5. Click **Add product** (bottom right)
6. On the next screen, find the **Pricing** section and click the small `…` next to the price → **Copy price ID**. It looks like `price_1Q...`. **Save this.** This is your `STRIPE_PRICE_PRO_MONTHLY`.

### Step 3. Create the Lifetime product

1. **+ Create product** again
2. Fill in:
   - **Name:** `ClosetCore Lifetime`
   - **Description:** `One-time payment, lifetime access to all Pro features.`
3. Under **Pricing**:
   - **Pricing model:** Standard
   - **Price:** `99.00`
   - **Currency:** USD
   - **Billing period:** **One time** (important — change from "Monthly")
4. **Add product**
5. Copy this price ID too. It's your `STRIPE_PRICE_LIFETIME`.

### Step 4. Grab your secret API key

1. Left sidebar → **Developers → API keys**
2. Under **Standard keys**, find **Secret key**. Click **Reveal test key**.
3. Copy the value — it starts with `sk_test_...`.
4. **Save this.** This is your `STRIPE_SECRET_KEY`.

### Step 5. (Skip until step 11) Webhook signing secret

You'll register the webhook endpoint after the function is deployed. We'll come back here.

---

## Part 2 — Set Supabase secrets

Open PowerShell at the project root:

```powershell
cd "c:/Users/Xavier/Desktop/Closet App"

supabase secrets set STRIPE_SECRET_KEY=sk_test_...
supabase secrets set STRIPE_PRICE_PRO_MONTHLY=price_...
supabase secrets set STRIPE_PRICE_LIFETIME=price_...
```

Verify:

```powershell
supabase secrets list
```

You should see all three listed (values hidden).

> Note: **don't** try to `supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...` — Supabase auto-injects that one into every edge function. The CLI rejects the `SUPABASE_` prefix.

---

## Part 3 — Implement `create-checkout-session`

The stub at [supabase/functions/create-checkout-session/index.ts](supabase/functions/create-checkout-session/index.ts) has TODO comments showing exactly what to add. Replace the file with the implementation below.

```typescript
// supabase/functions/create-checkout-session/index.ts
import Stripe from 'https://esm.sh/stripe@17.4.0?target=denonext';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from '../_shared/cors.ts';

const STRIPE_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
const PRO_PRICE = Deno.env.get('STRIPE_PRICE_PRO_MONTHLY') ?? '';
const LIFETIME_PRICE = Deno.env.get('STRIPE_PRICE_LIFETIME') ?? '';
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
    if (!STRIPE_KEY || !PRO_PRICE || !LIFETIME_PRICE) {
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
    const { plan, return_url } = (await req.json()) as {
      plan: 'pro' | 'lifetime';
      return_url: string;
    };
    if (plan !== 'pro' && plan !== 'lifetime') {
      return json(400, { error: 'plan must be pro or lifetime' });
    }

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

    // 4. Create the checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: plan === 'lifetime' ? 'payment' : 'subscription',
      line_items: [
        { price: plan === 'lifetime' ? LIFETIME_PRICE : PRO_PRICE, quantity: 1 },
      ],
      success_url: `${return_url}?status=success`,
      cancel_url: `${return_url}?status=cancel`,
      client_reference_id: userId,
      metadata: { user_id: userId, plan },
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

## Part 4 — Implement `stripe-webhook`

Replace [supabase/functions/stripe-webhook/index.ts](supabase/functions/stripe-webhook/index.ts) with:

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
        const plan = session.metadata?.plan;
        if (!userId) break;

        if (plan === 'lifetime' && session.mode === 'payment') {
          await admin
            .from('profiles')
            .update({
              plan: 'lifetime',
              lifetime_purchased_at: new Date().toISOString(),
              stripe_customer_id: String(session.customer ?? ''),
            })
            .eq('id', userId);
        } else if (plan === 'pro' && session.mode === 'subscription') {
          const sub = await stripe.subscriptions.retrieve(
            String(session.subscription)
          );
          await admin
            .from('profiles')
            .update({
              plan: 'pro',
              plan_period_end: new Date(sub.current_period_end * 1000).toISOString(),
              stripe_customer_id: String(session.customer ?? ''),
              stripe_subscription_id: sub.id,
            })
            .eq('id', userId);
        }
        break;
      }
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        await admin
          .from('profiles')
          .update({
            plan: sub.status === 'active' || sub.status === 'trialing' ? 'pro' : 'free',
            plan_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          })
          .eq('stripe_subscription_id', sub.id);
        break;
      }
      case 'customer.subscription.deleted': {
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

### Step 11. Find your function URL

Your webhook endpoint is:

```
https://peizhwbhihzjzudemlmk.supabase.co/functions/v1/stripe-webhook
```

(Replace `peizhwbhihzjzudemlmk` if your Supabase project ref is different — check `supabase/config.toml` or the Supabase dashboard URL.)

### Step 12. Add the endpoint in Stripe

1. Stripe Dashboard → **Developers → Webhooks**
2. Top-right: **+ Add endpoint**
3. **Endpoint URL:** paste the URL from above
4. **Description (optional):** `ClosetCore — plan sync`
5. Click **+ Select events**
6. Search for and check ALL of:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
7. Click **Add events** → **Add endpoint**

### Step 13. Copy the signing secret

1. On the endpoint detail page, click **Reveal** next to **Signing secret**
2. Copy the value (starts with `whsec_...`)
3. Set it in Supabase:

```powershell
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
```

4. Redeploy the webhook handler so it picks up the secret:

```powershell
supabase functions deploy stripe-webhook
```

---

## Part 6 — Test in Stripe test mode

### Step 14. Trigger a test purchase

1. Open your website (`npm run dev` in `website/`)
2. Sign in as a user that's currently on the Free plan
3. Go to **Profile**
4. Click **Upgrade to Pro**
5. You should redirect to Stripe Checkout. Use the test card:
   - Card: `4242 4242 4242 4242`
   - Expiry: any future date (`12/30`)
   - CVC: any 3 digits (`123`)
   - ZIP: any 5 digits (`10001`)
6. Click **Subscribe**

### Step 15. Verify the webhook fired

1. Stripe Dashboard → **Developers → Webhooks** → click your endpoint
2. Scroll to **Webhook attempts**. You should see `checkout.session.completed` with a green checkmark and `200 OK`.
3. If it failed: click the row to see the response body. Common issues:
   - `Bad signature` → wrong `STRIPE_WEBHOOK_SECRET`
   - `Could not check quota` → `SUPABASE_SERVICE_ROLE_KEY` not auto-injected (very rare)

### Step 16. Verify the upgrade landed in the database

In Supabase SQL Editor:

```sql
select id, email, plan, plan_period_end, stripe_customer_id
  from profiles
 where email = 'your-test-email@example.com';
```

`plan` should now be `pro`, `plan_period_end` ~30 days out, `stripe_customer_id` populated.

Reload the website's Profile page — the badge should flip from "Free" to "Pro" and the upgrade buttons should disappear.

### Step 17. Test cancellation

1. Stripe Dashboard → **Customers** → find your test customer → **Subscriptions** tab → click the subscription → **Cancel subscription** → **Cancel immediately**
2. Watch the webhook log — `customer.subscription.deleted` should fire and return 200
3. Verify in SQL: `plan` is back to `free`, `stripe_subscription_id` is null
4. Reload Profile → "Free" badge, upgrade buttons reappear

### Step 18. Test the lifetime path

Same as Step 14 but click **Buy Lifetime**. After successful payment:

- `plan` = `lifetime`
- `lifetime_purchased_at` = now
- The Profile UI shows the "Lifetime" badge
- Cancellation logic doesn't apply (one-time payment)

---

## Part 7 — Go live

When you're confident in test mode:

### Step 19. Switch Stripe to live mode

1. Top-right of Stripe Dashboard: toggle **Test mode** OFF
2. **You will need to recreate everything in live mode** — Stripe keeps test and live data fully separate. Repeat:
   - Step 2 (Pro product, copy live price ID)
   - Step 3 (Lifetime product, copy live price ID)
   - Step 4 (live API key — `sk_live_...`)
   - Step 12 (live webhook endpoint, same URL)
   - Step 13 (live signing secret)

### Step 20. Update the Supabase secrets

```powershell
supabase secrets set STRIPE_SECRET_KEY=sk_live_...
supabase secrets set STRIPE_PRICE_PRO_MONTHLY=price_...
supabase secrets set STRIPE_PRICE_LIFETIME=price_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
```

(No code change — the same edge functions work for test and live; the keys decide which environment.)

### Step 21. Verify with one real $0.50 test

Stripe charges a real card. Test with a small low-value subscription if you can — or just trust the test-mode flow and ship.

You're live.

---

## Common errors

**Checkout opens but says "No such price"**
You set `STRIPE_PRICE_PRO_MONTHLY` to a test-mode price ID but `STRIPE_SECRET_KEY` is a live key (or vice versa). Both must be from the same mode.

**Webhook signature verification failing**
The webhook secret was rotated or you copied the test-mode secret while sending live events. Re-copy from the dashboard endpoint detail page.

**User pays but `plan` doesn't update**
1. Check the webhook log in Stripe → did it fire? Did it return 200?
2. Check `supabase functions logs stripe-webhook --tail` while you replay the event.
3. The most common cause is the user's profile row didn't have `stripe_customer_id` set when Stripe sent the event — verify the `metadata.user_id` was populated on the checkout session.

**"Could not connect to Stripe"**
The Deno fetch from inside the edge function timed out reaching `api.stripe.com`. Usually transient — retry. If persistent, check Stripe's status page.

**You want to give yourself Pro for free for testing**
Don't bother going through Stripe — just run the SQL from [PLANS.md](PLANS.md):

```sql
update profiles
   set plan = 'lifetime',
       lifetime_purchased_at = now()
 where id = (select id from auth.users where email = 'xavier.neil@yahoo.com');
```

---

## What still works without Stripe

If you decide not to ship paid plans, everything keeps working — every account is treated as Free, the upgrade buttons return a clear error, and you can manually grant Pro/Lifetime via SQL whenever you want. There's no rush.
