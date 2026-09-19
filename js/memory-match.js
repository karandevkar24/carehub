// =====================================================
// CareHub – Memory Match Game Module
// Photo-to-Name matching for cognitive/memory care
// =====================================================

// ── CONFIG (swap keys here) ───────────────────────────
export const CONFIG = {
  // Unsplash Access Key — replace with your own at https://unsplash.com/oauth/applications
  UNSPLASH_ACCESS_KEY: 'demo',

  // Pexels API Key — fallback. Get free key at https://www.pexels.com/api/
  PEXELS_API_KEY: 'demo',

  // Which API to use: 'unsplash' | 'pexels' | 'local'
  // 'local' uses the built-in emoji + color tiles as fallback (no API needed)
  IMAGE_SOURCE: 'local',

  // Pairs per level
  PAIRS_PER_LEVEL: 6,

  // PIN to unlock caregiver settings (default: 1234)
  CAREGIVER_PIN: '1234',

  // LocalStorage key for family photos
  FAMILY_STORAGE_KEY: 'careHub_familyPhotos',
};

// ── BUILT-IN OBJECT SET (used when no API / offline) ──
export const BUILT_IN_OBJECTS = [
  { id: 'cup',        label: 'Cup',        emoji: '☕', color: '#fde68a', query: 'ceramic cup coffee mug white background' },
  { id: 'chair',      label: 'Chair',      emoji: '🪑', color: '#bfdbfe', query: 'wooden chair simple white background' },
  { id: 'apple',      label: 'Apple',      emoji: '🍎', color: '#fee2e2', query: 'red apple fruit white background' },
  { id: 'spoon',      label: 'Spoon',      emoji: '🥄', color: '#d1fae5', query: 'silver spoon white background' },
  { id: 'key',        label: 'Key',        emoji: '🗝️', color: '#ede9fe', query: 'door key white background' },
  { id: 'book',       label: 'Book',       emoji: '📖', color: '#cffafe', query: 'open book white background' },
  { id: 'flower',     label: 'Flower',     emoji: '🌸', color: '#fce7f3', query: 'flower rose white background simple' },
  { id: 'clock',      label: 'Clock',      emoji: '🕐', color: '#f3e8ff', query: 'wall clock white background simple' },
  { id: 'glasses',    label: 'Glasses',    emoji: '👓', color: '#ecfdf5', query: 'reading glasses white background' },
  { id: 'toothbrush', label: 'Toothbrush', emoji: '🪥', color: '#fff7ed', query: 'toothbrush white background simple' },
  { id: 'comb',       label: 'Comb',       emoji: '🪮', color: '#fef9c3', query: 'hair comb white background' },
  { id: 'umbrella',   label: 'Umbrella',   emoji: '☂️', color: '#e0f2fe', query: 'umbrella simple colorful white background' },
  { id: 'candle',     label: 'Candle',     emoji: '🕯️', color: '#fef3c7', query: 'lit candle white background' },
  { id: 'leaf',       label: 'Leaf',       emoji: '🍃', color: '#dcfce7', query: 'green leaf white background' },
  { id: 'hat',        label: 'Hat',        emoji: '🧢', color: '#dbeafe', query: 'hat cap white background simple' },
  { id: 'bag',        label: 'Bag',        emoji: '👜', color: '#ffe4e6', query: 'handbag simple white background' },
  { id: 'shoe',       label: 'Shoe',       emoji: '👟', color: '#f0abfc', query: 'shoe sneaker white background' },
  { id: 'bottle',     label: 'Bottle',     emoji: '🧴', color: '#a7f3d0', query: 'water bottle white background simple' },
];

// ── FAMILY PHOTOS (localStorage) ─────────────────────
export function loadFamilyPhotos() {
  try {
    const raw = localStorage.getItem(CONFIG.FAMILY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (_) { return []; }
}

export function saveFamilyPhotos(photos) {
  try {
    localStorage.setItem(CONFIG.FAMILY_STORAGE_KEY, JSON.stringify(photos));
  } catch (_) {}
}

export function addFamilyPhoto(name, dataUrl) {
  const photos = loadFamilyPhotos();
  const id = 'family_' + Date.now();
  photos.push({ id, label: name, dataUrl, isFamily: true });
  saveFamilyPhotos(photos);
  return id;
}

export function removeFamilyPhoto(id) {
  const photos = loadFamilyPhotos().filter(p => p.id !== id);
  saveFamilyPhotos(photos);
}

// ── IMAGE FETCHING ─────────────────────────────────────
async function fetchUnsplashPhoto(query) {
  if (CONFIG.UNSPLASH_ACCESS_KEY === 'demo') return null;
  try {
    const res = await fetch(
      `https://api.unsplash.com/photos/random?query=${encodeURIComponent(query)}&orientation=squarish&content_filter=high`,
      { headers: { Authorization: `Client-ID ${CONFIG.UNSPLASH_ACCESS_KEY}` } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.urls?.small || null;
  } catch (_) { return null; }
}

async function fetchPexelsPhoto(query) {
  if (CONFIG.PEXELS_API_KEY === 'demo') return null;
  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=5&size=medium`,
      { headers: { Authorization: CONFIG.PEXELS_API_KEY } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const photos = data.photos || [];
    if (!photos.length) return null;
    const pick = photos[Math.floor(Math.random() * photos.length)];
    return pick.src?.medium || null;
  } catch (_) { return null; }
}

export async function getPhotoUrl(obj) {
  // Family photos have their own dataUrl
  if (obj.isFamily) return obj.dataUrl;

  // Try configured API first
  let url = null;
  if (CONFIG.IMAGE_SOURCE === 'unsplash') url = await fetchUnsplashPhoto(obj.query);
  else if (CONFIG.IMAGE_SOURCE === 'pexels') url = await fetchPexelsPhoto(obj.query);

  // Return API url or null (caller will use emoji tile)
  return url;
}

// ── SHUFFLE ───────────────────────────────────────────
export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── BUILD A LEVEL SET ─────────────────────────────────
// Returns an array of {id, label, emoji, color, imageUrl?} items
export async function buildLevelItems(usedIds = new Set()) {
  const family = loadFamilyPhotos();
  const n = CONFIG.PAIRS_PER_LEVEL;

  let pool = [];

  // Prefer family photos, mix in objects to fill
  const availableFamily = family.filter(f => !usedIds.has(f.id));
  const availableObjects = shuffle(BUILT_IN_OBJECTS.filter(o => !usedIds.has(o.id)));

  // Take up to n family photos first
  const familyPick = availableFamily.slice(0, n);
  const objectPick = availableObjects.slice(0, n - familyPick.length);

  pool = shuffle([...familyPick, ...objectPick]);
  if (pool.length < n) {
    // If not enough unique, reset usedIds and re-pick from objects
    const extras = shuffle(BUILT_IN_OBJECTS).slice(0, n - pool.length);
    pool = [...pool, ...extras];
  }
  pool = pool.slice(0, n);

  // Preload/fetch image URLs
  const items = await Promise.all(pool.map(async (obj) => {
    const imageUrl = await getPhotoUrl(obj);
    return { ...obj, imageUrl };
  }));

  return items;
}

// ── PIANO AMBIENT AUDIO (Web Audio API) ───────────────
let _audioCtx = null;
let _masterGain = null;
let _pianoPlaying = false;
let _pianoTimers = [];

// Pentatonic piano scale frequencies (C major pentatonic, gentle)
const PIANO_NOTES = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25];

function getAudioCtx() {
  if (!_audioCtx || _audioCtx.state === 'closed') {
    _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    _masterGain = _audioCtx.createGain();
    _masterGain.gain.value = 0.08; // Very quiet ambient
    _masterGain.connect(_audioCtx.destination);
  }
  return _audioCtx;
}

function playPianoNote(freq, when, duration = 1.2) {
  const ctx = getAudioCtx();
  const osc = ctx.createOscillator();
  const envGain = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.value = freq;

  // Soft piano-like envelope: quick attack, slow decay
  envGain.gain.setValueAtTime(0, when);
  envGain.gain.linearRampToValueAtTime(0.6, when + 0.02);
  envGain.gain.exponentialRampToValueAtTime(0.001, when + duration);

  // Subtle reverb-like 2nd harmonic
  const osc2 = ctx.createOscillator();
  const env2 = ctx.createGain();
  osc2.type = 'sine';
  osc2.frequency.value = freq * 2;
  env2.gain.setValueAtTime(0, when);
  env2.gain.linearRampToValueAtTime(0.08, when + 0.02);
  env2.gain.exponentialRampToValueAtTime(0.001, when + duration * 0.6);

  osc.connect(envGain); envGain.connect(_masterGain);
  osc2.connect(env2); env2.connect(_masterGain);
  osc.start(when); osc.stop(when + duration + 0.1);
  osc2.start(when); osc2.stop(when + duration * 0.7);
}

function schedulePianoLoop() {
  if (!_pianoPlaying) return;
  const ctx = getAudioCtx();
  const now = ctx.currentTime;

  // Play a gentle 3-4 note arpeggio phrase
  const scale = shuffle(PIANO_NOTES).slice(0, 4);
  scale.forEach((freq, i) => {
    playPianoNote(freq, now + i * 0.55, 1.4);
  });

  // Also add a bass note
  playPianoNote(PIANO_NOTES[0] / 2, now + 0.1, 2.2);

  // Schedule next phrase in 3–5 seconds
  const delay = 3000 + Math.random() * 2000;
  const timer = setTimeout(schedulePianoLoop, delay);
  _pianoTimers.push(timer);
}

export function startPianoAmbient() {
  try {
    const ctx = getAudioCtx();
    if (ctx.state === 'suspended') ctx.resume();
    if (_pianoPlaying) return;
    _pianoPlaying = true;
    schedulePianoLoop();
  } catch (_) {}
}

export function stopPianoAmbient() {
  _pianoPlaying = false;
  _pianoTimers.forEach(t => clearTimeout(t));
  _pianoTimers = [];
}

export function setPianoVolume(val) {
  try {
    getAudioCtx();
    if (_masterGain) _masterGain.gain.value = Math.max(0, Math.min(0.3, val));
  } catch (_) {}
}

export function isPianoPlaying() { return _pianoPlaying; }

// ── SOUND EFFECTS ─────────────────────────────────────
export function playChime(type = 'correct') {
  try {
    const ctx = getAudioCtx();
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;

    if (type === 'correct') {
      // Two soft ascending chime notes
      [523.25, 659.25].forEach((freq, i) => {
        playPianoNote(freq, now + i * 0.18, 0.9);
      });
    } else if (type === 'levelup') {
      // Warm 3-note ascending chord
      [392, 523.25, 659.25].forEach((freq, i) => {
        playPianoNote(freq, now + i * 0.12, 1.5);
      });
    } else if (type === 'wrong') {
      // Soft low dull tone
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 180;
      g.gain.setValueAtTime(0.12, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc.connect(g); g.connect(_masterGain);
      osc.start(now); osc.stop(now + 0.55);
    }
  } catch (_) {}
}
