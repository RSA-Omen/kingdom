interface SummaryProps {
  openErrors: number;
  openTodos: number;
  linked: number;
  new24h: number;
}

export function SummaryCardsView(props: SummaryProps) {
  const cards = [
    { label: "Open Errors", value: props.openErrors, color: "#ef4444" },
    { label: "Open To-Dos", value: props.openTodos, color: "var(--color-accent)" },
    { label: "Errors → To-Dos", value: props.linked, color: "#22c55e" },
    { label: "New (24h)", value: props.new24h, color: "#f59e0b" },
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
