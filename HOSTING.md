# Hosting — GitHub + Vercel walkthrough

This guide pushes the whole project to a GitHub repo, then hosts **the website** on Vercel's free tier. The website is the only piece that gets "hosted" — the mobile and desktop apps are distributed differently (App Store / Play Store / downloadable installer). I cover those at the bottom for completeness.

Total time: ~15 minutes.

---

## Part 1 — Push to GitHub

### Step 1. Create the GitHub repository

1. Go to https://github.com/new
2. Fill in:
   - **Repository name:** `closetcore` (or anything you like)
   - **Description:** `Personal styling app — digital wardrobe, AI outfit + color analysis, cross-device sync`
   - **Visibility:** **Private** (recommended — your supabase project ref appears in some docs and you may want it kept quiet until launch)
   - **Initialize this repository with:** leave everything UNCHECKED. You already have files locally.
3. Click **Create repository**
4. On the next page, copy the URL — it'll look like:
   ```
   https://github.com/YourUsername/closetcore.git
   ```

### Step 2. Verify nothing sensitive will get pushed

The `.gitignore` already blocks:
- `node_modules/` (huge, regeneratable)
- `.env` and `.env.*` (your Supabase URL and anon key)
- `.next/`, `dist/`, `build/`, `src-tauri/target/` (build artifacts)
- `.expo/`, `supabase/.temp/`

Quick check from PowerShell:

```powershell
cd "c:/Users/Xavier/Desktop/Closet App"
git status
```

Look at the file list it'll commit. You should **NOT** see any of these:
- `*.env` or `.env.local`
- Anything under `node_modules/`
- `.next/`
- The Supabase service role key (it lives in Supabase secrets, not in your files — but double-check no source file accidentally hardcoded it)

If you do see something sensitive, add it to `.gitignore` first.

> The anon key in your `.env` files is **safe to expose** — it's designed for client-side use and Row Level Security restricts what it can do. But there's no reason to put it in a public repo either. Keep the repo private until you're sure.

### Step 3. Push

```powershell
cd "c:/Users/Xavier/Desktop/Closet App"

# Add the GitHub repo as the "origin" remote (use the URL from Step 1)
git remote add origin https://github.com/YourUsername/closetcore.git

# Stage everything and commit
git add .
git commit -m "Initial public commit of ClosetCore"

# Push to GitHub
git push -u origin main
```

If `git push` asks for credentials:
- **Username:** your GitHub username
- **Password:** a Personal Access Token (NOT your GitHub password — they removed that in 2021). Create one at https://github.com/settings/tokens → **Generate new token (classic)** → tick the `repo` scope → copy the token, paste it as the password.

Or skip all of that by installing the GitHub CLI: `winget install GitHub.cli`, then `gh auth login` once, and `git push` Just Works after that.

After the push, refresh your GitHub repo page — you should see every file there.

---

## Part 2 — Deploy the website to Vercel (free)

Vercel is made by the Next.js team. The free tier is generous (100 GB bandwidth/month, unlimited static deploys, included serverless functions), more than enough for personal use or early growth.

### Step 4. Sign up for Vercel

1. Go to https://vercel.com/signup
2. Click **Continue with GitHub** (saves you setup later)
3. Authorize Vercel to access your GitHub account

### Step 5. Import the repo

1. Vercel dashboard → top-right **Add New… → Project**
2. **Import Git Repository** section → find `closetcore` → click **Import**
3. (If the repo doesn't show up: click **Adjust GitHub App Permissions** → grant Vercel access to that repo)

### Step 6. Configure the project

This is the only tricky bit because the project is a monorepo.

1. **Project Name:** `closetcore` (Vercel will append a random suffix; you can change later)
2. **Framework Preset:** should auto-detect as `Next.js`. If it says "Other," manually pick **Next.js**.
3. **Root Directory:** click **Edit** next to the input → set to `website` → **Continue**
   - This is critical. Without it, Vercel tries to build from the repo root and fails.
4. **Build and Output Settings:** leave the defaults (Vercel knows the Next.js commands)
5. **Environment Variables** → expand the section → add these two **before** clicking Deploy:

   | Key | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://peizhwbhihzjzudemlmk.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (your anon key — from `website/.env.local` or Supabase Dashboard → Project Settings → API → anon public) |

   Paste both as **Production**, **Preview**, AND **Development** (the default — leave all three boxes checked).

6. Click **Deploy**

The first build takes ~2–3 minutes. Subsequent deploys (after every `git push`) take 30–60 seconds.

### Step 7. Visit your live site

When the build finishes, Vercel shows a confetti animation and a URL like:
```
https://closetcore-abc123.vercel.app
```

Click it. You should see your landing page. Click **Sign in**, log in with your real account — everything should work because the website is talking to the same Supabase backend.

### Step 8. Set up auto-deploy from GitHub

This is already done. Every time you `git push` to the `main` branch, Vercel automatically builds and deploys. Branches other than `main` get **Preview** deployments (separate URLs you can share before merging).

To verify: make a tiny change locally, commit, push, and watch the Vercel dashboard → Deployments tab. A new deployment should appear within 30 seconds.

### Step 9 (optional) — Custom domain

Vercel's free `*.vercel.app` URL is fine for testing. When you're ready for a real domain:

1. Buy a domain on Namecheap, Cloudflare Registrar, or Porkbun (avoid GoDaddy — overpriced)
2. Vercel project → **Settings → Domains** → enter your domain
3. Vercel shows the DNS records you need to add to your registrar (CNAME or A records)
4. Add them in your registrar's DNS settings, wait 5–60 minutes for propagation
5. Vercel auto-issues a free SSL certificate

Cost: just the domain (~$10–15/year). Hosting stays free.

---

## Part 3 — Update Supabase's allowed redirect URLs

Once your site has a real URL, Supabase needs to know about it so password resets and auth callbacks work.

1. Supabase Dashboard → **Authentication → URL Configuration**
2. **Site URL:** set to your Vercel domain (e.g. `https://closetcore-abc123.vercel.app`)
3. **Redirect URLs:** add both your Vercel domain and `http://localhost:3000` (for local dev)
4. **Save**

---

## Part 4 — Distributing the mobile and desktop apps

Quick reference. None of this is needed to use the app yourself — only when you want users to install it.

### Mobile (iOS + Android)

The Expo Go workflow you've been using is for development only. For real users:

- **Android:** `npx eas build --platform android --profile preview` — produces a sideloadable `.apk`. EAS Build's free tier covers ~30 builds/month.
- **iOS:** Requires an Apple Developer account ($99/year) and a Mac somewhere in the loop. You then `npx eas build --platform ios` and submit via `eas submit`. There's no free alternative — Apple's signing requirements are strict.
- **Play Store / App Store listing:** one-time $25 Google Play registration fee, $99/year Apple. Months of review on Apple, days on Google.

If you just want close friends to install it without going through the stores, the Android `.apk` is the easiest path. iOS users need TestFlight, which still requires the Developer account.

### Desktop (Windows + macOS)

`npm run tauri:build` (in `app/desktop/`) produces:
- Windows: `src-tauri/target/release/bundle/msi/ClosetCore_1.0.0_x64_en-US.msi`
- macOS: a `.dmg` (only if you're on a Mac)

Upload these to a **GitHub Releases** page on your repo (free, unlimited) and link to them from your website's `/download` page. Users click → installer downloads → they double-click to install. No app stores involved.

For Windows code-signing (so SmartScreen doesn't scare users), you'd need a $100–500/year code-signing certificate. Skip this until you're shipping to non-technical users.

### Where users find these

The website's `/download` page is the natural place. You'd update it later to link to:
- `/download/closetcore.msi` (or a GitHub Releases URL)
- App Store and Play Store badges once those are live
- Sideloadable `.apk` if you go that route

---

## Common errors

**Vercel build fails with `Module not found: Can't resolve '@shared/types'`**
The root directory wasn't set to `website/`. Vercel project → **Settings → General** → scroll to **Root Directory** → set to `website` → **Save** → redeploy.

**Site loads but signing in returns "Invalid login"**
Environment variables weren't set or weren't applied to the production environment. Vercel project → **Settings → Environment Variables** → verify both `NEXT_PUBLIC_SUPABASE_*` are listed with the correct values, and the **Production** checkbox is ticked on each. Redeploy after fixing (Vercel doesn't auto-redeploy when env vars change).

**Sign-in works but Supabase emails (password reset, etc.) link to `localhost:3000`**
You didn't update Supabase's Site URL. See Part 3 above.

**`git push` rejects with "non-fast-forward"**
GitHub repo wasn't empty when you tried to push. Usually because you checked the "Initialize with README" box. Run `git pull origin main --rebase` then `git push -u origin main`.

**`.env.local` got committed by accident**
Stop. Don't push. Run:
```powershell
git rm --cached website/.env.local
git commit -m "Remove accidentally committed env file"
```
If you already pushed, **rotate the keys** — the anon key is in your Git history forever. Generate a new anon key in Supabase → Project Settings → API → "Reset anon key", then update `.env.local` and Vercel env vars to match.

**Vercel says "Repository limit exceeded"**
Free Vercel personal accounts allow unlimited projects, but if you've been deploying lots of throwaway repos you might hit a soft limit. Click **Upgrade** isn't necessary — usually just contact Vercel support.

---

## Workflow once everything's set up

```powershell
# Make changes locally
cd "c:/Users/Xavier/Desktop/Closet App"
# ...edit files...

# Push — Vercel auto-deploys
git add .
git commit -m "describe what changed"
git push

# Watch the deploy
# Vercel will email you when it's done, or check the Deployments tab
```

That's it. Every push to `main` is live on your site within ~60 seconds.
