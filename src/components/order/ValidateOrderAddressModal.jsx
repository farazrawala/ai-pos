import { useEffect, useMemo, useState } from 'react';
import { FaLocationDot, FaCircleCheck, FaTriangleExclamation } from 'react-icons/fa6';
import {
  validateOrderAddressRequest,
  updateOrderAddressRequest,
} from '../../features/orders/ordersAPI.js';
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

/**
 * Detect house / flat / plot / shop numbers from free-text address.
 * Examples: "Flat no 104", "House 12", "H# 5", "Plot 22", "Shop 3"
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

const getMissingRequiredFields = (result, apiMissingFields = [], addressText = '') => {
  const detectedHouse = extractHouseNumberFromAddress(addressText);
  const missingFromApi = new Set(
    (Array.isArray(apiMissingFields) ? apiMissingFields : [])
      .map((item) => normalizeFieldKey(item))
      .filter(Boolean)
  );

  return REQUIRED_ADDRESS_FIELDS.filter((key) => {
    if (key === 'house') {
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
    result.data?.validation ||
    result.data?.result ||
    result.data?.address ||
    result.validation ||
    result.result ||
    result.data;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return { ...result, ...nested };
  }
  return result;
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

  useEffect(() => {
    if (!open) return undefined;

    const initial = String(address || '').trim();
    const id = String(orderId || '').trim();
    setDraftAddress(initial);
    setValidatedAddress('');
    setResult(null);
    setError(null);
    setSaveStatus('idle');

    if (!id && !initial) {
      setLoadStatus('failed');
      setError('Missing order id and address.');
      return undefined;
    }

    let cancelled = false;
    setLoadStatus('loading');
    setValidatedAddress(initial);

    validateOrderAddressRequest({ order_id: id, address: initial })
      .then((res) => {
        if (cancelled) return;
        setResult(pickValidationPayload(res));
        setLoadStatus('succeeded');
      })
      .catch((err) => {
        if (cancelled) return;
        setResult(null);
        setLoadStatus('failed');
        setError(err?.message || 'Failed to validate address');
      });

    return () => {
      cancelled = true;
    };
  }, [open, orderId, address]);

  const runValidate = (addressOverride) => {
    const id = String(orderId || '').trim();
    const addr = String(addressOverride ?? draftAddress ?? '').trim();
    if (!id && !addr) {
      setResult(null);
      setLoadStatus('failed');
      setError('Missing order id and address.');
      return;
    }

    setLoadStatus('loading');
    setError(null);
    setResult(null);
    setValidatedAddress(addr);

    validateOrderAddressRequest({ order_id: id, address: addr })
      .then((res) => {
        setResult(pickValidationPayload(res));
        setLoadStatus('succeeded');
      })
      .catch((err) => {
        setResult(null);
        setLoadStatus('failed');
        setError(err?.message || 'Failed to validate address');
      });
  };

  const localImprovements = useMemo(
    () => suggestAddressImprovements(draftAddress),
    [draftAddress]
  );

  if (!open) return null;

  const title = orderNo || 'Order';
  const isSaving = saveStatus === 'loading';
  const isBusy = loadStatus === 'loading' || isSaving;
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
      result?.normalizedAddress ??
      result?.normalized_address ??
      ''
  ).trim();

  const suggestedAddress =
    localImprovements.suggestedAddress &&
    localImprovements.suggestedAddress.trim().toLowerCase() !==
      String(draftAddress || '').trim().toLowerCase()
      ? localImprovements.suggestedAddress.trim()
      : apiSuggestedAddress &&
          apiSuggestedAddress.toLowerCase() !== String(draftAddress || '').trim().toLowerCase()
        ? apiSuggestedAddress
        : '';

  const addressForHouseCheck = String(draftAddress || suggestedAddress || '').trim();
  const detectedHouse = extractHouseNumberFromAddress(addressForHouseCheck);
  const missingRequiredFields = getMissingRequiredFields(result, missingFields, addressForHouseCheck);
  const houseMissing = missingRequiredFields.includes('house');
  // House number is mandatory — accept API house OR local detection (Flat no / House / Plot…).
  const isValid = !houseMissing && (apiSaysValid || Boolean(detectedHouse));
  const displayResult = {
    ...(result || {}),
    house: fieldHasValue(result, 'house')
      ? String(result.house).trim()
      : detectedHouse || '',
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

  const hasUpdateableSuggestion = Boolean(suggestedAddress);
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
    const validation = result || {};
    const nextAddress = preferFullText
      ? String(sourceAddress || '').trim()
      : buildStreetAddress(sourceAddress, validation) || String(sourceAddress || '').trim();
    return {
      address: nextAddress,
      city: String(validation.city || city || '').trim(),
      state: String(validation.state || state || '').trim(),
      zip: String(validation.zip || zip || '').trim(),
      country: String(validation.country || country || '').trim(),
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
                <div className="min-width-0 w-100">
                  <p className="coh-modal__eyebrow mb-1">Validate address</p>
                  <h5
                    className="modal-title coh-modal__title mb-2 text-truncate"
                    id="validateOrderAddressModalLabel"
                    title={title}
                  >
                    {title}
                  </h5>
                  <label
                    className="form-label text-xs text-uppercase fw-bold text-muted mb-1"
                    htmlFor="voa-address-input"
                  >
                    Address used for validation
                  </label>
                  <textarea
                    id="voa-address-input"
                    className="form-control form-control-sm voa-address-input"
                    rows={2}
                    value={draftAddress}
                    onChange={(e) => setDraftAddress(e.target.value)}
                    placeholder="Enter full address…"
                    disabled={isBusy}
                  />
                  <div className="d-flex flex-wrap gap-2 mt-2">
                    <button
                      type="button"
                      className="btn btn-sm btn-primary mb-0"
                      onClick={() => runValidate()}
                      disabled={isBusy || (!orderId && !String(draftAddress).trim())}
                    >
                      {loadStatus === 'loading' ? 'Validating…' : 'Re-validate'}
                    </button>
                    {hasUpdateableSuggestion ? (
                      <button
                        type="button"
                        className="btn btn-sm btn-success mb-0"
                        onClick={handleUpdateSuggestion}
                        disabled={isBusy || !orderId || !canSaveAddress}
                        title={
                          updateBlockedReason || 'Save suggested address to this order'
                        }
                      >
                        {isSaving ? 'Updating…' : 'Update suggestion'}
                      </button>
                    ) : null}
                  </div>
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
              {hasUpdateableSuggestion ? (
                <div className="alert alert-info py-2 mb-3 d-flex flex-wrap align-items-start justify-content-between gap-2">
                  <div className="min-width-0 flex-grow-1">
                    <div className="fw-bold text-sm mb-1">Suggested update</div>
                    <div className="text-sm mb-0">{suggestedAddress}</div>
                    {validatedAddress &&
                    validatedAddress.trim().toLowerCase() !== suggestedAddress.toLowerCase() ? (
                      <div className="text-xs text-secondary mt-1">
                        Current: {validatedAddress}
                      </div>
                    ) : null}
                    {!canSaveAddress && updateBlockedReason ? (
                      <div className="text-xs text-danger mt-1">{updateBlockedReason}</div>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-success mb-0 flex-shrink-0"
                    onClick={handleUpdateSuggestion}
                    disabled={isBusy || !orderId || !canSaveAddress}
                    title={updateBlockedReason || undefined}
                  >
                    {isSaving ? 'Updating…' : 'Update suggestion'}
                  </button>
                </div>
              ) : null}

              {houseMissing && loadStatus === 'succeeded' ? (
                <div className="alert alert-warning py-2 mb-3">
                  House / building number is required. Please add it in the address field (for
                  example: <strong>House 12, Bottle Gali…</strong>), then click{' '}
                  <strong>Re-validate</strong>. Update stays disabled until house number is found.
                </div>
              ) : null}

              {loadStatus === 'loading' ? (
                <div className="coh-modal__state text-center text-muted">
                  <span className="spinner-border spinner-border-sm me-2" role="status" />
                  Validating address…
                </div>
              ) : null}

              {error ? <div className="alert alert-danger py-2 mb-3">{error}</div> : null}

              {loadStatus === 'succeeded' && result ? (
                <>
                  <div className="voa-summary d-flex flex-wrap align-items-center gap-2 mb-3">
                    <span
                      className={`badge text-xxs ${
                        isValid ? 'bg-gradient-success' : 'bg-gradient-danger'
                      }`}
                    >
                      <NavIcon
                        icon={isValid ? FaCircleCheck : FaTriangleExclamation}
                        size={11}
                        className="me-1"
                      />
                      {isValid ? 'Valid' : houseMissing ? 'House no. required' : 'Needs review'}
                    </span>
                    {apiSaysValid && !isValid ? (
                      <span className="voa-chip">API marked valid, but required fields are missing</span>
                    ) : null}
                    {!apiSaysValid && detectedHouse ? (
                      <span className="voa-chip">Detected house/flat · {detectedHouse}</span>
                    ) : null}
                    {apiSaysValid && detectedHouse && !fieldHasValue(result, 'house') ? (
                      <span className="voa-chip">Detected house/flat · {detectedHouse}</span>
                    ) : null}
                    {score != null && score !== '' ? (
                      <span className="voa-chip">Score · {formatScore(score)}</span>
                    ) : null}
                    {confidence != null && confidence !== '' ? (
                      <span className="voa-chip">
                        Confidence · {formatScore(confidence)}
                      </span>
                    ) : null}
                  </div>

                  <div className="table-responsive coh-modal__table-wrap mb-3">
                    <table className="table align-items-center mb-0 coh-modal__table">
                      <thead>
                        <tr>
                          <th className="text-xxs text-uppercase font-weight-bolder opacity-7">
                            Field
                          </th>
                          <th className="text-xxs text-uppercase font-weight-bolder opacity-7">
                            Value
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {ADDRESS_PART_FIELDS.map((field) => {
                          const value = displayResult?.[field.key];
                          const display =
                            value != null && String(value).trim() !== ''
                              ? String(value).trim()
                              : '—';
                          return (
                            <tr key={field.key}>
                              <td className="text-sm text-secondary">{field.label}</td>
                              <td className="text-sm font-weight-bold text-dark">{display}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {visibleMissingFields.length > 0 ? (
                    <div className="voa-section mb-3">
                      <p className="voa-section__title">Missing fields</p>
                      <div className="d-flex flex-wrap gap-1">
                        {visibleMissingFields.map((item) => (
                          <span key={item} className="badge text-xxs bg-gradient-danger">
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {visibleWarnings.length > 0 ? (
                    <div className="voa-section mb-3">
                      <p className="voa-section__title">Warnings</p>
                      <ul className="voa-list mb-0">
                        {visibleWarnings.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {allSuggestions.length > 0 ? (
                    <div className="voa-section mb-0">
                      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
                        <p className="voa-section__title mb-0">Suggestions</p>
                        {hasUpdateableSuggestion ? (
                          <button
                            type="button"
                            className="btn btn-sm btn-success mb-0"
                            onClick={handleUpdateSuggestion}
                            disabled={isBusy || !orderId || !canSaveAddress}
                            title={updateBlockedReason || undefined}
                          >
                            {isSaving ? 'Updating…' : 'Update suggestion'}
                          </button>
                        ) : null}
                      </div>
                      <ul className="voa-list mb-0">
                        {allSuggestions.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>

            <div className="modal-footer coh-modal__footer border-0 pt-0">
              {hasUpdateableSuggestion ? (
                <button
                  type="button"
                  className="btn btn-success mb-0"
                  onClick={handleUpdateSuggestion}
                  disabled={isBusy || !orderId || !canSaveAddress}
                  title={updateBlockedReason || undefined}
                >
                  {isSaving ? 'Updating…' : 'Update suggestion'}
                </button>
              ) : null}
              {canUpdateAddress ? (
                <button
                  type="button"
                  className="btn btn-primary mb-0"
                  onClick={() => handleUpdateAddress()}
                  disabled={isBusy}
                  title="Save address to this order"
                >
                  {isSaving ? 'Updating…' : 'Update address'}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary mb-0"
                  disabled
                  title={updateBlockedReason || 'Address cannot be updated yet'}
                >
                  Update address
                </button>
              )}
              <button
                type="button"
                className="btn btn-outline-secondary mb-0"
                onClick={onClose}
                disabled={isBusy}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>
  );
}
