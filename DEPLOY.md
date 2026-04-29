# JobScout — Deploy Guide
Estimated time: ~20 minutes

---

## Step 1 — Create Supabase project

1. Go to https://supabase.com → New project
2. Name it `jobscout` · choose a region close to you · set a DB password
3. Wait ~2 minutes for it to provision
4. Go to **SQL Editor** → paste the entire contents of `supabase-schema.sql` → click **Run**
5. Go to **Settings → API** and copy:
   - `Project URL` → this is your `VITE_SUPABASE_URL`
   - `anon public` key → this is your `VITE_SUPABASE_ANON_KEY`

---

## Step 2 — Push to GitHub

```bash
cd jobscout
git init
git add .
git commit -m "init: JobScout"
```

Create a new **private** repo on GitHub (https://github.com/new), then:

```bash
git remote add origin https://github.com/YOUR_USERNAME/jobscout.git
git push -u origin main
```

---

## Step 3 — Get Anthropic API key

1. Go to https://console.anthropic.com → API Keys → Create key
2. Copy it — you'll need it in the next step

---

## Step 4 — Deploy to Vercel

1. Go to https://vercel.com → Add New Project → Import your `jobscout` GitHub repo
2. Framework preset: **Vite** (Vercel will detect this automatically)
3. Under **Environment Variables**, add all three:

| Name | Value |
|------|-------|
| `VITE_SUPABASE_URL` | your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | your Supabase anon key |
| `ANTHROPIC_API_KEY` | your Anthropic API key |

4. Click **Deploy** — done in ~60 seconds
5. Vercel gives you a URL like `jobscout-xyz.vercel.app` — that's your app

---

## Step 5 — Verify it works

1. Open your Vercel URL
2. Go to **Resume** tab → paste your resume → save
3. Go to **Listings** tab → click **Add listing** → paste a LinkedIn or Indeed URL
4. If the URL is blocked (LinkedIn often is), see the workaround below
5. Once you have 3+ listings rated, go to **Gap Analysis** → Run analysis

---

## LinkedIn workaround

LinkedIn blocks automated fetches. Two options:

**Option A (easiest):** Use Indeed, Greenhouse, Lever, or Workday URLs instead — these work great.

**Option B:** For LinkedIn specifically, open the job, select all text on the page (Cmd+A), copy it, and paste it as a URL-less listing. A future update will add a "paste text" fallback mode.

---

## Local development

```bash
cp .env.example .env
# Fill in your values in .env

npm install
npm run dev
```

App runs at http://localhost:5173
API functions need Vercel CLI for local testing:

```bash
npm install -g vercel
vercel dev
```

---

## Updating

Any push to `main` on GitHub auto-deploys via Vercel. No manual steps needed.

```bash
git add .
git commit -m "your message"
git push
```
