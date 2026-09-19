// =====================================================
// CAREHUB – Firebase Cloud Functions
// Google Places API Proxy (server-side, key never exposed to client)
// =====================================================

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { defineSecret } = require('firebase-functions/params');

initializeApp();

// Secret stored securely in Firebase Secret Manager (set via firebase functions:secrets:set GOOGLE_PLACES_KEY)
const PLACES_KEY = defineSecret('GOOGLE_PLACES_KEY');

const PLACES_BASE = 'https://maps.googleapis.com/maps/api';
const REQUEST_TIMEOUT_MS = 10000;

// Specialty → Google Places type mapping
const SPECIALTY_TYPE_MAP = {
  all:               null,
  neurologist:       'doctor',
  geriatrician:      'doctor',
  psychiatrist:      'doctor',
  physician:         'doctor',
  hospital:          'hospital',
  clinic:            'doctor',
};

// Keyword hints to include in search for better relevance
const SPECIALTY_KEYWORD_MAP = {
  all:             'neurologist geriatrician dementia doctor',
  neurologist:     'neurologist brain nerve dementia',
  geriatrician:    'geriatrician elder senior care',
  psychiatrist:    'psychiatrist mental health memory',
  physician:       'general physician doctor clinic',
  hospital:        'hospital medical center',
  clinic:          'clinic medical',
};

// ─────────────────────────────────────────────────────────
// HELPER: fetch with timeout + detailed error mapping
// ─────────────────────────────────────────────────────────
async function placeFetch(url, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!resp.ok) {
      throw new HttpsError('unavailable', `Places API HTTP error: ${resp.status}`);
    }
    return resp.json();
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw new HttpsError('deadline-exceeded', 'Places API request timed out');
    }
    if (err instanceof HttpsError) throw err;
    throw new HttpsError('unavailable', `Network error: ${err.message}`);
  }
}

// ─────────────────────────────────────────────────────────
// HELPER: parse & sanitise a Places Nearby result element
// ─────────────────────────────────────────────────────────
function parsePlaceResult(place, userLat, userLng) {
  if (!place.geometry?.location) return null;
  const { lat, lng } = place.geometry.location;
  const dist = haversineKm(userLat, userLng, lat, lng);

  return {
    placeId:      place.place_id,
    name:         place.name || 'Medical Facility',
    address:      place.vicinity || place.formatted_address || '',
    rating:       place.rating ?? null,
    userRatings:  place.user_ratings_total ?? 0,
    types:        place.types || [],
    lat,
    lng,
    distance:     dist,
    distanceText: dist < 1 ? `${Math.round(dist * 1000)}m` : `${dist.toFixed(1)} km`,
    openNow:      place.opening_hours?.open_now ?? null,
    photoRef:     place.photos?.[0]?.photo_reference ?? null,
  };
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─────────────────────────────────────────────────────────
// CLOUD FUNCTION 1: nearbySearch
// Called from frontend with: { lat, lng, specialty, radius }
// Returns array of sanitised place results
// ─────────────────────────────────────────────────────────
exports.nearbySearch = onCall(
  { secrets: [PLACES_KEY], cors: true, enforceAppCheck: false },
  async (request) => {
    // Auth check
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'You must be logged in to search doctors.');
    }

    const { lat, lng, specialty = 'all', radius = 10000 } = request.data;

    // Validation
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      throw new HttpsError('invalid-argument', 'lat and lng must be numbers.');
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      throw new HttpsError('invalid-argument', 'lat/lng out of valid range.');
    }
    if (typeof radius !== 'number' || radius < 1000 || radius > 50000) {
      throw new HttpsError('invalid-argument', 'radius must be between 1000 and 50000 metres.');
    }

    const apiKey = PLACES_KEY.value();
    if (!apiKey) {
      throw new HttpsError('internal', 'Places API key not configured.');
    }

    const type    = SPECIALTY_TYPE_MAP[specialty] ?? 'doctor';
    const keyword = SPECIALTY_KEYWORD_MAP[specialty] ?? 'doctor specialist';

    const url = new URL(`${PLACES_BASE}/place/nearbysearch/json`);
    url.searchParams.set('location', `${lat},${lng}`);
    url.searchParams.set('radius', String(radius));
    url.searchParams.set('type', type);
    url.searchParams.set('keyword', keyword);
    url.searchParams.set('language', 'en');
    url.searchParams.set('key', apiKey);

    let data;
    try {
      data = await placeFetch(url.toString());
    } catch (err) {
      // Re-throw structured errors
      throw err;
    }

    // Handle Google-level status codes
    if (data.status === 'REQUEST_DENIED') {
      throw new HttpsError('permission-denied', 'Places API key error or quota exceeded.');
    }
    if (data.status === 'OVER_QUERY_LIMIT') {
      throw new HttpsError('resource-exhausted', 'Google Places API quota exceeded. Try again later.');
    }
    if (data.status === 'ZERO_RESULTS') {
      return { results: [], status: 'ZERO_RESULTS' };
    }
    if (!['OK', 'ZERO_RESULTS'].includes(data.status)) {
      throw new HttpsError('internal', `Unexpected Places API status: ${data.status}`);
    }
    if (!Array.isArray(data.results)) {
      throw new HttpsError('internal', 'Malformed response from Places API.');
    }

    const results = data.results
      .map(p => parsePlaceResult(p, lat, lng))
      .filter(Boolean)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 20);

    return { results, status: data.status };
  }
);

// ─────────────────────────────────────────────────────────
// CLOUD FUNCTION 2: placeDetails
// Called from frontend with: { placeId }
// Returns: phone, website, rating, hours, name
// ─────────────────────────────────────────────────────────
exports.placeDetails = onCall(
  { secrets: [PLACES_KEY], cors: true, enforceAppCheck: false },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'You must be logged in.');
    }

    const { placeId } = request.data;
    if (!placeId || typeof placeId !== 'string' || !placeId.startsWith('ChIJ')) {
      throw new HttpsError('invalid-argument', 'Invalid placeId format.');
    }

    const apiKey = PLACES_KEY.value();
    const fields = [
      'name',
      'formatted_phone_number',
      'international_phone_number',
      'formatted_address',
      'rating',
      'user_ratings_total',
      'website',
      'opening_hours',
      'types',
      'geometry',
    ].join(',');

    const url = new URL(`${PLACES_BASE}/place/details/json`);
    url.searchParams.set('place_id', placeId);
    url.searchParams.set('fields', fields);
    url.searchParams.set('language', 'en');
    url.searchParams.set('key', apiKey);

    const data = await placeFetch(url.toString());

    if (data.status === 'REQUEST_DENIED') {
      throw new HttpsError('permission-denied', 'Places API key error.');
    }
    if (data.status !== 'OK' || !data.result) {
      throw new HttpsError('not-found', 'Place details not found.');
    }

    const r = data.result;
    return {
      name:            r.name,
      phone:           r.formatted_phone_number || r.international_phone_number || '',
      internationalPhone: r.international_phone_number || r.formatted_phone_number || '',
      address:         r.formatted_address || '',
      rating:          r.rating ?? null,
      userRatings:     r.user_ratings_total ?? 0,
      website:         r.website || '',
      openNow:         r.opening_hours?.open_now ?? null,
      weekdayText:     r.opening_hours?.weekday_text ?? [],
      types:           r.types || [],
    };
  }
);
