// Warung Rush — game.js
// The state machine: title -> playing -> over. It owns the clock, the
// orders, the pan, the stations, the plates and the score. Rendering lives
// in render.js; data lives in recipes.js; sound lives in audio.js.

import { INGREDIENTS, INGREDIENT_BY_ID, DISHES, DISH_LIST, matchRecipe, partialRecipes, missingIngredients, scoreFor, streakMultiplier } from './recipes.js';
import { sfx, toggleMute } from './audio.js';
import { W, H, LAYOUT, drawScene } from './render.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

export const SHIFT_SECONDS = 150;
const PHASE_CUTS = [100, 50]; // timeLeft at which phase 2, then 3, begin
const PHASE_INTERVAL = [9, 6.5, 5]; // seconds between new orders
const PHASE_PATIENCE = [1.0, 0.9, 0.8];
const PHASE_NAMES = { 1: 'PEMBUKAAN', 2: 'RUSH HOUR', 3: 'CLOSING CHAOS' };
const MAX_ORDERS = 4;

let orderSeq = 0;

export function newState() {
  return {
    phase: 'title', // title | playing | over
    shot: null, // deterministic screenshot state, or null
    nowOverride: null,
    timeLeft: SHIFT_SECONDS,
    rushPhase: 1,
    score: 0,
    streak: 0,
    bestStreak: 0,
    served: 0,
    missed: 0,
    hearts: 3,
    orders: [],
    nextOrderIn: 1.2,
    pan: [],
    matchedDish: null,
    partialDishes: [],
    stations: {
      wok: { dishId: null, progress: 0, done: false },
      grill: { dishId: null, progress: 0, done: false },
      drink: { dishId: null, progress: 0, done: false },
    },
    plates: [null, null],
    carried: null,
    carriedFrom: -1,
    mouse: { x: W / 2, y: H / 2 },
    message: '',
    messageT: 0,
    banner: null,
    particles: [],
    shakeTicket: null,
    shakeT: 0,
    endTitle: '',
    muted: false,
  };
}

let S = newState();

// ---------------------------------------------------------------- helpers
function say(msg, hold = 3) {
  S.message = msg;
  S.messageT = hold;
}

function burst(x, y, color, n = 10, size = 4) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 40 + Math.random() * 120;
    S.particles.push({
      x, y,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60,
      life: 0.7 + Math.random() * 0.4, maxLife: 1.1,
      color, size: size * (0.6 + Math.random() * 0.8),
      text: null,
    });
  }
}

function floatText(x, y, str, color, size = 26) {
  S.particles.push({ x, y, vx: 0, vy: -46, life: 1.2, maxLife: 1.2, color, size, text: str });
}

function showBanner(text, sub) {
  S.banner = { text, sub, t0: performance.now() / 1000 };
}

function phaseOf(timeLeft) {
  if (timeLeft > PHASE_CUTS[0]) return 1;
  if (timeLeft > PHASE_CUTS[1]) return 2;
  return 3;
}

function pickDish() {
  // Es teh is the fast relief dish: slightly more common as the rush grows.
  const r = Math.random();
  if (S.rushPhase >= 2 && r < 0.18) return 'esteh';
  if (r < 0.33) return 'nasgor';
  if (r < 0.62) return 'mieayam';
  if (r < 0.86) return 'sate';
  return 'esteh';
}

function spawnOrder() {
  const dishId = pickDish();
  const dish = DISHES[dishId];
  const vip = S.rushPhase === 3 && Math.random() < 0.15;
  const patience = dish.patience * PHASE_PATIENCE[S.rushPhase - 1] * (vip ? 0.7 : 1);
  S.orders.push({
    id: ++orderSeq,
    dishId,
    timeLeft: patience,
    timeMax: patience,
    vip,
    lastTick: null,
  });
  sfx.order();
}

// ---------------------------------------------------------------- game flow
export function startGame() {
  S = newState();
  S.phase = 'playing';
  showBanner('PEMBUKAAN', 'Shift dimulai — pesanan pertama masuk!');
  spawnOrder();
  say('Selamat datang di Warung Rush! Racik pesanan pertama.');
}

function endGame(closedEarly) {
  S.phase = 'over';
  S.carried = null;
  const sc = S.score;
  S.endTitle = sc >= 1500 ? 'WARUNG LEGEND' : sc >= 900 ? 'JAGO MASAK' : sc >= 500 ? 'KOKI WARUNG' : 'PEMAGANG DAPUR';
  if (closedEarly) say('Warung tutup — terlalu banyak pelanggan kecewa.');
  sfx.over();
}

// ---------------------------------------------------------------- pan
function refreshMatch() {
  S.matchedDish = matchRecipe(S.pan);
  S.partialDishes = S.matchedDish ? [] : partialRecipes(S.pan);
}

function addToPan(ingId) {
  if (S.phase !== 'playing' || S.shot) return;
  if (S.pan.includes(ingId)) {
    say(`${INGREDIENT_BY_ID[ingId].name} sudah di piring racik.`);
    return;
  }
  if (S.pan.length >= 3) {
    sfx.error();
    say('Piring racik penuh — maks 3 bahan. Buang dulu (U).');
    return;
  }
  S.pan.push(ingId);
  refreshMatch();
  sfx.drop();
  if (S.matchedDish) say(`${S.matchedDish.name} siap dimasak di ${S.matchedDish.station.toUpperCase()}!`);
}

function removeFromPan(ingId) {
  const i = S.pan.indexOf(ingId);
  if (i < 0) return;
  S.pan.splice(i, 1);
  refreshMatch();
  sfx.undo();
}

function clearPan() {
  if (S.pan.length === 0) return;
  S.pan = [];
  refreshMatch();
  sfx.undo();
  say('Racikan dibuang.');
}

// ---------------------------------------------------------------- stations
function tryCook(stationId) {
  if (S.phase !== 'playing' || S.shot) return;
  const st = S.stations[stationId];
  if (st.dishId) {
    if (st.done) {
      moveStationToPlate(stationId);
    } else {
      sfx.error();
      say('Masih dimasak — sabar, sebentar lagi matang!');
    }
    return;
  }
  if (!S.matchedDish) {
    sfx.error();
    say('Racikan belum cocok dengan resep apa pun.');
    return;
  }
  if (S.matchedDish.station !== stationId) {
    sfx.error();
    say(`${S.matchedDish.name} dimasak di ${S.matchedDish.station.toUpperCase()}, bukan di sini.`);
    return;
  }
  const dish = S.matchedDish;
  st.dishId = dish.id;
  st.progress = 0;
  st.done = false;
  S.pan = [];
  refreshMatch();
  sfx.cook();
  burst(880 + ['wok', 'grill', 'drink'].indexOf(stationId) * 156, 380, '#FFFFFF', 6, 3);
}

function moveStationToPlate(stationId) {
  const st = S.stations[stationId];
  const free = S.plates.indexOf(null);
  if (free < 0) {
    sfx.error();
    say('Piring saji penuh — sajikan dulu satu hidangan!');
    return false;
  }
  S.plates[free] = st.dishId;
  st.dishId = null;
  st.progress = 0;
  st.done = false;
  sfx.ready();
  say(`${DISHES[S.plates[free]].name} siap disajikan!`);
  return true;
}

// ---------------------------------------------------------------- serving
function serveOrder(order) {
  const dish = DISHES[order.dishId];
  const points = scoreFor(dish, order.timeLeft, order.timeMax, S.streak + 1, order.vip);
  S.score += points;
  S.served += 1;
  S.streak += 1;
  S.bestStreak = Math.max(S.bestStreak, S.streak);
  const idx = S.orders.indexOf(order);
  if (idx >= 0) S.orders.splice(idx, 1);
  const mult = streakMultiplier(S.streak);
  floatText(640, 150, `+${points}`, order.vip ? '#E8A833' : '#2E7D32', 30);
  burst(640, 200, '#E8A833', 14, 5);
  sfx.serve();
  if (order.vip) say(`VIP! ${dish.name} tersaji — +${points}!`);
  else if (mult >= 2) say(`Mantap! Streak ${S.streak} — ×${mult} — +${points}!`);
  else say(`Mantap! ${dish.name} tersaji — +${points}.`);
  S.carried = null;
  S.carriedFrom = -1;
}

function expireOrder(order) {
  const idx = S.orders.indexOf(order);
  if (idx >= 0) S.orders.splice(idx, 1);
  S.hearts -= 1;
  S.score = Math.max(0, S.score - 50);
  S.streak = 0;
  S.missed += 1;
  S.shakeTicket = order.id;
  S.shakeT = 0.5;
  sfx.miss();
  say(`Pesanan ${DISHES[order.dishId].name} hangus! Pelanggan kecewa. (−50)`);
  if (S.hearts <= 0) endGame(true);
}

// ---------------------------------------------------------------- input
function ticketRect(i) {
  return {
    x: LAYOUT.board.x + 140 + i * (LAYOUT.ticketW + LAYOUT.ticketGap),
    y: LAYOUT.board.y + 10,
    w: LAYOUT.ticketW,
    h: LAYOUT.ticketH,
  };
}

function stationRect(i) {
  return {
    x: LAYOUT.stations.x + i * (LAYOUT.stationW + 12),
    y: LAYOUT.stations.y + 16,
    w: LAYOUT.stationW,
    h: LAYOUT.stationH - 60,
  };
}

function plateRect(i) {
  return {
    x: LAYOUT.plates.x + i * (LAYOUT.plateW + 16),
    y: LAYOUT.plates.y + 16,
    w: LAYOUT.plateW,
    h: LAYOUT.plateH - 16,
  };
}

function inRect(x, y, r) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

export function handleClick(x, y) {
  if (S.phase === 'title') {
    sfx.click();
    startGame();
    return;
  }
  if (S.phase === 'over') {
    sfx.click();
    startGame();
    return;
  }
  if (S.shot) return;

  // Carrying a dish: a ticket serves it, anything else puts it back.
  if (S.carried) {
    for (let i = 0; i < S.orders.length; i++) {
      if (inRect(x, y, ticketRect(i))) {
        const order = S.orders[i];
        if (order.dishId === S.carried) {
          serveOrder(order);
        } else {
          sfx.error();
          S.shakeTicket = order.id;
          S.shakeT = 0.5;
          say(`Bukan ${DISHES[order.dishId].name} — pelanggan ini pesan ${DISHES[order.dishId].name}.`);
        }
        return;
      }
    }
    // Put the dish back on its plate.
    S.plates[S.carriedFrom] = S.carried;
    S.carried = null;
    S.carriedFrom = -1;
    return;
  }

  // Ingredient bins.
  const b = LAYOUT.bins;
  for (let i = 0; i < 10; i++) {
    const col = i % LAYOUT.bins.cols;
    const row = Math.floor(i / LAYOUT.bins.cols);
    const r = {
      x: b.x + col * (LAYOUT.binW + 8),
      y: b.y + 16 + row * (LAYOUT.binH + 8),
      w: LAYOUT.binW,
      h: LAYOUT.binH,
    };
    if (inRect(x, y, r)) {
      addToPan(INGREDIENTS[i].id);
      return;
    }
  }

  // Pan ingredients (click one to remove it).
  const p = LAYOUT.pan;
  if (S.pan.length > 0) {
    const n = S.pan.length;
    for (let i = 0; i < n; i++) {
      const cx = p.x + p.w / 2 + (i - (n - 1) / 2) * 44;
      const cy = p.y + 78;
      if (Math.hypot(x - cx, y - cy) < 28) {
        removeFromPan(S.pan[i]);
        return;
      }
    }
  }
  // Trash button.
  if (inRect(x, y, { x: p.x + 18, y: p.y + p.h - 36, w: p.w - 36, h: 28 })) {
    clearPan();
    return;
  }

  // Stations.
  const stationIds = ['wok', 'grill', 'drink'];
  for (let i = 0; i < 3; i++) {
    if (inRect(x, y, stationRect(i))) {
      tryCook(stationIds[i]);
      return;
    }
  }

  // Serving plates: pick a dish up.
  for (let i = 0; i < 2; i++) {
    if (inRect(x, y, plateRect(i)) && S.plates[i]) {
      S.carried = S.plates[i];
      S.carriedFrom = i;
      S.plates[i] = null;
      sfx.pick();
      say(`Bawa ${DISHES[S.carried].name} ke pesanan yang cocok!`);
      return;
    }
  }
}

export function handleKey(key) {
  const k = key.toLowerCase();
  if (S.phase === 'title' && (k === 'enter' || k === ' ')) { startGame(); return; }
  if (S.phase === 'over' && k === 'r') { startGame(); return; }
  if (S.phase !== 'playing' || S.shot) return;
  if (k === 'u') { clearPan(); return; }
  if (k === 'm') { S.muted = toggleMute(); say(S.muted ? 'Suara dimatikan.' : 'Suara dinyalakan.'); return; }
  const ing = INGREDIENTS.find((g) => g.key === k);
  if (ing) addToPan(ing.id);
}

// ---------------------------------------------------------------- update
export function update(dt) {
  // Particles always animate; the rest only while playing.
  for (const p of S.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 60 * dt;
    p.life -= dt;
  }
  S.particles = S.particles.filter((p) => p.life > 0);
  if (S.messageT > 0) S.messageT -= dt;
  if (S.shakeT > 0) S.shakeT -= dt;
  else S.shakeTicket = null;
  if (S.banner && performance.now() / 1000 - S.banner.t0 > 2.6) S.banner = null;
  if (S.phase !== 'playing' || S.shot) return;

  S.timeLeft -= dt;
  const ph = phaseOf(S.timeLeft);
  if (ph !== S.rushPhase) {
    S.rushPhase = ph;
    showBanner(PHASE_NAMES[ph], ph === 2 ? 'Pesanan makin deras!' : 'Bertahan sampai shift selesai!');
    sfx.rush();
  }
  if (S.timeLeft <= 0) {
    S.timeLeft = 0;
    endGame(false);
    return;
  }

  // Orders.
  S.nextOrderIn -= dt;
  if (S.nextOrderIn <= 0 && S.orders.length < MAX_ORDERS) {
    spawnOrder();
    S.nextOrderIn = PHASE_INTERVAL[S.rushPhase - 1] * (0.85 + Math.random() * 0.3);
  }
  for (const order of [...S.orders]) {
    order.timeLeft -= dt;
    // The last 10 seconds tick once a second: a timer you can feel.
    const whole = Math.ceil(order.timeLeft);
    if (whole !== order.lastTick && whole <= 10 && whole > 0) {
      order.lastTick = whole;
      sfx.tick();
    }
    if (order.timeLeft <= 0) expireOrder(order);
  }

  // Stations.
  for (const id of ['wok', 'grill', 'drink']) {
    const st = S.stations[id];
    if (st.dishId && !st.done) {
      st.progress += dt / DISHES[st.dishId].cookTime;
      if (st.progress >= 1) {
        st.progress = 1;
        st.done = true;
        moveStationToPlate(id);
      }
    }
  }
}

// ---------------------------------------------------------------- shots
// Deterministic frozen states for the screenshots. The cover staging comes
// from the design spec: Rush Hour, three tickets at different urgency, sate
// mid-grill, a finished nasi goreng with banana leaf ready to serve.
function baseShot(overrides) {
  S = newState();
  S.phase = 'playing';
  S.shot = overrides.shot;
  S.nowOverride = 1.234;
  Object.assign(S, overrides);
  refreshMatch();
}

export function applyShot(name) {
  if (name === 'cover') {
    baseShot({
      shot: 'cover',
      timeLeft: 74,
      rushPhase: 2,
      score: 1250,
      streak: 3,
      bestStreak: 3,
      served: 9,
      hearts: 3,
      orders: [
        { id: 1, dishId: 'nasgor', timeLeft: 18, timeMax: 45, vip: false },
        { id: 2, dishId: 'mieayam', timeLeft: 33.6, timeMax: 48, vip: false },
        { id: 3, dishId: 'esteh', timeLeft: 5, timeMax: 25, vip: false },
      ],
      pan: ['nasi', 'telur'],
      stations: {
        wok: { dishId: 'nasgor', progress: 0.55, done: false },
        grill: { dishId: null, progress: 0, done: false },
        drink: { dishId: null, progress: 0, done: false },
      },
      plates: ['sate', null],
      message: 'Sate Ayam siap disajikan!',
      messageT: 3,
    });
  } else if (name === 'rush') {
    baseShot({
      shot: 'rush',
      timeLeft: 38,
      rushPhase: 3,
      score: 2310,
      streak: 6,
      bestStreak: 6,
      served: 17,
      hearts: 2,
      orders: [
        { id: 1, dishId: 'nasgor', timeLeft: 13.5, timeMax: 45, vip: false },
        { id: 2, dishId: 'mieayam', timeLeft: 26.4, timeMax: 48, vip: false },
        { id: 3, dishId: 'sate', timeLeft: 40, timeMax: 50, vip: true },
        { id: 4, dishId: 'esteh', timeLeft: 3.8, timeMax: 25, vip: false },
      ],
      pan: ['mie', 'ayam'],
      stations: {
        wok: { dishId: 'mieayam', progress: 0.7, done: false },
        grill: { dishId: 'sate', progress: 0.4, done: false },
        drink: { dishId: null, progress: 0, done: false },
      },
      plates: ['nasgor', 'esteh'],
      message: 'RUSH HOUR! Pesanan menumpuk!',
      messageT: 3,
    });
  } else if (name === 'serve') {
    baseShot({
      shot: 'serve',
      timeLeft: 52,
      rushPhase: 2,
      score: 890,
      streak: 2,
      bestStreak: 4,
      served: 7,
      hearts: 3,
      orders: [
        { id: 1, dishId: 'sate', timeLeft: 22.5, timeMax: 50, vip: false },
        { id: 2, dishId: 'esteh', timeLeft: 6.2, timeMax: 25, vip: false },
        { id: 3, dishId: 'nasgor', timeLeft: 29.2, timeMax: 45, vip: false },
      ],
      pan: [],
      stations: {
        wok: { dishId: null, progress: 0, done: false },
        grill: { dishId: null, progress: 0, done: false },
        drink: { dishId: null, progress: 0, done: false },
      },
      plates: [null, 'nasgor'],
      carried: 'esteh',
      carriedFrom: 0,
      mouse: { x: LAYOUT.board.x + 140 + 1 * (LAYOUT.ticketW + LAYOUT.ticketGap) + LAYOUT.ticketW / 2, y: LAYOUT.board.y + 10 + 58 },
      message: 'Mantap! +180',
      messageT: 3,
    });
  } else if (name === 'end') {
    S = newState();
    S.phase = 'over';
    S.shot = 'end';
    S.nowOverride = 1.234;
    S.score = 2310;
    S.served = 19;
    S.bestStreak = 6;
    S.missed = 2;
    S.hearts = 0;
    S.timeLeft = 0;
    S.endTitle = 'WARUNG LEGEND';
  }
}

// ---------------------------------------------------------------- self-test
// Drives the real click handlers and update loop (no rAF needed) and reports
// into #selftest so a headless run can verify the core loop end to end.
export function runSelfTest() {
  const out = [];
  const check = (name, ok) => out.push(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  try {
    startGame();
    check('game starts in playing phase', S.phase === 'playing');
    check('first order spawned', S.orders.length === 1);
    const dish = DISHES[S.orders[0].dishId];
    const wrong = dish.ingredients[0] === 'nasi' ? 'mie' : 'nasi';
    addToPan(wrong);
    addToPan(dish.ingredients[1] || dish.ingredients[0]);
    check('wrong mix matches no recipe', S.matchedDish === null);
    clearPan();
    check('pan clears', S.pan.length === 0);
    for (const ing of dish.ingredients) addToPan(ing);
    check('recipe matches after all ingredients', S.matchedDish && S.matchedDish.id === dish.id);
    const stId = dish.station;
    const stIdx = ['wok', 'grill', 'drink'].indexOf(stId);
    const sr = stationRect(stIdx);
    handleClick(sr.x + sr.w / 2, sr.y + sr.h / 2);
    check('station starts cooking', S.stations[stId].dishId === dish.id);
    update(10);
    check('dish lands on a plate after cooking', S.plates.includes(dish.id));
    const pi = S.plates.indexOf(dish.id);
    const pr = plateRect(pi);
    handleClick(pr.x + pr.w / 2, pr.y + pr.h / 2);
    check('plate picked up', S.carried === dish.id);
    const tr = ticketRect(0);
    const scoreBefore = S.score;
    const ordersBeforeServe = S.orders.length;
    handleClick(tr.x + tr.w / 2, tr.y + tr.h / 2);
    check('serving scores points', S.score > scoreBefore);
    check('served order leaves the board', S.orders.length === ordersBeforeServe - 1);
    check('served counter increments', S.served === 1);
    // Expiry path: an order that runs out costs a heart.
    spawnOrder();
    const heartsBefore = S.hearts;
    S.orders[0].timeLeft = 0.01;
    update(0.05);
    check('expired order costs a heart', S.hearts === heartsBefore - 1);
    check('score never goes below zero', S.score >= 0);
    // Rush phase transition.
    S.timeLeft = 51;
    update(2);
    check('phase 3 engages under 50s', S.rushPhase === 3);
  } catch (e) {
    out.push(`FAIL exception: ${e.message}`);
  }
  const textOut = out.join('\n');
  const el = document.getElementById('selftest');
  if (el) el.textContent = textOut;
  document.title = out.every((l) => l.startsWith('PASS')) ? 'SELFTEST ALL PASS' : 'SELFTEST FAILURES';
  return textOut;
}

// ---------------------------------------------------------------- boot
canvas.addEventListener('click', (e) => {
  const r = canvas.getBoundingClientRect();
  const x = (e.clientX - r.left) * (W / r.width);
  const y = (e.clientY - r.top) * (H / r.height);
  S.mouse.x = x;
  S.mouse.y = y;
  handleClick(x, y);
});
canvas.addEventListener('mousemove', (e) => {
  const r = canvas.getBoundingClientRect();
  S.mouse.x = (e.clientX - r.left) * (W / r.width);
  S.mouse.y = (e.clientY - r.top) * (H / r.height);
});
window.addEventListener('keydown', (e) => {
  if ([' ', 'ArrowUp', 'ArrowDown'].includes(e.key)) e.preventDefault();
  handleKey(e.key);
});

const params = new URLSearchParams(location.search);
const shot = params.get('shot');
if (shot) {
  applyShot(shot);
} else if (params.get('selftest') === '1') {
  const result = runSelfTest();
  console.log(result);
}

let last = performance.now();
function frame(t) {
  const dt = Math.min(0.05, (t - last) / 1000);
  last = t;
  const now = S.nowOverride !== null ? S.nowOverride : t / 1000;
  if (!S.shot) update(dt);
  drawScene(ctx, S, now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
