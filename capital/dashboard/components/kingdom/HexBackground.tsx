"use client";
import { useEffect, useRef } from "react";

export function HexBackground() {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    function draw() {
      const svg = svgRef.current;
      if (!svg) return;
      const W = window.innerWidth;
      const H = window.innerHeight;
      svg.setAttribute("viewBox", `0 0 ${W} ${H}`);

      const s = 52; // equilateral triangle side length
      const h = (s * Math.sqrt(3)) / 2; // triangle height

      let d = "";

      // Horizontal lines
      for (let y = 0; y <= H + h; y += h) {
        d += `M -1 ${y} L ${W + 1} ${y} `;
      }

      // Lines at +60° — x = c + y/√3, spaced s apart at y=0
      for (let c = -H; c <= W + H; c += s) {
        const x0 = c;
        const x1 = c + (H + h) / Math.sqrt(3);
        d += `M ${x0} 0 L ${x1} ${H + h} `;
      }

      // Lines at -60° — x = c - y/√3, spaced s apart at y=0
      for (let c = -H; c <= W + H; c += s) {
        const x0 = c;
        const x1 = c - (H + h) / Math.sqrt(3);
        d += `M ${x0} 0 L ${x1} ${H + h} `;
      }

      svg.innerHTML = `<path d="${d}" fill="none" stroke="var(--color-hex-stroke)" stroke-width="0.8"/>`;
    }

    draw();
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, []);

  return (
    <svg
      ref={svgRef}
      className="fixed inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    />
  );
}
