type GroupHeaderProps = {
  label: string;
  count: number;
  tone: string;
  sub?: string;
};

export function GroupHeader({ label, count, tone, sub }: GroupHeaderProps) {
  return (
    <div
      className="flex items-baseline gap-3"
      style={{
        padding: "20px 20px 10px",
        borderBottom: "1px solid var(--color-border)",
      }}
    >
      <div
        className="self-center"
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: tone,
          boxShadow: `0 0 8px color-mix(in srgb, ${tone} 55%, transparent)`,
        }}
      />
      <div
        className="font-mono uppercase font-semibold"
        style={{
          fontSize: 10.5,
          letterSpacing: "0.14em",
          color: tone,
        }}
      >
        {label}
      </div>
      <div className="font-mono" style={{ fontSize: 10.5, color: "var(--color-text-tertiary)" }}>
        {count}
      </div>
      {sub && (
        <div style={{ fontSize: 11.5, color: "var(--color-text-secondary)", marginLeft: 4 }}>
          {sub}
        </div>
      )}
    </div>
  );
}
