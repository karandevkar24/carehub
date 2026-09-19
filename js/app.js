// =====================================================
// CAREGIVER HUB – Core Application Controller
// =====================================================

import { INDIA_HELPLINES, GLOBAL_HELPLINES, DOCTORS } from './helplines.js';
import { startTracking, stopTracking, openMaps, shareViaWhatsApp } from './gps.js';
import {
  TRACKS, playTrack, pauseTrack, resumeTrack,
  nextTrack, prevTrack, setVolume, toggleLoop,
  getIsPlaying, getCurrentIndex, isLoopEnabled,
} from './audio.js';
import { processChat, resetChat, getRandomTip } from './chat.js';

// ── State ──────────────────────────────────────────────
const state = {
  gpsCoords: null,
  geoFence: null,
  isTracking: false,
  selectedDoctor: null,
  selectedSlot: null,
  selectedCountry: null,
  safetyChecklist: JSON.parse(localStorage.getItem('careHub_checklist') || '{}'),
  chatOpen: false,
  sosFabOpen: false,
  currentVolume: 0.3,
  trackingInterval: null,
};

// ── Toast Notifications ────────────────────────────────
function showToast(msg, type = 'success', duration = 3500) {
  const container = document.getElementById('toast-container');
  const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', warn: 'fa-exclamation-triangle' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i class="fas ${icons[type]}"></i><span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    toast.style.transition = '0.4s ease';
    setTimeout(() => toast.remove(), 400);
  }, duration);
}

// ── Scroll Reveal ──────────────────────────────────────
function initScrollReveal() {
  const observer = new IntersectionObserver(
    (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('visible'); }),
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
  );
  document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
}

// ── Header Scroll Effect ───────────────────────────────
function initHeader() {
  const header = document.getElementById('header');
  window.addEventListener('scroll', () => {
    header.classList.toggle('scrolled', window.scrollY > 10);
  }, { passive: true });
}

// ── Pill Navigation ────────────────────────────────────
function initPillNav() {
  document.querySelectorAll('.pill[data-section]').forEach((pill) => {
    pill.addEventListener('click', () => {
      const sectionId = pill.dataset.section;
      const el = document.getElementById(sectionId);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      document.querySelectorAll('.pill').forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
    });
  });
}

// ── Global Search ──────────────────────────────────────
function initSearch() {
  const input = document.getElementById('global-search');
  if (!input) return;
  const sections = [
    { keywords: ['emergency', 'sos', 'helpline', '112', '108', 'ambulance'], id: 'emergency-section' },
    { keywords: ['gps', 'location', 'track', 'map', 'wandering', 'doctor', 'appointment'], id: 'gps-section' },
    { keywords: ['music', 'therapy', 'binaural', 'calm', 'stress', 'relax'], id: 'music-section' },
    { keywords: ['dementia', 'guide', 'stage', 'safety', 'alzheimer', 'symptom'], id: 'dementia-section' },
    { keywords: ['game', 'cognitive', 'puzzle'], id: 'game-section' },
  ];

  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const q = input.value.trim().toLowerCase();
    const match = sections.find((s) => s.keywords.some((k) => q.includes(k)));
    if (match) {
      document.getElementById(match.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      showToast('Navigating to relevant section…', 'success', 2000);
    } else {
      showToast('Try: emergency, GPS, music, dementia, games', 'warn', 3000);
    }
  });
}

// ── Emergency Helplines ────────────────────────────────
function renderHelplines() {
  const grid = document.getElementById('helpline-grid');
  if (!grid) return;
  grid.innerHTML = INDIA_HELPLINES.map((h) => `
    <a class="helpline-card" href="tel:${h.number}" id="helpline-${h.number.replace(/[^0-9]/g, '')}">
      <div class="helpline-flag">${h.flag}</div>
      <div class="helpline-org">${h.org}</div>
      <div class="helpline-name">${h.name}</div>
      <div class="helpline-number">${h.number}</div>
      <div class="tap-to-call"><i class="fas fa-phone-alt"></i> Tap to Call</div>
    </a>
  `).join('');
}

function initCountrySelector() {
  const btns = document.querySelectorAll('.country-btn[data-country]');
  const infoBox = document.getElementById('selected-country-info');
  const numEl = document.getElementById('selected-number');
  const descEl = document.getElementById('selected-desc');
  const flagEl = document.getElementById('selected-flag');
  const callLink = document.getElementById('country-call-link');
  const waBtn = document.getElementById('country-wa-share');

  btns.forEach((btn) => {
    btn.addEventListener('click', () => {
      btns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const code = btn.dataset.country;
      const data = GLOBAL_HELPLINES[code];
      if (!data || !infoBox) return;
      state.selectedCountry = data;
      flagEl.textContent = data.flag;
      numEl.textContent = data.number;
      descEl.textContent = `${data.country} – ${data.description}`;
      callLink.href = `tel:${data.number}`;
      infoBox.classList.add('visible');
    });
  });

  waBtn?.addEventListener('click', () => shareViaWhatsApp(state.gpsCoords));
}

// ── GPS / Geo-fence ────────────────────────────────────
function initGPS() {
  const startBtn = document.getElementById('gps-start-btn');
  const stopBtn  = document.getElementById('gps-stop-btn');
  const mapsBtn  = document.getElementById('gps-maps-btn');
  const waBtn    = document.getElementById('gps-wa-btn');

  const latEl   = document.getElementById('coord-lat');
  const lngEl   = document.getElementById('coord-lng');
  const accEl   = document.getElementById('coord-acc');
  const statusEl = document.getElementById('gps-status');
  const alertEl  = document.getElementById('geofence-alert');
  const mapInfo  = document.getElementById('map-info-text');

  function updateUI({ coords, geoFence, accuracy, isMock }) {
    state.gpsCoords = coords;
    state.geoFence = geoFence;

    latEl.textContent = coords.lat.toFixed(6) + '°';
    lngEl.textContent = coords.lng.toFixed(6) + '°';
    accEl.textContent = accuracy ? `±${Math.round(accuracy)}m` : '–';

    if (mapInfo) mapInfo.innerHTML = `
      <p><i class="fas fa-map-marker-alt"></i> ${isMock ? 'Demo Mode – Mumbai, India' : 'Live GPS Active'}</p>
      <small>${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}</small>
    `;

    if (alertEl && geoFence) {
      alertEl.className = `geofence-alert geofence-${geoFence.status}`;
      alertEl.innerHTML = `<i class="fas fa-${geoFence.status === 'safe' ? 'shield-alt' : geoFence.status === 'warning' ? 'exclamation-triangle' : 'exclamation-circle'}"></i> ${geoFence.message}`;

      if (geoFence.status === 'danger' && !sessionStorage.getItem('alertShown')) {
        showToast('🚨 Patient may have wandered outside safe zone!', 'error', 6000);
        sessionStorage.setItem('alertShown', '1');
      }
    }
  }

  startBtn?.addEventListener('click', () => {
    if (state.isTracking) return;
    state.isTracking = true;
    startBtn.disabled = true;
    startBtn.innerHTML = '<span class="spinner"></span> Acquiring…';
    statusEl && (statusEl.textContent = 'Tracking Active');
    sessionStorage.removeItem('alertShown');

    startTracking(
      (data) => {
        updateUI(data);
        startBtn.innerHTML = '<i class="fas fa-satellite-dish"></i> Live Tracking';
      },
      (err) => {
        showToast('GPS denied – using demo mode (Mumbai)', 'warn', 4000);
        startBtn.innerHTML = '<i class="fas fa-satellite-dish"></i> Demo Mode';
      }
    );
  });

  stopBtn?.addEventListener('click', () => {
    stopTracking();
    state.isTracking = false;
    startBtn.disabled = false;
    startBtn.innerHTML = '<i class="fas fa-satellite-dish"></i> Start Tracking';
    statusEl && (statusEl.textContent = 'Tracking Paused');
  });

  mapsBtn?.addEventListener('click', () => openMaps(state.gpsCoords));
  waBtn?.addEventListener('click', () => shareViaWhatsApp(state.gpsCoords));
}

// ── Doctor Cards ───────────────────────────────────────
function renderDoctors() {
  const panel = document.getElementById('doctor-panel');
  if (!panel) return;
  panel.innerHTML = DOCTORS.map((d) => `
    <div class="doctor-card" id="doctor-${d.id}">
      <div class="doctor-avatar">${d.emoji}</div>
      <div style="flex:1">
        <div class="doctor-name">${d.name}</div>
        <div class="doctor-spec">${d.specialization}</div>
        <div class="doctor-meta">
          <span><i class="fas fa-hospital-alt"></i>${d.hospital}</span>
          <span><i class="fas fa-star" style="color:#f59e0b"></i>${d.rating}</span>
          <span><i class="fas fa-clock"></i>${d.experience}</span>
          <span><i class="fas fa-rupee-sign"></i>${d.fee}</span>
        </div>
      </div>
      <button class="btn-book" id="book-${d.id}" onclick="window.openApptModal('${d.id}')">
        <i class="fas fa-calendar-plus"></i> Book
      </button>
    </div>
  `).join('');
}

// ── Appointment Modal ──────────────────────────────────
function initAppointmentModal() {
  const modal = document.getElementById('appt-modal');
  const closeBtn = document.getElementById('appt-modal-close');
  const form = document.getElementById('appt-form');

  window.openApptModal = (doctorId) => {
    const doc = DOCTORS.find((d) => d.id === doctorId) || DOCTORS[0];
    state.selectedDoctor = doc;
    document.getElementById('appt-doctor-name').textContent = `${doc.emoji} ${doc.name}`;
    document.getElementById('appt-doctor-spec').textContent = doc.specialization;

    const slotsEl = document.getElementById('appt-slots');
    slotsEl.innerHTML = doc.slots.map((slot) => `
      <button class="time-slot" data-slot="${slot}" onclick="selectSlot(this, '${slot}')">${slot}</button>
    `).join('');

    modal.classList.add('open');
  };

  window.selectSlot = (el, slot) => {
    document.querySelectorAll('.time-slot').forEach((s) => s.classList.remove('selected'));
    el.classList.add('selected');
    state.selectedSlot = slot;
  };

  closeBtn?.addEventListener('click', () => modal.classList.remove('open'));
  modal?.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('open'); });

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('appt-patient-name').value.trim();
    const phone = document.getElementById('appt-phone').value.trim();
    const date = document.getElementById('appt-date').value;

    if (!name || !phone || !date) { showToast('Please fill all required fields', 'error'); return; }
    if (!state.selectedSlot) { showToast('Please select a time slot', 'warn'); return; }

    showToast(`✅ Appointment booked with ${state.selectedDoctor?.name} on ${date} at ${state.selectedSlot}!`, 'success', 5000);
    modal.classList.remove('open');
    form.reset();
    document.querySelectorAll('.time-slot').forEach((s) => s.classList.remove('selected'));
    state.selectedSlot = null;
  });
}

// ── Music Player ───────────────────────────────────────
function initMusicPlayer() {
  const trackListEl = document.getElementById('track-list');
  const playBtn     = document.getElementById('play-btn');
  const prevBtn     = document.getElementById('prev-btn');
  const nextBtn     = document.getElementById('next-btn');
  const loopBtn     = document.getElementById('loop-btn');
  const volSlider   = document.getElementById('volume-slider');
  const npTitle     = document.getElementById('np-title');
  const npDesc      = document.getElementById('np-desc');
  const vizBars     = document.querySelectorAll('.viz-bar');

  if (!trackListEl) return;

  function renderTracks() {
    trackListEl.innerHTML = TRACKS.map((t, i) => `
      <div class="track-item ${i === getCurrentIndex() ? 'active' : ''}" id="track-item-${i}" onclick="window.selectTrack(${i})">
        <div class="track-icon" style="background:${t.bg}">${t.icon}</div>
        <div>
          <div class="track-name">${t.name}</div>
          <div class="track-desc">${t.description}</div>
        </div>
      </div>
    `).join('');
  }

  function updateNowPlaying(index) {
    const t = TRACKS[index];
    if (npTitle) npTitle.textContent = t.name;
    if (npDesc) npDesc.textContent = t.description;
    document.querySelectorAll('.track-item').forEach((el, i) => {
      el.classList.toggle('active', i === index);
    });
  }

  function updateViz(playing) {
    vizBars.forEach((bar) => {
      if (playing) bar.classList.remove('paused');
      else bar.classList.add('paused');
    });
  }

  window.selectTrack = (i) => {
    playTrack(i);
    updateNowPlaying(i);
    updateViz(true);
    if (playBtn) playBtn.innerHTML = '<i class="fas fa-pause"></i>';
  };

  playBtn?.addEventListener('click', () => {
    if (getIsPlaying()) {
      pauseTrack();
      playBtn.innerHTML = '<i class="fas fa-play"></i>';
      updateViz(false);
    } else if (audioCtxExists()) {
      resumeTrack();
      playBtn.innerHTML = '<i class="fas fa-pause"></i>';
      updateViz(true);
    } else {
      playTrack(getCurrentIndex());
      playBtn.innerHTML = '<i class="fas fa-pause"></i>';
      updateViz(true);
      updateNowPlaying(getCurrentIndex());
    }
  });

  prevBtn?.addEventListener('click', () => {
    const i = prevTrack();
    updateNowPlaying(i);
    updateViz(true);
    if (playBtn) playBtn.innerHTML = '<i class="fas fa-pause"></i>';
  });

  nextBtn?.addEventListener('click', () => {
    const i = nextTrack();
    updateNowPlaying(i);
    updateViz(true);
    if (playBtn) playBtn.innerHTML = '<i class="fas fa-pause"></i>';
  });

  loopBtn?.addEventListener('click', () => {
    const looping = toggleLoop();
    loopBtn.classList.toggle('active', looping);
    showToast(looping ? '🔁 Loop enabled' : '🔁 Loop disabled', 'success', 2000);
  });

  volSlider?.addEventListener('input', () => {
    const vol = volSlider.value / 100;
    state.currentVolume = vol;
    setVolume(vol);
    // Update slider gradient
    volSlider.style.background = `linear-gradient(to right, #14b8a6 0%, #14b8a6 ${volSlider.value}%, #e2e8f0 ${volSlider.value}%)`;
  });

  renderTracks();
  updateNowPlaying(0);

  function audioCtxExists() {
    try { return window.AudioContext || window.webkitAudioContext; }
    catch { return false; }
  }
}

// ── Safety Checklist ───────────────────────────────────
const SAFETY_ITEMS = [
  { id: 's1',  text: 'Install door alarms & safety locks' },
  { id: 's2',  text: 'Remove trip hazards (loose rugs, cords)' },
  { id: 's3',  text: 'Add grab bars in bathroom & near stairs' },
  { id: 's4',  text: 'Store medicines in a locked cabinet' },
  { id: 's5',  text: 'Set up gas leak & smoke detectors' },
  { id: 's6',  text: 'Label rooms with large-print signs' },
  { id: 's7',  text: 'Patient ID bracelet with emergency contact' },
  { id: 's8',  text: 'Night lights in hallways & bathroom' },
  { id: 's9',  text: 'Install stove auto-shutoff device' },
  { id: 's10', text: 'Keep a daily log of medications given' },
  { id: 's11', text: 'Secure sharp objects & cleaning chemicals' },
  { id: 's12', text: 'Schedule monthly doctor check-ins' },
];

function initSafetyChecklist() {
  const grid = document.getElementById('safety-grid');
  if (!grid) return;

  grid.innerHTML = SAFETY_ITEMS.map((item) => {
    const checked = state.safetyChecklist[item.id];
    return `
      <div class="safety-item ${checked ? 'checked' : ''}" id="safety-${item.id}" onclick="toggleSafety('${item.id}')">
        <div class="safety-checkbox">${checked ? '<i class="fas fa-check"></i>' : ''}</div>
        <span class="safety-text">${item.text}</span>
      </div>
    `;
  }).join('');

  window.toggleSafety = (id) => {
    const el = document.getElementById(`safety-${id}`);
    const box = el.querySelector('.safety-checkbox');
    const isChecked = el.classList.toggle('checked');
    box.innerHTML = isChecked ? '<i class="fas fa-check"></i>' : '';
    state.safetyChecklist[id] = isChecked;
    localStorage.setItem('careHub_checklist', JSON.stringify(state.safetyChecklist));
    const count = Object.values(state.safetyChecklist).filter(Boolean).length;
    const totalEl = document.getElementById('checklist-count');
    if (totalEl) totalEl.textContent = `${count}/${SAFETY_ITEMS.length} completed`;
  };

  const count = Object.values(state.safetyChecklist).filter(Boolean).length;
  const totalEl = document.getElementById('checklist-count');
  if (totalEl) totalEl.textContent = `${count}/${SAFETY_ITEMS.length} completed`;
}

// ── Chat Widget ────────────────────────────────────────
function initChat() {
  const fab   = document.getElementById('chat-fab');
  const panel = document.getElementById('chat-panel');
  const close = document.getElementById('chat-close');
  const body  = document.getElementById('chat-body');
  const input = document.getElementById('chat-input');
  const send  = document.getElementById('chat-send');
  const resetBtn = document.getElementById('chat-reset');

  function appendMessages(messages) {
    messages.forEach(({ type, text, options, risk, done, showBooking }) => {
      const div = document.createElement('div');
      div.className = `chat-msg ${type}`;

      const bubble = document.createElement('div');
      bubble.className = 'chat-bubble';
      // Markdown-ish rendering
      bubble.innerHTML = text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');
      div.appendChild(bubble);
      body.appendChild(div);

      if (options) {
        const optWrap = document.createElement('div');
        optWrap.className = 'chat-options';
        options.forEach((opt, i) => {
          const btn = document.createElement('button');
          btn.className = 'chat-opt-btn';
          btn.textContent = opt.label;
          btn.addEventListener('click', () => {
            optWrap.querySelectorAll('button').forEach((b) => b.disabled = true);
            const result = processChat(i);
            appendMessages(result.messages);
            if (result.done && result.riskLevel) {
              const badge = document.createElement('div');
              badge.className = `risk-badge risk-${result.riskLevel.toLowerCase()}`;
              badge.innerHTML = `Patient Risk: <strong>${result.riskLevel}</strong> (Score: ${result.score})`;
              body.appendChild(badge);
            }
          });
          optWrap.appendChild(btn);
        });
        body.appendChild(optWrap);
      }

      if (showBooking) {
        const bookBtn = document.createElement('button');
        bookBtn.className = 'chat-opt-btn';
        bookBtn.style.marginTop = '8px';
        bookBtn.innerHTML = '📅 Book Urgent Appointment';
        bookBtn.addEventListener('click', () => window.openApptModal('d1'));
        body.appendChild(bookBtn);
      }
    });

    body.scrollTop = body.scrollHeight;
  }

  fab?.addEventListener('click', () => {
    state.chatOpen = !state.chatOpen;
    panel.classList.toggle('open', state.chatOpen);
    if (state.chatOpen && body.children.length === 0) {
      const init = processChat();
      appendMessages(init.messages);
    }
  });

  close?.addEventListener('click', () => {
    state.chatOpen = false;
    panel.classList.remove('open');
  });

  resetBtn?.addEventListener('click', () => {
    resetChat();
    body.innerHTML = '';
    const init = processChat();
    appendMessages(init.messages);
    showToast('Chat reset – starting new assessment', 'success', 2000);
  });

  send?.addEventListener('click', sendMsg);
  input?.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendMsg(); });

  function sendMsg() {
    const val = input.value.trim();
    if (!val) return;
    const userDiv = document.createElement('div');
    userDiv.className = 'chat-msg user';
    userDiv.innerHTML = `<div class="chat-bubble">${val}</div>`;
    body.appendChild(userDiv);
    input.value = '';

    setTimeout(() => {
      const tipDiv = document.createElement('div');
      tipDiv.className = 'chat-msg bot';
      tipDiv.innerHTML = `<div class="chat-bubble">${getRandomTip()}</div>`;
      body.appendChild(tipDiv);
      body.scrollTop = body.scrollHeight;
    }, 600);
  }
}

// ── SOS FAB ────────────────────────────────────────────
function initSOSFab() {
  const fab  = document.getElementById('sos-fab-main');
  const menu = document.getElementById('sos-fab-menu');

  fab?.addEventListener('click', () => {
    state.sosFabOpen = !state.sosFabOpen;
    menu.classList.toggle('open', state.sosFabOpen);
  });

  document.addEventListener('click', (e) => {
    if (!document.getElementById('sos-fab').contains(e.target)) {
      state.sosFabOpen = false;
      menu.classList.remove('open');
    }
  });
}

// ── Header SOS Button ──────────────────────────────────
function initHeaderSOS() {
  const btn = document.getElementById('header-sos-btn');
  btn?.addEventListener('click', () => {
    document.getElementById('emergency-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

// ── Random Daily Tip Banner ────────────────────────────
function initDailyTip() {
  const el = document.getElementById('daily-tip');
  if (el) el.textContent = getRandomTip();
}

// ── App Init ───────────────────────────────────────────
function init() {
  initHeader();
  initPillNav();
  initSearch();
  renderHelplines();
  initCountrySelector();
  renderDoctors();
  initGPS();
  initAppointmentModal();
  initMusicPlayer();
  initSafetyChecklist();
  initChat();
  initSOSFab();
  initHeaderSOS();
  initScrollReveal();
  initDailyTip();

  // Set min date for appointment
  const dateInput = document.getElementById('appt-date');
  if (dateInput) dateInput.min = new Date().toISOString().split('T')[0];

  // Tip rotator
  setInterval(() => {
    const el = document.getElementById('daily-tip');
    if (el) {
      el.style.opacity = '0';
      setTimeout(() => { el.textContent = getRandomTip(); el.style.opacity = '1'; }, 400);
    }
  }, 8000);

  console.log('🏥 CareHub initialized successfully');
}

document.addEventListener('DOMContentLoaded', init);
