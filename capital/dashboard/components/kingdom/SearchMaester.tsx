"use client";

import { useState, useRef, useEffect } from "react";

export function SearchMaester() {
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function ask() {
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setAnswer(null);

    try {
      const r = await fetch("/api/maester/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: query }),
      });

      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        setError(e.error ?? `HTTP ${r.status}`);
        return;
      }

      const data = await r.json();
      setAnswer(data.answer);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      ask();
    }
  };

  const suggestions = [
    "What apps do we have?",
    "What's new?",
    "What's stale?",
    "How many projects?",
  ];

  return (
    <section className="surface p-6">
      <div>
        <p className="text-xs uppercase tracking-wider text-[var(--color-text-tertiary)] font-medium">
          Ask The Maester
        </p>
        <h2 className="mt-2 text-lg font-semibold text-[var(--color-text-primary)]">
          Search the realm's memory
        </h2>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            placeholder="What apps do we have? What's new? What's stale?"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            className="flex-1 px-3 py-2 text-sm border border-[var(--color-border)] rounded bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] placeholder-[var(--color-text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] disabled:opacity-50"
          />
          <button
            onClick={ask}
            disabled={loading || !query.trim()}
            className="px-4 py-2 text-sm font-medium bg-[var(--color-accent)] text-[var(--color-accent-fg)] rounded hover:bg-[var(--color-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "…" : "Ask"}
          </button>
        </div>

        {!answer && !error && (
          <div className="flex flex-wrap gap-2 text-xs">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => {
                  setQuery(s);
                  setTimeout(() => inputRef.current?.focus(), 0);
                }}
                className="px-2 py-1 border border-[var(--color-border)] rounded text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] hover:border-[var(--color-accent)] transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded text-xs text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {answer && (
        <div className="mt-4 p-4 bg-[var(--color-bg-subtle)] border border-[var(--color-border)] rounded">
          <div className="text-xs text-[var(--color-text-tertiary)] mb-2">The Maester's answer:</div>
          <div className="prose prose-sm dark:prose-invert max-w-none text-sm text-[var(--color-text-primary)] whitespace-pre-wrap font-mono text-xs leading-relaxed">
            {answer}
          </div>
        </div>
      )}
    </section>
  );
}
