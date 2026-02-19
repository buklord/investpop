# InvestPop — Codespaces Quick Start

## ❓ Do I have to restart the server every time?

**No — not for normal use.**

The `.devcontainer` config runs `npm run dev:forever` automatically every time your Codespace starts or wakes up.
It also auto-restarts the server within **3 seconds** if it ever crashes.

> **One-time fix for your current session** (only needed once):
> Run this in the terminal, then you never have to do it again:
> ```
> rm -f package-lock.json && git pull && npm run dev:forever &
> ```
> Then open/refresh: **https://probable-space-carnival-567p45pxx4xh77v-3000.app.github.dev/dashboard**

---

## First-time setup (new Codespace)

The Codespace auto-runs `npm install` and `npm run dev:forever` when it starts.
You just wait ~30 seconds and open the URL. No terminal needed.

---

## After pulling new code changes

Next.js has **Hot Module Reload (HMR)** — when you save a file, the browser updates automatically.

If you used `git pull` to get new code, the server restarts itself. Just refresh the browser.

---

## Manual server commands (if ever needed)

| What | Command |
|------|---------|
| Start server (auto-restart on crash) | `npm run dev:forever` |
| Start server (single run) | `npm run dev` |
| Stop server | Press **Ctrl + C** |
| Kill stuck port | `fuser -k 3000/tcp 2>/dev/null; true` |

---

## Getting latest code

```bash
cd /workspaces/investpop
git fetch origin
git checkout copilot/fix-sidebar-and-add-platform-features
git pull
```

The running server reloads automatically — no restart needed.

---

## Become Admin

1. Log in → click **Settings** in the sidebar
2. Scroll to **"Claim Admin Access"** → click the button
3. The **Admin** link appears in the sidebar immediately

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| **502 Bad Gateway** | Server isn't running. Run: `npm run dev:forever &` |
| `command not found: git` | Run `cd /workspaces/investpop` first |
| Page looks old | Hard-refresh: **Ctrl+Shift+R** (Windows) or **Cmd+Shift+R** (Mac) |
| Port 3000 in use | `fuser -k 3000/tcp 2>/dev/null; true` then `npm run dev:forever &` |

