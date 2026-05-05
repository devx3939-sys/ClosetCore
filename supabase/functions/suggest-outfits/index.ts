// POST /functions/v1/suggest-outfits
// Body: {
//   items: { id, name, category, subcategory, color, color_family, season, occasion }[],
//   occasion?: string | null,
//   palette?: { season, undertone, primary_colors, neutral_colors, avoid_colors } | null,
//   recent_outfit_signatures?: string[]   // sorted, joined item-id strings of past suggestions to avoid
// }
// Returns: { suggestions: { name, item_ids, occasion, score, rationale, vibe }[] }
//
// Reasons over the user's existing closet (text only — no images sent) and
// proposes 4–6 outfit combinations that follow color theory + occasion +
// proportion + texture rules. Scored 0–100 each. Encourages variety so the
// user doesn't see the same outfit every time.

import { corsHeaders } from '../_shared/cors.ts';
import { callGroqText, extractJson } from '../_shared/groq.ts';
import { enforceQuota } from '../_shared/quota.ts';

const SYSTEM = `You are a personal stylist trained in color theory, silhouette balance, fabric/texture coordination, and occasion-appropriateness. You build outfits from a set of items the user already owns. You return ONLY JSON — no commentary, no markdown fences.`;

interface Palette {
  season?: string | null;
  undertone?: string | null;
  primary_colors?: string[];
  neutral_colors?: string[];
  avoid_colors?: string[];
}

function userPrompt(
  itemsJson: string,
  occasion: string | null,
  palette: Palette | null,
  recentSignatures: string[]
) {
  const paletteBlock = palette
    ? `
USER'S COLOR PALETTE (use these to guide color choices):
- Best season: ${palette.season ?? 'unknown'}
- Undertone: ${palette.undertone ?? 'unknown'}
- Flattering colors (primary): ${(palette.primary_colors ?? []).join(', ') || 'unknown'}
- Flattering neutrals: ${(palette.neutral_colors ?? []).join(', ') || 'unknown'}
- Avoid: ${(palette.avoid_colors ?? []).join(', ') || 'none specified'}
Prefer outfits that lean on flattering colors. Use neutrals as anchors. Avoid the "avoid" palette as the dominant color.`
    : `
USER'S COLOR PALETTE: not yet analyzed. Use universal color theory: pick a neutral base, one accent color, and ensure saturation levels match.`;

  const varietyBlock = recentSignatures.length
    ? `
RECENTLY SHOWN OUTFITS (do NOT repeat these exact item combinations — produce different ones):
${recentSignatures.slice(0, 12).map((s) => `- [${s}]`).join('\n')}
If the closet is small and overlap is unavoidable, vary at least one item AND change the vibe (e.g. add/remove outerwear, swap shoes, change accessory).`
    : '';

  return `Here are the items in the user's closet, with id and metadata:

${itemsJson}
${paletteBlock}
${varietyBlock}

Build 4–6 outfit suggestions that look genuinely good. Each outfit must use ONLY ids from the list above.

STRUCTURAL RULES (every outfit must follow):
- 1 top + 1 bottom + 1 pair of shoes is the baseline. A dress replaces top+bottom. Add outerwear and accessories when they elevate the look.
- One statement piece MAX per outfit. The rest should support it.
- Proportion balance: pair loose with fitted (wide pants + fitted top, oversized sweater + slim jeans, cropped jacket + high-waist bottom). Don't pile loose on loose or fitted on fitted unless intentionally monochrome.
- Texture mix: combine smooth with textured when possible (denim + knit, leather/faux + soft fabric, cotton + something dressier). Plain outfits can borrow texture from a bag or shoes.
- Use one dominant neutral. Add at most one accent color. Keep saturation levels consistent unless deliberately high-contrast.
- Don't combine multiple loud patterns or competing statement pieces.

OCCASION & SEASON:
- Every item's occasion tag should be compatible with the outfit's occasion.
- Don't mix winter wool with summer linen.
${occasion ? `- ALL outfits must work for this occasion: ${occasion}.\n` : ''}
VIBE VARIETY (important):
- Each of the 4–6 outfits should have a distinctly different vibe. Pick from: minimal, polished, sporty, edgy, romantic, classic, monochrome, casual-cool, going-out, layered, bold-accent.
- At least ONE outfit should be a "wildcard" using an unusual or underused combination of pieces — not just the obvious top + bottom + shoes default. Use accessories, outerwear, or category mixes to make it.

SCORING: For each outfit, return a score 0–100 reflecting:
- Color harmony with palette (40%)
- Proportion + silhouette balance (25%)
- Occasion/season fit (20%)
- Texture / interest (10%)
- Cohesion (5%)

Return JSON in exactly this shape:

{
  "suggestions": [
    {
      "name": "evocative short name, 2-4 words, e.g. 'Soft minimal Monday'",
      "vibe": "minimal" | "polished" | "sporty" | "edgy" | "romantic" | "classic" | "monochrome" | "casual-cool" | "going-out" | "layered" | "bold-accent",
      "item_ids": ["uuid", "uuid", ...],
      "occasion": "casual" | "work" | "formal" | "sporty" | "date" | "event" | null,
      "score": 0,
      "rationale": "1-2 sentences. Lead with what makes it work (proportion, color, texture). Mention one specific styling reason."
    }
  ]
}

Return ONLY the JSON object. Aim for 4–6 distinct suggestions, sorted highest-score first.`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  try {
    const quota = await enforceQuota(req, 'suggest_outfits');
    if (!quota.ok) return quota.response;

    const body = await req.json();
    const { items, occasion, palette, recent_outfit_signatures } = body as {
      items: unknown[];
      occasion?: string | null;
      palette?: Palette | null;
      recent_outfit_signatures?: string[];
    };
    if (!Array.isArray(items)) throw new Error('items array is required');
    if (items.length < 3) {
      return new Response(
        JSON.stringify({
          error:
            'Add at least 3 items to your closet first — there is not enough to build an outfit from.',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'content-type': 'application/json' },
        }
      );
    }

    const text = await callGroqText({
      systemPrompt: SYSTEM,
      userPrompt: userPrompt(
        JSON.stringify(items, null, 2),
        occasion ?? null,
        palette ?? null,
        Array.isArray(recent_outfit_signatures) ? recent_outfit_signatures : []
      ),
      // Higher temp = more variety between calls (so the user doesn't get the
      // same outfit twice). The fixed structural rules keep quality high.
      temperature: 0.85,
      maxTokens: 3500,
    });
    const parsed = extractJson(text);
    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : 'suggest-outfits failed',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      }
    );
  }
});
