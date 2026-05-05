// Quota enforcement helper used by every AI edge function.
//
// Flow:
//   1. AI function calls `enforceQuota(req, 'analyze_item')`
//   2. Helper extracts the user from the JWT, looks up effective plan, picks
//      the right limit, and atomically check-and-increments via the
//      `check_and_increment_usage` Postgres RPC.
//   3. If over limit: returns a 429 Response describing the limit. The AI
//      function returns it directly (no AI call made).
//   4. If allowed: returns null and the AI function proceeds normally.
//
// The increment happens BEFORE the AI call. If the AI call later fails for an
// unrelated reason (Groq down, etc.) we DON'T refund — that's intentional, it
// keeps quota deterministic and avoids race conditions. Worst case the user
// loses one quota unit on a failed call, which is fine for a personal app.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from './cors.ts';
import {
  PLAN_LIMITS,
  periodKey,
  type Feature,
  type Plan,
} from './plans.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — quota enforcement will fail open. Set the secret with: supabase secrets set SUPABASE_SERVICE_ROLE_KEY=... (read it from Supabase Dashboard → Project Settings → API → service_role).'
  );
}

const adminClient = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function userClient(jwt: string) {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
}

interface QuotaError {
  type: 'quota_exceeded' | 'auth_required' | 'config_error';
  feature?: Feature;
  plan?: Plan;
  limit?: number;
  used?: number;
  period?: string;
  message: string;
}

function jsonError(status: number, err: QuotaError): Response {
  return new Response(JSON.stringify({ error: err.message, quota: err }), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}

export async function enforceQuota(
  req: Request,
  feature: Feature
): Promise<{ ok: true; userId: string; plan: Plan } | { ok: false; response: Response }> {
  // 1. Resolve the caller from the Authorization header.
  const auth = req.headers.get('authorization') ?? '';
  const jwt = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7) : '';
  if (!jwt) {
    return {
      ok: false,
      response: jsonError(401, {
        type: 'auth_required',
        message: 'Sign in required.',
      }),
    };
  }
  const { data: userRes, error: userErr } = await userClient(jwt).auth.getUser();
  if (userErr || !userRes?.user) {
    return {
      ok: false,
      response: jsonError(401, {
        type: 'auth_required',
        message: 'Invalid or expired session.',
      }),
    };
  }
  const userId = userRes.user.id;

  // 2. Resolve effective plan via SQL helper (handles lifetime / expired pro).
  const { data: planRow, error: planErr } = await adminClient
    .rpc('effective_plan', { p_user_id: userId });
  if (planErr) {
    console.warn('effective_plan failed; defaulting to free.', planErr);
  }
  const plan: Plan =
    (planRow as Plan | null) === 'lifetime'
      ? 'lifetime'
      : (planRow as Plan | null) === 'pro'
        ? 'pro'
        : 'free';

  // 3. Look up the limit for this feature on this plan.
  const cfg = PLAN_LIMITS[plan][feature];
  const period = periodKey(cfg.period);

  // 4. Atomic check-and-increment via Postgres function.
  const { data, error } = await adminClient.rpc('check_and_increment_usage', {
    p_user_id: userId,
    p_feature: feature,
    p_period_key: period,
    p_limit: cfg.limit,
  });
  if (error) {
    console.error('check_and_increment_usage failed:', error);
    return {
      ok: false,
      response: jsonError(500, {
        type: 'config_error',
        message: `Could not check quota: ${error.message}`,
      }),
    };
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || !row.allowed) {
    const used = row?.used ?? cfg.limit;
    return {
      ok: false,
      response: jsonError(429, {
        type: 'quota_exceeded',
        feature,
        plan,
        limit: cfg.limit,
        used,
        period,
        message:
          plan === 'free'
            ? `You've used your ${cfg.period === 'all' ? 'free lifetime' : 'monthly'} ${feature.replace('_', ' ')} quota. Upgrade to Pro for more.`
            : `Pro plan limit reached for ${feature.replace('_', ' ')} this month. Resets on the 1st.`,
      }),
    };
  }

  return { ok: true, userId, plan };
}

// Read-only — used by the get-usage endpoint and (optionally) by clients that
// want to display "X / Y used this month" before the user even tries.
export const adminSupabase = adminClient;
