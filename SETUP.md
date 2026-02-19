# InvestPop — Codespaces Quick Start

## ❓ Why is the page showing 502 / "not working"?

The **most common causes and fixes**:

### Cause 1 — Two servers fighting for port 3000 (most common)
When you ran `npm run preview &` in the terminal while the Codespace had already started a server,
two processes tried to bind to port 3000. Only one wins — the other causes 502.

**Fix:** Kill everything, then start once:
```bash
fuser -k 3000/tcp 2>/dev/null; true && npm start &
```
Wait 5 seconds, then refresh the browser.

### Cause 2 — Port is set to "Private" in Codespaces
GitHub Codespaces ports default to **Private**, meaning only you can access them — but only when logged into GitHub in the same browser session.

**Fix:** In VS Code (Codespaces), click the **PORTS** tab at the bottom panel.
Find port **3000** → right-click → **Port Visibility** → **Public**.
Then refresh the browser.

### Cause 3 — Server hasn't started yet
If you just ran `npm run build` (which says "Compiled successfully"), the **build** is done but the
**server** hasn't started. The build only creates files — you need to start the server separately.

**Fix:**
```bash
npm start &
```
Wait for `✓ Ready on http://0.0.0.0:3000`, then open the browser.

---

## ✅ Complete reset — start fresh (copy-paste this)

Run this block in the Codespaces terminal:

```bash
fuser -k 3000/tcp 2>/dev/null; true
rm -f package-lock.json
git fetch origin
git reset --hard origin/copilot/fix-sidebar-and-add-platform-features
npm start &
```

> `npm start` works because the code is **already built**. No 2-minute wait.
> You'll see `✓ Ready on http://0.0.0.0:3000` within 5 seconds.
> Then open: **https://probable-space-carnival-567p45pxx4xh77v-3000.app.github.dev/dashboard**

> **Use `git reset --hard` instead of `git pull`** — it avoids all "divergent branches" / merge conflicts by always setting your local code to exactly match GitHub.

---

## After pulling new code changes (full rebuild needed)

Production mode does **not** hot-reload. After code updates you must rebuild:

```bash
fuser -k 3000/tcp 2>/dev/null; true
rm -f package-lock.json
git fetch origin
git reset --hard origin/copilot/fix-sidebar-and-add-platform-features
npm run build && npm start &
```

Build takes ~2 minutes. Wait for `✓ Ready` then open the browser.

---

## Manual server commands

| What | Command |
|------|---------|
| **Start (code already built)** | `npm start &` |
| **Build then start** | `npm run build && npm start &` |
| Kill stuck port 3000 | `fuser -k 3000/tcp 2>/dev/null; true` |
| Dev mode (hot-reload, may be unstable) | `npm run dev` |

---

## Become Admin

1. Log in → click **Settings** in the sidebar
2. Scroll to **"Claim Admin Access"** → click the button
3. The **Admin** link appears in the sidebar immediately

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| **502 Bad Gateway** | Run: `fuser -k 3000/tcp 2>/dev/null; true && npm start &` |
| **Page loads but shows old version** | You need to rebuild: `npm run build && npm start &` |
| **Server keeps restarting/crashing** | Don't use `dev` mode — use `npm start` |
| `command not found: npm` | Run `cd /workspaces/investpop` first |
| **`divergent branches`** / git pull error | Use `git reset --hard` (see above) |
| Port 3000 already in use | `fuser -k 3000/tcp 2>/dev/null; true` then `npm start &` |
| **Still 502 after server started** | Check PORTS panel → set port 3000 to **Public** |