# InvestPop — How to Start the Server

## 🆕 New changes not showing? Pick ONE command:

Open a terminal in your Codespace and paste **one** of these options:

### Option A — Fast (dev mode, hot reload, no rebuild needed):
```bash
fuser -k 3000/tcp 2>/dev/null; true && rm -f package-lock.json && git fetch origin && git reset --hard origin/copilot/fix-sidebar-and-add-platform-features && npm run dev
```
Server is ready in **~30 seconds**. Wait for: ` ✓ Ready on http://localhost:3000`

### Option B — Stable (production mode, uses less memory):
```bash
fuser -k 3000/tcp 2>/dev/null; true && rm -f package-lock.json && git fetch origin && git reset --hard origin/copilot/fix-sidebar-and-add-platform-features && npm run preview
```
Takes **2–3 minutes** to build. Wait for: ` ✓ Ready on http://0.0.0.0:3000`

> **Use Option A** for development/testing (faster iteration).  
> **Use Option B** if the Codespace crashes/OOMs with dev mode.

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

1. Log in → click **Settings** in the sidebar
2. Scroll to **"Claim Admin Access"** → click the button
3. The **Admin** link appears in the sidebar immediately

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
