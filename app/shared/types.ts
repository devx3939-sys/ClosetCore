// Shared TypeScript types for desktop, mobile, and website clients.
// All three clients import from this file via tsconfig path aliases.

export type ColorSeason = 'spring' | 'summer' | 'autumn' | 'winter';

export type Category =
  | 'tops'
  | 'bottoms'
  | 'dresses'
  | 'shoes'
  | 'accessories'
  | 'outerwear';

export type Occasion = 'casual' | 'work' | 'formal' | 'sporty' | 'date' | 'event';
export type Season = 'spring' | 'summer' | 'fall' | 'winter';
export type Condition = 'new' | 'like-new' | 'good' | 'fair';

export interface Profile {
  id: string;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
  color_season: ColorSeason | null;
  skin_tone: string | null;
  hair_color: string | null;
  eye_color: string | null;
  style_preferences: string[];
  created_at: string;
  updated_at: string;
  // Plan / billing fields (added by schema-3-plans.sql).
  plan?: 'free' | 'pro' | 'lifetime' | null;
  plan_period_end?: string | null;
  lifetime_purchased_at?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
}

export interface ClosetItem {
  id: string;
  user_id: string;
  name: string;
  category: Category;
  subcategory: string | null;
  color: string | null;
  color_family: string | null;
  brand: string | null;
  size: string | null;
  season: Season[];
  occasion: Occasion[];
  image_url: string | null;
  thumbnail_url: string | null;
  purchase_date: string | null;
  purchase_price: number | null;
  wear_count: number;
  condition: Condition | null;
  is_favorite: boolean;
  notes: string | null;
  created_at: string;
}

export interface Outfit {
  id: string;
  user_id: string;
  name: string;
  item_ids: string[];
  occasion: Occasion | null;
  season: Season | null;
  weather: Record<string, unknown> | null;
  is_favorite: boolean;
  times_worn: number;
  last_worn: string | null;
  created_at: string;
}

export interface PerSeasonPalette {
  primary: string[];
  secondary: string[];
  accent: string[];
  neutral: string[];
  avoid: string[];
}

export interface ColorPalette {
  user_id: string;
  season: ColorSeason | null;
  primary_colors: string[];
  secondary_colors: string[];
  accent_colors: string[];
  neutral_colors: string[];
  avoid_colors: string[];
  per_season_palettes: Record<ColorSeason, PerSeasonPalette> | null;
  undertone: string | null;
  rationale: string | null;
  updated_at: string;
}

// Normalized 0..1 bounding box returned by analyze-closet for cropping each
// detected item out of the wide closet photo.
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Returned by the analyze-item edge function.
export interface ItemAnalysis {
  name: string;
  category: Category;
  subcategory: string;
  color: string;
  color_family: string;
  brand: string | null;
  season: Season[];
  occasion: Occasion[];
  bounding_box?: BoundingBox | null;
}

// Returned by the analyze-outfit edge function.
export interface OutfitAnalysis {
  outfit_name: string;
  items: ItemAnalysis[];
}

// Returned by the analyze-closet edge function.
export interface ClosetAnalysis {
  items: ItemAnalysis[];
}

// Returned by the suggest-outfits edge function.
export type OutfitVibe =
  | 'minimal'
  | 'polished'
  | 'sporty'
  | 'edgy'
  | 'romantic'
  | 'classic'
  | 'monochrome'
  | 'casual-cool'
  | 'going-out'
  | 'layered'
  | 'bold-accent';

export interface OutfitSuggestion {
  name: string;
  item_ids: string[];
  occasion: Occasion | null;
  rationale: string;
  // Added by the new prompt; older saved suggestions may not have these.
  vibe?: OutfitVibe | null;
  score?: number | null;
}

export interface OutfitSuggestionResult {
  suggestions: OutfitSuggestion[];
}

// Subset of ColorPalette sent to suggest-outfits so the AI can favor the
// user's flattering colors and avoid bad ones.
export interface PaletteHint {
  season: ColorSeason | null;
  undertone: string | null;
  primary_colors: string[];
  neutral_colors: string[];
  avoid_colors: string[];
}

// Returned by the find-item-image edge function (Brave Image Search).
export interface FoundImage {
  url: string;        // Full-resolution source image
  thumbnail: string;  // Smaller preview, safe to render in a grid
  source: string;     // Domain or site that hosts it
  title: string;
}

export interface FindItemImageResult {
  query: string;
  results: FoundImage[];
}

// Returned by the get-usage edge function.
export interface UsageReport {
  plan: 'free' | 'pro' | 'lifetime';
  item_count: number;
  item_limit: number;
  features: Record<
    string,
    {
      used: number;
      limit: number;
      period: 'month' | 'all';
    }
  >;
}

// Structured error returned by the AI edge functions when the user is over
// their plan quota. Surfaces enough detail for the client to render a paywall
// and a clear "X / Y used" hint.
export interface QuotaError {
  type: 'quota_exceeded' | 'auth_required' | 'config_error';
  feature?: string;
  plan?: 'free' | 'pro' | 'lifetime';
  limit?: number;
  used?: number;
  period?: string;
  message: string;
}

// Returned by the analyze-palette edge function.
export interface PaletteAnalysis {
  best_season: ColorSeason;
  undertone: 'warm' | 'cool' | 'neutral';
  skin_tone_hex: string;
  hair_color_hex: string;
  eye_color_hex: string;
  rationale: string;
  primary_colors: string[];
  secondary_colors: string[];
  accent_colors: string[];
  neutral_colors: string[];
  avoid_colors: string[];
  per_season_palettes: Record<ColorSeason, PerSeasonPalette>;
}

export const CATEGORIES: Category[] = [
  'tops',
  'bottoms',
  'dresses',
  'shoes',
  'accessories',
  'outerwear',
];

export const SEASONS: Season[] = ['spring', 'summer', 'fall', 'winter'];

export const OCCASIONS: Occasion[] = [
  'casual',
  'work',
  'formal',
  'sporty',
  'date',
  'event',
];
