// POST /functions/v1/find-item-image
// Body: { name?, brand?, color?, subcategory?, query?, count?, category? }
// Returns: { query: string, results: { url, thumbnail, source, title }[] }
//
// Uses DuckDuckGo's image search (no API key, no per-month quota). DDG's
// image endpoint requires a one-shot "vqd" token from the HTML page, then
// returns JSON. This is the same flow popular libraries (duckduckgo-search,
// etc.) use — undocumented but stable for years.

import { corsHeaders } from '../_shared/cors.ts';
import { enforceQuota } from '../_shared/quota.ts';

interface Body {
  name?: string;
  brand?: string;
  color?: string;
  subcategory?: string;
  category?: string;
  query?: string;
  count?: number;
}

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Domains where product photos almost always come from a real catalog page,
// shot on a clean white/grey background. Results from these are bumped to
// the top of the list.
const PREFERRED_DOMAINS = new Set([
  'nike.com',
  'adidas.com',
  'zara.com',
  'hm.com',
  'uniqlo.com',
  'gap.com',
  'asos.com',
  'lululemon.com',
  'nordstrom.com',
  'macys.com',
  'bloomingdales.com',
  'farfetch.com',
  'ssense.com',
  'mrporter.com',
  'net-a-porter.com',
  'aritzia.com',
  'cos.com',
  'everlane.com',
  'jcrew.com',
  'madewell.com',
  'levi.com',
  'patagonia.com',
  'thenorthface.com',
  'newbalance.com',
  'puma.com',
  'reebok.com',
  'converse.com',
  'vans.com',
  'crocs.com',
  'amazon.com',
  'shopbop.com',
  'revolve.com',
  'urbanoutfitters.com',
  'anthropologie.com',
  'freepeople.com',
]);

// Domains we down-rank because they're noisy: pinterest is mostly user
// collages, ebay/etsy/poshmark show used items in awkward angles.
const DOWNRANK_DOMAINS = new Set([
  'pinterest.com',
  'pinimg.com',
  'instagram.com',
  'cdninstagram.com',
  'facebook.com',
  'twitter.com',
  'x.com',
  'tiktok.com',
  'reddit.com',
  'redd.it',
]);

function domainOf(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    // Match base domain (e.g. shop.nike.com → nike.com).
    const parts = host.split('.');
    return parts.slice(-2).join('.');
  } catch {
    return '';
  }
}

function buildQuery(b: Body): string {
  if (b.query && b.query.trim()) return b.query.trim();

  // Order matters: brand carries the most signal; subcategory is the noun
  // (e.g. "sneakers"); color disambiguates; the user's free-text name is
  // the fallback. Category is added if subcategory is missing so we still
  // get a noun in the query.
  const parts: string[] = [];
  if (b.brand) parts.push(b.brand.trim());
  if (b.subcategory) parts.push(b.subcategory.trim());
  else if (b.category) parts.push(b.category.trim());
  if (b.color) parts.push(b.color.trim());
  if (b.name && (!b.subcategory || !parts.join(' ').toLowerCase().includes(b.name.toLowerCase()))) {
    parts.push(b.name.trim());
  }
  if (!parts.length) return '';

  // Strong intent terms — ranks catalog/product photos above editorial,
  // user-generated, and lifestyle shots.
  return `${parts.join(' ')} product photo on white background`.slice(0, 200);
}

async function fetchVqd(query: string): Promise<string> {
  const res = await fetch(
    `https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`,
    {
      headers: {
        'user-agent': UA,
        accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'en-US,en;q=0.9',
      },
    }
  );
  if (!res.ok) throw new Error(`DDG init ${res.status}`);
  const html = await res.text();
  const m = html.match(/vqd=["']?([\d-]+)["']?/);
  if (!m) throw new Error('Could not extract vqd token from DDG (search blocked?)');
  return m[1];
}

interface DdgImage {
  image: string;
  thumbnail: string;
  title: string;
  source?: string;
  url?: string;
  width?: number;
  height?: number;
}

async function searchImages(query: string): Promise<DdgImage[]> {
  const vqd = await fetchVqd(query);
  const params = new URLSearchParams({
    l: 'us-en',
    o: 'json',
    q: query,
    vqd,
    // f filter shape: ,,,,,size:Medium  → bias toward decent-sized images.
    f: ',,,,size:Medium,layout:Square',
    p: '1',
    s: '0',
  });
  const res = await fetch(`https://duckduckgo.com/i.js?${params}`, {
    headers: {
      'user-agent': UA,
      accept: 'application/json, text/javascript, */*; q=0.01',
      referer: 'https://duckduckgo.com/',
      'x-requested-with': 'XMLHttpRequest',
    },
  });
  if (!res.ok) throw new Error(`DDG images ${res.status}`);
  const data = await res.json();
  return Array.isArray(data?.results) ? data.results : [];
}

interface ScoredImage extends DdgImage {
  rank: number;
  domain: string;
}

function rankAndDedupe(raw: DdgImage[]): ScoredImage[] {
  const seenSources = new Set<string>(); // dedupe: max one image per domain
  const seenUrls = new Set<string>();    // dedupe: drop exact-URL duplicates
  const scored: ScoredImage[] = [];

  for (const r of raw) {
    if (!r.image || seenUrls.has(r.image)) continue;
    seenUrls.add(r.image);

    // Drop tiny / decorative images.
    if (r.width && r.height && (r.width < 200 || r.height < 200)) continue;

    const domain = domainOf(r.url ?? r.source ?? '');
    let rank = 0;

    if (PREFERRED_DOMAINS.has(domain)) rank += 100;
    if (DOWNRANK_DOMAINS.has(domain)) rank -= 50;

    // Prefer larger images (subtle bonus).
    if (r.width && r.height) {
      const longSide = Math.max(r.width, r.height);
      rank += Math.min(20, Math.floor(longSide / 100));
    }

    // One per domain to maximize variety in the user's pick list.
    if (seenSources.has(domain) && rank < 100) continue;
    seenSources.add(domain);

    scored.push({ ...r, rank, domain });
  }

  scored.sort((a, b) => b.rank - a.rank);
  return scored;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  try {
    const quota = await enforceQuota(req, 'find_item_image');
    if (!quota.ok) return quota.response;

    const body = (await req.json()) as Body;
    const query = buildQuery(body);
    if (!query) {
      throw new Error('Provide query or at least one of name/brand/subcategory.');
    }
    const count = Math.max(1, Math.min(20, body.count ?? 8));
    const raw = await searchImages(query);
    const ranked = rankAndDedupe(raw).slice(0, count);
    const results = ranked.map((r) => ({
      url: r.image,
      thumbnail: r.thumbnail || r.image,
      source: r.domain || r.source || '',
      title: r.title ?? '',
    }));

    return new Response(JSON.stringify({ query, results }), {
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : 'find-item-image failed',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      }
    );
  }
});
