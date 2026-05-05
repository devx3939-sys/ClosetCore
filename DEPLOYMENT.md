# Deployment

Everything you need to deploy the database schema, storage buckets, and AI edge functions to Supabase. Every command runs from PowerShell on Windows. Copy them in order.

> Your Supabase project ref is **`peizhwbhihzjzudemlmk`** (already in your env files). The CLI commands below use it directly.

---

## Contents

1. [Install the Supabase CLI](#1-install-the-supabase-cli)
2. [Get a free Groq API key](#2-get-a-free-groq-api-key)
3. [One-time login + link](#3-one-time-login--link)
4. [Deploy the database schema](#4-deploy-the-database-schema)
5. [Set the Groq secret](#5-set-the-groq-secret)
6. [Deploy the 5 edge functions](#6-deploy-the-5-edge-functions)
7. [Updating later](#7-updating-later)
8. [Troubleshooting](#troubleshooting)

---

## 1. Install the Supabase CLI

`npm install -g supabase` is **not supported** — Supabase explicitly blocks it. Pick one:

### Option A — Scoop (recommended)

```powershell
# Install Scoop itself if you don't have it (one-time)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
irm get.scoop.sh | iex

# Add the Supabase bucket and install
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# Verify
supabase --version
```

### Option B — Download the binary directly

1. Open https://github.com/supabase/cli/releases/latest in your browser.
2. Download `supabase_windows_amd64.tar.gz` (or `_arm64` if Snapdragon).
3. Extract `supabase.exe` to a folder, e.g. `C:\Users\Xavier\bin\`.
4. Add that folder to your `PATH`: Settings → System → About → Advanced system settings → Environment Variables → User Path → Edit → New → paste the folder.
5. Open a fresh PowerShell window and run:

```powershell
supabase --version
```

If your previous failed npm install left junk behind, clean it up:

```powershell
Remove-Item -Recurse -Force "C:\Users\Xavier\AppData\Roaming\npm\node_modules\supabase" -ErrorAction SilentlyContinue
```

---

## 2. Get a free Groq API key

The AI edge functions call Groq. The default model is **Llama 4 Scout** (`meta-llama/llama-4-scout-17b-16e-instruct`) — Groq's current vision model on the free tier. Llama 3.2 Vision (preview) was deprecated by Groq in early 2025 and replaced by the Llama 4 line; Scout is the closest free equivalent.

The free tier limits (as of mid-2026) are roughly **30 requests/minute** and a daily token cap that's far above personal use.

1. Go to https://console.groq.com/keys
2. Sign in with Google / GitHub / email
3. **Create API Key** → name it "closet-app" → copy the key (starts with `gsk_...`)

You don't need to add a credit card. The key gets stored as an encrypted Supabase function secret in step 5 — it never touches client code.

> **Switching the model later:** to use Maverick instead of Scout (better vision quality, slower), set a second secret: `supabase secrets set GROQ_MODEL=meta-llama/llama-4-maverick-17b-128e-instruct`. No redeploy needed; secrets are read at runtime.

---

## 3. One-time login + link

Do these once per machine. After this, every redeploy is just one command per function.

```powershell
cd "c:/Users/Xavier/Desktop/Closet App"

# Opens a browser window — log in with the same email you use on supabase.com
supabase login

# Tell the CLI which project to deploy against
supabase link --project-ref peizhwbhihzjzudemlmk
```

If `supabase link` asks for the database password, paste it from Supabase: **Project Settings → Database → Connection string → DB password** (or reset it there).

---

## 4. Deploy the database schema

The two SQL files create tables, RLS policies, the `closet-images` bucket, and the AI palette columns. Run them in the Supabase **SQL Editor** (Dashboard → SQL Editor → New query → paste → Run).

```
supabase/schema.sql           ← run if you haven't already (creates everything)
supabase/schema-2-ai.sql      ← run once for the AI palette columns
supabase/schema-3-plans.sql   ← run once for paid plans + usage tracking
```

> The CLI's `supabase db push` workflow uses migrations folders, which we don't have. Pasting in the dashboard is the right call here — it's one click each.

---

## 5. Set the Groq secret

This stores your Groq key in Supabase's encrypted function secrets. Edge functions read it as `Deno.env.get('GROQ_API_KEY')`. Your client code never sees it.

```powershell
cd "c:/Users/Xavier/Desktop/Closet App"

supabase secrets set GROQ_API_KEY=gsk_...your-key-here
```

Verify:

```powershell
supabase secrets list
```

You should see `GROQ_API_KEY` listed (the value is hidden).

If you previously set `ANTHROPIC_API_KEY` or `GEMINI_API_KEY`, you can remove them — they're no longer used:

```powershell
supabase secrets unset ANTHROPIC_API_KEY
supabase secrets unset GEMINI_API_KEY
```

### 5b. Online photo lookup — no key required

The "Find better photo online" feature uses DuckDuckGo image search, which doesn't require an API key. It also auto-runs as a fallback during "Scan whole closet" when the cropped item photo is missing or too small. Nothing to configure here — it works as soon as you deploy `find-item-image`.

> If DuckDuckGo ever rate-limits the function (unlikely for personal use), the call will return a clear error and the item will fall back to its color swatch. No silent failures.

---

## 6. Deploy the 9 edge functions

```powershell
cd "c:/Users/Xavier/Desktop/Closet App"

supabase functions deploy analyze-item
supabase functions deploy analyze-outfit
supabase functions deploy analyze-palette
supabase functions deploy analyze-closet
supabase functions deploy suggest-outfits
supabase functions deploy find-item-image
supabase functions deploy get-usage
supabase functions deploy create-checkout-session
supabase functions deploy stripe-webhook
```

Each command takes 5–15 seconds. After the last one, confirm in Supabase: **Dashboard → Edge Functions** — you should see all 9 listed, all green.

> The last two (`create-checkout-session`, `stripe-webhook`) are stubs that return a "not configured" error until you wire up Stripe. See [PLANS.md](PLANS.md) for the integration steps.

### About `SUPABASE_*` env vars

Supabase **auto-injects** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` into every edge function environment — quota enforcement and `get-usage` use the auto-injected service role key, so you don't have to set it. (Trying to `supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...` will be rejected with "Env name cannot start with SUPABASE_" — that's the CLI protecting the reserved prefix; nothing's wrong.)

> `find-item-image` is the "Find better photo online" feature. It uses DuckDuckGo image search — no API key, no quotas. Just deploy it and it works.

Do a quick smoke test from the website:
1. `npm run dev` in `website/`
2. Sign in
3. **Closet → Add item → pick a photo → Auto-fill from photo**

If you see fields populate, the whole pipeline (storage upload → edge function → Groq → DB write) is working.

---

## 7. Updating later

Whenever I (or you) change a function in `supabase/functions/<name>/index.ts`, just re-deploy that one function:

```powershell
supabase functions deploy <name>
```

Whenever I change `_shared/groq.ts` or `_shared/cors.ts` (the helpers), redeploy **all 6** functions because they bundle the helpers at deploy time:

```powershell
supabase functions deploy analyze-item
supabase functions deploy analyze-outfit
supabase functions deploy analyze-palette
supabase functions deploy analyze-closet
supabase functions deploy suggest-outfits
supabase functions deploy find-item-image
```

To rotate your Groq key:

```powershell
supabase secrets set GROQ_API_KEY=gsk_new-key
# No redeploy needed — secrets are read at runtime
```

To switch models without re-deploying:

```powershell
# Higher-quality vision (slower)
supabase secrets set GROQ_MODEL=meta-llama/llama-4-maverick-17b-128e-instruct

# Back to default
supabase secrets unset GROQ_MODEL
```

To watch live logs from a function (great for debugging the AI calls):

```powershell
supabase functions logs analyze-item --tail
```

---

## Troubleshooting

**`supabase --version` not found after install**
The folder isn't in your PATH yet. With Scoop, that should happen automatically — try a new PowerShell window first. With direct binary, double-check the PATH entry and reopen PowerShell.

**`Error: project not linked`**
You skipped step 3. Run `supabase link --project-ref peizhwbhihzjzudemlmk`.

**`Function returned a non-2xx status code` in the app**
Check the logs:
```powershell
supabase functions logs <function-name> --tail
```
Most common causes: `GROQ_API_KEY` not set (step 5), free-tier rate limit hit (~30 RPM), or the image URL isn't publicly accessible.

**`Failed to fetch image (403/404)`**
The `closet-images` bucket isn't public. Open Supabase → Storage → `closet-images` → Configuration → toggle **Public bucket** on.

**`Groq API 400: model_decommissioned`**
You're pinned to a deprecated model via `GROQ_MODEL`. Unset it to fall back to the default Llama 4 Scout:
```powershell
supabase secrets unset GROQ_MODEL
```

**`Groq API 429: Rate limit reached`**
Free tier limits are ~30 RPM. Wait a minute. If you genuinely need more throughput, add a credit card on Groq for the dev tier; rates jump dramatically.

**`Groq API 400: Invalid request: image_url ... must be publicly accessible`**
The `closet-images` bucket isn't public, or the image URL was generated wrong. Check Storage settings.

**`supabase functions deploy` says it can't find the function**
You're in the wrong directory. The CLI looks for `supabase/functions/<name>/index.ts` relative to where you ran it. Always run from the project root:
```powershell
cd "c:/Users/Xavier/Desktop/Closet App"
```

**Mixed-up secrets from earlier setup**
List what's currently set:
```powershell
supabase secrets list
```
Remove anything obsolete:
```powershell
supabase secrets unset OLD_KEY_NAME
```

---

## Cheat sheet

```powershell
# Setup (once)
scoop install supabase
supabase login
supabase link --project-ref peizhwbhihzjzudemlmk
supabase secrets set GROQ_API_KEY=gsk_...

# Schema (run SQL in dashboard editor, paste from)
#   supabase/schema.sql
#   supabase/schema-2-ai.sql

# Deploy all 6 functions (whenever code changes)
supabase functions deploy analyze-item
supabase functions deploy analyze-outfit
supabase functions deploy analyze-palette
supabase functions deploy analyze-closet
supabase functions deploy suggest-outfits
supabase functions deploy find-item-image

# Tail logs of a specific function
supabase functions logs analyze-item --tail
```
