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