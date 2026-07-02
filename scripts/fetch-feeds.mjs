// scripts/fetch-feeds.mjs
//
// Runs once a day (via .github/workflows/fetch-daily.yml). It:
//   1. Pulls the latest items from every source in SOURCES below
//   2. Tags each item (topic + experience level) and scores it
//   3. Skips anything already in the archive (by link)
//   4. Writes the result into data/digest.json
//
// To add or remove a source, edit the SOURCES array and commit.
// Nothing else in this file needs to change.

import Parser from "rss-parser";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, "..", "data", "digest.json");

// weight = how much editorial trust this source gets (1-10). Used for ranking, not filtering.
const SOURCES = [
  { id: "smashing", name: "Smashing Magazine", type: "rss", url: "https://www.smashingmagazine.com/feed/", weight: 9 },
  { id: "nngroup", name: "Nielsen Norman Group", type: "rss", url: "https://www.nngroup.com/feed/rss/", weight: 10 },
  { id: "uxcollective", name: "UX Collective", type: "rss", url: "https://uxdesign.cc/feed", weight: 8 },
  { id: "uxplanet", name: "UX Planet", type: "rss", url: "https://uxplanet.org/feed", weight: 7 },
  { id: "alistapart", name: "A List Apart", type: "rss", url: "https://alistapart.com/main/feed/", weight: 8 },
  { id: "prototypr", name: "Prototypr", type: "rss", url: "https://blog.prototypr.io/feed", weight: 6 },
  { id: "bootcamp", name: "Bootcamp", type: "rss", url: "https://bootcamp.uxdesign.cc/feed", weight: 6 },
  { id: "uxmovement", name: "UX Movement", type: "rss", url: "https://feeds.feedburner.com/uxmovement", weight: 6 },
  { id: "r_uxdesign", name: "r/UXDesign", type: "rss", url: "https://www.reddit.com/r/UXDesign/.rss", weight: 5 },
  { id: "r_userexperience", name: "r/userexperience", type: "rss", url: "https://www.reddit.com/r/userexperience/.rss", weight: 5 },
  { id: "r_uidesign", name: "r/UI_Design", type: "rss", url: "https://www.reddit.com/r/UI_Design/.rss", weight: 4 },
  { id: "r_figma", name: "r/FigmaDesign", type: "rss", url: "https://www.reddit.com/r/FigmaDesign/.rss", weight: 4 },
];

// Hacker News (Algolia API, no key needed) — good for tool launches & AI-in-design chatter
const HN_QUERIES = ["Figma", "design tool", "UX design", "UI design", "design system", "AI design"];

const MAX_PER_SOURCE_PER_RUN = 6;
const MAX_DAYS_KEPT = 90;

const CATEGORY_RULES = [
  { tag: "AI", re: /\bai\b|artificial intelligence|\bllm\b|chatgpt|copilot|agentic|\bagent\b/i },
  { tag: "Tool", re: /figma|sketch|adobe|penpot|framer|webflow|protopie|plugin|\btool\b|launch|feature/i },
  { tag: "Research", re: /research|\bstudy\b|survey|\breport\b|found that|data shows/i },
  { tag: "Career", re: /career|\bjob\b|hiring|salary|portfolio|interview|freelance/i },
  { tag: "Accessibility", re: /accessib|\ba11y\b|wcag|inclusive design/i },
  { tag: "Design System", re: /design system|component librar|design token/i },
  { tag: "Trend", re: /trend|state of design|future of/i },
];

const BEGINNER_RE = /beginner|getting started|\b101\b|basics|introduction to|guide to|how to|for beginners|new to (ux|ui)/i;
const ADVANCED_RE = /advanced|deep dive|case study|at scale|in production|systems thinking|architecture/i;
const BIG_NEWS_RE = /launch(ed)?|releas(e|ed)|acqui(re|sition)|shut(s)? down|deprecat|major update|new version|announc/i;

function stripHtml(html = "") {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function summarize(text, max = 220) {
  const clean = stripHtml(text || "");
  if (clean.length <= max) return clean;
  return clean.slice(0, max).replace(/\s+\S*$/, "") + "…";
}

function tagCategories(title, summary) {
  const haystack = `${title} ${summary}`;
  return CATEGORY_RULES.filter((r) => r.re.test(haystack)).map((r) => r.tag);
}

function tagLevel(title, summary) {
  const haystack = `${title} ${summary}`;
  if (BEGINNER_RE.test(haystack)) return "Beginner";
  if (ADVANCED_RE.test(haystack)) return "Advanced";
  return "General";
}

function scoreItem({ weight, categories, title, summary }) {
  const haystack = `${title} ${summary}`;
  let score = weight * 3;
  score += categories.length * 2;
  if (BIG_NEWS_RE.test(haystack)) score += 4;
  return score;
}

function makeId(link) {
  // short, stable id derived from the URL
  let hash = 0;
  for (let i = 0; i < link.length; i++) {
    hash = (hash * 31 + link.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

async function fetchRss(parser, source) {
  try {
    const feed = await parser.parseURL(source.url);
    return (feed.items || []).slice(0, MAX_PER_SOURCE_PER_RUN).map((item) => ({
      title: stripHtml(item.title || "").trim(),
      link: item.link,
      publishedAt: item.isoDate || item.pubDate || new Date().toISOString(),
      rawSummary: item.contentSnippet || item.content || item.summary || "",
      source: source.name,
      sourceWeight: source.weight,
    }));
  } catch (err) {
    console.warn(`[warn] ${source.name} failed: ${err.message}`);
    return [];
  }
}

async function fetchHn() {
  const results = [];
  for (const query of HN_QUERIES) {
    try {
      const res = await fetch(
        `https://hn.algolia.com/api/v1/search_by_date?tags=story&query=${encodeURIComponent(query)}&hitsPerPage=8`
      );
      if (!res.ok) continue;
      const data = await res.json();
      for (const hit of data.hits || []) {
        if (!hit.title || !(hit.url || hit.objectID)) continue;
        results.push({
          title: hit.title,
          link: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
          publishedAt: hit.created_at || new Date().toISOString(),
          rawSummary: "",
          source: "Hacker News",
          sourceWeight: 6,
        });
      }
    } catch (err) {
      console.warn(`[warn] Hacker News query "${query}" failed: ${err.message}`);
    }
  }
  return results;
}

async function main() {
  const parser = new Parser({ timeout: 15000 });
  const raw = [];

  for (const source of SOURCES) {
    raw.push(...(await fetchRss(parser, source)));
  }
  raw.push(...(await fetchHn()));

  // load existing archive
  const existing = JSON.parse(await readFile(DATA_PATH, "utf-8"));
  const seenLinks = new Set();
  for (const day of existing.days) {
    for (const item of day.items) seenLinks.add(item.link);
  }

  const today = new Date().toISOString().slice(0, 10);
  const freshItems = [];

  for (const entry of raw) {
    if (!entry.link || seenLinks.has(entry.link)) continue;
    seenLinks.add(entry.link);

    const summary = summarize(entry.rawSummary);
    const categories = tagCategories(entry.title, summary);
    const level = tagLevel(entry.title, summary);
    const impactScore = scoreItem({ weight: entry.sourceWeight, categories, title: entry.title, summary });

    freshItems.push({
      id: makeId(entry.link),
      title: entry.title,
      link: entry.link,
      source: entry.source,
      publishedAt: entry.publishedAt,
      summary,
      categories,
      level,
      impactScore,
      isHighlight: false,
    });
  }

  // mark today's top items as highlights
  const sorted = [...freshItems].sort((a, b) => b.impactScore - a.impactScore);
  const highlightIds = new Set(sorted.slice(0, 6).map((i) => i.id));
  for (const item of freshItems) {
    if (highlightIds.has(item.id)) item.isHighlight = true;
  }

  freshItems.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

  let days = existing.days;
  const todayIndex = days.findIndex((d) => d.date === today);
  if (todayIndex >= 0) {
    days[todayIndex].items = [...freshItems, ...days[todayIndex].items];
  } else if (freshItems.length > 0) {
    days = [{ date: today, items: freshItems }, ...days];
  }

  days = days.slice(0, MAX_DAYS_KEPT);

  const output = {
    updatedAt: new Date().toISOString(),
    days,
  };

  await writeFile(DATA_PATH, JSON.stringify(output, null, 2) + "\n", "utf-8");
  console.log(`Done. Added ${freshItems.length} new item(s) for ${today}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
