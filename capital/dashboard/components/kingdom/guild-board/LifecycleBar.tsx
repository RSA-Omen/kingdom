/**
 * Mini lifecycle bar — horizontal timeline of events for a DeskItem.
 *
 * Each event renders as a glyph (diamond for milestone, dot for progress,
 * outlined circle for comms, etc.) connected by gradient segments. Future
 * events are dashed/dim. The "now" glyph gets a soft glow.
 */

import type { LifecycleEvent } from "./types";

type GlyphSpec = {
  type: "diamond" | "dot" | "cloud" | "wait" | "now";
  size: number;
};

function glyphFor(e: LifecycleEvent): GlyphSpec {
  if (e.kind === "milestone") return { type: "diamond", size: 8 };
  if (e.kind === "comms") return { type: "cloud", size: 10 };
  if (e.kind === "wait") return { type: "wait", size: 9 };
  if (e.kind === "now") return { type: "now", size: 10 };
  return { type: "dot", size: 7 };
}

type LifecycleBarProps = {
  events: LifecycleEvent[];
};

export function LifecycleBar({ events }: LifecycleBarProps) {
  return (
    <div className="relative flex items-center w-full">
      {events.map((e, i) => {
        const isLast = i === events.length - 1;
        const g = glyphFor(e);
        const tone = e.tone ?? "var(--color-text-tertiary)";
        const isFuture = e.kind === "future";
        const isNow = e.kind === "now";
        const isWait = e.kind === "wait";
        const isCloud = g.type === "cloud";
        const nextTone =
          !isLast && events[i + 1] ? events[i + 1].tone ?? "var(--color-text-tertiary)" : tone;

        return (
          <span key={i} className="contents">
            <div
              title={`${e.title}${e.date ? " · " + e.date : ""}`}
              style={{
                width: g.size,
                height: g.size,
                flexShrink: 0,
                borderRadius: g.type === "diamond" ? 1 : "50%",
                transform: g.type === "diamond" ? "rotate(45deg)" : "none",
                background: isFuture ? "transparent" : tone,
                border: isFuture
                  ? "1px dashed var(--color-text-tertiary)"
                  : isCloud || isWait
                    ? `1.5px solid ${tone}`
                    : `1px solid ${tone}`,
                boxShadow: isNow
                  ? `0 0 0 3px color-mix(in srgb, ${tone} 13%, transparent), 0 0 10px color-mix(in srgb, ${tone} 40%, transparent)`
                  : "none",
                opacity: isFuture ? 0.45 : 1,
              }}
            />
            {!isLast && (
              <div
                style={{
                  flex: 1,
                  height: 1,
                  background: isFuture
                    ? "transparent"
                    : `linear-gradient(to right, color-mix(in srgb, ${tone} 53%, transparent), color-mix(in srgb, ${nextTone} 40%, transparent))`,
                  borderTop: isFuture ? "1px dashed var(--color-border)" : "none",
                  opacity: 0.7,
                  margin: "0 3px",
                }}
              />
            )}
          </span>
        );
      })}
    </div>
  );
}
