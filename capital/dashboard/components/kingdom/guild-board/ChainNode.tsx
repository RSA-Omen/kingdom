"use client";

import { useState } from "react";
import type { ChainNode as ChainNodeType } from "./types";

type Props = {
  node: ChainNodeType;
  isLast: boolean;
  onToast: (msg: string) => void;
};

const TONES = {
  done: {
    color: "var(--color-success)",
    bg: "color-mix(in srgb, var(--color-success) 15%, transparent)",
    border: "color-mix(in srgb, var(--color-success) 55%, transparent)",
    glow: "color-mix(in srgb, var(--color-success) 35%, transparent)",
  },
  waiting: {
    color: "var(--color-warning)",
    bg: "color-mix(in srgb, var(--color-warning) 12%, transparent)",
    border: "color-mix(in srgb, var(--color-warning) 45%, transparent)",
    glow: "color-mix(in srgb, var(--color-warning) 45%, transparent)",
  },
  comms: {
    color: "var(--color-warning)",
    bg: "color-mix(in srgb, var(--color-warning) 8%, transparent)",
    border: "color-mix(in srgb, var(--color-warning) 35%, transparent)",
    glow: "none",
  },
  dim: {
    color: "var(--color-text-tertiary)",
    bg: "color-mix(in srgb, var(--color-text-tertiary) 8%, transparent)",
    border: "color-mix(in srgb, var(--color-text-tertiary) 25%, transparent)",
    glow: "none",
  },
} as const;

function NodeMark({ shape, state }: { shape: ChainNodeType["shape"]; state: ChainNodeType["state"] }) {
  const t = TONES[state];
  if (shape === "diamond") {
    return (
      <div
        style={{
          width: 16,
          height: 16,
          transform: "rotate(45deg)",
          background: t.bg,
          border: `1.5px solid ${t.color}`,
          borderRadius: 3,
          boxShadow: state === "done" ? `0 0 10px ${t.glow}` : "none",
        }}
      />
    );
  }
  if (shape === "cloud") {
    return (
      <div
        className="font-mono grid place-items-center"
        style={{
          minWidth: 24,
          height: 16,
          padding: "0 5px",
          background: t.bg,
          border: `1px solid ${t.border}`,
          borderRadius: 999,
          color: t.color,
          fontSize: 10,
        }}
      >
        ☁
      </div>
    );
  }
  // circle
  return (
    <div
      style={{
        width: 16,
        height: 16,
        borderRadius: "50%",
        background: t.bg,
        border: `1.5px solid ${t.color}`,
        boxShadow:
          state === "done"
            ? `0 0 10px ${t.glow}`
            : state === "waiting"
              ? `0 0 14px ${t.glow}`
              : "none",
      }}
    />
  );
}

export function ChainNodeRow({ node, isLast, onToast }: Props) {
  const [hover, setHover] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const t = TONES[node.state];

  const isWaiting = node.state === "waiting";

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ position: "relative", display: "flex", gap: 20 }}
    >
      {/* spine column */}
      <div
        style={{
          width: 30,
          flexShrink: 0,
          display: "flex",
          justifyContent: "center",
          position: "relative",
        }}
      >
        <div style={{ marginTop: 14, zIndex: 2 }}>
          <NodeMark shape={node.shape} state={node.state} />
        </div>
      </div>

      {/* content */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          paddingBottom: isLast ? 0 : 24,
          flex: 1,
          minWidth: 0,
        }}
      >
        {/* card */}
        <div
          style={{
            background: "var(--color-surface)",
            border: `1px solid ${isWaiting ? t.border : "var(--color-border)"}`,
            borderRadius: 8,
            padding: "12px 14px",
            boxShadow: isWaiting
              ? `0 0 0 1px color-mix(in srgb, var(--color-warning) 6%, transparent), 0 6px 24px -16px ${t.glow}`
              : "none",
          }}
        >
          {/* title row */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 10,
            }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              {/* title + inline pill */}
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span
                  style={{
                    color:
                      node.state === "dim"
                        ? "var(--color-text-tertiary)"
                        : "var(--color-text-primary)",
                    fontWeight: 500,
                    fontSize: 13.5,
                  }}
                >
                  {node.title}
                </span>
                {node.inlinePill && (
                  <span
                    className="font-mono"
                    style={{
                      fontSize: 10.5,
                      color: "var(--color-danger)",
                      background:
                        "color-mix(in srgb, var(--color-danger) 10%, transparent)",
                      border:
                        "1px solid color-mix(in srgb, var(--color-danger) 30%, transparent)",
                      padding: "2px 7px",
                      borderRadius: 999,
                      letterSpacing: "0.02em",
                    }}
                  >
                    {node.inlinePill}
                  </span>
                )}
              </div>
              {node.subtitle && (
                <div
                  className="font-mono"
                  style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: 2 }}
                >
                  {node.subtitle}
                </div>
              )}
              {node.desc && (
                <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2 }}>
                  {node.desc}
                </div>
              )}
            </div>

            {/* hover actions */}
            {node.state !== "dim" && (
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  opacity: hover ? 1 : 0,
                  transform: hover ? "translateY(0)" : "translateY(-2px)",
                  transition: "opacity .15s, transform .15s",
                  pointerEvents: hover ? "auto" : "none",
                  flexShrink: 0,
                }}
              >
                <HoverBtn
                  onClick={() => onToast("Log comms — Phase D will write back to Asana")}
                >
                  + Log comms
                </HoverBtn>
                <HoverBtn
                  onClick={() => onToast("Set reminder — Phase D will add to Capital DB")}
                >
                  ⏰ Remind
                </HoverBtn>
              </div>
            )}
          </div>

          {/* subtree toggle */}
          {node.subtree && (
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              style={{
                appearance: "none",
                cursor: "pointer",
                marginTop: 10,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--color-text-tertiary)",
                background: "rgba(255,255,255,0.02)",
                border: "1px dashed var(--color-border)",
                padding: "5px 9px",
                borderRadius: 6,
                transition: "color .12s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.color = "var(--color-text-primary)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.color = "var(--color-text-tertiary)")
              }
            >
              <span
                style={{
                  display: "inline-block",
                  transform: expanded ? "rotate(0)" : "rotate(-90deg)",
                  transition: "transform .15s",
                }}
              >
                ▼
              </span>
              {node.subtree.label}
              <span style={{ color: "var(--color-text-tertiary)", opacity: 0.6 }}>
                · click to expand
              </span>
            </button>
          )}

          {expanded && node.subtree && (
            <div
              style={{
                marginTop: 10,
                paddingLeft: 14,
                borderLeft: "1px dashed var(--color-border)",
              }}
            >
              {node.subtree.items.map((s, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "6px 0",
                    fontSize: 12,
                    color: "var(--color-text-secondary)",
                  }}
                >
                  <span
                    className="font-mono"
                    style={{
                      color:
                        s.tone === "comms"
                          ? "var(--color-warning)"
                          : "var(--color-text-tertiary)",
                    }}
                  >
                    {s.glyph ?? "•"}
                  </span>
                  <span style={{ color: "var(--color-text-primary)" }}>{s.label}</span>
                  {s.date && (
                    <span
                      className="font-mono"
                      style={{ color: "var(--color-text-tertiary)", fontSize: 11 }}
                    >
                      {s.date}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* insert node hint (decorative) */}
        {!isLast && (
          <div
            style={{
              opacity: hover ? 0.9 : 0,
              transition: "opacity .15s",
              display: "flex",
              alignItems: "center",
              gap: 8,
              height: 16,
              marginTop: -2,
              marginBottom: -6,
              pointerEvents: "none",
            }}
          >
            <span
              className="font-mono"
              style={{
                fontSize: 10,
                color: "var(--color-text-tertiary)",
                border: "1px dashed var(--color-border)",
                padding: "1px 7px",
                borderRadius: 999,
              }}
            >
              + insert node here
            </span>
            <div
              style={{
                flex: 1,
                height: 1,
                borderTop: "1px dashed var(--color-border)",
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function HoverBtn({
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
        padding: "4px 8px",
        borderRadius: 5,
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        whiteSpace: "nowrap",
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
