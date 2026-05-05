// POST /functions/v1/create-checkout-session
// Body: { plan: 'pro' | 'lifetime', return_url: string }
// Returns: { url: string } — Stripe Checkout redirect URL
//
// STATUS: STUB. Returns a clear "not configured" error until you set the
// Stripe keys and price IDs (see PLANS.md → Stripe integration). The shape of
// the response is final, so the clients can already wire their "Upgrade"
// buttons against this endpoint without any further changes when you go live.

import { corsHeaders } from '../_shared/cors.ts';

const STRIPE_KEY = Deno.env.get('STRIPE_SECRET_KEY');
const PRO_PRICE_ID = Deno.env.get('STRIPE_PRICE_PRO_MONTHLY');
const LIFETIME_PRICE_ID = Deno.env.get('STRIPE_PRICE_LIFETIME');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  try {
    if (!STRIPE_KEY || (!PRO_PRICE_ID && !LIFETIME_PRICE_ID)) {
      return new Response(
        JSON.stringify({
          error:
            'Payments are not enabled yet. The owner needs to set STRIPE_SECRET_KEY, STRIPE_PRICE_PRO_MONTHLY, and STRIPE_PRICE_LIFETIME secrets, then implement this function. See PLANS.md.',
        }),
        {
          status: 503,
          headers: { ...corsHeaders, 'content-type': 'application/json' },
        }
      );
    }

    // TODO when wiring Stripe:
    //
    // 1. Verify the caller via JWT (same pattern as enforceQuota).
    // 2. Read plan from request body.
    // 3. Look up or create stripe_customer_id on profiles.
    // 4. const session = await stripe.checkout.sessions.create({
    //      mode: plan === 'lifetime' ? 'payment' : 'subscription',
    //      line_items: [{ price: priceId, quantity: 1 }],
    //      customer: stripe_customer_id,
    //      success_url: `${return_url}?status=success`,
    //      cancel_url: `${return_url}?status=cancel`,
    //      metadata: { user_id, plan },
    //    });
    // 5. return { url: session.url };

    return new Response(
      JSON.stringify({
        error: 'create-checkout-session is implemented as a stub. Wire Stripe in this file.',
      }),
      {
        status: 501,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : 'create-checkout-session failed',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      }
    );
  }
});
