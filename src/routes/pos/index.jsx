import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import moment from 'moment';
import {
  fetchUsersListRequest,
  formatUserOptionLabel,
  getUserOptionValue,
  createCustomerUserRequest,
  pickCreatedUserFromResponse,
  POS_DEFAULT_CUSTOMER_PASSWORD,
  resolvePosCustomerEmail,
  digitsOnlyFromPhone,
} from '../../features/users/usersAPI.js';
import { fetchCategoriesRequest } from '../../features/categories/categoriesAPI.js';
import {
  createPosOrderRequest,
  pickOrderInvoiceNoFromSaveResponse,
} from '../../features/orders/ordersAPI.js';
import {
  extractPrinterSettingsFromCompanyBody,
  extractProductSettingsFromCompanyBody,
  fetchCompanyById,
  getCompanyFromApiBody,
  getCompanyIdFromUser,
  mergeCompanyRecordForSettings,
  mergePrinterSettings,
  mergeProductSettings,
  pickCompanyLogoUrl,
  getWarehouseIdFromCompany,
} from '../../features/company/companyAPI.js';
import { setCompany } from '../../features/user/userSlice.js';
import { getProductAvailableStock } from '../../utils/productStock.js';
import { openThermalReceiptPrint } from '../../components/ThermalReceiptPrint/index.js';
import { buildPublicInvoiceUrl, pickPublicInvoiceToken } from '../../utils/publicInvoiceUrl.js';
import PosProducts from './PosProducts.jsx';
import SearchInputIcon from '../../components/SearchInputIcon.jsx';
import { useRequireModuleAccess } from '../../hooks/useRequireModuleAccess.js';
import { toast } from '../../utils/toast.js';
import { formatPosOrderErrorMessage } from '../../utils/posOrderErrors.js';
import './pos-module.css';

const ADD_CUSTOMER_INITIAL = { name: '', email: '', phone: '03' };

const shopName =
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_SHOP_NAME
    ? String(import.meta.env.VITE_SHOP_NAME)
    : 'Store';

function pickOrderFromSaveResult(result) {
  if (!result || typeof result !== 'object') return null;
  const data = result.data;
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    if (data.order && typeof data.order === 'object') return data.order;
    if (data._id != null || data.id != null) return data;
  }
  if (result.order && typeof result.order === 'object') return result.order;
  if (result._id != null || result.id != null) return result;
  return null;
}

function buildCompanyBrandFromRecord(company) {
  const name = company?.company_name || company?.name || shopName;
  return {
    name: String(name || shopName).trim() || shopName,
    phone: String(company?.company_phone || company?.phone || '').trim(),
    email: String(company?.company_email || company?.email || '').trim(),
    address: String(company?.company_address || company?.address || '').trim(),
    logoUrl: pickCompanyLogoUrl(company),
  };
}

function buildThermalReceiptFromCart({
  cartLines,
  customerName,
  customerEmail,
  customerPhone,
  payment,
  cartSubtotal,
  shippingNum,
  extraDiscountNum,
  grandTotal,
  invoiceNo,
  publicUrl,
  companyName,
}) {
  const lines = (cartLines || []).map((line) => {
    const qty = parsePosQty(line.quantity);
    const rate = Number(line.unitPrice) || 0;
    return {
      description: line.name || 'Product',
      qtyLabel: formatPosQtyLabel(qty),
      rate,
      amount: qty * rate,
    };
  });
  const paid = Number(payment?.paid ?? 0);
  const total = Number(grandTotal) || 0;
  const balanceDue = Math.max(0, total - paid);
  return {
    shopName: companyName || shopName,
    invoiceNo: invoiceNo || '—',
    invoiceDate: moment().format('D MMM YYYY, h:mm a'),
    paymentMethod: payment?.paymentMethod || '—',
    paymentStatus: balanceDue <= 0 ? 'Paid' : 'Partial',
    billTo: {
      name: customerName || 'Walk-in Client',
      phone: customerPhone || '',
      email: customerEmail || '',
    },
    lines,
    grossAmount: total,
    publicUrl: publicUrl || '',
    summary: {
      subTotal: Number(cartSubtotal) || 0,
      tax: 0,
      discount: Number(extraDiscountNum) || 0,
      shipping: Number(shippingNum) || 0,
      total,
      paymentMade: paid,
      balanceDue,
    },
    terms: shippingNum > 0 ? `Shipping: PKR ${Number(shippingNum).toFixed(2)}` : '',
  };
}

const parsePosUnitPrice = (product) => {
  const v = product?.price ?? product?.product_price;
  if (v == null || v === '') return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
};

const POS_QTY_MIN = 0.01;

function roundPosQty(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

/** Parse cart / order line quantity (supports decimals e.g. 2.45). */
function parsePosQty(raw) {
  const n = parseFloat(
    String(raw ?? '')
      .replace(/,/g, '')
      .trim()
  );
  return Number.isFinite(n) ? roundPosQty(n) : 0;
}

/** While typing qty — digits with optional single decimal, max 2 fractional digits. */
function sanitizePosQtyInput(value) {
  const s = String(value ?? '').replace(/,/g, '');
  let out = '';
  let sawDot = false;
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    if (ch >= '0' && ch <= '9') out += ch;
    else if (ch === '.' && !sawDot) {
      out += ch;
      sawDot = true;
    }
  }
  const dot = out.indexOf('.');
  if (dot !== -1 && out.length - dot - 1 > 2) {
    out = out.slice(0, dot + 3);
  }
  return out;
}

function formatPosQtyLabel(qty) {
  const q = roundPosQty(qty);
  if (!Number.isFinite(q) || q <= 0) return '0';
  return Number.isInteger(q) ? String(q) : q.toFixed(2);
}

function posStockBlocksQty({ allowWhenInsufficient, availableStock, requestedQty, productName }) {
  if (allowWhenInsufficient) return null;

  if (availableStock == null || !Number.isFinite(availableStock)) {
    const name = String(productName || 'Product').trim() || 'Product';
    return `Cannot verify stock for "${name}". Reload POS or check warehouse inventory.`;
  }

  if (requestedQty <= availableStock) return null;
  const name = String(productName || 'Product').trim() || 'Product';
  return `Insufficient stock for "${name}": requested ${formatPosQtyLabel(requestedQty)}, available ${formatPosQtyLabel(availableStock)}.`;
}

const Pos = () => {
  useRequireModuleAccess('pos');
  const dispatch = useDispatch();
  const authUser = useSelector((state) => state.user.user);
  const authCompany = useSelector((state) => state.user.company);

  const companyId = useMemo(
    () =>
      getCompanyIdFromUser(authUser) ||
      String(authCompany?._id ?? authCompany?.id ?? '').trim(),
    [authUser, authCompany]
  );

  const defaultWarehouseId = useMemo(
    () => getWarehouseIdFromCompany(authCompany),
    [authCompany]
  );

  const authCompanyRef = useRef(authCompany);
  authCompanyRef.current = authCompany;

  useEffect(() => {
    if (!companyId) return undefined;

    let cancelled = false;
    fetchCompanyById(companyId)
      .then((body) => {
        if (cancelled) return;
        const fetched = getCompanyFromApiBody(body);
        if (!fetched) return;
        dispatch(
          setCompany(mergeCompanyRecordForSettings(fetched, authCompanyRef.current))
        );
      })
      .catch((err) => {
        console.warn('[POS] Could not refresh company product settings', err);
      });

    return () => {
      cancelled = true;
    };
  }, [companyId, dispatch]);

  const printerSettings = useMemo(() => {
    const parsed = extractPrinterSettingsFromCompanyBody({ data: authCompany });
    return mergePrinterSettings(parsed);
  }, [authCompany]);

  const productSettings = useMemo(() => {
    const parsed = extractProductSettingsFromCompanyBody({ data: authCompany });
    return mergeProductSettings(parsed);
  }, [authCompany]);

  const allowAddWhenStockInsufficient = Boolean(
    productSettings.allow_add_to_cart_when_stock_insufficient
  );

  const companyBrand = useMemo(() => buildCompanyBrandFromRecord(authCompany), [authCompany]);

  const [users, setUsers] = useState([]);
  const [usersStatus, setUsersStatus] = useState('idle');
  const [usersError, setUsersError] = useState(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [customerMenuOpen, setCustomerMenuOpen] = useState(false);
  const customerPickerRef = useRef(null);

  const [productQuery, setProductQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [categories, setCategories] = useState([]);
  const [categoriesStatus, setCategoriesStatus] = useState('idle');
  const [categoriesError, setCategoriesError] = useState(null);
  const [shipping, setShipping] = useState('');
  const [extraDiscount, setExtraDiscount] = useState('');
  const [cartLines, setCartLines] = useState([]);

  const [addCustomerForm, setAddCustomerForm] = useState(ADD_CUSTOMER_INITIAL);
  const [addCustomerErrors, setAddCustomerErrors] = useState({});
  const [createCustomerSubmitting, setCreateCustomerSubmitting] = useState(false);
  const [createCustomerError, setCreateCustomerError] = useState('');
  const [orderSaving, setOrderSaving] = useState(false);

  const showToast = (toastId, body) => {
    const toastElement = document.getElementById(toastId);
    if (!toastElement) return;
    const timeElement = toastElement.querySelector('.toast-time');
    if (timeElement) {
      timeElement.textContent = moment().format('h:mm A');
    }
    if (body) {
      const toastBody = toastElement.querySelector('.toast-body');
      if (toastBody) toastBody.textContent = body;
    }
    if (window.bootstrap?.Toast) {
      const toast = new window.bootstrap.Toast(toastElement, { autohide: true, delay: 5000 });
      toast.show();
    }
  };

  const loadUsers = useCallback(async (selectAfter) => {
    setUsersStatus('loading');
    setUsersError(null);
    try {
      const list = await fetchUsersListRequest({ limit: 2000, skip: 0, role: 'CUSTOMER' });
      const arr = Array.isArray(list) ? list : [];
      setUsers(arr);
      setUsersStatus('succeeded');
      if (selectAfter?.preferId) {
        setSelectedCustomerId(String(selectAfter.preferId));
      } else if (selectAfter?.fallbackEmail) {
        const em = selectAfter.fallbackEmail.trim().toLowerCase();
        const match = arr.find((u) => (u.email || '').toLowerCase() === em);
        if (match) {
          setSelectedCustomerId(getUserOptionValue(match));
        }
      }
    } catch (err) {
      console.error('[POS] Failed to load users for customer dropdown', err);
      setUsers([]);
      setUsersError(err?.message || 'Could not load users');
      setUsersStatus('failed');
    }
  }, []);

  const loadCategories = useCallback(async () => {
    setCategoriesStatus('loading');
    setCategoriesError(null);
    try {
      const result = await fetchCategoriesRequest({ page: 1, limit: 2000 });
      const arr = Array.isArray(result?.data) ? result.data : [];
      setCategories(arr);
      setCategoriesStatus('succeeded');
    } catch (err) {
      console.error('[POS] Failed to load categories', err);
      setCategories([]);
      setCategoriesError(err?.message || 'Could not load categories');
      setCategoriesStatus('failed');
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    const onDoc = (e) => {
      if (!customerPickerRef.current?.contains(e.target)) {
        setCustomerMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const filteredCustomers = useMemo(() => {
    const withId = users.filter((u) => getUserOptionValue(u));
    const q = customerFilter.trim().toLowerCase();
    const qDigits = digitsOnlyFromPhone(customerFilter);
    let list = withId;
    if (q || qDigits) {
      list = withId.filter((u) => {
        const label = formatUserOptionLabel(u).toLowerCase();
        const email = String(u.email || '').toLowerCase();
        const phoneDigits = digitsOnlyFromPhone(u.mobile || u.phone || u.phoneNumber || '');
        if (label.includes(q)) return true;
        if (email && email.includes(q)) return true;
        if (qDigits && phoneDigits.includes(qDigits)) return true;
        return false;
      });
    }
    const cap = 150;
    return { rows: list.slice(0, cap), capped: list.length > cap };
  }, [users, customerFilter]);

  useEffect(() => {
    const firstCustomerId = users.map((u) => getUserOptionValue(u)).find(Boolean) || '';
    if (!firstCustomerId) return;
    const selectedStillExists = users.some((u) => getUserOptionValue(u) === selectedCustomerId);
    if (!selectedCustomerId || !selectedStillExists) {
      setSelectedCustomerId(firstCustomerId);
    }
  }, [users, selectedCustomerId]);

  const addToCart = useCallback(
    (product) => {
      if (!product || typeof product !== 'object') return;
      const productId = String(product._id ?? product.id ?? product.product_id ?? '');
      if (!productId) return;
      const name = product.name || product.product_name || 'Product';
      const unitPrice = parsePosUnitPrice(product);
      const availableStock = getProductAvailableStock(product, {
        warehouseId: defaultWarehouseId,
      });

      let stockMsg = null;
      setCartLines((prev) => {
        const i = prev.findIndex((l) => l.productId === productId);
        const nextQty = i >= 0 ? parsePosQty(prev[i].quantity) + 1 : 1;
        stockMsg = posStockBlocksQty({
          allowWhenInsufficient: allowAddWhenStockInsufficient,
          availableStock: i >= 0 ? (prev[i].availableStock ?? availableStock) : availableStock,
          requestedQty: nextQty,
          productName: name,
        });
        if (stockMsg) return prev;

        if (i >= 0) {
          const next = [...prev];
          next[i] = {
            ...next[i],
            quantity: formatPosQtyLabel(nextQty),
            availableStock: next[i].availableStock ?? availableStock,
          };
          return next;
        }
        return [
          ...prev,
          { productId, name, unitPrice, quantity: '1', availableStock },
        ];
      });
      if (stockMsg) toast.warning(stockMsg);
    },
    [allowAddWhenStockInsufficient, defaultWarehouseId]
  );

  const bumpCartQty = useCallback(
    (productId, delta) => {
      let stockMsg = null;
      setCartLines((prev) =>
        prev.flatMap((l) => {
          if (l.productId !== productId) return [l];
          const next = roundPosQty(parsePosQty(l.quantity) + delta);
          if (next < POS_QTY_MIN) return [];
          if (delta > 0) {
            stockMsg = posStockBlocksQty({
              allowWhenInsufficient: allowAddWhenStockInsufficient,
              availableStock: l.availableStock,
              requestedQty: next,
              productName: l.name,
            });
            if (stockMsg) return [l];
          }
          return [{ ...l, quantity: formatPosQtyLabel(next) }];
        })
      );
      if (stockMsg) toast.warning(stockMsg);
    },
    [allowAddWhenStockInsufficient]
  );

  const setCartQty = useCallback(
    (productId, raw) => {
      const sanitized = sanitizePosQtyInput(raw);
      if (sanitized === '') {
        setCartLines((prev) => prev.filter((l) => l.productId !== productId));
        return;
      }
      let stockMsg = null;
      setCartLines((prev) =>
        prev.flatMap((l) => {
          if (l.productId !== productId) return [l];
          const next = parsePosQty(sanitized);
          stockMsg = posStockBlocksQty({
            allowWhenInsufficient: allowAddWhenStockInsufficient,
            availableStock: l.availableStock,
            requestedQty: next,
            productName: l.name,
          });
          if (stockMsg) return [l];
          return [{ ...l, quantity: sanitized }];
        })
      );
      if (stockMsg) toast.warning(stockMsg);
    },
    [allowAddWhenStockInsufficient]
  );

  const commitCartQty = useCallback(
    (productId) => {
      let stockMsg = null;
      setCartLines((prev) =>
        prev.flatMap((l) => {
          if (l.productId !== productId) return [l];
          const q = parsePosQty(l.quantity);
          if (q < POS_QTY_MIN) return [];
          stockMsg = posStockBlocksQty({
            allowWhenInsufficient: allowAddWhenStockInsufficient,
            availableStock: l.availableStock,
            requestedQty: q,
            productName: l.name,
          });
          if (stockMsg) return [l];
          return [{ ...l, quantity: formatPosQtyLabel(q) }];
        })
      );
      if (stockMsg) toast.warning(stockMsg);
    },
    [allowAddWhenStockInsufficient]
  );

  const setCartUnitPrice = useCallback((productId, raw) => {
    const n = parseFloat(String(raw).replace(/,/g, ''));
    const unitPrice = Number.isFinite(n) && n >= 0 ? n : 0;
    setCartLines((prev) => prev.map((l) => (l.productId === productId ? { ...l, unitPrice } : l)));
  }, []);

  const cartSubtotal = useMemo(
    () => cartLines.reduce((sum, l) => sum + parsePosQty(l.quantity) * l.unitPrice, 0),
    [cartLines]
  );

  const shippingNum = useMemo(() => {
    const n = parseFloat(String(shipping).replace(/,/g, ''));
    return Number.isFinite(n) ? n : 0;
  }, [shipping]);

  const extraDiscountNum = useMemo(() => {
    const n = parseFloat(String(extraDiscount).replace(/,/g, ''));
    return Number.isFinite(n) ? n : 0;
  }, [extraDiscount]);

  const grandTotal = useMemo(() => {
    const v = cartSubtotal + shippingNum - extraDiscountNum;
    return Number.isFinite(v) ? Math.max(0, v) : 0;
  }, [cartSubtotal, shippingNum, extraDiscountNum]);

  const savePosOrder = useCallback(
    async (payment) => {
      if (!cartLines || cartLines.length === 0) {
        alert('Cart is empty. Add at least one product before payment.');
        return null;
      }

      const customer = users.find((u) => getUserOptionValue(u) === selectedCustomerId) || null;
      const name = customer?.name || customer?.fullName || customer?.username || 'Walk-in Client';
      const email = customer?.email || 'test@gmail.com';
      const phone = customer?.mobile || customer?.phone || customer?.phoneNumber || '0000000000';
      const address = '';

      const lines = cartLines.map((line) => ({
        productId: line.productId,
        qty: parsePosQty(line.quantity),
        price: line.unitPrice,
      }));

      const invalidQty = lines.find((line) => line.qty < POS_QTY_MIN);
      if (invalidQty) {
        alert(`Each line needs quantity of at least ${POS_QTY_MIN} (e.g. 2.45).`);
        return null;
      }

      const result = await createPosOrderRequest({
        name,
        email,
        phone,
        address,
        lines,
        shipping: shippingNum || 0,
        shipment: shippingNum || 0,
        discount: extraDiscountNum || 0,
        order_status: 'active',
        amount_received: payment?.paid ?? 0,
        change_given: payment?.change ?? 0,
        posPayMethod: payment?.paymentMethodId || undefined,
        payment_method_id: payment?.paymentMethodId || undefined,
        customer_id: selectedCustomerId || undefined,
      });

      return {
        result,
        customerName: name,
        customerEmail: email,
        customerPhone: phone,
        cartSnapshot: cartLines.map((line) => ({ ...line })),
      };
    },
    [cartLines, users, selectedCustomerId, shippingNum, extraDiscountNum]
  );

  const clearCartAfterSale = useCallback(() => {
    setCartLines([]);
    setShipping('');
    setExtraDiscount('');
  }, []);

  const handlePaymentComplete = useCallback(
    async (payment) => {
      setOrderSaving(true);
      try {
        const saved = await savePosOrder(payment);
        if (!saved) return;
        showToast('successToast', 'Order saved successfully.');
        clearCartAfterSale();
      } catch (e) {
        console.error('[POS] Failed to save order', e);
        toast.error(
          formatPosOrderErrorMessage(e?.message, {
            cartLines,
            productId: e?.productId,
            productName: e?.productName,
          }),
          { delay: 8000 }
        );
      } finally {
        setOrderSaving(false);
      }
    },
    [savePosOrder, clearCartAfterSale, cartLines]
  );

  const handlePaymentCompletePrint = useCallback(
    async (payment) => {
      setOrderSaving(true);
      try {
        const saved = await savePosOrder(payment);
        if (!saved) return;

        const invoiceNo =
          pickOrderInvoiceNoFromSaveResponse(saved.result) || moment().format('YYYYMMDDHHmmss');
        const savedOrder = pickOrderFromSaveResult(saved.result);
        const publicUrl = buildPublicInvoiceUrl(pickPublicInvoiceToken(savedOrder));

        let settings = printerSettings;
        let brand = companyBrand;
        const companyId =
          getCompanyIdFromUser(authUser) ||
          String(authCompany?._id ?? authCompany?.id ?? '').trim();
        if (companyId) {
          try {
            const body = await fetchCompanyById(companyId);
            const company = getCompanyFromApiBody(body);
            if (company && typeof company === 'object') {
              const merged = mergeCompanyRecordForSettings(company, authCompany);
              settings = mergePrinterSettings(
                extractPrinterSettingsFromCompanyBody({ data: merged })
              );
              brand = buildCompanyBrandFromRecord(merged);
            }
          } catch {
            // print with last known settings
          }
        }

        const receipt = buildThermalReceiptFromCart({
          cartLines: saved.cartSnapshot,
          customerName: saved.customerName,
          customerEmail: saved.customerEmail,
          customerPhone: saved.customerPhone,
          payment,
          cartSubtotal,
          shippingNum,
          extraDiscountNum,
          grandTotal,
          invoiceNo,
          publicUrl,
          companyName: brand.name,
        });

        const printed = await openThermalReceiptPrint(receipt, {
          documentTitlePrefix: 'Receipt',
          invoiceNumberPrefix: 'POS#',
          printerSettings: settings,
          companyBrand: brand,
          sourceOrder: {
            amount_received: payment?.paid ?? 0,
            change_given: payment?.change ?? 0,
          },
        });
        if (!printed) {
          toast.error('Allow pop-ups to print the thermal receipt.', { delay: 6000 });
        }

        showToast('successToast', 'Order saved and sent to printer.');
        clearCartAfterSale();
      } catch (e) {
        console.error('[POS] Failed to save order for print', e);
        toast.error(
          formatPosOrderErrorMessage(e?.message, {
            cartLines,
            productId: e?.productId,
            productName: e?.productName,
          }),
          { delay: 8000 }
        );
      } finally {
        setOrderSaving(false);
      }
    },
    [
      savePosOrder,
      clearCartAfterSale,
      cartLines,
      cartSubtotal,
      shippingNum,
      extraDiscountNum,
      grandTotal,
      printerSettings,
      companyBrand,
      authUser,
      authCompany,
    ]
  );

  const openAddCustomerModal = () => {
    const qDigits = digitsOnlyFromPhone(customerFilter).slice(0, 11);
    setAddCustomerForm(
      qDigits ? { ...ADD_CUSTOMER_INITIAL, phone: qDigits } : ADD_CUSTOMER_INITIAL
    );
    setAddCustomerErrors({});
    setCreateCustomerError('');
    setCustomerMenuOpen(false);
    const el = document.getElementById('posAddCustomerModal');
    if (el && window.bootstrap?.Modal) {
      const M = window.bootstrap.Modal;
      const instance =
        typeof M.getOrCreateInstance === 'function'
          ? M.getOrCreateInstance(el)
          : M.getInstance(el) || new M(el);
      instance.show();
    }
  };

  const closeAddCustomerModal = () => {
    const el = document.getElementById('posAddCustomerModal');
    if (el && window.bootstrap?.Modal) {
      const instance = window.bootstrap.Modal.getInstance(el);
      instance?.hide();
    }
  };

  const validateAddCustomer = () => {
    const next = {};
    if (!addCustomerForm.name.trim()) {
      next.name = 'Name is required';
    }
    const emailTrim = addCustomerForm.email.trim();
    if (emailTrim && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
      next.email = 'Enter a valid email';
    }
    if (!addCustomerForm.phone.trim()) {
      next.phone = 'Phone is required';
    } else {
      const phoneDigits = digitsOnlyFromPhone(addCustomerForm.phone);
      if (phoneDigits.length < 7) {
        next.phone = 'Enter a valid phone number (at least 7 digits)';
      } else if (phoneDigits.length > 11) {
        next.phone = 'Phone number must be 11 digits or less';
      }
    }
    setAddCustomerErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleAddCustomerFieldChange = (e) => {
    const { name, value } = e.target;
    const nextValue = name === 'phone' ? digitsOnlyFromPhone(value).slice(0, 11) : value;
    setAddCustomerForm((prev) => ({ ...prev, [name]: nextValue }));
    if (addCustomerErrors[name]) {
      setAddCustomerErrors((prev) => ({ ...prev, [name]: '' }));
    }
    setCreateCustomerError('');
  };

  const handleAddCustomerSubmit = async (e) => {
    e.preventDefault();
    setCreateCustomerError('');
    if (!validateAddCustomer()) {
      return;
    }
    setCreateCustomerSubmitting(true);
    try {
      const resolvedEmail = resolvePosCustomerEmail(addCustomerForm.email, addCustomerForm.phone);
      const json = await createCustomerUserRequest({
        name: addCustomerForm.name,
        email: addCustomerForm.email,
        phone: addCustomerForm.phone,
        password: POS_DEFAULT_CUSTOMER_PASSWORD,
      });
      const created = pickCreatedUserFromResponse(json);
      const newId = getUserOptionValue(created);
      await loadUsers({
        preferId: newId || undefined,
        fallbackEmail: newId ? undefined : resolvedEmail,
      });
      setAddCustomerForm(ADD_CUSTOMER_INITIAL);
      closeAddCustomerModal();
    } catch (err) {
      console.error('[POS] Create customer failed', err);
      setCreateCustomerError(err?.message || 'Could not create customer');
    } finally {
      setCreateCustomerSubmitting(false);
    }
  };

  return (
    <div className="pos-page container-fluid py-4 px-3 px-lg-4">
      <div className="row g-4">
        {/* Left: checkout */}
        <div className="col-lg-5 col-xl-4">
          <div className="card shadow-sm pos-panel-card h-100">
            <div className="pos-panel-header">
              <h5>Current order</h5>
              <p>Customer, cart lines, and totals</p>
            </div>
            <div className="pos-panel-body">
              <div className="pos-section-label">Customer</div>
              <div className="d-flex gap-2 align-items-start mb-1">
                <div className="flex-grow-1 position-relative" ref={customerPickerRef}>
                  <div className="input-group input-group-sm">
                    <span className="input-group-text bg-white border-end-0 text-muted">
                      <SearchInputIcon />
                    </span>
                    <input
                      type="search"
                      className="form-control border-start-0"
                      placeholder="Search name, phone, or email…"
                      value={customerFilter}
                      onChange={(e) => {
                        setCustomerFilter(e.target.value);
                        setCustomerMenuOpen(true);
                      }}
                      onFocus={() => setCustomerMenuOpen(true)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') setCustomerMenuOpen(false);
                      }}
                      disabled={usersStatus === 'loading'}
                      autoComplete="off"
                      aria-label="Search customers"
                      aria-expanded={customerMenuOpen}
                      aria-controls="pos-customer-picker-list"
                    />
                  </div>
                  {customerMenuOpen && usersStatus !== 'loading' && (
                    <div
                      id="pos-customer-picker-list"
                      className="list-group position-absolute w-100 mt-1 shadow-sm border rounded overflow-hidden bg-white pos-customer-menu"
                      role="listbox"
                    >
                      <button
                        type="button"
                        className={`list-group-item list-group-item-action py-2 px-3 border-0 rounded-0 text-start small ${
                          !selectedCustomerId ? 'active' : ''
                        }`}
                        onClick={() => {
                          setSelectedCustomerId('');
                          setCustomerFilter('');
                          setCustomerMenuOpen(false);
                        }}
                      >
                        Walk In (no customer)
                      </button>
                      {filteredCustomers.rows.map((u) => {
                        const value = getUserOptionValue(u);
                        const selected = selectedCustomerId === value;
                        return (
                          <button
                            key={value}
                            type="button"
                            className={`list-group-item list-group-item-action py-2 px-3 border-0 border-top rounded-0 text-start small ${
                              selected ? 'active' : ''
                            }`}
                            onClick={() => {
                              setSelectedCustomerId(value);
                              setCustomerFilter('');
                              setCustomerMenuOpen(false);
                            }}
                          >
                            {formatUserOptionLabel(u)}
                          </button>
                        );
                      })}
                      {filteredCustomers.rows.length === 0 && (
                        <div className="px-3 py-2 text-muted small">No matching customers</div>
                      )}
                      {filteredCustomers.capped && (
                        <div className="px-3 py-2 text-muted small border-top bg-light">
                          Showing first {filteredCustomers.rows.length} — type to narrow results
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <button
                  className="btn btn-sm pos-add-customer-btn px-3"
                  type="button"
                  title="Add new customer"
                  onClick={openAddCustomerModal}
                >
                  Add
                </button>
              </div>
              {usersStatus === 'loading' && (
                <p className="text-xs text-muted mb-2">
                  <span
                    className="spinner-border spinner-border-sm me-1"
                    role="status"
                    aria-hidden="true"
                  ></span>
                  Loading customers…
                </p>
              )}
              {usersError && (
                <p className="text-xs text-warning mb-2" role="alert">
                  {usersError}. Check API route in <code className="text-xs">usersAPI.js</code>.
                </p>
              )}
              <div className="pos-customer-selected mb-3">
                {(() => {
                  if (!selectedCustomerId)
                    return (
                      <span>
                        Default: <strong>Walk In</strong>
                      </span>
                    );
                  const u = users.find((row) => getUserOptionValue(row) === selectedCustomerId);
                  return u ? (
                    <span>
                      Selected: <strong>{formatUserOptionLabel(u)}</strong>
                    </span>
                  ) : (
                    <span>Customer selected</span>
                  );
                })()}
              </div>

              <div className="pos-section-label">Cart</div>
              <div className="pos-cart-header">
                <div>Product</div>
                <div className="text-center">Qty</div>
                <div className="text-end">Price</div>
                <div className="text-end">Total</div>
              </div>
              <div className="pos-cart-body mb-3">
                {cartLines.length === 0 ? (
                  <div className="text-center text-muted text-sm py-5">No products in cart</div>
                ) : (
                  cartLines.map((line) => {
                    const qtyNum = parsePosQty(line.quantity);
                    const lineTotal = qtyNum * line.unitPrice;
                    return (
                      <div key={line.productId} className="pos-cart-row">
                        <div className="pos-cart-product-name" title={line.name}>
                          {line.name}
                        </div>
                        <div className="d-flex justify-content-center">
                          <div className="pos-qty-group">
                            <button
                              type="button"
                              className="pos-qty-btn"
                              aria-label="Decrease quantity"
                              onClick={() => bumpCartQty(line.productId, -1)}
                            >
                              −
                            </button>
                            <input
                              type="number"
                              min={POS_QTY_MIN}
                              step="0.01"
                              inputMode="decimal"
                              className="pos-qty-input"
                              value={line.quantity}
                              onChange={(e) => setCartQty(line.productId, e.target.value)}
                              onBlur={() => commitCartQty(line.productId)}
                              aria-label={`Quantity for ${line.name}`}
                            />
                            <button
                              type="button"
                              className="pos-qty-btn"
                              aria-label="Increase quantity"
                              onClick={() => bumpCartQty(line.productId, 1)}
                            >
                              +
                            </button>
                          </div>
                        </div>
                        <div>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            className="form-control form-control-sm pos-price-input"
                            value={line.unitPrice}
                            onChange={(e) => setCartUnitPrice(line.productId, e.target.value)}
                            aria-label={`Unit price for ${line.name}`}
                          />
                        </div>
                        <div className="pos-line-total">PKR {lineTotal.toFixed(2)}</div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="pos-section-label">Summary</div>
              <div className="pos-order-summary">
                <div className="pos-field-row mb-2">
                  <label htmlFor="pos-shipping">Shipping</label>
                  <input
                    id="pos-shipping"
                    type="text"
                    className="form-control form-control-sm"
                    value={shipping}
                    onChange={(e) => setShipping(e.target.value)}
                  />
                </div>
                <div className="pos-field-row mb-0">
                  <label htmlFor="pos-extra-discount">Extra discount</label>
                  <input
                    id="pos-extra-discount"
                    type="text"
                    className="form-control form-control-sm"
                    value={extraDiscount}
                    onChange={(e) => setExtraDiscount(e.target.value)}
                  />
                </div>
                <div className="pos-summary-row mt-3">
                  <span>Total tax</span>
                  <span className="pos-summary-value">PKR 0.00</span>
                </div>
                <div className="pos-summary-row">
                  <span>Total discount</span>
                  <span className="pos-summary-value">PKR 0.00</span>
                </div>
                <div className="pos-grand-total-row">
                  <span className="label">Grand total</span>
                  <span className="pos-grand-total">PKR {grandTotal.toFixed(2)}</span>
                </div>
              </div>

              {orderSaving && (
                <p className="text-xs text-muted mt-2 mb-0">
                  <span
                    className="spinner-border spinner-border-sm me-1"
                    role="status"
                    aria-hidden="true"
                  ></span>
                  Saving order…
                </p>
              )}
            </div>
          </div>
        </div>

        <PosProducts
          productQuery={productQuery}
          setProductQuery={setProductQuery}
          categoryFilter={categoryFilter}
          setCategoryFilter={setCategoryFilter}
          categories={categories}
          categoriesStatus={categoriesStatus}
          categoriesError={categoriesError}
          onAddToCart={addToCart}
          orderTotal={grandTotal}
          onPaymentComplete={handlePaymentComplete}
          onPaymentCompletePrint={handlePaymentCompletePrint}
        />
      </div>

      <div
        className="modal fade"
        id="posAddCustomerModal"
        tabIndex="-1"
        aria-labelledby="posAddCustomerModalLabel"
        aria-hidden="true"
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id="posAddCustomerModalLabel">
                Add customer
              </h5>
              <button
                type="button"
                className="btn-close"
                data-bs-dismiss="modal"
                aria-label="Close"
              ></button>
            </div>
            <form onSubmit={handleAddCustomerSubmit}>
              <div className="modal-body">
                <input type="hidden" name="role" value="customer" readOnly />
                <input
                  type="hidden"
                  name="password"
                  value={POS_DEFAULT_CUSTOMER_PASSWORD}
                  readOnly
                  autoComplete="new-password"
                />
                <div className="mb-3">
                  <label htmlFor="pos_customer_name" className="form-label">
                    Name <span className="text-danger">*</span>
                  </label>
                  <input
                    id="pos_customer_name"
                    name="name"
                    type="text"
                    className={`form-control ${addCustomerErrors.name ? 'is-invalid' : ''}`}
                    value={addCustomerForm.name}
                    onChange={handleAddCustomerFieldChange}
                    autoComplete="name"
                  />
                  {addCustomerErrors.name && (
                    <div className="invalid-feedback">{addCustomerErrors.name}</div>
                  )}
                </div>
                <div className="mb-0">
                  <label htmlFor="pos_customer_phone" className="form-label">
                    Phone <span className="text-danger">*</span>
                  </label>
                  <input
                    id="pos_customer_phone"
                    name="phone"
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={11}
                    className={`form-control ${addCustomerErrors.phone ? 'is-invalid' : ''}`}
                    value={addCustomerForm.phone}
                    onChange={handleAddCustomerFieldChange}
                    autoComplete="tel"
                    placeholder="Digits only"
                  />
                  {addCustomerErrors.phone && (
                    <div className="invalid-feedback">{addCustomerErrors.phone}</div>
                  )}
                </div>
                <div className="mb-3">
                  <label htmlFor="pos_customer_email" className="form-label">
                    Email <span className="text-muted font-weight-normal">(optional)</span>
                  </label>
                  <input
                    id="pos_customer_email"
                    name="email"
                    type="email"
                    className={`form-control ${addCustomerErrors.email ? 'is-invalid' : ''}`}
                    value={addCustomerForm.email}
                    onChange={handleAddCustomerFieldChange}
                    autoComplete="email"
                    placeholder="Leave empty to use phone@gmail.com"
                  />
                  <small className="text-muted text-xs">
                    If empty, the saved email is your phone digits + @gmail.com (e.g.
                    03001234567@gmail.com).
                  </small>
                  {addCustomerErrors.email && (
                    <div className="invalid-feedback d-block">{addCustomerErrors.email}</div>
                  )}
                </div>

                {createCustomerError && (
                  <div className="alert alert-danger text-sm mt-3 mb-0 py-2" role="alert">
                    {createCustomerError}
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" data-bs-dismiss="modal">
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn pos-add-customer-btn"
                  disabled={createCustomerSubmitting}
                >
                  {createCustomerSubmitting ? (
                    <>
                      <span
                        className="spinner-border spinner-border-sm me-2"
                        role="status"
                        aria-hidden="true"
                      ></span>
                      Saving…
                    </>
                  ) : (
                    'Create customer'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div className="position-fixed bottom-1 end-1 z-index-2">
        <div
          className="toast fade hide p-2 bg-white"
          role="alert"
          id="successToast"
          aria-atomic="true"
        >
          <div className="toast-header border-0">
            <i className="ni ni-check-bold text-success me-2"></i>
            <span className="me-auto font-weight-bold">Success</span>
            <small className="text-body toast-time">{moment().format('h:mm A')}</small>
          </div>
          <hr className="horizontal dark m-0" />
          <div className="toast-body">Order saved successfully.</div>
        </div>
      </div>
    </div>
  );
};

export default Pos;
