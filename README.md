# ClosetCore

Personal styling app: digital wardrobe, AI-powered outfit and color analysis, cross-device sync. Native Windows/macOS desktop app, iOS + Android mobile app, and a full website — one account syncs everything.

---

## Contents

1. [What it does](#what-it-does)
2. [Folder layout](#folder-layout)
3. [Prerequisites](#prerequisites)
4. [Step-by-step initial setup](#step-by-step-initial-setup)
5. [Running the website](#running-the-website)
6. [Running the mobile app (iOS + Android)](#running-the-mobile-app-ios--android)
7. [Running the desktop app (Windows + macOS)](#running-the-desktop-app-windows--macos)
8. [Building production installers](#building-production-installers)
9. [Troubleshooting](#troubleshooting)

---

## What it does

**All three clients (desktop, mobile, web):**
- Email/password account, syncs everywhere
- Closet: add/edit/delete items with photo, brand, color, season, occasion, size, favorites, search/filter
- **AI auto-fill**: pick a photo, the app fills name, category, color, brand, season, occasion automatically
- **AI scan whole closet**: take one wide photo of your closet — every item is detected and added at once
- **Real color picker**: swatch + HSL graph + hex input + curated quick-picks
- Outfit builder: combine pieces into named outfits
- **AI outfit photo**: upload a photo of an outfit, every piece is detected, added to your closet, and saved as a named outfit
- **AI outfit suggestions**: AI looks at your closet and proposes 4–6 outfits using color theory + occasion match. One tap to save.
- Outfit favorites + "Wore today" tracking
- Color palette: manual season picker (Spring/Summer/Autumn/Winter)
- **AI selfie palette**: upload your photo, the AI detects skin/hair/eye tones, picks your best season, AND customizes every season's palette to your complexion

**Website-only:** landing page, features, pricing, about, download, privacy, terms, 404, sign-up/sign-in, mobile-responsive dashboard.

---

## Folder layout

```
ClosetCore/
├── README.md               (this file)
├── app/
│   ├── desktop/            Tauri 2 — native Windows/macOS installer
│   ├── mobile/             Expo (React Native) — iOS, Android
│   └── shared/             TypeScript types shared by all clients
├── website/                Next.js 15
└── supabase/
    ├── schema.sql          Tables + RLS + auth trigger + closet-images bucket
    ├── schema-2-ai.sql     Per-season palette columns + selfies bucket
    └── functions/          Edge Functions: analyze-item, analyze-outfit, analyze-palette
```

**Important:** every command in this README is run from inside the relevant subfolder. If you see `cd "c:/Users/Xavier/Desktop/Closet App/app/mobile"`, you must be in that exact folder, not the root. That's what caused the `expected package.json` error if you've already hit it.

---

## Prerequisites

You only need to install the toolchains for the clients you want to run.

| Toolchain | Needed for | Install |
|---|---|---|
| **Node.js 20+** | Everything | https://nodejs.org (you already have v24 ✓) |
| **Groq API key** (free) | The AI features in any client | https://console.groq.com/keys |
| **Supabase CLI** | Deploying the 3 edge functions | `npm install -g supabase` or `scoop install supabase` |
| **Expo Go** (phone app) | Testing on iPhone/Android | App Store / Play Store |
| **Rust** | Building the Windows/macOS installer | https://www.rust-lang.org/tools/install |
| **MS C++ Build Tools** | Windows installer linker | https://visualstudio.microsoft.com/visual-cpp-build-tools/ — pick "Desktop development with C++" |

---

## Step-by-step initial setup

Do these once. Assumes you've already created a Supabase project — your URL is `https://peizhwbhihzjzudemlmk.supabase.co`. ✓

### 1. Run both schema scripts in Supabase

In your Supabase dashboard → **SQL Editor → New query**:
1. Paste the contents of [supabase/schema.sql](supabase/schema.sql) → **Run**.
2. New query → paste [supabase/schema-2-ai.sql](supabase/schema-2-ai.sql) → **Run**.

You now have: 4 tables (`profiles`, `closet_items`, `outfits`, `color_palettes`), RLS policies, a `handle_new_user` trigger, and 2 storage buckets (`closet-images`, `selfies`).

### 2. (Recommended) Disable email confirmation for testing

Supabase requires email confirmation by default. To skip the email click during dev:
**Authentication → Providers → Email → toggle off "Confirm email" → Save**.

You can re-enable it later for production.

### 3. Verify your `.env` files exist

I already wrote these for you with your URL + anon key. Just double-check they're there:

```
website/.env.local       NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
app/desktop/.env         VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
app/mobile/.env          EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY
```

### 4. Deploy the AI edge functions (~10 min)

The full walkthrough lives in **[DEPLOYMENT.md](DEPLOYMENT.md)** — Supabase CLI install, login + link, schema, secrets, function deploys, and troubleshooting. The short version:

1. Install the Supabase CLI (Scoop or direct binary — `npm install -g` doesn't work)
2. Get a free **Groq API key** at https://console.groq.com/keys (no card required, ~30 req/min free tier)
3. `supabase login` → `supabase link --project-ref peizhwbhihzjzudemlmk`
4. `supabase secrets set GROQ_API_KEY=gsk_...`
5. `supabase functions deploy analyze-item` (and the other 4)

The AI features call **Groq Llama 4 Scout** (Groq's current vision model — it replaced Llama 3.2 Vision when that was deprecated in early 2025). Free-forever tier, very fast inference.

You're now ready to run any client.

---

## Running the website

The fastest client to test — no extra toolchains beyond Node.

```bash
cd "c:/Users/Xavier/Desktop/Closet App/website"
npm install
npm run dev
```

Open http://localhost:3000.

The first `npm install` takes ~2 minutes. Subsequent `npm run dev` boots in ~3 seconds.

**What you can do:**
- `/` — landing page
- `/features`, `/pricing`, `/about`, `/download`, `/privacy`, `/terms`
- `/signup` → create account → `/dashboard`
- Dashboard: closet, outfits, palette, profile

To deploy the website to a real domain later, push to GitHub then connect the repo in Vercel — it auto-detects Next.js.

---

## Running the mobile app (iOS + Android)

This is what fixes your earlier error. **Run from `app/mobile`, not the root.**

### One-time

1. Install **Expo Go** on your phone (App Store / Google Play).
2. Make sure your phone and PC are on the **same Wi-Fi**.

### Each session

```bash
cd "c:/Users/Xavier/Desktop/Closet App/app/mobile"
npm install                # only needed first time, or after dependency changes
npx expo start
```

A QR code prints in your terminal. Then:
- **iOS**: open the **Camera app** (NOT Expo Go), point at the QR, tap the "Open in Expo Go" notification.
- **Android**: open **Expo Go**, tap "Scan QR code", point at the QR.

The app loads on your phone. Save any file → it hot-reloads automatically.

### Common Expo flags

```bash
npx expo start --clear        # clear Metro cache (fixes weird stale-bundle bugs)
npx expo start --tunnel       # use ngrok tunnel (when phone + PC aren't on same Wi-Fi)
npx expo start --web          # opens app/mobile as a web app at localhost:8081
```

---

## Running the desktop app (Windows + macOS)

Two ways to run, depending on whether you want the native installer or just dev mode.

### Option A — Dev mode (no Rust needed)

The desktop UI is a Vite + React app. You can run it as a regular web page in your browser, no Rust required.

```bash
cd "c:/Users/Xavier/Desktop/Closet App/app/desktop"
npm install
npm run dev
```

Opens http://localhost:1420 — same UI as the native app, runs in your browser. Good for fast iteration.

### Option B — Native window (requires Rust)

To open as a real OS window (not browser):

1. Install **Rust** from https://www.rust-lang.org/tools/install (run `rustup-init.exe`).
2. Install **MS C++ Build Tools** if on Windows (see Prerequisites table).
3. Generate icons (one-time):
   ```bash
   cd "c:/Users/Xavier/Desktop/Closet App/app/desktop"
   npx @tauri-apps/cli icon path/to/your-icon-1024.png
   ```
4. Run:
   ```bash
   npm run tauri:dev
   ```

First boot compiles all Rust deps (5–10 min). Subsequent boots are ~10 sec.

---

## Building production installers

### Windows / macOS desktop installer

```bash
cd "c:/Users/Xavier/Desktop/Closet App/app/desktop"
npm install
npx @tauri-apps/cli icon path/to/your-icon-1024.png   # one-time
npm run tauri:build
```

Output (in `app/desktop/src-tauri/target/release/bundle/`):
- **Windows**: `msi/ClosetCore_1.0.0_x64_en-US.msi` — double-click to install
- **macOS**: `dmg/ClosetCore_1.0.0_x64.dmg` — open and drag to Applications

For code-signing (so the installer doesn't trigger SmartScreen warnings on Windows or Gatekeeper on macOS), you'd need a code-signing certificate. Optional, but recommended before shipping to real users.

### iOS .ipa

**You cannot make a signed iOS .ipa from a Windows machine.** Apple requires:
- macOS + Xcode (for codesigning), AND
- An Apple Developer account ($99/year)

The closest workaround on Windows is **EAS Build** (Expo's cloud builder), but it still needs the Apple Developer account for signing.

For testing right now, **use Expo Go** as described above — it's the standard iOS-on-Windows path.

### Android .apk / .aab

You can build Android from Windows. Easiest path:

```bash
cd "c:/Users/Xavier/Desktop/Closet App/app/mobile"
npx eas-cli build --platform android --profile preview
```

(Requires a free Expo account: https://expo.dev. The `preview` profile produces an `.apk` you can sideload onto any Android phone.)

---

## Troubleshooting

**`ConfigError: The expected package.json path: ... does not exist`**
You ran a command from the wrong folder. `cd` into the relevant subfolder first (e.g. `app/mobile` for `expo start`, `website` for `next dev`, `app/desktop` for Tauri).

**Sign-in works but the dashboard shows "Loading…" forever**
The Supabase schema didn't run. Re-run [supabase/schema.sql](supabase/schema.sql) in the SQL editor.

**"Confirm your email" loop after signup**
Either click the email Supabase sends, or disable confirmation: Authentication → Providers → Email → toggle off "Confirm email".

**`Function returned a non-2xx status code` when clicking AI buttons**
Either the edge functions aren't deployed, or `GROQ_API_KEY` isn't set, or you hit the ~30-req/min Groq free tier. Check `supabase functions logs <name> --tail`. See [DEPLOYMENT.md](DEPLOYMENT.md) → Troubleshooting.

**Photos upload but don't show**
Check Storage → buckets → `closet-images` exists and is marked public. (As of the latest update, the app uses just one bucket — `closet-images` — for items, outfits, closet scans, AND selfies. The old `selfies` bucket is no longer required.)

**"Bucket not found" error**
You're on an older client that still tries the `selfies` bucket. Pull the latest code; it consolidates everything into `closet-images`.

**Expo: "Connection refused" when scanning QR**
Phone and PC must be on the same Wi-Fi network. Some corporate / guest networks block device-to-device traffic. Tether off your phone, or run `npx expo start --tunnel`.

**Tauri build: "linker `link.exe` not found"**
Microsoft C++ Build Tools aren't installed. Install from https://visualstudio.microsoft.com/visual-cpp-build-tools/ → pick "Desktop development with C++" workload.

**Tauri build: huge first build time**
Expected — Rust compiles everything from source on first build. Subsequent builds use the cached artifacts and take seconds.

**Mobile app crashes on launch right after install**
Check that `app/mobile/.env` exists with both `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`, then run `npx expo start --clear` to bust the bundle cache.

**Cost concern with the AI features**
Free. Groq Llama 4 Scout has a free tier with ~30 requests/minute and a generous daily token cap — way more than personal use needs. The Groq key is server-side only; clients never see it.

---

## What's not built yet

From [APP_PLAN.md](APP_PLAN.md), Phase 2/3:

- Calendar planning + weather integration
- Stripe checkout for the pricing tiers
- Affiliate shopping integration
- AR try-on
- Social feed / sharing
- Background removal in item photos

The data model and UI hooks are designed to accommodate these — they're additive from here.
