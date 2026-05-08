interface KingdomError {
  id: string;
  village: string;
  message: string;
  severity: string;
  status: string;
  linked_todo_id: string | null;
  created_at: number;
}

const SEVERITY_COLOR: Record<string, string> = {
  error: "#ef4444",
  warning: "#f59e0b",
  info: "#6c63ff",
};

function timeAgo(unix: number): string {
  const diff = Math.floor(Date.now() / 1000) - unix;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function ErrorFeedView({ errors }: { errors: KingdomError[] }) {
  if (errors.length === 0) {
    return (
      <div className="surface p-6 text-center text-sm text-[var(--color-text-tertiary)]">
        No open errors — the realm is quiet.
      </div>
    );
  }

  return (
    <div className="surface overflow-hidden">
      {errors.map((err, i) => (
        <div
          key={err.id}
          className={`flex items-center gap-4 px-5 py-3 text-sm ${
            i < errors.length - 1 ? "border-b border-[var(--color-border)]" : ""
          }`}
        >
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: SEVERITY_COLOR[err.severity] || "#888" }}
          />
          <span className="text-xs text-[var(--color-text-tertiary)] w-24 flex-shrink-0 capitalize">
            {err.village}
          </span>
          <span className="flex-1 text-[var(--color-text-secondary)] truncate">{err.message}</span>
          {err.linked_todo_id && (
            <span className="text-xs bg-[var(--color-bg-subtle)] text-[var(--color-accent)] px-2 py-0.5 rounded flex-shrink-0">
              → TODO
            </span>
          )}
          <span className="text-xs text-[var(--color-text-tertiary)] flex-shrink-0">
            {timeAgo(err.created_at)}
          </span>
        </div>
      ))}
    </div>
  );
}
