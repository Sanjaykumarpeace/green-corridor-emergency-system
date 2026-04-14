// NAVIGATION
function showSection(name, evt) {
  document.querySelectorAll('section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(b => b.classList.remove('active'));
  document.getElementById('section-' + name).classList.add('active');
  if (evt && evt.target) {
    evt.target.classList.add('active');
  }
}

// LOCATION DETECTION
let userLocation = null;
let locationStr = 'Locating…';

function detectLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(pos => {
      const lat = pos.coords.latitude.toFixed(5);
      const lng = pos.coords.longitude.toFixed(5);
      userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      locationStr = `${lat}° N, ${lng}° E`;
      const el = document.getElementById('ai-loc-display');
      if (el) el.textContent = `${locationStr} · Accuracy: ±${Math.round(pos.coords.accuracy)}m`;
    }, () => {
      locationStr = 'Bengaluru, Karnataka (12.9716° N, 77.5946° E)';
      const el = document.getElementById('ai-loc-display');
      if (el) el.textContent = locationStr + ' · GPS fallback';
    });
  }
}
detectLocation();

// LIVE ALERT FEED ENGINE
const LOCATIONS = ['MG Road','Brigade Rd','Residency Rd','Koramangala 5th Block','Indiranagar 100ft Rd','Jayanagar 4th Block','Silk Board Junction','Hebbal Flyover','Marathahalli Bridge','Richmond Circle','Lavelle Rd','Old Airport Rd','Bannerghatta Rd','Hosur Rd'];
const UNITS = ['AMB-07','AMB-03','AMB-11','AMB-15','FIRE-02','AMB-09'];
const HOSPITALS = ['Manipal Hospital','St. John\'s Hospital','Fortis Hospital','Apollo Hospital','Victoria Hospital','Narayana Health'];
const ALERT_EVENTS = [
  { icon:'📡', type:'green', layer:'Infrastructure', msgs: [
    (l)=>`Smart signal activated — ${l} junction pre-cleared`,
    (l)=>`Green corridor extended — ${l} signals synchronized`,
    (l)=>`Traffic light overridden — cross-traffic halted at ${l}`,
    (l)=>`Junction cleared 8s ahead — ${l} path open`,
  ]},
  { icon:'🔊', type:'green', layer:'Acoustic Layer', msgs: [
    (l)=>`Directional siren activated — 140dB broadcast at ${l}`,
    (l)=>`Acoustic warning fired — drivers alerted at ${l}`,
    (l)=>`Voice broadcast: "Ambulance approaching, move left" — ${l}`,
  ]},
  { icon:'📺', type:'green', layer:'Visual Layer', msgs: [
    (l)=>`LED board updated — "AMBULANCE APPROACHING →" at ${l}`,
    (l)=>`Roadside display active — flashing alert on ${l}`,
    (l)=>`Overhead LED board triggered — ${l} corridor`,
  ]},
  { icon:'📱', type:'amber', layer:'SMS Layer', msgs: [
    (l)=>`SMS batch fired — ${Math.floor(Math.random()*40+20)} numbers in 800m of ${l}`,
    (l)=>`SMS fallback triggered — geo-targeted alert near ${l}`,
    (l)=>`${Math.floor(Math.random()*30+15)} drivers notified via SMS — ${l} zone`,
  ]},
  { icon:'🔔', type:'green', layer:'Push Layer', msgs: [
    (l)=>`Push notification delivered — ${Math.floor(Math.random()*15+5)} app users near ${l}`,
    (l)=>`App alert: corridor active — ${l} area users notified`,
  ]},
  { icon:'🚨', type:'red', layer:'Dispatch', msgs: [
    (l,u,h)=>`New dispatch — Unit ${u}, ${l} → ${h}`,
    (l,u)=>`Unit ${u} en route — corridor activated from ${l}`,
  ]},
  { icon:'✅', type:'green', layer:'Clearance', msgs: [
    (l,u)=>`Path cleared — Unit ${u} passed ${l} · avg 14s`,
    (l)=>`Corridor segment complete — ${l} signals restored`,
  ]},
];

let liveAlertCount = 1284;

function timeNow() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
}

function pushAlert(isNew = true) {
  const ev = ALERT_EVENTS[Math.floor(Math.random() * ALERT_EVENTS.length)];
  const loc = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];
  const unit = UNITS[Math.floor(Math.random() * UNITS.length)];
  const hosp = HOSPITALS[Math.floor(Math.random() * HOSPITALS.length)];
  const msgFn = ev.msgs[Math.floor(Math.random() * ev.msgs.length)];
  const msg = msgFn(loc, unit, hosp);
  const t = timeNow();

  const feed = document.getElementById('live-feed');
  if (!feed) return;

  const item = document.createElement('div');
  item.className = 'alert-item-live';
  item.innerHTML = `
    <div class="alert-icon ${ev.type}" style="width:28px;height:28px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0;margin-top:2px;background:${ev.type==='green'?'rgba(29,158,117,0.15)':ev.type==='amber'?'rgba(239,159,39,0.15)':'rgba(226,75,74,0.15)'};color:${ev.type==='green'?'var(--green)':ev.type==='amber'?'var(--amber)':'var(--red)'}">
      ${ev.icon}
    </div>
    <div style="flex:1;min-width:0">
      <div class="alert-text" style="font-size:13px;line-height:1.5">${msg}${isNew?'<span class="new-badge">NEW</span>':''}</div>
      <div class="alert-time" style="font-size:10px;font-family:var(--mono);color:var(--text3);margin-top:2px">${t} · ${ev.layer}</div>
    </div>`;

  feed.insertBefore(item, feed.firstChild);

  // Keep max 30 items
  while (feed.children.length > 30) feed.removeChild(feed.lastChild);

  // Update counters
  liveAlertCount++;
  const statEl = document.getElementById('stat-alerts');
  if (statEl) statEl.textContent = liveAlertCount.toLocaleString();
  const countEl = document.getElementById('live-count');
  if (countEl) countEl.textContent = liveAlertCount.toLocaleString() + ' alerts today';

  // Flash the feed container border
  const feedBox = feed.closest('.alerts-feed');
  if (feedBox) { feedBox.classList.remove('flash-border'); void feedBox.offsetWidth; feedBox.classList.add('flash-border'); }

  // ★ TRIGGER MAP REACTION ★
  if (typeof window.mapReact === 'function') {
    // Extract location from message
    const locMatch = LOCATIONS.find(l => msg.includes(l));
    window.mapReact(ev.layer, locMatch || loc);
  }

  // Update unit info card dynamically sometimes
  if (ev.layer === 'Dispatch') updateUnitCard(unit, loc, hosp);
}

function updateUnitCard(unit, origin, dest) {
  const etaMin = Math.floor(Math.random()*6+2);
  const etaSec = Math.floor(Math.random()*59);
  const speed = Math.floor(Math.random()*20+28);
  const signals = Math.floor(Math.random()*6+4);
  const el = document.querySelector('.info-card');
  if (!el) return;
  el.innerHTML = `
    <div class="feed-title">Active Unit: ${unit}</div>
    <div class="info-row"><span class="info-key">Origin</span><span class="info-val">${origin}</span></div>
    <div class="info-row"><span class="info-key">Destination</span><span class="info-val">${dest}</span></div>
    <div class="info-row"><span class="info-key">ETA</span><span class="info-val green counting">${etaMin}m ${etaSec}s</span></div>
    <div class="info-row"><span class="info-key">Speed</span><span class="info-val">${speed} km/h</span></div>
    <div class="info-row"><span class="info-key">Radius</span><span class="info-val green">1km active</span></div>
    <div class="info-row"><span class="info-key">Signals ahead</span><span class="info-val green">${signals} pre-cleared</span></div>
    <div class="info-row"><span class="info-key">Alert mode</span><span class="info-val green">All layers</span></div>
    <div class="info-row"><span class="info-key">Data required</span><span class="info-val green">ZERO (infra)</span></div>`;
}

// Seed 6 initial alerts immediately
for (let i = 0; i < 6; i++) pushAlert(false);

// Fire live alerts at random intervals (3–7 seconds) — looks genuinely real
function scheduleNext() {
  const delay = Math.random() * 4000 + 3000;
  setTimeout(() => { pushAlert(true); scheduleNext(); }, delay);
}
scheduleNext();

// Also update the corridors/signals stats periodically
setInterval(() => {
  const sigs = document.getElementById('stat-signals');
  if (sigs) { const v = parseInt(sigs.textContent)||47; sigs.textContent = v + Math.floor(Math.random()*2); }
}, 8000);


// AI CHAT
const conversations = [];
let isTyping = false;

async function sendChat() {
  const input = document.getElementById('chat-input');
  const msg = input.value.trim();
  if (!msg || isTyping) return;
  input.value = '';
  appendMsg('user', msg);
  conversations.push({ role: 'user', content: msg });
  await getAIResponse();
}

function sendQuick(msg) {
  document.getElementById('chat-input').value = msg;
  sendChat();
}

function appendMsg(role, content, isHTML = false) {
  const container = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  const label = document.createElement('div');
  label.className = 'msg-label';
  label.textContent = role === 'user' ? 'YOU' : 'CLEARPATH AI';
  div.appendChild(label);
  if (isHTML) {
    const p = document.createElement('div');
    p.innerHTML = content;
    div.appendChild(p);
  } else {
    const p = document.createElement('div');
    p.textContent = content;
    div.appendChild(p);
  }
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div;
}

function showTyping() {
  const container = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = 'msg ai';
  div.id = 'typing-indicator';
  div.innerHTML = '<div class="msg-label">CLEARPATH AI</div><div class="typing"><span></span><span></span><span></span></div>';
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function hideTyping() {
  const t = document.getElementById('typing-indicator');
  if (t) t.remove();
}

async function getAIResponse() {
  isTyping = true;
  showTyping();
  try {
    const userMessage = conversations[conversations.length - 1]?.content || '';
    await new Promise(resolve => setTimeout(resolve, 350));

    const lower = userMessage.toLowerCase();
    let text = '';

    if (lower.includes('location') || lower.includes('locate') || lower.includes('where am i')) {
      text = `Your current detected location is ${locationStr}.`;
    } else if (lower.includes('nearest hospital') || lower.includes('hospital') || lower.includes('route')) {
      text = 'The fastest route depends on the live corridor state. Use the simulator to trigger a dispatch and I will show the active corridor path, ETA, and cleared signals.';
    } else if (lower.includes('corridor') || lower.includes('signal')) {
      text = 'Active corridor mode is enabled. The system uses infrastructure alerts first, then SMS fallback, then push notifications, with no driver app required for the core clearance flow.';
    } else if (lower.includes('how does') || lower.includes('how it works') || lower.includes('system')) {
      text = 'The system predicts a 1km clearance zone around the ambulance, then clears signals, activates acoustic and visual alerts, and falls back to SMS and push notifications if needed.';
    } else {
      text = 'I can help with your location, active corridor status, route analysis, or system behavior. Ask me for the nearest hospital, current location, or how the 1km clearance works.';
    }

    hideTyping();
    conversations.push({ role: 'assistant', content: text });

    // Add location card if location query
    if (lower.includes('location') || lower.includes('locate') || lower.includes('where am i')) {
      const htmlContent = `${text}<div class="location-card"><div class="loc-label">YOUR LOCATION</div><div class="loc-val">${locationStr}</div></div>`;
      appendMsg('ai', htmlContent, true);
    } else {
      appendMsg('ai', text);
    }
  } catch (e) {
    hideTyping();
    appendMsg('ai', 'Network error. Please check your connection and try again.');
    console.error('Chat error:', e);
  }
  isTyping = false;
}

// SIMULATION
let simRunning = false;
let logCount = 0;

function addLog(time, channel, msg, type='', badgeClass='infra') {
  const body = document.getElementById('log-body');
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.innerHTML = `<span class="log-time">${time}</span><span class="log-channel"><span class="badge ${badgeClass}">${channel}</span></span><span class="log-msg ${type}">${msg}</span>`;
  body.appendChild(entry);
  body.scrollTop = body.scrollHeight;
  logCount++;
  document.getElementById('log-count').textContent = logCount + ' events';
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runSimulation() {
  if (simRunning) return;
  simRunning = true;
  logCount = 0;

  const btn = document.getElementById('dispatch-btn');
  const body = document.getElementById('log-body');
  const origin = document.getElementById('sim-origin').value;
  const dest = document.getElementById('sim-dest').value;
  const radius = document.getElementById('sim-radius-val').textContent;
  const useInfra = !!document.getElementById('tog-infra')?.checked;
  const useSMS = !!document.getElementById('tog-sms')?.checked;
  const usePush = !!document.getElementById('tog-push')?.checked;

  btn.disabled = true;
  btn.textContent = 'Dispatching…';
  body.innerHTML = '';
  document.getElementById('log-count').textContent = '0 events';

  const now = () => {
    const d = new Date();
    return `${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}.${String(d.getMilliseconds()).slice(0, 2)}`;
  };

  const setProgress = (value) => {
    const progress = document.getElementById('sim-progress');
    if (progress) progress.style.width = `${value}%`;
  };

  try {
    addLog(now(), 'DISPATCH', `SOS received — ${origin} → ${dest}`, 'success', 'infra');
    setProgress(5);
    await sleep(300);

    const response = await fetch('http://127.0.0.1:5000/dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ origin, destination: dest, radius })
    });

    if (!response.ok) {
      throw new Error(`Dispatch request failed: ${response.status}`);
    }

    const data = await response.json();
    addLog(now(), 'SYSTEM', `Ambulance assigned — ${data.ambulance}`, 'success', 'infra');
    setProgress(18);
    await sleep(250);

    addLog(now(), 'ROUTE', `Route locked — ${data.route.join(' → ')}`, '', 'infra');
    setProgress(40);
    await sleep(250);

    if (useInfra) {
      addLog(now(), 'INFRA', `Infrastructure corridor active in ${radius}`, 'success', 'infra');
      if (typeof window.mapReact === 'function') window.mapReact('Infrastructure', origin);
    } else {
      addLog(now(), 'INFRA', 'Infrastructure layer disabled', 'warn', 'infra');
    }

    if (useSMS) {
      addLog(now(), 'SMS', `SMS fallback prepared for ${radius} radius`, '', 'sms');
      if (typeof window.mapReact === 'function') window.mapReact('SMS Layer', origin);
    } else {
      addLog(now(), 'SMS', 'SMS layer disabled', 'warn', 'sms');
    }

    if (usePush) {
      addLog(now(), 'PUSH', 'Push alerts prepared for nearby app users', '', 'app');
      if (typeof window.mapReact === 'function') window.mapReact('Push Layer', origin);
    } else {
      addLog(now(), 'PUSH', 'Push layer disabled', 'warn', 'app');
    }

    setProgress(65);
    await sleep(200);

    addLog(now(), 'ETA', `Estimated arrival — ${data.eta}`, 'success', 'infra');
    setProgress(70);
    await sleep(200);

    if (typeof window.mapReact === 'function') {
      window.mapReact('Dispatch', origin);
    }

    if (typeof updateUnitCard === 'function') {
      updateUnitCard(data.ambulance, origin, dest);
    }

    addLog(now(), 'RESULT', 'Dispatch synchronized with backend', 'success', 'infra');
    setProgress(100);
  } catch (err) {
    console.error('Dispatch simulation failed:', err);
    addLog(now(), 'ERROR', 'Dispatch failed — backend unavailable', 'err', 'infra');
  } finally {
    btn.disabled = false;
    btn.textContent = '🚑 Dispatch Emergency Unit';
    simRunning = false;
  }
}

// ═══════════════════════════════════════════════════
// LIVE MAP ENGINE — synced to alert feed
// ═══════════════════════════════════════════════════
const mapCanvas = document.getElementById('mapCanvas');
const ctx = mapCanvas.getContext('2d');

// Road intersections as named grid points [x%, y%]
const JUNCTIONS = {
  'MG Road':           [0.37, 0.24],
  'Brigade Rd':        [0.55, 0.24],
  'Residency Rd':      [0.55, 0.52],
  'Koramangala':       [0.74, 0.52],
  'Indiranagar':       [0.74, 0.24],
  'Jayanagar':         [0.37, 0.52],
  'Silk Board':        [0.55, 0.81],
  'Hebbal':            [0.37, 0.81],
  'Marathahalli':      [0.74, 0.81],
  'Richmond Circle':   [0.18, 0.52],
  'Lavelle Rd':        [0.18, 0.24],
  'Old Airport Rd':    [0.74, 0.81],
  'Bannerghatta Rd':   [0.18, 0.81],
  'Hosur Rd':          [0.55, 0.81],
};

// All grid intersections for traffic signals
const SIGNAL_GRID = [
  [0.18,0.24],[0.37,0.24],[0.55,0.24],[0.74,0.24],
  [0.18,0.52],[0.37,0.52],[0.55,0.52],[0.74,0.52],
  [0.18,0.81],[0.37,0.81],[0.55,0.81],[0.74,0.81],
];

// Map state
let mapState = {
  ambX: 0.37, ambY: 0.52,        // ambulance position
  targetX: 0.37, targetY: 0.24,  // current target junction
  signalStates: {},               // junction key → 'green'|'red'|'amber'
  sirenWaves: [],                 // [{x,y,r,alpha}]
  ledFlash: null,                 // {x,y,text,alpha}
  smsBlast: null,                 // {x,y,r,alpha}
  dispatchPulse: null,            // {x,y,alpha}
};

// Init signal states
SIGNAL_GRID.forEach(([x,y]) => {
  mapState.signalStates[`${x},${y}`] = Math.random()>0.5 ? 'red' : 'amber';
});

// Pre-planned route waypoints for ambulance
const ROUTE_WAYPOINTS = [
  [0.55,0.81],[0.55,0.52],[0.37,0.52],[0.37,0.24],
  [0.55,0.24],[0.74,0.24],[0.74,0.52],[0.55,0.52],
  [0.55,0.81],[0.37,0.81],[0.18,0.81],[0.18,0.52],
  [0.18,0.24],[0.37,0.24],[0.37,0.52],[0.55,0.52],
];
let waypointIdx = 0;
let ambSpeed = 0.0012;

// Resize canvas to container
function resizeMap() {
  const rect = mapCanvas.parentElement.getBoundingClientRect();
  mapCanvas.width  = rect.width  * window.devicePixelRatio;
  mapCanvas.height = rect.height * window.devicePixelRatio;
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
}
resizeMap();
window.addEventListener('resize', resizeMap);

function W() { return mapCanvas.width  / window.devicePixelRatio; }
function H() { return mapCanvas.height / window.devicePixelRatio; }

// ── DRAW FRAME ──────────────────────────────────────
function drawMap(ts) {
  const w = W(), h = H();
  ctx.clearRect(0,0,w,h);

  // Background
  ctx.fillStyle = '#0a0f0d';
  ctx.fillRect(0,0,w,h);

  // Grid roads
  ctx.strokeStyle = '#162019';
  ctx.lineWidth = 14;
  [0.18,0.37,0.55,0.74].forEach(xp => {
    ctx.beginPath(); ctx.moveTo(xp*w,0); ctx.lineTo(xp*w,h); ctx.stroke();
  });
  [0.24,0.52,0.81].forEach(yp => {
    ctx.beginPath(); ctx.moveTo(0,yp*h); ctx.lineTo(w,yp*h); ctx.stroke();
  });

  // Road center lines (dashed)
  ctx.strokeStyle = '#1e2f26';
  ctx.lineWidth = 1;
  ctx.setLineDash([8,8]);
  [0.18,0.37,0.55,0.74].forEach(xp => {
    ctx.beginPath(); ctx.moveTo(xp*w,0); ctx.lineTo(xp*w,h); ctx.stroke();
  });
  [0.24,0.52,0.81].forEach(yp => {
    ctx.beginPath(); ctx.moveTo(0,yp*h); ctx.lineTo(w,yp*h); ctx.stroke();
  });
  ctx.setLineDash([]);

  // City blocks (between road grid)
  const cols = [0, 0.18, 0.37, 0.55, 0.74, 1.0];
  const rows = [0, 0.24, 0.52, 0.81, 1.0];
  ctx.fillStyle = '#0e1814';
  for (let r=0;r<rows.length-1;r++) for (let c=0;c<cols.length-1;c++) {
    const pad = 10;
    const x = cols[c]*w+pad, y = rows[r]*h+pad;
    const bw = (cols[c+1]-cols[c])*w - pad*2 - 14;
    const bh = (rows[r+1]-rows[r])*h - pad*2 - 14;
    if (bw>0 && bh>0) {
      ctx.fillStyle = (r+c)%2===0 ? '#0e1814' : '#111c17';
      roundRect(ctx, x, y, bw, bh, 4);
      ctx.fill();
    }
  }

  // Corridor glow behind ambulance path
  const ax = mapState.ambX * w;
  const ay = mapState.ambY * h;
  const tx = mapState.targetX * w;
  const ty = mapState.targetY * h;

  // Draw full planned route faintly
  ctx.strokeStyle = 'rgba(29,158,117,0.08)';
  ctx.lineWidth = 12;
  ctx.beginPath();
  ROUTE_WAYPOINTS.forEach(([x,y],i) => {
    i===0 ? ctx.moveTo(x*w,y*h) : ctx.lineTo(x*w,y*h);
  });
  ctx.stroke();

  // Active corridor segment (bright)
  const pulseMult = 0.5 + 0.5*Math.sin(ts*0.003);
  const gradC = ctx.createLinearGradient(ax,ay,tx,ty);
  gradC.addColorStop(0,'rgba(29,158,117,0.6)');
  gradC.addColorStop(1,'rgba(29,158,117,0.15)');
  ctx.strokeStyle = gradC;
  ctx.lineWidth = 18;
  ctx.beginPath();
  ctx.moveTo(ax,ay);
  ctx.lineTo(tx,ty);
  ctx.stroke();

  // Corridor dashes moving forward
  ctx.strokeStyle = `rgba(93,202,165,${0.4 + 0.3*pulseMult})`;
  ctx.lineWidth = 3;
  ctx.setLineDash([12,8]);
  ctx.lineDashOffset = -(ts * 0.04) % 20;
  ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(tx,ty); ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineDashOffset = 0;

  // Traffic signals at every junction
  SIGNAL_GRID.forEach(([xp,yp]) => {
    const key = `${xp},${yp}`;
    const state = mapState.signalStates[key] || 'red';
    const sx = xp*w, sy = yp*h;
    const blink = Math.sin(ts*0.004) > 0;

    // Signal housing
    ctx.fillStyle = '#1a2820';
    ctx.beginPath(); ctx.arc(sx,sy,7,0,Math.PI*2); ctx.fill();

    if (state==='green') {
      ctx.fillStyle = blink ? '#1D9E75' : '#5DCAA5';
      ctx.shadowBlur = 12; ctx.shadowColor = '#1D9E75';
    } else if (state==='red') {
      ctx.fillStyle = '#E24B4A';
      ctx.shadowBlur = 8; ctx.shadowColor = '#E24B4A';
    } else {
      ctx.fillStyle = '#EF9F27';
      ctx.shadowBlur = 6; ctx.shadowColor = '#EF9F27';
    }
    ctx.beginPath(); ctx.arc(sx,sy,5,0,Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;
  });

  // SMS blast ring
  if (mapState.smsBlast) {
    const s = mapState.smsBlast;
    ctx.strokeStyle = `rgba(239,159,39,${s.alpha})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([6,6]);
    ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2); ctx.stroke();
    ctx.setLineDash([]);
    s.r += 1.5; s.alpha -= 0.012;
    if (s.alpha <= 0) mapState.smsBlast = null;
  }

  // Siren acoustic waves
  mapState.sirenWaves = mapState.sirenWaves.filter(w => w.alpha > 0);
  mapState.sirenWaves.forEach(wave => {
    ctx.strokeStyle = `rgba(29,158,117,${wave.alpha})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(wave.x,wave.y,wave.r,0,Math.PI*2); ctx.stroke();
    wave.r += 2.5; wave.alpha -= 0.018;
  });

  // Dispatch pulse
  if (mapState.dispatchPulse) {
    const dp = mapState.dispatchPulse;
    ctx.strokeStyle = `rgba(226,75,74,${dp.alpha})`;
    ctx.lineWidth = 3;
    const pr = (1-dp.alpha) * 60;
    ctx.beginPath(); ctx.arc(dp.x,dp.y,pr,0,Math.PI*2); ctx.stroke();
    dp.alpha -= 0.015;
    if (dp.alpha <= 0) mapState.dispatchPulse = null;
  }

  // LED board flash
  if (mapState.ledFlash) {
    const lf = mapState.ledFlash;
    ctx.save();
    ctx.globalAlpha = Math.min(1, lf.alpha);
    ctx.fillStyle = '#0a2e1e';
    ctx.strokeStyle = '#1D9E75';
    ctx.lineWidth = 1.5;
    const tw = Math.min(220, w*0.28);
    roundRect(ctx, lf.x - tw/2, lf.y - 16, tw, 32, 5);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#1D9E75';
    ctx.font = `bold ${Math.min(11,w*0.014)}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(lf.text, lf.x, lf.y + 4);
    ctx.restore();
    lf.alpha -= 0.004;
    if (lf.alpha <= 0) mapState.ledFlash = null;
  }

  // 1km radius ring around ambulance
  const ringR = Math.min(w,h) * 0.18;
  const ringPulse = 0.7 + 0.3*Math.sin(ts*0.002);
  ctx.strokeStyle = `rgba(29,158,117,${0.35*ringPulse})`;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6,5]);
  ctx.beginPath(); ctx.arc(ax,ay,ringR,0,Math.PI*2); ctx.stroke();
  ctx.setLineDash([]);

  // Radius fill
  const radGrad = ctx.createRadialGradient(ax,ay,0,ax,ay,ringR);
  radGrad.addColorStop(0,'rgba(29,158,117,0.06)');
  radGrad.addColorStop(1,'rgba(29,158,117,0)');
  ctx.fillStyle = radGrad;
  ctx.beginPath(); ctx.arc(ax,ay,ringR,0,Math.PI*2); ctx.fill();

  // Ambulance icon
  drawAmbulance(ctx, ax, ay, ts);

  // Junction name labels (faint)
  ctx.fillStyle = 'rgba(138,184,168,0.35)';
  ctx.font = `${Math.max(9,w*0.011)}px monospace`;
  ctx.textAlign = 'center';
  Object.entries(JUNCTIONS).forEach(([name,[xp,yp]]) => {
    ctx.fillText(name.split(' ')[0], xp*w, yp*h - 14);
  });

  // Legend box
  const lx = w - 130, ly = h - 68;
  ctx.fillStyle = 'rgba(10,15,13,0.88)';
  ctx.strokeStyle = 'rgba(29,158,117,0.3)';
  ctx.lineWidth = 0.5;
  roundRect(ctx,lx,ly,120,60,6); ctx.fill(); ctx.stroke();
  ctx.font = '10px monospace'; ctx.textAlign = 'left';
  [[lx+10,ly+16,'#1D9E75','● Green signal'],[lx+10,ly+32,'#E24B4A','● Halted traffic'],[lx+10,ly+48,'rgba(29,158,117,0.4)','○ 1km radius']].forEach(([x,y,c,t]) => {
    ctx.fillStyle=c; ctx.fillText(t,x,y);
  });

  // Move ambulance toward target
  const dx = mapState.targetX - mapState.ambX;
  const dy = mapState.targetY - mapState.ambY;
  const dist = Math.sqrt(dx*dx+dy*dy);
  if (dist < 0.015) {
    // Reached waypoint — pick next
    waypointIdx = (waypointIdx+1) % ROUTE_WAYPOINTS.length;
    mapState.targetX = ROUTE_WAYPOINTS[waypointIdx][0];
    mapState.targetY = ROUTE_WAYPOINTS[waypointIdx][1];
    // Clear the junction ahead
    greenifyAhead();
  } else {
    mapState.ambX += (dx/dist) * ambSpeed;
    mapState.ambY += (dy/dist) * ambSpeed;
  }

  requestAnimationFrame(drawMap);
}

function drawAmbulance(ctx, x, y, ts) {
  const s = 18;
  ctx.save();
  ctx.translate(x, y);

  // Glow
  ctx.shadowBlur = 20; ctx.shadowColor = '#1D9E75';
  ctx.fillStyle = '#1D9E75';
  roundRect(ctx, -s, -s*0.6, s*2, s*1.2, 4);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Cross
  ctx.fillStyle = 'white';
  ctx.fillRect(-4, -s*0.45, 8, s*0.9);
  ctx.fillRect(-s*0.7, -4, s*1.4, 8);
  ctx.fillStyle = '#E24B4A';
  ctx.fillRect(-3, -s*0.4, 6, s*0.8);
  ctx.fillRect(-s*0.65, -3, s*1.3, 6);

  // Flashing lights
  const blink = Math.sin(ts*0.015) > 0;
  ctx.fillStyle = blink ? '#E24B4A' : 'rgba(226,75,74,0.3)';
  ctx.beginPath(); ctx.arc(-s+3, -s*0.4, 3, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = blink ? 'rgba(29,158,117,0.4)' : '#1D9E75';
  ctx.beginPath(); ctx.arc(-s+3,  s*0.4, 3, 0, Math.PI*2); ctx.fill();

  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.lineTo(x+w-r, y); ctx.arcTo(x+w,y,x+w,y+r,r);
  ctx.lineTo(x+w, y+h-r); ctx.arcTo(x+w,y+h,x+w-r,y+h,r);
  ctx.lineTo(x+r, y+h); ctx.arcTo(x,y+h,x,y+h-r,r);
  ctx.lineTo(x, y+r); ctx.arcTo(x,y,x+r,y,r);
  ctx.closePath();
}

function greenifyAhead() {
  // Turn signals green along the next 2 waypoints
  for (let i=0;i<3;i++) {
    const wi = (waypointIdx+i) % ROUTE_WAYPOINTS.length;
    const [xp,yp] = ROUTE_WAYPOINTS[wi];
    mapState.signalStates[`${xp},${yp}`] = 'green';
  }
  // Red everything else
  SIGNAL_GRID.forEach(([xp,yp]) => {
    const key = `${xp},${yp}`;
    const isAhead = Object.values(mapState.signalStates).some(v=>v==='green') &&
      mapState.signalStates[key]==='green';
    if (!isAhead && mapState.signalStates[key]!=='green') {
      mapState.signalStates[key] = Math.random()>0.3 ? 'red' : 'amber';
    }
  });
}

// ── MAP REACTION TO ALERT EVENTS ─────────────────────
window.mapReact = function(layer, loc) {
  // Find junction coords for this location
  let jx = mapState.ambX, jy = mapState.ambY;
  Object.entries(JUNCTIONS).forEach(([name,[xp,yp]]) => {
    if (loc && loc.toLowerCase().includes(name.split(' ')[0].toLowerCase())) {
      jx = xp; jy = yp;
    }
  });

  if (layer === 'Infrastructure' || layer === 'Clearance') {
    // Green up that signal
    const key = `${jx},${jy}`;
    mapState.signalStates[key] = 'green';
    // Red cross-traffic (perpendicular)
    SIGNAL_GRID.forEach(([xp,yp]) => {
      if (Math.abs(xp-jx)<0.01 && Math.abs(yp-jy)>0.1) mapState.signalStates[`${xp},${yp}`] = 'red';
      if (Math.abs(yp-jy)<0.01 && Math.abs(xp-jx)>0.1) mapState.signalStates[`${xp},${yp}`] = 'red';
    });
    // Update map header
    const lbl = document.getElementById('map-event-label');
    if (lbl) { lbl.textContent = `Signal cleared — ${loc||'junction'}`; lbl.style.color='var(--green)'; }
  }

  if (layer === 'Acoustic Layer') {
    // Ripple siren waves from ambulance
    for (let i=0;i<4;i++) {
      setTimeout(()=>{
        mapState.sirenWaves.push({x:mapState.ambX*W(), y:mapState.ambY*H(), r:20+i*15, alpha:0.7});
      }, i*200);
    }
    const lbl = document.getElementById('map-event-label');
    if (lbl) { lbl.textContent = 'Acoustic siren active'; lbl.style.color='var(--green)'; }
  }

  if (layer === 'Visual Layer') {
    // LED board flash at nearest junction
    mapState.ledFlash = {
      x: jx * W(),
      y: jy * H() - 30,
      text: '⬅ AMBULANCE APPROACHING',
      alpha: 3.0
    };
    const lbl = document.getElementById('map-event-label');
    if (lbl) { lbl.textContent = `LED board → ${loc||'road'}`; lbl.style.color='var(--green)'; }
  }

  if (layer === 'SMS Layer') {
    // Expanding dashed ring from ambulance
    mapState.smsBlast = { x: mapState.ambX*W(), y: mapState.ambY*H(), r: 30, alpha: 0.8 };
    const lbl = document.getElementById('map-event-label');
    if (lbl) { lbl.textContent = 'SMS blast — 800m zone'; lbl.style.color='var(--amber)'; }
  }

  if (layer === 'Dispatch') {
    // Red pulse from a random junction (origin)
    const rj = SIGNAL_GRID[Math.floor(Math.random()*SIGNAL_GRID.length)];
    mapState.dispatchPulse = { x: rj[0]*W(), y: rj[1]*H(), alpha: 1.0 };
    // Speed up ambulance slightly
    ambSpeed = 0.0016;
    setTimeout(()=>{ ambSpeed = 0.0012; }, 6000);
    const lbl = document.getElementById('map-event-label');
    if (lbl) { lbl.textContent = `New dispatch — corridor activated`; lbl.style.color='var(--red)'; }
    setTimeout(()=>{
      if (lbl) { lbl.textContent = '1km radius active'; lbl.style.color='var(--green)'; }
    }, 4000);
  }

  if (layer === 'Push Layer') {
    const lbl = document.getElementById('map-event-label');
    if (lbl) { lbl.textContent = 'Push alerts sent to app users'; lbl.style.color='var(--green-mid)'; }
  }
};

// Kick off map rendering
greenifyAhead();
requestAnimationFrame(drawMap);