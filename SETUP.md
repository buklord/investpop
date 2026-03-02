# Kartomtrades — Setup & Deployment Guide

---

## 🟢 PREVIEW AT PORT 3000 — Run this ONE command:

```bash
git pull origin copilot/add-live-trade-monitor && npm run dev
```

> Then open the **PORTS** tab → click the link next to port **3000**.  
> Wait for `✓ Ready on http://localhost:3000` before opening.

---

## 🔴 FIX: "Internal Server Error" on login

This error is almost always caused by one of two things:

### Cause A — `DATABASE_URL` has a special character in the password (most common)

If your Supabase password contains `@`, `#`, `%`, `?`, or `&`, you **must** percent-encode them in the URL — otherwise the URL parser treats them as URL separators.

| Character | Replace with |
|-----------|-------------|
| `@` | `%40` |
| `#` | `%23` |
| `%` | `%25` |

**Example:** If your password is `Allnations@1128`:
```
DATABASE_URL="postgresql://postgres:Allnations%401128@db.<ref>.supabase.co:5432/postgres"
```

> ✅ `DIRECT_URL` is **no longer required** — only `DATABASE_URL` is needed.

### Cause B — Prisma client hasn't been generated

Run this in your Codespace terminal:

```bash
npm install
```

> The `postinstall` script automatically runs `prisma generate` when you install dependencies.

### After fixing — restart the server

```bash
npm run dev
```

---

## ▶️ FULL RESET (if you have errors or old code):

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

Vercel gives you a free public URL (e.g. `kartomtrades.vercel.app`) that anyone can visit — no Codespaces required.

### Step 1 — Merge this branch first
In GitHub, open the Pull Request for `copilot/add-live-trade-monitor` and click **Merge**. This puts all your code onto `main`.

### Step 2 — Create a Vercel account
Go to **[vercel.com](https://vercel.com)** and sign up with your GitHub account (free).

### Step 3 — Import your repository
1. Click **"Add New… → Project"**
2. Select your GitHub repository (e.g. `buklord/<your-repo>`)
3. Vercel auto-detects **Next.js** — click **Deploy**

### Step 4 — Add Environment Variables
Before the first deploy succeeds you must add these in Vercel → Project → **Settings → Environment Variables**:

| Variable | Where to get it |
|---|---|
| `DATABASE_URL` | Supabase → Project → Settings → Database → **Transaction pooler** connection string |
| `SESSION_SECRET` | Any random string (32+ chars). E.g. `inv3st_s3cr3t_2025_rand0m_xyz` |
| `NEXT_PUBLIC_BASE_URL` | Your Vercel URL, e.g. `https://kartomtrades.vercel.app` |
| `NEXT_PUBLIC_TAWK_SRC` | `https://embed.tawk.to/6998b1189d60291c30385ff5/1jhu77ivk` (already configured — just paste this) |
| `RESEND_API_KEY` | Resend → API Keys (optional; enables email notifications) |
| `EMAIL_FROM` | Verified sender, e.g. `noreply@yourdomain.com` (optional; enables email notifications) |

> 💡 `DIRECT_URL` is **no longer required** — only `DATABASE_URL` is needed.

### Step 5 — Redeploy
After adding the env vars, click **Redeploy** → wait ~2 min → your live URL appears at the top of the Vercel dashboard.

### Step 6 — Become Admin on the live site
Run this in your **Supabase SQL Editor** (replacing the email with the one you sign up with on the live site):
```sql
UPDATE users SET role = 'ADMIN' WHERE email = 'your@email.com';
```

---

## 💬 Tawk.to Live Chat Setup (rings your phone when users click "Live Support")

### ✅ Already configured — just add to your `.env`

Your Tawk.to property is already set up. You just need to paste the URL into your environment.

### Step 1 — Add to your Codespace `.env` (for local preview at port 3000)

Open your `.env` file in the Codespace and add (or confirm it already has):
```
NEXT_PUBLIC_TAWK_SRC=https://embed.tawk.to/6998b1189d60291c30385ff5/1jhu77ivk
```

Then restart the dev server:
```bash
npm run dev
```

### Step 2 — Add to Vercel Environment Variables (for the live site)

In Vercel → Project → Settings → Environment Variables, add:
- **Key**: `NEXT_PUBLIC_TAWK_SRC`
- **Value**: `https://embed.tawk.to/6998b1189d60291c30385ff5/1jhu77ivk`

Click **Save** then **Redeploy**.

### Step 3 — Verify it works

1. Open the site in your browser
2. Press **F12** → Console — you should see no errors
3. Click the **"💬 Live Support"** button (bottom-right) — the Tawk.to chat window should open
4. On your phone, open the Tawk.to app — you'll get a push notification

### What it does
- The Tawk.to chat widget loads silently on **every page** (the default bubble is **hidden** — only your custom "Live Support" button opens it)
- When a user logs in, their **name and email are automatically sent** to Tawk.to so you know who is chatting
- Install the Tawk.to mobile app — you will receive a push notification whenever a visitor clicks the button

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
| "Internal Server Error" on login | (1) Check `DATABASE_URL` in `.env` — encode special chars: `@` → `%40`. (2) Run `npm install` to regenerate Prisma client. (3) Restart: `npm run dev` |
| "Database not configured" error | `DATABASE_URL` is not set in `.env` — add it and restart. `DIRECT_URL` is no longer needed. |
| Dashes (—) instead of prices | Expected if API credits exhausted — the platform auto-switches to **Simulated Market** mode (prices still move!) |
| `✓ Compiled successfully` then server is down | Stage 1 only — keep waiting for `✓ Ready` |
| `Could not find a production build` | Run `npm run build && npm start` and wait for `✓ Ready` |
| 502 after server started | PORTS tab → port 3000 → **Public** |
| `divergent branches` on git pull | Use `git reset --hard` (the commands above already do this) |
| Port 3000 already in use | Run `fuser -k 3000/tcp 2>/dev/null; true` first |
