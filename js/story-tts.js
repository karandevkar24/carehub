// =====================================================
// CAREGIVER HUB — Story Time TTS Engine
// =====================================================
// Wraps Web Speech API SpeechSynthesis with:
// - Language-appropriate voice selection with graceful fallback
// - Sentence boundary tracking for text highlighting
// - Play / Pause / Resume / Stop controls
// =====================================================

const LANG_BCP47 = {
  en: 'en-IN',
  hi: 'hi-IN',
  mr: 'mr-IN',
  te: 'te-IN',
};

// Fallback priority chains if preferred voice unavailable
const LANG_FALLBACK = {
  en: ['en-IN', 'en-GB', 'en-US', 'en'],
  hi: ['hi-IN', 'hi'],
  mr: ['mr-IN', 'hi-IN', 'hi'],    // Marathi → Hindi as closest fallback
  te: ['te-IN', 'hi-IN', 'en-IN'], // Telugu → Hindi → English
};

let _voices = [];
let _voicesLoaded = false;

function _loadVoices() {
  return new Promise((resolve) => {
    const load = () => {
      _voices = window.speechSynthesis.getVoices();
      _voicesLoaded = true;
      resolve(_voices);
    };
    if (window.speechSynthesis.getVoices().length > 0) {
      load();
    } else {
      window.speechSynthesis.onvoiceschanged = load;
      // Timeout fallback — some browsers never fire onvoiceschanged
      setTimeout(load, 1500);
    }
  });
}

/**
 * Find the best available voice for a language code (en/hi/mr/te).
 * Returns { voice, exactMatch, langUsed } or { voice: null } if none found.
 */
export async function findVoice(langCode) {
  if (!_voicesLoaded) await _loadVoices();

  const chains = LANG_FALLBACK[langCode] || ['en-IN', 'en-US'];

  for (const bcp47 of chains) {
    // Try exact lang match
    const exact = _voices.find(v => v.lang === bcp47);
    if (exact) return { voice: exact, exactMatch: true, langUsed: bcp47 };

    // Try prefix match (e.g. 'hi' matches 'hi-IN')
    const prefix = bcp47.split('-')[0];
    const partial = _voices.find(v => v.lang.startsWith(prefix));
    if (partial) return { voice: partial, exactMatch: bcp47 === LANG_BCP47[langCode], langUsed: partial.lang };
  }

  // Last resort: any voice
  if (_voices.length > 0) return { voice: _voices[0], exactMatch: false, langUsed: _voices[0].lang };

  return { voice: null, exactMatch: false, langUsed: null };
}

/**
 * Get voice availability status for a language (for UI feedback).
 * Returns 'full' | 'partial' | 'none'
 */
export async function getVoiceStatus(langCode) {
  const result = await findVoice(langCode);
  if (!result.voice) return 'none';
  if (result.exactMatch) return 'full';
  return 'partial';
}

// Active utterance reference (for pause/resume/stop)
let _currentUtterance = null;
let _isSpeaking = false;
let _isPaused = false;

/**
 * Split text into sentences for highlighting.
 */
function splitSentences(text) {
  // Split on . ! ? followed by space or end, keeping delimiters
  return text.match(/[^.!?]+[.!?]+(\s|$)?/g)?.map(s => s.trim()).filter(Boolean) || [text];
}

/**
 * Speak text in the given language.
 * @param {string} text - Full story text
 * @param {string} langCode - 'en' | 'hi' | 'mr' | 'te'
 * @param {Function} onSentence - Called with (sentenceIndex, totalSentences) at each boundary
 * @param {Function} onEnd - Called when narration ends
 * @param {Function} onVoiceStatus - Called with ('full'|'partial'|'none', langUsed) before speaking
 * @param {number} volume - 0.0 to 1.0
 * @param {number} rate - 0.5 to 1.5 (default 0.85 — slightly slower for elderly)
 */
export async function speak(text, langCode, { onSentence, onEnd, onVoiceStatus, volume = 0.9, rate = 0.85 } = {}) {
  stopNarration();

  const { voice, exactMatch, langUsed } = await findVoice(langCode);
  const status = !voice ? 'none' : exactMatch ? 'full' : 'partial';

  if (onVoiceStatus) onVoiceStatus(status, langUsed);

  if (!voice) {
    if (onEnd) onEnd();
    return;
  }

  const sentences = splitSentences(text);
  let sentenceIndex = 0;

  // We'll speak the whole text as one utterance and use word boundaries
  // to approximate sentence progression. This works best cross-browser.
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = voice;
  utterance.lang = voice.lang;
  utterance.volume = Math.max(0, Math.min(1, volume));
  utterance.rate = Math.max(0.5, Math.min(1.5, rate));
  utterance.pitch = 1.0;

  // Track character position → sentence index via boundary events
  utterance.onboundary = (e) => {
    if (e.name === 'word') {
      const charPos = e.charIndex;
      // Find which sentence this character falls in
      let cumLen = 0;
      for (let i = 0; i < sentences.length; i++) {
        cumLen += sentences[i].length + 1; // +1 for space
        if (charPos < cumLen) {
          if (i !== sentenceIndex) {
            sentenceIndex = i;
            if (onSentence) onSentence(sentenceIndex, sentences.length, sentences);
          }
          break;
        }
      }
    }
  };

  utterance.onstart = () => {
    _isSpeaking = true;
    _isPaused = false;
    if (onSentence) onSentence(0, sentences.length, sentences);
  };

  utterance.onend = () => {
    _isSpeaking = false;
    _isPaused = false;
    _currentUtterance = null;
    if (onEnd) onEnd();
  };

  utterance.onerror = (e) => {
    if (e.error === 'interrupted' || e.error === 'canceled') return;
    console.warn('TTS error:', e.error);
    _isSpeaking = false;
    _isPaused = false;
    _currentUtterance = null;
    if (onEnd) onEnd();
  };

  _currentUtterance = utterance;
  window.speechSynthesis.speak(utterance);
}

export function pauseNarration() {
  if (_isSpeaking && !_isPaused) {
    window.speechSynthesis.pause();
    _isPaused = true;
  }
}

export function resumeNarration() {
  if (_isPaused) {
    window.speechSynthesis.resume();
    _isPaused = false;
  }
}

export function stopNarration() {
  window.speechSynthesis.cancel();
  _isSpeaking = false;
  _isPaused = false;
  _currentUtterance = null;
}

export function isSpeaking() { return _isSpeaking; }
export function isPaused()   { return _isPaused; }

/**
 * Update volume of currently playing utterance.
 * Note: volume can only be changed by re-starting on most browsers.
 * This stores the value for next speak() call.
 */
export function setVolume(vol) {
  if (_currentUtterance) _currentUtterance.volume = Math.max(0, Math.min(1, vol));
}
