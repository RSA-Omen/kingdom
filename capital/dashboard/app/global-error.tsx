"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" className="dark">
      <body style={{ background: "#050510", color: "#ccfbf1", fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            gap: "1.5rem",
            textAlign: "center",
            padding: "2rem",
          }}
        >
          <p style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "#2d6b64" }}>
            Kingdom — Critical Error
          </p>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600, color: "#ccfbf1" }}>
            The realm has encountered a problem
          </h1>
          <p style={{ fontSize: "0.875rem", color: "#5eada3", maxWidth: "28rem" }}>
            {error.message || "A critical error occurred. The king's engineers have been notified."}
          </p>
          {error.digest && (
            <p style={{ fontSize: "0.75rem", fontFamily: "ui-monospace, monospace", color: "#2d6b64" }}>
              ref: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "0.25rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              background: "#81e6d9",
              color: "#050510",
              cursor: "pointer",
              border: "none",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
