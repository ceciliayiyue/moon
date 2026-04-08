"use client";

import { useEffect, useRef, useState } from "react";

type QuickDrawStroke = [number[], number[]];
type QuickDrawDrawing = {
  drawing: QuickDrawStroke[];
};

type NormalizedDrawing = {
  strokes: QuickDrawStroke[];
  width: number;
  height: number;
  centerX: number;
  centerY: number;
};

type FloatingDoodle = {
  id: number;
  drawing: NormalizedDrawing;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  driftX: number;
  driftY: number;
  age: number;
  lifespan: number;
};

const BACKGROUND_IMAGE_URL = "/moon-bg.jpg";
const QUICK_DRAW_MOON_URL = "/api/moon";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const doodlesRef = useRef<FloatingDoodle[]>([]);
  const drawingsRef = useRef<NormalizedDrawing[]>([]);
  const pointerRef = useRef({ x: 0, y: 0, active: false });
  const lastSpawnRef = useRef(0);
  const idRef = useRef(0);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    let mounted = true;

    const loadMoonDrawings = async () => {
      try {
        const response = await fetch(QUICK_DRAW_MOON_URL);
        if (!response.body) return;

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        const drawings: NormalizedDrawing[] = [];

        while (drawings.length < 320) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.trim()) continue;
            const parsed = JSON.parse(line) as QuickDrawDrawing;
            const normalized = normalizeDrawing(parsed.drawing);
            drawings.push(normalized);
            if (drawings.length >= 320) break;
          }
        }

        if (mounted) {
          drawingsRef.current = drawings;
        }
      } catch (error) {
        console.error("Failed to load Quick, Draw! moon data", error);
      }
    };

    loadMoonDrawings();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId = 0;

    const resize = () => {
      const { innerWidth, innerHeight, devicePixelRatio } = window;
      canvas.width = innerWidth * devicePixelRatio;
      canvas.height = innerHeight * devicePixelRatio;
      canvas.style.width = `${innerWidth}px`;
      canvas.style.height = `${innerHeight}px`;
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    };

    const spawnDoodles = (count: number, radius: number) => {
      const drawings = drawingsRef.current;
      if (!drawings.length) return;
      const { x, y } = pointerRef.current;

      for (let i = 0; i < count; i += 1) {
        const drawing = drawings[Math.floor(Math.random() * drawings.length)];
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * radius;
        const scale = 0.18 + Math.random() * 0.35;
        doodlesRef.current.push({
          id: idRef.current++,
          drawing,
          x: x + Math.cos(angle) * distance,
          y: y + Math.sin(angle) * distance,
          scale,
          rotation: (Math.random() - 0.5) * 0.6,
          driftX: (Math.random() - 0.5) * 0.3,
          driftY: -0.2 - Math.random() * 0.35,
          age: 0,
          lifespan: 3800 + Math.random() * 2600,
        });
      }
    };

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const now = performance.now();
      const spawnInterval = 85 / clamp(zoom, 0.6, 2.6);

      if (pointerRef.current.active && now - lastSpawnRef.current > spawnInterval) {
        const zoomFactor = clamp(zoom, 0.6, 2.6);
        const count = Math.round(1.2 + zoomFactor * 1.1);
        const radius = 90 / zoomFactor;
        spawnDoodles(count, radius);
        lastSpawnRef.current = now;
      }

      const nextDoodles: FloatingDoodle[] = [];

      for (const doodle of doodlesRef.current) {
        doodle.age += 16;
        const progress = doodle.age / doodle.lifespan;
        if (progress >= 1) continue;

        const fadeIn = Math.min(progress / 0.2, 1);
        const fadeOut = Math.min((1 - progress) / 0.35, 1);
        const alpha = Math.min(fadeIn, fadeOut);

        doodle.x += doodle.driftX;
        doodle.y += doodle.driftY;

        drawDoodle(ctx, doodle, alpha);
        nextDoodles.push(doodle);
      }

      doodlesRef.current = nextDoodles;
    };

    resize();
    animationId = requestAnimationFrame(animate);
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationId);
    };
  }, [zoom]);

  useEffect(() => {
    const handleMove = (event: MouseEvent) => {
      pointerRef.current = { x: event.clientX, y: event.clientY, active: true };
    };

    const handleLeave = () => {
      pointerRef.current.active = false;
    };

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const delta = event.deltaY < 0 ? 0.12 : -0.12;
      setZoom((prev) => clamp(prev + delta, 0.6, 2.6));
    };

    const handleClick = () => {
      setZoom((prev) => clamp(prev + 0.18, 0.6, 2.6));
      const zoomFactor = clamp(zoom + 0.18, 0.6, 2.6);
      spawnBurst(zoomFactor);
    };

    const spawnBurst = (zoomFactor: number) => {
      const drawings = drawingsRef.current;
      if (!drawings.length) return;
      const { x, y } = pointerRef.current;
      const burstCount = Math.round(4 + zoomFactor * 3);
      const radius = 60 / zoomFactor;

      for (let i = 0; i < burstCount; i += 1) {
        const drawing = drawings[Math.floor(Math.random() * drawings.length)];
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * radius;
        doodlesRef.current.push({
          id: idRef.current++,
          drawing,
          x: x + Math.cos(angle) * distance,
          y: y + Math.sin(angle) * distance,
          scale: 0.22 + Math.random() * 0.38,
          rotation: (Math.random() - 0.5) * 0.6,
          driftX: (Math.random() - 0.5) * 0.35,
          driftY: -0.25 - Math.random() * 0.4,
          age: 0,
          lifespan: 3400 + Math.random() * 2400,
        });
      }
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseleave", handleLeave);
    window.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("click", handleClick);

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseleave", handleLeave);
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("click", handleClick);
    };
  }, [zoom]);

  return (
    <main className="moon-stage" style={{ backgroundImage: `url(${BACKGROUND_IMAGE_URL})` }}>
      <canvas ref={canvasRef} className="moon-canvas" aria-hidden="true" />
      <div className="moon-vignette" aria-hidden="true" />
    </main>
  );
}

const normalizeDrawing = (drawing: QuickDrawStroke[]): NormalizedDrawing => {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  drawing.forEach(([xs, ys]) => {
    xs.forEach((x) => {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
    });
    ys.forEach((y) => {
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    });
  });

  const width = maxX - minX || 1;
  const height = maxY - minY || 1;
  const centerX = minX + width / 2;
  const centerY = minY + height / 2;

  return {
    strokes: drawing,
    width,
    height,
    centerX,
    centerY,
  };
};

const drawDoodle = (ctx: CanvasRenderingContext2D, doodle: FloatingDoodle, alpha: number) => {
  const { drawing, x, y, scale, rotation } = doodle;
  const size = 140 * scale;
  const scaleX = size / drawing.width;
  const scaleY = size / drawing.height;
  const lineWidth = 1.2 + scale * 1.3;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = `rgba(238, 245, 255, ${0.72 * alpha})`;
  ctx.lineWidth = lineWidth;
  ctx.shadowColor = `rgba(190, 210, 255, ${0.45 * alpha})`;
  ctx.shadowBlur = 12 * alpha;

  ctx.beginPath();
  for (const [xs, ys] of drawing.strokes) {
    xs.forEach((px, index) => {
      const py = ys[index];
      const dx = (px - drawing.centerX) * scaleX;
      const dy = (py - drawing.centerY) * scaleY;
      if (index === 0) ctx.moveTo(dx, dy);
      else ctx.lineTo(dx, dy);
    });
  }
  ctx.stroke();
  ctx.restore();
};
