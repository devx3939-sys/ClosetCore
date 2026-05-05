// POST /functions/v1/analyze-closet
// Body: { image_url: string }
// Returns: { items: ItemAnalysis[] }
// Identifies every individual clothing item visible in a wide closet photo.

import { corsHeaders } from '../_shared/cors.ts';
import { callGroqVision, extractJson } from '../_shared/groq.ts';
import { enforceQuota } from '../_shared/quota.ts';

const SYSTEM = `You are a wardrobe cataloger. You receive a wide photo of an entire closet, drawer, or rack with many clothing items visible at once. You must identify EVERY distinct garment in the image — including ones partially obscured, hanging behind others, or stacked. You return ONLY JSON — no commentary, no markdown fences.`;

const USER = `Identify every individual clothing piece visible. Return JSON in exactly this shape:

{
  "items": [
    {
      "name": "short label, 2-4 words, e.g. 'Black turtleneck'",
      "category": "tops" | "bottoms" | "dresses" | "shoes" | "accessories" | "outerwear",
      "subcategory": "specific type, e.g. 'turtleneck', 'jeans'",
      "color": "primary color hex, e.g. '#1a1a1a'",
      "color_family": "common color name, e.g. 'navy'",
      "brand": "visible brand name or null",
      "season": ["spring" | "summer" | "fall" | "winter"],
      "occasion": ["casual" | "work" | "formal" | "sporty" | "date" | "event"],
      "bounding_box": { "x": 0.10, "y": 0.20, "width": 0.30, "height": 0.40 }
    }
  ]
}

GENERAL RULES:
- Include EVERY visible piece. A typical closet photo will have 8-30+ items.
- Skip non-clothing items (hangers, shelves, mirrors, walls).
- Treat each garment as a separate entry, even if similar (two black t-shirts = two entries).
- Pick only the seasons and occasions that genuinely fit each piece.
- Return ONLY the JSON object.

BOUNDING BOX RULES (very important — these become the item thumbnails the user sees in their grid):

- bounding_box uses NORMALIZED coordinates from 0.0 to 1.0 relative to the full image. (0,0) is top-left, (1,1) is bottom-right. width and height are 0.0–1.0 fractions, NOT pixels.
- The box must contain the ENTIRE item (top to bottom, left to right) — including sleeves on a shirt, the full leg of pants, the full strap on a bag, the full sole on a shoe. Cropping off part of a garment makes the thumbnail useless.
- ONLY contain THAT item — don't include neighboring items in the same box. Tighter is better than including a second garment in the frame.
- After estimating the tightest fit, expand each side by ~7% so nothing is clipped at the edges. (You provide the un-padded estimate; the client adds final padding.)
- The box must be inside the image: 0 ≤ x, x + width ≤ 1, 0 ≤ y, y + height ≤ 1.
- Aspect ratio sanity:
  - Tops, dresses, outerwear, pants → typically taller than wide (height > width). Box should be ~1:1 to 1:3 (width:height).
  - Shoes, accessories → typically wider than tall or roughly square. Box should be ~1:1 to 3:1 (width:height).
  - If your box has an extreme ratio (>4:1 either way), you've probably included or excluded too much — re-estimate.
- For a typical hanging shirt that takes ~25% of the image width and ~40% of the height, a reasonable box looks like: { "x": 0.32, "y": 0.18, "width": 0.25, "height": 0.40 }.
- Do NOT return tiny boxes (< 0.05 in width OR height) unless the item really is that small in frame.
- bounding_box is REQUIRED for every item. If you genuinely cannot localize one, still provide your best estimate.
- Sanity check before answering: items in the same shelf/row should have similar y values; items hanging in the same column should have similar x values; boxes should NOT overlap each other significantly (each garment occupies its own region).`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  try {
    const quota = await enforceQuota(req, 'analyze_closet');
    if (!quota.ok) return quota.response;

    const { image_url } = await req.json();
    if (!image_url) throw new Error('image_url is required');
    const text = await callGroqVision({
      systemPrompt: SYSTEM,
      userPrompt: USER,
      imageUrl: image_url,
      maxTokens: 4000,
    });
    const data = extractJson(text);
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : 'analyze-closet failed',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      }
    );
  }
});
