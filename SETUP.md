# InvestPop — Codespaces Quick Start

## ❓ Why does the server keep crashing and restarting?

**Root cause:** Next.js **dev mode** uses 2GB+ RAM to compile 700+ modules on every request.
The free GitHub Codespaces tier doesn't have enough memory → the process is killed by the OS → it
restarts → gets killed again → infinite crash loop.

**The fix:** Run in **production mode** instead (`next build` once, then `next start`).
Production mode uses only ~400MB and stays stable indefinitely.

---

## ✅ One-time fix for your current session

Run this in the Codespaces terminal (takes ~2 minutes to build):

```bash
rm -f package-lock.json && git pull && npm run preview &
```

Then open/refresh: **https://probable-space-carnival-567p45pxx4xh77v-3000.app.github.dev/dashboard**

> After the build finishes you'll see `✓ Ready` — then the page will load instantly.

---

## First-time setup (new Codespace)

The Codespace auto-runs `npm install` and `npm run preview` when it starts.
`npm run preview` = build once (~2 min) then start the stable production server.
No terminal needed — just wait for `✓ Ready` and open the URL.

---

## After pulling new code changes

Production mode does **not** hot-reload. After a `git pull` you must rebuild:

```bash
git pull && npm run preview &
```

The build takes ~2 minutes then the server comes back up automatically.

---

## Manual server commands

| What | Command |
|------|---------|
| **Build + start (recommended)** | `npm run preview &` |
| Start already-built server only | `npm start &` |
| Dev mode (hot-reload, unstable on free tier) | `npm run dev` |
| Kill stuck port | `fuser -k 3000/tcp 2>/dev/null; true` |
| Full clean restart | `fuser -k 3000/tcp 2>/dev/null; true && npm run preview &` |

---

## Getting latest code

```bash
cd /workspaces/investpop
git fetch origin
git checkout copilot/fix-sidebar-and-add-platform-features
git pull
npm run preview &
```

---

## Become Admin

1. Log in → click **Settings** in the sidebar
2. Scroll to **"Claim Admin Access"** → click the button
3. The **Admin** link appears in the sidebar immediately

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| **Server keeps restarting** | You're in dev mode — run `npm run preview &` instead |
| **502 Bad Gateway** | Server isn't running. Run: `npm run preview &` |
| `command not found` | Run `cd /workspaces/investpop` first |
| Page looks old | Hard-refresh: **Ctrl+Shift+R** (Windows) or **Cmd+Shift+R** (Mac) |
| Port 3000 in use | `fuser -k 3000/tcp 2>/dev/null; true` then `npm run preview &` |

