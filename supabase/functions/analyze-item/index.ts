// POST /functions/v1/analyze-item
// Body: { image_url: string }
// Returns: { name, category, subcategory, color, color_family, brand?, season[], occasion[] }
// Uses Groq (Llama 4 Scout) vision to identify a single clothing piece.

import { corsHeaders } from '../_shared/cors.ts';
import { callGroqVision, extractJson } from '../_shared/groq.ts';
import { enforceQuota } from '../_shared/quota.ts';

const SYSTEM = `You are a wardrobe cataloger. You receive a photo of a single clothing item and return a strict JSON object describing it. You return ONLY JSON — no commentary, no markdown fences.`;

const USER = `Analyze this clothing item and return JSON in exactly this shape:

{
  "name": "short label, 2-4 words, e.g. 'Black turtleneck'",
  "category": "tops" | "bottoms" | "dresses" | "shoes" | "accessories" | "outerwear",
  "subcategory": "specific type, e.g. 'turtleneck', 'jeans', 'sneakers'",
  "color": "primary color as a hex string, e.g. '#1a1a1a'",
  "color_family": "common color name, e.g. 'navy', 'charcoal', 'cream'",
  "brand": "visible brand name as a string, or null",
  "season": ["spring" | "summer" | "fall" | "winter"],
  "occasion": ["casual" | "work" | "formal" | "sporty" | "date" | "event"]
}

Pick only the seasons and occasions that genuinely fit. Be specific in name and subcategory. Return ONLY the JSON object.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  try {
    const quota = await enforceQuota(req, 'analyze_item');
    if (!quota.ok) return quota.response;

    const { image_url } = await req.json();
    if (!image_url) throw new Error('image_url is required');
    const text = await callGroqVision({
      systemPrompt: SYSTEM,
      userPrompt: USER,
      imageUrl: image_url,
      maxTokens: 800,
    });
    const data = extractJson(text);
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : 'analyze-item failed',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      }
    );
  }
});
