// POST /functions/v1/stripe-webhook
// Stripe webhook receiver. Updates profiles.plan based on subscription /
// checkout events.
//
// STATUS: STUB. Set STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET to wire it up.
// The expected event handling is documented in PLANS.md.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from '../_shared/cors.ts';

const STRIPE_KEY = Deno.env.get('STRIPE_SECRET_KEY');
const WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const adminClient = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (!STRIPE_KEY || !WEBHOOK_SECRET) {
    return new Response(
      JSON.stringify({
        error:
          'Webhook not configured. Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET.',
      }),
      { status: 503, headers: { ...corsHeaders, 'content-type': 'application/json' } }
    );
  }

  // TODO when wiring Stripe:
  //
  // 1. Verify the signature header against WEBHOOK_SECRET. If invalid → 400.
  // 2. Switch on event.type:
  //    - 'checkout.session.completed' (mode=payment, lifetime tier):
  //         update profiles set plan='lifetime', lifetime_purchased_at=now(),
  //                              stripe_customer_id=customer
  //         where id = metadata.user_id
  //    - 'checkout.session.completed' (mode=subscription, pro tier):
  //         set plan='pro', plan_period_end=current_period_end,
  //             stripe_customer_id=customer, stripe_subscription_id=subscription
  //    - 'customer.subscription.updated':  refresh plan_period_end
  //    - 'customer.subscription.deleted':  set plan='free', plan_period_end=null
  // 3. Always return 200 quickly; long work goes to a background job.

  return new Response('not implemented', {
    status: 501,
    headers: { ...corsHeaders, 'content-type': 'text/plain' },
  });
});

// Reference adminClient so the import isn't pruned during the stub phase.
void adminClient;
