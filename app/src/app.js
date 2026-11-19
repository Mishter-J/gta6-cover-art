// Vice Cover Studio — a GTA-style multi-panel cover art maker.
// Everything runs offline: photos are read on the user's own machine,
// fonts ship under app/fonts/ (SIL Open Font License), and the cover is
// drawn on a canvas and exported as a PNG in three post sizes.

const $ = (id) => document.getElementById(id);

const SIZES = {
  square: { label: 'Square · 1080 × 1080', w: 1080, h: 1080 },
  portrait: { label: 'Portrait · 1080 × 1350', w: 1080, h: 1350 },
  wide: { label: 'Wide · 1920 × 1080', w: 1920, h: 1080 },
};

const GRADES = {
  sunset: {
    label: 'Sunset',
    swatch: 'linear-gradient(135deg,#ffb13d,#ff2e88)',
    tint: '255,110,40', sat: 1.28, con: 1.06,
    bandTop: '#3b0f5e', bandBottom: '#ff2e88',
    script: '#ff8ad0', titleMid: '#ffe27a', titleBottom: '#ff5ea8',
  },
  neon: {
    label: 'Neon Nights',
    swatch: 'linear-gradient(135deg,#ff2e88,#2ee6d6)',
    tint: '255,46,136', sat: 1.42, con: 1.1,
    bandTop: '#160a3d', bandBottom: '#c026d3',
    script: '#7df9ff', titleMid: '#a5f3fc', titleBottom: '#ff5ea8',
  },
  golden: {
    label: 'Golden Hour',
    swatch: 'linear-gradient(135deg,#ffd166,#ff7b2e)',
    tint: '255,170,40', sat: 1.22, con: 1.05,
    bandTop: '#4a1d05', bandBottom: '#f97316',
    script: '#ffe27a', titleMid: '#fff3b0', titleBottom: '#ffb13d',
  },
  midnight: {
    label: 'Midnight',
    swatch: 'linear-gradient(135deg,#a855f7,#0ea5e9)',
    tint: '80,40,200', sat: 1.15, con: 1.08,
    bandTop: '#0f0a2e', bandBottom: '#6d28d9',
    script: '#c4b5fd', titleMid: '#e0e7ff', titleBottom: '#a855f7',
  },
};

// Panel rectangles are fractions of the photo area (the canvas minus the
// title band). Gutters are drawn by insetting every panel.
const LAYOUTS = {
  'vice-grid': {
    label: 'Vice Grid · 5 panels',
    panels: [
      [0, 0, 0.58, 1],
      [0.58, 0, 0.21, 0.5], [0.79, 0, 0.21, 0.5],
      [0.58, 0.5, 0.21, 0.5], [0.79, 0.5, 0.21, 0.5],
    ],
  },
  'sunset-split': {
    label: 'Sunset Split · 4 panels',
    panels: [
      [0, 0, 1, 0.62],
      [0, 0.62, 1 / 3, 0.38], [1 / 3, 0.62, 1 / 3, 0.38], [2 / 3, 0.62, 1 / 3, 0.38],
    ],
  },
  'four-square': {
    label: 'Four Square · 4 panels',
    panels: [
      [0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5],
      [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5],
    ],
  },
  'full-poster': {
    label: 'Full Poster · 1 panel',
    panels: [[0, 0, 1, 1]],
  },
};

const SAMPLES = [
  { src: 'samples/hero.jpg', name: 'Sunset convertible' },
  { src: 'samples/supercar.jpg', name: 'Orange supercar' },
  { src: 'samples/pier-man.jpg', name: 'Pier fisherman' },
  { src: 'samples/neon.jpg', name: 'Neon street' },
  { src: 'samples/boulevard.jpg', name: 'Palm boulevard' },
  { src: 'samples/pier.jpg', name: 'Golden pier' },
];

const state = {
  layout: 'vice-grid',
  grade: 'sunset',
  size: 'wide',
  title: 'SUNSET CHASE',
  place: 'SOLMAR BAY',
  script: 'every street is a stage',
  tagline: 'ONE CITY. EVERY LIGHT TELLS A STORY.',
  badge: 'EST. 2026',
  ribbon: 'COLLECTORS EDITION',
  stars: 5,
  photos: [], // { img, name }
  panels: [], // { photo, zoom, ox, oy } — one slot per layout panel (max 5)
  selected: 0,
};

function bandFraction(sizeKey) {
  return sizeKey === 'wide' ? 0.26 : sizeKey === 'square' ? 0.24 : 0.22;
}

function photoArea(w, h, sizeKey) {
  return { w, h: Math.round(h * (1 - bandFraction(sizeKey))) };
}

function layoutPanels(w, h, sizeKey) {
  const area = photoArea(w, h, sizeKey);
  const gutter = Math.max(4, Math.round(w * 0.004));
  return LAYOUTS[state.layout].panels.map(([fx, fy, fw, fh]) => ({
    x: fx * area.w + gutter,
    y: fy * area.h + gutter,
    w: fw * area.w - gutter * 2,
    h: fh * area.h - gutter * 2,
  }));
}

// Deterministic pseudo-random stream (fixed seed) for the skyline, so the
// same state always draws the same cover.
function seededStream(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function drawPhotoPanel(ctx, panel, photo, grade) {
  const { x, y, w, h } = panel;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  if (!photo) {
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, '#2a1548');
    g.addColorStop(1, '#12081f');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#c9b3e8';
    ctx.font = `${Math.round(h * 0.09)}px Anton, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ADD A PHOTO', x + w / 2, y + h / 2);
    ctx.restore();
    return;
  }
  const img = photo.img;
  const base = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const scale = base * panel.zoom;
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  const dx = x + (w - dw) / 2 + panel.ox * w;
  const dy = y + (h - dh) / 2 + panel.oy * h;
  ctx.filter = `saturate(${grade.sat}) contrast(${grade.con})`;
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.filter = 'none';
  // Warm grade wash: stronger toward the bottom, like a sunset.
  const wash = ctx.createLinearGradient(0, y, 0, y + h);
  wash.addColorStop(0, `rgba(${grade.tint},0.02)`);
  wash.addColorStop(1, `rgba(${grade.tint},0.30)`);
  ctx.fillStyle = wash;
  ctx.fillRect(x, y, w, h);
  // Vignette so panels read as one poster.
  const vg = ctx.createRadialGradient(
    x + w / 2, y + h / 2, Math.min(w, h) * 0.35,
    x + w / 2, y + h / 2, Math.max(w, h) * 0.75,
  );
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(10,2,20,0.30)');
  ctx.fillStyle = vg;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = Math.max(1, w * 0.002);
  ctx.strokeRect(x, y, w, h);
}

function drawStarburst(ctx, cx, cy, r, label) {
  const spikes = 14;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.78;
    const px = Math.cos(a) * rr;
    const py = Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = '#ffd23d';
  ctx.fill();
  ctx.lineWidth = Math.max(2, r * 0.07);
  ctx.strokeStyle = '#160a24';
  ctx.stroke();
  ctx.fillStyle = '#160a24';
  ctx.font = `${Math.round(r * 0.34)}px Anton, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const words = String(label).split(' ');
  if (words.length > 1) {
    ctx.fillText(words.slice(0, -1).join(' '), 0, -r * 0.16);
    ctx.fillText(words[words.length - 1], 0, r * 0.2);
  } else {
    ctx.fillText(label, 0, 0);
  }
  ctx.restore();
}

function drawRibbon(ctx, x, y, w, h, text) {
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(-0.06);
  ctx.fillStyle = '#ffd23d';
  ctx.strokeStyle = '#160a24';
  ctx.lineWidth = Math.max(2, h * 0.12);
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.strokeRect(-w / 2, -h / 2, w, h);
  ctx.fillStyle = '#160a24';
  ctx.font = `${Math.round(h * 0.52)}px Anton, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

function drawSkyline(ctx, x, y, w, h) {
  const rand = seededStream(20261119);
  ctx.save();
  ctx.fillStyle = '#160a24';
  let bx = x;
  while (bx < x + w) {
    const bw = w * (0.03 + rand() * 0.05);
    const bh = h * (0.35 + rand() * 0.6);
    ctx.fillRect(bx, y + h - bh, bw, bh);
    // Lit windows.
    ctx.fillStyle = '#ffd23d';
    const cols = Math.max(1, Math.floor(bw / (w * 0.012)));
    const rows = Math.max(1, Math.floor(bh / (h * 0.22)));
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        if (rand() > 0.55) {
          ctx.fillRect(bx + (c + 0.3) * (bw / cols), y + h - bh + (r + 0.3) * (bh / rows), w * 0.004, h * 0.09);
        }
      }
    }
    ctx.fillStyle = '#160a24';
    bx += bw + w * 0.006;
  }
  // Palm silhouettes at the strip's edges.
  ctx.strokeStyle = '#160a24';
  ctx.lineWidth = Math.max(2, w * 0.003);
  for (const px of [x + w * 0.04, x + w * 0.96]) {
    ctx.beginPath();
    ctx.moveTo(px, y + h);
    ctx.quadraticCurveTo(px + w * 0.004, y + h * 0.45, px + w * 0.012, y + h * 0.25);
    ctx.stroke();
    for (let f = 0; f < 5; f++) {
      const a = -Math.PI * (0.15 + f * 0.17);
      ctx.beginPath();
      ctx.moveTo(px + w * 0.012, y + h * 0.25);
      ctx.quadraticCurveTo(
        px + w * 0.012 + Math.cos(a) * w * 0.035,
        y + h * 0.25 + Math.sin(a) * h * 0.5,
        px + w * 0.012 + Math.cos(a) * w * 0.055,
        y + h * 0.25 + Math.sin(a) * h * 0.7,
      );
      ctx.stroke();
    }
  }
  ctx.restore();
}

function fitTitleFont(ctx, text, maxWidth, startSize) {
  let size = startSize;
  ctx.font = `${size}px Anton, sans-serif`;
  while (size > 12 && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = `${size}px Anton, sans-serif`;
  }
  return size;
}

function drawStarRow(ctx, x, y, size, filled) {
  for (let i = 0; i < 5; i++) {
    const cx = x + i * size * 1.35;
    ctx.beginPath();
    for (let p = 0; p < 10; p++) {
      const a = (p / 10) * Math.PI * 2 - Math.PI / 2;
      const rr = p % 2 === 0 ? size / 2 : size / 4.5;
      const px = cx + Math.cos(a) * rr;
      const py = y + Math.sin(a) * rr;
      if (p === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    if (i < filled) {
      ctx.fillStyle = '#ffd23d';
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fill();
    }
    ctx.strokeStyle = '#160a24';
    ctx.lineWidth = Math.max(1, size * 0.06);
    ctx.stroke();
  }
}

function drawTitleBand(ctx, w, h, sizeKey) {
  const grade = GRADES[state.grade];
  const area = photoArea(w, h, sizeKey);
  const bandY = area.h;
  const bandH = h - area.h;
  const g = ctx.createLinearGradient(0, bandY, 0, h);
  g.addColorStop(0, grade.bandTop);
  g.addColorStop(1, grade.bandBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, bandY, w, bandH);
  // Gold rule under the photos.
  ctx.fillStyle = '#ffd23d';
  ctx.fillRect(0, bandY, w, Math.max(3, bandH * 0.02));

  const pad = w * 0.035;
  // Place line, small caps above the title.
  ctx.fillStyle = '#ffd9ec';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  try { ctx.letterSpacing = `${Math.round(w * 0.006)}px`; } catch { /* older canvas */ }
  const placeSize = Math.round(bandH * 0.11);
  ctx.font = `${placeSize}px Anton, sans-serif`;
  ctx.fillText(state.place.toUpperCase(), w / 2, bandY + bandH * 0.115);
  try { ctx.letterSpacing = '0px'; } catch { /* older canvas */ }

  // Huge outlined gradient title.
  const titleSize = fitTitleFont(ctx, state.title.toUpperCase(), w - pad * 2, Math.round(bandH * 0.42));
  const titleY = bandY + bandH * 0.56;
  const tg = ctx.createLinearGradient(0, titleY - titleSize, 0, titleY + titleSize * 0.1);
  tg.addColorStop(0, '#ffffff');
  tg.addColorStop(0.55, grade.titleMid);
  tg.addColorStop(1, grade.titleBottom);
  ctx.font = `${titleSize}px Anton, sans-serif`;
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(4, titleSize * 0.14);
  ctx.strokeStyle = '#160a24';
  ctx.strokeText(state.title.toUpperCase(), w / 2, titleY);
  ctx.fillStyle = tg;
  ctx.fillText(state.title.toUpperCase(), w / 2, titleY);

  // Script line under the title.
  ctx.fillStyle = grade.script;
  ctx.font = `${Math.round(bandH * 0.16)}px Pacifico, cursive`;
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = Math.round(bandH * 0.03);
  ctx.shadowOffsetY = Math.round(bandH * 0.01);
  ctx.fillText(state.script, w / 2, bandY + bandH * 0.76);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // Tagline + stars + skyline along the bottom.
  ctx.fillStyle = '#ffe9f5';
  try { ctx.letterSpacing = `${Math.round(w * 0.003)}px`; } catch { /* older canvas */ }
  ctx.font = `${Math.round(bandH * 0.085)}px Anton, sans-serif`;
  ctx.fillText(state.tagline.toUpperCase(), w / 2, bandY + bandH * 0.87);
  try { ctx.letterSpacing = '0px'; } catch { /* older canvas */ }
  drawStarRow(ctx, w - pad - 5 * bandH * 0.09 * 1.35, bandY + bandH * 0.06, bandH * 0.09, state.stars);
  drawSkyline(ctx, 0, h - bandH * 0.075, w, bandH * 0.075);
}

// The one function that draws a whole cover. Same state + size always
// draws the same pixels: no randomness, no clock, no network.
function renderCover(ctx, w, h, sizeKey) {
  const grade = GRADES[state.grade];
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  const panels = layoutPanels(w, h, sizeKey);
  panels.forEach((panel, i) => {
    const slot = state.panels[i] || { photo: -1, zoom: 1, ox: 0, oy: 0 };
    const photo = slot.photo >= 0 ? state.photos[slot.photo] : null;
    drawPhotoPanel(ctx, { ...panel, zoom: slot.zoom, ox: slot.ox, oy: slot.oy }, photo, grade);
  });
  // Corner tag over the hero panel.
  const area = photoArea(w, h, sizeKey);
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.font = `${Math.round(w * 0.011)}px Anton, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  try { ctx.letterSpacing = `${Math.round(w * 0.003)}px`; } catch { /* older canvas */ }
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = Math.round(w * 0.004);
  ctx.fillText('A NEON COAST ORIGINAL', w * 0.02, area.h * 0.055);
  ctx.font = `${Math.round(w * 0.008)}px Anton, sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText('VOL. 01 · AFTER HOURS', w * 0.02, area.h * 0.085);
  try { ctx.letterSpacing = '0px'; } catch { /* older canvas */ }
  ctx.restore();
  // Starburst badge + ribbon on the photo area.
  const badgeR = Math.max(26, w * 0.038);
  const badgeX = state.layout === 'vice-grid' ? w * 0.585 : w * 0.9;
  drawStarburst(ctx, badgeX, area.h * 0.1, badgeR, state.badge);
  const ribbonW = Math.min(w * 0.24, state.ribbon.length * w * 0.011 + w * 0.05);
  drawRibbon(ctx, w - ribbonW - w * 0.02, area.h - w * 0.028, ribbonW, Math.max(18, w * 0.022), state.ribbon);
  drawTitleBand(ctx, w, h, sizeKey);
}

// ---------- preview + editor wiring ----------

const preview = $('preview');
const previewCtx = preview.getContext('2d');

function currentSize() {
  return SIZES[state.size];
}

function renderPreview() {
  const { w, h } = currentSize();
  const scale = Math.min(900 / w, 900 / h);
  preview.width = Math.round(w * scale);
  preview.height = Math.round(h * scale);
  renderCover(previewCtx, preview.width, preview.height, state.size);
  $('stageSize').textContent = `${w} × ${h}`;
  $('exportNote').textContent = `${w} × ${h} · PNG`;
}

function ensurePanels() {
  const count = LAYOUTS[state.layout].panels.length;
  while (state.panels.length < count) {
    state.panels.push({ photo: -1, zoom: 1, ox: 0, oy: 0 });
  }
  if (state.selected >= count) state.selected = 0;
}

function photoOptions() {
  return state.photos.map((p, i) => ({ value: i, label: `${i + 1}. ${p.name}` }));
}

function rebuildPanelPickers() {
  ensurePanels();
  const wrap = $('panelPickers');
  wrap.innerHTML = '';
  const count = LAYOUTS[state.layout].panels.length;
  for (let i = 0; i < count; i++) {
    const label = document.createElement('label');
    label.className = 'field';
    label.textContent = `Panel ${i + 1} photo`;
    const sel = document.createElement('select');
    sel.dataset.panel = i;
    const none = document.createElement('option');
    none.value = '-1';
    none.textContent = '— empty —';
    sel.appendChild(none);
    for (const opt of photoOptions()) {
      const o = document.createElement('option');
      o.value = String(opt.value);
      o.textContent = opt.label;
      sel.appendChild(o);
    }
    sel.value = String(state.panels[i].photo);
    sel.addEventListener('change', () => {
      state.panels[i].photo = Number(sel.value);
      state.selected = i;
      syncCropControls();
      renderPreview();
    });
    sel.addEventListener('focus', () => { state.selected = i; syncCropControls(); });
    label.appendChild(sel);
    wrap.appendChild(label);
  }
  const fill = $('fillAll');
  fill.innerHTML = '<option value="">— keep per-panel photos —</option>';
  for (const opt of photoOptions()) {
    const o = document.createElement('option');
    o.value = String(opt.value);
    o.textContent = `All panels: ${opt.label}`;
    fill.appendChild(o);
  }
}

function rebuildSamples() {
  const row = $('sampleRow');
  row.innerHTML = '';
  for (const s of SAMPLES) {
    const img = document.createElement('img');
    img.src = s.src;
    img.alt = s.name;
    img.title = s.name;
    img.addEventListener('click', () => {
      const idx = state.photos.findIndex((p) => p.name === s.name);
      if (idx >= 0) {
        applyPhotoToSelected(idx);
      } else {
        loadImage(s.src, s.name).then((photo) => {
          state.photos.push(photo);
          applyPhotoToSelected(state.photos.length - 1);
        });
      }
    });
    row.appendChild(img);
  }
}

function applyPhotoToSelected(idx) {
  ensurePanels();
  state.panels[state.selected].photo = idx;
  state.panels[state.selected].zoom = 1;
  state.panels[state.selected].ox = 0;
  state.panels[state.selected].oy = 0;
  rebuildPanelPickers();
  syncCropControls();
  renderPreview();
}

function loadImage(src, name) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ img, name });
    img.onerror = reject;
    img.src = src;
  });
}

function syncCropControls() {
  ensurePanels();
  const slot = state.panels[state.selected];
  $('inZoom').value = String(slot.zoom);
  $('inPanX').value = String(slot.ox);
  $('inPanY').value = String(slot.oy);
  $('cropHint').textContent = `Panel ${state.selected + 1} selected — drag the photo in the preview, or use these sliders.`;
}

function buildChips(rowId, entries, current, onPick) {
  const row = $(rowId);
  row.innerHTML = '';
  for (const [key, entry] of entries) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (key === current ? ' active' : '');
    if (entry.swatch) {
      const sw = document.createElement('span');
      sw.className = 'swatch';
      sw.style.background = entry.swatch;
      b.appendChild(sw);
    }
    b.appendChild(document.createTextNode(entry.label));
    b.addEventListener('click', () => {
      onPick(key);
      buildChips(rowId, entries, key, onPick);
      renderPreview();
    });
    row.appendChild(b);
  }
}

function rebuildChips() {
  buildChips('layoutRow', Object.entries(LAYOUTS).map(([k, v]) => [k, { label: v.label }]), state.layout, (k) => {
    state.layout = k;
    ensurePanels();
    rebuildPanelPickers();
    syncCropControls();
  });
  buildChips('gradeRow', Object.entries(GRADES), state.grade, (k) => { state.grade = k; });
  buildChips('sizeRow', Object.entries(SIZES), state.size, (k) => { state.size = k; });
}

function bindInputs() {
  $('inTitle').addEventListener('input', (e) => { state.title = e.target.value || 'UNTITLED'; renderPreview(); });
  $('inPlace').addEventListener('input', (e) => { state.place = e.target.value; renderPreview(); });
  $('inScript').addEventListener('input', (e) => { state.script = e.target.value; renderPreview(); });
  $('inTag').addEventListener('input', (e) => { state.tagline = e.target.value; renderPreview(); });
  $('inBadge').addEventListener('input', (e) => { state.badge = e.target.value || 'EST.'; renderPreview(); });
  $('inRibbon').addEventListener('input', (e) => { state.ribbon = e.target.value; renderPreview(); });
  $('inStars').addEventListener('input', (e) => { state.stars = Number(e.target.value); renderPreview(); });
  $('inZoom').addEventListener('input', (e) => { state.panels[state.selected].zoom = Number(e.target.value); renderPreview(); });
  $('inPanX').addEventListener('input', (e) => { state.panels[state.selected].ox = Number(e.target.value); renderPreview(); });
  $('inPanY').addEventListener('input', (e) => { state.panels[state.selected].oy = Number(e.target.value); renderPreview(); });
  $('btnResetCrop').addEventListener('click', () => {
    const slot = state.panels[state.selected];
    slot.zoom = 1; slot.ox = 0; slot.oy = 0;
    syncCropControls();
    renderPreview();
  });
  $('fillAll').addEventListener('change', (e) => {
    if (e.target.value === '') return;
    const idx = Number(e.target.value);
    ensurePanels();
    state.panels.forEach((p) => { p.photo = idx; });
    rebuildPanelPickers();
    renderPreview();
  });
  $('fileInput').addEventListener('change', async (e) => {
    const files = [...e.target.files];
    for (const f of files) {
      const url = URL.createObjectURL(f);
      try {
        const photo = await loadImage(url, f.name);
        state.photos.push(photo);
      } catch { /* skip unreadable files */ }
    }
    rebuildPanelPickers();
    rebuildSamples();
    renderPreview();
    e.target.value = '';
  });
  $('btnRandomize').addEventListener('click', () => {
    const grades = Object.keys(GRADES);
    const layouts = Object.keys(LAYOUTS);
    state.grade = grades[Math.floor(Math.random() * grades.length)];
    state.layout = layouts[Math.floor(Math.random() * layouts.length)];
    ensurePanels();
    rebuildChips();
    rebuildPanelPickers();
    syncCropControls();
    renderPreview();
  });
}

// ---------- pointer interaction on the preview ----------

let drag = null;

function previewPoint(evt) {
  const r = preview.getBoundingClientRect();
  return {
    x: (evt.clientX - r.left) * (preview.width / r.width),
    y: (evt.clientY - r.top) * (preview.height / r.height),
  };
}

function hitPanel(p) {
  const panels = layoutPanels(preview.width, preview.height, state.size);
  for (let i = panels.length - 1; i >= 0; i--) {
    const q = panels[i];
    if (p.x >= q.x && p.x <= q.x + q.w && p.y >= q.y && p.y <= q.y + q.h) return i;
  }
  return -1;
}

preview.addEventListener('pointerdown', (evt) => {
  const p = previewPoint(evt);
  const i = hitPanel(p);
  if (i < 0) return;
  state.selected = i;
  syncCropControls();
  rebuildPanelPickers();
  const slot = state.panels[i];
  drag = { x: p.x, y: p.y, ox: slot.ox, oy: slot.oy, panel: layoutPanels(preview.width, preview.height, state.size)[i] };
  preview.setPointerCapture(evt.pointerId);
});
preview.addEventListener('pointermove', (evt) => {
  if (!drag) return;
  const p = previewPoint(evt);
  const slot = state.panels[state.selected];
  slot.ox = Math.max(-0.5, Math.min(0.5, drag.ox + (p.x - drag.x) / drag.panel.w));
  slot.oy = Math.max(-0.5, Math.min(0.5, drag.oy + (p.y - drag.y) / drag.panel.h));
  syncCropControls();
  renderPreview();
});
preview.addEventListener('pointerup', () => { drag = null; });
preview.addEventListener('wheel', (evt) => {
  evt.preventDefault();
  const i = hitPanel(previewPoint(evt));
  if (i < 0) return;
  state.selected = i;
  const slot = state.panels[i];
  slot.zoom = Math.max(1, Math.min(3, slot.zoom * (evt.deltaY < 0 ? 1.08 : 0.93)));
  syncCropControls();
  renderPreview();
}, { passive: false });

// ---------- export ----------

function exportCover(sizeKey) {
  const { w, h } = SIZES[sizeKey];
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  renderCover(canvas.getContext('2d'), w, h, sizeKey);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

function downloadCover() {
  exportCover(state.size).then((blob) => {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vice-cover-${state.size}-${state.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  });
}

$('btnExport').addEventListener('click', downloadCover);
$('btnExportTop').addEventListener('click', downloadCover);

// Automation hooks used by the maker's own screenshot/export scripts:
// window.__viceCover.exportPNG(sizeKey) -> Promise<Blob>, and
// window.__viceCover.setCaption({title, place, script, tagline, ...}).
window.__viceCover = {
  state,
  SIZES,
  renderCover,
  exportPNG: exportCover,
  setCaption(patch) {
    Object.assign(state, patch);
    $('inTitle').value = state.title;
    $('inPlace').value = state.place;
    $('inScript').value = state.script;
    $('inTag').value = state.tagline;
    $('inBadge').value = state.badge;
    $('inRibbon').value = state.ribbon;
    $('inStars').value = String(state.stars);
    renderPreview();
  },
  setLook(patch) {
    Object.assign(state, patch);
    ensurePanels();
    rebuildChips();
    rebuildPanelPickers();
    syncCropControls();
    renderPreview();
  },
  renderPreview,
};

// ---------- boot ----------

async function boot() {
  ensurePanels();
  rebuildChips();
  rebuildSamples();
  bindInputs();
  syncCropControls();
  try {
    await Promise.all([
      document.fonts.load('80px Anton'),
      document.fonts.load('40px Pacifico'),
      document.fonts.load('16px Anton'),
    ]);
  } catch { /* fall back to system fonts if a font file fails */ }
  // Default spread: the hero photo fills the big panel, the others fill
  // the small ones, so the first paint already looks like a cover.
  const defaults = ['Sunset convertible', 'Orange supercar', 'Pier fisherman', 'Neon street', 'Palm boulevard'];
  for (const name of defaults) {
    const sample = SAMPLES.find((s) => s.name === name);
    if (!sample) continue;
    try {
      const photo = await loadImage(sample.src, sample.name);
      state.photos.push(photo);
    } catch { /* a missing sample just leaves its panel empty */ }
  }
  state.panels.forEach((slot, i) => {
    if (i < state.photos.length) slot.photo = i;
  });
  rebuildPanelPickers();
  renderPreview();
  window.__viceCoverReady = true;
}

boot();
