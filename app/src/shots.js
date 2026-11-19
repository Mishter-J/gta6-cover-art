// Vice Cover Studio — named presets.
// Each preset is one finished cover idea: a layout, a colour grade, a
// caption and a photo assignment. The maker uses them to render the
// candidate covers it judges between; the editor itself never applies
// one unless the user asks. Photo indexes: 0 convertible sunset,
// 1 pier fishing, 2 neon couple, 3 boulevard car.

export const PRESETS = {
  'sunset-chase': {
    layout: 'hero',
    size: 'wide',
    grade: 'sunset',
    title: 'SUNSET CHASE',
    tagline: 'every street is a stage',
    volume: 'VOL. 06 — PALMS DISTRICT — EST. 1986',
    ribbon: "COLLECTOR'S EDITION",
    stars: 5,
    showRibbon: true,
    showStars: true,
    photos: [3, 0, 1],
  },
  'palm-meridian': {
    layout: 'split',
    size: 'wide',
    grade: 'neon',
    title: 'PALM MERIDIAN',
    tagline: 'neon harbor nights',
    volume: 'VOL. 02 — NEON HARBOR — EST. 2026',
    ribbon: 'SAME TROUBLE',
    stars: 4,
    showRibbon: true,
    showStars: true,
    photos: [0, 2, 3],
  },
  'neon-shores': {
    layout: 'grid9',
    size: 'portrait',
    grade: 'gold',
    title: 'NEON SHORES',
    tagline: 'where the tide keeps secrets',
    volume: 'VOL. 09 — TIDE DISTRICT — EST. 1986',
    ribbon: 'LIMITED RUN',
    stars: 5,
    showRibbon: false,
    showStars: true,
    photos: [0, 3, 2, 1, 0, 1, 3, 2, 0],
  },
  'vice-royale': {
    layout: 'hero',
    size: 'square',
    grade: 'noir',
    title: 'VICE ROYALE',
    tagline: 'one city. every secret has a view.',
    volume: 'VOL. 01 — ROYALE ROW — EST. 2026',
    ribbon: 'NIGHT SHIFT',
    stars: 4,
    showRibbon: true,
    showStars: true,
    photos: [2, 3, 0],
  },
};

// Mutates `state` in place to match the named preset, including the
// per-panel photo assignment (panels beyond the preset repeat it).
export function applyPreset(state, name) {
  const p = PRESETS[name];
  if (!p) throw new Error(`unknown preset: ${name}`);
  state.layout = p.layout;
  state.size = p.size;
  state.grade = p.grade;
  state.title = p.title;
  state.tagline = p.tagline;
  state.volume = p.volume;
  state.ribbon = p.ribbon;
  state.stars = p.stars;
  state.showRibbon = p.showRibbon;
  state.showStars = p.showStars;
  for (let i = 0; i < state.panels.length; i++) {
    state.panels[i].photo = p.photos[i % p.photos.length];
    state.panels[i].ox = 0;
    state.panels[i].oy = 0;
    state.panels[i].zoom = 1;
  }
  return state;
}
