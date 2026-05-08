import { SchedulesClient } from "./SchedulesClient";

export default function SchedulesPage() {
  return (
    <div className="space-y-8">
      <header className="border-b border-[var(--color-border)] pb-8">
        <p className="text-xs uppercase tracking-wider text-[var(--color-text-tertiary)] font-medium">
          Kingdom Watch · Schedules
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-[var(--color-text-primary)] leading-tight">
          Agent Schedules
        </h1>
        <p className="mt-3 text-base text-[var(--color-text-secondary)] max-w-2xl leading-relaxed">
          Every agent that runs on a schedule. Click any run to see the full outcome.
        </p>
      </header>
      <SchedulesClient />
    </div>
  );
}
