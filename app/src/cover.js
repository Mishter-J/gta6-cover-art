// Vice Cover Studio — the cover renderer.
// Draws one GTA-style multi-panel poster onto any 2D canvas context:
// photo panels with a sunset/neon colour grade, white gutters, a
// skyline title band with bold Anton lettering and a Pacifico script
// tagline, plus volume line, heat stars and a corner ribbon.
// All drawing is deterministic: same state + same images = same pixels.

export const POST_SIZES = {
  square: { width: 1080, height: 1080, label: '1080 × 1080 · square post' },
  portrait: { width: 1080, height: 1350, label: '1080 × 1350 · portrait post' },
  wide: { width: 1920, height: 1080, label: '1920 × 1080 · wide post' },
};

export const LAYOUTS = {
  hero: { label: 'Hero + side panels', panels: 3 },
  split: { label: 'Split feature', panels: 3 },
  grid9: { label: 'Nine-panel grid', panels: 9 },
};

export const GRADES = {
  sunset: {
    label: 'Sunset',
    filter: 'saturate(1.28) contrast(1.06) brightness(1.02)',
    wash: ['rgba(255,122,26,0.16)', 'rgba(255,45,149,0.20)'],
    band: ['#1b0b2e', '#7b1e5b', '#ff5e3a'],
    titleFrom: '#fff7d6',
    titleTo: '#ffb347',
    tag: '#ff7ad9',
  },
  neon: {
    label: 'Neon nights',
    filter: 'saturate(1.45) contrast(1.08) brightness(0.98)',
    wash: ['rgba(0,229,255,0.12)', 'rgba(255,45,149,0.22)'],
    band: ['#0a0620', '#3b0f66', '#c2187a'],
    titleFrom: '#ffffff',
    titleTo: '#ffcf3d',
    tag: '#37f4ff',
  },
  gold: {
    label: 'Palm gold',
    filter: 'sepia(0.32) saturate(1.35) contrast(1.05)',
    wash: ['rgba(255,190,60,0.14)', 'rgba(255,90,0,0.16)'],
    band: ['#160a2e', '#5b2a12', '#e07b1f'],
    titleFrom: '#fff3b0',
    titleTo: '#ff9a1f',
    tag: '#8ef6ff',
  },
  noir: {
    label: 'Noir',
    filter: 'grayscale(0.55) saturate(0.9) contrast(1.18) brightness(0.96)',
    wash: ['rgba(40,20,80,0.18)', 'rgba(255,45,149,0.10)'],
    band: ['#0b0b14', '#2a1245', '#5c1a5e'],
    titleFrom: '#f4f4ff',
    titleTo: '#c9a7ff',
    tag: '#ff5ea8',
  },
};

export const DEFAULT_STATE = {
  layout: 'hero',
  size: 'square',
  grade: 'sunset',
  title: 'SUNSET CHASE',
  tagline: 'every street is a stage',
  volume: 'VOL. 06 — PALMS DISTRICT — EST. 1986',
  ribbon: "COLLECTOR'S EDITION",
  stars: 5,
  showRibbon: true,
  showStars: true,
};

// One panel's crop: which photo it shows, and how that photo sits in it.
// ox/oy are fractions of the panel size (-0.5..0.5), zoom is >= 1.
export function defaultPanels() {
  const panels = [];
  for (let i = 0; i < 9; i++) {
    panels.push({ photo: i % 4, ox: 0, oy: 0, zoom: 1 });
  }
  return panels;
}

// Panel rectangles for a layout, in fractions of the photo area.
function panelFractions(layout) {
  if (layout === 'grid9') {
    const out = [];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) out.push([c / 3, r / 3, 1 / 3, 1 / 3]);
    }
    return out;
  }
  if (layout === 'split') {
    return [
      [0, 0, 0.5, 1],
      [0.5, 0, 0.5, 0.5],
      [0.5, 0.5, 0.5, 0.5],
    ];
  }
  // hero: one big panel left, two stacked on the right.
  return [
    [0, 0, 0.64, 1],
    [0.64, 0, 0.36, 0.5],
    [0.64, 0.5, 0.36, 0.5],
  ];
}

// Absolute panel rectangles (with gutters) for a canvas of W x H.
export function layoutPanels(layout, width, height) {
  const bandH = Math.round(height * 0.2);
  const photoH = height - bandH;
  const g = Math.max(4, Math.round(width * 0.006));
  const fracs = panelFractions(layout);
  return fracs.map(([fx, fy, fw, fh]) => {
    const x = Math.round(fx * width + (fx > 0 ? g / 2 : 0));
    const y = Math.round(fy * photoH + (fy > 0 ? g / 2 : 0));
    const w = Math.round(fw * width - (fx > 0 ? g / 2 : 0) - (fx + fw < 1 ? g / 2 : 0));
    const h = Math.round(fh * photoH - (fy > 0 ? g / 2 : 0) - (fy + fh < 1 ? g / 2 : 0));
    return { x, y, width: w, height: h };
  });
}

function drawPhotoInto(ctx, img, rect, crop, grade) {
  const { x, y, width: pw, height: ph } = rect;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, pw, ph);
  ctx.clip();
  ctx.fillStyle = '#241430';
  ctx.fillRect(x, y, pw, ph);
  if (img) {
    const base = Math.max(pw / img.naturalWidth, ph / img.naturalHeight);
    const scale = base * (crop.zoom || 1);
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    const dx = x + (pw - dw) / 2 + (crop.ox || 0) * pw;
    const dy = y + (ph - dh) / 2 + (crop.oy || 0) * ph;
    ctx.filter = grade.filter;
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.filter = 'none';
    // Colour wash: a warm-to-pink gradient laid over the photo.
    const wash = ctx.createLinearGradient(x, y, x + pw * 0.35, y + ph);
    wash.addColorStop(0, grade.wash[0]);
    wash.addColorStop(1, grade.wash[1]);
    ctx.fillStyle = wash;
    ctx.fillRect(x, y, pw, ph);
    // Vignette so panel edges read as one poster.
    const vg = ctx.createRadialGradient(
      x + pw / 2, y + ph / 2, Math.min(pw, ph) * 0.42,
      x + pw / 2, y + ph / 2, Math.max(pw, ph) * 0.75,
    );
    vg.addColorStop(0, 'rgba(20,5,30,0)');
    vg.addColorStop(1, 'rgba(20,5,30,0.28)');
    ctx.fillStyle = vg;
    ctx.fillRect(x, y, pw, ph);
  }
  ctx.restore();
  // White poster gutter frame around the panel.
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(2, Math.round(pw * 0.004));
  ctx.strokeRect(x + 1, y + 1, pw - 2, ph - 2);
}

function drawPalm(ctx, x, y, s, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(2, -14, 6, -26);
  ctx.stroke();
  for (let i = 0; i < 6; i++) {
    const a = (-150 + i * 48) * (Math.PI / 180);
    const len = 15 + (i % 2) * 4;
    const tx = 6 + Math.cos(a) * len;
    const ty = -26 + Math.sin(a) * len * 0.45;
    ctx.beginPath();
    ctx.moveTo(6, -26);
    ctx.quadraticCurveTo(6 + Math.cos(a) * len * 0.6, -26 + Math.sin(a) * len * 0.3 - 4, tx, ty);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(8.5, -24, 1.6, 0, Math.PI * 2);
  ctx.arc(4, -22.5, 1.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSkyline(ctx, x, y, w, h, color) {
  // Fixed building rhythm: deterministic, no randomness.
  const heights = [0.62, 0.38, 0.85, 0.5, 0.72, 0.44, 0.95, 0.58, 0.4, 0.78, 0.52, 0.66, 0.36, 0.88, 0.48];
  const n = heights.length;
  const bw = w / n;
  ctx.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const bh = heights[i] * h;
    const bx = x + i * bw;
    ctx.fillRect(bx + 1, y + h - bh, bw - 2, bh);
    if (i % 3 === 0) ctx.fillRect(bx + bw * 0.32, y + h - bh - h * 0.1, bw * 0.36, h * 0.1);
  }
  // A few lit windows in the skyline.
  ctx.fillStyle = 'rgba(255,214,120,0.85)';
  for (let i = 0; i < n; i += 2) {
    const bh = heights[i] * h;
    ctx.fillRect(x + i * bw + bw * 0.28, y + h - bh + h * 0.18, 2.5, 3.5);
    ctx.fillRect(x + i * bw + bw * 0.58, y + h - bh + h * 0.42, 2.5, 3.5);
  }
}

function drawStar(ctx, cx, cy, r, fill) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const px = cx + Math.cos(ang) * rad;
    const py = cy + Math.sin(ang) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function fitFont(ctx, text, fontFor, maxWidth, startSize) {
  let size = startSize;
  ctx.font = fontFor(size);
  while (size > 10 && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = fontFor(size);
  }
  return size;
}

// The main entry point. `images` is an array of loaded HTMLImageElements
// (or nulls) matching state.panels' photo indexes.
export function drawCover(ctx, state, images, width, height) {
  const grade = GRADES[state.grade] || GRADES.sunset;
  const bandH = Math.round(height * 0.2);
  const photoH = height - bandH;

  // Backdrop.
  ctx.fillStyle = '#160a24';
  ctx.fillRect(0, 0, width, height);

  // Photo panels.
  const panels = layoutPanels(state.layout, width, height);
  panels.forEach((rect, i) => {
    const crop = (state.panels && state.panels[i]) || { photo: 0, ox: 0, oy: 0, zoom: 1 };
    const img = images[crop.photo] || null;
    drawPhotoInto(ctx, img, rect, crop, grade);
  });

  // Volume line, bottom-left over the photo area (the top-left corner
  // belongs to the ribbon, which would hide it there).
  const vol = (state.volume || '').trim();
  if (vol) {
    const fs = Math.max(11, Math.round(width * 0.014));
    ctx.font = `700 ${fs}px Arial, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = fs * 0.35;
    ctx.fillText(vol.toUpperCase(), Math.round(width * 0.018), photoH - Math.max(14, Math.round(height * 0.022)));
    ctx.shadowBlur = 0;
  }

  // Heat stars, top-right over the photo area.
  if (state.showStars) {
    const r = Math.max(8, Math.round(width * 0.011));
    const gap = r * 2.5;
    const totalW = gap * 5;
    let sx = width - Math.round(width * 0.018) - totalW;
    const sy = Math.round(height * 0.032);
    ctx.font = `700 ${Math.max(11, Math.round(width * 0.014))}px Arial, sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = 6;
    ctx.fillText('HEAT', sx - gap * 0.6, sy);
    ctx.shadowBlur = 0;
    for (let i = 0; i < 5; i++) {
      drawStar(ctx, sx + gap * i + r, sy, r, i < state.stars ? '#ffcf3d' : 'rgba(255,255,255,0.35)');
    }
  }

  // Corner ribbon, diagonal across the top-left corner.
  if (state.showRibbon && (state.ribbon || '').trim()) {
    const rw = Math.round(width * 0.34);
    const rh = Math.max(20, Math.round(height * 0.038));
    ctx.save();
    ctx.translate(0, Math.round(height * 0.1));
    ctx.rotate(-Math.PI / 7);
    ctx.fillStyle = '#ff2d95';
    ctx.fillRect(-rw * 0.25, -rh / 2, rw, rh);
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 ${Math.round(rh * 0.52)}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(state.ribbon.trim().toUpperCase(), rw * 0.25, 1);
    ctx.restore();
  }

  // Title band.
  const bandY = photoH;
  const band = ctx.createLinearGradient(0, bandY, width * 0.7, height);
  band.addColorStop(0, grade.band[0]);
  band.addColorStop(0.55, grade.band[1]);
  band.addColorStop(1, grade.band[2]);
  ctx.fillStyle = band;
  ctx.fillRect(0, bandY, width, bandH);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillRect(0, bandY, width, Math.max(2, Math.round(height * 0.003)));

  // Skyline + palms along the bottom of the band.
  const skyH = Math.round(bandH * 0.42);
  drawSkyline(ctx, 0, height - skyH, width, skyH, 'rgba(10,4,20,0.85)');
  drawPalm(ctx, width * 0.045, height - 2, bandH / 58, 'rgba(10,4,20,0.9)');
  drawPalm(ctx, width * 0.955, height - 2, bandH / 52, 'rgba(10,4,20,0.9)');

  // Title: huge condensed capitals, gradient fill, black outline.
  const title = (state.title || 'UNTITLED').trim().toUpperCase();
  const titleSize = fitFont(
    ctx,
    title,
    (s) => `${s}px Anton, 'Arial Narrow', sans-serif`,
    width * 0.92,
    Math.round(bandH * 0.52),
  );
  ctx.font = `${titleSize}px Anton, 'Arial Narrow', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const titleGrad = ctx.createLinearGradient(0, bandY + bandH * 0.18, 0, bandY + bandH * 0.66);
  titleGrad.addColorStop(0, grade.titleFrom);
  titleGrad.addColorStop(1, grade.titleTo);
  const ty = bandY + bandH * 0.42;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#14041f';
  ctx.lineWidth = Math.max(3, Math.round(titleSize * 0.14));
  ctx.strokeText(title, width / 2, ty);
  ctx.fillStyle = titleGrad;
  ctx.fillText(title, width / 2, ty);

  // Script tagline under the title, with a neon glow.
  const tag = (state.tagline || '').trim();
  if (tag) {
    const tagSize = fitFont(
      ctx,
      tag,
      (s) => `${s}px Pacifico, cursive`,
      width * 0.8,
      Math.round(bandH * 0.2),
    );
    ctx.font = `${tagSize}px Pacifico, cursive`;
    ctx.fillStyle = grade.tag;
    ctx.shadowColor = grade.tag;
    ctx.shadowBlur = Math.round(tagSize * 0.55);
    ctx.fillText(tag, width / 2, bandY + bandH * 0.76);
    ctx.shadowBlur = 0;
  }
}
