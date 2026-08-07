import { loadGoogleMaps } from './loadGoogleMaps.js';

const componentLong = (components, ...types) => {
  if (!Array.isArray(components)) return '';
  for (const type of types) {
    const hit = components.find((c) => Array.isArray(c.types) && c.types.includes(type));
    if (hit?.long_name) return String(hit.long_name).trim();
  }
  return '';
};

const componentShort = (components, ...types) => {
  if (!Array.isArray(components)) return '';
  for (const type of types) {
    const hit = components.find((c) => Array.isArray(c.types) && c.types.includes(type));
    if (hit?.short_name) return String(hit.short_name).trim();
  }
  return '';
};

/**
 * Map Google Geocoder / Place result → structured address suggestion.
 */
export function mapGoogleAddressResult(result) {
  if (!result || typeof result !== 'object') return null;

  const components = result.address_components || result.addressComponents || [];
  const formatted = String(
    result.formatted_address || result.formattedAddress || result.name || ''
  ).trim();
  if (!formatted && !components.length) return null;

  const house = componentLong(components, 'street_number', 'premise', 'subpremise');
  const street = componentLong(components, 'route', 'street_address');
  const area = componentLong(
    components,
    'sublocality_level_1',
    'sublocality',
    'neighborhood',
    'administrative_area_level_3',
    'administrative_area_level_2'
  );
  const city = componentLong(
    components,
    'locality',
    'postal_town',
    'administrative_area_level_2'
  );
  const state = componentLong(components, 'administrative_area_level_1');
  const zip = componentLong(components, 'postal_code');
  const country =
    componentLong(components, 'country') || componentShort(components, 'country');

  const loc = result.geometry?.location;
  const lat =
    loc && typeof loc.lat === 'function'
      ? loc.lat()
      : loc?.lat != null
        ? Number(loc.lat)
        : null;
  const lng =
    loc && typeof loc.lng === 'function'
      ? loc.lng()
      : loc?.lng != null
        ? Number(loc.lng)
        : null;

  return {
    source: 'google',
    suggestedAddress: formatted,
    house,
    street,
    area,
    city,
    state,
    zip,
    country,
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    placeId: result.place_id || result.placeId || '',
  };
}

/**
 * Geocode free-text address via Google Maps Geocoder.
 * Returns best match or null (never throws for "not found").
 */
export async function suggestAddressWithGoogle(addressText, options = {}) {
  const address = String(addressText || '').trim();
  if (!address) return null;

  const maps = await loadGoogleMaps();
  const geocoder = new maps.Geocoder();
  const request = { address };
  if (options.region) request.region = options.region;
  if (options.componentRestrictions) {
    request.componentRestrictions = options.componentRestrictions;
  }

  const response = await new Promise((resolve, reject) => {
    geocoder.geocode(request, (results, status) => {
      if (status === 'OK' && Array.isArray(results) && results.length) {
        resolve(results);
        return;
      }
      if (status === 'ZERO_RESULTS') {
        resolve([]);
        return;
      }
      reject(new Error(`Google Geocoder failed: ${status}`));
    });
  });

  if (!response.length) return null;
  return mapGoogleAddressResult(response[0]);
}

/**
 * Attach Places Autocomplete to an input. Returns a cleanup function.
 */
export async function attachPlacesAutocomplete(inputEl, { onPlace, country } = {}) {
  if (!inputEl) return () => {};

  const maps = await loadGoogleMaps();
  const opts = {
    fields: ['formatted_address', 'address_components', 'geometry', 'place_id', 'name'],
  };
  if (country) {
    opts.componentRestrictions = {
      country: Array.isArray(country) ? country : [country],
    };
  }

  const autocomplete = new maps.places.Autocomplete(inputEl, opts);
  const listener = autocomplete.addListener('place_changed', () => {
    const place = autocomplete.getPlace();
    const mapped = mapGoogleAddressResult(place);
    if (mapped) onPlace?.(mapped, place);
  });

  return () => {
    if (listener && maps.event) maps.event.removeListener(listener);
    if (maps.event) maps.event.clearInstanceListeners(autocomplete);
  };
}
