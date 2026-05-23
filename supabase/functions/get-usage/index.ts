// POST /functions/v1/get-usage
// Body: {}
// Returns: { plan, item_count, features: { feature: { used, limit, period } } }
//
// One-shot endpoint clients call to render the Profile usage panel. Returns
// the user's effective plan, current month/lifetime usage for every AI
// feature, and current closet item count.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from '../_shared/cors.ts';
import {
  PLAN_LIMITS,
  ITEM_LIMITS,
  periodKey,
  type Feature,
  type Plan,
} from '../_shared/plans.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

const adminClient = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const FEATURES: Feature[] = [
  'analyze_item',
  'analyze_outfit',
  'analyze_closet',
  'analyze_palette',
  'suggest_outfits',
  'find_item_image',
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  try {
    const auth = req.headers.get('authorization') ?? '';
    const jwt = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7) : '';
    if (!jwt) {
      return new Response(JSON.stringify({ error: 'Sign in required.' }), {
        status: 401,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes?.user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired session.' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'content-type': 'application/json' },
        }
      );
    }
    const userId = userRes.user.id;

    const { data: planRow } = await adminClient.rpc('effective_plan', {
      p_user_id: userId,
    });
    const plan: Plan = (planRow as Plan | null) === 'pro' ? 'pro' : 'free';

    const { data: rows } = await adminClient
      .from('usage_counters')
      .select('feature, period_key, count')
      .eq('user_id', userId);

    const { count: itemCount } = await adminClient
      .from('closet_items')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    const features: Record<
      Feature,
      { used: number; limit: number; period: string }
    > = {} as Record<Feature, { used: number; limit: number; period: string }>;

    for (const f of FEATURES) {
      const cfg = PLAN_LIMITS[plan][f];
      const key = periodKey(cfg.period);
      const row = (rows ?? []).find(
        (r) => r.feature === f && r.period_key === key
      );
      features[f] = {
        used: row?.count ?? 0,
        limit: cfg.limit,
        period: cfg.period,
      };
    }

    return new Response(
      JSON.stringify({
        plan,
        item_count: itemCount ?? 0,
        item_limit: ITEM_LIMITS[plan],
        features,
      }),
      { headers: { ...corsHeaders, 'content-type': 'application/json' } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : 'get-usage failed',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      }
    );
  }
});
