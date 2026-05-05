// Plan limits — client-side mirror of `supabase/functions/_shared/plans.ts`.
// IMPORTANT: keep both files in sync.

export type Plan = 'free' | 'pro' | 'lifetime';

export type PeriodType = 'month' | 'all';

export type Feature =
  | 'analyze_item'
  | 'analyze_outfit'
  | 'analyze_closet'
  | 'analyze_palette'
  | 'suggest_outfits'
  | 'find_item_image';

export interface FeatureLimit {
  period: PeriodType;
  limit: number;
}

const UNLIMITED = Number.MAX_SAFE_INTEGER;

export const PLAN_LIMITS: Record<Plan, Record<Feature, FeatureLimit>> = {
  free: {
    analyze_item:     { period: 'month', limit: 10 },
    analyze_outfit:   { period: 'month', limit: 5 },
    analyze_closet:   { period: 'month', limit: 1 },
    analyze_palette:  { period: 'all',   limit: 1 },
    suggest_outfits:  { period: 'month', limit: 5 },
    find_item_image:  { period: 'month', limit: 5 },
  },
  pro: {
    analyze_item:     { period: 'month', limit: 200 },
    analyze_outfit:   { period: 'month', limit: 100 },
    analyze_closet:   { period: 'month', limit: 20 },
    analyze_palette:  { period: 'month', limit: 10 },
    suggest_outfits:  { period: 'month', limit: 100 },
    find_item_image:  { period: 'month', limit: UNLIMITED },
  },
  lifetime: {
    analyze_item:     { period: 'month', limit: 200 },
    analyze_outfit:   { period: 'month', limit: 100 },
    analyze_closet:   { period: 'month', limit: 20 },
    analyze_palette:  { period: 'month', limit: 10 },
    suggest_outfits:  { period: 'month', limit: 100 },
    find_item_image:  { period: 'month', limit: UNLIMITED },
  },
};

export const ITEM_LIMITS: Record<Plan, number> = {
  free: 30,
  pro: UNLIMITED,
  lifetime: UNLIMITED,
};

export const FEATURE_LABELS: Record<Feature, string> = {
  analyze_item: 'Auto-fill from photo',
  analyze_outfit: 'Outfit photo',
  analyze_closet: 'Scan whole closet',
  analyze_palette: 'Palette analysis',
  suggest_outfits: 'AI outfit suggestions',
  find_item_image: 'Find online photo',
};

export function periodKey(period: PeriodType, now: Date = new Date()): string {
  if (period === 'all') return 'all';
  return now.toISOString().slice(0, 7);
}

export function isUnlimited(n: number): boolean {
  return n >= UNLIMITED;
}

export function formatLimit(n: number): string {
  return isUnlimited(n) ? 'Unlimited' : n.toLocaleString();
}

// Returns 0..1 used fraction for progress bars. Unlimited tiers report 0.
export function usageFraction(used: number, limit: number): number {
  if (isUnlimited(limit)) return 0;
  if (limit <= 0) return 1;
  return Math.min(1, used / limit);
}

// Reflects effective plan given the same logic the SQL `effective_plan`
// function applies. Use this when you only have the raw profile row.
export function effectivePlan(profile: {
  plan?: string | null;
  plan_period_end?: string | null;
  lifetime_purchased_at?: string | null;
}): Plan {
  if (profile.lifetime_purchased_at) return 'lifetime';
  if (
    profile.plan === 'pro' &&
    (!profile.plan_period_end || new Date(profile.plan_period_end) > new Date())
  ) {
    return 'pro';
  }
  return 'free';
}

export const PLAN_LABELS: Record<Plan, string> = {
  free: 'Free',
  pro: 'Pro',
  lifetime: 'Lifetime',
};
