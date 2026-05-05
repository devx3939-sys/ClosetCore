// Helpers for calling Groq from Supabase Edge Functions.
// The API key is read from the GROQ_API_KEY function secret.
//
// NOTE on model: Llama 3.2 Vision (preview) was deprecated by Groq in early
// 2025. The current default is Llama 4 Scout, which is faster, free on the
// open tier, and supports the same image-URL input. Override with the
// GROQ_MODEL env var if you want Maverick or a future model.
//
// Groq uses an OpenAI-compatible Chat Completions API, so we send messages
// with `image_url` parts. The Supabase storage bucket is public, so we can
// pass the URL directly — no base64 encoding needed.

const API_KEY = Deno.env.get('GROQ_API_KEY');
const MODEL =
  Deno.env.get('GROQ_MODEL') ?? 'meta-llama/llama-4-scout-17b-16e-instruct';

if (!API_KEY) {
  console.error(
    'GROQ_API_KEY is not set. Run: supabase secrets set GROQ_API_KEY=...'
  );
}

const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

interface VisionArgs {
  systemPrompt: string;
  userPrompt: string;
  imageUrl: string;
  maxTokens?: number;
  temperature?: number;
}

export async function callGroqVision({
  systemPrompt,
  userPrompt,
  imageUrl,
  maxTokens = 4000,
  temperature = 0.4,
}: VisionArgs): Promise<string> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${API_KEY ?? ''}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: userPrompt },
            { type: 'image_url', image_url: { url: imageUrl } },
          ],
        },
      ],
      response_format: { type: 'json_object' },
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Groq API ${res.status}: ${body}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('Groq returned no content');
  }
  return content;
}

interface TextArgs {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
}

export async function callGroqText({
  systemPrompt,
  userPrompt,
  maxTokens = 3000,
  temperature = 0.6,
}: TextArgs): Promise<string> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${API_KEY ?? ''}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Groq API ${res.status}: ${body}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('Groq returned no content');
  }
  return content;
}

export function extractJson<T = unknown>(text: string): T {
  // With response_format: json_object, Groq returns clean JSON, but we still
  // strip markdown fences if any sneak through and grab the first {...} block.
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`No JSON object in response: ${text.slice(0, 200)}`);
  try {
    return JSON.parse(match[0]) as T;
  } catch (e) {
    throw new Error(
      `Could not parse JSON: ${e instanceof Error ? e.message : 'parse error'}`
    );
  }
}
