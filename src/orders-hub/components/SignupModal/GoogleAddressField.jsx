import { useEffect, useId, useRef, useState } from 'react';

const SCRIPT_ID = 'orders-hub-google-maps-js';
const API_KEY = String(import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();

let mapsPromise = null;

function loadMaps() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Maps only available in the browser.'));
  }
  if (window.google?.maps?.places) return Promise.resolve(window.google.maps);
  if (!API_KEY) {
    return Promise.reject(new Error('Missing VITE_GOOGLE_MAPS_API_KEY'));
  }
  if (mapsPromise) return mapsPromise;

  mapsPromise = new Promise((resolve, reject) => {
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
      API_KEY
    )}&libraries=places`;
    script.onload = () => {
      if (window.google?.maps) resolve(window.google.maps);
      else reject(new Error('Google Maps failed to load.'));
    };
    script.onerror = () => {
      mapsPromise = null;
      reject(new Error('Google Maps failed to load.'));
    };
    document.head.appendChild(script);
  });

  return mapsPromise;
}

function toCoord(value) {
  if (value == null || value === '') return '';
  const n = typeof value === 'number' ? value : parseFloat(String(value).trim());
  return Number.isFinite(n) ? String(n) : '';
}

/**
 * Places autocomplete that fills google_address + lat/lng.
 */
export default function GoogleAddressField({
  googleAddress = '',
  latitude = '',
  longitude = '',
  onChange,
  disabled = false,
}) {
  const inputId = useId();
  const inputRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const [status, setStatus] = useState(API_KEY ? 'loading' : 'missing_key');
  const [localAddress, setLocalAddress] = useState(googleAddress || '');

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    setLocalAddress(googleAddress || '');
  }, [googleAddress]);

  useEffect(() => {
    if (!API_KEY || disabled) return undefined;
    let cancelled = false;
    let autocomplete;

    loadMaps()
      .then((maps) => {
        if (cancelled || !inputRef.current) return;
        autocomplete = new maps.places.Autocomplete(inputRef.current, {
          fields: ['formatted_address', 'geometry', 'name'],
        });
        autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          const loc = place?.geometry?.location;
          const formatted = String(place?.formatted_address || place?.name || '').trim();
          const lat = loc ? (typeof loc.lat === 'function' ? loc.lat() : Number(loc.lat)) : null;
          const lng = loc ? (typeof loc.lng === 'function' ? loc.lng() : Number(loc.lng)) : null;
          const next = {
            google_address: formatted,
            address_latitude: toCoord(lat),
            address_longitude: toCoord(lng),
          };
          setLocalAddress(next.google_address);
          onChangeRef.current?.(next);
        });
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });

    return () => {
      cancelled = true;
      if (autocomplete && window.google?.maps?.event) {
        window.google.maps.event.clearInstanceListeners(autocomplete);
      }
    };
  }, [disabled]);

  const handleInput = (event) => {
    const value = event.target.value;
    setLocalAddress(value);
    onChangeRef.current?.({
      google_address: value,
      address_latitude: toCoord(latitude),
      address_longitude: toCoord(longitude),
    });
  };

  return (
    <div className="oh-signup__map">
      <div className="oh-signup__map-head">
        <label htmlFor={inputId}>Map location</label>
        <p className="oh-signup__hint">Optional. Search and select a place to pin coordinates.</p>
      </div>
      <input
        ref={inputRef}
        id={inputId}
        type="text"
        value={localAddress}
        onChange={handleInput}
        disabled={disabled || status === 'missing_key'}
        placeholder={
          status === 'missing_key'
            ? 'Maps search unavailable'
            : 'Search for a place'
        }
        autoComplete="off"
      />
      {/* Captured from Places selection; hidden but still submitted with the form */}
      <input type="hidden" name="address_latitude" value={latitude || ''} readOnly />
      <input type="hidden" name="address_longitude" value={longitude || ''} readOnly />
    </div>
  );
}
