"use client";

import { useEffect } from "react";

type ToastProps = {
  message: string | null;
  onClose: () => void;
};

export function Toast({ message, onClose }: ToastProps) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [message, onClose]);

  if (!message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      onClick={onClose}
      className="fixed left-1/2 bottom-8 cursor-pointer"
      style={{
        transform: "translateX(-50%)",
        zIndex: 250,
        background: "var(--color-bg-surface-elevated)",
        border: "1px solid var(--color-accent)",
        color: "var(--color-text-primary)",
        padding: "11px 18px",
        borderRadius: 999,
        fontSize: 12.5,
        boxShadow:
          "0 12px 32px rgba(0,0,0,0.55), 0 0 24px color-mix(in srgb, var(--color-accent) 18%, transparent)",
        maxWidth: 440,
        backdropFilter: "blur(14px)",
        animation: "tIn .25s cubic-bezier(.2,.7,.2,1.05) both",
      }}
    >
      <span style={{ color: "var(--color-accent)", marginRight: 8 }}>›</span>
      {message}
      <style>{`@keyframes tIn { from { opacity: 0; transform: translate(-50%, 12px); } to { opacity: 1; transform: translate(-50%, 0); } }`}</style>
    </div>
  );
}
