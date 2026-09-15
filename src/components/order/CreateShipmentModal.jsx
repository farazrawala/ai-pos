import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  COURIER_DEFAULT_API_URLS,
  createCourierShipmentRequest,
  courierTypeToProvider,
  extractCourierShipmentErrorMessage,
  fetchCourierBookingOptionsRequest,
  fetchCouriersRequest,
  isPostexMerchantPortalUrl,
  normalizeBookingOptions,
  pickCourierId,
  updateCourierRequest,
} from '../../features/courier/courierAPI.js';

const courierLabel = (item) => {
  const name = item?.name?.trim();
  const provider = courierTypeToProvider(item?.type);
  if (name && provider) return `${name} (${provider})`;
  if (name) return name;
  if (provider) return provider;
  return pickCourierId(item) || 'Courier';
};

const isSuccessMessage = (value) => {
  const msg = String(value ?? '')
    .trim()
    .toLowerCase();
  return msg === 'success' || msg === 'ok' || msg === 'succeeded';
};

const postexUrlFixMessage = (currentUrl = '') => {
  const current = String(currentUrl || '').trim() || 'stg-merchant.postex.pk';
  return (
    `HTTP 405: ${current} is the PostEx merchant portal (POST not allowed). ` +
    `Edit this courier and set API URL to ${COURIER_DEFAULT_API_URLS.postex}, then save and try again.`
  );
};

const postexAuthFixMessage = () =>
  'Authentication failed for PostEx. Tokens from stg-merchant.postex.pk only work with ' +
  `${COURIER_DEFAULT_API_URLS.postex_staging}. Production tokens use ` +
  `${COURIER_DEFAULT_API_URLS.postex}. Paste the Merchant API Token (not portal password), Update, retry.`;

const isPostexAuthFailure = (message) =>
  /authentication failed.*postex|postex.*authentication failed|invalid.?token|unauthorized|unauthorised/i.test(
    String(message || '')
  );

const isFlagshipCourier = (item) => {
  const key = String(item?.type || item?.provider || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
  return key === 'flagship';
};

const pickupAddressId = (item) =>
  item?.id != null ? String(item.id) : item?._id != null ? String(item._id) : '';

const pickupAddressLabel = (item) => {
  const address = String(item?.address || item?.label || '').trim();
  const id = pickupAddressId(item);
  if (address && item?.is_default) return `${address} (default)`;
  if (address) return address;
  return id || 'Pickup address';
};

const pickDefaultCodAmount = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return '';
  return String(n);
};

/**
 * Select a saved courier integration and create a shipment for one or more orders.
 * Pass `orders` for bulk booking; otherwise uses single `orderId` / `orderNo`.
 */
export default function CreateShipmentModal({
  open,
  orderId,
  orderNo,
  orderTotal = '',
  suggestCod = false,
  city = '',
  orders = null,
  onClose,
  onSaved,
}) {
  const [couriers, setCouriers] = useState([]);
  const [couriersStatus, setCouriersStatus] = useState('idle');
  const [couriersError, setCouriersError] = useState(null);
  const [selectedCourierId, setSelectedCourierId] = useState('');
  const [saveStatus, setSaveStatus] = useState('idle');
  const [saveError, setSaveError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(null);
  const [saveProgress, setSaveProgress] = useState('');
  const [bookingOptions, setBookingOptions] = useState(null);
  const [bookingOptionsStatus, setBookingOptionsStatus] = useState('idle');
  const [bookingOptionsError, setBookingOptionsError] = useState(null);
  const [courierCompany, setCourierCompany] = useState('');
  const [courierOption, setCourierOption] = useState('');
  const [pickupLocation, setPickupLocation] = useState('');
  const [isCod, setIsCod] = useState(false);
  const [codAmount, setCodAmount] = useState('');

  const orderList = useMemo(() => {
    if (Array.isArray(orders) && orders.length > 0) {
      return orders
        .map((item) => ({
          orderId: String(item?.orderId || item?.id || '').trim(),
          orderNo: String(item?.orderNo || item?.order_no || '').trim(),
          orderTotal: item?.orderTotal ?? item?.order_total ?? '',
          suggestCod: Boolean(item?.suggestCod),
          city: String(item?.city || '').trim(),
        }))
        .filter((item) => item.orderId);
    }
    const id = String(orderId || '').trim();
    if (!id) return [];
    return [
      {
        orderId: id,
        orderNo: String(orderNo || '').trim(),
        orderTotal,
        suggestCod: Boolean(suggestCod),
        city: String(city || '').trim(),
      },
    ];
  }, [orders, orderId, orderNo, orderTotal, suggestCod, city]);

  const isBulk = orderList.length > 1;
  const primaryOrder = orderList[0] || null;

  useEffect(() => {
    if (!open) return undefined;

    let cancelled = false;
    setCouriersStatus('loading');
    setCouriersError(null);
    setSaveError(null);
    setSaveSuccess(null);
    setSaveProgress('');
    setSaveStatus('idle');
    setSelectedCourierId('');
    setCouriers([]);
    setBookingOptions(null);
    setBookingOptionsStatus('idle');
    setBookingOptionsError(null);
    setCourierCompany('');
    setCourierOption('');
    setPickupLocation('');
    const defaultAmount = pickDefaultCodAmount(primaryOrder?.orderTotal ?? orderTotal);
    // PostEx bookings are COD by default — pre-check when we have an amount,
    // otherwise still pre-check so the user must enter/confirm the amount.
    setIsCod(true);
    setCodAmount(defaultAmount);

    fetchCouriersRequest({ limit: 500 })
      .then((result) => {
        if (cancelled) return;
        const list = Array.isArray(result?.data) ? result.data : [];
        setCouriers(list);
        setCouriersStatus('succeeded');
        if (list.length === 1) {
          setSelectedCourierId(String(pickCourierId(list[0])));
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setCouriers([]);
          setCouriersStatus('failed');
          setCouriersError(err?.message || 'Failed to load courier integrations');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, orderList, primaryOrder?.orderTotal, orderTotal, suggestCod]);

  const selectedCourier = useMemo(
    () => couriers.find((item) => String(pickCourierId(item)) === String(selectedCourierId)),
    [couriers, selectedCourierId]
  );

  const selectedHasBadPostexUrl =
    String(selectedCourier?.type || '').toLowerCase() === 'postex' &&
    isPostexMerchantPortalUrl(selectedCourier?.url);
  const isFlagship = isFlagshipCourier(selectedCourier);
  const requiresCompany = Boolean(isFlagship && bookingOptions?.requires_company);
  const companies = Array.isArray(bookingOptions?.companies) ? bookingOptions.companies : [];
  const rateCards =
    bookingOptions?.rate_cards && typeof bookingOptions.rate_cards === 'object'
      ? bookingOptions.rate_cards
      : {};
  const companyRateCards = courierCompany
    ? (Array.isArray(rateCards[courierCompany]) ? rateCards[courierCompany] : [])
    : [];
  const pickupAddresses = Array.isArray(bookingOptions?.pickup_addresses)
    ? bookingOptions.pickup_addresses
    : [];

  useEffect(() => {
    if (!open || !selectedCourierId || !isFlagshipCourier(selectedCourier)) {
      setBookingOptions(null);
      setBookingOptionsStatus('idle');
      setBookingOptionsError(null);
      setCourierCompany('');
      setCourierOption('');
      setPickupLocation('');
      return undefined;
    }

    let cancelled = false;
    setBookingOptionsStatus('loading');
    setBookingOptionsError(null);
    setBookingOptions(null);
    setCourierCompany('');
    setCourierOption('');
    setPickupLocation('');

    fetchCourierBookingOptionsRequest(selectedCourierId)
      .then((result) => {
        if (cancelled) return;
        setBookingOptions(result);
        setBookingOptionsStatus('succeeded');
        if (!result.requires_company) return;
        const firstCompany = result.companies[0] || '';
        if (firstCompany) setCourierCompany(firstCompany);
        const defaultPickup =
          result.pickup_addresses.find((item) => item?.is_default) || result.pickup_addresses[0];
        if (defaultPickup) setPickupLocation(pickupAddressId(defaultPickup));
      })
      .catch((err) => {
        if (cancelled) return;
        setBookingOptionsStatus('failed');
        setBookingOptionsError(err?.message || 'Failed to load booking companies');
      });

    return () => {
      cancelled = true;
    };
  }, [open, selectedCourierId, selectedCourier]);

  useEffect(() => {
    if (!courierCompany) {
      setCourierOption('');
      return;
    }
    const options = Array.isArray(rateCards[courierCompany]) ? rateCards[courierCompany] : [];
    setCourierOption((prev) => (options.includes(prev) ? prev : options[0] || ''));
  }, [courierCompany, bookingOptions]);

  const applyCompanyRequiredPayload = (payload) => {
    const normalized = normalizeBookingOptions(payload);
    setBookingOptions((prev) => ({
      ...normalized,
      pickup_addresses:
        normalized.pickup_addresses.length > 0
          ? normalized.pickup_addresses
          : prev?.pickup_addresses || [],
      requires_company: true,
    }));
    setBookingOptionsStatus('succeeded');
    if (normalized.companies[0] && !courierCompany) {
      setCourierCompany(normalized.companies[0]);
    }
  };

  const handleSave = async () => {
    if (!orderList.length) {
      setSaveError('Missing order id.');
      return;
    }
    const selected = selectedCourier;
    if (!selected) {
      setSaveError('Please select a courier.');
      return;
    }

    const provider = courierTypeToProvider(selected.type);
    if (!provider) {
      setSaveError('Selected courier is missing a type.');
      return;
    }

    if (
      String(selected.type || '').toLowerCase() === 'postex' &&
      isPostexMerchantPortalUrl(selected.url)
    ) {
      setSaveError(postexUrlFixMessage(selected.url));
      setSaveStatus('failed');
      return;
    }

    if (
      isFlagshipCourier(selected) &&
      (bookingOptions?.requires_company || companies.length > 0) &&
      !courierCompany
    ) {
      setSaveError('Please select a courier company.');
      setSaveStatus('failed');
      return;
    }
    const isPostex = String(selected.type || '').toLowerCase() === 'postex';
    const isFlagshipSelected = isFlagshipCourier(selected);
    const pickupCode = isPostex
      ? '001'
      : isFlagshipSelected
        ? ''
        : String(
            selected.account_no || selected.accountNo || selected.pickupAddressCode || ''
          ).trim();
    const courierId = pickCourierId(selected);

    if (isCod && !isBulk) {
      const amount = Number(codAmount);
      if (!Number.isFinite(amount) || amount < 0) {
        setSaveError('Enter a valid COD total amount.');
        setSaveStatus('failed');
        return;
      }
    }

    setSaveStatus('loading');
    setSaveError(null);
    setSaveSuccess(null);
    setSaveProgress('');

    try {
      // Backend builds PostEx payload from the courier record — persist 001 on the courier first.
      if (isPostex && courierId) {
        const existingCode = String(selected.account_no || selected.accountNo || '').trim();
        if (existingCode !== pickupCode) {
          await updateCourierRequest(courierId, { account_no: pickupCode });
          setCouriers((prev) =>
            prev.map((item) =>
              String(pickCourierId(item)) === String(courierId)
                ? { ...item, account_no: pickupCode }
                : item
            )
          );
        }
      }

      const successes = [];
      const failures = [];

      for (let i = 0; i < orderList.length; i += 1) {
        const order = orderList[i];
        if (isBulk) {
          setSaveProgress(
            `Booking ${i + 1} of ${orderList.length}` +
              (order.orderNo ? ` (${order.orderNo})` : '') +
              '…'
          );
        }

        const orderCodAmount = isBulk
          ? Number(pickDefaultCodAmount(order.orderTotal) || 0)
          : Number(codAmount);
        const orderIsCod = isCod && (!isBulk || Number.isFinite(orderCodAmount));

        try {
          const result = await createCourierShipmentRequest(order.orderId, {
            provider,
            courierId,
            isCod: orderIsCod,
            codAmount: orderIsCod ? orderCodAmount : 0,
            ...(order.city ? { city: order.city } : {}),
            ...(pickupCode
              ? {
                  account_no: pickupCode,
                  pickupAddressCode: pickupCode,
                  storeAddressCode: isPostex ? pickupCode : undefined,
                }
              : {}),
            ...(isFlagshipSelected
              ? {
                  courier_company: courierCompany,
                  courier_option: courierOption,
                  pickuplocation: pickupLocation,
                }
              : {}),
          });
          if (result?.queued) {
            throw new Error(
              result.message ||
                'Shipment was queued but no tracking id was returned. Check courier credentials and try again.'
            );
          }

          const trackingId = result?.tracking_id || result?.tracking_number || '';
          const apiSaysSuccess =
            result?.success === true ||
            isSuccessMessage(result?.message) ||
            isSuccessMessage(result?.status);

          if (!trackingId && !apiSaysSuccess) {
            throw new Error(
              extractCourierShipmentErrorMessage(
                result,
                'Courier booking succeeded without a tracking id. Check the courier API response.'
              )
            );
          }

          successes.push({
            orderId: order.orderId,
            orderNo: order.orderNo,
            provider: result?.courier || provider,
            courierCompany: isFlagshipSelected ? courierCompany : '',
            result,
          });
        } catch (err) {
          const payload = err?.payload || err?.data || err?.response || null;
          if (
            err?.code === 'COURIER_COMPANY_REQUIRED' ||
            payload?.code === 'COURIER_COMPANY_REQUIRED'
          ) {
            applyCompanyRequiredPayload(payload || {});
            setSaveStatus('idle');
            setSaveProgress('');
            setSaveError(
              payload?.message ||
                err?.message ||
                'Select a courier company to book with.'
            );
            return;
          }

          let msg =
            extractCourierShipmentErrorMessage(payload, '') ||
            err?.message ||
            'Failed to create shipment';

          if (
            /405|not allowed|method not allowed/i.test(msg) &&
            String(selected?.type || '').toLowerCase() === 'postex'
          ) {
            msg = postexUrlFixMessage(selected?.url);
          } else if (
            isPostexAuthFailure(msg) &&
            String(selected?.type || '').toLowerCase() === 'postex'
          ) {
            msg = postexAuthFixMessage();
          } else if (
            /pickup address code|store address code/i.test(msg) &&
            String(selected?.type || '').toLowerCase() === 'postex'
          ) {
            msg =
              `${msg} Frontend sent pickup/store code 001 and saved account_no=001 on the courier. ` +
              'If this persists, the backend courier/create handler is not mapping account_no → ' +
              'PostEx pickupAddressCode/storeAddressCode.';
          } else if (
            /fetch failed|ENOTFOUND|ECONNREFUSED|getaddrinfo/i.test(msg) &&
            isFlagshipCourier(selected)
          ) {
            msg =
              'Flagship host could not be reached (DNS). Set the courier API URL to ' +
              'https://partners.flaship.pk, put the Flaship API key in Token, save, then retry.';
          }

          if (isSuccessMessage(msg)) {
            successes.push({
              orderId: order.orderId,
              orderNo: order.orderNo,
              provider,
              courierCompany: isFlagshipSelected ? courierCompany : '',
              result: { message: msg, courier: provider },
            });
          } else {
            failures.push({
              orderId: order.orderId,
              orderNo: order.orderNo,
              message: msg,
            });
            if (!isBulk) {
              setSaveStatus('failed');
              setSaveProgress('');
              setSaveError(msg);
              return;
            }
          }
        }
      }

      setSaveProgress('');

      if (!successes.length) {
        setSaveStatus('failed');
        setSaveError(
          failures[0]?.message ||
            `Failed to create shipment for ${orderList.length} order${orderList.length === 1 ? '' : 's'}.`
        );
        return;
      }

      const successText = isBulk
        ? `Created ${successes.length} of ${orderList.length} shipment${orderList.length === 1 ? '' : 's'}` +
          (failures.length ? ` (${failures.length} failed)` : '') +
          '.'
        : (() => {
            const trackingId =
              successes[0]?.result?.tracking_id || successes[0]?.result?.tracking_number || '';
            return trackingId
              ? `Shipment created. Tracking ID: ${trackingId}`
              : isSuccessMessage(successes[0]?.result?.message)
                ? 'SUCCESS'
                : successes[0]?.result?.message || 'Shipment created successfully.';
          })();

      setSaveStatus('succeeded');
      setSaveSuccess(successText);
      if (failures.length && isBulk) {
        setSaveError(
          failures
            .map(
              (item) =>
                `${item.orderNo || item.orderId}: ${item.message}`
            )
            .join('\n')
        );
      }

      if (isBulk) {
        onSaved?.({
          bulk: true,
          results: successes,
          failCount: failures.length,
        });
      } else {
        onSaved?.(successes[0]);
      }
      window.setTimeout(() => onClose?.(), failures.length && isBulk ? 1800 : 900);
    } catch (err) {
      const payload = err?.payload || err?.data || err?.response || null;
      let msg =
        extractCourierShipmentErrorMessage(payload, '') ||
        err?.message ||
        'Failed to create shipment';
      setSaveStatus('failed');
      setSaveProgress('');
      setSaveError(msg);
    }
  };

  if (!open) return null;

  const isSaving = saveStatus === 'loading';
  const isLoadingCouriers = couriersStatus === 'loading';
  const titleOrder = isBulk
    ? `${orderList.length} orders`
    : primaryOrder?.orderNo && primaryOrder.orderNo !== '—'
      ? primaryOrder.orderNo
      : primaryOrder?.orderId || 'order';
  const selectedCourierEditId = selectedCourier ? pickCourierId(selectedCourier) : '';

  return (
    <>
      <div
        className="modal fade show"
        style={{ display: 'block' }}
        tabIndex={-1}
        role="dialog"
        aria-labelledby="createShipmentModalLabel"
        aria-modal="true"
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id="createShipmentModalLabel">
                {isBulk ? 'Add tracking (bulk)' : 'Add tracking'}
              </h5>
              <button
                type="button"
                className="btn-close"
                aria-label="Close"
                onClick={onClose}
                disabled={isSaving}
              />
            </div>
            <div className="modal-body">
              <p className="text-sm text-muted mb-3">
                Select a courier to create {isBulk ? 'shipments for' : 'a shipment for order'}{' '}
                <span className="font-weight-bold text-dark">{titleOrder}</span>.
              </p>

              {isBulk ? (
                <div className="border rounded p-2 mb-3 bg-light small" style={{ maxHeight: 120, overflowY: 'auto' }}>
                  {orderList.map((order) => (
                    <div key={order.orderId} className="d-flex justify-content-between gap-2">
                      <span className="fw-semibold">{order.orderNo || order.orderId}</span>
                      <span className="text-muted text-truncate">{order.orderId}</span>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="mb-0">
                <label htmlFor="createShipmentProvider" className="form-label">
                  Courier <span className="text-danger">*</span>
                </label>
                <select
                  id="createShipmentProvider"
                  className="form-select"
                  value={selectedCourierId}
                  onChange={(e) => {
                    setSelectedCourierId(e.target.value);
                    if (saveError) setSaveError(null);
                    if (saveSuccess) setSaveSuccess(null);
                  }}
                  disabled={isSaving || isLoadingCouriers || couriers.length === 0}
                >
                  <option value="">
                    {isLoadingCouriers ? 'Loading couriers…' : 'Select courier…'}
                  </option>
                  {couriers.map((item) => {
                    const id = pickCourierId(item);
                    return (
                      <option key={id} value={id}>
                        {courierLabel(item)}
                      </option>
                    );
                  })}
                </select>
                {couriersStatus === 'succeeded' && couriers.length === 0 ? (
                  <p className="text-xs text-muted mb-0 mt-2">
                    No courier integrations found. Add one under Courier Integration first.
                  </p>
                ) : (
                  <p className="text-xs text-muted mb-0 mt-2">
                    Showing your saved courier integrations.
                  </p>
                )}
              </div>

              <div className="form-check mt-3 mb-0">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="createShipmentIsCod"
                  checked={isCod}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setIsCod(checked);
                    if (checked && !String(codAmount).trim()) {
                      setCodAmount(pickDefaultCodAmount(primaryOrder?.orderTotal ?? orderTotal));
                    }
                    if (saveError) setSaveError(null);
                  }}
                  disabled={isSaving}
                />
                <label className="form-check-label" htmlFor="createShipmentIsCod">
                  COD (cash on delivery)
                </label>
              </div>

              {isCod && !isBulk ? (
                <div className="mt-3 mb-0">
                  <label className="form-label" htmlFor="createShipmentCodAmount">
                    Total amount <span className="text-danger">*</span>
                  </label>
                  <input
                    id="createShipmentCodAmount"
                    type="number"
                    min="0"
                    step="0.01"
                    className="form-control"
                    value={codAmount}
                    onChange={(e) => {
                      setCodAmount(e.target.value);
                      if (saveError) setSaveError(null);
                    }}
                    disabled={isSaving}
                    placeholder="e.g. 126.00"
                  />
                  <p className="text-xs text-muted mb-0 mt-1">
                    Sent to the courier as collectable COD amount on the label.
                  </p>
                </div>
              ) : null}

              {isCod && isBulk ? (
                <p className="text-xs text-muted mb-0 mt-2">
                  COD amount will use each order&apos;s total.
                </p>
              ) : null}

              {isFlagship && bookingOptionsStatus === 'loading' ? (
                <p className="text-xs text-muted mb-0 mt-3">
                  <span className="spinner-border spinner-border-sm me-2" role="status" />
                  Loading booking companies…
                </p>
              ) : null}

              {bookingOptionsError ? (
                <div className="alert alert-danger py-2 mt-3 mb-0">{bookingOptionsError}</div>
              ) : null}

              {requiresCompany && companies.length > 0 ? (
                <div className="mt-3">
                  <label htmlFor="createShipmentCompany" className="form-label">
                    {bookingOptions.prompt || 'Which company would you like to book?'}{' '}
                    <span className="text-danger">*</span>
                  </label>
                  <select
                    id="createShipmentCompany"
                    className="form-select"
                    value={courierCompany}
                    onChange={(e) => {
                      setCourierCompany(e.target.value);
                      if (saveError) setSaveError(null);
                    }}
                    disabled={isSaving}
                  >
                    <option value="">Select company…</option>
                    {companies.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {requiresCompany && courierCompany && companyRateCards.length > 0 ? (
                <div className="mt-3">
                  <label htmlFor="createShipmentOption" className="form-label">
                    Service / rate card
                  </label>
                  <select
                    id="createShipmentOption"
                    className="form-select"
                    value={courierOption}
                    onChange={(e) => setCourierOption(e.target.value)}
                    disabled={isSaving}
                  >
                    {companyRateCards.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {isFlagship && pickupAddresses.length > 0 ? (
                <div className="mt-3">
                  <label htmlFor="createShipmentPickup" className="form-label">
                    Pickup address
                  </label>
                  <select
                    id="createShipmentPickup"
                    className="form-select"
                    value={pickupLocation}
                    onChange={(e) => setPickupLocation(e.target.value)}
                    disabled={isSaving}
                  >
                    {pickupAddresses.map((item) => {
                      const id = pickupAddressId(item);
                      return (
                        <option key={id} value={id}>
                          {pickupAddressLabel(item)}
                        </option>
                      );
                    })}
                  </select>
                </div>
              ) : null}

              {selectedHasBadPostexUrl ? (
                <div className="alert alert-warning py-2 mt-3 mb-0">
                  <div className="mb-2">
                    This courier API URL is <code>{selectedCourier.url}</code> (merchant portal).
                    Change it to <code>{COURIER_DEFAULT_API_URLS.postex}</code> or Create shipment
                    will keep failing with HTTP 405.
                  </div>
                  {selectedCourierEditId ? (
                    <Link
                      className="btn btn-sm btn-warning mb-0"
                      to={`/courier-integration/edit/${selectedCourierEditId}`}
                      onClick={onClose}
                    >
                      Fix courier API URL
                    </Link>
                  ) : null}
                </div>
              ) : null}

              {saveProgress ? (
                <p className="text-xs text-muted mb-0 mt-3">{saveProgress}</p>
              ) : null}
              {couriersError ? (
                <div className="alert alert-danger py-2 mt-3 mb-0">{couriersError}</div>
              ) : null}
              {saveError ? (
                <div
                  className="alert alert-danger py-2 mt-3 mb-0"
                  style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                >
                  <div>{saveError}</div>
                  {selectedCourierEditId &&
                  /405|merchant portal|API URL|Authentication failed|API Token/i.test(saveError) ? (
                    <Link
                      className="btn btn-sm btn-outline-light mt-2 mb-0"
                      to={`/courier-integration/edit/${selectedCourierEditId}`}
                      onClick={onClose}
                    >
                      Open courier settings
                    </Link>
                  ) : null}
                </div>
              ) : null}
              {saveSuccess ? (
                <div className="alert alert-success py-2 mt-3 mb-0">{saveSuccess}</div>
              ) : null}
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary mb-0"
                onClick={onClose}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary mb-0"
                onClick={handleSave}
                disabled={
                  isSaving ||
                  isLoadingCouriers ||
                  !selectedCourierId ||
                  Boolean(saveSuccess) ||
                  selectedHasBadPostexUrl ||
                  (isFlagship && bookingOptionsStatus === 'loading') ||
                  (requiresCompany && !courierCompany)
                }
              >
                {isSaving ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm me-2"
                      role="status"
                      aria-hidden="true"
                    />
                    {isBulk ? 'Creating…' : 'Creating…'}
                  </>
                ) : isBulk ? (
                  `Create ${orderList.length} shipments`
                ) : (
                  'Create shipment'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div
        className="modal-backdrop fade show"
        onClick={isSaving ? undefined : onClose}
        aria-hidden="true"
      />
    </>
  );
}
