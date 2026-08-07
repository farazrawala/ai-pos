import { useEffect, useMemo, useRef, useState } from 'react';
import { FaLocationDot, FaCircleCheck, FaTriangleExclamation } from 'react-icons/fa6';
import {
  validateOrderAddressRequest,
  updateOrderAddressRequest,
} from '../../features/orders/ordersAPI.js';
import {
  suggestAddressWithGoogle,
  attachPlacesAutocomplete,
} from '../../utils/googleAddressSuggest.js';
import NavIcon from '../NavIcon.jsx';
import './customerOrderHistoryModal.css';
import './validateOrderAddressModal.css';

const ADDRESS_PART_FIELDS = [
  { key: 'house', label: 'House' },
  { key: 'street', label: 'Street' },
  { key: 'area', label: 'Area' },
  { key: 'city', label: 'City' },
  { key: 'zip', label: 'ZIP' },
  { key: 'country', label: 'Country' },
];

/** OMS requires these parsed fields before an address can be saved. */
const REQUIRED_ADDRESS_FIELDS = ['house'];

const normalizeFieldKey = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

const fieldHasValue = (result, key) => {
  const raw = result?.[key];
  return raw != null && String(raw).trim() !== '' && String(raw).trim() !== '—';
};

const truthyFlag = (value) =>
  value === true || String(value ?? '').trim().toLowerCase() === 'true';

/**
 * Detect house / flat / plot / shop numbers from free-text address.
 * Examples: "Flat no 104", "House 12", "H# 5", "Plot 22", "Shop 3", "456 First Ave"
 */
export function extractHouseNumberFromAddress(addressText) {
  const text = String(addressText || '').trim();
  if (!text) return '';

  const patterns = [
    /\b(?:flat|flt|apartment|apt|appartment)\s*(?:no\.?|number|#)?\s*([A-Za-z0-9\-_/]+)/i,
    /\b(?:house|hous|h\.?)\s*(?:no\.?|number|#)?\s*([A-Za-z0-9\-_/]+)/i,
    /\b(?:plot|plt)\s*(?:no\.?|number|#)?\s*([A-Za-z0-9\-_/]+)/i,
    /\b(?:shop|office|unit|suite|block)\s*(?:no\.?|number|#)?\s*([A-Za-z0-9\-_/]+)/i,
    /\b(?:building|bldg)\s*(?:no\.?|number|#)?\s*([A-Za-z0-9\-_/]+)/i,
    /\bh\s*[#:-]?\s*([A-Za-z0-9\-_/]+)/i,
    /#\s*([A-Za-z0-9\-_/]+)/,
    // US-style leading street number: "456 First Ave"
    /^(\d+[A-Za-z]?)\s+[A-Za-z]/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match?.[1]) continue;
    const value = String(match[1]).replace(/[.,;]+$/g, '').trim();
    if (!value) continue;
    // Ignore tiny non-numeric tokens that are likely false positives
    if (!/[0-9]/.test(value)) continue;
    return value;
  }
  return '';
}

/** Light client parse of comma-separated address parts for display fallbacks. */
export function parseAddressPartsFromText(addressText) {
  const text = String(addressText || '').trim();
  if (!text) {
    return { house: '', street: '', area: '', city: '', zip: '', country: '' };
  }

  const house = extractHouseNumberFromAddress(text);
  const zipMatch = text.match(/\b(\d{5}(?:-\d{4})?)\b/);
  const zip = zipMatch ? zipMatch[1] : '';

  const segments = text
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  let street = '';
  let city = '';
  let country = '';

  if (segments.length >= 1) {
    street = segments[0].replace(/^\d+[A-Za-z]?\s+/, '').trim();
  }
  if (segments.length >= 2) {
    // "Seattle" or "Seattle WA"
    const citySeg = segments[1].replace(/\b[A-Z]{2}\b/g, '').replace(zip, '').trim();
    city = citySeg || segments[1].trim();
  }
  if (segments.length >= 3) {
    const last = segments[segments.length - 1];
    if (!/^\d{5}(?:-\d{4})?$/.test(last) && !/^[A-Z]{2}$/.test(last)) {
      country = last.replace(zip, '').trim();
    }
  }

  return { house, street, area: '', city, zip, country };
}

const getMissingRequiredFields = (result, apiMissingFields = [], addressText = '') => {
  const detectedHouse = extractHouseNumberFromAddress(addressText);
  const missingFromApi = new Set(
    (Array.isArray(apiMissingFields) ? apiMissingFields : [])
      .map((item) => normalizeFieldKey(item))
      .filter(Boolean)
  );

  return REQUIRED_ADDRESS_FIELDS.filter((key) => {
    if (key === 'house') {
      // Only accept a real extracted house/flat number — API hasHouseNumber
      // used to be true just because the ZIP had digits.
      if (fieldHasValue(result, 'house') || detectedHouse) return false;
      return true;
    }
    if (missingFromApi.has(key) || missingFromApi.has(`${key}_no`) || missingFromApi.has(`${key}_number`)) {
      return true;
    }
    return !fieldHasValue(result, key);
  });
};

/** Common shorthand / misspellings → preferred form (Pakistan addresses). */
const ADDRESS_TOKEN_REPLACEMENTS = [
  { from: ['kh', 'khi', 'khi.', 'kci'], to: 'Karachi', label: 'city' },
  { from: ['lhr', 'lh'], to: 'Lahore', label: 'city' },
  { from: ['isb', 'isl', 'isbd'], to: 'Islamabad', label: 'city' },
  { from: ['rwp', 'rwp.'], to: 'Rawalpindi', label: 'city' },
  { from: ['fsd'], to: 'Faisalabad', label: 'city' },
  { from: ['hyd', 'hyd.'], to: 'Hyderabad', label: 'city' },
  { from: ['mlt'], to: 'Multan', label: 'city' },
  { from: ['qta'], to: 'Quetta', label: 'city' },
  { from: ['psh', 'pesh'], to: 'Peshawar', label: 'city' },
  { from: ['swl'], to: 'Sialkot', label: 'city' },
  { from: ['guj'], to: 'Gujranwala', label: 'city' },
  { from: ['pk', 'pak', 'pak.'], to: 'Pakistan', label: 'country' },
];

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const pickValidationPayload = (result) => {
  if (!result || typeof result !== 'object') return {};
  const nested =
    result.data?.address_validation ||
    result.data?.validation ||
    result.data?.result ||
    result.validation ||
    result.result ||
    result.address_validation ||
    result.data;
  let merged = result;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    merged = { ...result, ...nested };
  }
  // Backend puts parsed hints under `details` (booleans + city/postalCode/country).
  const details =
    merged?.details && typeof merged.details === 'object' && !Array.isArray(merged.details)
      ? merged.details
      : null;
  if (details) {
    merged = {
      ...merged,
      city: merged.city ?? details.city ?? '',
      country: merged.country ?? details.country ?? '',
      zip:
        merged.zip ??
        merged.postalCode ??
        merged.postal_code ??
        details.postalCode ??
        details.postal_code ??
        '',
      hasHouseNumber: details.hasHouseNumber,
      hasStreet: details.hasStreet,
      hasArea: details.hasArea,
      hasCity: details.hasCity,
      hasPostalCode: details.hasPostalCode,
      hasCountry: details.hasCountry,
    };
  }
  return merged;
};

const asStringList = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (item == null) return '';
        if (typeof item === 'string') return item.trim();
        if (typeof item === 'object') {
          return String(item.message ?? item.text ?? item.suggestion ?? item.warning ?? '').trim();
        }
        return String(item).trim();
      })
      .filter(Boolean);
  }
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
};

const formatScore = (value) => {
  if (value == null || value === '') return '';
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  if (!Number.isFinite(n)) return String(value);
  if (n <= 1 && n >= 0) return `${Math.round(n * 100)}%`;
  return String(n);
};

/**
 * Detect shorthand like "kh" → Karachi and build a cleaned address suggestion.
 */
export function suggestAddressImprovements(addressText) {
  const original = String(addressText || '').trim();
  if (!original) {
    return { suggestions: [], suggestedAddress: '', replacements: [] };
  }

  let suggestedAddress = original;
  const replacements = [];
  const suggestions = [];

  for (const rule of ADDRESS_TOKEN_REPLACEMENTS) {
    for (const token of rule.from) {
      const pattern = new RegExp(`(^|[^A-Za-z0-9])(${escapeRegExp(token)})(?=[^A-Za-z0-9]|$)`, 'gi');
      if (!pattern.test(suggestedAddress)) continue;
      pattern.lastIndex = 0;
      suggestedAddress = suggestedAddress.replace(pattern, `$1${rule.to}`);
      replacements.push({ from: token, to: rule.to, label: rule.label });
      suggestions.push(
        `"${token}" looks like ${rule.to} — consider writing "${rule.to}" for clearer ${rule.label}.`
      );
      break;
    }
  }

  suggestedAddress = suggestedAddress
    .replace(/\s+/g, ' ')
    .replace(/\s+([,./])/g, '$1')
    .replace(/([,./])\s*/g, '$1 ')
    .replace(/\s+\./g, '.')
    .trim();

  if (suggestedAddress.toLowerCase() === original.toLowerCase()) {
    return { suggestions: [], suggestedAddress: original, replacements: [] };
  }

  return {
    suggestions: [...new Set(suggestions)],
    suggestedAddress,
    replacements,
  };
}

/**
 * Validate address modal + PATCH /order/update-address/:id on update.
 */
export default function ValidateOrderAddressModal({
  open,
  orderId = '',
  orderNo = '',
  address = '',
  name = '',
  phone = '',
  email = '',
  city = '',
  state = '',
  zip = '',
  country = '',
  onClose,
  onSaved,
}) {
  const [draftAddress, setDraftAddress] = useState('');
  const [validatedAddress, setValidatedAddress] = useState('');
  const [loadStatus, setLoadStatus] = useState('idle');
  const [saveStatus, setSaveStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [googleSuggestion, setGoogleSuggestion] = useState(null);
  const [googleStatus, setGoogleStatus] = useState('idle');
  const [googleError, setGoogleError] = useState('');
  const placesInputRef = useRef(null);

  const fetchGoogleSuggestion = async (addr) => {
    const text = String(addr || '').trim();
    if (!text) {
      setGoogleSuggestion(null);
      setGoogleStatus('idle');
      setGoogleError('');
      return null;
    }
    setGoogleStatus('loading');
    setGoogleError('');
    try {
      const suggestion = await suggestAddressWithGoogle(text, { region: 'pk' });
      setGoogleSuggestion(suggestion);
      setGoogleStatus(suggestion ? 'succeeded' : 'empty');
      return suggestion;
    } catch (err) {
      setGoogleSuggestion(null);
      setGoogleStatus('failed');
      setGoogleError(err?.message || 'Google suggestion failed');
      return null;
    }
  };

  const runValidation = async (addr, id) => {
    setLoadStatus('loading');
    setError(null);
    setResult(null);
    setValidatedAddress(addr);
    setGoogleSuggestion(null);
    setGoogleError('');

    const validatePromise = validateOrderAddressRequest({
      order_id: id,
      address: addr,
    });
    const googlePromise = fetchGoogleSuggestion(addr);

    try {
      const [res] = await Promise.all([validatePromise, googlePromise]);
      setResult(pickValidationPayload(res));
      setLoadStatus('succeeded');
    } catch (err) {
      setResult(null);
      setLoadStatus('failed');
      setError(err?.message || 'Failed to validate address');
    }
  };

  useEffect(() => {
    if (!open) return undefined;

    const initial = String(address || '').trim();
    const id = String(orderId || '').trim();
    setDraftAddress(initial);
    setValidatedAddress('');
    setResult(null);
    setError(null);
    setSaveStatus('idle');
    setGoogleSuggestion(null);
    setGoogleStatus('idle');
    setGoogleError('');

    if (!id && !initial) {
      setLoadStatus('failed');
      setError('Missing order id and address.');
      return undefined;
    }

    let cancelled = false;

    (async () => {
      setLoadStatus('loading');
      setValidatedAddress(initial);
      setGoogleSuggestion(null);
      setGoogleError('');

      const validatePromise = validateOrderAddressRequest({
        order_id: id,
        address: initial,
      }).catch((err) => {
        throw err;
      });
      const googlePromise = fetchGoogleSuggestion(initial);

      try {
        const [res] = await Promise.all([validatePromise, googlePromise]);
        if (cancelled) return;
        setResult(pickValidationPayload(res));
        setLoadStatus('succeeded');
      } catch (err) {
        if (cancelled) return;
        setResult(null);
        setLoadStatus('failed');
        setError(err?.message || 'Failed to validate address');
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open/orderId/address only
  }, [open, orderId, address]);

  useEffect(() => {
    if (!open) return undefined;
    const input = placesInputRef.current;
    if (!input) return undefined;

    let cleanup = () => {};
    let cancelled = false;

    attachPlacesAutocomplete(input, {
      country: ['pk'],
      onPlace: (mapped) => {
        if (cancelled || !mapped) return;
        setGoogleSuggestion(mapped);
        setGoogleStatus('succeeded');
        if (mapped.suggestedAddress) {
          setDraftAddress(mapped.suggestedAddress);
        }
      },
    })
      .then((fn) => {
        if (cancelled) {
          fn?.();
          return;
        }
        cleanup = fn || (() => {});
      })
      .catch(() => {
        /* Places optional — Geocoder still used on validate */
      });

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [open]);

  const runValidate = (addressOverride) => {
    const id = String(orderId || '').trim();
    const addr = String(addressOverride ?? draftAddress ?? '').trim();
    if (!id && !addr) {
      setResult(null);
      setLoadStatus('failed');
      setError('Missing order id and address.');
      return;
    }
    runValidation(addr, id);
  };

  const localImprovements = useMemo(
    () => suggestAddressImprovements(draftAddress),
    [draftAddress]
  );

  if (!open) return null;

  const title = orderNo || 'Order';
  const isSaving = saveStatus === 'loading';
  const isBusy = loadStatus === 'loading' || googleStatus === 'loading' || isSaving;
  const apiSaysValid =
    result?.isValid === true ||
    result?.is_valid === true ||
    String(result?.isValid ?? result?.is_valid ?? '').toLowerCase() === 'true';
  const score = result?.score ?? result?.Score;
  const confidence = result?.confidence ?? result?.Confidence;
  const warnings = asStringList(result?.warnings ?? result?.warning);
  const missingFields = asStringList(result?.missingFields ?? result?.missing_fields);
  const apiSuggestions = asStringList(result?.suggestions ?? result?.suggestion);

  const apiSuggestedAddress = String(
    result?.suggestedAddress ??
      result?.suggested_address ??
      result?.correctedAddress ??
      result?.corrected_address ??
      ''
  ).trim();

  const googleSuggestedAddress = String(googleSuggestion?.suggestedAddress || '').trim();

  // Prefer Google formatted address, then local shorthand, then API normalized text.
  const suggestedAddress = (() => {
    const draft = String(draftAddress || '').trim().toLowerCase();
    if (googleSuggestedAddress && googleSuggestedAddress.toLowerCase() !== draft) {
      return googleSuggestedAddress;
    }
    if (
      localImprovements.suggestedAddress &&
      localImprovements.suggestedAddress.trim().toLowerCase() !== draft
    ) {
      return localImprovements.suggestedAddress.trim();
    }
    if (apiSuggestedAddress && apiSuggestedAddress.toLowerCase() !== draft) {
      return apiSuggestedAddress;
    }
    return '';
  })();

  const suggestionSource = googleSuggestedAddress &&
    suggestedAddress.toLowerCase() === googleSuggestedAddress.toLowerCase()
      ? 'google'
      : suggestedAddress
        ? 'local'
        : '';

  const addressForHouseCheck = String(draftAddress || suggestedAddress || '').trim();
  const parsedParts = parseAddressPartsFromText(addressForHouseCheck);
  const detectedHouse = extractHouseNumberFromAddress(addressForHouseCheck);
  const googleHouse = String(googleSuggestion?.house || '').trim();
  const missingRequiredFields = getMissingRequiredFields(
    {
      ...(result || {}),
      house: googleHouse || result?.house,
    },
    missingFields,
    addressForHouseCheck
  );
  const houseMissing = missingRequiredFields.includes('house');
  // House number is mandatory — accept API house OR local detection (Flat no / House / Plot…).
  const isValid = !houseMissing && (apiSaysValid || Boolean(detectedHouse || googleHouse));

  const pickPart = (...candidates) => {
    for (const value of candidates) {
      if (value == null) continue;
      const text = String(value).trim();
      if (text && text !== '—') return text;
    }
    return '';
  };

  const displayResult = {
    ...(result || {}),
    house: pickPart(googleSuggestion?.house, result?.house, detectedHouse, parsedParts.house),
    street: pickPart(
      googleSuggestion?.street,
      result?.street,
      parsedParts.street,
      truthyFlag(result?.hasStreet) || truthyFlag(result?.details?.hasStreet) ? 'Detected' : ''
    ),
    area: pickPart(
      googleSuggestion?.area,
      result?.area,
      parsedParts.area,
      truthyFlag(result?.hasArea) || truthyFlag(result?.details?.hasArea) ? 'Detected' : ''
    ),
    city: pickPart(
      googleSuggestion?.city,
      result?.city,
      result?.details?.city,
      city,
      parsedParts.city
    ),
    zip: pickPart(
      googleSuggestion?.zip,
      result?.zip,
      result?.postalCode,
      result?.postal_code,
      result?.details?.postalCode,
      zip,
      parsedParts.zip
    ),
    country: pickPart(
      googleSuggestion?.country,
      result?.country,
      result?.details?.country,
      country,
      parsedParts.country
    ),
  };
  const visibleWarnings = houseMissing
    ? warnings
    : warnings.filter((item) => !/house|building\s*number|flat/i.test(String(item || '')));
  const visibleMissingFields = houseMissing
    ? missingFields
    : missingFields.filter((item) => {
        const key = normalizeFieldKey(item);
        return key !== 'house' && key !== 'house_no' && key !== 'house_number';
      });
  const requiredSuggestions = missingRequiredFields.map((key) => {
    if (key === 'house') {
      return 'House / building number is required (e.g. Flat no 104, House 12). Add it before updating.';
    }
    return `${key.replace(/_/g, ' ')} is required before this address can be saved.`;
  });
  const allSuggestions = [
    ...new Set([
      ...requiredSuggestions,
      ...localImprovements.suggestions,
      ...(houseMissing
        ? apiSuggestions
        : apiSuggestions.filter(
            (item) => !/house|building\s*number|include your house/i.test(String(item || ''))
          )),
    ]),
  ];

  const canSaveAddress =
    Boolean(String(orderId || '').trim() && String(draftAddress || '').trim()) &&
    missingRequiredFields.length === 0;
  const canUpdateAddress = canSaveAddress;
  const updateBlockedReason = houseMissing
    ? 'House / building number is required before this address can be updated.'
    : missingRequiredFields.length
      ? `Missing required fields: ${missingRequiredFields.join(', ')}.`
      : '';

  const buildStreetAddress = (sourceAddress, validation) => {
    const fromParts = [validation?.house, validation?.street, validation?.area]
      .map((part) => String(part ?? '').trim())
      .filter(Boolean)
      .join(', ');
    if (fromParts) return fromParts;
    return String(sourceAddress || '').trim();
  };

  const buildUpdatePayload = (sourceAddress, preferFullText = false) => {
    const validation = displayResult || result || {};
    const nextAddress = preferFullText
      ? String(sourceAddress || '').trim()
      : buildStreetAddress(sourceAddress, validation) || String(sourceAddress || '').trim();
    return {
      address: nextAddress,
      city: String(
        googleSuggestion?.city || validation.city || city || ''
      ).trim(),
      state: String(
        googleSuggestion?.state || validation.state || state || ''
      ).trim(),
      zip: String(googleSuggestion?.zip || validation.zip || zip || '').trim(),
      country: String(
        googleSuggestion?.country || validation.country || country || ''
      ).trim(),
      name: String(name || '').trim(),
      phone: String(phone || '').trim(),
      email: String(email || '').trim(),
      validate: true,
    };
  };

  const handleUpdateAddress = async ({ addressOverride = '', preferFullText = false } = {}) => {
    const id = String(orderId || '').trim();
    if (!id) {
      setError('Missing order id.');
      return;
    }

    const sourceAddress = String(addressOverride || draftAddress || '').trim();
    if (!sourceAddress) {
      setError('Address is required to update.');
      return;
    }

    if (missingRequiredFields.length > 0) {
      setError(
        houseMissing
          ? 'House / building number is required. Add it to the address, then re-validate before updating.'
          : `Missing required fields: ${missingRequiredFields.join(', ')}.`
      );
      return;
    }

    setSaveStatus('loading');
    setError(null);

    try {
      if (addressOverride) setDraftAddress(addressOverride);
      const payload = buildUpdatePayload(sourceAddress, preferFullText || Boolean(addressOverride));
      const saved = await updateOrderAddressRequest(id, payload);
      const quality = pickValidationPayload(saved);
      if (quality && (quality.house != null || quality.isValid != null || quality.is_valid != null)) {
        setResult((prev) => ({ ...(prev || {}), ...quality }));
      }
      setDraftAddress(payload.address);
      setValidatedAddress(payload.address);
      setSaveStatus('succeeded');
      onSaved?.({
        orderId: id,
        orderNo,
        address: payload.address,
        city: payload.city,
        state: payload.state,
        zip: payload.zip,
        country: payload.country,
        result: saved,
      });
      onClose?.();
    } catch (err) {
      setSaveStatus('failed');
      setError(err?.message || 'Failed to update address');
    }
  };

  const handleUpdateSuggestion = () => {
    if (!suggestedAddress) return;
    handleUpdateAddress({ addressOverride: suggestedAddress, preferFullText: true });
  };

  const handleApplySuggestion = () => {
    if (!suggestedAddress) return;
    setDraftAddress(suggestedAddress);
    runValidate(suggestedAddress);
  };

  const draftDiffersFromSuggestion =
    Boolean(suggestedAddress) &&
    suggestedAddress.toLowerCase() !== String(draftAddress || '').trim().toLowerCase();

  const primarySaveUsesSuggestion = draftDiffersFromSuggestion && canSaveAddress;
  const missingLabels = [
    ...(houseMissing ? ['House / flat no.'] : []),
    ...visibleMissingFields.map((item) => String(item).replace(/_/g, ' ')),
  ];

  return (
    <>
      <div
        className="modal fade show"
        style={{ display: 'block' }}
        tabIndex={-1}
        role="dialog"
        aria-labelledby="validateOrderAddressModalLabel"
        aria-modal="true"
      >
        <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
          <div className="modal-content coh-modal">
            <div className="modal-header coh-modal__header border-0 pb-0">
              <div className="d-flex align-items-start gap-3 min-width-0">
                <div className="coh-modal__icon" aria-hidden="true">
                  <NavIcon icon={FaLocationDot} size={16} />
                </div>
                <div className="min-width-0">
                  <p className="coh-modal__eyebrow mb-1">Validate address</p>
                  <h5
                    className="modal-title coh-modal__title mb-0 text-truncate"
                    id="validateOrderAddressModalLabel"
                    title={title}
                  >
                    {title}
                  </h5>
                </div>
              </div>
              <button
                type="button"
                className="btn-close"
                aria-label="Close"
                onClick={onClose}
                disabled={isBusy}
              />
            </div>

            <div className="modal-body coh-modal__body pt-3">
              <div className="voa-layout">
                <div className="voa-block">
                  <label className="voa-block__label" htmlFor="voa-places-search">
                    Search place
                  </label>
                  <input
                    ref={placesInputRef}
                    id="voa-places-search"
                    type="text"
                    className="form-control form-control-sm voa-places-input"
                    placeholder="Search Google Places…"
                    disabled={isBusy}
                    autoComplete="off"
                  />
                </div>

                <div className="voa-block">
                  <label className="voa-block__label" htmlFor="voa-address-input">
                    Delivery address
                  </label>
                  <textarea
                    id="voa-address-input"
                    className="form-control form-control-sm voa-address-input"
                    rows={3}
                    value={draftAddress}
                    onChange={(e) => setDraftAddress(e.target.value)}
                    placeholder="House / flat no., street, area, city…"
                    disabled={isBusy}
                  />
                  <div className="voa-toolbar">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary mb-0"
                      onClick={() => runValidate()}
                      disabled={isBusy || (!orderId && !String(draftAddress).trim())}
                    >
                      {loadStatus === 'loading' || googleStatus === 'loading'
                        ? 'Checking…'
                        : 'Check address'}
                    </button>
                    {googleSuggestedAddress && draftDiffersFromSuggestion ? (
                      <button
                        type="button"
                        className="btn btn-sm btn-link text-primary mb-0 px-1"
                        onClick={handleApplySuggestion}
                        disabled={isBusy}
                      >
                        Use suggestion
                      </button>
                    ) : null}
                  </div>
                </div>

                {error ? <div className="alert alert-danger py-2 mb-0">{error}</div> : null}

                {loadStatus === 'loading' ? (
                  <div className="coh-modal__state text-center text-muted py-3">
                    <span className="spinner-border spinner-border-sm me-2" role="status" />
                    Checking address…
                  </div>
                ) : null}

                {loadStatus === 'succeeded' && result ? (
                  <>
                    <div className="voa-status" aria-live="polite">
                      <span
                        className={`voa-status__pill ${
                          isValid
                            ? 'voa-status__pill--ok'
                            : houseMissing
                              ? 'voa-status__pill--warn'
                              : 'voa-status__pill--bad'
                        }`}
                      >
                        <NavIcon
                          icon={isValid ? FaCircleCheck : FaTriangleExclamation}
                          size={11}
                        />
                        {isValid ? 'Ready to save' : houseMissing ? 'House no. needed' : 'Needs review'}
                      </span>
                      {score != null && score !== '' ? (
                        <span className="voa-status__pill">Score {formatScore(score)}</span>
                      ) : null}
                      {confidence != null && confidence !== '' ? (
                        <span className="voa-status__pill">
                          {formatScore(confidence)} confidence
                        </span>
                      ) : null}
                      {googleStatus === 'succeeded' && googleSuggestedAddress ? (
                        <span className="voa-status__pill">Google matched</span>
                      ) : null}
                    </div>

                    {suggestedAddress && draftDiffersFromSuggestion ? (
                      <div className="voa-card voa-card--suggest">
                        <div className="voa-card__top">
                          <div className="min-width-0 flex-grow-1">
                            <p className="voa-card__eyebrow">
                              {suggestionSource === 'google'
                                ? 'Google suggestion'
                                : 'Suggested address'}
                            </p>
                            <p className="voa-card__text">{suggestedAddress}</p>
                            {suggestionSource === 'google' &&
                            (googleSuggestion?.city ||
                              googleSuggestion?.zip ||
                              googleSuggestion?.house) ? (
                              <p className="voa-card__meta">
                                {[
                                  googleSuggestion.house
                                    ? `House ${googleSuggestion.house}`
                                    : '',
                                  googleSuggestion.street,
                                  googleSuggestion.area,
                                  googleSuggestion.city,
                                  googleSuggestion.zip,
                                  googleSuggestion.country,
                                ]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </p>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary mb-0 flex-shrink-0"
                            onClick={handleApplySuggestion}
                            disabled={isBusy}
                            title="Replace the address field with this suggestion"
                          >
                            Use suggestion
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {houseMissing ? (
                      <p className="voa-note">
                        Add a house or flat number (e.g. <strong>Flat no 104</strong> or{' '}
                        <strong>House 12</strong>), then check the address again before saving.
                      </p>
                    ) : null}

                    {googleStatus === 'failed' && googleError ? (
                      <p className="voa-note">
                        Google suggestion unavailable. Local checks still apply.
                      </p>
                    ) : null}

                    <div className="voa-block">
                      <p className="voa-block__label mb-2">Parsed fields</p>
                      <div className="voa-fields">
                        {ADDRESS_PART_FIELDS.map((field) => {
                          const value = displayResult?.[field.key];
                          const display =
                            value != null && String(value).trim() !== ''
                              ? String(value).trim()
                              : '';
                          const isMissing =
                            (field.key === 'house' && houseMissing) ||
                            visibleMissingFields.some(
                              (item) => normalizeFieldKey(item) === field.key
                            );
                          return (
                            <div
                              key={field.key}
                              className={`voa-field${isMissing ? ' voa-field--missing' : ''}`}
                            >
                              <span className="voa-field__label">{field.label}</span>
                              <span
                                className={`voa-field__value${
                                  display ? '' : ' voa-field__value--empty'
                                }`}
                              >
                                {display || '—'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {visibleWarnings.length > 0 ||
                    (allSuggestions.length > 0 && !houseMissing) ? (
                      <details className="voa-details">
                        <summary>
                          More details
                          {visibleWarnings.length
                            ? ` · ${visibleWarnings.length} warning${
                                visibleWarnings.length === 1 ? '' : 's'
                              }`
                            : ''}
                        </summary>
                        <div className="voa-details__body">
                          {visibleWarnings.length > 0 ? (
                            <ul className="voa-list mb-2">
                              {visibleWarnings.map((item) => (
                                <li key={item}>{item}</li>
                              ))}
                            </ul>
                          ) : null}
                          {allSuggestions.length > 0 && !houseMissing ? (
                            <ul className="voa-list mb-0">
                              {allSuggestions
                                .filter((item) => !requiredSuggestions.includes(item))
                                .map((item) => (
                                  <li key={item}>{item}</li>
                                ))}
                            </ul>
                          ) : null}
                        </div>
                      </details>
                    ) : null}
                  </>
                ) : null}
              </div>
            </div>

            <div className="modal-footer coh-modal__footer voa-footer border-0 pt-0">
              {!canSaveAddress && updateBlockedReason ? (
                <p className="voa-footer-hint mb-0">{updateBlockedReason}</p>
              ) : missingLabels.length > 0 ? (
                <p className="voa-footer-hint mb-0">
                  Still needed: {missingLabels.join(', ')}
                </p>
              ) : (
                <p className="voa-footer-hint mb-0" />
              )}
              <button
                type="button"
                className="btn btn-outline-secondary mb-0"
                onClick={onClose}
                disabled={isBusy}
              >
                Cancel
              </button>
              {primarySaveUsesSuggestion ? (
                <button
                  type="button"
                  className="btn btn-primary mb-0"
                  onClick={handleUpdateSuggestion}
                  disabled={isBusy || !orderId}
                  title="Save the suggested address to this order"
                >
                  {isSaving ? 'Saving…' : 'Save suggested address'}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary mb-0"
                  onClick={() => handleUpdateAddress()}
                  disabled={isBusy || !canUpdateAddress}
                  title={updateBlockedReason || 'Save address to this order'}
                >
                  {isSaving ? 'Saving…' : 'Save address'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>
  );
}
