'use strict';

// ================= NAVIGATION =================
function showSection(name, evt) {
  document.querySelectorAll('section').forEach((s) => s.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach((b) => b.classList.remove('active'));

  const section = document.getElementById(`section-${name}`);
  if (section) section.classList.add('active');

  if (evt && evt.target) {
    evt.target.classList.add('active');
  }

  if (name === 'dashboard') {
    setTimeout(resizeCanvas, 0);
  }
}
window.showSection = showSection;

// ================= API =================
const API_BASE =
  window.location && window.location.protocol && window.location.protocol.startsWith('http')
    ? window.location.origin
    : 'http://127.0.0.1:5000';

// ================= LOCATION =================
let userLocation = null;
let locationStr = 'Locating…';

function detectLocation() {
  const el = document.getElementById('ai-loc-display');

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(5);
        const lng = pos.coords.longitude.toFixed(5);
        userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        locationStr = `${lat}° N, ${lng}° E`;
        if (el) el.textContent = `${locationStr} · Accuracy: ±${Math.round(pos.coords.accuracy)}m`;
      },
      () => {
        locationStr = 'Bengaluru, Karnataka (12.9716° N, 77.5946° E)';
        if (el) el.textContent = `${locationStr} · GPS fallback`;
      }
    );
  } else {
    locationStr = 'Bengaluru, Karnataka (12.9716° N, 77.5946° E)';
    if (el) el.textContent = `${locationStr} · GPS fallback`;
  }
}

// ================= UI HELPERS =================
function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function timeNow() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

function cleanLocationText(text) {
  return String(text || '')
    .replace(/\([^)]*\)/g, '')
    .replace(/[→]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeRouteList(route) {
  if (!Array.isArray(route)) return [];
  return route
    .flatMap((item) => {
      if (typeof item !== 'string') return [];
      return item
        .split(/→|->|—/g)
        .map((s) => s.trim())
        .filter(Boolean);
    })
    .map(cleanLocationText)
    .filter(Boolean);
}

function normalizeSignal(value) {
  const s = String(value || '').toLowerCase();
  if (s.includes('prepare') || s.includes('amber') || s.includes('yellow')) return 'prepare';
  if (s.includes('green')) return 'green';
  if (s.includes('red')) return 'red';
  return 'green';
}

// ================= MAP CONSTANTS =================
const ROAD_XS = [0.18, 0.37, 0.55, 0.74];
const ROAD_YS = [0.24, 0.52, 0.81];

const JUNCTIONS = {
  'MG Road': [0.37, 0.24],
  'Brigade Rd': [0.55, 0.24],
  'Residency Rd': [0.55, 0.52],
  'Koramangala': [0.74, 0.52],
  'Indiranagar': [0.74, 0.24],
  'Jayanagar': [0.37, 0.52],
  'Silk Board': [0.55, 0.81],
  'Hebbal': [0.37, 0.81],
  'Marathahalli': [0.74, 0.81],
  'Richmond Circle': [0.18, 0.52],
  'Lavelle Rd': [0.18, 0.24],
  'Bannerghatta Rd': [0.18, 0.81],
  'Hosur Rd': [0.55, 0.81]
};

const LOCATION_ALIAS = {
  "Manipal Hospital": 'Koramangala',
  "St. John's Hospital": 'Jayanagar',
  'Fortis Hospital': 'Indiranagar',
  'Apollo Hospital': 'MG Road',
  'Victoria Hospital': 'Richmond Circle',
  'Narayana Health': 'Silk Board',
  'St Johns Hospital': 'Jayanagar'
};

const SIGNAL_GRID = [
  [0.18, 0.24], [0.37, 0.24], [0.55, 0.24], [0.74, 0.24],
  [0.18, 0.52], [0.37, 0.52], [0.55, 0.52], [0.74, 0.52],
  [0.18, 0.81], [0.37, 0.81], [0.55, 0.81], [0.74, 0.81]
];

const DEFAULT_ROUTE = ['Koramangala', 'Indiranagar', 'MG Road', 'Jayanagar', 'Silk Board', 'Koramangala'];
// ================= TRAFFIC-AWARE ROUTING =================
const ROUTE_GRAPH = {
  'Lavelle Rd': ['MG Road', 'Richmond Circle'],
  'MG Road': ['Lavelle Rd', 'Brigade Rd', 'Jayanagar', 'Indiranagar'],
  'Brigade Rd': ['MG Road', 'Residency Rd', 'Indiranagar'],
  'Residency Rd': ['Richmond Circle', 'Brigade Rd', 'Jayanagar', 'Koramangala'],
  'Richmond Circle': ['Lavelle Rd', 'Residency Rd', 'Jayanagar'],
  'Jayanagar': ['Richmond Circle', 'Residency Rd', 'Koramangala', 'Silk Board', 'Bannerghatta Rd'],
  'Koramangala': ['Residency Rd', 'Jayanagar', 'Silk Board', 'Indiranagar'],
  'Indiranagar': ['MG Road', 'Brigade Rd', 'Koramangala', 'Marathahalli'],
  'Silk Board': ['Koramangala', 'Jayanagar', 'Bannerghatta Rd', 'Hosur Rd', 'Marathahalli'],
  'Bannerghatta Rd': ['Jayanagar', 'Silk Board'],
  'Hosur Rd': ['Silk Board', 'Marathahalli'],
  'Marathahalli': ['Indiranagar', 'Silk Board', 'Hosur Rd']
};

function nearestJunctionNameFromPoint(x, y) {
  let best = null;
  let min = Infinity;

  for (const [name, [jx, jy]] of Object.entries(JUNCTIONS)) {
    const d = Math.hypot(x - jx, y - jy);
    if (d < min) {
      min = d;
      best = name;
    }
  }
  return best;
}

function edgeCost(a, b) {
  const pa = JUNCTIONS[a];
  const pb = JUNCTIONS[b];
  if (!pa || !pb) return 999;

  const base = Math.hypot(pa[0] - pb[0], pa[1] - pb[1]);
  const sigKey = nearestSignalKey(pb[0], pb[1]);
  const sig = sigKey ? (state.signalStates[sigKey] || 'green') : 'green';

  const penalty =
    sig === 'green' ? 0.08 :
    sig === 'prepare' ? 0.70 :
    2.80;

  return base + penalty;
}

function findBestRoute(originText, destinationText) {
  const start =
    resolveLocationKey(originText) ||
    nearestJunctionNameFromPoint(...locationToPoint(originText)) ||
    'Koramangala';

  const goal =
    resolveLocationKey(destinationText) ||
    nearestJunctionNameFromPoint(...locationToPoint(destinationText)) ||
    'MG Road';

  if (start === goal) return [start, goal];

  const nodes = Object.keys(ROUTE_GRAPH);
  const dist = Object.fromEntries(nodes.map((n) => [n, Infinity]));
  const prev = {};
  const visited = new Set();

  dist[start] = 0;

  while (visited.size < nodes.length) {
    let current = null;
    let best = Infinity;

    for (const n of nodes) {
      if (!visited.has(n) && dist[n] < best) {
        best = dist[n];
        current = n;
      }
    }

    if (!current) break;
    if (current === goal) break;

    visited.add(current);

    for (const nb of ROUTE_GRAPH[current] || []) {
      const alt = dist[current] + edgeCost(current, nb);
      if (alt < dist[nb]) {
        dist[nb] = alt;
        prev[nb] = current;
      }
    }
  }

  if (!isFinite(dist[goal])) return [start, goal];

  const path = [];
  let cur = goal;
  while (cur) {
    path.unshift(cur);
    if (cur === start) break;
    cur = prev[cur];
  }

  return path.length >= 2 ? path : [start, goal];
}

function pathCost(routeNames) {
  const route = normalizeRouteList(routeNames);
  if (route.length < 2) return Infinity;

  let total = 0;
  for (let i = 0; i < route.length - 1; i++) {
    total += edgeCost(route[i], route[i + 1]);
  }
  return total;
}

function chooseBestRoute(originText, destinationText, backendRoute) {
  const localRoute = findBestRoute(originText, destinationText);
  const backend = normalizeRouteList(backendRoute);

  if (backend.length >= 2) {
    const localCost = pathCost(localRoute);
    const backendCost = pathCost(backend);
    return backendCost <= localCost ? backend : localRoute;
  }

  return localRoute;
}
// ================= MAP STATE =================
let canvas = null;
let ctx = null;

let latestDispatch = null;
let simRunning = false;
let logCount = 0;
let liveAlertCount = 0;
let mapStarted = false;

const state = {
  ambX: 0.74,
  ambY: 0.52,
  routeNames: DEFAULT_ROUTE.slice(),
  routePoints: [],
  routeIndex: 1,
  signalStates: {},
  controlledSignals: new Set(),
  sirenWaves: [],
  ledFlash: null,
  smsBlast: null,
  dispatchPulse: null,
  speedMultiplier: 1,
  label: '1km radius active'
};

function resolveLocationKey(text) {
  const raw = cleanLocationText(text).toLowerCase();
  if (!raw) return null;

  for (const key of Object.keys(LOCATION_ALIAS)) {
    const k = key.toLowerCase();
    if (raw === k || raw.includes(k) || k.includes(raw)) return LOCATION_ALIAS[key];
  }

  for (const key of Object.keys(JUNCTIONS)) {
    const k = key.toLowerCase();
    if (raw === k || raw.includes(k) || k.includes(raw)) return key;
  }

  return null;
}

function locationToPoint(text) {
  const key = resolveLocationKey(text);
  if (key && JUNCTIONS[key]) return JUNCTIONS[key];
  return [0.55, 0.52];
}

function routeToPoints(routeNames) {
  const pts = routeNames.map(locationToPoint);
  if (pts.length >= 2) {
    const first = pts[0];
    const last = pts[pts.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      pts.push([first[0], first[1]]);
    }
  }
  return pts;
}

function nearestSignalKey(x, y) {
  let nearest = null;
  let minDist = Infinity;

  SIGNAL_GRID.forEach(([sx, sy]) => {
    const d = Math.hypot(x - sx, y - sy);
    if (d < minDist) {
      minDist = d;
      nearest = `${sx},${sy}`;
    }
  });

  return nearest;
}

function updateMapLabel(text, color) {
  const lbl = document.getElementById('map-event-label');
  if (!lbl) return;
  lbl.textContent = text;
  if (color) lbl.style.color = color;
}

function initSignalStates() {
  SIGNAL_GRID.forEach(([x, y]) => {
    state.signalStates[`${x},${y}`] = Math.random() > 0.5 ? 'red' : 'green';
  });
}

function setRoute(routeNames) {
  const normalized = normalizeRouteList(routeNames);
  const list = normalized.length >= 2 ? normalized : DEFAULT_ROUTE.slice();

  state.routeNames = list.slice();
  state.routePoints = routeToPoints(list);
  state.routeIndex = 1;

  const first = state.routePoints[0] || [0.74, 0.52];
  state.ambX = first[0];
  state.ambY = first[1];

  greenifyAhead();
}

function greenifyAhead() {
  state.controlledSignals.clear();

  const points = state.routePoints.length ? state.routePoints : routeToPoints(DEFAULT_ROUTE);
  for (let i = 0; i < Math.min(3, points.length); i++) {
    const [x, y] = points[i];
    const key = nearestSignalKey(x, y);
    if (!key) continue;

    state.signalStates[key] = i < 2 ? 'green' : 'prepare';
    state.controlledSignals.add(key);
  }
}

function applyDispatchSignals(signals) {
  state.controlledSignals.clear();

  if (!Array.isArray(signals) || signals.length === 0) {
    greenifyAhead();
    return;
  }

  signals.forEach((sig) => {
    const [px, py] = locationToPoint(sig.junction);
    const key = nearestSignalKey(px, py);
    if (!key) return;

    state.signalStates[key] = normalizeSignal(sig.signal);
    state.controlledSignals.add(key);
  });

  if (state.routePoints.length) {
    for (let i = 0; i < Math.min(3, state.routePoints.length); i++) {
      const key = nearestSignalKey(state.routePoints[i][0], state.routePoints[i][1]);
      if (!key) continue;
      if (!state.controlledSignals.has(key)) {
        state.signalStates[key] = i < 2 ? 'green' : 'prepare';
        state.controlledSignals.add(key);
      }
    }
  }
}

function rebuildRouteFromDispatch(data, originText, destinationText) {
  const route = chooseBestRoute(originText, destinationText, data?.route);

  setRoute(route);
  applyDispatchSignals(data?.signals);

  state.speedMultiplier = 1.25;
  setTimeout(() => {
    state.speedMultiplier = 1;
  }, 5000);

  latestDispatch = {
    ...data,
    origin: cleanLocationText(originText),
    destination: cleanLocationText(destinationText),
    route: route.slice()
  };

  updateMapLabel(`Dispatch active — ${latestDispatch.route.join(' → ')}`, 'var(--red)');
  if (data?.prediction) {
    updateMapLabel(data.prediction, 'var(--green)');
  }
}

function updateTrafficSignals(ts) {
  const phase = Math.floor(ts / 1500);

  SIGNAL_GRID.forEach(([x, y], index) => {
    const key = `${x},${y}`;
    if (state.controlledSignals.has(key)) return;

    const turnGreen = (phase + index) % 2 === 0;
    state.signalStates[key] = turnGreen ? 'green' : 'red';
  });
}

function drawRoundRect(x, y, w, h, r) {
  if (!ctx) return;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function drawAmbulance(px, py, angle) {
  if (!ctx) return;
  const w = 18;
  const h = 10;

  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(angle);

  ctx.shadowBlur = 18;
  ctx.shadowColor = '#1D9E75';
  ctx.fillStyle = '#1D9E75';
  drawRoundRect(-w / 2, -h / 2, w, h, 3);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-2, -6, 4, 12);
  ctx.fillRect(-6, -2, 12, 4);

  ctx.fillStyle = '#E24B4A';
  ctx.beginPath();
  ctx.arc(-w / 2 + 3, -h / 2 + 2, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(-w / 2 + 3, h / 2 - 2, 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawTrafficSignal(sx, sy, stateName, blink) {
  if (!ctx) return;

  ctx.save();
  ctx.fillStyle = '#1a2820';
  ctx.beginPath();
  ctx.arc(sx, sy, 8, 0, Math.PI * 2);
  ctx.fill();

  if (stateName === 'green') {
    ctx.fillStyle = blink ? '#1D9E75' : '#5DCAA5';
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#1D9E75';
  } else if (stateName === 'prepare') {
    ctx.fillStyle = blink ? '#EF9F27' : 'rgba(239,159,39,0.45)';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#EF9F27';
  } else {
    ctx.fillStyle = blink ? '#E24B4A' : 'rgba(226,75,74,0.55)';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#E24B4A';
  }

  ctx.beginPath();
  ctx.arc(sx, sy, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function moveAmbulance() {
  const points = state.routePoints.length >= 2 ? state.routePoints : routeToPoints(DEFAULT_ROUTE);
  if (!points.length) return;

  if (state.routeIndex >= points.length) {
    state.routeIndex = 1;
  }

  const target = points[state.routeIndex] || points[1] || points[0];
  const dx = target[0] - state.ambX;
  const dy = target[1] - state.ambY;
  const dist = Math.hypot(dx, dy);

  if (!dist || dist < 0.0001) {
    state.routeIndex = (state.routeIndex + 1) % points.length;
    if (state.routeIndex === 0 && points.length > 1) state.routeIndex = 1;
    greenifyAhead();
    return;
  }

  const currentNode = nearestJunctionNameFromPoint(state.ambX, state.ambY) || state.routeNames[0] || 'Koramangala';
  const destinationNode = state.routeNames[state.routeNames.length - 1] || DEFAULT_ROUTE[DEFAULT_ROUTE.length - 1];
  const nearestKey = nearestSignalKey(target[0], target[1]);
  const signal = nearestKey ? (state.signalStates[nearestKey] || 'green') : 'green';

  if (signal === 'red' && dist < 0.06) {
    const reroute = findBestRoute(currentNode, destinationNode);
    if (reroute.length >= 2 && reroute.join('|') !== state.routeNames.join('|')) {
      setRoute(reroute);
      return;
    }
  }

  let speed = 0.0019 * state.speedMultiplier;

  const nextPoint = points[(state.routeIndex + 1) % points.length];
  const nextSignal = nextPoint ? (state.signalStates[nearestSignalKey(nextPoint[0], nextPoint[1])] || 'green') : 'green';

  if (signal === 'green' && nextSignal === 'green') {
    speed *= 1.75;
  } else if (signal === 'green') {
    speed *= 1.35;
  } else if (signal === 'prepare') {
    speed *= 0.55;
  } else if (signal === 'red') {
    speed *= dist < 0.03 ? 0.04 : 0.20;
  }

  if (dist > 0.0001) {
    state.ambX += (dx / dist) * speed;
    state.ambY += (dy / dist) * speed;
  }

  if (Math.hypot(target[0] - state.ambX, target[1] - state.ambY) < 0.012) {
    state.ambX = target[0];
    state.ambY = target[1];
    state.routeIndex = (state.routeIndex + 1) % points.length;
    if (state.routeIndex === 0 && points.length > 1) state.routeIndex = 1;
    greenifyAhead();
  }
}

function drawMap(ts) {
  if (!canvas || !ctx) {
    requestAnimationFrame(drawMap);
    return;
  }

  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (!w || !h) {
    requestAnimationFrame(drawMap);
    return;
  }

  ctx.clearRect(0, 0, w, h);
  updateTrafficSignals(ts);

  // background
  ctx.fillStyle = '#0a0f0d';
  ctx.fillRect(0, 0, w, h);

  // blocks
  const cols = [0, 0.18, 0.37, 0.55, 0.74, 1.0];
  const rows = [0, 0.24, 0.52, 0.81, 1.0];
  for (let r = 0; r < rows.length - 1; r++) {
    for (let c = 0; c < cols.length - 1; c++) {
      const pad = 10;
      const x = cols[c] * w + pad;
      const y = rows[r] * h + pad;
      const bw = (cols[c + 1] - cols[c]) * w - pad * 2 - 14;
      const bh = (rows[r + 1] - rows[r]) * h - pad * 2 - 14;
      if (bw > 0 && bh > 0) {
        ctx.fillStyle = (r + c) % 2 === 0 ? '#0e1814' : '#111c17';
        drawRoundRect(x, y, bw, bh, 4);
        ctx.fill();
      }
    }
  }

  // roads
  ctx.strokeStyle = '#162019';
  ctx.lineWidth = 14;
  ROAD_XS.forEach((xp) => {
    ctx.beginPath();
    ctx.moveTo(xp * w, 0);
    ctx.lineTo(xp * w, h);
    ctx.stroke();
  });
  ROAD_YS.forEach((yp) => {
    ctx.beginPath();
    ctx.moveTo(0, yp * h);
    ctx.lineTo(w, yp * h);
    ctx.stroke();
  });

  // dashed center lines
  ctx.strokeStyle = '#1e2f26';
  ctx.lineWidth = 1;
  ctx.setLineDash([8, 8]);
  ROAD_XS.forEach((xp) => {
    ctx.beginPath();
    ctx.moveTo(xp * w, 0);
    ctx.lineTo(xp * w, h);
    ctx.stroke();
  });
  ROAD_YS.forEach((yp) => {
    ctx.beginPath();
    ctx.moveTo(0, yp * h);
    ctx.lineTo(w, yp * h);
    ctx.stroke();
  });
  ctx.setLineDash([]);

  // route
  const points = state.routePoints.length >= 2 ? state.routePoints : routeToPoints(DEFAULT_ROUTE);
  if (points.length >= 2) {
    ctx.strokeStyle = 'rgba(29,158,117,0.10)';
    ctx.lineWidth = 12;
    ctx.beginPath();
    points.forEach(([x, y], i) => {
      const px = x * w;
      const py = y * h;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
  }

  // ambulance movement first so visuals match updated position
  moveAmbulance();

  const ambX = state.ambX * w;
  const ambY = state.ambY * h;

  // active corridor segment
  const target = points[state.routeIndex] || points[1] || points[0];
  const tx = target ? target[0] * w : ambX;
  const ty = target ? target[1] * h : ambY;

  const pulseMult = 0.5 + 0.5 * Math.sin(ts * 0.003);
  const gradC = ctx.createLinearGradient(ambX, ambY, tx, ty);
  gradC.addColorStop(0, 'rgba(29,158,117,0.7)');
  gradC.addColorStop(1, 'rgba(29,158,117,0.2)');
  ctx.strokeStyle = gradC;
  ctx.lineWidth = 18;
  ctx.beginPath();
  ctx.moveTo(ambX, ambY);
  ctx.lineTo(tx, ty);
  ctx.stroke();

  // corridor dashes
  ctx.strokeStyle = `rgba(93,202,165,${0.4 + 0.3 * pulseMult})`;
  ctx.lineWidth = 3;
  ctx.setLineDash([12, 8]);
  ctx.lineDashOffset = -(ts * 0.04) % 20;
  ctx.beginPath();
  ctx.moveTo(ambX, ambY);
  ctx.lineTo(tx, ty);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineDashOffset = 0;

  // signals
  SIGNAL_GRID.forEach(([xp, yp]) => {
    const key = `${xp},${yp}`;
    const sx = xp * w;
    const sy = yp * h;
    const blink = Math.sin(ts * 0.004) > 0;
    drawTrafficSignal(sx, sy, state.signalStates[key] || 'red', blink);
  });

  // sms blast
  if (state.smsBlast) {
    const s = state.smsBlast;
    ctx.save();
    ctx.strokeStyle = `rgba(239,159,39,${s.alpha})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    s.r += 1.5;
    s.alpha -= 0.012;
    if (s.alpha <= 0) state.smsBlast = null;
  }

  // siren waves
  state.sirenWaves = state.sirenWaves.filter((w) => w.alpha > 0);
  state.sirenWaves.forEach((wave) => {
    ctx.strokeStyle = `rgba(29,158,117,${wave.alpha})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(wave.x, wave.y, wave.r, 0, Math.PI * 2);
    ctx.stroke();
    wave.r += 2.5;
    wave.alpha -= 0.018;
  });

  // dispatch pulse
  if (state.dispatchPulse) {
    const dp = state.dispatchPulse;
    ctx.strokeStyle = `rgba(226,75,74,${dp.alpha})`;
    ctx.lineWidth = 3;
    const pr = (1 - dp.alpha) * 60;
    ctx.beginPath();
    ctx.arc(dp.x, dp.y, pr, 0, Math.PI * 2);
    ctx.stroke();
    dp.alpha -= 0.015;
    if (dp.alpha <= 0) state.dispatchPulse = null;
  }

  // LED flash
  if (state.ledFlash) {
    const lf = state.ledFlash;
    ctx.save();
    ctx.globalAlpha = Math.min(1, lf.alpha);
    ctx.fillStyle = '#0a2e1e';
    ctx.strokeStyle = '#1D9E75';
    ctx.lineWidth = 1.5;
    const tw = Math.min(220, w * 0.28);
    drawRoundRect(lf.x - tw / 2, lf.y - 16, tw, 32, 5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#1D9E75';
    ctx.font = `bold ${Math.min(11, w * 0.014)}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(lf.text, lf.x, lf.y + 4);
    ctx.restore();
    lf.alpha -= 0.004;
    if (lf.alpha <= 0) state.ledFlash = null;
  }

  // zone ring
  const ringR = Math.min(w, h) * 0.18;
  const ringPulse = 0.7 + 0.3 * Math.sin(ts * 0.002);
  ctx.strokeStyle = `rgba(29,158,117,${0.35 * ringPulse})`;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 5]);
  ctx.beginPath();
  ctx.arc(ambX, ambY, ringR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  const radGrad = ctx.createRadialGradient(ambX, ambY, 0, ambX, ambY, ringR);
  radGrad.addColorStop(0, 'rgba(29,158,117,0.06)');
  radGrad.addColorStop(1, 'rgba(29,158,117,0)');
  ctx.fillStyle = radGrad;
  ctx.beginPath();
  ctx.arc(ambX, ambY, ringR, 0, Math.PI * 2);
  ctx.fill();

  // ambulance icon
  const dx = tx - ambX;
  const dy = ty - ambY;
  const angle = Math.atan2(dy, dx);
  drawAmbulance(ambX, ambY, angle);

  // labels
  ctx.fillStyle = 'rgba(138,184,168,0.35)';
  ctx.font = `${Math.max(9, w * 0.011)}px monospace`;
  ctx.textAlign = 'center';
  Object.entries(JUNCTIONS).forEach(([name, [xp, yp]]) => {
    ctx.fillText(name.split(' ')[0], xp * w, yp * h - 14);
  });

  // legend
  const lx = w - 130;
  const ly = h - 68;
  ctx.fillStyle = 'rgba(10,15,13,0.88)';
  ctx.strokeStyle = 'rgba(29,158,117,0.3)';
  ctx.lineWidth = 0.5;
  drawRoundRect(lx, ly, 120, 60, 6);
  ctx.fill();
  ctx.stroke();
  ctx.font = '10px monospace';
  ctx.textAlign = 'left';
  [
    [lx + 10, ly + 16, '#1D9E75', '● Green signal'],
    [lx + 10, ly + 32, '#E24B4A', '● Halted traffic'],
    [lx + 10, ly + 48, 'rgba(29,158,117,0.4)', '○ 1km radius']
  ].forEach(([x, y, c, t]) => {
    ctx.fillStyle = c;
    ctx.fillText(String(t), x, y);
  });

  requestAnimationFrame(drawMap);
}

// ================= SIGNAL REACTION =================
window.mapReact = function mapReact(layer, loc) {
  const matchKey = resolveLocationKey(loc);
  const point = matchKey && JUNCTIONS[matchKey] ? JUNCTIONS[matchKey] : [state.ambX, state.ambY];
  const [jx, jy] = point;

  if (layer === 'Infrastructure' || layer === 'Clearance' || layer === 'Dispatch') {
    const key = nearestSignalKey(jx, jy);
    if (key) {
      state.signalStates[key] = 'green';
      state.controlledSignals.add(key);
    }

    const routeNext = state.routePoints[state.routeIndex] || state.routePoints[1];
    if (routeNext) {
      const nextKey = nearestSignalKey(routeNext[0], routeNext[1]);
      if (nextKey) {
        state.signalStates[nextKey] = 'prepare';
        state.controlledSignals.add(nextKey);
      }
    }

    updateMapLabel(`Signal cleared — ${cleanLocationText(loc) || 'junction'}`, 'var(--green)');
    state.dispatchPulse = { x: jx * (canvas ? canvas.clientWidth : 1), y: jy * (canvas ? canvas.clientHeight : 1), alpha: 1.0 };
  }

  if (layer === 'Acoustic Layer') {
    if (canvas) {
      for (let i = 0; i < 4; i++) {
        setTimeout(() => {
          state.sirenWaves.push({
            x: state.ambX * canvas.clientWidth,
            y: state.ambY * canvas.clientHeight,
            r: 20 + i * 15,
            alpha: 0.7
          });
        }, i * 150);
      }
    }
    updateMapLabel('Acoustic siren active', 'var(--green)');
  }

  if (layer === 'Visual Layer') {
    if (canvas) {
      state.ledFlash = {
        x: jx * canvas.clientWidth,
        y: jy * canvas.clientHeight - 30,
        text: '⬅ AMBULANCE APPROACHING',
        alpha: 3.0
      };
    }
    updateMapLabel(`LED board → ${cleanLocationText(loc) || 'road'}`, 'var(--green)');
  }

  if (layer === 'SMS Layer') {
    if (canvas) {
      state.smsBlast = {
        x: state.ambX * canvas.clientWidth,
        y: state.ambY * canvas.clientHeight,
        r: 30,
        alpha: 0.8
      };
    }
    updateMapLabel('SMS blast — 800m zone', 'var(--amber)');
  }

  if (layer === 'Push Layer') {
    updateMapLabel('Push alerts sent to app users', 'var(--green-mid)');
  }

  if (layer === 'Dispatch') {
    state.speedMultiplier = 1.35;
    setTimeout(() => {
      state.speedMultiplier = 1;
    }, 6000);
  }
};

// ================= ALERT FEED =================
function renderAlertFeed(alerts) {
  const feed = document.getElementById('live-feed');
  if (!feed) return;

  feed.innerHTML = '';

  const list = Array.isArray(alerts) && alerts.length
    ? alerts
    : [{ type: 'INFO', message: 'No active alerts yet. Tap SOS to start a dispatch.' }];

  list.slice(0, 30).forEach((item) => {
    const type = String(item?.type || 'INFO').toUpperCase();
    const message = item?.message || item?.text || String(item);

    let icon = 'ℹ️';
    if (type === 'DISPATCH') icon = '🚨';
    else if (type === 'SIGNAL') icon = '🚦';
    else if (type === 'ZONE') icon = '📍';
    else if (type === 'CLEARANCE') icon = '✅';
    else if (type === 'SMS') icon = '📱';
    else if (type === 'PUSH') icon = '🔔';

    const div = document.createElement('div');
    div.className = 'alert-item-live';
    div.innerHTML = `
      <div class="alert-icon ${type === 'SMS' ? 'amber' : 'green'}" style="width:28px;height:28px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0;margin-top:2px;background:${type === 'SMS' ? 'rgba(239,159,39,0.15)' : type === 'ZONE' ? 'rgba(239,159,39,0.12)' : type === 'DISPATCH' ? 'rgba(226,75,74,0.15)' : 'rgba(29,158,117,0.15)'};color:${type === 'SMS' ? 'var(--amber)' : type === 'ZONE' ? 'var(--amber)' : type === 'DISPATCH' ? 'var(--red)' : 'var(--green)'}">
        ${icon}
      </div>
      <div style="flex:1;min-width:0">
        <div class="alert-text" style="font-size:13px;line-height:1.5">${message}</div>
        <div class="alert-time" style="font-size:10px;font-family:var(--mono);color:var(--text3);margin-top:2px">${timeNow()} · ${type}</div>
      </div>`;
    feed.appendChild(div);
  });
}

async function fetchAlerts() {
  try {
    const res = await fetch(`${API_BASE}/alerts`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`alerts ${res.status}`);
    const data = await res.json();
    const alerts = Array.isArray(data?.alerts) ? data.alerts : [];
    liveAlertCount = alerts.length;
    setText('live-count', `${liveAlertCount.toLocaleString()} alerts today`);
    renderAlertFeed(alerts);
  } catch (err) {
    console.error('Alert fetch error:', err);
    renderAlertFeed([]);
  }
}

// ================= STATS =================
async function fetchStats() {
  try {
    const res = await fetch(`${API_BASE}/stats`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`stats ${res.status}`);
    const data = await res.json();

    if (data && typeof data === 'object') {
      if (data.alerts != null) setText('stat-alerts', Number(data.alerts).toLocaleString());
      if (data.active_signals != null) setText('stat-signals', String(data.active_signals));
      if (data.active_zones != null) setText('stat-corridors', String(data.active_zones));
      if (data.active_ambulance) {
        const card = document.querySelector('.info-card');
        if (card && latestDispatch && latestDispatch.ambulance) {
          // keep current dispatch card; no-op
        }
      }
    }
  } catch (err) {
    console.error('Stats error:', err);
  }
}

// ================= AI CHAT =================
const conversations = [];
let isTyping = false;

function appendMsg(role, content, isHTML = false) {
  const container = document.getElementById('chat-messages');
  if (!container) return;

  const div = document.createElement('div');
  div.className = `msg ${role}`;

  const label = document.createElement('div');
  label.className = 'msg-label';
  label.textContent = role === 'user' ? 'YOU' : 'CLEARPATH AI';
  div.appendChild(label);

  const p = document.createElement('div');
  if (isHTML) p.innerHTML = content;
  else p.textContent = content;
  div.appendChild(p);

  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function showTyping() {
  const container = document.getElementById('chat-messages');
  if (!container) return;
  if (document.getElementById('typing-indicator')) return;

  const div = document.createElement('div');
  div.className = 'msg ai';
  div.id = 'typing-indicator';
  div.innerHTML = '<div class="msg-label">CLEARPATH AI</div><div class="typing"><span></span><span></span><span></span></div>';
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function hideTyping() {
  const el = document.getElementById('typing-indicator');
  if (el) el.remove();
}

function fallbackAIAnswer(lower) {
  if (lower.includes('location') || lower.includes('locate') || lower.includes('where am i')) {
    return `Your current location is ${locationStr}.`;
  }

  if ((lower.includes('route') || lower.includes('fastest') || lower.includes('hospital')) && latestDispatch?.route?.length) {
    return `Fastest route: ${latestDispatch.route.join(' → ')} (ETA: ${latestDispatch.eta || '—'}).`;
  }

  if (lower.includes('corridor') || lower.includes('signal')) {
    if (latestDispatch?.origin && latestDispatch?.destination) {
      return `Active corridor from ${latestDispatch.origin} to ${latestDispatch.destination}. The system is using predictive signal control and a 1km response zone.`;
    }
    return 'No active dispatch yet. Tap SOS to start the corridor.';
  }

  if (lower.includes('how') || lower.includes('work') || lower.includes('system')) {
    return 'The system predicts the ambulance path, clears signals ahead, activates alerts, and guides traffic through a moving 1km protective zone.';
  }

  return 'Ask about location, route, corridor, or system behavior.';
}

function buildLocalAIResponse(message) {
  const lower = String(message || '').toLowerCase();

  if (lower.includes('location') || lower.includes('locate') || lower.includes('where am i')) {
    return `Your current location is ${locationStr}.`;
  }

  if ((lower.includes('route') || lower.includes('fastest') || lower.includes('hospital')) && latestDispatch?.route?.length) {
    return `Fastest route: ${latestDispatch.route.join(' → ')} (ETA: ${latestDispatch.eta || '—'}).`;
  }

  if ((lower.includes('route') || lower.includes('fastest') || lower.includes('hospital')) && !latestDispatch?.route?.length) {
    return 'No active dispatch yet. Tap SOS to generate the fastest corridor route.';
  }

  if (lower.includes('corridor') || lower.includes('signal')) {
    if (latestDispatch?.origin && latestDispatch?.destination) {
      return `Active corridor from ${latestDispatch.origin} to ${latestDispatch.destination}. Predictive signal control is active and the ambulance follows the least-time route.`;
    }
    return 'No active dispatch yet. Tap SOS to start the corridor.';
  }

  if (lower.includes('how') || lower.includes('work') || lower.includes('system')) {
    return 'The system predicts the ambulance path, chooses the least-time route, clears signals ahead, slows at red, accelerates on green, and keeps a moving 1km response zone active.';
  }

  if (lower.includes('speed') || lower.includes('fast')) {
    return 'The ambulance accelerates on green signals, slows on prepare, and reroutes or pauses near red signals to minimize total response time.';
  }

  return 'Ask about location, route, corridor, speed, or system behavior.';
}

async function getAIResponse() {
  isTyping = true;
  showTyping();

  const userMessage = conversations[conversations.length - 1]?.content || '';
  const response = buildLocalAIResponse(userMessage);

  hideTyping();
  appendMsg('ai', response);
  isTyping = false;
}

async function sendChat() {
  const input = document.getElementById('chat-input');
  if (!input || isTyping) return;

  const msg = input.value.trim();
  if (!msg) return;

  input.value = '';
  appendMsg('user', msg);
  conversations.push({ role: 'user', content: msg });
  await getAIResponse();
}

function sendQuick(msg) {
  const input = document.getElementById('chat-input');
  if (!input) return;
  input.value = msg;
  sendChat();
}

// ================= SIMULATION =================
function addLog(time, channel, msg, type = '', badgeClass = 'infra') {
  const body = document.getElementById('log-body');
  if (!body) return;

  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.innerHTML = `<span class="log-time">${time}</span><span class="log-channel"><span class="badge ${badgeClass}">${channel}</span></span><span class="log-msg ${type}">${msg}</span>`;
  body.appendChild(entry);
  body.scrollTop = body.scrollHeight;
  logCount++;
  setText('log-count', `${logCount} events`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function updateUnitCard(ambulance, origin, dest, eta) {
  const el = document.querySelector('.info-card');
  if (!el) return;

  el.innerHTML = `
    <div class="feed-title">Active Unit: ${ambulance || 'AMB-01'}</div>
    <div class="info-row"><span class="info-key">Origin</span><span class="info-val">${origin || '-'}</span></div>
    <div class="info-row"><span class="info-key">Destination</span><span class="info-val">${dest || '-'}</span></div>
    <div class="info-row"><span class="info-key">ETA</span><span class="info-val green">${eta || '-'}</span></div>
    <div class="info-row"><span class="info-key">Speed</span><span class="info-val">38 km/h</span></div>
    <div class="info-row"><span class="info-key">Radius</span><span class="info-val green">1km active</span></div>
    <div class="info-row"><span class="info-key">Signals ahead</span><span class="info-val green">${Math.min(3, state.routePoints.length)} pre-cleared</span></div>
    <div class="info-row"><span class="info-key">Alert mode</span><span class="info-val green">All layers</span></div>
    <div class="info-row"><span class="info-key">Data required</span><span class="info-val green">ZERO (infra)</span></div>
  `;
}

function buildFallbackDispatch(origin, destination) {
  const start = resolveLocationKey(origin) || DEFAULT_ROUTE[0];
  const end = resolveLocationKey(destination) || DEFAULT_ROUTE[2];
  const mid1 = start === 'Koramangala' || end === 'Koramangala' ? 'Indiranagar' : 'Koramangala';
  const mid2 = end === 'MG Road' ? 'Jayanagar' : 'MG Road';

  const path = [start, mid1, mid2, end].filter(Boolean);
  const unique = [];
  path.forEach((p) => {
    if (!unique.length || unique[unique.length - 1] !== p) unique.push(p);
  });

  return {
    success: true,
    ambulance: 'AMB-01',
    origin: start,
    destination: end,
    route: unique,
    eta: `${Math.max(4, unique.length * 2)} mins`,
    signals: unique.map((junction, idx) => ({
      junction,
      signal: idx < 2 ? 'GREEN' : idx === 2 ? 'PREPARE' : 'RED',
      priority: idx < 2 ? 'HIGH' : idx === 2 ? 'MEDIUM' : 'LOW',
      distance: idx,
      zone_affected: idx < 3
    })),
    zone: [
      { center: start, radius: '1km', status: 'ACTIVE', priority: 'HIGH' },
      { center: mid1, radius: '1km', status: 'ACTIVE', priority: 'MEDIUM' }
    ],
    prediction: `Prepare clearance at ${unique[1] || start} and pre-activate signals`
  };
}

async function runSimulation() {
  if (simRunning) return;
  simRunning = true;
  logCount = 0;

  const btn = document.getElementById('dispatch-btn');
  const body = document.getElementById('log-body');
  const originRaw = document.getElementById('sim-origin')?.value || 'Koramangala';
  const destRaw = document.getElementById('sim-dest')?.value || 'Manipal Hospital';
  const radius = document.getElementById('sim-radius-val')?.textContent || '1000m';
  const useInfra = !!document.getElementById('tog-infra')?.checked;
  const useSMS = !!document.getElementById('tog-sms')?.checked;
  const usePush = !!document.getElementById('tog-push')?.checked;

  const origin = cleanLocationText(originRaw);
  const destination = cleanLocationText(destRaw);

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Dispatching…';
  }

  if (body) body.innerHTML = '';
  setText('log-count', '0 events');

  const now = () => timeNow();

  const setProgress = (value) => {
    const progress = document.getElementById('sim-progress');
    if (progress) progress.style.width = `${value}%`;
  };

  try {
    addLog(now(), 'DISPATCH', `SOS received — ${origin} → ${destination}`, 'success', 'infra');
    setProgress(8);
    await sleep(120);

    let data = null;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(`${API_BASE}/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origin, destination, radius }),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) throw new Error(`Dispatch request failed: ${response.status}`);
      data = await response.json();
    } catch (e) {
      console.warn('Using fallback dispatch data:', e);
      data = buildFallbackDispatch(origin, destination);
    }

    latestDispatch = data;

    addLog(now(), 'SYSTEM', `Ambulance assigned — ${data.ambulance || 'AMB-01'}`, 'success', 'infra');
    setProgress(18);
    await sleep(80);

    if (Array.isArray(data.route) && data.route.length) {
      addLog(now(), 'ROUTE', `Route locked — ${data.route.join(' → ')}`, '', 'infra');
    } else {
      addLog(now(), 'ROUTE', 'Route locked — fallback route active', '', 'infra');
    }

    rebuildRouteFromDispatch(data, origin, destination);
    window.mapReact?.('Dispatch', origin);
    setProgress(38);
    await sleep(80);

    if (Array.isArray(data.signals) && data.signals.length) {
      data.signals.forEach((sig) => {
        addLog(now(), 'SIGNAL', `${sig.junction} → ${String(sig.signal).toUpperCase()}`, 'success', 'infra');
        window.mapReact?.('Infrastructure', sig.junction);
      });
    }

    if (data.zone) {
      if (Array.isArray(data.zone)) {
        data.zone.forEach((z) => {
          addLog(now(), 'ZONE', `${z.center} → ${z.radius} (${z.priority || 'ACTIVE'})`, 'success', 'infra');
          window.mapReact?.('Dispatch', z.center);
        });
      } else if (typeof data.zone === 'object') {
        addLog(now(), 'ZONE', `${data.zone.center || origin} → ${data.zone.radius || radius} (${data.zone.priority || 'ACTIVE'})`, 'success', 'infra');
        window.mapReact?.('Dispatch', data.zone.center || origin);
      }
    }

    if (useInfra) {
      addLog(now(), 'INFRA', `Infrastructure corridor active in ${radius}`, 'success', 'infra');
      window.mapReact?.('Infrastructure', origin);
    } else {
      addLog(now(), 'INFRA', 'Infrastructure layer disabled', 'warn', 'infra');
    }

    if (useSMS) {
      addLog(now(), 'SMS', `SMS fallback prepared for ${radius} radius`, '', 'sms');
      window.mapReact?.('SMS Layer', origin);
    } else {
      addLog(now(), 'SMS', 'SMS layer disabled', 'warn', 'sms');
    }

    if (usePush) {
      addLog(now(), 'PUSH', 'Push alerts prepared for nearby app users', '', 'app');
      window.mapReact?.('Push Layer', origin);
    } else {
      addLog(now(), 'PUSH', 'Push layer disabled', 'warn', 'app');
    }

    setProgress(64);
    await sleep(80);

    addLog(now(), 'ETA', `Estimated arrival — ${data.eta || '—'}`, 'success', 'infra');

    if (data.prediction) {
      addLog(now(), 'AI', data.prediction, 'success', 'infra');
    }

    updateUnitCard(data.ambulance || 'AMB-01', origin, destination, data.eta || '—');
    addLog(now(), 'RESULT', 'Full system synchronized (route + signals + zone)', 'success', 'infra');
    setProgress(100);

    await fetchAlerts();
    await fetchStats();
  } catch (err) {
    console.error('Dispatch simulation failed:', err);
    addLog(now(), 'ERROR', 'Dispatch failed — backend unavailable', 'err', 'infra');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '🚑 Dispatch Emergency Unit';
    }
    simRunning = false;
  }
}

// ================= SOS =================
function bindSOSButton() {
  const sosBtn = document.getElementById('sosBtn');
  const sosLabel = document.getElementById('sosLabel');

  if (!sosBtn || !sosLabel) return;

  sosBtn.addEventListener('mouseenter', () => {
    sosLabel.style.display = 'block';
  });

  sosBtn.addEventListener('mouseleave', () => {
    sosLabel.style.display = 'none';
  });

  sosBtn.addEventListener('touchstart', () => {
    sosLabel.style.display = 'block';
    setTimeout(() => {
      sosLabel.style.display = 'none';
    }, 1200);
  }, { passive: true });
}

function handleSOS() {
  const sound = document.getElementById('sosSound');
  const sosLabel = document.getElementById('sosLabel');

  if (navigator.vibrate) {
    navigator.vibrate([180, 60, 180]);
  }

  if (sound) {
    sound.currentTime = 0;
    sound.play().catch(() => {});
  }

  if (sosLabel) {
    sosLabel.style.display = 'block';
    setTimeout(() => {
      sosLabel.style.display = 'none';
    }, 1200);
  }

  showSection('simulate');
  runSimulation();
}
window.handleSOS = handleSOS;
window.runSimulation = runSimulation;

// ================= FINAL AI RESPONSE HELPERS =================
function openInitialMessage() {
  const container = document.getElementById('chat-messages');
  if (!container) return;
  if (container.children.length > 0) return;

  appendMsg(
    'ai',
    `Hello. I'm the LsMapper emergency coordination assistant. I can detect your location, explain the active corridor, show route status, and answer questions about dispatch.`
  );
}

// ================= INIT =================
function resizeCanvas() {
  if (!canvas || !ctx || !canvas.parentElement) return;

  const rect = canvas.parentElement.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;

  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function init() {
  canvas = document.getElementById('mapCanvas');
  if (canvas) {
    ctx = canvas.getContext('2d');
    resizeCanvas();
    initSignalStates();
    setRoute(DEFAULT_ROUTE);
    mapStarted = true;
    requestAnimationFrame(drawMap);
  }

  detectLocation();
  openInitialMessage();
  bindSOSButton();

  fetchAlerts();
  fetchStats();

  setInterval(fetchAlerts, 6000);
  setInterval(fetchStats, 8000);

  // keep canvas sized when the window changes
  window.addEventListener('resize', resizeCanvas);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}