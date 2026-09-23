"use client";

import { useEffect, useRef } from "react";

type Point = [number, number];

const regions: Record<string, { lat: number; lon: number; city: string; count: number }> = {
  Pernambuco: { lat: -7.6, lon: -40.5, city: "Araripina", count: 164 },
  "Rio de Janeiro": { lat: -22.91, lon: -43.17, city: "Rio de Janeiro", count: 428 },
  Goiás: { lat: -16.68, lon: -49.25, city: "Goiânia", count: 217 },
};

const land: Point[][] = [
  [[-168,71],[-155,70],[-145,61],[-135,58],[-129,52],[-126,49],[-124,43],[-122,37],[-117,32],[-111,31],[-105,25],[-97,26],[-94,19],[-88,17],[-86,21],[-83,23],[-81,26],[-80,32],[-75,35],[-74,40],[-67,47],[-60,50],[-56,53],[-63,60],[-76,63],[-91,72],[-110,75],[-130,71],[-150,70],[-168,71]],
  [[-80,9],[-77,8],[-75,11],[-71,12],[-68,11],[-64,11],[-61,9],[-60,7],[-52,4],[-49,1],[-50,-1],[-44,-2],[-42,-5],[-35,-6],[-35,-8],[-36,-11],[-38,-15],[-39,-18],[-41,-21],[-44,-23],[-48,-27],[-53,-33],[-57,-38],[-62,-40],[-64,-47],[-67,-54],[-70,-55],[-72,-51],[-73,-45],[-73,-38],[-71,-31],[-71,-25],[-70,-18],[-73,-13],[-76,-8],[-81,-5],[-80,0],[-77,5],[-80,9]],
  [[-10,36],[5,36],[23,32],[34,30],[43,12],[50,-12],[38,-35],[19,-35],[10,-25],[-5,-5],[-17,14],[-10,36]],
  [[-10,36],[4,44],[20,55],[42,62],[70,70],[105,72],[140,58],[160,51],[146,38],[122,22],[105,8],[82,10],[66,24],[47,30],[35,38],[18,42],[-10,36]],
  [[112,-11],[130,-13],[146,-20],[153,-30],[143,-40],[121,-34],[112,-22],[112,-11]],
  [[-52,60],[-28,71],[-38,82],[-58,84],[-72,76],[-52,60]],
];

// Fronteiras simplificadas da América do Sul: mantêm os países legíveis no globo
// sem transformar a visualização em um mapa político pesado.
const countryBorders: Point[][] = [
  [[-73,-7],[-60,-7],[-50,-1],[-44,-2],[-35,-6],[-38,-15],[-48,-27],[-53,-33],[-58,-34],[-64,-30],[-68,-24],[-72,-18],[-73,-7]],
  [[-58,-22],[-54,-24],[-53,-30],[-58,-34],[-65,-38],[-68,-47],[-67,-54],[-64,-47],[-57,-38],[-52,-33],[-54,-24],[-58,-22]],
  [[-69,-18],[-66,-24],[-68,-30],[-72,-35],[-73,-45],[-70,-55],[-67,-54],[-68,-47],[-65,-38],[-63,-30],[-66,-24],[-69,-18]],
  [[-79,1],[-75,3],[-72,1],[-69,-4],[-73,-7],[-77,-5],[-79,1]],
  [[-81,-5],[-77,-8],[-73,-7],[-72,-18],[-76,-13],[-81,-5]],
  [[-68,-10],[-60,-10],[-57,-16],[-58,-22],[-64,-22],[-68,-18],[-68,-10]],
  [[-58,-30],[-53,-30],[-53,-35],[-58,-35],[-58,-30]],
];

const inside = ([x, y]: Point, polygon: Point[]) => {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i], [xj, yj] = polygon[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
};

type GlobeLocation = { lat: number; lon: number; city: string; count: number };

export function InteractiveGlobe({ region, location, color = "#ff6a2b" }: { region: string; location?: GlobeLocation; color?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const camera = useRef({ lat: -15, lon: -54 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const selected = location ?? regions[region] ?? regions.Pernambuco;
    const hex = color.replace("#", "");
    const [cr, cg, cb] = [0, 2, 4].map(index => Number.parseInt(hex.slice(index, index + 2), 16));
    const target = { lat: selected.lat, lon: selected.lon };
    const from = { ...camera.current };
    const lonDelta = ((target.lon - from.lon + 540) % 360) - 180;
    const transitionStarted = performance.now();
    const transitionDuration = 1550;
    let frame = 0;
    let hover = false;
    let marker = { x: 0, y: 0 };
    const ratio = Math.min(window.devicePixelRatio || 1, 2);

    const size = () => {
      const bounds = canvas.getBoundingClientRect();
      const width = Math.max(360, Math.round(bounds.width));
      const height = Math.max(360, Math.round(bounds.height));
      if (canvas.width !== width * ratio || canvas.height !== height * ratio) {
        canvas.width = width * ratio;
        canvas.height = height * ratio;
      }
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      return { width, height };
    };

    const project = (lat: number, lon: number, cx: number, cy: number, radius: number) => {
      const p = Math.PI / 180;
      const phi = lat * p, lambda = lon * p;
      const camPhi = camera.current.lat * p, camLambda = camera.current.lon * p;
      const vx = Math.cos(phi) * Math.cos(lambda), vy = Math.cos(phi) * Math.sin(lambda), vz = Math.sin(phi);
      const east: [number, number, number] = [-Math.sin(camLambda), Math.cos(camLambda), 0];
      const north: [number, number, number] = [-Math.sin(camPhi) * Math.cos(camLambda), -Math.sin(camPhi) * Math.sin(camLambda), Math.cos(camPhi)];
      const front: [number, number, number] = [Math.cos(camPhi) * Math.cos(camLambda), Math.cos(camPhi) * Math.sin(camLambda), Math.sin(camPhi)];
      const x = vx * east[0] + vy * east[1] + vz * east[2];
      const y = vx * north[0] + vy * north[1] + vz * north[2];
      const z = vx * front[0] + vy * front[1] + vz * front[2];
      return { x: cx + x * radius, y: cy - y * radius, z };
    };

    const line = (points: Point[], cx: number, cy: number, radius: number, alpha = 0.35) => {
      ctx.beginPath();
      let drawing = false;
      for (const [lon, lat] of points) {
        const p = project(lat, lon, cx, cy, radius);
        if (p.z <= 0.02) { drawing = false; continue; }
        if (!drawing) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
        drawing = true;
      }
      ctx.strokeStyle = `rgba(${cr},${cg},${cb},${alpha})`;
      ctx.stroke();
    };

    const draw = (now = performance.now()) => {
      const progress = Math.min(1, (now - transitionStarted) / transitionDuration);
      const ease = (value: number) => value < .5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;
      const travelProgress = ease(progress);
      camera.current.lat = from.lat + (target.lat - from.lat) * travelProgress;
      camera.current.lon = from.lon + lonDelta * travelProgress;
      const { width, height } = size();
      const cx = width / 2, cy = height / 2;
      const zoom = 1.08 - Math.sin(progress * Math.PI) * .13;
      const radius = Math.min(width, height) * 0.47 * zoom;
      ctx.clearRect(0, 0, width, height);

      const body = ctx.createRadialGradient(cx - radius * .3, cy - radius * .28, radius * .05, cx, cy, radius);
      body.addColorStop(0, `rgba(${cr},${cg},${cb},.18)`);
      body.addColorStop(.46, "#100d0b");
      body.addColorStop(1, "#030303");
      ctx.beginPath();ctx.arc(cx, cy, radius, 0, Math.PI * 2);ctx.fillStyle = body;ctx.fill();

      ctx.lineWidth = .75;
      for (let lat = -75; lat <= 75; lat += 15) {
        const points: Point[] = [];
        for (let lon = -180; lon <= 180; lon += 3) points.push([lon, lat]);
        line(points, cx, cy, radius, .18);
      }
      for (let lon = -180; lon < 180; lon += 15) {
        const points: Point[] = [];
        for (let lat = -89; lat <= 89; lat += 3) points.push([lon, lat]);
        line(points, cx, cy, radius, .18);
      }

      for (let lat = -56; lat <= 78; lat += 3.2) {
        for (let lon = -174; lon <= 174; lon += 3.2) {
          if (!land.some(poly => inside([lon, lat], poly))) continue;
          const p = project(lat, lon, cx, cy, radius);
          if (p.z <= .03) continue;
          ctx.beginPath();ctx.arc(p.x, p.y, .55 + p.z * .65, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${cr},${cg},${cb},${.2 + p.z * .75})`;ctx.fill();
        }
      }
      ctx.lineWidth = 1.1;
      land.forEach(poly => line(poly, cx, cy, radius, .72));
      ctx.lineWidth = .72;
      countryBorders.forEach(poly => line(poly, cx, cy, radius, .5));

      const shade = ctx.createRadialGradient(cx - radius * .38, cy - radius * .34, radius * .05, cx + radius * .18, cy + radius * .1, radius * 1.12);
      shade.addColorStop(0, `rgba(${cr},${cg},${cb},.11)`);shade.addColorStop(.48, "rgba(0,0,0,0)");shade.addColorStop(1, "rgba(0,0,0,.82)");
      ctx.beginPath();ctx.arc(cx, cy, radius, 0, Math.PI * 2);ctx.fillStyle = shade;ctx.fill();
      ctx.beginPath();ctx.arc(cx, cy, radius, 0, Math.PI * 2);ctx.lineWidth = 1.25;ctx.strokeStyle = `rgba(${cr},${cg},${cb},.72)`;ctx.stroke();

      marker = project(selected.lat, selected.lon, cx, cy, radius);
      ctx.beginPath();ctx.arc(marker.x, marker.y, hover ? 10 : 7, 0, Math.PI * 2);ctx.fillStyle = `rgba(${cr},${cg},${cb},.2)`;ctx.fill();
      ctx.beginPath();ctx.arc(marker.x, marker.y, 3.2, 0, Math.PI * 2);ctx.fillStyle = "#fff4df";ctx.fill();
      if (hover) {
        const bx = Math.min(marker.x + 16, width - 176), by = Math.max(marker.y - 56, 16);
        ctx.fillStyle = "rgba(13,13,14,.96)";ctx.strokeStyle = color;ctx.lineWidth = 1;
        ctx.beginPath();ctx.roundRect(bx, by, 160, 50, 8);ctx.fill();ctx.stroke();
        ctx.fillStyle = "#fff";ctx.font = "600 12px Arial";ctx.fillText(region, bx + 11, by + 20);
        ctx.fillStyle = "#d98d61";ctx.font = "10px Arial";ctx.fillText(`${selected.city} · ${selected.count} leads`, bx + 11, by + 38);
      }
      frame = requestAnimationFrame(draw);
    };

    const move = (event: MouseEvent) => {
      const bounds = canvas.getBoundingClientRect();
      const x = event.clientX - bounds.left, y = event.clientY - bounds.top;
      hover = Math.hypot(x - marker.x, y - marker.y) < 22;
      canvas.style.cursor = hover ? "pointer" : "default";
    };
    const leave = () => { hover = false; canvas.style.cursor = "default"; };
    canvas.addEventListener("mousemove", move);canvas.addEventListener("mouseleave", leave);draw();
    return () => { cancelAnimationFrame(frame);canvas.removeEventListener("mousemove", move);canvas.removeEventListener("mouseleave", leave); };
  }, [region, location, color]);

  return <canvas ref={canvasRef} className="globe-canvas" aria-label={`Globo 3D apontando para ${region}`} />;
}
