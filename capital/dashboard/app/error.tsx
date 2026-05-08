"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
      <div className="text-center space-y-2">
        <p className="text-xs uppercase tracking-wider text-[var(--color-text-tertiary)] font-medium">
          Kingdom Watch
        </p>
        <h2 className="text-2xl font-semibold text-[var(--color-text-primary)]">
          Something went wrong
        </h2>
        <p className="text-sm text-[var(--color-text-secondary)] max-w-md">
          {error.message || "An unexpected error occurred in the realm."}
        </p>
        {error.digest && (
          <p className="text-xs font-mono text-[var(--color-text-tertiary)]">
            ref: {error.digest}
          </p>
        )}
      </div>
      <button
        onClick={reset}
        className="px-4 py-2 rounded text-sm font-medium bg-[var(--color-accent)] text-[var(--color-accent-fg)] hover:bg-[var(--color-accent-hover)] transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
