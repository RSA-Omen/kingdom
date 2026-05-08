import { SecurityClient } from "./SecurityClient";

export default function SecurityPage() {
  return (
    <div className="space-y-8">
      <header className="border-b border-[var(--color-border)] pb-8">
        <p className="text-xs uppercase tracking-wider text-[var(--color-text-tertiary)] font-medium">
          Kingdom Watch · Security
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-[var(--color-text-primary)] leading-tight">
          Dependency Vulnerabilities
        </h1>
        <p className="mt-3 text-base text-[var(--color-text-secondary)] max-w-2xl leading-relaxed">
          Live npm audit across admin-center&apos;s backend, frontend, and MCP server, and the Kingdom dashboard itself.
          Severity, fix status, and advisory links for every finding.
        </p>
      </header>
      <SecurityClient />
    </div>
  );
}
