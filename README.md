# I AM SPARTACUS | Daily Tracker App

A simple, lightweight web app to track your daily health and wellness — fasting, supplements, symptoms, weight, food, medical events, and gym activity.

## Features

✅ **Fasting Tracker** — Log 16-hour fasting windows, see progress toward your goal  
✅ **Supplements** — Track supplements with times and notes  
✅ **Symptoms** — Log symptoms with severity levels (1-5)  
✅ **Weight** — Track weight and target weight  
✅ **Food** — Simple timestamped notes of what you eat  
✅ **Medical Events** — Doctor visits, blood tests, etc.  
✅ **Gym Activity** — Log workouts at your gym  
✅ **Dashboard** — See today's summary at a glance  
✅ **Date Navigation** — Review past days or plan ahead  
✅ **Local Storage** — All data stays on your device (no cloud yet)  

## No Installation Required

This is a **static web app** — no build tools, no servers, no complex setup needed.

Just open `index.html` in your browser, or deploy it to Netlify (see `DEPLOYMENT_GUIDE.md`).

## How to Deploy

See **`DEPLOYMENT_GUIDE.md`** for step-by-step instructions to:
1. Push the code to GitHub (using GitHub's web interface)
2. Deploy to Netlify (one click)
3. Access your app on your phone

The whole process takes ~10 minutes.

## File Structure

```
daily-tracker-app/
├── index.html              # The app (open this in a browser)
├── package.json            # Project metadata (for Netlify)
├── README.md               # This file
└── DEPLOYMENT_GUIDE.md     # How to deploy to Netlify
```

## How It Works

- **All code in one HTML file** — React + component code + styles
- **React from CDN** — no build step needed
- **localStorage for persistence** — data saved in your browser
- **Responsive design** — works great on phone, tablet, desktop

## For Later (Iteration 2)

Once you've used it for a while and decide you like it, we can add:
- Cloud backup (Firebase, Supabase, or similar)
- Export to CSV
- Analytics and charts
- Multi-device sync
- Notifications/reminders

## Questions?

Reply to the chat thread if you need help with deployment or want to customize anything.

---

**Built with React 18 + local storage + Netlify.**
