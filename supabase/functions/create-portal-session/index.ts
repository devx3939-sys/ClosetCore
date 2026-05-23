// POST /functions/v1/create-portal-session
// Body: { return_url: string }
// Returns: { url: string } — Stripe Customer Portal redirect URL
//
// Opens Stripe's hosted Customer Portal where the user can:
//   - Cancel their subscription (including during the trial)
//   - Update payment method
//   - View past invoices and billing history
//   - Change billing email
//
// One-time Stripe setup needed before this works: visit
//   https://dashboard.stripe.com/test/settings/billing/portal
// and click "Save changes" to create a default portal configuration. See
// STRIPE.md → Customer Portal section.

import Stripe from 'https://esm.sh/stripe@17.4.0?target=denonext';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from '../_shared/cors.ts';

const STRIPE_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

const stripe = new Stripe(STRIPE_KEY, { apiVersion: '2024-09-30.acacia' });
const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  try {
    if (!STRIPE_KEY) {
      return json(503, {
        error: 'Stripe not configured. Set STRIPE_SECRET_KEY. See STRIPE.md.',
      });
    }

    // 1. Auth via JWT (same pattern as create-checkout-session).
    const auth = req.headers.get('authorization') ?? '';
    const jwt = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7) : '';
    if (!jwt) return json(401, { error: 'Sign in required.' });
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return json(401, { error: 'Invalid session.' });
    const userId = u.user.id;

    // 2. Body
    const { return_url } = (await req.json()) as { return_url: string };
    if (!return_url) return json(400, { error: 'return_url is required' });

    // 3. Look up Stripe customer ID. If the user never started checkout,
    // there's nothing to manage — surface a clear error.
    const { data: profile } = await admin
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', userId)
      .maybeSingle();
    if (!profile?.stripe_customer_id) {
      return json(404, {
        error:
          "You don't have a subscription yet. Start a Pro trial from your profile first.",
      });
    }

    // 4. Create the portal session.
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url,
    });

    return json(200, { url: session.url });
  } catch (e) {
    // Stripe will throw a clear error if the portal isn't configured.
    return json(500, {
      error: e instanceof Error ? e.message : 'create-portal-session failed',
    });
  }
});

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}
