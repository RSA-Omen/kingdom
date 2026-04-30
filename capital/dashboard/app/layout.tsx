import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kingdom",
  description:
    "Gekko's internal developer platform — the Capital, the Council, and every village of the realm.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <div className="min-h-screen flex flex-col">
          <TopBar />
          <div className="flex flex-1">
            <Sidebar />
            <main className="flex-1 px-8 py-10">
              <div className="max-w-7xl mx-auto">{children}</div>
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}

function TopBar() {
  return (
    <header className="h-14 border-b border-[var(--color-border)] bg-[var(--color-bg-surface)] flex items-center px-6">
      <a
        href="/"
        className="flex items-center gap-2 font-semibold text-[var(--color-text-primary)] hover:text-[var(--color-accent)] transition-colors"
      >
        <span className="text-[var(--color-accent)]">⌂</span>
        <span>Kingdom</span>
      </a>
      <div className="flex-1" />
      <div className="text-xs text-[var(--color-text-tertiary)]">
        Foundation phase — the realm is being built
      </div>
    </header>
  );
}

function Sidebar() {
  const sections: { heading: string; items: { label: string; slug: string }[] }[] = [
    {
      heading: "The Capital",
      items: [
        { label: "Throne Room", slug: "/" },
        { label: "Telegraph", slug: "/telegraph" },
      ],
    },
    {
      heading: "The Realm",
      items: [
        { label: "Villages", slug: "/villages" },
        { label: "Bridges", slug: "/bridges" },
      ],
    },
    {
      heading: "The Court",
      items: [
        { label: "Council", slug: "/council" },
        { label: "The Standard", slug: "/standard" },
      ],
    },
    {
      heading: "",
      items: [{ label: "Settings", slug: "/settings" }],
    },
  ];

  return (
    <aside className="hidden lg:block w-64 border-r border-[var(--color-border)] bg-[var(--color-bg-surface)] py-6 px-3">
      <nav className="flex flex-col gap-6">
        {sections.map((section, i) => (
          <div key={i} className="flex flex-col gap-1">
            {section.heading && (
              <p className="px-3 mb-1 text-xs uppercase tracking-wider text-[var(--color-text-tertiary)] font-medium">
                {section.heading}
              </p>
            )}
            {section.items.map((item) => (
              <a
                key={item.slug}
                href={item.slug}
                className="px-3 py-2 rounded text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                {item.label}
              </a>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}
