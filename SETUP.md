# InvestPop — How to Start the Server

## 🆕 New changes not showing? Run this ONE command:

Open a terminal in your Codespace and paste this — it pulls the latest code AND rebuilds:

```bash
fuser -k 3000/tcp 2>/dev/null; true && rm -f package-lock.json && git fetch origin && git reset --hard origin/copilot/fix-sidebar-and-add-platform-features && npm run preview
```

**Do NOT add `&` at the end. Let it run in the foreground.**

## ⏳ Wait for This Exact Line

The build takes **2–3 minutes**. You will see many lines of output.

**Only open the browser when you see:**

```
 ✓ Ready on http://0.0.0.0:3000
```

> ⚠️ `✓ Compiled successfully` is **NOT** the end — that is stage 1 of 3.
> Wait for `✓ Ready`.

---

## What each stage looks like

```
  ▲ Next.js 14.2.3
   Creating an optimized production build ...
 ✓ Compiled successfully          ← ❌ NOT done. Keep waiting.
 ✓ Linting and checking validity
   Generating static pages (11/11)
 ✓ Build complete.

  ▲ Next.js 14.2.3
  - Local:   http://localhost:3000
 ✓ Ready on http://0.0.0.0:3000  ← ✅ NOW open the browser
```

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
| `✓ Compiled successfully` then server is down | That's stage 1 only — keep waiting for `✓ Ready` |
| `Could not find a production build` | Run `npm run build && npm start` and wait for `✓ Ready` |
| 502 after server started | PORTS tab → port 3000 → **Public** |
| `divergent branches` on git pull | Use `git reset --hard` (the command above already does this) |
| Port 3000 already in use | Run `fuser -k 3000/tcp 2>/dev/null; true` first |
