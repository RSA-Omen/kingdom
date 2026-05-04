"use client";
import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5001";

interface Summary {
  openErrors: number;
  openTodos: number;
  linked: number;
  new24h: number;
}

export function SummaryCards() {
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/errors/summary`).then((r) => r.json()),
      fetch(`${API}/api/todos/summary`).then((r) => r.json()),
    ]).then(([errors, todos]) => {
      setSummary({
        openErrors: errors.open,
        openTodos: todos.open,
        linked: errors.linked,
        new24h: errors.new_24h,
      });
    });
  }, []);

  const cards = [
    { label: "Open Errors", value: summary?.openErrors ?? "—", color: "#ef4444" },
    { label: "Open To-Dos", value: summary?.openTodos ?? "—", color: "var(--color-accent)" },
    { label: "Errors → To-Dos", value: summary?.linked ?? "—", color: "#22c55e" },
    { label: "New (24h)", value: summary?.new24h ?? "—", color: "#f59e0b" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div key={card.label} className="surface p-5">
          <div className="text-2xl font-bold" style={{ color: card.color }}>
            {card.value}
          </div>
          <div className="mt-1 text-xs text-[var(--color-text-tertiary)] uppercase tracking-wider">
            {card.label}
          </div>
        </div>
      ))}
    </div>
  );
}
