// POST /functions/v1/analyze-palette
// Body: { image_url: string }
// Returns: a personalized palette + a custom-tuned variant of every season.
// Reads skin/hair/eye tones from the selfie and assigns a color season.

import { corsHeaders } from '../_shared/cors.ts';
import { callGroqVision, extractJson } from '../_shared/groq.ts';
import { enforceQuota } from '../_shared/quota.ts';

const SYSTEM = `You are a professional color analyst trained in seasonal color theory (Spring/Summer/Autumn/Winter). You analyze a selfie, infer the subject's skin undertone, hair color, and eye color, and return a strict JSON object with their best palette plus a custom-tuned version of every season's palette specifically tailored to this person. You return ONLY JSON — no commentary, no markdown fences.`;

const USER = `Analyze the person in this photo. Determine their natural color season (warm/cool/neutral undertone, value, chroma).

Return JSON in exactly this shape:

{
  "best_season": "spring" | "summer" | "autumn" | "winter",
  "undertone": "warm" | "cool" | "neutral",
  "skin_tone_hex": "#hex",
  "hair_color_hex": "#hex",
  "eye_color_hex": "#hex",
  "rationale": "1-2 sentence explanation of why this season",
  "primary_colors":   ["#hex", "#hex", "#hex", "#hex", "#hex"],
  "secondary_colors": ["#hex", "#hex", "#hex", "#hex"],
  "accent_colors":    ["#hex", "#hex", "#hex"],
  "neutral_colors":   ["#hex", "#hex", "#hex", "#hex"],
  "avoid_colors":     ["#hex", "#hex", "#hex"],
  "per_season_palettes": {
    "spring": { "primary": ["#hex", ...4-5], "secondary": ["#hex", ...3-4], "accent": ["#hex", ...3], "neutral": ["#hex", ...3-4], "avoid": ["#hex", ...3] },
    "summer": { "primary": [...], "secondary": [...], "accent": [...], "neutral": [...], "avoid": [...] },
    "autumn": { "primary": [...], "secondary": [...], "accent": [...], "neutral": [...], "avoid": [...] },
    "winter": { "primary": [...], "secondary": [...], "accent": [...], "neutral": [...], "avoid": [...] }
  }
}

Important:
- The top-level palette is THIS user's best palette overall.
- per_season_palettes are each season's palette adapted to THIS user's complexion — e.g. if the user is a cool-toned person, the "autumn" palette should use cooler-leaning autumn shades that still flatter them.
- All hex codes must be valid 6-char hex (#RRGGBB).
- Return ONLY the JSON object.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  try {
    const quota = await enforceQuota(req, 'analyze_palette');
    if (!quota.ok) return quota.response;

    const { image_url } = await req.json();
    if (!image_url) throw new Error('image_url is required');
    const text = await callGroqVision({
      systemPrompt: SYSTEM,
      userPrompt: USER,
      imageUrl: image_url,
      maxTokens: 3500,
    });
    const data = extractJson(text);
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : 'analyze-palette failed',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      }
    );
  }
});
