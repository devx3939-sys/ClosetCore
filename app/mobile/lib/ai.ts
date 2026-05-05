import { File } from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Image } from 'react-native';
import { supabase } from './supabase';
import type {
  BoundingBox,
  ItemAnalysis,
  OutfitAnalysis,
  PaletteAnalysis,
  ClosetAnalysis,
  OutfitSuggestionResult,
  ClosetItem,
  ColorPalette,
  FindItemImageResult,
  UsageReport,
  QuotaError,
} from '@shared/types';

// Thrown when an AI call is blocked by the user's plan quota. Catch this
// specifically (`if (e instanceof QuotaExceededError)`) to show a paywall.
export class QuotaExceededError extends Error {
  quota: QuotaError;
  constructor(quota: QuotaError) {
    super(quota.message);
    this.name = 'QuotaExceededError';
    this.quota = quota;
  }
}

export const PHOTO_BUCKET = 'closet-images';

// React Native's `fetch(uri).blob()` is broken — it produces 0-byte or
// corrupted blobs that upload "successfully" but contain garbage. Supabase
// then serves an unreadable file, and Groq returns 400 "invalid image data".
// expo-file-system's File.arrayBuffer() reads the actual bytes off disk.
// Download a remote image (e.g. from the Brave Search results) and re-upload
// it to our own storage so the item's image_url stays valid even if the
// source goes offline.
export async function uploadFromRemoteUrl(
  userId: string,
  remoteUrl: string,
  prefix: 'items' | 'outfits' | 'selfies' | 'closets' = 'items'
): Promise<{ path: string; url: string }> {
  const res = await fetch(remoteUrl);
  if (!res.ok) throw new Error(`Fetch ${res.status} from source`);
  const buf = await res.arrayBuffer();
  const ct = res.headers.get('content-type') || 'image/jpeg';
  const ext =
    ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : 'jpg';
  const path = `${userId}/${prefix}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, buf, { contentType: ct, upsert: false });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  const { data: pub } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
  return { path, url: pub.publicUrl };
}

// Max long-side pixel target per upload prefix. Closet scans benefit from a
// little more resolution so the bbox crops are still readable; everything
// else stays at 1280, which compresses to ~150-300kB JPEG — perfect for slow
// wifi without losing visible detail.
const MAX_DIMENSION: Record<string, number> = {
  items: 1280,
  outfits: 1280,
  selfies: 1280,
  closets: 1800,
};

async function resizeForUpload(
  uri: string,
  prefix: keyof typeof MAX_DIMENSION
): Promise<string> {
  const target = MAX_DIMENSION[prefix] ?? 1280;
  try {
    const result = await manipulateAsync(
      uri,
      [{ resize: { width: target } }],
      { compress: 0.82, format: SaveFormat.JPEG }
    );
    return result.uri;
  } catch {
    // If resize fails (corrupt image, OOM on huge file), fall back to raw URI.
    // The upload still works; it just sends more bytes.
    return uri;
  }
}

export async function uploadFromUri(
  userId: string,
  uri: string,
  prefix: 'items' | 'outfits' | 'selfies' | 'closets' = 'items'
): Promise<{ path: string; url: string }> {
  // Resize before reading bytes — saves both memory and bandwidth.
  const resizedUri = await resizeForUpload(uri, prefix);
  const path = `${userId}/${prefix}/${Date.now()}.jpg`;
  const data = await new File(resizedUri).arrayBuffer();

  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, data, { contentType: 'image/jpeg', upsert: false });
  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data: pub } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
  return { path, url: pub.publicUrl };
}

function getImageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      (e) => reject(e)
    );
  });
}

// Sanitize a normalized bbox: pad by 8% (so we don't clip the item), keep
// it inside the image, and reject ones that are obviously bogus. Returns
// null if the box is unusable.
function normalizeBBox(bbox: BoundingBox): BoundingBox | null {
  const num = (n: unknown) => (typeof n === 'number' && isFinite(n) ? n : NaN);
  let x = num(bbox.x);
  let y = num(bbox.y);
  let w = num(bbox.width);
  let h = num(bbox.height);
  if ([x, y, w, h].some(isNaN)) return null;
  if (w < 0.03 || h < 0.03) return null;

  // Reject extreme aspect ratios (>5:1 either way) — the LLM almost certainly
  // hallucinated a sliver rather than a real garment box. Web-fallback or
  // color swatch will produce a better thumbnail.
  const ratio = Math.max(w / h, h / w);
  if (ratio > 5) return null;

  const pad = 0.08;
  x -= pad;
  y -= pad;
  w += pad * 2;
  h += pad * 2;
  if (x < 0) { w += x; x = 0; }
  if (y < 0) { h += y; y = 0; }
  if (x + w > 1) w = 1 - x;
  if (y + h > 1) h = 1 - y;
  if (w <= 0 || h <= 0) return null;
  return { x, y, width: w, height: h };
}

// Crop a sub-rectangle out of a local image using a normalized 0..1 bounding
// box and upload the result. Used to make per-item thumbnails out of a single
// closet-scan photo. Returns null if the box can't yield a usable thumbnail.
export async function cropAndUpload(
  userId: string,
  sourceUri: string,
  bbox: BoundingBox
): Promise<{ path: string; url: string } | null> {
  const norm = normalizeBBox(bbox);
  if (!norm) return null;

  const { width, height } = await getImageSize(sourceUri);
  const x = Math.floor(norm.x * width);
  const y = Math.floor(norm.y * height);
  const w = Math.floor(Math.min(norm.width * width, width - x));
  const h = Math.floor(Math.min(norm.height * height, height - y));

  // If the resulting pixel crop is tiny (< 30px), the bbox was too inaccurate
  // to be useful. Return null so the caller can fall back to a web search.
  if (w < 30 || h < 30) return null;

  const result = await manipulateAsync(
    sourceUri,
    [{ crop: { originX: x, originY: y, width: w, height: h } }],
    { compress: 0.85, format: SaveFormat.JPEG }
  );
  return uploadFromUri(userId, result.uri, 'items');
}

// In-memory usage cache. The Profile screen polls getUsage on every focus
// event; without this, scrolling to Profile re-hits the edge function every
// time. 60s is plenty fresh — usage only changes when *you* call an AI feature
// from this device.
let usageCache: { at: number; data: UsageReport } | null = null;
const USAGE_TTL_MS = 60_000;

async function getUsageCached(): Promise<UsageReport> {
  if (usageCache && Date.now() - usageCache.at < USAGE_TTL_MS) {
    return usageCache.data;
  }
  const data = await invoke<UsageReport>('get-usage', {});
  usageCache = { at: Date.now(), data };
  return data;
}

// Call this after any AI action so the next getUsage() shows the new count
// without waiting for TTL. Already wired internally by `invoke` on success.
export function invalidateUsageCache() {
  usageCache = null;
}

async function invoke<T>(fn: string, body: object): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) {
    let detail = error.message;
    let quota: QuotaError | null = null;
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === 'function') {
      try {
        const b = await ctx.clone().json();
        if (b?.error) detail = b.error;
        if (b?.quota) quota = b.quota as QuotaError;
      } catch {
        try {
          const txt = await ctx.clone().text();
          if (txt) detail = txt.slice(0, 500);
        } catch {
          /* keep error.message */
        }
      }
    }
    if (quota?.type === 'quota_exceeded') throw new QuotaExceededError(quota);
    throw new Error(`${fn}: ${detail}`);
  }
  if ((data as { error?: string })?.error) {
    throw new Error(`${fn}: ${(data as { error: string }).error}`);
  }
  // Successful AI/feature calls bumped the server-side counter; bust the
  // local usage cache so the Profile panel reflects the new number on its
  // next open.
  if (fn !== 'get-usage') invalidateUsageCache();
  return data as T;
}

export interface SuggestOptions {
  occasion?: string;
  palette?: ColorPalette | null;
  recentOutfitItemIds?: string[][];
}

function paletteHint(p: ColorPalette | null | undefined) {
  if (!p) return null;
  return {
    season: p.season,
    undertone: p.undertone,
    primary_colors: p.primary_colors ?? [],
    neutral_colors: p.neutral_colors ?? [],
    avoid_colors: p.avoid_colors ?? [],
  };
}

function signatures(recent: string[][] | undefined): string[] {
  if (!recent) return [];
  return recent.map((ids) => [...ids].sort().join(','));
}

export const ai = {
  analyzeItem: (image_url: string) =>
    invoke<ItemAnalysis>('analyze-item', { image_url }),
  analyzeOutfit: (image_url: string) =>
    invoke<OutfitAnalysis>('analyze-outfit', { image_url }),
  analyzePalette: (image_url: string) =>
    invoke<PaletteAnalysis>('analyze-palette', { image_url }),
  analyzeCloset: (image_url: string) =>
    invoke<ClosetAnalysis>('analyze-closet', { image_url }),
  findItemImage: (input: {
    name?: string | null;
    brand?: string | null;
    color?: string | null;
    subcategory?: string | null;
    category?: string | null;
    query?: string;
    count?: number;
  }) =>
    invoke<FindItemImageResult>('find-item-image', {
      name: input.name ?? undefined,
      brand: input.brand ?? undefined,
      color: input.color ?? undefined,
      subcategory: input.subcategory ?? undefined,
      category: input.category ?? undefined,
      query: input.query,
      count: input.count,
    }),
  getUsage: () => getUsageCached(),
  startCheckout: (input: { plan: 'pro' | 'lifetime'; return_url: string }) =>
    invoke<{ url: string }>('create-checkout-session', input),
  suggestOutfits: (items: ClosetItem[], opts: SuggestOptions = {}) =>
    invoke<OutfitSuggestionResult>('suggest-outfits', {
      items: items.map((i) => ({
        id: i.id,
        name: i.name,
        category: i.category,
        subcategory: i.subcategory,
        color: i.color,
        color_family: i.color_family,
        season: i.season,
        occasion: i.occasion,
      })),
      occasion: opts.occasion ?? null,
      palette: paletteHint(opts.palette),
      recent_outfit_signatures: signatures(opts.recentOutfitItemIds),
    }),
};
