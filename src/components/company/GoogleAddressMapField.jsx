import { useEffect, useId, useRef, useState } from 'react';
import { GOOGLE_MAPS_API_KEY } from '../../config/googleMaps.js';
import { loadGoogleMaps } from '../../utils/loadGoogleMaps.js';

const DEFAULT_CENTER = { lat: 30.3753, lng: 69.3451 }; // Pakistan
const DEFAULT_ZOOM = 5;
const PINNED_ZOOM = 15;

const toCoordString = (value) => {
  if (value == null || value === '') return '';
  const n = typeof value === 'number' ? value : parseFloat(String(value).trim());
  return Number.isFinite(n) ? String(n) : '';
};

const parseCoord = (value) => {
  const n = typeof value === 'number' ? value : parseFloat(String(value ?? '').trim());
  return Number.isFinite(n) ? n : null;
};

/**
 * Google Places search + map pin for company location.
 * On address select: fills google_address + address_latitude + address_longitude.
 */
export default function GoogleAddressMapField({
  googleAddress = '',
  latitude = '',
  longitude = '',
  onChange,
  disabled = false,
}) {
  const inputId = useId();
  const mapId = useId();
  const inputRef = useRef(null);
  const mapElRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const autocompleteRef = useRef(null);
  const geocoderRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const suppressInputSyncRef = useRef(false);
  const [status, setStatus] = useState(GOOGLE_MAPS_API_KEY ? 'loading' : 'missing_key');
  const [error, setError] = useState('');
  const [localAddress, setLocalAddress] = useState(googleAddress || '');

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (suppressInputSyncRef.current) {
      suppressInputSyncRef.current = false;
      return;
    }
    setLocalAddress(googleAddress || '');
  }, [googleAddress]);

  const emitLocation = (payload) => {
    const next = {
      google_address: String(payload.google_address ?? '').trim(),
      address_latitude: toCoordString(payload.address_latitude),
      address_longitude: toCoordString(payload.address_longitude),
    };
    suppressInputSyncRef.current = true;
    setLocalAddress(next.google_address);
    onChangeRef.current?.(next);
  };

  const setMarkerPosition = (lat, lng, { pan = true, zoom } = {}) => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;
    const pos = { lat, lng };
    marker.setPosition(pos);
    if (pan) map.panTo(pos);
    if (zoom != null) map.setZoom(zoom);
  };

  const applyPlaceSelection = (place, fallbackAddress = '') => {
    const address =
      place?.formatted_address ||
      place?.name ||
      fallbackAddress ||
      inputRef.current?.value ||
      '';
    const loc = place?.geometry?.location;

    if (loc) {
      const nextLat = typeof loc.lat === 'function' ? loc.lat() : Number(loc.lat);
      const nextLng = typeof loc.lng === 'function' ? loc.lng() : Number(loc.lng);
      if (Number.isFinite(nextLat) && Number.isFinite(nextLng)) {
        setMarkerPosition(nextLat, nextLng, { zoom: PINNED_ZOOM });
        emitLocation({
          google_address: address,
          address_latitude: nextLat,
          address_longitude: nextLng,
        });
        return;
      }
    }

    // Fallback: geocode the selected text so lat/lng always populate.
    const geocoder = geocoderRef.current;
    const query = String(address || '').trim();
    if (!geocoder || !query) {
      emitLocation({
        google_address: query,
        address_latitude: '',
        address_longitude: '',
      });
      return;
    }

    geocoder.geocode({ address: query }, (results, geoStatus) => {
      if (geoStatus === 'OK' && results?.[0]?.geometry?.location) {
        const result = results[0];
        const nextLat = result.geometry.location.lat();
        const nextLng = result.geometry.location.lng();
        const formatted = result.formatted_address || query;
        setMarkerPosition(nextLat, nextLng, { zoom: PINNED_ZOOM });
        emitLocation({
          google_address: formatted,
          address_latitude: nextLat,
          address_longitude: nextLng,
        });
        return;
      }
      emitLocation({
        google_address: query,
        address_latitude: '',
        address_longitude: '',
      });
    });
  };

  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) return undefined;

    let cancelled = false;
    let placeListener = null;
    let clickListener = null;
    let dragListener = null;

    const reverseGeocode = (lat, lng) => {
      const geocoder = geocoderRef.current;
      if (!geocoder) {
        emitLocation({
          google_address: inputRef.current?.value || '',
          address_latitude: lat,
          address_longitude: lng,
        });
        return;
      }
      geocoder.geocode({ location: { lat, lng } }, (results, geoStatus) => {
        if (cancelled) return;
        const formatted =
          geoStatus === 'OK' && results?.[0]?.formatted_address
            ? results[0].formatted_address
            : inputRef.current?.value || '';
        setMarkerPosition(lat, lng);
        emitLocation({
          google_address: formatted,
          address_latitude: lat,
          address_longitude: lng,
        });
      });
    };

    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !mapElRef.current || !inputRef.current) return;

        const lat = parseCoord(latitude);
        const lng = parseCoord(longitude);
        const hasPin = lat != null && lng != null;
        const center = hasPin ? { lat, lng } : DEFAULT_CENTER;

        const map = new maps.Map(mapElRef.current, {
          center,
          zoom: hasPin ? PINNED_ZOOM : DEFAULT_ZOOM,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          zoomControl: true,
        });
        mapRef.current = map;

        const marker = new maps.Marker({
          map,
          position: center,
          draggable: !disabled,
          title: 'Company location',
        });
        markerRef.current = marker;
        geocoderRef.current = new maps.Geocoder();

        const autocomplete = new maps.places.Autocomplete(inputRef.current, {
          fields: ['formatted_address', 'geometry', 'name', 'place_id'],
        });
        autocomplete.bindTo('bounds', map);
        autocompleteRef.current = autocomplete;

        placeListener = autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          applyPlaceSelection(place, inputRef.current?.value || '');
        });

        clickListener = map.addListener('click', (event) => {
          if (disabled || !event?.latLng) return;
          reverseGeocode(event.latLng.lat(), event.latLng.lng());
        });

        dragListener = marker.addListener('dragend', (event) => {
          if (disabled || !event?.latLng) return;
          reverseGeocode(event.latLng.lat(), event.latLng.lng());
        });

        setStatus('ready');
        setError('');
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus('error');
        setError(err?.message || 'Failed to load Google Maps.');
      });

    return () => {
      cancelled = true;
      if (placeListener) placeListener.remove();
      if (clickListener) clickListener.remove();
      if (dragListener) dragListener.remove();
      if (window.google?.maps?.event && inputRef.current) {
        window.google.maps.event.clearInstanceListeners(inputRef.current);
      }
      autocompleteRef.current = null;
      markerRef.current = null;
      mapRef.current = null;
      geocoderRef.current = null;
    };
    // Init once; coords sync via separate effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled]);

  useEffect(() => {
    if (status !== 'ready') return;
    const lat = parseCoord(latitude);
    const lng = parseCoord(longitude);
    if (lat == null || lng == null || !markerRef.current || !mapRef.current) return;
    const current = markerRef.current.getPosition();
    if (
      current &&
      Math.abs(current.lat() - lat) < 1e-7 &&
      Math.abs(current.lng() - lng) < 1e-7
    ) {
      return;
    }
    setMarkerPosition(lat, lng, {
      zoom: mapRef.current.getZoom() < 12 ? PINNED_ZOOM : undefined,
    });
  }, [latitude, longitude, status]);

  useEffect(() => {
    if (!markerRef.current) return;
    markerRef.current.setDraggable(!disabled);
  }, [disabled]);

  const handleManualAddressChange = (e) => {
    const value = e.target.value;
    setLocalAddress(value);
    // Typing only updates address text; lat/lng fill when a suggestion is selected.
    onChangeRef.current?.({
      google_address: value,
      address_latitude: toCoordString(latitude),
      address_longitude: toCoordString(longitude),
    });
  };

  if (status === 'missing_key') {
    return (
      <div className="company-google-map-field">
        <label className="company-label d-block" htmlFor={inputId}>
          Google Address
        </label>
        <input
          id={inputId}
          type="text"
          className="form-control company-control"
          value={localAddress}
          onChange={handleManualAddressChange}
          disabled={disabled}
          placeholder="Set VITE_GOOGLE_MAPS_API_KEY to enable map search"
        />
        <p className="text-xs text-muted mt-2 mb-0">
          Add <code>VITE_GOOGLE_MAPS_API_KEY</code> to your env file to enable Places search and map
          pin. Latitude and longitude are saved automatically when a location is set.
        </p>
      </div>
    );
  }

  return (
    <div className="company-google-map-field">
      <label className="company-label d-block" htmlFor={inputId}>
        Google Address
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="text"
        className="form-control company-control"
        value={localAddress}
        onChange={handleManualAddressChange}
        disabled={disabled || status === 'loading'}
        placeholder="Search and select an address…"
        autoComplete="off"
      />

      <div
        ref={mapElRef}
        id={mapId}
        className="company-google-map mt-3"
        role="presentation"
        aria-label="Company location map"
      />

      {status === 'loading' ? (
        <p className="text-xs text-muted mt-2 mb-0">Loading Google Maps…</p>
      ) : null}
      {status === 'error' && error ? (
        <div className="alert alert-warning py-2 mt-2 mb-0">{error}</div>
      ) : null}
      {status === 'ready' ? (
        <p className="text-xs text-muted mt-2 mb-0">
          Select a suggestion to set the location. You can also click or drag the pin on the map.
        </p>
      ) : null}
    </div>
  );
}
