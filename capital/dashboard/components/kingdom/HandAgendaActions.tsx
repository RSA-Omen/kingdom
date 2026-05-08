"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

export function HandAgendaActions({ id }: { id: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const act = (payload: object) => {
    startTransition(async () => {
      await fetch("/api/hand/act", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      router.refresh();
    });
  };

  const base =
    "px-3 py-1.5 text-xs font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div className="flex gap-2 sm:flex-col sm:items-stretch">
      <button
        type="button"
        disabled={isPending}
        onClick={() => act({ action: "done", id })}
        className={`${base} bg-[var(--color-accent)] text-[var(--color-accent-fg)] hover:bg-[var(--color-accent-hover)]`}
      >
        Done
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={() => act({ action: "defer", id, days: 3 })}
        className={`${base} bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-subtle)] border border-[var(--color-border)]`}
      >
        Defer 3d
      </button>
    </div>
  );
}
