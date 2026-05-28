/**
 * Etched bipolar ornament — Magritte-inspired half-filled circle motif.
 * Used as a subtle decoration next to the page title.
 */

type OrnamentProps = {
  size?: "sm" | "lg";
  className?: string;
};

export function Ornament({ size = "sm", className }: OrnamentProps) {
  const W = size === "lg" ? 56 : 42;
  return (
    <svg
      width={W}
      height={14}
      viewBox="0 0 42 14"
      fill="none"
      aria-hidden="true"
      className={className}
      style={{ verticalAlign: "middle", opacity: 0.55, flexShrink: 0 }}
    >
      <line x1="0" y1="7" x2="12" y2="7" stroke="currentColor" strokeWidth="0.6" />
      <path d="M16 7 L18 5 L20 7 L18 9 Z" fill="currentColor" />
      <circle cx="26" cy="7" r="3.5" stroke="currentColor" strokeWidth="0.7" fill="none" />
      <path d="M26 3.5 A3.5 3.5 0 0 1 26 10.5 Z" fill="currentColor" />
      <line x1="32" y1="7" x2="42" y2="7" stroke="currentColor" strokeWidth="0.6" />
    </svg>
  );
}
