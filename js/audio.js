// =====================================================
// CAREGIVER HUB – Web Audio Music Therapy Module
// =====================================================

let audioCtx = null;
let gainNode = null;
let currentSources = [];
let scheduledTimers = [];   // for flute / nature note schedulers
let isPlaying = false;
let currentTrackIndex = 0;
let loopEnabled = true;

// ── Track definitions ─────────────────────────────────
export const TRACKS = [
  {
    id: 'binaural',
    name: 'Deep Binaural Beats',
    description: 'Stress & anxiety reduction – 40Hz gamma waves',
    icon: '🎵',
    bg: 'linear-gradient(135deg, #ddd6fe, #c7d2fe)',
    freqLeft: 200,
    freqRight: 240,
    type: 'binaural',
    color: '#6366f1',
  },
  {
    id: 'calm432',
    name: '432Hz Calm Waves',
    description: 'Overthinking & mental exhaustion relief',
    icon: '🌊',
    bg: 'linear-gradient(135deg, #ccfbf1, #bfdbfe)',
    freqLeft: 432,
    freqRight: 432,
    type: 'sine',
    color: '#0891b2',
  },
  {
    id: 'rain',
    name: 'Ambient Rain & Nature',
    description: 'Gentle brown-noise rain for deep relaxation',
    icon: '🌧️',
    bg: 'linear-gradient(135deg, #e0f2fe, #dcfce7)',
    type: 'noise',
    color: '#10b981',
  },
  {
    id: 'delta',
    name: 'Delta Wave Sleep Aid',
    description: 'Deep sleep preparation – 0.5–4Hz waves',
    icon: '🌙',
    bg: 'linear-gradient(135deg, #fae8ff, #ede9fe)',
    freqLeft: 100,
    freqRight: 102,
    type: 'binaural',
    color: '#8b5cf6',
  },
  {
    id: 'theta',
    name: 'Theta Meditation',
    description: 'Meditation & creativity – 4–8Hz theta waves',
    icon: '🧘',
    bg: 'linear-gradient(135deg, #fef3c7, #fde68a)',
    freqLeft: 200,
    freqRight: 206,
    type: 'binaural',
    color: '#d97706',
  },
];

// ── Audio context ──────────────────────────────────────
function getContext() {
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    gainNode = audioCtx.createGain();
    gainNode.gain.value = 0.3;
    gainNode.connect(audioCtx.destination);
  }
  return audioCtx;
}

function stopAll() {
  scheduledTimers.forEach(t => clearTimeout(t));
  scheduledTimers = [];
  currentSources.forEach(src => { try { src.stop(); } catch (_) {} });
  currentSources = [];
  isPlaying = false;
}

// ── BINAURAL BEATS ────────────────────────────────────
function playBinaural(track) {
  const ctx = getContext();
  if (ctx.state === 'suspended') ctx.resume();

  const merger = ctx.createChannelMerger(2);
  const oscL = ctx.createOscillator();
  oscL.type = 'sine'; oscL.frequency.value = track.freqLeft;
  const oscR = ctx.createOscillator();
  oscR.type = 'sine'; oscR.frequency.value = track.freqRight;

  const panL = ctx.createStereoPanner(); panL.pan.value = -1;
  const panR = ctx.createStereoPanner(); panR.pan.value = 1;

  oscL.connect(panL); panL.connect(gainNode);
  oscR.connect(panR); panR.connect(gainNode);
  oscL.start(); oscR.start();
  currentSources.push(oscL, oscR);
}

// ── 432 Hz SINE ───────────────────────────────────────
function playSine(track) {
  const ctx = getContext();
  if (ctx.state === 'suspended') ctx.resume();

  const osc = ctx.createOscillator();
  osc.type = 'sine'; osc.frequency.value = track.freqLeft;
  const oscG = ctx.createGain(); oscG.gain.value = 0.4;
  osc.connect(oscG); oscG.connect(gainNode);

  const osc2 = ctx.createOscillator();
  osc2.type = 'sine'; osc2.frequency.value = track.freqLeft * 2;
  const oscG2 = ctx.createGain(); oscG2.gain.value = 0.1;
  osc2.connect(oscG2); oscG2.connect(gainNode);

  osc.start(); osc2.start();
  currentSources.push(osc, osc2);
}

// ── BROWN NOISE RAIN ──────────────────────────────────
function playNoise() {
  const ctx = getContext();
  if (ctx.state === 'suspended') ctx.resume();

  const bufferSize = ctx.sampleRate * 3;
  const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const data = buffer.getChannelData(c);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = data[i];
      data[i] *= 3.5;
    }
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer; source.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass'; filter.frequency.value = 800;
  source.connect(filter); filter.connect(gainNode);
  source.start();
  currentSources.push(source);
}

// ── PUBLIC API ────────────────────────────────────────
export function playTrack(index, onEnd) {
  try {
    stopAll();
    currentTrackIndex = index;
    const track = TRACKS[index];
    if (!track) return;

    if      (track.type === 'binaural')  playBinaural(track);
    else if (track.type === 'sine')      playSine(track);
    else if (track.type === 'noise')     playNoise();

    isPlaying = true;
  } catch (err) {
    console.error('Audio playback error:', err);
  }
}

export function pauseTrack() {
  try {
    if (audioCtx && audioCtx.state === 'running') {
      audioCtx.suspend();
      isPlaying = false;
    }
  } catch (err) { console.error('Audio pause error:', err); }
}

export function resumeTrack() {
  try {
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
      isPlaying = true;
    }
  } catch (err) { console.error('Audio resume error:', err); }
}

export function nextTrack(onEnd) {
  const next = (currentTrackIndex + 1) % TRACKS.length;
  playTrack(next, onEnd);
  return next;
}

export function prevTrack(onEnd) {
  const prev = (currentTrackIndex - 1 + TRACKS.length) % TRACKS.length;
  playTrack(prev, onEnd);
  return prev;
}

export function setVolume(val) {
  try {
    getContext();
    if (gainNode) gainNode.gain.value = Math.max(0, Math.min(1, val));
  } catch (err) { console.error('Volume error:', err); }
}

export function toggleLoop() { loopEnabled = !loopEnabled; return loopEnabled; }
export function getIsPlaying()    { return isPlaying; }
export function getCurrentIndex() { return currentTrackIndex; }
export function isLoopEnabled()   { return loopEnabled; }
