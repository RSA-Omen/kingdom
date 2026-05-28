"use client";

import type { SidebarItem } from "./types";
import { VIEW_SIDEBAR, VILLAGE_SIDEBAR } from "./mock-data";

type QueueSidebarProps = {
  activeView: string;
  setActiveView: (id: string) => void;
  activeVillage: string | null;
  setActiveVillage: (id: string | null) => void;
};

function SectionRows({
  title,
  items,
  active,
  setActive,
}: {
  title: string;
  items: SidebarItem[];
  active: string | null;
  setActive: (id: string) => void;
}) {
  return (
    <div className="mb-[22px]">
      <div
        className="font-mono uppercase"
        style={{
          fontSize: 10,
          letterSpacing: "0.12em",
          color: "var(--color-text-tertiary)",
          padding: "0 8px 8px",
        }}
      >
        {title}
      </div>
      <div className="flex flex-col gap-[1px]">
        {items.map((it) => {
          const isActive = active === it.id;
          return (
            <button
              key={it.id}
              type="button"
              onClick={() => setActive(it.id)}
              className="flex items-center justify-between transition-colors cursor-pointer"
              style={{
                background: isActive
                  ? "color-mix(in srgb, var(--color-accent) 10%, transparent)"
                  : "transparent",
                color: isActive ? "var(--color-accent)" : "var(--color-text-primary)",
                fontWeight: 500,
                fontSize: 12.5,
                padding: "7px 9px",
                borderRadius: 6,
                textAlign: "left",
                boxShadow: isActive
                  ? "inset 0 0 0 1px color-mix(in srgb, var(--color-accent) 18%, transparent), 0 0 18px -8px color-mix(in srgb, var(--color-accent) 50%, transparent)"
                  : "none",
                border: 0,
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.03)";
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.background = "transparent";
              }}
            >
              <span>{it.label}</span>
              <span
                className="font-mono"
                style={{
                  fontSize: 10.5,
                  color: isActive ? "var(--color-accent)" : "var(--color-text-tertiary)",
                }}
              >
                {it.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function QueueSidebar({
  activeView,
  setActiveView,
  activeVillage,
  setActiveVillage,
}: QueueSidebarProps) {
  return (
    <aside style={{ width: 200, flexShrink: 0, paddingTop: 2 }}>
      <SectionRows
        title="Views"
        items={VIEW_SIDEBAR}
        active={activeView}
        setActive={(id) => {
          setActiveView(id);
          setActiveVillage(null);
        }}
      />
      <SectionRows
        title="Villages"
        items={VILLAGE_SIDEBAR}
        active={activeVillage}
        setActive={(id) => setActiveVillage(id === activeVillage ? null : id)}
      />
    </aside>
  );
}
