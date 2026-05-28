"use client";

import { useEffect, useState } from "react";
import type { ChainData, ChainMeta, EntityType } from "./types";
import { ChainNodeRow } from "./ChainNode";
import { Toast } from "./Toast";

const TYPE_CHIP = {
  project: { glyph: "◆", label: "PROJECT", color: "var(--color-accent)" },
  bug: { glyph: "●", label: "BUG", color: "var(--color-bug)" },
  incident: { glyph: "▲", label: "INCIDENT", color: "var(--color-danger)" },
} as const;

// ─── Meta sidebar ─────────────────────────────────────────────────────────────

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "80px 1fr",
        alignItems: "center",
        gap: 8,
        padding: "8px 0",
        borderTop: "1px solid var(--color-border)",
      }}
    >
      <span
        className="font-mono uppercase"
        style={{
          fontSize: 10.5,
          color: "var(--color-text-tertiary)",
          letterSpacing: "0.06em",
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 12.5 }}>{children}</span>
    </div>
  );
}

function ProjectMeta({
  meta,
  onToast,
}: {
  meta: ChainMeta;
  onToast: (msg: string) => void;
}) {
  const chip = TYPE_CHIP[meta.type];
  const isStuck = !!meta.stuckDays;

  return (
    <aside style={{ width: 248, flexShrink: 0 }}>
      {/* meta card */}
      <div
        className="surface"
        style={{ padding: 16 }}
      >
        {/* type chip */}
        <div style={{ marginBottom: 10 }}>
          <span
            className="font-mono"
            style={{
              fontSize: 10.5,
              color: chip.color,
              background: `color-mix(in srgb, ${chip.color} 10%, transparent)`,
              border: `1px solid color-mix(in srgb, ${chip.color} 30%, transparent)`,
              padding: "3px 8px",
              borderRadius: 999,
              letterSpacing: "0.04em",
            }}
          >
            {chip.glyph} {chip.label}
          </span>
        </div>

        {/* title */}
        <h2
          style={{
            margin: "0 0 14px 0",
            color: "var(--color-text-primary)",
            fontSize: 15,
            fontWeight: 600,
            letterSpacing: "-0.01em",
            lineHeight: 1.35,
          }}
        >
          {meta.title}
        </h2>

        {/* rows */}
        <div>
          <MetaRow label="Status">
            <span
              className="font-mono"
              style={{
                color:
                  meta.status.includes("WAITING") || meta.status === "REVIEW"
                    ? "var(--color-warning)"
                    : "var(--color-text-primary)",
              }}
            >
              {meta.status}
            </span>
          </MetaRow>
          {meta.stakeholder && (
            <MetaRow label="Stakeholder">
              <span className="font-mono" style={{ color: "var(--color-text-primary)" }}>
                {meta.stakeholder}
              </span>
            </MetaRow>
          )}
          <MetaRow label="Village">
            <span className="font-mono" style={{ color: "var(--color-text-primary)" }}>
              {meta.village}
            </span>
          </MetaRow>
          <MetaRow label="Started">
            <span className="font-mono" style={{ color: "var(--color-text-primary)" }}>
              {meta.started}
            </span>
          </MetaRow>
          {meta.lastComms && (
            <MetaRow label="Last comms">
              <span
                className="font-mono"
                style={{
                  color: isStuck ? "var(--color-danger)" : "var(--color-text-primary)",
                }}
              >
                {meta.lastComms}
              </span>
            </MetaRow>
          )}
        </div>
      </div>

      {/* alert box — only when stuck */}
      {isStuck && meta.stuckDays && (
        <div
          style={{
            marginTop: 12,
            background:
              "color-mix(in srgb, var(--color-danger) 5%, transparent)",
            border:
              "1px solid color-mix(in srgb, var(--color-danger) 28%, transparent)",
            borderRadius: 8,
            padding: 14,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 6,
              color: "var(--color-danger)",
              fontWeight: 600,
              fontSize: 12.5,
            }}
          >
            <span>⏱</span>
            <span>Waiting {meta.stuckDays} days</span>
          </div>
          <p
            style={{
              margin: "0 0 10px 0",
              fontSize: 12,
              color: "var(--color-text-secondary)",
              lineHeight: 1.55,
            }}
          >
            {meta.stuckContext || "No response received."}
          </p>
          <div style={{ display: "flex", gap: 6 }}>
            <AlertBtn
              danger
              onClick={() => onToast("Log comms — Phase D will write back to Asana")}
            >
              Log comms
            </AlertBtn>
            <AlertBtn
              onClick={() => onToast("Set reminder — Phase D will add to Capital DB")}
            >
              Set reminder
            </AlertBtn>
          </div>
        </div>
      )}
    </aside>
  );
}

function AlertBtn({
  children,
  danger,
  onClick,
}: {
  children: React.ReactNode;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="cursor-pointer transition-colors"
      style={{
        appearance: "none",
        fontSize: 11.5,
        padding: "6px 10px",
        borderRadius: 5,
        background: "transparent",
        color: danger ? "var(--color-danger)" : "var(--color-text-secondary)",
        border: danger
          ? "1px solid color-mix(in srgb, var(--color-danger) 45%, transparent)"
          : "1px solid var(--color-border)",
        cursor: "pointer",
        fontFamily: "inherit",
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.background = danger
          ? "color-mix(in srgb, var(--color-danger) 8%, transparent)"
          : "rgba(255,255,255,0.04)")
      }
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {children}
    </button>
  );
}

// ─── Chain spine + nodes ──────────────────────────────────────────────────────

function ProjectChain({
  data,
  onToast,
}: {
  data: ChainData;
  onToast: (msg: string) => void;
}) {
  return (
    <div style={{ position: "relative" }}>
      {/* gradient spine */}
      <div
        style={{
          position: "absolute",
          left: 13,
          top: 18,
          bottom: 12,
          width: 3,
          background:
            "linear-gradient(to bottom, var(--color-accent) 0%, color-mix(in srgb, var(--color-accent) 40%, transparent) 30%, color-mix(in srgb, var(--color-warning) 55%, transparent) 60%, var(--color-text-tertiary) 85%, var(--color-border) 100%)",
          borderRadius: 2,
          opacity: 0.85,
          boxShadow:
            "0 0 12px color-mix(in srgb, var(--color-accent) 18%, transparent)",
        }}
      />

      <div style={{ display: "flex", flexDirection: "column" }}>
        {data.nodes.map((node, i) => (
          <ChainNodeRow
            key={i}
            node={node}
            isLast={i === data.nodes.length - 1}
            onToast={onToast}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Loading / error shells ───────────────────────────────────────────────────

function ChainSkeleton() {
  return (
    <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
      <div
        style={{
          width: 248,
          height: 280,
          background: "rgba(255,255,255,0.03)",
          borderRadius: 8,
          border: "1px solid var(--color-border)",
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1 }}>
        {[120, 80, 100, 90, 80].map((h, i) => (
          <div
            key={i}
            style={{
              height: h,
              marginBottom: 24,
              background: "rgba(255,255,255,0.03)",
              borderRadius: 8,
              border: "1px solid var(--color-border)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Full ChainView ───────────────────────────────────────────────────────────

type Props = {
  itemId: string;
  itemTitle: string;
  itemVillage: string;
  onBack: () => void;
};

export function ChainView({ itemId, itemTitle, itemVillage, onBack }: Props) {
  const [data, setData] = useState<ChainData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    setError(null);
    fetch(`/api/guild-board/chain/${encodeURIComponent(itemId)}`)
      .then((r) => r.json())
      .then((body: ChainData) => {
        if (!body.ok) {
          setError((body as any).error ?? "Chain unavailable");
        } else {
          setData(body);
        }
      })
      .catch((err) => setError(err?.message ?? "Fetch failed"));
  }, [itemId]);

  const onToast = (msg: string) => setToast(msg);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* breadcrumb */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 12.5,
          color: "var(--color-text-secondary)",
        }}
      >
        <button
          type="button"
          onClick={onBack}
          className="cursor-pointer transition-colors"
          style={{
            appearance: "none",
            background: "transparent",
            border: 0,
            color: "var(--color-text-secondary)",
            font: "inherit",
            padding: 0,
            cursor: "pointer",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.color = "var(--color-accent)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.color = "var(--color-text-secondary)")
          }
        >
          ← Queue
        </button>
        <span style={{ color: "var(--color-text-tertiary)" }}>/</span>
        <span className="font-mono" style={{ color: "var(--color-text-secondary)" }}>
          {itemVillage}
        </span>
        <span style={{ color: "var(--color-text-tertiary)" }}>—</span>
        <span style={{ color: "var(--color-text-primary)" }}>{itemTitle}</span>
      </div>

      {/* body */}
      {!data && !error && <ChainSkeleton />}

      {error && (
        <div
          style={{
            padding: "28px 20px",
            color: "var(--color-danger)",
            fontSize: 13,
            background: "color-mix(in srgb, var(--color-danger) 6%, transparent)",
            border:
              "1px solid color-mix(in srgb, var(--color-danger) 25%, transparent)",
            borderRadius: 8,
          }}
        >
          Failed to load chain: {error}
        </div>
      )}

      {data && (
        <div style={{ display: "flex", gap: 22, alignItems: "flex-start" }}>
          <ProjectMeta meta={data.meta} onToast={onToast} />

          {/* chain panel */}
          <div
            className="surface flex-1 min-w-0"
            style={{ padding: "20px 22px" }}
          >
            {/* panel header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 18,
              }}
            >
              <span
                className="font-mono uppercase"
                style={{
                  fontSize: 10.5,
                  color: "var(--color-text-tertiary)",
                  letterSpacing: "0.12em",
                }}
              >
                Project chain
              </span>
              <div style={{ display: "flex", gap: 6 }}>
                <PanelBtn onClick={() => onToast("Add node — Phase D")}>+ Add node</PanelBtn>
              </div>
            </div>

            <ProjectChain data={data} onToast={onToast} />

            {data.nodes.length === 0 && (
              <div
                style={{
                  padding: "28px 0",
                  color: "var(--color-text-tertiary)",
                  fontSize: 12.5,
                  textAlign: "center",
                }}
              >
                No activity found for this item.
              </div>
            )}
          </div>
        </div>
      )}

      <Toast message={toast} onClose={() => setToast(null)} />
    </div>
  );
}

function PanelBtn({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="cursor-pointer transition-colors"
      style={{
        appearance: "none",
        background: "rgba(255,255,255,0.04)",
        border: "1px solid var(--color-border)",
        color: "var(--color-text-secondary)",
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        padding: "5px 9px",
        borderRadius: 5,
        cursor: "pointer",
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.color = "var(--color-text-primary)")
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.color = "var(--color-text-secondary)")
      }
    >
      {children}
    </button>
  );
}
