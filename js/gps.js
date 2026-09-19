// =====================================================
// CAREGIVER HUB – GPS & Geo-Fencing Module
// =====================================================

// Default fallback: Mumbai, India
const DEFAULT_COORDS = { lat: 19.076, lng: 72.8777 };
const GEOFENCE_RADIUS_KM = 0.5; // 500 meters safe zone
const PATIENT_SAFE_ZONE = { lat: 19.076, lng: 72.8777 }; // same as home

let watchId = null;
let currentCoords = null;
let geoFenceCallback = null;

/**
 * Haversine distance formula – returns km between two lat/lng points
 */
function haversineDistance(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      sinLng * sinLng;
  return R * 2 * Math.asin(Math.sqrt(h));
}

/**
 * Check if coords are within the safe geo-fence zone
 */
function checkGeoFence(coords) {
  const dist = haversineDistance(coords, PATIENT_SAFE_ZONE);
  if (dist <= GEOFENCE_RADIUS_KM * 0.4) return { status: 'safe', dist, message: '✅ Patient is safely within home zone' };
  if (dist <= GEOFENCE_RADIUS_KM) return { status: 'warning', dist, message: '⚠️ Patient is near the boundary of the safe zone' };
  return { status: 'danger', dist, message: '🚨 ALERT: Patient may have wandered outside safe zone!' };
}

/**
 * Start live geolocation tracking
 * @param {Function} onUpdate – called with { coords, geoFence }
 * @param {Function} onError  – called with error message
 */
export function startTracking(onUpdate, onError) {
  if (!navigator.geolocation) {
    onError('Geolocation is not supported by this browser.');
    useFallback(onUpdate);
    return;
  }

  try {
    // Get initial position quickly
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        currentCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const geoFence = checkGeoFence(currentCoords);
        onUpdate({ coords: currentCoords, geoFence, accuracy: pos.coords.accuracy });
      },
      (err) => {
        console.warn('GPS Error:', err.message);
        onError(err.message);
        useFallback(onUpdate);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );

    // Watch for changes
    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        currentCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const geoFence = checkGeoFence(currentCoords);
        onUpdate({ coords: currentCoords, geoFence, accuracy: pos.coords.accuracy });
      },
      (err) => console.warn('GPS Watch Error:', err.message),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
  } catch (err) {
    onError('Unexpected GPS error: ' + err.message);
    useFallback(onUpdate);
  }
}

/**
 * Stop tracking
 */
export function stopTracking() {
  if (watchId !== null && navigator.geolocation) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
}

/**
 * Fallback: Use Mumbai mock coords with simulated slight drift
 */
function useFallback(onUpdate) {
  const coords = { ...DEFAULT_COORDS };
  // Simulate mild drift every 4 seconds
  let driftStep = 0;
  const drifts = [
    { lat: 0, lng: 0 },
    { lat: 0.001, lng: 0.001 },
    { lat: 0.003, lng: 0.002 },
    { lat: 0.0005, lng: -0.001 },
    { lat: -0.001, lng: 0 },
  ];

  function emitFallback() {
    const drift = drifts[driftStep % drifts.length];
    const c = { lat: coords.lat + drift.lat, lng: coords.lng + drift.lng };
    const geoFence = checkGeoFence(c);
    onUpdate({ coords: c, geoFence, accuracy: 25, isMock: true });
    driftStep++;
  }

  emitFallback();
  setInterval(emitFallback, 5000);
}

/**
 * Open Google Maps for given coords
 */
export function openMaps(coords) {
  const c = coords || currentCoords || DEFAULT_COORDS;
  window.open(`https://www.google.com/maps?q=${c.lat},${c.lng}`, '_blank');
}

/**
 * Share location via WhatsApp
 */
export function shareViaWhatsApp(coords) {
  const c = coords || currentCoords || DEFAULT_COORDS;
  const msg = encodeURIComponent(
    `🚨 PATIENT LOCATION ALERT\nCurrent Location: https://www.google.com/maps?q=${c.lat},${c.lng}\nShared from CareHub – Caregiver App`
  );
  window.open(`https://api.whatsapp.com/send?text=${msg}`, '_blank');
}
