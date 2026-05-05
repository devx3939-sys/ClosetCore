// POST /functions/v1/analyze-outfit
// Body: { image_url: string }
// Returns: { outfit_name, items: ItemAnalysis[] }
// Identifies every piece in a worn or laid-out outfit.

import { corsHeaders } from '../_shared/cors.ts';
import { callGroqVision, extractJson } from '../_shared/groq.ts';
import { enforceQuota } from '../_shared/quota.ts';

const SYSTEM = `You are a wardrobe cataloger. You receive a photo of an outfit (either worn or laid flat) and return a strict JSON object listing every clothing piece visible. You return ONLY JSON — no commentary, no markdown fences.`;

const USER = `Identify each separate clothing piece in this outfit photo. Return JSON in exactly this shape:

{
  "outfit_name": "short evocative name, e.g. 'Friday casual'",
  "items": [
    {
      "name": "short label, 2-4 words",
      "category": "tops" | "bottoms" | "dresses" | "shoes" | "accessories" | "outerwear",
      "subcategory": "specific type",
      "color": "primary color hex",
      "color_family": "common color name",
      "season": ["spring" | "summer" | "fall" | "winter"],
      "occasion": ["casual" | "work" | "formal" | "sporty" | "date" | "event"]
    }
  ]
}

Include every visible piece (top, bottom, outerwear, shoes, accessories). Skip skin / hair. Typically 3-7 items. Return ONLY the JSON object.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  try {
    const quota = await enforceQuota(req, 'analyze_outfit');
    if (!quota.ok) return quota.response;

    const { image_url } = await req.json();
    if (!image_url) throw new Error('image_url is required');
    const text = await callGroqVision({
      systemPrompt: SYSTEM,
      userPrompt: USER,
      imageUrl: image_url,
      maxTokens: 2000,
    });
    const data = extractJson(text);
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : 'analyze-outfit failed',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      }
    );
  }
});
