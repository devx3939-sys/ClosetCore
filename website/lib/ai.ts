'use client';

import { createClient } from './supabase-client';
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

export class QuotaExceededError extends Error {
  quota: QuotaError;
  constructor(quota: QuotaError) {
    super(quota.message);
    this.name = 'QuotaExceededError';
    this.quota = quota;
  }
}

// Single bucket for every photo (item, outfit, selfie). Created by schema.sql.
export const PHOTO_BUCKET = 'closet-images';

// Download a remote image (e.g. from a Brave Search result) and re-upload it
// to our own bucket so we control the URL longevity.
export async function uploadFromRemoteUrl(
  userId: string,
  remoteUrl: string,
  prefix: 'items' | 'outfits' | 'selfies' | 'closets' = 'items'
): Promise<{ path: string; url: string }> {
  const supabase = createClient();
  const res = await fetch(remoteUrl);
  if (!res.ok) throw new Error(`Fetch ${res.status} from source`);
  const blob = await res.blob();
  const ct = blob.type || 'image/jpeg';
  const ext =
    ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : 'jpg';
  const path = `${userId}/${prefix}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, blob, { contentType: ct, upsert: false });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
  return { path, url: data.publicUrl };
}

// Upload a File to storage and return its public URL.
export async function uploadFile(
  userId: string,
  file: File,
  prefix: 'items' | 'outfits' | 'selfies' | 'closets' = 'items'
): Promise<{ path: string; url: string }> {
  const supabase = createClient();
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${userId}/${prefix}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, file, {
      contentType: file.type || 'image/jpeg',
      upsert: false,
    });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
  return { path, url: data.publicUrl };
}

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

export function invalidateUsageCache() {
  usageCache = null;
}

async function invoke<T>(fn: string, body: object): Promise<T> {
  const supabase = createClient();
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) {
    let detail = error.message;
    let quota: QuotaError | null = null;
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === 'function') {
      try {
        const body = await ctx.clone().json();
        if (body?.error) detail = body.error;
        if (body?.quota) quota = body.quota as QuotaError;
      } catch {
        try {
          const txt = await ctx.clone().text();
          if (txt) detail = txt.slice(0, 500);
        } catch {
          /* keep detail as error.message */
        }
      }
    }
    if (quota?.type === 'quota_exceeded') throw new QuotaExceededError(quota);
    throw new Error(`${fn}: ${detail}`);
  }
  if ((data as { error?: string })?.error) {
    throw new Error(`${fn}: ${(data as { error: string }).error}`);
  }
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

// Backwards-compat: older call sites pass a bucket name first.
export async function uploadToBucket(
  _bucket: 'closet-images' | 'selfies',
  userId: string,
  file: File,
  prefix?: 'items' | 'outfits' | 'selfies' | 'closets'
): Promise<{ path: string; url: string }> {
  return uploadFile(userId, file, prefix ?? 'items');
}

function normalizeBBox(bbox: BoundingBox): BoundingBox | null {
  const num = (n: unknown) => (typeof n === 'number' && isFinite(n) ? n : NaN);
  let x = num(bbox.x);
  let y = num(bbox.y);
  let w = num(bbox.width);
  let h = num(bbox.height);
  if ([x, y, w, h].some(isNaN)) return null;
  if (w < 0.03 || h < 0.03) return null;
  const ratio = Math.max(w / h, h / w);
  if (ratio > 5) return null;
  const pad = 0.08;
  x -= pad;
  y -= pad;
  w += pad * 2;
  h += pad * 2;
  if (x < 0) {
    w += x;
    x = 0;
  }
  if (y < 0) {
    h += y;
    y = 0;
  }
  if (x + w > 1) w = 1 - x;
  if (y + h > 1) h = 1 - y;
  if (w <= 0 || h <= 0) return null;
  return { x, y, width: w, height: h };
}

// Crop a sub-rectangle out of a File (the original closet photo the user
// selected) using a normalized 0..1 bounding box, then upload the result as
// the item's preview thumbnail. Returns null if the box is unusable.
export async function cropAndUpload(
  userId: string,
  source: File,
  bbox: BoundingBox
): Promise<{ path: string; url: string } | null> {
  const norm = normalizeBBox(bbox);
  if (!norm) return null;

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(source);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('image decode failed'));
    i.src = dataUrl;
  });

  const x = Math.floor(norm.x * img.width);
  const y = Math.floor(norm.y * img.height);
  const cw = Math.min(Math.floor(norm.width * img.width), img.width - x);
  const ch = Math.min(Math.floor(norm.height * img.height), img.height - y);

  if (cw < 30 || ch < 30) return null;

  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  ctx.drawImage(img, x, y, cw, ch, 0, 0, cw, ch);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.85)
  );
  if (!blob) throw new Error('crop encode failed');
  const cropped = new File([blob], `crop_${Date.now()}.jpg`, {
    type: 'image/jpeg',
  });
  return uploadFile(userId, cropped, 'items');
}
