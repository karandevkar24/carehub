// =====================================================
// CAREGIVER HUB – Doctor Search Module
// Primary:  OpenStreetMap / Overpass API (free, no key needed)
// Fallback: Local DOCTORS database from helplines.js
//
// UPGRADING TO GOOGLE PLACES:
//   1. Set secret: firebase functions:secrets:set GOOGLE_PLACES_KEY
//   2. Deploy functions: firebase deploy --only functions
//   3. Change searchNearbyDoctorsViaPlaces() below to call the
//      Cloud Function (see functions/index.js for the server code).
//   4. Uncomment getPlaceDetails() Cloud Function call.
// =====================================================

import { DOCTORS as LOCAL_DOCTORS } from './helplines.js';

// ── Error type constants ──────────────────────────────────
export const DR_ERR = {
  LOCATION_DENIED:    'LOCATION_DENIED',
  NO_INTERNET:        'NO_INTERNET',
  ZERO_RESULTS:       'ZERO_RESULTS',
  API_QUOTA:          'API_QUOTA',
  API_KEY_ERROR:      'API_KEY_ERROR',
  MALFORMED_RESPONSE: 'MALFORMED_RESPONSE',
  TIMEOUT:            'TIMEOUT',
  AUTH_REQUIRED:      'AUTH_REQUIRED',
  UNKNOWN:            'UNKNOWN',
};

// Overpass endpoints (tried in order, first success wins)
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

// Specialty → Overpass tag filters
const SPECIALTY_OVERPASS_FILTER = {
  all:          ['amenity=doctors','amenity=clinic','amenity=hospital','healthcare=doctor'],
  neurologist:  ['amenity=doctors','healthcare=doctor'],
  geriatrician: ['amenity=doctors','amenity=clinic','healthcare=doctor'],
  psychiatrist: ['amenity=doctors','healthcare=doctor'],
  physician:    ['amenity=doctors','amenity=clinic','healthcare=doctor'],
};

/**
 * Primary search: OpenStreetMap via Overpass API.
 * Return shape is identical to the Google Places path so gps.html works
 * without any changes when switching to Places later.
 *
 * @param {number} lat
 * @param {number} lng
 * @param {string} specialty  'all' | 'neurologist' | 'geriatrician' | 'psychiatrist' | 'physician'
 * @param {number} radiusKm
 * @returns {Promise<{results: Array, source: string, error?: string}>}
 */
export async function searchNearbyDoctorsViaPlaces(lat, lng, specialty = 'all', radiusKm = 10) {
  if (!navigator.onLine) {
    return { results: [], source: 'offline', error: DR_ERR.NO_INTERNET };
  }

  try {
    const results = await _overpassSearch(lat, lng, specialty, radiusKm);
    if (results.length > 0) {
      return { results, source: 'openstreetmap' };
    }
    return { results: [], source: 'openstreetmap', error: DR_ERR.ZERO_RESULTS };
  } catch (err) {
    const isTimeout = err.name === 'AbortError' || err.name === 'TimeoutError';
    console.warn('[Doctor Search] Overpass failed:', err.message);
    return {
      results: [],
      source:  'openstreetmap',
      error:   isTimeout ? DR_ERR.TIMEOUT : DR_ERR.UNKNOWN,
    };
  }
}

/**
 * getPlaceDetails — returns a stub when no Places key is configured.
 * When Google Places is active, this calls the placeDetails Cloud Function.
 * @param {string} placeId
 */
export async function getPlaceDetails(placeId) {
  // Stub — real implementation calls the Cloud Function.
  // When upgrading, import { getFunctions, httpsCallable } from firebase-functions
  // and call httpsCallable(getFns(), 'placeDetails')({ placeId }).
  return { phone: '', address: '', rating: null, openNow: null };
}

// ── Internal: Overpass query builder + fetcher ────────────
async function _overpassSearch(lat, lng, specialty, radiusKm) {
  const radius = radiusKm * 1000;

  // Build node/way queries for the given specialty
  const tags = SPECIALTY_OVERPASS_FILTER[specialty] || SPECIALTY_OVERPASS_FILTER.all;
  const nodeLines = tags.map(t => `node["${t.replace('=','"]="')}"](around:${radius},${lat},${lng});`).join('\n      ');
  const wayLines  = ['amenity=hospital','amenity=clinic']
    .map(t => `way["${t.replace('=','"]="')}"](around:${radius},${lat},${lng});`).join('\n      ');

  const query = `[out:json][timeout:25];
    (
      ${nodeLines}
      ${wayLines}
    );
    out center tags qt 60;`;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const resp = await fetch(endpoint, {
        method:  'POST',
        headers: { 'User-Agent': 'CareHub/1.0 (carehub-70809.web.app; caregiver support app)' },
        body:    'data=' + encodeURIComponent(query),
        signal:  AbortSignal.timeout(25000),
      });
      if (!resp.ok) continue;
      const data = await resp.json();
      if (!Array.isArray(data.elements)) continue;
      const parsed = _parseOverpass(data.elements, lat, lng, specialty);
      if (parsed.length > 0) return parsed;
    } catch (e) {
      console.warn(`[Overpass] ${endpoint} failed:`, e.message);
    }
  }
  return [];
}

function _parseOverpass(elements, userLat, userLng, specialty) {
  return elements
    .map(el => {
      const tags  = el.tags || {};
      const elLat = el.lat  ?? el.center?.lat;
      const elLng = el.lon  ?? el.center?.lon;
      if (!elLat || !elLng) return null;

      const name         = tags.name || tags['name:en'] || 'Medical Facility';
      const specialization = _inferSpecialty(tags, specialty);
      const dist         = haversineKm(userLat, userLng, elLat, elLng);
      const phone        = tags.phone || tags['contact:phone'] || '';
      const address      = _buildAddress(tags);

      return {
        placeId:       null,                 // No Places ID for OSM results
        id:            `osm_${el.id}`,
        name,
        specialization,
        hospital:      tags.operator || name,
        address,
        phone,
        lat:           elLat,
        lng:           elLng,
        distance:      dist,
        distanceText:  dist < 1 ? `${Math.round(dist * 1000)}m` : `${dist.toFixed(1)} km`,
        emoji:         _getEmoji(specialization),
        rating:        null,                 // Overpass has no rating data
        openNow:       null,
        userRatings:   0,
        slots:         _generateSlots(),
        source:        'openstreetmap',
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 20);
}

function _inferSpecialty(tags, hint) {
  if (hint && hint !== 'all') {
    const map = {
      neurologist:  'Neurologist',
      geriatrician: 'Geriatrician',
      psychiatrist: 'Psychiatrist / Neuropsychologist',
      physician:    'General Physician',
    };
    if (map[hint]) return map[hint];
  }
  const combined = [tags.amenity, tags.healthcare, tags.speciality,
    tags['healthcare:speciality'], tags.description].join(' ').toLowerCase();
  if (combined.includes('neuro'))  return 'Neurologist';
  if (combined.includes('geri') || combined.includes('elder')) return 'Geriatrician';
  if (combined.includes('psych'))  return 'Psychiatrist / Neuropsychologist';
  if (combined.includes('hospital')) return 'General Hospital';
  if (combined.includes('clinic')) return 'Medical Clinic';
  return 'General Physician';
}

function _buildAddress(tags) {
  const parts = [
    tags['addr:housenumber'], tags['addr:street'],
    tags['addr:suburb'],      tags['addr:city'], tags['addr:state'],
  ].filter(Boolean);
  return parts.join(', ') || tags.address || '';
}

function _getEmoji(specialty) {
  if (specialty.includes('Neuro'))    return '🧠';
  if (specialty.includes('Geri'))     return '👴';
  if (specialty.includes('Psych'))    return '🧬';
  if (specialty.includes('Hospital')) return '🏥';
  return '⚕️';
}

function _generateSlots() {
  return ['09:00 AM', '10:30 AM', '12:00 PM', '02:00 PM', '04:00 PM', '05:30 PM'];
}

// searchNearbyDoctors kept as named export for backward compatibility
// (gps.html no longer calls it; searchAt uses searchNearbyDoctorsViaPlaces + searchDoctorsLocal directly)
export async function searchNearbyDoctors(lat, lng, radiusKm = 10) {
  try {
    const results = await _overpassSearch(lat, lng, 'all', radiusKm);
    if (results.length > 0) return results;
  } catch (e) {
    console.warn('Overpass unavailable – using local doctor database');
  }
  return searchDoctorsLocal(lat, lng, radiusKm);
}

// ── Local DB fallback ─────────────────────────────────────
export function searchDoctorsLocal(lat, lng, radiusKm = 100) {
  return LOCAL_DOCTORS
    .filter(d => d.lat && d.lng)
    .map(d => ({
      ...d,
      placeId:      null,
      distance:     haversineKm(lat, lng, d.lat, d.lng),
      distanceText: '',
      source:       'local',
      openNow:      null,
      userRatings:  0,
    }))
    .sort((a, b) => a.distance - b.distance)
    .map(d => ({
      ...d,
      distanceText: d.distance < 1
        ? `${Math.round(d.distance * 1000)}m`
        : `${d.distance.toFixed(1)} km`,
    }))
    .slice(0, 20);
}

// ── Geocoding (Nominatim) ─────────────────────────────────
export async function geocodeLocation(queryStr) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(queryStr)}&format=json&limit=5&addressdetails=1`;
    const resp = await fetch(url, {
      headers: {
        'Accept-Language': 'en',
        'User-Agent': 'CareHub/1.0 (carehub-70809.web.app; caregiver support app)',
      },
      signal: AbortSignal.timeout(10000),
    });
    const data = await resp.json();
    if (!data.length) return null;
    const first = data[0];
    return {
      lat:         parseFloat(first.lat),
      lng:         parseFloat(first.lon),
      displayName: first.display_name,
      suggestions: data.map(r => ({
        lat: parseFloat(r.lat), lng: parseFloat(r.lon), name: r.display_name,
      })),
    };
  } catch (e) {
    console.warn('Nominatim geocode failed:', e.message);
    return null;
  }
}

export async function reverseGeocode(lat, lng) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`;
    const resp = await fetch(url, {
      headers: {
        'Accept-Language': 'en',
        'User-Agent': 'CareHub/1.0 (carehub-70809.web.app; caregiver support app)',
      },
      signal: AbortSignal.timeout(8000),
    });
    const data = await resp.json();
    const addr = data.address || {};
    return addr.city || addr.town || addr.village || addr.county || addr.state || 'your location';
  } catch (_) {
    return 'your location';
  }
}

// ── Haversine distance ────────────────────────────────────
export function haversineKm(lat1, lng1, lat2, lng2) {
  const R    = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a    = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
