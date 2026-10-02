/* ==================================================================
   Denní dashboard — aplikační logika
   ================================================================== */
const CFG = window.DASHBOARD_CONFIG;
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

/* ---------- pomocné ---------- */

const pad2 = n => String(n).padStart(2, '0');

function tzOffsetMs(date, tz) {
  const naive = new Date(date.toLocaleString('sv-SE', { timeZone: tz }).replace(' ', 'T') + 'Z');
  return naive.getTime() - Math.floor(date.getTime() / 1000) * 1000;
}
function fmt(date, tz, opts) {
  return new Intl.DateTimeFormat('cs-CZ', { timeZone: tz, ...opts }).format(date);
}
function hhmm(date, tz) {
  return fmt(date, tz, { hour: '2-digit', minute: '2-digit', hour12: false });
}
function dayFraction(date, tz) {
  const ms = (date.getTime() + tzOffsetMs(date, tz)) % 86400000;
  return ((ms + 86400000) % 86400000) / 86400000;
}
function humanGap(ms) {
  const m = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(m / 60);
  return h ? h + ' h ' + pad2(m % 60) + ' min' : m + ' min';
}
function num(n, d = 0) {
  return (n === null || n === undefined || isNaN(n)) ? '–' : n.toFixed(d).replace('.', ',');
}
async function fetchJSON(url, opts) {
  const r = await fetch(url, opts);
  if (!r.ok) throw new Error(url + ' → ' + r.status);
  return r.json();
}

/* ==================================================================
   1. Obrazovky
   ================================================================== */
const deck = $('#deck');
let screens = [];

function setupScreens() {
  const wanted = CFG.screens.slice();
  if (!CFG.newsEndpoint) {
    const i = wanted.indexOf('news');
    if (i > -1) wanted.splice(i, 1);
  }
  $$('.screen').forEach(s => { if (!wanted.includes(s.dataset.screen)) s.remove(); });
  wanted.forEach(name => {
    const el = $('.screen[data-screen="' + name + '"]');
    if (el) deck.appendChild(el);
  });
  screens = $$('.screen');

  const dots = $('#dots');
  dots.innerHTML = '';
  screens.forEach((s, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-label', s.dataset.screen);
    b.addEventListener('click', () => goTo(i));
    dots.appendChild(b);
  });
  deck.addEventListener('scroll', markActive, { passive: true });
  markActive();
}
const currentIndex = () => Math.round(deck.scrollLeft / deck.clientWidth);
const goTo = i => deck.scrollTo({ left: i * deck.clientWidth, behavior: 'smooth' });

function markActive() {
  const i = currentIndex();
  $$('#dots button').forEach((b, n) => b.setAttribute('aria-current', n === i ? 'true' : 'false'));
  if (screens[i] && screens[i].dataset.screen === 'radar' && radarMap) {
    setTimeout(() => radarMap.invalidateSize(), 60);
  }
}
document.addEventListener('keydown', e => {
  if (e.key === 'ArrowRight') goTo(Math.min(screens.length - 1, currentIndex() + 1));
  if (e.key === 'ArrowLeft')  goTo(Math.max(0, currentIndex() - 1));
});

let rotatePausedUntil = 0;
function setupRotation() {
  if (!CFG.rotateSeconds) return;
  ['pointerdown', 'keydown'].forEach(ev =>
    document.addEventListener(ev, () => { rotatePausedUntil = Date.now() + 120000; }, { passive: true }));
  setInterval(() => {
    if (Date.now() < rotatePausedUntil) return;
    goTo((currentIndex() + 1) % screens.length);
  }, CFG.rotateSeconds * 1000);
}

/* ==================================================================
   2. Sluneční ciferník
   ================================================================== */
const PHASE_ORDER = [
  ['nadir',         'noc',                  '#151E2E'],
  ['nightEnd',      'astronomický úsvit',   '#22304F'],
  ['nauticalDawn',  'nautický úsvit',       '#3C4C7A'],
  ['dawn',          'občanský úsvit',       '#8A6E8F'],
  ['sunrise',       'zlatá hodina',         '#EFA855'],
  ['goldenHourEnd', 'den',                  '#FAE7C0'],
  ['goldenHour',    'zlatá hodina',         '#EFA855'],
  ['sunset',        'občanský soumrak',     '#8A6E8F'],
  ['dusk',          'nautický soumrak',     '#3C4C7A'],
  ['nauticalDusk',  'astronomický soumrak', '#22304F'],
  ['night',         'noc',                  '#151E2E']
];

function pointOn(cx, cy, r, deg) {
  const a = (deg - 90) * Math.PI / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}
function arcPath(cx, cy, r, d0, d1) {
  if (d1 <= d0) d1 += 360;
  const big = (d1 - d0) > 180 ? 1 : 0;
  const p0 = pointOn(cx, cy, r, d0);
  const p1 = pointOn(cx, cy, r, d1 - 0.01);
  return 'M ' + p0[0].toFixed(2) + ' ' + p0[1].toFixed(2) +
         ' A ' + r + ' ' + r + ' 0 ' + big + ' 1 ' + p1[0].toFixed(2) + ' ' + p1[1].toFixed(2);
}
const fracToDeg = f => f * 360 - 180;

function sunSegments(now) {
  const { lat, lon, tz } = CFG.home;
  const t = SunCalc.getTimes(now, lat, lon);
  const segs = [];
  PHASE_ORDER.forEach(p => {
    const d = t[p[0]];
    if (!d || isNaN(d.getTime())) return;
    segs.push({ frac: dayFraction(d, tz), label: p[1], color: p[2], time: d });
  });
  segs.sort((a, b) => a.frac - b.frac);
  return { segs: segs, times: t };
}

function drawDial() {
  if (!window.SunCalc) return;
  const svg = $('#dial');
  if (!svg) return;
  const now = new Date();
  const tz = CFG.home.tz;
  const res = sunSegments(now);
  const segs = res.segs, times = res.times;
  const cx = 200, cy = 200, r = 168, w = 26;
  let out = '';

  if (segs.length < 2) {
    out += '<circle cx="200" cy="200" r="168" fill="none" stroke="#22304F" stroke-width="26"/>';
  } else {
    segs.forEach((s, i) => {
      const next = segs[(i + 1) % segs.length];
      out += '<path d="' + arcPath(cx, cy, r, fracToDeg(s.frac), fracToDeg(next.frac)) +
             '" fill="none" stroke="' + s.color + '" stroke-width="' + w + '"/>';
    });
  }

  for (let h = 0; h < 24; h++) {
    const deg = fracToDeg(h / 24);
    const long = h % 6 === 0;
    const a = pointOn(cx, cy, r - w / 2 - 4, deg);
    const b = pointOn(cx, cy, r - w / 2 - (long ? 12 : 7), deg);
    out += '<line x1="' + a[0].toFixed(1) + '" y1="' + a[1].toFixed(1) +
           '" x2="' + b[0].toFixed(1) + '" y2="' + b[1].toFixed(1) +
           '" stroke="#33414F" stroke-width="' + (long ? 1.6 : 1) + '"/>';
    if (long) {
      const t = pointOn(cx, cy, r - w / 2 - 28, deg);
      out += '<text x="' + t[0].toFixed(1) + '" y="' + (t[1] + 4).toFixed(1) +
             '" text-anchor="middle" fill="#5E7185" font-size="13" font-family="Archivo, sans-serif">' + h + '</text>';
    }
  }

  const nf = dayFraction(now, tz);
  const deg = fracToDeg(nf);
  const hand = pointOn(cx, cy, r - w / 2 - 2, deg);
  const sun = pointOn(cx, cy, r, deg);
  out += '<line x1="200" y1="200" x2="' + hand[0].toFixed(1) + '" y2="' + hand[1].toFixed(1) +
         '" stroke="#E6EDF3" stroke-width="1.2" opacity=".5"/>';
  out += '<circle cx="' + sun[0].toFixed(1) + '" cy="' + sun[1].toFixed(1) +
         '" r="9" fill="#0E1620" stroke="#E6EDF3" stroke-width="2"/>';
  svg.innerHTML = out;

  let cur = segs[segs.length - 1], nxt = segs[0];
  for (let i = 0; i < segs.length; i++) {
    if (segs[i].frac <= nf) { cur = segs[i]; nxt = segs[(i + 1) % segs.length]; }
  }
  $('#phaseName').textContent = cur ? cur.label : '—';
  if (nxt) {
    let ms = nxt.time - now;
    if (ms < 0) ms += 86400000;
    $('#phaseNext').textContent = nxt.label + ' za ' + humanGap(ms);
  }
  const sr = times.sunrise, ss = times.sunset;
  $('#sunLine').innerHTML =
    (sr && !isNaN(sr.getTime()) ? '<span>východ <b>' + hhmm(sr, tz) + '</b></span>' : '') +
    (ss && !isNaN(ss.getTime()) ? '<span>západ <b>' + hhmm(ss, tz) + '</b></span>' : '');
}

/* ==================================================================
   3. Hodiny a světový čas
   ================================================================== */
function tickClock() {
  if (!$('#clock')) return;
  const now = new Date();
  const tz = CFG.home.tz;
  $('#clock').textContent = hhmm(now, tz);
  $('#date').textContent = fmt(now, tz, { weekday: 'long', day: 'numeric', month: 'long' });

  const homeDay = fmt(now, tz, { day: '2-digit', month: '2-digit' });
  $('#clocks').innerHTML = CFG.clocks.map(c => {
    const offH = (tzOffsetMs(now, c.tz) - tzOffsetMs(now, tz)) / 3600000;
    const abs = Math.abs(offH);
    const offTxt = offH === 0 ? '' :
      (offH > 0 ? '+' : '−') + (Number.isInteger(abs) ? abs : abs.toFixed(1).replace('.', ',')) + ' h';
    let dot = '#33414F';
    if (c.lat !== undefined && window.SunCalc) {
      const alt = SunCalc.getPosition(now, c.lat, c.lon).altitude;
      dot = alt > 0 ? '#EFA855' : (alt > -0.105 ? '#8A6E8F' : '#2A3A4C');
    }
    const theirDay = fmt(now, c.tz, { day: '2-digit', month: '2-digit' });
    const dayMark = theirDay === homeDay ? '' : ' <span class="off">' + theirDay + '</span>';
    return '<div class="clock-row"><span class="dot" style="background:' + dot + '"></span>' +
           '<span class="label">' + c.label + dayMark + '</span>' +
           '<span class="t">' + hhmm(now, c.tz) + '</span>' +
           '<span class="off">' + offTxt + '</span></div>';
  }).join('');
}

/* ==================================================================
   4. Počasí
   ================================================================== */
const WMO = {
  0: 'jasno', 1: 'skoro jasno', 2: 'polojasno', 3: 'zataženo',
  45: 'mlha', 48: 'namrzající mlha',
  51: 'slabé mrholení', 53: 'mrholení', 55: 'silné mrholení',
  56: 'mrznoucí mrholení', 57: 'silné mrznoucí mrholení',
  61: 'slabý déšť', 63: 'déšť', 65: 'silný déšť',
  66: 'mrznoucí déšť', 67: 'silný mrznoucí déšť',
  71: 'slabé sněžení', 73: 'sněžení', 75: 'silné sněžení', 77: 'sněhová zrna',
  80: 'přeháňky', 81: 'silné přeháňky', 82: 'velmi silné přeháňky',
  85: 'sněhové přeháňky', 86: 'silné sněhové přeháňky',
  95: 'bouřka', 96: 'bouřka s kroupami', 99: 'silná bouřka s kroupami'
};
const COMPASS = ['S', 'SV', 'V', 'JV', 'J', 'JZ', 'Z', 'SZ'];
const dirName = d => COMPASS[Math.round(((d % 360) / 45)) % 8];

let wxData = null;

async function loadWeather() {
  const { lat, lon } = CFG.home;
  const base = 'https://api.open-meteo.com/v1/forecast';
  const common = 'latitude=' + lat + '&longitude=' + lon + '&timezone=auto';
  const urlA = base + '?' + common +
    '&current=temperature_2m,apparent_temperature,relative_humidity_2m,is_day,precipitation,' +
    'cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m,weather_code' +
    '&hourly=temperature_2m,precipitation,precipitation_probability,cloud_cover,' +
    'wind_speed_10m,wind_gusts_10m,wind_direction_10m' +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,' +
    'precipitation_probability_max,wind_speed_10m_max' +
    '&forecast_days=' + CFG.weather.days;
  const models = CFG.weather.models.map(m => m.id).join(',');
  const urlB = base + '?' + common + '&hourly=temperature_2m&models=' + models + '&forecast_days=4';

  try {
    const both = await Promise.all([fetchJSON(urlA), fetchJSON(urlB)]);
    wxData = { a: both[0], b: both[1] };
    localStorage.setItem('wx_cache', JSON.stringify({ at: Date.now(), d: wxData }));
  } catch (e) {
    const c = JSON.parse(localStorage.getItem('wx_cache') || 'null');
    if (!c) { const st = $('#wxStamp'); if (st) st.textContent = 'předpověď se nenačetla'; return; }
    wxData = c.d;
  }
  renderWeather();
}

function renderWeather() {
  const a = wxData.a, tz = CFG.home.tz;
  const c = a.current;
  const set = (sel, html) => { const el = $(sel); if (el) el.innerHTML = html; };
  set('#wxPlace', CFG.home.name);
  set('#wxStamp', 'aktualizováno ' + hhmm(new Date(), tz));

  const cur =
    '<div class="temp">' + num(c.temperature_2m, 1) + ' °C</div>' +
    '<div class="col"><span class="k">pocitově</span><span class="v">' + num(c.apparent_temperature, 1) + ' °C</span></div>' +
    '<div class="col"><span class="k">obloha</span><span class="v">' + (WMO[c.weather_code] || '') + ', ' + num(c.cloud_cover) + ' %</span></div>' +
    '<div class="col"><span class="k">srážky</span><span class="v">' + num(c.precipitation, 1) + ' mm/h</span></div>' +
    '<div class="col"><span class="k">vítr</span><span class="v">' + dirName(c.wind_direction_10m) + ' ' +
      num(c.wind_speed_10m) + ' km/h, v nárazech ' + num(c.wind_gusts_10m) + '</span></div>';
  set('#wxNow', cur);
  set('#nowWx',
    '<span class="big">' + num(c.temperature_2m, 1) + ' °C</span>' +
    '<span class="bit">' + (WMO[c.weather_code] || '') + '</span>' +
    '<span class="bit">vítr <b>' + dirName(c.wind_direction_10m) + ' ' + num(c.wind_speed_10m) + '</b> km/h</span>' +
    '<span class="bit">oblačnost <b>' + num(c.cloud_cover) + '</b> %</span>');

  /* denní předpověď */
  const d = a.daily;
  set('#wxDays', d.time.map((iso, i) => {
    const dt = new Date(iso + 'T12:00');
    const dn = i === 0 ? 'dnes' : fmt(dt, tz, { weekday: 'short' });
    return '<div class="day-cell">' +
      '<span class="dn">' + dn + '</span>' +
      '<span class="tmax">' + num(d.temperature_2m_max[i]) + '°<span class="tmin"> / ' + num(d.temperature_2m_min[i]) + '°</span></span>' +
      '<span class="pp">' + num(d.precipitation_sum[i], 1) + ' mm · ' + num(d.precipitation_probability_max[i]) + ' %</span>' +
      '<span class="wd">vítr ' + num(d.wind_speed_10m_max[i]) + ' km/h</span>' +
      '<span class="wd">' + (WMO[d.weather_code[i]] || '') + '</span>' +
    '</div>';
  }).join(''));

  set('#wxLegend', CFG.weather.models.map(m =>
    '<span><i style="background:' + m.color + '"></i>' + m.label + '</span>').join('') +
    '<span><i style="background:#6FBFD0;height:8px"></i>srážky</span>' +
    '<span><i style="background:#FAE7C0;opacity:.5"></i>oblačnost</span>');

  drawMeteogram();
}

function drawMeteogram() {
  const a = wxData.a, b = wxData.b;
  const svg = $('#meteogram');
  if (!svg) return;
  const N = Math.min(CFG.weather.hours, a.hourly.time.length);
  const W = 1000, H = 340;
  const padL = 40, padR = 12, padT = 30, yTemp1 = 200, yPrec0 = 210, yPrec1 = 268, yWind = 300;
  const step = (W - padL - padR) / N;
  const x = i => padL + (i + 0.5) * step;

  const offSec = a.utc_offset_seconds || 0;
  const localTimes = a.hourly.time.slice(0, N).map(s => new Date(s));           // naivní, pro popisky
  const realTimes  = a.hourly.time.slice(0, N).map(s => new Date(Date.parse(s + 'Z') - offSec * 1000));

  /* řady modelů */
  const idxOf = {};
  b.hourly.time.forEach((t, i) => { idxOf[t] = i; });
  const series = CFG.weather.models.map(m => {
    const arr = b.hourly['temperature_2m_' + m.id] || [];
    return {
      color: m.color, label: m.label,
      values: a.hourly.time.slice(0, N).map(t => {
        const i = idxOf[t];
        return (i === undefined) ? null : arr[i];
      })
    };
  });

  let lo = Infinity, hi = -Infinity;
  series.forEach(s => s.values.forEach(v => { if (v != null) { lo = Math.min(lo, v); hi = Math.max(hi, v); } }));
  a.hourly.temperature_2m.slice(0, N).forEach(v => { if (v != null) { lo = Math.min(lo, v); hi = Math.max(hi, v); } });
  if (!isFinite(lo)) { lo = 0; hi = 10; }
  lo = Math.floor(lo - 1); hi = Math.ceil(hi + 1);
  const yT = v => yTemp1 - (v - lo) / (hi - lo) * (yTemp1 - padT);

  const precip = a.hourly.precipitation.slice(0, N);
  const pMax = Math.max(2, ...precip.map(v => v || 0));
  const cloud = a.hourly.cloud_cover.slice(0, N);

  let g = '';

  /* noc */
  const { lat, lon } = CFG.home;
  let runStart = null;
  for (let i = 0; i <= N; i++) {
    const night = i < N ? SunCalc.getPosition(realTimes[i], lat, lon).altitude < 0 : false;
    if (night && runStart === null) runStart = i;
    if (!night && runStart !== null) {
      g += '<rect x="' + x(runStart).toFixed(1) + '" y="0" width="' + ((i - runStart) * step).toFixed(1) +
           '" height="' + yPrec1 + '" fill="#000" opacity=".22"/>';
      runStart = null;
    }
  }

  /* oblačnost jako pruh nahoře */
  for (let i = 0; i < N; i++) {
    const cc = cloud[i];
    if (cc == null) continue;
    g += '<rect x="' + (x(i) - step / 2).toFixed(1) + '" y="4" width="' + (step + 0.6).toFixed(1) +
         '" height="14" fill="#FAE7C0" opacity="' + (0.06 + 0.5 * cc / 100).toFixed(3) + '"/>';
  }

  /* mřížka teplot */
  const span = hi - lo;
  const tStep = span > 25 ? 5 : (span > 12 ? 2 : 1);
  for (let v = Math.ceil(lo / tStep) * tStep; v <= hi; v += tStep) {
    const y = yT(v);
    g += '<line x1="' + padL + '" y1="' + y.toFixed(1) + '" x2="' + (W - padR) + '" y2="' + y.toFixed(1) +
         '" stroke="#24313F" stroke-width="1"/>' +
         '<text x="' + (padL - 6) + '" y="' + (y + 4).toFixed(1) + '" text-anchor="end" fill="#5E7185" font-size="12">' + v + '</text>';
  }

  /* dělení dnů */
  for (let i = 0; i < N; i++) {
    if (localTimes[i].getHours() !== 0 && i !== 0) continue;
    const xx = (x(i) - step / 2).toFixed(1);
    if (i !== 0) g += '<line x1="' + xx + '" y1="0" x2="' + xx + '" y2="' + yPrec1 + '" stroke="#2E3D4D" stroke-width="1"/>';
    const label = i === 0 ? 'dnes' : new Intl.DateTimeFormat('cs-CZ', { weekday: 'short' }).format(localTimes[i]);
    g += '<text x="' + (x(i) + 4).toFixed(1) + '" y="' + (H - 6) + '" fill="#8CA1B4" font-size="13">' + label + '</text>';
  }
  /* hodinové popisky po 6 h */
  for (let i = 0; i < N; i++) {
    const h = localTimes[i].getHours();
    if (h % 6 !== 0 || h === 0) continue;
    g += '<text x="' + x(i).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle" fill="#4E5F70" font-size="11">' + h + '</text>';
  }

  /* srážky */
  for (let i = 0; i < N; i++) {
    const v = precip[i];
    if (!v) continue;
    const hgt = (v / pMax) * (yPrec1 - yPrec0);
    g += '<rect x="' + (x(i) - step / 2 + 0.5).toFixed(1) + '" y="' + (yPrec1 - hgt).toFixed(1) +
         '" width="' + Math.max(1, step - 1).toFixed(1) + '" height="' + hgt.toFixed(1) + '" fill="#6FBFD0" opacity=".85"/>';
  }
  g += '<text x="' + (padL - 6) + '" y="' + (yPrec1 + 4) + '" text-anchor="end" fill="#5E7185" font-size="11">mm</text>';
  g += '<text x="' + (padL - 6) + '" y="' + (yPrec0 + 10) + '" text-anchor="end" fill="#5E7185" font-size="11">' + num(pMax, 1) + '</text>';

  /* teplotní křivky */
  series.forEach(s => {
    let dpath = '', pen = false;
    s.values.forEach((v, i) => {
      if (v == null) { pen = false; return; }
      dpath += (pen ? ' L ' : ' M ') + x(i).toFixed(1) + ' ' + yT(v).toFixed(1);
      pen = true;
    });
    if (dpath) g += '<path d="' + dpath + '" fill="none" stroke="' + s.color + '" stroke-width="2" stroke-linejoin="round"/>';
  });

  /* vítr */
  const wd = a.hourly.wind_direction_10m, ws = a.hourly.wind_speed_10m;
  for (let i = 0; i < N; i += 3) {
    if (ws[i] == null) continue;
    const rot = (wd[i] || 0) + 180;
    g += '<g transform="translate(' + x(i).toFixed(1) + ',' + yWind + ') rotate(' + rot + ')">' +
         '<path d="M0,-7 L0,7 M0,7 L-3.2,2.2 M0,7 L3.2,2.2" stroke="#8CA1B4" stroke-width="1.4" fill="none"/></g>';
    if (i % 6 === 0) {
      g += '<text x="' + x(i).toFixed(1) + '" y="' + (yWind + 24) + '" text-anchor="middle" fill="#5E7185" font-size="11">' +
           num(ws[i]) + '</text>';
    }
  }

  /* teď */
  const nowMs = Date.now();
  const t0 = realTimes[0].getTime();
  const hIdx = (nowMs - t0) / 3600000;
  if (hIdx >= 0 && hIdx < N) {
    const xx = (padL + (hIdx + 0.5) * step).toFixed(1);
    g += '<line x1="' + xx + '" y1="0" x2="' + xx + '" y2="' + yPrec1 + '" stroke="#EFA855" stroke-width="1.4" opacity=".9"/>';
  }

  svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
  svg.innerHTML = g;
}

/* ==================================================================
   5. Meteoradar
   ================================================================== */
let radarMap = null, radarFrames = [], radarLayers = [], radarIdx = 0, radarTimer = null, radarPlaying = true;

async function initRadar() {
  if (!$('#map') || !window.L) return;
  radarMap = L.map('map', { zoomControl: false, attributionControl: true })
    .setView([CFG.home.lat, CFG.home.lon], CFG.radar.zoom);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap, © CARTO', maxZoom: 18
  }).addTo(radarMap);
  radarMap.createPane('labels');
  radarMap.getPane('labels').style.zIndex = 650;
  radarMap.getPane('labels').style.pointerEvents = 'none';
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png',
    { pane: 'labels', maxZoom: 18 }).addTo(radarMap);

  $('#radarPlay').addEventListener('click', () => {
    radarPlaying = !radarPlaying;
    $('#radarPlay').textContent = radarPlaying ? 'Pauza' : 'Přehrát';
  });
  $('#radarSlider').addEventListener('input', e => {
    radarPlaying = false;
    $('#radarPlay').textContent = 'Přehrát';
    showFrame(parseInt(e.target.value, 10));
  });

  await loadRadar();
  clearInterval(radarTimer);
  radarTimer = setInterval(() => {
    if (radarPlaying && radarFrames.length) showFrame((radarIdx + 1) % radarFrames.length);
  }, CFG.radar.frameMs);
}

async function loadRadar() {
  if (!radarMap) return;
  let j;
  try {
    j = await fetchJSON('https://api.rainviewer.com/public/weather-maps.json');
  } catch (e) {
    $('#radarStamp').textContent = 'radar nedostupný';
    return;
  }
  const past = (j.radar && j.radar.past) || [];
  const nowcast = (j.radar && j.radar.nowcast) || [];
  const frames = past.concat(nowcast);
  if (!frames.length) { $('#radarStamp').textContent = 'radar nedostupný'; return; }

  radarLayers.forEach(l => radarMap.removeLayer(l));
  radarLayers = [];
  radarFrames = frames;

  const opts = CFG.radar.smooth + '_' + CFG.radar.snow;
  frames.forEach(f => {
    const url = j.host + f.path + '/512/{z}/{x}/{y}/' + CFG.radar.colorScheme + '/' + opts + '.png';
    const layer = L.tileLayer(url, { opacity: 0, maxNativeZoom: 7, maxZoom: 18, zIndex: 400 });
    layer.addTo(radarMap);
    radarLayers.push(layer);
  });
  $('#radarSlider').max = frames.length - 1;
  showFrame(past.length ? past.length - 1 : 0);
}

function showFrame(i) {
  if (!radarLayers.length || !$('#radarSlider')) return;
  radarIdx = i;
  radarLayers.forEach((l, n) => l.setOpacity(n === i ? 0.85 : 0));
  $('#radarSlider').value = i;
  const t = new Date(radarFrames[i].time * 1000);
  const future = radarFrames[i].time * 1000 > Date.now() + 60000;
  $('#radarStamp').textContent = hhmm(t, CFG.home.tz) + (future ? ' (předpověď)' : '');
}

/* ==================================================================
   6. Fotky
   ================================================================== */
let photoList = [], photoIdx = -1;

async function initPhotos() {
  const stage = $('#photoStage');
  if (!stage) return;
  try {
    const j = await fetchJSON(CFG.photos.manifest);
    photoList = (Array.isArray(j) ? j : j.photos || []).map(p => typeof p === 'string' ? { src: p } : p);
  } catch (e) {
    photoList = [];
  }
  if (!photoList.length) {
    stage.innerHTML = '<div class="setup" style="margin:auto;max-width:34ch">' +
      'Fotky zatím nejsou. Nahraj obrázky do složky <code>photos/</code> a vypiš je v <code>photos/photos.json</code>.</div>';
    stage.style.display = 'flex';
    return;
  }
  if (CFG.photos.shuffle) photoList.sort(() => Math.random() - 0.5);
  nextPhoto();
  setInterval(nextPhoto, (CFG.photos.intervalSec || 45) * 1000);
}

function nextPhoto() {
  const stage = $('#photoStage');
  photoIdx = (photoIdx + 1) % photoList.length;
  const p = photoList[photoIdx];
  const img = document.createElement('img');
  img.src = p.src;
  img.alt = p.caption || '';
  img.addEventListener('load', () => {
    requestAnimationFrame(() => img.classList.add('on'));
    Array.from(stage.querySelectorAll('img')).forEach(o => {
      if (o !== img) { o.classList.remove('on'); setTimeout(() => o.remove(), 1800); }
    });
  });
  stage.appendChild(img);
  $('#photoCaption').textContent = p.caption || '';
}

/* ==================================================================
   7. Memento mori
   ================================================================== */
function renderMemento() {
  const grid = $('#mmGrid');
  if (!grid) return;
  const birth = new Date(CFG.mementoMori.birthDate + 'T00:00:00');
  const years = CFG.mementoMori.lifeExpectancy;
  const weekMs = 7 * 86400000;
  const lived = Math.floor((Date.now() - birth.getTime()) / weekMs);
  const total = years * 52;

  const frag = document.createDocumentFragment();
  for (let i = 0; i < total; i++) {
    const s = document.createElement('span');
    if (i < lived) s.className = 'past';
    else if (i === lived) s.className = 'now';
    frag.appendChild(s);
  }
  grid.innerHTML = '';
  grid.appendChild(frag);

  const days = Math.floor((Date.now() - birth.getTime()) / 86400000);
  const fmtN = n => n.toLocaleString('cs-CZ');
  $('#mmLede').textContent = 'Žiješ ' + fmtN(days) + '. den.';
  $('#mmFoot').textContent = 'Za sebou ' + fmtN(lived) + ' týdnů z ' + fmtN(total) +
    '. Každý řádek je jeden rok, každé políčko jeden týden.';
}

/* ==================================================================
   8. Kalendář
   ================================================================== */
const SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
let gToken = null, gTokenClient = null;

function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.async = true; s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}

async function initCalendar() {
  if (!$('#agenda')) return;
  if (CFG.calendarEndpoint) {
    try {
      const evts = await fetchJSON(CFG.calendarEndpoint);
      renderAgenda(evts.map(e => ({
        start: new Date(e.start), end: new Date(e.end || e.start),
        allDay: !!e.allDay, title: e.title, location: e.location
      })));
    } catch (err) {
      $('#agenda').innerHTML = '<p class="muted">Kalendář se nenačetl.</p>';
    }
    return;
  }
  if (!CFG.google.clientId) {
    $('#agenda').innerHTML = '<div class="setup">Kalendář zatím není připojený. ' +
      'Doplň <code>google.clientId</code> v <code>config.js</code> — postup je v README.</div>';
    return;
  }
  try {
    await loadScript('https://accounts.google.com/gsi/client');
  } catch (e) {
    $('#agenda').innerHTML = '<p class="muted">Google se nepodařilo načíst.</p>';
    return;
  }
  gTokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CFG.google.clientId,
    scope: SCOPE,
    callback: resp => {
      if (!resp || !resp.access_token) return;
      gToken = resp.access_token;
      localStorage.setItem('gcal_token', JSON.stringify({
        t: gToken, exp: Date.now() + (resp.expires_in || 3600) * 1000
      }));
      loadEvents();
    },
    error_callback: () => showConnectButton()
  });

  const saved = JSON.parse(localStorage.getItem('gcal_token') || 'null');
  if (saved && saved.exp > Date.now() + 60000) {
    gToken = saved.t;
    loadEvents();
  } else {
    gTokenClient.requestAccessToken({ prompt: '' });
  }
}

function showConnectButton() {
  $('#agenda').innerHTML = '<div class="setup">Přístup ke kalendáři vypršel. ' +
    '<button class="btn" id="gConnect" type="button">Připojit Google kalendář</button></div>';
  $('#gConnect').addEventListener('click', () => gTokenClient.requestAccessToken({ prompt: 'consent' }));
}

async function loadEvents() {
  const tz = CFG.home.tz;
  const now = new Date();
  const from = new Date(now.getTime() - 4 * 3600000);
  const to = new Date(now.getTime() + CFG.google.daysAhead * 86400000);
  const out = [];
  try {
    for (const id of CFG.google.calendarIds) {
      const url = 'https://www.googleapis.com/calendar/v3/calendars/' + encodeURIComponent(id) +
        '/events?singleEvents=true&orderBy=startTime&maxResults=60' +
        '&timeMin=' + from.toISOString() + '&timeMax=' + to.toISOString() +
        '&timeZone=' + encodeURIComponent(tz);
      const r = await fetch(url, { headers: { Authorization: 'Bearer ' + gToken } });
      if (r.status === 401 || r.status === 403) {
        localStorage.removeItem('gcal_token');
        showConnectButton();
        return;
      }
      if (!r.ok) continue;
      const j = await r.json();
      (j.items || []).forEach(it => {
        const allDay = !!(it.start && it.start.date);
        out.push({
          allDay: allDay,
          start: new Date(allDay ? it.start.date + 'T00:00:00' : it.start.dateTime),
          end: new Date(allDay ? (it.end.date + 'T00:00:00') : it.end.dateTime),
          title: it.summary || '(bez názvu)',
          location: it.location || ''
        });
      });
    }
  } catch (e) {
    $('#agenda').innerHTML = '<p class="muted">Kalendář se nenačetl.</p>';
    return;
  }
  out.sort((a, b) => a.start - b.start);
  renderAgenda(out);
}

function renderAgenda(events) {
  const tz = CFG.home.tz;
  const box = $('#agenda');
  if (!box) return;
  if (!events.length) {
    box.innerHTML = '<p class="muted">Žádné události v následujících dnech.</p>';
    return;
  }
  const todayKey = fmt(new Date(), tz, { year: 'numeric', month: '2-digit', day: '2-digit' });
  const tomorrowKey = fmt(new Date(Date.now() + 86400000), tz, { year: 'numeric', month: '2-digit', day: '2-digit' });
  const now = Date.now();
  let html = '', lastKey = '';

  events.forEach(e => {
    const key = fmt(e.start, tz, { year: 'numeric', month: '2-digit', day: '2-digit' });
    if (key !== lastKey) {
      const label = key === todayKey ? 'dnes'
        : key === tomorrowKey ? 'zítra'
        : fmt(e.start, tz, { weekday: 'long', day: 'numeric', month: 'numeric' });
      html += '<div class="ag-day">' + label + '</div>';
      lastKey = key;
    }
    const running = now >= e.start.getTime() && now <= e.end.getTime();
    const when = e.allDay ? 'celý den' : hhmm(e.start, tz) + '–' + hhmm(e.end, tz);
    html += '<div class="ag-item' + (running ? ' now' : '') + '">' +
      '<span class="ag-bar"></span>' +
      '<span class="when">' + when + '</span>' +
      '<span class="what">' + escapeHTML(e.title) + (e.location ? ' <span class="muted">· ' + escapeHTML(e.location) + '</span>' : '') + '</span>' +
    '</div>';
  });
  box.innerHTML = html;
}
function escapeHTML(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/* ==================================================================
   9. Zprávy
   ================================================================== */
async function loadNews() {
  if (!CFG.newsEndpoint || !$('#newsList')) return;
  try {
    const items = await fetchJSON(CFG.newsEndpoint);
    $('#newsList').innerHTML = items.slice(0, 30).map(n =>
      '<a class="news-item" href="' + n.link + '" target="_blank" rel="noopener">' +
      '<span class="src">' + escapeHTML(n.source || '') + '</span>' +
      '<span>' + escapeHTML(n.title) + '</span></a>').join('');
    $('#newsStamp').textContent = hhmm(new Date(), CFG.home.tz);
  } catch (e) {
    $('#newsList').innerHTML = '<p class="muted">Zprávy se nenačetly.</p>';
  }
}

/* ==================================================================
   10. Start a obnovování
   ================================================================== */
async function keepAwake() {
  if (!CFG.keepAwake || !('wakeLock' in navigator)) return;
  try { await navigator.wakeLock.request('screen'); } catch (e) { /* ignorujeme */ }
}

function start() {
  setupScreens();
  setupRotation();

  tickClock();
  drawDial();
  setInterval(tickClock, 1000);
  setInterval(drawDial, 60000);

  renderMemento();
  setInterval(renderMemento, 3600000);

  loadWeather();
  setInterval(loadWeather, 10 * 60000);

  initCalendar();
  setInterval(() => { if (gToken) loadEvents(); }, 5 * 60000);

  initRadar();
  setInterval(loadRadar, 5 * 60000);

  initPhotos();
  loadNews();
  setInterval(loadNews, 15 * 60000);

  keepAwake();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    tickClock(); drawDial(); loadWeather(); loadRadar();
    if (gToken) loadEvents();
    loadNews(); keepAwake();
  });

  window.addEventListener('resize', () => { markActive(); });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

document.addEventListener('DOMContentLoaded', start);
