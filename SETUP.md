# How to preview the new features in Codespaces

## Step-by-step: copy each line, paste into the Codespaces terminal, press Enter

### 1. Open a Codespaces terminal
Press **Ctrl + `** (backtick) to open the terminal if it isn't open.

---

### 2. Go to the repo folder
```
cd /workspaces/investpop
```

---

### 3. Get the new code
```
git fetch origin
```
```
git checkout copilot/fix-sidebar-and-add-platform-features
```

---

### 4. Stop the running server
Press **Ctrl + C** in the terminal that is running `yarn dev` (or `npm run dev`).

If you can't find it, run this to kill it:
```
kill $(lsof -t -i:3000) 2>/dev/null; true
```

---

### 5. Start a fresh server
```
npm run dev
```

---

### 6. Open the preview
Reload **https://probable-space-carnival-567p45pxx4xh77v-3000.app.github.dev/dashboard**

You should now see the new 7-link sidebar with: Dashboard, Markets, Portfolio, Wallet, History, Settings.

---

### 7. Become Admin
Go to **Settings** page → click **"Claim Admin Access"** → the Admin link appears in the sidebar.

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| `command not found: yarn` | Use `npm run dev` instead |
| `command not found: git` | You are not in the repo folder. Run `cd /workspaces/investpop` first |
| Page still looks old | Hard-refresh the browser: **Ctrl+Shift+R** (or Cmd+Shift+R on Mac) |
| Port 3000 already in use | Run `kill $(lsof -t -i:3000) 2>/dev/null; true` then `npm run dev` again |
