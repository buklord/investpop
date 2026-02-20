# InvestPop — Setup & Deployment Guide

## ▶️ START HERE — Copy this into your Codespaces terminal:

```bash
fuser -k 3000/tcp 2>/dev/null; true && rm -f package-lock.json && git fetch origin && git reset --hard origin/copilot/add-live-trade-monitor && npm run dev
```

⏳ Wait **~30 seconds** for this line, then open the browser:
```
 ✓ Ready on http://localhost:3000
```

---

## Alternative: Stable production mode (if dev crashes with out-of-memory):

```bash
fuser -k 3000/tcp 2>/dev/null; true && rm -f package-lock.json && git fetch origin && git reset --hard origin/copilot/add-live-trade-monitor && npm run preview
```

⏳ Takes **2–3 minutes** to build. Wait for:
```
 ✓ Ready on http://0.0.0.0:3000
```

---

## ⏳ Wait for `✓ Ready` before opening the browser

> ⚠️ `✓ Compiled successfully` is **NOT** the end — that is stage 1 of 3 (production build only).
> Wait for `✓ Ready on http://...3000`.

Then open: **https://probable-space-carnival-567p45pxx4xh77v-3000.app.github.dev/dashboard**

---

## If the page shows 502 after `✓ Ready`

Click the **PORTS** tab at the bottom of VS Code → right-click port **3000** → **Port Visibility** → **Public**. Then refresh the browser.

---

## Become Admin

The "Claim Admin Access" button has been removed for security. To grant yourself Admin access, run this SQL query in your **Supabase SQL Editor**:

```sql
UPDATE users SET role = 'ADMIN' WHERE email = 'your@email.com';
```

Replace `your@email.com` with your account email. After running it, log out and log back in — the **Admin** link will appear in the sidebar.

---

## 🚀 Deploy to Vercel (Go Live — Public URL)

Vercel gives you a free public URL (e.g. `investpop.vercel.app`) that anyone can visit — no Codespaces required.

### Step 1 — Merge this branch first
In GitHub, open the Pull Request for `copilot/add-live-trade-monitor` and click **Merge**. This puts all your code onto `main`.

### Step 2 — Create a Vercel account
Go to **[vercel.com](https://vercel.com)** and sign up with your GitHub account (free).

### Step 3 — Import your repository
1. Click **"Add New… → Project"**
2. Select the `ay4real5/investpop` repository
3. Vercel auto-detects **Next.js** — click **Deploy**

### Step 4 — Add Environment Variables
Before the first deploy succeeds you must add these in Vercel → Project → **Settings → Environment Variables**:

| Variable | Where to get it |
|---|---|
| `DATABASE_URL` | Supabase → Project → Settings → Database → **Transaction pooler** connection string |
| `DIRECT_URL` | Supabase → Project → Settings → Database → **Session pooler** (or direct) connection string |
| `SESSION_SECRET` | Any random string (32+ chars). E.g. `inv3st_s3cr3t_2025_rand0m_xyz` |
| `NEXT_PUBLIC_BASE_URL` | Your Vercel URL, e.g. `https://investpop.vercel.app` |
| `TWELVE_DATA_API_KEY` | [twelvedata.com/account/api-keys](https://twelvedata.com/account/api-keys) (optional — platform simulates prices if missing) |

> 💡 Copy `.env.example` in the repo for the full list of variable names.

### Step 5 — Redeploy
After adding the env vars, click **Redeploy** → wait ~2 min → your live URL appears at the top of the Vercel dashboard.

### Step 6 — Become Admin on the live site
Run this in your **Supabase SQL Editor** (replacing the email with the one you sign up with on the live site):
```sql
UPDATE users SET role = 'ADMIN' WHERE email = 'your@email.com';
```

---

## ⚠️ Security Notice — Rotate Your Credentials

If you received a warning that credentials were found in git history, **immediately** rotate:
- **Supabase database password**: Supabase → Project → Settings → Database → **Reset password**
- **Twelve Data API key**: [twelvedata.com/account/api-keys](https://twelvedata.com/account/api-keys) → Regenerate

Your `.env` file is now in `.gitignore` and will **never be committed again**.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Dashes (—) instead of prices | Expected if API credits exhausted — the platform auto-switches to **Simulated Market** mode (prices still move!) |
| `✓ Compiled successfully` then server is down | Stage 1 only — keep waiting for `✓ Ready` |
| `Could not find a production build` | Run `npm run build && npm start` and wait for `✓ Ready` |
| 502 after server started | PORTS tab → port 3000 → **Public** |
| `divergent branches` on git pull | Use `git reset --hard` (the commands above already do this) |
| Port 3000 already in use | Run `fuser -k 3000/tcp 2>/dev/null; true` first |
