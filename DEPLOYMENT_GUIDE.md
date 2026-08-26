# I AM SPARTACUS — Deployment Guide

Your tracking app is a single static `index.html` file, deployed via **GitHub Pages**.

## How It's Deployed

1. **Code lives in GitHub** — repo: `nataliha4/i-am-spartacus`
2. **GitHub Pages serves it directly** — no build step, no separate hosting account
3. **Live URL:** `https://nataliha4.github.io/i-am-spartacus/`

---

## Making Changes

1. Get the updated `index.html` (or other file) from this chat
2. Go to your repo on GitHub → click the file → pencil icon (edit)
3. Replace the content with the new version
4. Scroll down, add a short commit message, click **Commit changes**
5. GitHub Pages automatically rebuilds and redeploys — usually live within 30–60 seconds

You can check deployment status anytime under the repo's **Actions** tab — look for the **"pages build and deployment"** workflow. A green checkmark means it's live; a red X means something went wrong (click in to see the error).

---

## Key Files

- **`index.html`** — the entire app (HTML + React via CDN + all your tracking logic)
- **`.nojekyll`** — an empty file in the repo root that tells GitHub Pages to skip Jekyll processing. This is required because Jekyll's templating engine misinterprets the `{{ }}` syntax used throughout the app's JSX code. **Don't delete this file.**
- **`README.md`** — project overview
- **`package.json`** — metadata only; there's no actual build process

---

## Important Notes

### ✅ Your Data is Private
- Everything is stored **on your device only**, in the browser's local storage
- No cloud syncing — if you clear your browser data, your tracked entries will be lost
- Works across browser sessions and phone restarts, as long as you don't clear site data

### ✅ Works Offline
- Once loaded, the app works without an internet connection
- Bookmark the URL and revisit anytime

### ✅ Free, No Limits
- GitHub Pages is completely free for a project like this — no credits, no usage caps, no plan to hit

---

## Troubleshooting

**"My change isn't showing up"**
- Check the **Actions** tab — the deploy may still be running, or may have failed
- Hard refresh your browser (`Ctrl+Shift+R` / `Cmd+Shift+R`) or fully close and reopen the tab on phone
- GitHub occasionally has platform-wide incidents — check [githubstatus.com](https://www.githubstatus.com/) if deploys seem stuck for an unusually long time

**"The deploy failed"**
- Click into the failed run under **Actions** to see the specific error
- If it says "Startup failure" with a generic message pointing to githubstatus.com, that's usually a transient GitHub-side issue — try **Re-run all jobs**

**"I lost my data"**
- Local storage is tied to your specific browser. Clearing browsing data, switching browsers, or switching devices will not carry your data over
- There's currently no cloud backup — this is a possible future improvement if you want it

---

## History

This app was originally deployed on **Netlify**, then migrated to **GitHub Pages** after hitting Netlify's free-tier credit limit. Both are static hosts and either would work technically — GitHub Pages was chosen since it needs no separate account and has no usage-based limits for a project this size.

---

## Questions?

Just ask in the chat — happy to help troubleshoot or make further changes.
