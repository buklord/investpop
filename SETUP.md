# InvestPop — Codespaces Quick Start

## 🚦 What to watch for when starting the server

`npm run build && npm start` goes through **three stages**. You must wait for **Stage 3** before opening the browser:

| Stage | What you see in the terminal | Is it done? |
|-------|------------------------------|-------------|
| **Stage 1 — Compiling** | `✓ Compiled successfully` | ❌ **NO — DO NOT press Ctrl+C here.** Build is still running. |
| **Stage 2 — Generating pages** | `Generating static pages (11/11)` then a route table listing `/`, `/dashboard`, etc. | ❌ **Still building.** |
| **Stage 3 — Server ready** ✅ | `✓ Ready on http://0.0.0.0:3000` | ✅ **YES — open the browser now.** |

> ⚠️ **`✓ Compiled successfully` is NOT the end of the build.**
> The build continues after that line for another 30–60 seconds. If you press Ctrl+C here, the `.next` folder will be incomplete and `npm start` will fail with "Could not find a production build."

**Full sequence in the terminal (wait for all of this):**
```
  ▲ Next.js 14.2.3
   Creating an optimized production build ...
 ✓ Compiled successfully          ← NOT done yet, keep waiting
 ✓ Linting and checking validity of types
   Generating static pages (11/11)
 ✓ Build complete                 ← Build is truly done, npm start runs next

  ▲ Next.js 14.2.3
  - Local:   http://localhost:3000
 ✓ Ready on http://0.0.0.0:3000  ← NOW open the browser
```

---

## ❓ Why is the page showing 502 / "not working"?

The **most common causes and fixes**:

### Cause 1 — Two servers fighting for port 3000 (most common)
When you ran `npm run preview &` in the terminal while the Codespace had already started a server,
two processes tried to bind to port 3000. Only one wins — the other causes 502.

**Fix:** Kill everything, then build and start once:
```bash
fuser -k 3000/tcp 2>/dev/null; true && npm run build && npm start &
```
Wait ~2 minutes for the build, then refresh the browser.

### Cause 2 — Port is set to "Private" in Codespaces
GitHub Codespaces ports default to **Private**, meaning only you can access them — but only when logged into GitHub in the same browser session.

**Fix:** In VS Code (Codespaces), click the **PORTS** tab at the bottom panel.
Find port **3000** → right-click → **Port Visibility** → **Public**.
Then refresh the browser.

### Cause 3 — Build was interrupted (Ctrl+C too early)
`✓ Compiled successfully` appears **midway** through `next build` — the build is NOT finished at that point.
If you pressed Ctrl+C after seeing that line, the `.next` folder is incomplete and `npm start` will fail with
`"Could not find a production build"`.

**Fix — you must rebuild from scratch:**
```bash
fuser -k 3000/tcp 2>/dev/null; true && npm run build && npm start &
```
Let it run all the way until you see **`✓ Ready on http://0.0.0.0:3000`** — do not press Ctrl+C.

---

## ✅ Complete reset — start fresh (copy-paste this)

Run this block in the Codespaces terminal:

```bash
fuser -k 3000/tcp 2>/dev/null; true
rm -f package-lock.json
git fetch origin
git reset --hard origin/copilot/fix-sidebar-and-add-platform-features
npm run build && npm start &
```

> `git reset --hard` **wipes the `.next` build folder**, so you must run `npm run build` first.
> Build takes ~2 minutes. Wait for `✓ Ready on http://0.0.0.0:3000`, then open the browser.
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
| **Build then start** | `npm run build && npm start &` |
| **Start (only if `.next` exists from previous build)** | `npm start &` |
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
| **502 Bad Gateway** | Run: `fuser -k 3000/tcp 2>/dev/null; true && npm run build && npm start &` |
| **"Could not find a production build"** | You pressed Ctrl+C too early. Run `npm run build && npm start &` and wait for `✓ Ready` |
| **Page loads but shows old version** | You need to rebuild: `npm run build && npm start &` |
| **Server keeps restarting/crashing** | Don't use `dev` mode — use `npm start` |
| `command not found: npm` | Run `cd /workspaces/investpop` first |
| **`divergent branches`** / git pull error | Use `git reset --hard` (see above) |
| Port 3000 already in use | `fuser -k 3000/tcp 2>/dev/null; true` then `npm run build && npm start &` |
| **Still 502 after server started** | Check PORTS panel → set port 3000 to **Public** |