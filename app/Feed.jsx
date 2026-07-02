"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const STORAGE_KEY = "uxwire-removed-ids";

const CATEGORY_COLORS = {
  AI: "#e8a33d",
  Tool: "#3e7c7b",
  Research: "#6b7fd7",
  Career: "#a15c5c",
  Accessibility: "#4c9a6a",
  "Design System": "#8a5cb5",
  Trend: "#c98a3e",
};

const CATEGORY_ORDER = ["AI", "Tool", "Research", "Design System", "Accessibility", "Career", "Trend"];
const LEVELS = ["Beginner", "General", "Advanced"];

function dayLabel(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const weekday = d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
  const md = d.toLocaleDateString("en-US", { month: "short", day: "2-digit", timeZone: "UTC" });
  return { weekday, md };
}

function timeAgo(iso) {
  const then = new Date(iso).getTime();
  const diffH = Math.max(0, Math.round((Date.now() - then) / 3600000));
  if (diffH < 1) return "just now";
  if (diffH < 24) return `${diffH}h ago`;
  return `${Math.round(diffH / 24)}d ago`;
}

export default function Feed({ initialDigest }) {
  const [removed, setRemoved] = useState(() => new Set());
  const [hydrated, setHydrated] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [level, setLevel] = useState("All");
  const [lastRemoved, setLastRemoved] = useState(null);
  const undoTimer = useRef(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      setRemoved(new Set(saved));
    } catch {
      // ignore corrupted storage
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...removed]));
  }, [removed, hydrated]);

  const days = initialDigest.days || [];

  const availableCategories = useMemo(() => {
    const present = new Set();
    for (const day of days) for (const item of day.items) for (const c of item.categories) present.add(c);
    return CATEGORY_ORDER.filter((c) => present.has(c));
  }, [days]);

  function matches(item) {
    if (removed.has(item.id)) return false;
    if (category !== "All" && !item.categories.includes(category)) return false;
    if (level !== "All" && item.level !== level) return false;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      if (!item.title.toLowerCase().includes(q) && !item.summary.toLowerCase().includes(q)) return false;
    }
    return true;
  }

  const visibleDays = days
    .map((day) => ({ ...day, items: day.items.filter(matches) }))
    .filter((day) => day.items.length > 0);

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayDay = days.find((d) => d.date === todayStr);
  const highlights = (todayDay?.items || []).filter((i) => i.isHighlight && matches(i));

  function removeItem(item) {
    setRemoved((prev) => new Set(prev).add(item.id));
    setLastRemoved(item);
    clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setLastRemoved(null), 5000);
  }

  function undoRemove() {
    if (!lastRemoved) return;
    setRemoved((prev) => {
      const next = new Set(prev);
      next.delete(lastRemoved.id);
      return next;
    });
    setLastRemoved(null);
    clearTimeout(undoTimer.current);
  }

  return (
    <main className="wrap">
      <header className="header">
        <h1 className="wordmark">
          <span className="dot" aria-hidden="true" />
          UX Wire
        </h1>
        <p className="tagline">
          Daily signal from the UX &amp; UI world — tools, research, and industry moves, sorted by what
          actually matters, not what&rsquo;s loudest.
        </p>
        <div className="meta-row">
          <span className="updated">
            {initialDigest.updatedAt
              ? `Last updated ${timeAgo(initialDigest.updatedAt)}`
              : "Not fetched yet"}
          </span>
          <span>{days.length} day{days.length === 1 ? "" : "s"} logged</span>
        </div>

        <div className="controls">
          <input
            className="search-input"
            type="search"
            placeholder="Search headlines…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search headlines"
          />
          <button className="chip" data-active={category === "All"} onClick={() => setCategory("All")}>
            All topics
          </button>
          {availableCategories.map((c) => (
            <button key={c} className="chip" data-active={category === c} onClick={() => setCategory(c)}>
              {c}
            </button>
          ))}
        </div>
        <div className="controls">
          <button className="chip" data-active={level === "All"} onClick={() => setLevel("All")}>
            Any level
          </button>
          {LEVELS.map((l) => (
            <button key={l} className="chip" data-active={level === l} onClick={() => setLevel(l)}>
              {l}
            </button>
          ))}
        </div>
      </header>

      {days.length === 0 && (
        <div className="empty">
          <strong>Nothing logged yet.</strong>
          <br />
          Go to the <strong>Actions</strong> tab in your GitHub repo, open <strong>Daily fetch</strong>,
          and click <strong>Run workflow</strong> to pull today&rsquo;s items in about a minute. After
          that it runs on its own, every day.
        </div>
      )}

      {highlights.length > 0 && (
        <section className="highlights">
          <p className="section-label">Today&rsquo;s highlights</p>
          <div className="highlight-grid">
            {highlights.map((item) => (
              <article className="highlight-card" key={item.id}>
                <a href={item.link} target="_blank" rel="noopener noreferrer">
                  {item.title}
                </a>
                <span className="src">{item.source}</span>
              </article>
            ))}
          </div>
        </section>
      )}

      {visibleDays.length > 0 && (
        <section>
          <p className="section-label">Archive</p>
          {visibleDays.map((day) => {
            const { weekday, md } = dayLabel(day.date);
            return (
              <div className="day-group" key={day.date}>
                <div className="day-tab">
                  <span className="weekday">{weekday}</span>
                  {md}
                </div>
                <div className="day-items">
                  {day.items.map((item) => (
                    <article className="item" key={item.id}>
                      <p className="item-title">
                        <a href={item.link} target="_blank" rel="noopener noreferrer">
                          {item.title}
                        </a>
                      </p>
                      {item.summary && <p className="item-summary">{item.summary}</p>}
                      <div className="item-footer">
                        {item.categories.map((c) => (
                          <span className="tag" key={c}>
                            <span
                              className="swatch"
                              style={{ background: CATEGORY_COLORS[c] || "#999" }}
                            />
                            {c}
                          </span>
                        ))}
                        <span className="tag">{item.level}</span>
                        <span className="item-source">
                          {item.source} · {timeAgo(item.publishedAt)}
                        </span>
                        <button className="remove-btn" onClick={() => removeItem(item)}>
                          Remove
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {lastRemoved && (
        <div className="undo-toast">
          Removed &ldquo;{lastRemoved.title.slice(0, 40)}
          {lastRemoved.title.length > 40 ? "…" : ""}&rdquo;
          <button onClick={undoRemove}>Undo</button>
        </div>
      )}
    </main>
  );
}
