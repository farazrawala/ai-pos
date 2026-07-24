import { GOOGLE_MAPS_API_KEY } from '../config/googleMaps.js';

const SCRIPT_ID = 'ai-pos-google-maps-js';

let loadPromise = null;

/**
 * Load Google Maps JS API (places + marker) once.
 * @returns {Promise<typeof google.maps>}
 */
export function loadGoogleMaps() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Maps is only available in the browser.'));
  }

  if (window.google?.maps?.places) {
    return Promise.resolve(window.google.maps);
  }

  if (!GOOGLE_MAPS_API_KEY) {
    return Promise.reject(
      new Error('Missing VITE_GOOGLE_MAPS_API_KEY. Add it to your .env and restart the dev server.')
    );
  }

  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      existing.addEventListener('load', () => {
        if (window.google?.maps) resolve(window.google.maps);
        else reject(new Error('Google Maps failed to load.'));
      });
      existing.addEventListener('error', () => reject(new Error('Google Maps failed to load.')));
      return;
    }

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      GOOGLE_MAPS_API_KEY
    )}&libraries=places`;
    script.onload = () => {
      if (window.google?.maps) resolve(window.google.maps);
      else reject(new Error('Google Maps failed to load.'));
    };
    script.onerror = () => {
      loadPromise = null;
      reject(new Error('Google Maps failed to load.'));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}
