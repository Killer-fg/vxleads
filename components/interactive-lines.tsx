"use client";

import { useEffect, useRef } from "react";

export function InteractiveLines({ color = "#ff6a2b" }: { color?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const pointer = { x: -1000, y: -1000, active: false };
    let frame = 0;
    let tick = 0;

    const resize = () => {
      const ratio = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round(innerWidth * ratio);
      canvas.height = Math.round(innerHeight * ratio);
      canvas.style.width = `${innerWidth}px`;
      canvas.style.height = `${innerHeight}px`;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    const move = (event: PointerEvent) => { pointer.x = event.clientX; pointer.y = event.clientY; pointer.active = true; };
    const leave = () => { pointer.active = false; };

    const draw = () => {
      tick += .006;
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      const gap = 154;
      for (let row = 0; row < 24; row++) {
        const baseY = innerHeight * .08 + row * (innerHeight * .84 / 23);
        ctx.beginPath();
        let drawing = false;
        for (let x = -20; x <= innerWidth + 20; x += 9) {
          const wave = Math.sin(x * .006 + tick * 1.7 + row * .38) * (7 + row * .22) + Math.cos(x * .0025 - tick + row * .71) * 5;
          let y = baseY + wave;
          if (pointer.active) {
            const dx = x - pointer.x, dy = y - pointer.y;
            const distance = Math.hypot(dx, dy);
            if (distance < gap) {
              const force = Math.pow(1 - distance / gap, 2) * 76;
              y += (dy >= 0 ? 1 : -1) * force;
            }
          }
          if (!drawing) { ctx.moveTo(x, y); drawing = true; } else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = color;
        ctx.globalAlpha = .032 + (row % 5 === 0 ? .035 : .012);
        ctx.lineWidth = row % 5 === 0 ? .9 : .55;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      frame = requestAnimationFrame(draw);
    };

    resize();draw();
    addEventListener("resize", resize);addEventListener("pointermove", move);addEventListener("pointerleave", leave);
    return () => { cancelAnimationFrame(frame);removeEventListener("resize", resize);removeEventListener("pointermove", move);removeEventListener("pointerleave", leave); };
  }, [color]);

  return <canvas ref={canvasRef} className="interactive-lines" aria-hidden="true" />;
}
