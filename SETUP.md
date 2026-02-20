# InvestPop — How to Start the Server

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

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Dashes (—) instead of prices | Expected if API credits exhausted — the platform auto-switches to **Simulated Market** mode (prices still move!) |
| `✓ Compiled successfully` then server is down | Stage 1 only — keep waiting for `✓ Ready` |
| `Could not find a production build` | Run `npm run build && npm start` and wait for `✓ Ready` |
| 502 after server started | PORTS tab → port 3000 → **Public** |
| `divergent branches` on git pull | Use `git reset --hard` (the commands above already do this) |
| Port 3000 already in use | Run `fuser -k 3000/tcp 2>/dev/null; true` first |
