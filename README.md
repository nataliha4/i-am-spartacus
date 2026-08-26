# 💪 I AM SPARTACUS — My Daily Tracker for Health and Activity

A simple, lightweight web app to track daily health and wellness — fasting, supplements, symptoms, weight, food, medical events, and gym activity. Built as a single static page, no backend, no build tools.

**Live app:** https://nataliha4.github.io/i-am-spartacus/

## Features

- **⏳ Fasting** — One-tap Start Fast / Stop Fast on the Dashboard, with a live elapsed-time counter that survives app restarts and overnight fasts. Manual fasting window entry also available.
- **🤒 Symptoms** — Log symptoms with severity (1–5), date, time, and notes
- **🍎 Food** — Quick timestamped notes of what you ate
- **💊 Supplements** — Log ad-hoc supplement intake, plus set up **Recurring Supplements** (Daily or Weekly on a specific day) with a persistent daily checklist on the Dashboard
- **🎯 Weight** — Track weight against a target, with the difference shown automatically
- **🏋️‍♀️ Gym** — Log workouts with time and notes
- **⛑️ Medical** — Doctor visits, blood tests, and other medical events
- **📊 Dashboard** — Today's Summary, a persistent Supplements checklist, and a unified **Day Timeline** showing Supplements, Symptoms, Food, and Gym entries sorted chronologically
- **✏️ Edit & Delete** — Every entry type supports inline editing and deletion
- **📅 Date Navigation** — Review past days or plan ahead
- **💾 Local Storage** — All data stays on your device; nothing is sent anywhere

## No Installation Required

This is a **static web app** — no build tools, no servers, no accounts beyond GitHub.

Just open `index.html` in a browser, or visit the live GitHub Pages URL above.

## How to Deploy Changes

See **`DEPLOYMENT_GUIDE.md`** for step-by-step instructions on editing and redeploying via GitHub Pages.

## File Structure

```
i-am-spartacus/
├── index.html              # The entire app (open this in a browser)
├── .nojekyll                # Required — tells GitHub Pages to skip Jekyll processing
├── package.json             # Project metadata (no actual build step)
├── README.md                 # This file
└── DEPLOYMENT_GUIDE.md       # How to deploy via GitHub Pages
```

## How It Works

- **All code in one HTML file** — React + component code + styles
- **React from CDN** — no build step needed
- **localStorage for persistence** — data saved in your browser
- **Responsive design** — built mobile-first

## Possible Future Additions

- Cloud backup / multi-device sync
- Export to CSV
- Charts and trend analytics over time
- Browser push notifications for supplement reminders

## Questions?

Reply in the chat thread if you need help with deployment or want to customize anything.

---

**Built with React 18 (via CDN) + localStorage + GitHub Pages.**
