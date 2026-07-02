# UX Wire — setup guide

This turns into a website that updates itself every day with UX/UI design news,
tools, and research — no coding required after setup. It's built from three
free services: **GitHub** (stores the code + runs the daily fetch),
**Vercel** (hosts the website), and nothing else. No API keys, no paid plans.

Total setup time: about 15 minutes, once.

---

## Part 1 — Put the code on GitHub

1. Go to [github.com](https://github.com) and create a free account, if you don't have one.
2. Click the **+** icon (top right) → **New repository**.
3. Name it `ux-wire` (or anything you like). Leave it **Public**. Don't check
   any of the "initialize with" boxes. Click **Create repository**.
4. You'll land on an empty repo page. Click the link that says
   **uploading an existing file**.
5. Unzip the file I gave you on your computer. Drag the **entire contents**
   of the unzipped folder (not the folder itself — the files and folders
   *inside* it: `app`, `data`, `scripts`, `.github`, `package.json`, etc.)
   into the upload box.
6. Scroll down, click **Commit changes**.

Your code is now on GitHub.

---

## Part 2 — Let the daily fetch save its own updates

By default, GitHub doesn't let automated jobs push changes back to your repo.
Turn that on:

1. In your repo, click **Settings** (top menu).
2. In the left sidebar, click **Actions** → **General**.
3. Scroll to **Workflow permissions**.
4. Select **Read and write permissions**.
5. Click **Save**.

---

## Part 3 — Run the first fetch manually

Normally this happens automatically every day, but let's populate it once now
so the site isn't empty when you deploy it.

1. Click the **Actions** tab (top menu).
2. If prompted, click **I understand my workflows, go ahead and enable them**.
3. Click **Daily fetch** in the left sidebar.
4. Click **Run workflow** (right side) → **Run workflow** (green button).
5. Wait about a minute, then refresh the page. You should see a green
   checkmark — that means it worked and `data/digest.json` now has today's
   articles in it.

If it fails (red ✕), click into it to see which source errored — it's safe
to ignore occasional single-source failures (some sites rate-limit
automated requests sometimes); the script skips those and keeps going.

---

## Part 4 — Deploy the website with Vercel

1. Go to [vercel.com](https://vercel.com) and sign up using **Continue with
   GitHub** (this connects the two automatically).
2. Click **Add New** → **Project**.
3. Find your `ux-wire` repo in the list and click **Import**.
4. Leave all settings as default. Click **Deploy**.
5. Wait about a minute. Vercel will give you a live URL like
   `ux-wire-yourname.vercel.app` — that's your site. Bookmark it, or add it
   to your phone's home screen (Share → Add to Home Screen) so it feels
   like an app.

---

## How the automatic updates work from here

- Every day at 06:00 UTC, GitHub runs the fetch script on its own, adds
  anything new to `data/digest.json`, and commits it.
- Vercel notices every commit to your repo and redeploys the site
  automatically — usually live within a minute or two.
- You don't have to do anything. Just open the site when you want to catch up.

Want it to run at a different time? Open `.github/workflows/fetch-daily.yml`
in GitHub (click the file, then the pencil/edit icon), and change the
`cron: "0 6 * * *"` line — the two numbers are hour and minute, in UTC.

---

## Using the site

- **Today's highlights** at the top are the handful of items the scoring
  system ranked highest that day (see "How curation works" below).
- Below that is the full day-by-day archive, newest first.
- **Filter chips** narrow by topic (AI, Tool, Research, etc.) and by level
  (Beginner / General / Advanced).
- **Search** filters by keyword across all logged days.
- **Remove** hides an item for you. It's saved in your browser only, so it
  won't affect what other people see if you ever share the link, and it
  won't stop that source from being fetched again tomorrow.

---

## How curation works (and its honest limits)

There's no AI reading and judging these articles — that would need a paid
API key and ongoing cost. Instead, each item gets a score from simple,
transparent rules:

- **Source weight** — established, editorially-reviewed sources
  (Nielsen Norman Group, Smashing Magazine, A List Apart) score higher than
  community posts (Reddit, Hacker News).
- **Topic tags** — keyword matching sorts items into AI, Tool, Research,
  Career, Accessibility, Design System, Trend.
- **"Big news" boost** — words like *launched*, *released*, *acquired*,
  *shut down* get a bonus, since those tend to be the things that actually
  change a workflow.

This is good at surfacing *plausibly important* items and filtering out
one-off community chatter, but it can't judge nuance the way a person can.
Treat "Today's highlights" as a shortlist worth a closer look, not gospel.

If later on you want smarter, AI-written summaries and ranking, that's a
natural upgrade — it would mean adding an Anthropic API key as a GitHub
secret and having the fetch script call the Claude API to rank and
summarize each day's haul. Ask me and I can add that.

---

## Adding or removing sources

Open `scripts/fetch-feeds.mjs`. Near the top there's a `SOURCES` array —
each entry is one RSS feed. Add a new one by copying the pattern:

```js
{ id: "unique-id", name: "Display Name", type: "rss", url: "https://example.com/feed/", weight: 7 },
```

`weight` is 1–10, roughly "how much do I trust this source's editorial
judgment" — it affects ranking, not whether it shows up. Commit the change
on GitHub and it takes effect on the next run (or trigger it manually via
Part 3, step 4 again).

---

## If something breaks

- **Site shows "Nothing logged yet"**: the Action hasn't run successfully
  yet — check the Actions tab for errors, or run it manually (Part 3).
- **A source keeps failing**: some sites occasionally block automated
  traffic. The script already skips failures gracefully — if one source
  fails for good, just remove it from `SOURCES`.
- **Want to reset what you've removed**: clear your browser's site data for
  your `.vercel.app` URL, or open dev tools → Application → Local Storage
  and delete the `uxwire-removed-ids` key.
