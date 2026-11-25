// Warung Rush — render.js
// Every canvas draw call lives here. It reads game state and draws it — it
// never writes to game state. Layout constants are exported so game.js can
// hit-test the same rectangles this file draws.

import { INGREDIENTS, INGREDIENT_BY_ID, DISHES, STATIONS } from './recipes.js';

export const W = 1280;
export const H = 720;

// Warung palette (from the design spec): terracotta walls, zinc counter,
// slate-green chalkboard, cream tickets, batik gold. Warmed and saturated
// in the v3 revision so the stall reads as a glowing evening warung, not a
// pale UI grid: deep terracotta wall, richer sage zinc, warm wood.
export const PAL = {
  wall: '#B85A26',
  wallDark: '#8F4519',
  zinc: '#6E9A86',
  zincDark: '#557A6A',
  wood: '#8A5426',
  woodLight: '#B07A3E',
  chalk: '#2D4A3E',
  chalkLight: '#3A5C4C',
  ticket: '#F5EDD6',
  gold: '#E8A833',
  green: '#4CAF50',
  yellow: '#F2C14E',
  red: '#D32F2F',
  cream: '#FFF6DC',
  ink: '#2B2118',
};

export const LAYOUT = {
  hud: { x: 0, y: 0, w: W, h: 56 },
  board: { x: 24, y: 64, w: W - 48, h: 136 },
  ticketW: 262,
  ticketH: 116,
  ticketGap: 10,
  wall: { x: 0, y: 208, w: W, h: 40 },
  bins: { x: 24, y: 264, w: 576, h: 252, cols: 5, rows: 2 },
  binW: 108,
  binH: 118,
  pan: { x: 620, y: 264, w: 160, h: 252 },
  stations: { x: 800, y: 264, w: 456, h: 252 },
  stationW: 144,
  stationH: 252,
  bottom: { x: 0, y: 528, w: W, h: 192 },
  plates: { x: 24, y: 540, w: 560, h: 164 },
  plateW: 268,
  plateH: 164,
  side: { x: 608, y: 540, w: 648, h: 164 },
};

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function text(ctx, str, x, y, size, color, align = 'center', weight = 'bold') {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px "Trebuchet MS", "Segoe UI", sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(str, x, y);
}

// Warm light: a soft radial glow that fades to transparent. Used for the
// wok fire, the grill heat and the golden light over plated food.
function radialGlow(ctx, x, y, r, inner, outer) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

// One face: skin circle, two eyes with a glint, eyebrows and a smile.
// `opts` picks the headwear / hair so each customer reads as a person.
function drawFace(ctx, cx, cy, r, skin, opts = {}) {
  ctx.save();
  // Head.
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  // Ears.
  ctx.beginPath(); ctx.arc(cx - r, cy, r * 0.22, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + r, cy, r * 0.22, 0, Math.PI * 2); ctx.fill();
  // Headwear / hair, drawn over the top of the head.
  if (opts.hijab) {
    // The hijab frames the face: a full covering, then the face opening.
    ctx.fillStyle = opts.hijab;
    ctx.beginPath(); ctx.arc(cx, cy, r * 1.12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.08, r * 0.68, r * 0.78, 0, 0, Math.PI * 2); ctx.fill();
  } else if (opts.peci) {
    ctx.fillStyle = '#1A1A1A';
    ctx.beginPath(); ctx.ellipse(cx, cy - r * 0.62, r * 0.82, r * 0.5, 0, Math.PI, 0); ctx.fill();
    ctx.fillRect(cx - r * 0.82, cy - r * 0.66, r * 1.64, r * 0.16);
  } else if (opts.hair) {
    ctx.fillStyle = opts.hair;
    ctx.beginPath(); ctx.arc(cx, cy - r * 0.18, r * 0.92, Math.PI * 1.02, Math.PI * 1.98); ctx.fill();
    // A tuft sticking up.
    ctx.beginPath(); ctx.moveTo(cx - r * 0.3, cy - r * 0.95);
    ctx.quadraticCurveTo(cx - r * 0.1, cy - r * 1.45, cx + r * 0.25, cy - r * 1.0);
    ctx.quadraticCurveTo(cx, cy - r * 0.8, cx - r * 0.3, cy - r * 0.95);
    ctx.fill();
  } else if (opts.bandana) {
    // A bandana cap: the top half of the head, straight edge at the brow.
    ctx.fillStyle = opts.bandana;
    ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI, 0); ctx.closePath(); ctx.fill();
    // Knot tails on the side.
    ctx.beginPath();
    ctx.moveTo(cx + r * 0.9, cy - r * 0.28);
    ctx.lineTo(cx + r * 1.45, cy - r * 0.1);
    ctx.lineTo(cx + r * 1.3, cy + r * 0.22);
    ctx.lineTo(cx + r * 0.82, cy + r * 0.08);
    ctx.closePath(); ctx.fill();
  }
  // Eyes: dark dots with a white glint, set wide so they read at a glance.
  const eyeY = cy + r * 0.02;
  const eyeDX = r * 0.36;
  const eyeR = Math.max(2.2, r * 0.11);
  for (const s of [-1, 1]) {
    ctx.fillStyle = '#2B2118';
    ctx.beginPath(); ctx.arc(cx + s * eyeDX, eyeY, eyeR, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath(); ctx.arc(cx + s * eyeDX + eyeR * 0.3, eyeY - eyeR * 0.3, eyeR * 0.35, 0, Math.PI * 2); ctx.fill();
  }
  // Eyebrows, angled for expression.
  ctx.strokeStyle = '#2B2118';
  ctx.lineWidth = Math.max(1.6, r * 0.09);
  ctx.beginPath(); ctx.moveTo(cx - eyeDX - eyeR, eyeY - r * 0.28);
  ctx.lineTo(cx - eyeDX + eyeR, eyeY - r * 0.32); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + eyeDX - eyeR, eyeY - r * 0.32);
  ctx.lineTo(cx + eyeDX + eyeR, eyeY - r * 0.28); ctx.stroke();
  // Blush.
  ctx.fillStyle = 'rgba(211,47,47,0.35)';
  ctx.beginPath(); ctx.arc(cx - r * 0.58, cy + r * 0.38, r * 0.16, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + r * 0.58, cy + r * 0.38, r * 0.16, 0, Math.PI * 2); ctx.fill();
  // Smile: open and eager, or a closed grin.
  if (opts.openSmile) {
    ctx.fillStyle = '#7A1F1F';
    ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.48, r * 0.3, r * 0.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(cx - r * 0.22, cy + r * 0.36, r * 0.44, r * 0.1);
  } else {
    ctx.strokeStyle = '#2B2118';
    ctx.lineWidth = Math.max(1.8, r * 0.1);
    ctx.beginPath(); ctx.arc(cx, cy + r * 0.22, r * 0.34, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
  }
  // Mustache, for the bapak.
  if (opts.mustache) {
    ctx.fillStyle = '#2B2118';
    ctx.beginPath(); ctx.ellipse(cx - r * 0.16, cy + r * 0.34, r * 0.24, r * 0.1, -0.25, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + r * 0.16, cy + r * 0.34, r * 0.24, r * 0.1, 0.25, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- dishes
// Each dish is drawn from canvas shapes only — original art, no images.

export function drawDish(ctx, dishId, cx, cy, s) {
  const d = DISHES[dishId];
  if (!d) return;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  if (dishId === 'nasgor') {
    // Banana leaf, then the plate, then a golden rice mound + fried egg.
    ctx.fillStyle = '#2E7D32';
    ctx.beginPath(); ctx.ellipse(0, 6, 62, 20, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath(); ctx.ellipse(0, 4, 56, 17, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#E8A833';
    ctx.beginPath(); ctx.arc(0, -6, 34, Math.PI, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#C98A1F';
    for (let i = 0; i < 9; i++) {
      ctx.beginPath();
      ctx.arc(-24 + i * 6 + (i % 2) * 3, -14 - (i % 3) * 6, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#FFFDF5';
    ctx.beginPath(); ctx.ellipse(8, -26, 16, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#F2C14E';
    ctx.beginPath(); ctx.arc(8, -26, 6.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2E7D32';
    ctx.fillRect(-26, -34, 10, 3); ctx.fillRect(14, -36, 10, 3);
    ctx.fillStyle = '#D32F2F';
    ctx.beginPath(); ctx.arc(-14, -30, 3, 0, Math.PI * 2); ctx.fill();
  } else if (dishId === 'mieayam') {
    // Bowl of noodles: amber broth, wavy noodle strands, chicken cubes.
    ctx.fillStyle = '#B8542E';
    ctx.beginPath(); ctx.arc(0, 0, 52, 0, Math.PI); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#F2C14E';
    ctx.beginPath(); ctx.ellipse(0, -2, 48, 14, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#D97B29';
    ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(-40, -10 + i * 6);
      ctx.bezierCurveTo(-20, -16 + i * 6, 0, -4 + i * 6, 20, -10 + i * 6);
      ctx.bezierCurveTo(32, -14 + i * 6, 40, -8 + i * 6, 40, -8 + i * 6);
      ctx.stroke();
    }
    ctx.fillStyle = '#F2B8A0';
    ctx.fillRect(-30, -22, 14, 12); ctx.fillRect(4, -26, 14, 12); ctx.fillRect(24, -18, 12, 10);
    ctx.fillStyle = '#2E7D32';
    ctx.fillRect(-38, -28, 12, 3); ctx.fillRect(18, -30, 12, 3); ctx.fillRect(-6, -32, 12, 3);
  } else if (dishId === 'sate') {
    // Three skewers over a banana leaf, peanut sauce drizzle.
    ctx.fillStyle = '#2E7D32';
    ctx.beginPath(); ctx.ellipse(0, 14, 62, 16, 0, 0, Math.PI * 2); ctx.fill();
    for (let k = 0; k < 3; k++) {
      const y = -18 + k * 16;
      ctx.strokeStyle = '#8A5A2B';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(-56, y); ctx.lineTo(56, y); ctx.stroke();
      ctx.fillStyle = '#8A4A1A';
      for (let i = 0; i < 4; i++) {
        const x = -36 + i * 24;
        roundRect(ctx, x - 8, y - 8, 16, 16, 4); ctx.fill();
        ctx.fillStyle = '#5E2E08';
        ctx.fillRect(x - 8, y - 2, 16, 3);
        ctx.fillStyle = '#8A4A1A';
      }
    }
    ctx.strokeStyle = '#C98A3D';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-40, 26); ctx.quadraticCurveTo(0, 34, 40, 26); ctx.stroke();
  } else if (dishId === 'esteh') {
    // Sweating glass of sweet iced tea with a straw.
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    roundRect(ctx, -26, -34, 52, 68, 8); ctx.fill();
    ctx.fillStyle = '#A8642A';
    roundRect(ctx, -22, -18, 44, 48, 6); ctx.fill();
    ctx.fillStyle = '#7A4218';
    roundRect(ctx, -22, -18, 44, 12, 6); ctx.fill();
    ctx.fillStyle = '#BFE8FF';
    ctx.save(); ctx.translate(-10, -4); ctx.rotate(0.4); ctx.fillRect(-7, -7, 14, 14); ctx.restore();
    ctx.save(); ctx.translate(10, 8); ctx.rotate(-0.3); ctx.fillRect(-7, -7, 14, 14); ctx.restore();
    ctx.strokeStyle = '#D32F2F';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(14, -46); ctx.lineTo(22, -20); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath(); ctx.arc(-16, 20, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(-8, 28, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(14, 24, 2.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- ingredients
export function drawIngredient(ctx, ingId, cx, cy, r) {
  const ing = INGREDIENT_BY_ID[ingId];
  if (!ing) return;
  ctx.save();
  ctx.translate(cx, cy);
  const u = r / 26;
  ctx.scale(u, u);
  ctx.lineWidth = 2;
  if (ingId === 'nasi') {
    ctx.fillStyle = '#E8E0C8';
    ctx.beginPath(); ctx.ellipse(0, 12, 26, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FFF6DC';
    ctx.beginPath(); ctx.arc(0, 4, 20, Math.PI, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#D9C48A';
    for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(-12 + i * 5, -2 - (i % 2) * 5, 1.6, 0, Math.PI * 2); ctx.fill(); }
  } else if (ingId === 'mie') {
    ctx.strokeStyle = '#F2C14E'; ctx.lineWidth = 4;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.moveTo(-22, -10 + i * 10);
      ctx.bezierCurveTo(-8, -16 + i * 10, 8, -4 + i * 10, 22, -10 + i * 10); ctx.stroke();
    }
  } else if (ingId === 'ayam') {
    ctx.fillStyle = '#F2B8A0';
    ctx.beginPath(); ctx.arc(-4, -4, 15, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#FFFDF5'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(8, 8); ctx.lineTo(20, 20); ctx.stroke();
    ctx.fillStyle = '#FFFDF5';
    ctx.beginPath(); ctx.arc(22, 22, 5, 0, Math.PI * 2); ctx.fill();
  } else if (ingId === 'telur') {
    ctx.fillStyle = '#FFFDF5';
    ctx.beginPath(); ctx.ellipse(0, 0, 18, 23, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#F2C14E';
    ctx.beginPath(); ctx.arc(0, 4, 8, 0, Math.PI * 2); ctx.fill();
  } else if (ingId === 'sate') {
    ctx.strokeStyle = '#8A5A2B'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-24, 10); ctx.lineTo(24, -14); ctx.stroke();
    ctx.fillStyle = '#8A4A1A';
    for (let i = 0; i < 3; i++) {
      const x = -12 + i * 13, y = 2 - i * 8;
      roundRect(ctx, x - 7, y - 7, 14, 14, 3); ctx.fill();
    }
  } else if (ingId === 'kecap') {
    ctx.fillStyle = '#5B2E1E';
    roundRect(ctx, -11, -6, 22, 30, 5); ctx.fill();
    ctx.fillRect(-5, -20, 10, 16);
    ctx.fillStyle = '#E8A833';
    ctx.fillRect(-11, 4, 22, 10);
    text(ctx, 'KECAP', 0, 9, 7, '#FFF6DC');
  } else if (ingId === 'sambal') {
    ctx.fillStyle = '#FFFDF5';
    ctx.beginPath(); ctx.arc(0, 6, 22, 0, Math.PI); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#D32F2F';
    ctx.beginPath(); ctx.ellipse(0, 2, 19, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7A1414';
    ctx.beginPath(); ctx.arc(-7, 0, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(8, 2, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2E7D32';
    ctx.fillRect(10, -14, 3, 10);
  } else if (ingId === 'bawang') {
    ctx.strokeStyle = '#E8C8E8'; ctx.lineWidth = 4;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(0, 0, 8 + i * 6, 0, Math.PI * 2); ctx.stroke(); }
    ctx.strokeStyle = '#8E5A8E'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.stroke();
  } else if (ingId === 'teh') {
    ctx.fillStyle = '#A8642A';
    ctx.beginPath(); ctx.moveTo(-12, -22); ctx.lineTo(12, -22); ctx.lineTo(18, 20); ctx.lineTo(-18, 20); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#5E3410'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(18, 0, 10, -Math.PI / 2, Math.PI / 2); ctx.stroke();
    ctx.fillStyle = '#E8C8A0';
    ctx.fillRect(-12, -22, 24, 5);
  } else if (ingId === 'es') {
    ctx.fillStyle = '#BFE8FF';
    ctx.strokeStyle = '#4A90B8'; ctx.lineWidth = 2;
    for (const [x, y, rot] of [[-10, -6, 0.3], [10, -8, -0.4], [0, 12, 0.1]]) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
      ctx.fillRect(-9, -9, 18, 18); ctx.strokeRect(-9, -9, 18, 18);
      ctx.restore();
    }
  }
  ctx.restore();
}

function drawFlame(ctx, x, y, s, t) {
  ctx.save();
  ctx.translate(x, y);
  const wob = Math.sin(t * 9 + x) * 0.12;
  ctx.scale(s * (1 + wob), s);
  ctx.fillStyle = '#F08A1D';
  ctx.beginPath();
  ctx.moveTo(0, -18);
  ctx.quadraticCurveTo(12, -4, 8, 8);
  ctx.quadraticCurveTo(4, 14, 0, 14);
  ctx.quadraticCurveTo(-4, 14, -8, 8);
  ctx.quadraticCurveTo(-12, -4, 0, -18);
  ctx.fill();
  ctx.fillStyle = '#F2C14E';
  ctx.beginPath();
  ctx.moveTo(0, -8);
  ctx.quadraticCurveTo(6, 0, 4, 8);
  ctx.quadraticCurveTo(0, 12, -4, 8);
  ctx.quadraticCurveTo(-6, 0, 0, -8);
  ctx.fill();
  ctx.restore();
}

function drawHeart(ctx, x, y, s, filled) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = filled ? '#D32F2F' : 'rgba(255,255,255,0.25)';
  ctx.beginPath();
  ctx.moveTo(0, 10);
  ctx.bezierCurveTo(-14, -2, -8, -12, 0, -5);
  ctx.bezierCurveTo(8, -12, 14, -2, 0, 10);
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------- scene
export function drawScene(ctx, S, now) {
  // Back wall.
  ctx.fillStyle = PAL.wall;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = PAL.wallDark;
  ctx.fillRect(0, 200, W, 8);
  // Tile line on the wall.
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  for (let x = 0; x < W; x += 64) ctx.fillRect(x, 208, 2, 40);

  drawWallShelf(ctx);
  drawOrderBoard(ctx, S, now);
  drawCustomers(ctx, S, now);
  drawCounter(ctx, S, now);
  drawCook(ctx, S, now);
  // Station header, drawn over the cook's apron so it stays legible.
  text(ctx, 'KOMPOR & MINUMAN  —  klik stasiun yang menyala', LAYOUT.stations.x + 8, LAYOUT.stations.y + 8, 13, '#3E5A50', 'left');
  drawBottom(ctx, S, now);
  drawHud(ctx, S, now);
  drawParticles(ctx, S);
  if (S.banner) drawBanner(ctx, S, now);
  if (S.phase === 'title') drawTitle(ctx, S, now);
  if (S.phase === 'over') drawGameOver(ctx, S, now);
  if (S.carried) drawCarried(ctx, S);
}

function drawWallShelf(ctx) {
  // Rattan shelf with ceramic spice jars + a hand-lettered warung sign.
  // It lives in the wall strip (y 208–248), clear of the order board above.
  ctx.fillStyle = PAL.wood;
  ctx.fillRect(60, 238, 420, 10);
  ctx.fillStyle = PAL.woodLight;
  ctx.fillRect(60, 234, 420, 4);
  const jars = ['#E8C8A0', '#D32F2F', '#5B2E1E', '#F2C14E', '#4CAF50'];
  for (let i = 0; i < 5; i++) {
    const x = 84 + i * 78;
    ctx.fillStyle = jars[i];
    roundRect(ctx, x, 208, 34, 28, 6); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x + 8, 208, 18, 6);
  }
  // Sign on the right of the shelf.
  ctx.fillStyle = PAL.cream;
  roundRect(ctx, 980, 210, 276, 32, 8); ctx.fill();
  ctx.strokeStyle = PAL.red; ctx.lineWidth = 3;
  roundRect(ctx, 980, 210, 276, 32, 8); ctx.stroke();
  text(ctx, 'WARUNG RUSH  •  BUKA 24 JAM', 1118, 227, 16, PAL.red);
}

// Waiting customers: three distinct faces peeking over the counter in the
// wall strip, between the spice shelf and the sign. Each reads as a person
// (hijab, peci + mustache, excited kid), so the stall has people waiting,
// not just tickets. Drawn before the counter, so the zinc counter top
// covers their shoulders below y 256.
function drawCustomers(ctx, S, now) {
  const customers = [
    { x: 540, skin: '#E8B48A', hijab: '#2E7D6B', shirt: '#2E7D6B' },
    { x: 660, skin: '#C98A5E', peci: true, mustache: true, shirt: '#7A4A21' },
    { x: 760, skin: '#F2C49B', hair: '#1A1A1A', shirt: '#E8A833', openSmile: true },
  ];
  for (const c of customers) {
    // Shoulders, just peeking over the counter.
    ctx.fillStyle = c.shirt;
    ctx.beginPath();
    ctx.moveTo(c.x - 46, 258);
    ctx.lineTo(c.x - 30, 240);
    ctx.lineTo(c.x + 30, 240);
    ctx.lineTo(c.x + 46, 258);
    ctx.closePath(); ctx.fill();
    drawFace(ctx, c.x, 226, 26, c.skin, c);
  }
}

// The cook at the wok: head and bandana in the wall strip, shoulders over
// the counter, arms reaching down to the wok with a spatula, tossing food
// mid-air. Drawn after the counter so the cook stands in front of the
// station, arms clear of the WOK label.
function drawCook(ctx, S, now) {
  const cx = LAYOUT.stations.x + LAYOUT.stationW / 2; // 872, wok centre
  const cooking = !!S.stations.wok.dishId;
  // Head + red bandana (wall strip, clear of the order board above).
  drawFace(ctx, cx, 226, 21, '#C98A5E', { bandana: '#D32F2F', openSmile: true });
  // Neck.
  ctx.fillStyle = '#C98A5E';
  ctx.fillRect(cx - 7, 244, 14, 12);
  // Torso: red shirt + white apron, ending above the WOK label (y 302).
  ctx.fillStyle = '#B03A2E';
  ctx.beginPath();
  ctx.moveTo(cx - 24, 252);
  ctx.lineTo(cx + 24, 252);
  ctx.lineTo(cx + 52, 292);
  ctx.lineTo(cx - 52, 292);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#FFFDF5';
  roundRect(ctx, cx - 30, 258, 60, 34, 8); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 2;
  roundRect(ctx, cx - 30, 258, 60, 34, 8); ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  ctx.fillRect(cx - 18, 272, 36, 12);
  // Arms: right arm holds the spatula into the wok, left steadies the rim.
  ctx.strokeStyle = '#C98A5E';
  ctx.lineCap = 'round';
  ctx.lineWidth = 13;
  ctx.beginPath(); ctx.moveTo(cx + 46, 282); ctx.lineTo(cx + 24, 350); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx - 46, 282); ctx.lineTo(cx - 34, 338); ctx.stroke();
  // Hands.
  ctx.fillStyle = '#C98A5E';
  ctx.beginPath(); ctx.arc(cx + 24, 350, 8, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx - 34, 338, 8, 0, Math.PI * 2); ctx.fill();
  // Spatula: wooden handle from the right hand into the wok, steel blade.
  ctx.strokeStyle = '#8A5A2B';
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(cx + 24, 350); ctx.lineTo(cx + 8, 368); ctx.stroke();
  ctx.fillStyle = '#C8C8C8';
  ctx.save();
  ctx.translate(cx + 6, 370);
  ctx.rotate(-0.5);
  roundRect(ctx, -12, -7, 24, 14, 4); ctx.fill();
  ctx.restore();
  // The toss: a dashed motion arc above the wok + golden bits arcing
  // through the air, so the cook reads as mid-action. Bobs gently with
  // `now`; frozen at a fixed pose in screenshots.
  const toss = cooking ? 1 : 0.6;
  ctx.strokeStyle = 'rgba(232,168,51,0.55)';
  ctx.lineWidth = 3;
  ctx.setLineDash([8, 6]);
  ctx.beginPath(); ctx.arc(cx, 372, 46, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
  ctx.setLineDash([]);
  const dots = [[-34, -31], [-12, -44], [12, -44], [34, -31]];
  ctx.fillStyle = '#E8A833';
  dots.forEach(([dx, dy], i) => {
    const bob = Math.sin(now * 6 + i * 1.7) * 3 * toss;
    ctx.beginPath(); ctx.arc(cx + dx, 372 + dy + bob, 3.5, 0, Math.PI * 2); ctx.fill();
  });
}

function drawOrderBoard(ctx, S, now) {
  const b = LAYOUT.board;
  ctx.fillStyle = PAL.chalk;
  roundRect(ctx, b.x, b.y, b.w, b.h, 12); ctx.fill();
  ctx.strokeStyle = PAL.woodLight; ctx.lineWidth = 4;
  roundRect(ctx, b.x, b.y, b.w, b.h, 12); ctx.stroke();
  text(ctx, 'PESANAN', b.x + 62, b.y + 20, 18, '#F5EDD6', 'center');
  text(ctx, '— chalkboard —', b.x + 62, b.y + 42, 11, 'rgba(245,237,214,0.55)', 'center');

  const slotW = LAYOUT.ticketW;
  const startX = b.x + 140;
  for (let i = 0; i < 4; i++) {
    const x = startX + i * (slotW + LAYOUT.ticketGap);
    const y = b.y + 10;
    const order = S.orders[i];
    if (!order) {
      ctx.strokeStyle = 'rgba(245,237,214,0.25)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      roundRect(ctx, x, y, slotW, LAYOUT.ticketH, 10); ctx.stroke();
      ctx.setLineDash([]);
      text(ctx, '— kosong —', x + slotW / 2, y + LAYOUT.ticketH / 2, 14, 'rgba(245,237,214,0.35)');
      continue;
    }
    drawTicket(ctx, order, x, y, slotW, LAYOUT.ticketH, S, now);
  }
}

function drawTicket(ctx, order, x, y, w, h, S, now) {
  const dish = DISHES[order.dishId];
  const frac = Math.max(0, order.timeLeft / order.timeMax);
  const shake = S.shakeTicket === order.id ? Math.sin(now * 40) * 4 : 0;
  ctx.save();
  ctx.translate(shake, 0);
  ctx.fillStyle = PAL.ticket;
  roundRect(ctx, x, y, w, h, 10); ctx.fill();
  if (order.vip) {
    ctx.strokeStyle = PAL.gold; ctx.lineWidth = 4;
    roundRect(ctx, x, y, w, h, 10); ctx.stroke();
  }
  // Dish colour stripe + icon.
  ctx.fillStyle = dish.color;
  roundRect(ctx, x, y, 10, h, 5); ctx.fill();
  drawDish(ctx, order.dishId, x + 52, y + 42, 0.55);
  text(ctx, dish.name.toUpperCase(), x + 96, y + 24, 19, PAL.ink, 'left');
  // Ingredient dots the ticket needs.
  let ix = x + 96;
  for (const ingId of dish.ingredients) {
    drawIngredient(ctx, ingId, ix + 12, y + 52, 11);
    ix += 30;
  }
  text(ctx, `Rp ${dish.price}${order.vip ? '  ×3' : ''}`, x + 96, y + 82, 15, '#7A5A1A', 'left');
  if (order.vip) text(ctx, '★ VIP ★', x + w - 12, y + 82, 13, '#B98A1F', 'right');
  // Patience bar: green -> yellow -> red -> pulsing crimson.
  const barX = x + 14, barY = y + h - 20, barW = w - 28, barH = 12;
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  roundRect(ctx, barX, barY, barW, barH, 6); ctx.fill();
  let barColor = PAL.green;
  if (frac < 0.5) barColor = PAL.yellow;
  if (frac < 0.25) barColor = PAL.red;
  if (frac < 0.25) {
    const pulse = 0.7 + 0.3 * Math.sin(now * 6);
    ctx.globalAlpha = pulse;
  }
  ctx.fillStyle = barColor;
  roundRect(ctx, barX, barY, Math.max(10, barW * frac), barH, 6); ctx.fill();
  ctx.globalAlpha = 1;
  text(ctx, `${Math.ceil(order.timeLeft)} dtk`, x + w - 34, y + h - 13, 12, frac < 0.25 ? PAL.red : '#5A4A2A', 'center');
  ctx.restore();
}

function drawCounter(ctx, S, now) {
  // Zinc counter top with a wooden edge.
  ctx.fillStyle = PAL.zinc;
  ctx.fillRect(0, 256, W, 264);
  ctx.fillStyle = PAL.zincDark;
  ctx.fillRect(0, 256, W, 6);
  ctx.fillStyle = PAL.wood;
  ctx.fillRect(0, 516, W, 10);
  drawBins(ctx, S, now);
  drawPan(ctx, S, now);
  drawStations(ctx, S, now);
}

function drawBins(ctx, S, now) {
  const b = LAYOUT.bins;
  text(ctx, 'BAHAN DI ATAS MEJA  —  klik atau tekan 1–0', b.x + 8, b.y + 8, 13, '#3E5A50', 'left');
  const cols = LAYOUT.bins.cols;
  for (let i = 0; i < 10; i++) {
    const ing = INGREDIENTS[i];
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = b.x + col * (LAYOUT.binW + 8);
    const y = b.y + 16 + row * (LAYOUT.binH + 8);
    const inPan = S.pan.includes(ing.id);
    ctx.fillStyle = inPan ? '#FFF3C4' : '#FDF8E7';
    roundRect(ctx, x, y, LAYOUT.binW, LAYOUT.binH, 10); ctx.fill();
    ctx.strokeStyle = inPan ? PAL.gold : 'rgba(0,0,0,0.18)';
    ctx.lineWidth = inPan ? 3 : 2;
    roundRect(ctx, x, y, LAYOUT.binW, LAYOUT.binH, 10); ctx.stroke();
    drawIngredient(ctx, ing.id, x + LAYOUT.binW / 2, y + 46, 30);
    text(ctx, ing.name, x + LAYOUT.binW / 2, y + 92, 16, PAL.ink);
    // Key hint.
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    roundRect(ctx, x + 6, y + 6, 20, 18, 4); ctx.fill();
    text(ctx, ing.key, x + 16, y + 15, 12, '#FFFFFF');
    if (inPan) text(ctx, '✓ di piring', x + LAYOUT.binW / 2, y + LAYOUT.binH - 12, 11, '#8A6D00');
  }
}

function drawPan(ctx, S, now) {
  const p = LAYOUT.pan;
  text(ctx, 'PIRING RACIK', p.x + p.w / 2, p.y + 8, 13, '#3E5A50');
  ctx.fillStyle = '#FDF8E7';
  roundRect(ctx, p.x, p.y + 16, p.w, p.h - 60, 12); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 2;
  roundRect(ctx, p.x, p.y + 16, p.w, p.h - 60, 12); ctx.stroke();
  // Pan contents: the dish mid-assembly.
  if (S.pan.length === 0) {
    text(ctx, 'Pilih bahan', p.x + p.w / 2, p.y + 70, 14, 'rgba(43,33,24,0.45)');
    text(ctx, 'dari meja →', p.x + p.w / 2, p.y + 92, 14, 'rgba(43,33,24,0.45)');
  } else {
    const n = S.pan.length;
    S.pan.forEach((ingId, i) => {
      const cx = p.x + p.w / 2 + (i - (n - 1) / 2) * 44;
      drawIngredient(ctx, ingId, cx, p.y + 78, 24);
    });
    const matched = S.matchedDish;
    if (matched) {
      text(ctx, matched.name, p.x + p.w / 2, p.y + 128, 16, '#7A5A1A');
      text(ctx, '→ masak di ' + STATIONS[matched.station].name, p.x + p.w / 2, p.y + 150, 13, '#2E7D32');
    } else if (S.partialDishes && S.partialDishes.length === 1) {
      // Mid-assembly: name the dish and the missing ingredient.
      const dish = S.partialDishes[0];
      const missing = dish.ingredients.filter((ing) => !S.pan.includes(ing));
      text(ctx, dish.name, p.x + p.w / 2, p.y + 128, 16, '#7A5A1A');
      text(ctx, 'Butuh: ' + missing.map((m) => INGREDIENT_BY_ID[m].name).join(', '), p.x + p.w / 2, p.y + 150, 13, '#7A5A1A');
    } else if (S.partialDishes && S.partialDishes.length > 1) {
      text(ctx, 'Bisa jadi:', p.x + p.w / 2, p.y + 128, 15, '#7A5A1A');
      text(ctx, S.partialDishes.map((d) => d.name).join(' / '), p.x + p.w / 2, p.y + 150, 12, '#7A5A1A');
    } else {
      text(ctx, 'Bukan resep!', p.x + p.w / 2, p.y + 128, 15, PAL.red);
      text(ctx, 'klik bahan utk hapus', p.x + p.w / 2, p.y + 150, 12, 'rgba(43,33,24,0.6)');
    }
  }
  // Trash button: clear the pan.
  ctx.fillStyle = '#D32F2F';
  roundRect(ctx, p.x + 18, p.y + p.h - 36, p.w - 36, 28, 8); ctx.fill();
  text(ctx, 'BUANG  (U)', p.x + p.w / 2, p.y + p.h - 22, 13, '#FFFFFF');
}

function drawStations(ctx, S, now) {
  const st = LAYOUT.stations;
  // (The "KOMPOR & MINUMAN" header is drawn in drawScene, after the cook,
  // so it stays legible over the cook's apron.)
  const ids = ['wok', 'grill', 'drink'];
  ids.forEach((id, i) => {
    const x = st.x + i * (LAYOUT.stationW + 12);
    const y = st.y + 16;
    const station = S.stations[id];
    const info = STATIONS[id];
    const lit = S.matchedDish && S.matchedDish.station === id && !station.dishId;
    const glow = lit ? 0.5 + 0.5 * Math.sin(now * 5) : 0;
    ctx.fillStyle = '#3A2E22';
    roundRect(ctx, x, y, LAYOUT.stationW, LAYOUT.stationH - 60, 12); ctx.fill();
    if (lit) {
      ctx.strokeStyle = `rgba(232,168,51,${0.5 + glow * 0.5})`;
      ctx.lineWidth = 4;
      roundRect(ctx, x, y, LAYOUT.stationW, LAYOUT.stationH - 60, 12); ctx.stroke();
    }
    text(ctx, info.name, x + LAYOUT.stationW / 2, y + 22, 17, '#F5EDD6');
    // Station visual.
    if (id === 'wok') {
      // Fire glow spilling onto the counter while the wok is cooking,
      // and flames licking the pan: a big one below it, two small
      // tongues at the pan's rim. Brighter while cooking.
      if (station.dishId) {
        radialGlow(ctx, x + 72, y + 110, 190, 'rgba(255,166,40,0.32)', 'rgba(255,166,40,0)');
      }
      const fs = station.dishId ? 1.4 : 1.1;
      drawFlame(ctx, x + 72, y + 138, fs, now);
      drawFlame(ctx, x + 26, y + 102, fs * 0.55, now + 0.7);
      drawFlame(ctx, x + 118, y + 102, fs * 0.55, now + 1.3);
      ctx.fillStyle = '#1A1A1A';
      ctx.beginPath(); ctx.arc(x + 72, y + 96, 46, 0, Math.PI); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#2E2E2E';
      ctx.beginPath(); ctx.ellipse(x + 72, y + 96, 46, 10, 0, 0, Math.PI * 2); ctx.fill();
    } else if (id === 'grill') {
      // Grill heat glow while something is on the grill.
      if (station.dishId) {
        radialGlow(ctx, x + 72, y + 100, 150, 'rgba(240,138,29,0.30)', 'rgba(240,138,29,0)');
      }
      const g = 0.6 + 0.4 * Math.sin(now * 3);
      ctx.fillStyle = `rgba(240,138,29,${0.25 + g * 0.3})`;
      roundRect(ctx, x + 14, y + 60, 116, 78, 8); ctx.fill();
      ctx.strokeStyle = '#1A1A1A'; ctx.lineWidth = 4;
      for (let k = 0; k < 4; k++) {
        ctx.beginPath(); ctx.moveTo(x + 18, y + 74 + k * 18); ctx.lineTo(x + 126, y + 74 + k * 18); ctx.stroke();
      }
    } else {
      ctx.fillStyle = '#BFE8FF';
      roundRect(ctx, x + 46, y + 56, 52, 84, 8); ctx.fill();
      ctx.fillStyle = '#A8642A';
      roundRect(ctx, x + 50, y + 76, 44, 60, 6); ctx.fill();
      ctx.fillStyle = '#FFFDF5';
      ctx.beginPath(); ctx.arc(x + 72, y + 66, 8, 0, Math.PI * 2); ctx.fill();
    }
    if (station.dishId) {
      if (station.done) {
        drawDish(ctx, station.dishId, x + 72, y + 108, 0.62);
        text(ctx, 'SIAP!', x + 72, y + 168, 16, PAL.gold);
      } else {
        // Cooking progress ring + the dish fading in.
        const p = station.progress;
        ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 8;
        ctx.beginPath(); ctx.arc(x + 72, y + 104, 34, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = PAL.gold;
        ctx.beginPath(); ctx.arc(x + 72, y + 104, 34, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 0.35 + p * 0.65;
        drawDish(ctx, station.dishId, x + 72, y + 104, 0.5);
        ctx.globalAlpha = 1;
        text(ctx, info.verb + '…', x + 72, y + 168, 14, '#F5EDD6');
      }
    } else if (lit) {
      text(ctx, 'MASAK! →', x + 72, y + 168, 17, PAL.gold);
    } else {
      text(ctx, '— kosong —', x + 72, y + 168, 13, 'rgba(245,237,214,0.5)');
    }
  });
}

function drawBottom(ctx, S, now) {
  const b = LAYOUT.bottom;
  ctx.fillStyle = '#6B3A12';
  ctx.fillRect(0, b.y, W, b.h);
  ctx.fillStyle = '#8A5426';
  ctx.fillRect(0, b.y, W, 6);
  // Serving plates.
  const pl = LAYOUT.plates;
  text(ctx, 'PIRING SAJI  —  klik piring, lalu klik pesanan', pl.x + 8, pl.y + 4, 14, '#F5EDD6', 'left');
  for (let i = 0; i < 2; i++) {
    const x = pl.x + i * (LAYOUT.plateW + 16);
    const y = pl.y + 16;
    const dishId = S.plates[i];
    ctx.fillStyle = dishId ? '#FFFDF5' : 'rgba(255,255,255,0.10)';
    roundRect(ctx, x, y, LAYOUT.plateW, LAYOUT.plateH - 16, 12); ctx.fill();
    if (dishId) {
      // Warm golden light over the finished food, so it glows.
      radialGlow(ctx, x + LAYOUT.plateW / 2, y + 52, 95, 'rgba(232,168,51,0.28)', 'rgba(232,168,51,0)');
      ctx.strokeStyle = PAL.gold; ctx.lineWidth = 3;
      roundRect(ctx, x, y, LAYOUT.plateW, LAYOUT.plateH - 16, 12); ctx.stroke();
      drawDish(ctx, dishId, x + LAYOUT.plateW / 2, y + 52, 0.95);
      text(ctx, DISHES[dishId].name.toUpperCase(), x + LAYOUT.plateW / 2, y + LAYOUT.plateH - 42, 16, PAL.ink);
      text(ctx, 'SIAP DISAJIKAN', x + LAYOUT.plateW / 2, y + LAYOUT.plateH - 24, 11, '#2E7D32');
    } else {
      text(ctx, '— piring kosong —', x + LAYOUT.plateW / 2, y + (LAYOUT.plateH - 16) / 2, 14, 'rgba(245,237,214,0.45)');
    }
  }
  // Side panel: streak, combo, message.
  const sd = LAYOUT.side;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  roundRect(ctx, sd.x, sd.y + 16, sd.w, sd.h - 16, 12); ctx.fill();
  const mult = S.streak >= 10 ? 3 : S.streak >= 6 ? 2 : S.streak >= 3 ? 1.5 : 1;
  drawFlame(ctx, sd.x + 40, sd.y + 62, S.streak > 0 ? 1.3 : 0.9, now);
  text(ctx, `STREAK ${S.streak}  •  ×${mult}`, sd.x + 70, sd.y + 56, 20, S.streak > 0 ? PAL.gold : 'rgba(245,237,214,0.6)', 'left');
  text(ctx, `Hidangan tersaji: ${S.served}   •   Terbaik: ${S.bestStreak} beruntun`, sd.x + 70, sd.y + 88, 15, '#F5EDD6', 'left');
  if (S.message) {
    const alpha = Math.min(1, S.messageT);
    ctx.globalAlpha = alpha;
    text(ctx, S.message, sd.x + 30, sd.y + 128, 18, '#FFF6DC', 'left');
    ctx.globalAlpha = 1;
  }
}

function drawHud(ctx, S, now) {
  const h = LAYOUT.hud;
  // Red/white warung awning stripes.
  for (let x = 0; x < W; x += 64) {
    ctx.fillStyle = (x / 64) % 2 === 0 ? '#D32F2F' : '#FFF6DC';
    ctx.fillRect(x, 0, 64, 18);
  }
  ctx.fillStyle = '#2B2118';
  ctx.fillRect(0, 18, W, 38);
  text(ctx, 'WARUNG RUSH', 24, 38, 24, PAL.gold, 'left');
  // Hearts.
  for (let i = 0; i < 3; i++) drawHeart(ctx, 236 + i * 30, 38, 1.0, i < S.hearts);
  // Score.
  text(ctx, `SKOR ${S.score.toLocaleString('id-ID')}`, 560, 38, 22, '#FFF6DC');
  // Phase label.
  const phaseNames = { 1: 'PEMBUKAAN', 2: 'RUSH HOUR', 3: 'CLOSING CHAOS' };
  text(ctx, phaseNames[S.rushPhase] || '', 830, 38, 16, PAL.gold);
  // Shift timer: big, and it shakes + reddens under 30 seconds.
  const t = Math.max(0, Math.ceil(S.timeLeft));
  const mm = String(Math.floor(t / 60)).padStart(2, '0');
  const ss = String(t % 60).padStart(2, '0');
  const urgent = S.phase === 'playing' && t <= 30;
  const jx = urgent ? Math.sin(now * 20) * 2 : 0;
  text(ctx, `${mm}:${ss}`, 1150 + jx, 38, 30, urgent ? '#FF6B5E' : '#FFF6DC');
}

function drawBanner(ctx, S, now) {
  const b = S.banner;
  const age = now - b.t0;
  const alpha = age < 0.3 ? age / 0.3 : age > 2.0 ? Math.max(0, 1 - (age - 2.0) / 0.5) : 1;
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  const scale = age < 0.3 ? 0.7 + (age / 0.3) * 0.3 : 1;
  ctx.translate(W / 2, 330);
  ctx.scale(scale, scale);
  ctx.fillStyle = 'rgba(43,33,24,0.85)';
  roundRect(ctx, -260, -46, 520, 92, 14); ctx.fill();
  ctx.strokeStyle = PAL.gold; ctx.lineWidth = 4;
  roundRect(ctx, -260, -46, 520, 92, 14); ctx.stroke();
  text(ctx, b.text, 0, -8, 34, PAL.gold);
  text(ctx, b.sub || '', 0, 26, 16, '#FFF6DC');
  ctx.restore();
}

function drawParticles(ctx, S) {
  for (const p of S.particles) {
    const a = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = a;
    if (p.text) {
      text(ctx, p.text, p.x, p.y, p.size, p.color);
    } else {
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function drawCarried(ctx, S) {
  if (!S.carried) return;
  ctx.save();
  ctx.globalAlpha = 0.95;
  drawDish(ctx, S.carried, S.mouse.x, S.mouse.y - 30, 0.8);
  ctx.restore();
  const hint = 'Klik pesanan yang cocok!';
  ctx.font = 'bold 13px "Trebuchet MS", "Segoe UI", sans-serif';
  const tw = ctx.measureText(hint).width;
  ctx.fillStyle = 'rgba(43,33,24,0.9)';
  roundRect(ctx, S.mouse.x - tw / 2 - 10, S.mouse.y + 14, tw + 20, 22, 8); ctx.fill();
  text(ctx, hint, S.mouse.x, S.mouse.y + 25, 13, '#FFF6DC');
}

function drawTitle(ctx, S, now) {
  ctx.fillStyle = 'rgba(43,33,24,0.72)';
  ctx.fillRect(0, 0, W, H);
  const pulse = 0.75 + 0.25 * Math.sin(now * 4);
  text(ctx, 'WARUNG RUSH', W / 2, 150, 84, PAL.gold);
  text(ctx, 'Warung kaki lima paling sibuk di kota — masak cepat, sajikan tepat waktu!', W / 2, 210, 22, '#FFF6DC');
  // How to play, three short lines.
  const lines = [
    '1.  Klik bahan di meja untuk meracik pesanan di piring racik.',
    '2.  Klik stasiun yang menyala (WOK / GRILL / MINUMAN) untuk memasak.',
    '3.  Klik piring saji, lalu klik pesanan yang cocok sebelum waktunya habis!',
  ];
  lines.forEach((l, i) => text(ctx, l, W / 2, 272 + i * 34, 19, '#F5EDD6'));
  // Dish menu with prices.
  text(ctx, 'MENU HARI INI', W / 2, 400, 18, PAL.gold);
  const menu = ['nasgor', 'mieayam', 'sate', 'esteh'];
  menu.forEach((id, i) => {
    const x = 300 + i * 230;
    drawDish(ctx, id, x, 470, 0.8);
    text(ctx, DISHES[id].name, x, 540, 17, '#FFF6DC');
    text(ctx, `Rp ${DISHES[id].price}`, x, 564, 15, PAL.gold);
  });
  ctx.globalAlpha = pulse;
  text(ctx, '— KLIK UNTUK MULAI —', W / 2, 640, 26, '#FFFFFF');
  ctx.globalAlpha = 1;
  text(ctx, 'Tombol 1–0 = bahan   •   U = buang racikan   •   M = bisu', W / 2, 678, 14, 'rgba(245,237,214,0.7)');
}

function drawGameOver(ctx, S, now) {
  ctx.fillStyle = 'rgba(43,33,24,0.78)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = PAL.cream;
  roundRect(ctx, 340, 130, 600, 440, 16); ctx.fill();
  ctx.strokeStyle = PAL.gold; ctx.lineWidth = 4;
  roundRect(ctx, 340, 130, 600, 440, 16); ctx.stroke();
  text(ctx, S.hearts <= 0 ? 'WARUNG TUTUP!' : 'SHIFT SELESAI!', 640, 180, 40, PAL.red);
  text(ctx, S.endTitle, 640, 226, 24, '#7A5A1A');
  text(ctx, `SKOR AKHIR  ${S.score.toLocaleString('id-ID')}`, 640, 290, 34, PAL.ink);
  text(ctx, `Hidangan tersaji: ${S.served}`, 640, 344, 20, PAL.ink);
  text(ctx, `Streak terbaik: ${S.bestStreak} beruntun`, 640, 378, 20, PAL.ink);
  text(ctx, `Pesanan hangus: ${S.missed}`, 640, 412, 20, PAL.ink);
  const pulse = 0.75 + 0.25 * Math.sin(now * 4);
  ctx.globalAlpha = pulse;
  text(ctx, '— TEKAN R UNTUK MAIN LAGI —', 640, 500, 22, PAL.red);
  ctx.globalAlpha = 1;
  text(ctx, 'Terima kasih sudah mampir ke Warung Rush!', 640, 540, 15, 'rgba(43,33,24,0.6)');
}
