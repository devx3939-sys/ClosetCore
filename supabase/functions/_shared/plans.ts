// Plan limits — single source of truth for the server side.
// IMPORTANT: keep `app/shared/plans.ts` in sync with this file.

export type Plan = 'free' | 'pro';

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
  limit: number; // 0 means blocked, Number.MAX_SAFE_INTEGER means unlimited
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
};

export const ITEM_LIMITS: Record<Plan, number> = {
  free: 30,
  pro: UNLIMITED,
};

export function periodKey(period: PeriodType, now: Date = new Date()): string {
  if (period === 'all') return 'all';
  return now.toISOString().slice(0, 7); // 'YYYY-MM'
}

export function isUnlimited(n: number): boolean {
  return n >= UNLIMITED;
}
