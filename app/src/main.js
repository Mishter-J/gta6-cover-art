// Vice Cover Studio — editor wiring.
// Loads the sample photos and the vendored fonts, keeps the editor
// state, renders the live preview, and exports PNGs at post sizes.
// Photos are read on the user's own machine and never uploaded.

import { POST_SIZES, LAYOUTS, GRADES, DEFAULT_STATE, defaultPanels, drawCover, layoutPanels } from './cover.js';
import { applyPreset } from './shots.js';

const SAMPLES = [
  { name: 'Convertible sunset', src: './samples/hero-convertible.jpg' },
  { name: 'Pier fishing', src: './samples/pier-fishing.jpg' },
  { name: 'Neon couple', src: './samples/neon-couple.jpg' },
  { name: 'Boulevard car', src: './samples/boulevard-car.jpg' },
];

const state = {
  ...DEFAULT_STATE,
  panels: defaultPanels(),
};

const photos = []; // { name, img, url } — uploads use object URLs.
let selectedPanel = 0;
let selectedPhoto = 0;
let fontsReady = false;

const $ = (id) => document.getElementById(id);
const preview = $('preview');
const pctx = preview.getContext('2d');

async function loadFonts() {
  try {
    const anton = new FontFace('Anton', 'url(./fonts/Anton-Regular.ttf)', { weight: '400' });
    const pacifico = new FontFace('Pacifico', 'url(./fonts/Pacifico-Regular.ttf)', { weight: '400' });
    const [a, p] = await Promise.all([anton.load(), pacifico.load()]);
    document.fonts.add(a);
    document.fonts.add(p);
    await Promise.all([document.fonts.load('100px Anton'), document.fonts.load('40px Pacifico')]);
    fontsReady = true;
  } catch (err) {
    console.warn('vendored fonts did not load, using fallbacks', err);
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function loadSamples() {
  for (const s of SAMPLES) {
    try {
      const img = await loadImage(s.src);
      photos.push({ name: s.name, img, url: s.src, sample: true });
    } catch (err) {
      console.warn('sample did not load', s.src, err);
    }
  }
  renderLibrary();
  renderPreview();
}

function renderLibrary() {
  const lib = $('library');
  lib.innerHTML = '';
  photos.forEach((p, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'thumb' + (i === selectedPhoto ? ' selected' : '');
    b.title = p.name;
    const im = document.createElement('img');
    im.src = p.url;
    im.alt = p.name;
    b.appendChild(im);
    b.addEventListener('click', () => {
      selectedPhoto = i;
      assignPhotoToPanel(i, selectedPanel);
      renderLibrary();
    });
    lib.appendChild(b);
  });
  $('photoCount').textContent = `${photos.length} photo${photos.length === 1 ? '' : 's'} loaded`;
}

function assignPhotoToPanel(photoIdx, panelIdx) {
  if (!state.panels[panelIdx]) return;
  state.panels[panelIdx].photo = photoIdx;
  state.panels[panelIdx].ox = 0;
  state.panels[panelIdx].oy = 0;
  state.panels[panelIdx].zoom = 1;
  $('zoom').value = 1;
  renderPreview();
}

function renderPreview() {
  const size = POST_SIZES[state.size];
  const scale = Math.min(760 / size.width, 560 / size.height);
  preview.width = Math.round(size.width * scale);
  preview.height = Math.round(size.height * scale);
  const off = document.createElement('canvas');
  off.width = size.width;
  off.height = size.height;
  drawCover(off.getContext('2d'), state, photos.map((p) => p.img), size.width, size.height);
  pctx.clearRect(0, 0, preview.width, preview.height);
  pctx.drawImage(off, 0, 0, preview.width, preview.height);
  // Selected-panel outline on the preview.
  const panels = layoutPanels(state.layout, preview.width, preview.height);
  const r = panels[selectedPanel];
  if (r) {
    pctx.strokeStyle = '#37f4ff';
    pctx.lineWidth = 3;
    pctx.setLineDash([10, 6]);
    pctx.strokeRect(r.x + 2, r.y + 2, r.width - 4, r.height - 4);
    pctx.setLineDash([]);
  }
  $('panelLabel').textContent = `Panel ${selectedPanel + 1} of ${panels.length} — ${photos[state.panels[selectedPanel]?.photo]?.name || 'no photo'}`;
}

function renderExport(sizeKey) {
  const size = POST_SIZES[sizeKey];
  const off = document.createElement('canvas');
  off.width = size.width;
  off.height = size.height;
  drawCover(off.getContext('2d'), state, photos.map((p) => p.img), size.width, size.height);
  return new Promise((resolve) => off.toBlob(resolve, 'image/png'));
}

async function exportPNG() {
  const btn = $('exportBtn');
  btn.disabled = true;
  $('status').textContent = 'Rendering PNG…';
  try {
    const blob = await renderExport(state.size);
    if (!blob) throw new Error('render produced no image');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const slug = (state.title || 'cover').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'cover';
    a.href = url;
    a.download = `${slug}-${state.size}-${POST_SIZES[state.size].width}x${POST_SIZES[state.size].height}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    $('status').textContent = `Exported ${POST_SIZES[state.size].width} × ${POST_SIZES[state.size].height} PNG (${(blob.size / 1024).toFixed(0)} KiB).`;
  } catch (err) {
    $('status').textContent = `Export failed: ${err.message}`;
  } finally {
    btn.disabled = false;
  }
}

function buildButtonGroups() {
  const mkGroup = (id, items, current, onPick) => {
    const host = $(id);
    host.innerHTML = '';
    Object.entries(items).forEach(([key, def]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip' + (key === current ? ' active' : '');
      b.textContent = def.label;
      b.addEventListener('click', () => {
        onPick(key);
        host.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
        b.classList.add('active');
      });
      host.appendChild(b);
    });
  };
  mkGroup('layoutGroup', LAYOUTS, state.layout, (k) => {
    state.layout = k;
    selectedPanel = 0;
    renderPreview();
  });
  mkGroup('gradeGroup', GRADES, state.grade, (k) => {
    state.grade = k;
    renderPreview();
  });
  mkGroup('sizeGroup', POST_SIZES, state.size, (k) => {
    state.size = k;
    renderPreview();
  });
}

function bindInputs() {
  const bindText = (id, key) => {
    const el = $(id);
    el.value = state[key];
    el.addEventListener('input', () => {
      state[key] = el.value;
      renderPreview();
    });
  };
  bindText('titleInput', 'title');
  bindText('taglineInput', 'tagline');
  bindText('volumeInput', 'volume');
  bindText('ribbonInput', 'ribbon');

  $('starsInput').value = state.stars;
  $('starsInput').addEventListener('input', (e) => {
    state.stars = Number(e.target.value);
    $('starsValue').textContent = state.stars;
    renderPreview();
  });
  $('starsValue').textContent = state.stars;

  $('ribbonToggle').checked = state.showRibbon;
  $('ribbonToggle').addEventListener('change', (e) => {
    state.showRibbon = e.target.checked;
    renderPreview();
  });
  $('starsToggle').checked = state.showStars;
  $('starsToggle').addEventListener('change', (e) => {
    state.showStars = e.target.checked;
    renderPreview();
  });

  $('zoom').addEventListener('input', (e) => {
    const crop = state.panels[selectedPanel];
    if (crop) {
      crop.zoom = Number(e.target.value);
      $('zoomValue').textContent = `${crop.zoom.toFixed(2)}×`;
      renderPreview();
    }
  });

  $('fillAllBtn').addEventListener('click', () => {
    state.panels.forEach((p) => {
      p.photo = selectedPhoto;
      p.ox = 0;
      p.oy = 0;
      p.zoom = 1;
    });
    $('zoom').value = 1;
    renderPreview();
    $('status').textContent = `All panels filled with “${photos[selectedPhoto]?.name || 'photo'}”.`;
  });

  $('shuffleBtn').addEventListener('click', () => {
    const count = layoutPanels(state.layout, 100, 100).length;
    for (let i = 0; i < count; i++) {
      state.panels[i].photo = (i * 2 + 1) % photos.length;
    }
    renderPreview();
  });

  $('uploadInput').addEventListener('change', async (e) => {
    const files = [...e.target.files];
    for (const f of files) {
      if (!f.type.startsWith('image/')) continue;
      const url = URL.createObjectURL(f);
      try {
        const img = await loadImage(url);
        photos.push({ name: f.name.replace(/\.[^.]+$/, ''), img, url });
      } catch {
        URL.revokeObjectURL(url);
      }
    }
    selectedPhoto = photos.length - 1;
    renderLibrary();
    renderPreview();
    e.target.value = '';
  });

  $('exportBtn').addEventListener('click', exportPNG);

  // Click a panel to select it; drag to pan its photo.
  let dragging = null;
  const toCanvas = (e) => {
    const r = preview.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (preview.width / r.width), y: (e.clientY - r.top) * (preview.height / r.height) };
  };
  preview.addEventListener('pointerdown', (e) => {
    const p = toCanvas(e);
    const panels = layoutPanels(state.layout, preview.width, preview.height);
    const idx = panels.findIndex((r) => p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height);
    if (idx >= 0) {
      selectedPanel = idx;
      const crop = state.panels[idx];
      selectedPhoto = crop.photo;
      $('zoom').value = crop.zoom;
      $('zoomValue').textContent = `${crop.zoom.toFixed(2)}×`;
      dragging = { x: p.x, y: p.y, ox: crop.ox, oy: crop.oy, w: preview.width, h: preview.height };
      preview.setPointerCapture(e.pointerId);
      renderLibrary();
      renderPreview();
    }
  });
  preview.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const p = toCanvas(e);
    const crop = state.panels[selectedPanel];
    const r = layoutPanels(state.layout, preview.width, preview.height)[selectedPanel];
    crop.ox = Math.max(-0.5, Math.min(0.5, dragging.ox + (p.x - dragging.x) / r.width));
    crop.oy = Math.max(-0.5, Math.min(0.5, dragging.oy + (p.y - dragging.y) / r.height));
    renderPreview();
  });
  preview.addEventListener('pointerup', () => {
    dragging = null;
  });
}

// Automation handle used by the maker's screenshot script (and by
// anyone driving the app): apply a named preset, then render an
// export at a post size and get its PNG data URL back.
window.ViceCover = {
  state,
  photos,
  applyPreset(name) {
    applyPreset(state, name);
    buildButtonGroups();
    $('titleInput').value = state.title;
    $('taglineInput').value = state.tagline;
    $('volumeInput').value = state.volume;
    $('ribbonInput').value = state.ribbon;
    $('starsInput').value = state.stars;
    $('starsValue').textContent = state.stars;
    $('ribbonToggle').checked = state.showRibbon;
    $('starsToggle').checked = state.showStars;
    selectedPanel = 0;
    renderPreview();
  },
  async renderExportDataURL(sizeKey) {
    const blob = await renderExport(sizeKey);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  },
  get ready() {
    return readyPromise;
  },
};

const readyPromise = (async () => {
  buildButtonGroups();
  bindInputs();
  await loadFonts();
  await loadSamples();
  renderPreview();
  return true;
})();
