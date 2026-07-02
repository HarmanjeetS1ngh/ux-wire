# UX Wire

A self-updating daily digest of UX/UI design news, tools, and research —
free to run, hosted on Vercel, fed by a GitHub Action once a day.

**New here? Start with [SETUP_GUIDE.md](./SETUP_GUIDE.md)** — a full
click-by-click walkthrough, no prior GitHub/Vercel experience assumed.

## What's in this repo

- `app/` — the Next.js site (`Feed.jsx` is the whole UI)
- `scripts/fetch-feeds.mjs` — pulls, tags, scores, and archives new items
- `data/digest.json` — the archive itself (edited only by the script)
- `.github/workflows/fetch-daily.yml` — runs the script every day for free

## Local development (optional)

```bash
npm install
npm run fetch   # pulls today's items into data/digest.json
npm run dev     # runs the site at localhost:3000
```
