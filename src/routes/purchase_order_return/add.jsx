import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { openNormalInvoicePrint } from '../../components/NormalInvoicePrint/index.js';
import {
  extractPrinterSettingsFromCompanyBody,
  fetchCompanyById,
  getCompanyFromApiBody,
  getCompanyIdFromUser,
  mergeCompanyRecordForSettings,
  mergePrinterSettings,
  pickCompanyLogoUrl,
} from '../../features/company/companyAPI.js';
import { formatInvoiceDate, shopName } from '../../features/orders/invoiceViewMapper.js';
import { createPurchaseOrderReturn } from '../../features/purchaseOrderReturns/purchaseOrderReturnsSlice.js';
import {
  fetchProductActiveRequest,
  fetchProductByIdRequest,
} from '../../features/products/productsAPI.js';
import { fetchWarehousesRequest } from '../../features/warehouse/warehouseAPI.js';
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
import { fetchAccountsRequest } from '../../features/accounts/accountsAPI.js';
import { buildExpenseDefaultAccountFilterParams } from '../../features/expenses/expensesAPI.js';
import { PO_STATUS_OPTIONS, sanitizeAmountPaidInput } from './poFormConstants.js';
import { toast } from '../../utils/toast.js';

const fmt = (n) =>
  `PKR ${Number(n).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const roundMoney2 = (n) => {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 100) / 100;
};

/**
 * Per-line shipping: Total Shipping (input) ÷ Qty → Shipping Per Unit; Final Rate = base Rate + per unit; Amount = Final Rate × Qty.
 * Empty Total Shipping resets to base rate only. Qty ≤ 0 → shipping per unit 0 (no division by zero).
 */
function computeLineDerived(row) {
  const qtyNum = parseFloat(String(row?.qty ?? '0').replace(/,/g, ''));
  const baseRateNum = parseFloat(String(row?.rate ?? '0').replace(/,/g, ''));
  const qty = Number.isFinite(qtyNum) ? qtyNum : 0;
  const baseRate = Number.isFinite(baseRateNum) ? baseRateNum : 0;

  const tsRaw = String(row?.totalShipping ?? '').trim();
  if (tsRaw === '') {
    return {
      shippingPerUnit: 0,
      finalRate: baseRate,
      amount: roundMoney2(qty * baseRate),
      totalShippingNum: 0,
      hasLineShipping: false,
    };
  }
  const tsNum = parseFloat(tsRaw.replace(/,/g, ''));
  const totalShippingNum = Number.isFinite(tsNum) ? roundMoney2(tsNum) : 0;
  const shippingPerUnit = qty > 0 ? roundMoney2(totalShippingNum / qty) : 0;
  const finalRate = roundMoney2(baseRate + shippingPerUnit);
  const amount = roundMoney2(finalRate * qty);
  return {
    shippingPerUnit,
    finalRate,
    amount,
    totalShippingNum,
    hasLineShipping: true,
  };
}

const parseMoneyInput = (raw) => {
  const n = parseFloat(
    String(raw ?? '')
      .replace(/,/g, '')
      .trim()
  );
  return Number.isFinite(n) ? roundMoney2(n) : 0;
};

const totalToAmountPaidString = (total) => roundMoney2(total).toFixed(2);

const localDateInputValue = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const formatDisplayDate = (yyyyMmDd) => {
  if (!yyyyMmDd || String(yyyyMmDd).length < 10) return '—';
  const d = new Date(`${String(yyyyMmDd).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const productPickerLabel = (p) => {
  if (!p || typeof p !== 'object') return 'Product';
  return p.product_name || p.name || p.product_code || 'Product';
};

const productPickerUnitPrice = (p) => {
  if (!p || typeof p !== 'object') return 0;
  const v = p.product_price ?? p.price;
  if (v == null || v === '') return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
};

const productPickerWholesalePrice = (p) => {
  if (!p || typeof p !== 'object') return null;
  const nested = p.product && typeof p.product === 'object' ? p.product : null;
  const wRaw =
    p.wholesale_price ??
    p.wholesalePrice ??
    nested?.wholesale_price ??
    nested?.wholesalePrice;
  if (wRaw == null || wRaw === '') return null;
  const w = typeof wRaw === 'number' ? wRaw : parseFloat(String(wRaw).replace(/,/g, ''));
  return Number.isFinite(w) ? roundMoney2(w) : null;
};

/** PO line rate: `wholesale_price` when present (including 0), else retail fallback. */
const productPickerDefaultLineRate = (p) => {
  const wholesale = productPickerWholesalePrice(p);
  if (wholesale !== null) return wholesale;
  return roundMoney2(productPickerUnitPrice(p));
};

const normalizeProductDetail = (result) => {
  if (!result || typeof result !== 'object') return null;
  if (result.data && typeof result.data === 'object' && !Array.isArray(result.data)) {
    return result.data;
  }
  if (result.product && typeof result.product === 'object') return result.product;
  if (result._id || result.id) return result;
  return null;
};

const newLineKey = () => `po-line-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const ADD_VENDOR_INITIAL = { name: '', email: '', phone: '03' };

const emptyForm = () => ({
  purchase_order_no: '',
  supplier_id: '',
  order_status: 'placed',
  notes: '',
  expected_delivery_date: localDateInputValue(),
  shipment: '',
  discount: '',
  account_id: '',
  amount_received: '',
});

const accountOptionLabel = (a) => {
  if (!a || typeof a !== 'object') return 'Account';
  const name = a.name ?? a.accountName ?? '';
  return name || 'Account';
};

const accountOptionValue = (a) => {
  if (!a || typeof a !== 'object') return '';
  return String(a._id ?? a.id ?? '').trim();
};

const warehouseOptionValue = (w) => {
  if (!w || typeof w !== 'object') return '';
  return String(w._id ?? w.id ?? '').trim();
};

const warehouseOptionLabel = (w) => {
  if (!w || typeof w !== 'object') return 'Warehouse';
  return w.name ?? w.warehouse_name ?? w.title ?? 'Warehouse';
};

/** Coerce populated warehouse refs to an id string. */
function idFromWarehouseRef(raw) {
  if (raw == null || raw === '') return '';
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const id = raw._id ?? raw.$oid ?? raw.id;
    return id != null ? String(id).trim() : '';
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) return String(raw);
  return String(raw).trim();
}

/**
 * Find the warehouse-inventory row id for the chosen warehouse (from product search payload).
 */
function resolveWarehouseInventoryId(warehouseInventoryRows, warehouseId) {
  const wid = String(warehouseId ?? '').trim();
  if (!wid || !Array.isArray(warehouseInventoryRows)) return '';
  for (const row of warehouseInventoryRows) {
    if (!row || typeof row !== 'object') continue;
    const rowWid = idFromWarehouseRef(row.warehouse_id ?? row.warehouseId ?? row.warehouse);
    if (rowWid === wid) {
      const invId = row._id ?? row.id;
      if (invId != null && String(invId).trim() !== '') return String(invId).trim();
    }
  }
  return '';
}

const PurchaseOrderReturnAdd = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const authUser = useSelector((state) => state.user.user);
  const authCompany = useSelector((state) => state.user.company);
  const [form, setForm] = useState(() => emptyForm());
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [users, setUsers] = useState([]);
  const [usersStatus, setUsersStatus] = useState('idle');
  const [usersError, setUsersError] = useState(null);
  const [addVendorForm, setAddVendorForm] = useState(ADD_VENDOR_INITIAL);
  const [addVendorErrors, setAddVendorErrors] = useState({});
  const [createVendorSubmitting, setCreateVendorSubmitting] = useState(false);
  const [createVendorError, setCreateVendorError] = useState('');

  const [lines, setLines] = useState([]);
  const [addProductQuery, setAddProductQuery] = useState('');
  const [addProductResults, setAddProductResults] = useState([]);
  const [addProductLoading, setAddProductLoading] = useState(false);
  const [addProductError, setAddProductError] = useState('');

  const [accounts, setAccounts] = useState([]);
  const [accountsStatus, setAccountsStatus] = useState('idle');
  const [accountsError, setAccountsError] = useState(null);
  const [amountPaidDirty, setAmountPaidDirty] = useState(false);
  const [warehouses, setWarehouses] = useState([]);
  const [warehousesStatus, setWarehousesStatus] = useState('idle');
  const [poCompany, setPoCompany] = useState(null);

  const loadUsers = useCallback(async (selectAfter) => {
    setUsersStatus('loading');
    setUsersError(null);
    try {
      const list = await fetchUsersListRequest({ limit: 2000, skip: 0, role: 'VENDOR' });
      const arr = Array.isArray(list) ? list : [];
      setUsers(arr);
      setUsersStatus('succeeded');
      if (selectAfter?.preferId) {
        setForm((p) => ({ ...p, supplier_id: String(selectAfter.preferId) }));
      } else if (selectAfter?.fallbackEmail) {
        const em = selectAfter.fallbackEmail.trim().toLowerCase();
        const match = arr.find((u) => (u.email || '').toLowerCase() === em);
        if (match) {
          setForm((p) => ({ ...p, supplier_id: getUserOptionValue(match) }));
        }
      }
    } catch (err) {
      console.error('[Purchase order return add] Failed to load users for supplier dropdown', err);
      setUsers([]);
      setUsersError(err?.message || 'Could not load users');
      setUsersStatus('failed');
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    let cancelled = false;
    setWarehousesStatus('loading');
    (async () => {
      try {
        const result = await fetchWarehousesRequest({ page: 1, limit: 1000 });
        const list = Array.isArray(result?.data) ? result.data : [];
        if (!cancelled) {
          setWarehouses(list);
          setWarehousesStatus('succeeded');
        }
      } catch (err) {
        if (!cancelled) {
          setWarehouses([]);
          setWarehousesStatus('failed');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setAccountsStatus('loading');
    setAccountsError(null);
    (async () => {
      try {
        const accountFilters = await buildExpenseDefaultAccountFilterParams(authUser, authCompany);
        const result = await fetchAccountsRequest({
          page: 1,
          limit: 500,
          sortBy: 'name',
          sortOrder: 'asc',
          account_type: accountFilters.account_type,
          include_id: accountFilters.include_id,
          exclude_id: accountFilters.exclude_id,
        });
        const list = Array.isArray(result?.data) ? result.data : [];
        if (!cancelled) {
          setAccounts(list);
          setAccountsStatus('succeeded');
        }
      } catch (err) {
        console.error('[Purchase order return add] Failed to load payment accounts', err);
        if (!cancelled) {
          setAccounts([]);
          setAccountsError(err?.message || 'Could not load payment accounts');
          setAccountsStatus('failed');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authUser, authCompany]);

  useEffect(() => {
    const companyId =
      getCompanyIdFromUser(authUser) ||
      String(authCompany?._id ?? authCompany?.id ?? '').trim();
    if (!companyId) return undefined;

    let cancelled = false;
    (async () => {
      try {
        const body = await fetchCompanyById(companyId);
        const company = getCompanyFromApiBody(body);
        if (!cancelled && company) {
          setPoCompany(mergeCompanyRecordForSettings(company, authCompany));
        }
      } catch (err) {
        console.warn('[Purchase order return add] Could not load company branding', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authUser, authCompany]);

  useEffect(() => {
    const q = addProductQuery.trim();
    if (q.length < 2) {
      setAddProductResults([]);
      setAddProductError('');
      return undefined;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      setAddProductLoading(true);
      setAddProductError('');
      try {
        const res = await fetchProductActiveRequest({ search: q, page: 1, limit: 30 });
        if (cancelled) return;
        setAddProductResults(Array.isArray(res?.data) ? res.data : []);
      } catch (e) {
        if (!cancelled) {
          setAddProductError(e?.message || 'Search failed');
          setAddProductResults([]);
        }
      } finally {
        if (!cancelled) setAddProductLoading(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [addProductQuery]);

  const supplierOptions = useMemo(
    () =>
      [...users]
        .filter((u) => getUserOptionValue(u))
        .sort((a, b) => formatUserOptionLabel(a).localeCompare(formatUserOptionLabel(b))),
    [users]
  );

  const supplierLabel = useMemo(() => {
    const id = String(form.supplier_id ?? '').trim();
    if (!id) return 'No supplier selected';
    const u = supplierOptions.find((x) => String(getUserOptionValue(x)) === id);
    return u ? formatUserOptionLabel(u) : `Supplier #${id}`;
  }, [form.supplier_id, supplierOptions]);

  const accountOptions = useMemo(
    () =>
      [...accounts]
        .filter((a) => accountOptionValue(a))
        .sort((x, y) => accountOptionLabel(x).localeCompare(accountOptionLabel(y))),
    [accounts]
  );

  const warehouseOptions = useMemo(
    () => [...warehouses].filter((w) => warehouseOptionValue(w)),
    [warehouses]
  );

  const defaultWarehouseId = useMemo(
    () => (warehouseOptions.length > 0 ? warehouseOptionValue(warehouseOptions[0]) : ''),
    [warehouseOptions]
  );

  const handleLineEdit = useCallback((key, field, rawValue) => {
    setLines((prev) => prev.map((row) => (row.key === key ? { ...row, [field]: rawValue } : row)));
  }, []);

  const removeLine = useCallback((key) => {
    setLines((prev) => prev.filter((row) => row.key !== key));
  }, []);

  const appendProduct = useCallback(
    async (product) => {
      if (!product || typeof product !== 'object') return;
      const id = String(product._id ?? product.id ?? '').trim();
      if (!id) return;

      let resolved = product;
      if (productPickerWholesalePrice(product) === null) {
        try {
          const detail = await fetchProductByIdRequest(id);
          const full = normalizeProductDetail(detail);
          if (full) resolved = { ...product, ...full };
        } catch (err) {
          console.warn('[Purchase order return add] Could not load product wholesale price', err);
        }
      }

      const rate = productPickerDefaultLineRate(resolved);
      setLines((prev) => [
        ...prev,
        {
          key: newLineKey(),
          productId: id,
          label: productPickerLabel(resolved),
          qty: '1',
          rate: String(rate),
          totalShipping: '',
          warehouseId: defaultWarehouseId,
          warehouseInventoryRows: Array.isArray(resolved.warehouse_inventory)
            ? resolved.warehouse_inventory
            : Array.isArray(product.warehouse_inventory)
              ? product.warehouse_inventory
              : [],
        },
      ]);
      setAddProductQuery('');
      setAddProductResults([]);
      setAddProductError('');
    },
    [defaultWarehouseId]
  );

  const summary = useMemo(() => {
    let subTotal = 0;
    lines.forEach((row) => {
      if (!String(row?.productId ?? '').trim()) return;
      const { amount } = computeLineDerived(row);
      subTotal += amount;
    });
    const shipNum = parseFloat(String(form.shipment ?? '').replace(/,/g, ''));
    const discNum = parseFloat(String(form.discount ?? '').replace(/,/g, ''));
    const shipment = Number.isFinite(shipNum) ? shipNum : 0;
    const discount = Number.isFinite(discNum) ? discNum : 0;
    const total = Math.max(0, subTotal + shipment - discount);
    return { subTotal, shipment, discount, total };
  }, [lines, form.shipment, form.discount]);

  useEffect(() => {
    if (amountPaidDirty) return;
    const next = totalToAmountPaidString(summary.total);
    setForm((p) => (p.amount_received === next ? p : { ...p, amount_received: next }));
  }, [summary.total, amountPaidDirty]);

  const amountPaidNum = useMemo(
    () => parseMoneyInput(form.amount_received),
    [form.amount_received]
  );
  const paymentRemaining = useMemo(() => {
    const t = roundMoney2(summary.total);
    const p = roundMoney2(amountPaidNum);
    return Math.max(0, t - p);
  }, [summary.total, amountPaidNum]);

  const activeCompany = useMemo(
    () => mergeCompanyRecordForSettings(poCompany, authCompany),
    [poCompany, authCompany]
  );

  const printerSettings = useMemo(() => {
    const parsed = extractPrinterSettingsFromCompanyBody({ data: activeCompany });
    return mergePrinterSettings(parsed);
  }, [activeCompany]);

  const companyBrand = useMemo(() => {
    const name = activeCompany?.company_name || activeCompany?.name || shopName;
    return {
      name: String(name || shopName).trim() || shopName,
      phone: String(activeCompany?.company_phone || activeCompany?.phone || '').trim(),
      email: String(activeCompany?.company_email || activeCompany?.email || '').trim(),
      address: String(activeCompany?.company_address || activeCompany?.address || '').trim(),
      logoUrl: pickCompanyLogoUrl(activeCompany),
    };
  }, [activeCompany]);

  const poPrintDate = useMemo(() => formatInvoiceDate(new Date().toISOString()), []);

  const printLines = useMemo(
    () =>
      lines
        .filter((row) => String(row?.productId ?? '').trim())
        .map((row) => {
          const { amount, finalRate } = computeLineDerived(row);
          const qtyNum = parseFloat(String(row.qty ?? '0').replace(/,/g, ''));
          const qty = Number.isFinite(qtyNum) ? qtyNum : 0;
          const qtyLabel = Number.isInteger(qty) ? String(qty) : qty.toFixed(2);
          return {
            description: row.label || 'Product',
            rate: finalRate,
            qtyLabel,
            amount,
          };
        }),
    [lines]
  );

  const handleNormalPrint = useCallback(async () => {
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
          brand = {
            name: String(merged?.company_name || merged?.name || shopName).trim() || shopName,
            phone: String(merged?.company_phone || merged?.phone || '').trim(),
            email: String(merged?.company_email || merged?.email || '').trim(),
            address: String(merged?.company_address || merged?.address || '').trim(),
            logoUrl: pickCompanyLogoUrl(merged),
          };
        }
      } catch {
        // print with last known settings
      }
    }

    const supplierUser = supplierOptions.find(
      (u) => String(getUserOptionValue(u)) === String(form.supplier_id).trim()
    );
    const payAccount = accountOptions.find(
      (a) => accountOptionValue(a) === String(form.account_id).trim()
    );

    await openNormalInvoicePrint(
      {
        printerSettings: settings,
        companyBrand: brand,
        invoiceNo: form.purchase_order_no.trim() || 'Draft',
        invoiceDate: poPrintDate,
        terms: form.notes.trim() || 'Purchase Order Return',
        note: form.expected_delivery_date
          ? `Expected delivery: ${formatDisplayDate(form.expected_delivery_date)}`
          : '',
        billTo: {
          name: supplierLabel,
          phone: String(
            supplierUser?.mobile ?? supplierUser?.phone ?? supplierUser?.phoneNumber ?? ''
          ).trim(),
          email: String(supplierUser?.email ?? '').trim(),
        },
        lines: printLines,
        summary: {
          subTotal: summary.subTotal,
          tax: 0,
          discount: summary.discount,
          shipping: summary.shipment,
          total: summary.total,
          paymentMade: amountPaidNum,
          balanceDue: paymentRemaining,
        },
        grossAmount: summary.total,
        paymentMethod: payAccount ? accountOptionLabel(payAccount) : '—',
        amountReceived: form.amount_received,
      },
      {
        documentTitlePrefix: 'Purchase Order Return',
        invoiceNumberPrefix: 'POR#',
        documentHeading: 'PURCHASE ORDER RETURN',
        billToLabel: 'Supplier',
        dateLabel: 'Order Date:',
      }
    );
  }, [
    printerSettings,
    companyBrand,
    authUser,
    authCompany,
    supplierOptions,
    accountOptions,
    form.purchase_order_no,
    form.notes,
    form.expected_delivery_date,
    form.supplier_id,
    form.account_id,
    form.amount_received,
    poPrintDate,
    supplierLabel,
    printLines,
    summary,
    amountPaidNum,
    paymentRemaining,
  ]);

  const hasSaveableLines = useMemo(
    () => lines.some((d) => String(d?.productId ?? '').trim()),
    [lines]
  );

  const hasVendor = Boolean(String(form.supplier_id ?? '').trim());
  const hasPaymentAccount = Boolean(String(form.account_id ?? '').trim());

  const submitDisabled = isSubmitting || !hasSaveableLines || !hasVendor || !hasPaymentAccount;
  const submitButtonTitle = !hasVendor
    ? 'Select a vendor'
    : !hasSaveableLines
      ? 'Add at least one product line'
      : !hasPaymentAccount
        ? 'Select mode of payment'
        : undefined;

  const buildPayload = () => {
    const itemRows = lines
      .map((d) => {
        const product_id = String(d?.productId ?? '').trim();
        const warehouse_id = String(d?.warehouseId ?? '').trim();
        const warehouse_inventory_id = resolveWarehouseInventoryId(
          d?.warehouseInventoryRows,
          warehouse_id
        );
        const qtyNum = parseFloat(String(d?.qty ?? '0').replace(/,/g, ''));
        const qty = Number.isFinite(qtyNum) ? qtyNum : 0;
        const derived = computeLineDerived(d);
        const price = derived.finalRate;
        return {
          product_id,
          warehouse_id,
          ...(warehouse_inventory_id ? { warehouse_inventory_id } : {}),
          qty,
          price,
          shipping_per_unit: roundMoney2(derived.shippingPerUnit),
          total_shipping: roundMoney2(derived.hasLineShipping ? derived.totalShippingNum : 0),
        };
      })
      .filter((l) => l.product_id);

    const shipmentStr = String(form.shipment ?? '').trim();
    const discountStr = String(form.discount ?? '').trim();
    const accountStr = String(form.account_id ?? '').trim();
    const totalRounded = roundMoney2(summary.total);
    const paidRounded = roundMoney2(parseMoneyInput(form.amount_received));
    const remainingAmount = Math.max(0, totalRounded - paidRounded);

    const payload = {
      purchase_order_no: form.purchase_order_no.trim(),
      supplier_id: form.supplier_id.trim() || undefined,
      order_status: form.order_status || 'placed',
      notes: form.notes.trim() || undefined,
      shipment: shipmentStr === '' ? '0' : shipmentStr,
      discount: discountStr === '' ? '0' : discountStr,
      account_id: accountStr === '' ? undefined : accountStr,
      payment_method_accounts_id: accountStr === '' ? undefined : accountStr,
      amount_received: form.amount_received ?? '',
      remaining_amount: String(remainingAmount),
      total_amount: String(totalRounded),
      /** Line items → `product_id[n]`, `qty[n]`, `price[n]`, `shipping_per_unit[n]`, `total_shipping[n]`. */
      items: itemRows,
    };
    if (form.expected_delivery_date) {
      payload.expected_delivery_date = form.expected_delivery_date;
    }
    return Object.fromEntries(
      Object.entries(payload).filter(([key, v]) => {
        if (v === undefined) return false;
        if (Array.isArray(v)) return v.length > 0;
        if (v === '' && key !== 'amount_received') return false;
        return true;
      })
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!hasVendor) {
      setErrors({ submit: 'Select a vendor (supplier) before creating the purchase order return.' });
      return;
    }
    if (!hasSaveableLines) {
      setErrors({ submit: 'Add at least one product with quantity and price.' });
      return;
    }
    if (!hasPaymentAccount) {
      setErrors({
        submit: 'Mode of payment is required.',
        account_id: 'Mode of payment is required.',
      });
      return;
    }
    setErrors({});
    setIsSubmitting(true);
    try {
      await dispatch(createPurchaseOrderReturn(buildPayload())).unwrap();
      navigate('/purchase-order-returns');
    } catch (err) {
      const submitError =
        (typeof err === 'string'
          ? err
          : String(err?.payload ?? err?.message ?? err ?? '').trim()) ||
        'Failed to create purchase order return';
      setErrors((prev) => ({
        ...prev,
        submit: submitError,
      }));
      toast.error(submitError, { delay: 12000 });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openAddVendorModal = () => {
    setAddVendorForm(ADD_VENDOR_INITIAL);
    setAddVendorErrors({});
    setCreateVendorError('');
    const el = document.getElementById('poAddVendorModal');
    if (el && window.bootstrap?.Modal) {
      const M = window.bootstrap.Modal;
      const instance =
        typeof M.getOrCreateInstance === 'function'
          ? M.getOrCreateInstance(el)
          : M.getInstance(el) || new M(el);
      instance.show();
    }
  };

  const closeAddVendorModal = () => {
    const el = document.getElementById('poAddVendorModal');
    if (el && window.bootstrap?.Modal) {
      const instance = window.bootstrap.Modal.getInstance(el);
      instance?.hide();
    }
  };

  const validateAddVendor = () => {
    const next = {};
    if (!addVendorForm.name.trim()) {
      next.name = 'Name is required';
    }
    const emailTrim = addVendorForm.email.trim();
    if (emailTrim && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
      next.email = 'Enter a valid email';
    }
    if (!addVendorForm.phone.trim()) {
      next.phone = 'Phone is required';
    } else {
      const phoneDigits = digitsOnlyFromPhone(addVendorForm.phone);
      if (phoneDigits.length < 7) {
        next.phone = 'Enter a valid phone number (at least 7 digits)';
      } else if (phoneDigits.length > 11) {
        next.phone = 'Phone number must be 11 digits or less';
      }
    }
    setAddVendorErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleAddVendorFieldChange = (e) => {
    const { name, value } = e.target;
    const nextValue = name === 'phone' ? digitsOnlyFromPhone(value).slice(0, 11) : value;
    setAddVendorForm((prev) => ({ ...prev, [name]: nextValue }));
    if (addVendorErrors[name]) {
      setAddVendorErrors((prev) => ({ ...prev, [name]: '' }));
    }
    setCreateVendorError('');
  };

  const handleAddVendorSubmit = async (e) => {
    e.preventDefault();
    setCreateVendorError('');
    if (!validateAddVendor()) {
      return;
    }
    setCreateVendorSubmitting(true);
    try {
      const resolvedEmail = resolvePosCustomerEmail(addVendorForm.email, addVendorForm.phone);
      const json = await createCustomerUserRequest({
        name: addVendorForm.name,
        email: addVendorForm.email,
        phone: addVendorForm.phone,
        password: POS_DEFAULT_CUSTOMER_PASSWORD,
        role: ['VENDOR'],
      });
      const created = pickCreatedUserFromResponse(json);
      const newId = getUserOptionValue(created);
      await loadUsers({
        preferId: newId || undefined,
        fallbackEmail: newId ? undefined : resolvedEmail,
      });
      setAddVendorForm(ADD_VENDOR_INITIAL);
      closeAddVendorModal();
      toast.success('Vendor created and selected.');
    } catch (err) {
      console.error('[Purchase order return add] Create vendor failed', err);
      setCreateVendorError(err?.message || 'Could not create vendor');
    } finally {
      setCreateVendorSubmitting(false);
    }
  };

  const supplierSelectDisabled = isSubmitting || usersStatus === 'loading';
  const accountSelectDisabled = isSubmitting || accountsStatus === 'loading';

  return (
    <div className="po-add-page container-fluid py-3 px-2 px-lg-4">
      <style>{`
        .po-add-page {
          font-family: 'Open Sans', 'Segoe UI', system-ui, sans-serif;
          max-width: 1100px;
          margin: 0 auto;
        }
        .po-add-paper {
          background: #fff;
          border: 1px solid #e9ecef;
          border-radius: 0.5rem;
          box-shadow: 0 0.125rem 0.5rem rgba(0,0,0,.06);
        }
        .po-add-title {
          font-size: 2rem;
          font-weight: 800;
          letter-spacing: 0.06em;
          color: #212529;
        }
        .po-add-supplier-name {
          color: #11cdef;
          font-weight: 700;
        }
        .po-add-table th {
          background: #f8f9fa;
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          color: #495057;
          border-color: #dee2e6 !important;
        }
        .po-add-table td {
          border-color: #dee2e6 !important;
          vertical-align: middle;
          font-size: 0.875rem;
        }
        .po-add-summary-row {
          display: flex;
          justify-content: space-between;
          padding: 0.25rem 0;
          font-size: 0.9rem;
        }
        .po-add-summary-total {
          font-weight: 700;
          border-top: 1px solid #dee2e6;
          margin-top: 0.35rem;
          padding-top: 0.5rem;
        }
        .po-add-actions .btn {
          border-radius: 0.5rem;
          font-weight: 600;
          font-size: 0.8rem;
        }
        .po-add-vendor-btn {
          background: #11cdef;
          border-color: #11cdef;
          color: #fff;
        }
        .po-add-vendor-btn:hover {
          background: #0ea5c6;
          border-color: #0ea5c6;
          color: #fff;
        }
      `}</style>

      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          onClick={() => navigate('/purchase-order-returns')}
        >
          <i className="fas fa-arrow-left me-1" aria-hidden="true" />
          Back to list
        </button>
        <div className="d-flex gap-2 po-add-actions">
          <button
            type="button"
            className="btn btn-success"
            onClick={handleNormalPrint}
            disabled={!hasSaveableLines}
            title={!hasSaveableLines ? 'Add at least one product line' : 'A4 print'}
          >
            <i className="fas fa-print me-1" aria-hidden="true" />
            Normal Print
          </button>
          <button
            type="submit"
            form="po-add-form"
            className="btn btn-primary"
            disabled={submitDisabled}
            title={submitButtonTitle}
          >
            {isSubmitting ? (
              <>
                <span
                  className="spinner-border spinner-border-sm me-1"
                  role="status"
                  aria-hidden="true"
                />
                Saving…
              </>
            ) : (
              <>
                <i className="fas fa-save me-1" aria-hidden="true" />
                Create purchase order return
              </>
            )}
          </button>
        </div>
      </div>

      <form id="po-add-form" onSubmit={handleSubmit}>
        {errors.submit ? (
          <div className="alert alert-danger py-2 mb-3" role="alert">
            {errors.submit}
          </div>
        ) : null}

        <div className="po-add-paper p-4 p-md-5 mb-4">
          <div className="row align-items-start mb-4 pb-3 border-bottom">
            <div className="col-md-6 mb-3 mb-md-0">
              <div className="d-flex align-items-center gap-3">
                {companyBrand.logoUrl ? (
                  <img
                    src={companyBrand.logoUrl}
                    alt={`${companyBrand.name} logo`}
                    className="rounded border bg-white flex-shrink-0"
                    style={{ width: 72, height: 72, objectFit: 'contain' }}
                  />
                ) : (
                  <div
                    className="rounded border bg-light d-flex align-items-center justify-content-center flex-shrink-0"
                    style={{ width: 72, height: 72 }}
                  >
                    <span className="fw-bold text-primary fs-4">
                      {companyBrand.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div>
                  <div
                    className="fw-bold text-uppercase text-secondary"
                    style={{ fontSize: '0.75rem' }}
                  >
                    {companyBrand.name}
                  </div>
                  <div className="h5 mb-0 fw-semibold">{companyBrand.name}</div>
                </div>
              </div>
            </div>
            <div className="col-md-6 text-md-end">
              <div className="po-add-title mb-2">PURCHASE ORDER RETURN</div>
              <div className="mb-1">
                <span className="text-muted">Reference / PO no. </span>
                <span className="fw-bold">{form.purchase_order_no.trim() || '—'}</span>
              </div>
              <div className="small text-muted mb-2">
                New draft — number assigned by system when saved
              </div>
              <div className="fw-semibold">Order total: {fmt(summary.total)}</div>
            </div>
          </div>

          <div className="row mb-4">
            <div className="col-md-6 mb-3 mb-md-0">
              <div className="text-uppercase text-muted small fw-bold mb-2">Supplier</div>
              <div className="po-add-supplier-name mb-2">{supplierLabel}</div>
              <label className="form-label small text-muted mb-1" htmlFor="po-add-supplier">
                Vendor <span className="text-danger">*</span>
              </label>
              {usersStatus === 'failed' && usersError ? (
                <div className="alert alert-warning py-2 mb-2" role="alert">
                  {usersError}
                </div>
              ) : null}
              <div className="d-flex gap-2 align-items-start">
                <select
                  id="po-add-supplier"
                  className="form-select form-select-sm flex-grow-1"
                  value={form.supplier_id}
                  onChange={(e) => setForm((p) => ({ ...p, supplier_id: e.target.value }))}
                  disabled={supplierSelectDisabled}
                >
                  <option value="">No supplier</option>
                  {supplierOptions.map((u) => {
                    const value = getUserOptionValue(u);
                    return (
                      <option key={value} value={value}>
                        {formatUserOptionLabel(u)}
                      </option>
                    );
                  })}
                </select>
                <button
                  type="button"
                  className="btn btn-sm po-add-vendor-btn flex-shrink-0"
                  title="Add new vendor"
                  onClick={openAddVendorModal}
                  disabled={isSubmitting}
                >
                  Add
                </button>
              </div>
            </div>
            <div className="col-md-6 text-md-end">
              <div className="small mb-2">
                <span className="text-muted me-2">Order date:</span>
                <span className="fw-semibold">{formatDisplayDate(localDateInputValue())}</span>
              </div>
              <div className="small mb-2">
                <span className="text-muted me-2">Expected delivery:</span>
                <span className="fw-semibold">
                  {formatDisplayDate(form.expected_delivery_date)}
                </span>
              </div>
              <div className="row g-2 justify-content-md-end mt-2">
                <div className="col-12 col-md-8 col-lg-6">
                  <label className="form-label small text-muted mb-1" htmlFor="po-add-expected">
                    Expected delivery
                  </label>
                  <input
                    id="po-add-expected"
                    type="date"
                    className="form-control form-control-sm"
                    value={form.expected_delivery_date}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, expected_delivery_date: e.target.value }))
                    }
                    disabled={isSubmitting}
                  />
                </div>
                <div className="col-12 col-md-8 col-lg-6">
                  <label className="form-label small text-muted mb-1" htmlFor="po-add-status">
                    Status
                  </label>
                  <select
                    id="po-add-status"
                    className="form-select form-select-sm"
                    value={form.order_status}
                    onChange={(e) => setForm((p) => ({ ...p, order_status: e.target.value }))}
                    disabled={isSubmitting}
                  >
                    {PO_STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="mb-3">
            <label className="form-label small text-muted mb-1" htmlFor="po-add-product-search">
              Add product
            </label>
            <input
              id="po-add-product-search"
              type="search"
              className="form-control form-control-sm"
              placeholder="Search name, SKU, or barcode (min. 2 characters)…"
              value={addProductQuery}
              onChange={(e) => setAddProductQuery(e.target.value)}
              autoComplete="off"
              disabled={isSubmitting}
            />
            {addProductLoading ? <div className="small text-muted mt-1">Searching…</div> : null}
            {addProductError ? (
              <div className="text-danger small mt-1" role="alert">
                {addProductError}
              </div>
            ) : null}
            {addProductResults.length > 0 ? (
              <ul
                className="list-group position-relative w-100 shadow-sm mt-1"
                style={{ zIndex: 20, maxHeight: '220px', overflowY: 'auto' }}
              >
                {addProductResults.map((p) => {
                  const pk = String(p._id ?? p.id ?? '');
                  return (
                    <li key={pk} className="list-group-item p-0">
                      <button
                        type="button"
                        className="list-group-item list-group-item-action border-0 py-2 px-3 text-start w-100"
                        onClick={() => appendProduct(p)}
                      >
                        <span className="fw-semibold">{productPickerLabel(p)}</span>
                        <span className="text-muted ms-2">
                          Wholesale {fmt(productPickerWholesalePrice(p) ?? productPickerUnitPrice(p))}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>

          <p className="small text-muted mb-2">
            Set <strong>Warehouse</strong>, <strong>Rate</strong> (wholesale price),{' '}
            <strong>Qty</strong>, and optional <strong>Total Shipping</strong> per line.{' '}
            <strong>Shipping per unit</strong> is calculated automatically; <strong>Amount</strong>{' '}
            uses final rate (rate + shipping per unit) × qty. Remove rows you do not need.
          </p>

          <div className="table-responsive mb-4">
            <table className="table table-bordered po-add-table mb-0">
              <thead>
                <tr>
                  <th style={{ width: '48px' }}>#</th>
                  <th>Description</th>
                  <th style={{ minWidth: '180px' }}>Warehouse</th>
                  <th className="text-end" style={{ width: '120px' }}>
                    Rate
                  </th>
                  <th className="text-end" style={{ width: '120px' }}>
                    Qty
                  </th>
                  <th className="text-end" style={{ minWidth: '130px' }}>
                    Shipping / unit
                  </th>
                  <th className="text-end" style={{ minWidth: '130px' }}>
                    Total shipping
                  </th>
                  <th className="text-end" style={{ width: '120px' }}>
                    Amount
                  </th>
                  <th className="text-center" style={{ width: '72px' }} aria-label="Remove row" />
                </tr>
              </thead>
              <tbody>
                {lines.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center text-muted py-4">
                      No line items. Use <strong>Add product</strong> above to add rows.
                    </td>
                  </tr>
                ) : (
                  lines.map((row, i) => {
                    const derived = computeLineDerived(row);
                    const { shippingPerUnit, amount, hasLineShipping } = derived;
                    return (
                      <tr key={row.key}>
                        <td className="text-center">{i + 1}</td>
                        <td>
                          <div>{row.label}</div>
                          {!String(row.productId || '').trim() ? (
                            <div className="small text-warning">
                              Missing product — remove or pick again.
                            </div>
                          ) : null}
                        </td>
                        <td className="align-middle">
                          <select
                            className="form-select form-select-sm"
                            aria-label={`Warehouse for line ${i + 1}`}
                            value={String(row.warehouseId ?? '')}
                            onChange={(e) => handleLineEdit(row.key, 'warehouseId', e.target.value)}
                            disabled={isSubmitting || warehousesStatus === 'loading'}
                          >
                            <option value="">Select warehouse</option>
                            {warehouseOptions.map((w) => {
                              const value = warehouseOptionValue(w);
                              return (
                                <option key={value} value={value}>
                                  {warehouseOptionLabel(w)}
                                </option>
                              );
                            })}
                          </select>
                        </td>
                        <td className="text-end align-middle">
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            className="form-control form-control-sm text-end"
                            aria-label={`Rate for line ${i + 1}`}
                            value={row.rate}
                            onChange={(e) => handleLineEdit(row.key, 'rate', e.target.value)}
                            disabled={isSubmitting}
                          />
                        </td>
                        <td className="text-end align-middle">
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            className="form-control form-control-sm text-end"
                            aria-label={`Quantity for line ${i + 1}`}
                            value={row.qty}
                            onChange={(e) => handleLineEdit(row.key, 'qty', e.target.value)}
                            disabled={isSubmitting}
                          />
                        </td>
                        <td className="text-end align-middle">
                          <div
                            className="form-control form-control-sm text-end bg-light border mb-0 py-1"
                            title="Total shipping ÷ qty (read-only)"
                            aria-label={`Shipping per unit for line ${i + 1}`}
                          >
                            {hasLineShipping ? fmt(shippingPerUnit) : '—'}
                          </div>
                        </td>
                        <td className="text-end align-middle">
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            className="form-control form-control-sm text-end"
                            placeholder="0.00"
                            aria-label={`Total shipping for line ${i + 1}`}
                            value={row.totalShipping ?? ''}
                            onChange={(e) =>
                              handleLineEdit(row.key, 'totalShipping', e.target.value)
                            }
                            disabled={isSubmitting}
                          />
                        </td>
                        <td className="text-end fw-semibold align-middle">{fmt(amount)}</td>
                        <td className="text-center align-middle">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger py-0 px-2"
                            aria-label={`Remove line ${i + 1}`}
                            onClick={() => removeLine(row.key)}
                            disabled={isSubmitting}
                          >
                            <i className="fas fa-trash-alt" aria-hidden="true" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="row mb-2">
            <div className="col-md-6 mb-3 mb-md-0">
              <label className="form-label small text-muted mb-1" htmlFor="po-add-notes">
                Notes
              </label>
              <textarea
                id="po-add-notes"
                className="form-control form-control-sm"
                rows={4}
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                disabled={isSubmitting}
                placeholder="Internal notes…"
              />
            </div>
            <div className="col-md-6">
              <div className="text-uppercase text-muted small fw-bold mb-2">Summary</div>
              <div className="row g-2 mb-3">
                <div className="col-12 col-sm-6">
                  <label className="form-label small text-muted mb-1" htmlFor="po-add-shipment">
                    Shipment
                  </label>
                  <input
                    id="po-add-shipment"
                    type="number"
                    min={0}
                    step="0.01"
                    className="form-control form-control-sm text-end"
                    placeholder="0.00"
                    value={form.shipment}
                    onChange={(e) => setForm((p) => ({ ...p, shipment: e.target.value }))}
                    disabled={isSubmitting}
                  />
                </div>
                <div className="col-12 col-sm-6">
                  <label className="form-label small text-muted mb-1" htmlFor="po-add-discount">
                    Discount
                  </label>
                  <input
                    id="po-add-discount"
                    type="number"
                    min={0}
                    step="0.01"
                    className="form-control form-control-sm text-end"
                    placeholder="0.00"
                    value={form.discount}
                    onChange={(e) => setForm((p) => ({ ...p, discount: e.target.value }))}
                    disabled={isSubmitting}
                  />
                </div>
                <div className="col-12">
                  <label className="form-label small text-muted mb-1" htmlFor="po-add-account">
                    Mode of payment <span className="text-danger">*</span>
                  </label>
                  {accountsStatus === 'failed' && accountsError ? (
                    <div className="alert alert-warning py-2 mb-2" role="alert">
                      {accountsError}
                    </div>
                  ) : null}
                  <select
                    id="po-add-account"
                    className={`form-select form-select-sm ${errors.account_id ? 'is-invalid' : ''}`}
                    value={form.account_id}
                    onChange={(e) => {
                      const v = e.target.value;
                      setForm((p) => ({ ...p, account_id: v }));
                      setErrors((prev) => {
                        const next = { ...prev };
                        delete next.account_id;
                        if (next.submit === 'Mode of payment is required.') delete next.submit;
                        return next;
                      });
                    }}
                    required
                    disabled={accountSelectDisabled}
                  >
                    <option value="">Select mode of payment</option>
                    {accountOptions.map((a) => {
                      const value = accountOptionValue(a);
                      return (
                        <option key={value} value={value}>
                          {accountOptionLabel(a)}
                        </option>
                      );
                    })}
                  </select>
                  {errors.account_id ? (
                    <div className="text-danger small mt-1">{errors.account_id}</div>
                  ) : null}
                </div>
              </div>
              <div className="border rounded p-3 bg-light">
                <div className="po-add-summary-row">
                  <span className="text-muted">Sub total</span>
                  <span className="fw-semibold">{fmt(summary.subTotal)}</span>
                </div>
                <div className="po-add-summary-row">
                  <span className="text-muted">Shipment</span>
                  <span className="fw-semibold">{fmt(summary.shipment)}</span>
                </div>
                <div className="po-add-summary-row">
                  <span className="text-muted">Discount</span>
                  <span className="fw-semibold">−{fmt(summary.discount)}</span>
                </div>
                <div className="po-add-summary-row po-add-summary-total">
                  <span>Total</span>
                  <span>{fmt(summary.total)}</span>
                </div>
              </div>
              <div className="text-uppercase text-muted small fw-bold mb-2 mt-3">Payment</div>
              <div className="row g-2">
                <div className="col-md-6">
                  <label className="form-label small text-muted mb-1" htmlFor="po-add-received">
                    Amount paid
                  </label>
                  <input
                    id="po-add-received"
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    className="form-control form-control-sm"
                    value={form.amount_received}
                    onChange={(e) => {
                      setAmountPaidDirty(true);
                      setForm((p) => ({
                        ...p,
                        amount_received: sanitizeAmountPaidInput(e.target.value),
                      }));
                    }}
                    disabled={isSubmitting}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label small text-muted mb-1" htmlFor="po-add-remaining">
                    Remaining
                  </label>
                  <input
                    id="po-add-remaining"
                    type="text"
                    readOnly
                    tabIndex={-1}
                    className="form-control form-control-sm bg-body-secondary"
                    value={fmt(paymentRemaining)}
                    aria-live="polite"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="d-flex flex-wrap justify-content-end gap-2 pt-3 mt-3 border-top po-add-actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitDisabled}
              title={submitButtonTitle}
            >
              {isSubmitting ? (
                <>
                  <span
                    className="spinner-border spinner-border-sm me-1"
                    role="status"
                    aria-hidden="true"
                  />
                  Saving…
                </>
              ) : (
                <>
                  <i className="fas fa-save me-1" aria-hidden="true" />
                  Create purchase order return
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      <div
        className="modal fade"
        id="poAddVendorModal"
        tabIndex="-1"
        aria-labelledby="poAddVendorModalLabel"
        aria-hidden="true"
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id="poAddVendorModalLabel">
                Add vendor
              </h5>
              <button
                type="button"
                className="btn-close"
                data-bs-dismiss="modal"
                aria-label="Close"
              ></button>
            </div>
            <form onSubmit={handleAddVendorSubmit}>
              <div className="modal-body">
                <input type="hidden" name="role" value="VENDOR" readOnly />
                <input
                  type="hidden"
                  name="password"
                  value={POS_DEFAULT_CUSTOMER_PASSWORD}
                  readOnly
                  autoComplete="new-password"
                />
                <div className="mb-3">
                  <label htmlFor="po_vendor_name" className="form-label">
                    Name <span className="text-danger">*</span>
                  </label>
                  <input
                    id="po_vendor_name"
                    name="name"
                    type="text"
                    className={`form-control ${addVendorErrors.name ? 'is-invalid' : ''}`}
                    value={addVendorForm.name}
                    onChange={handleAddVendorFieldChange}
                    autoComplete="name"
                  />
                  {addVendorErrors.name && (
                    <div className="invalid-feedback">{addVendorErrors.name}</div>
                  )}
                </div>
                <div className="mb-0">
                  <label htmlFor="po_vendor_phone" className="form-label">
                    Phone <span className="text-danger">*</span>
                  </label>
                  <input
                    id="po_vendor_phone"
                    name="phone"
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={11}
                    className={`form-control ${addVendorErrors.phone ? 'is-invalid' : ''}`}
                    value={addVendorForm.phone}
                    onChange={handleAddVendorFieldChange}
                    autoComplete="tel"
                    placeholder="Digits only"
                  />
                  {addVendorErrors.phone && (
                    <div className="invalid-feedback">{addVendorErrors.phone}</div>
                  )}
                </div>
                <div className="mb-3">
                  <label htmlFor="po_vendor_email" className="form-label">
                    Email <span className="text-muted font-weight-normal">(optional)</span>
                  </label>
                  <input
                    id="po_vendor_email"
                    name="email"
                    type="email"
                    className={`form-control ${addVendorErrors.email ? 'is-invalid' : ''}`}
                    value={addVendorForm.email}
                    onChange={handleAddVendorFieldChange}
                    autoComplete="email"
                    placeholder="Leave empty to use phone@gmail.com"
                  />
                  <small className="text-muted text-xs">
                    If empty, the saved email is your phone digits + @gmail.com (e.g.
                    03001234567@gmail.com).
                  </small>
                  {addVendorErrors.email && (
                    <div className="invalid-feedback d-block">{addVendorErrors.email}</div>
                  )}
                </div>

                {createVendorError && (
                  <div className="alert alert-danger text-sm mt-3 mb-0 py-2" role="alert">
                    {createVendorError}
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" data-bs-dismiss="modal">
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn po-add-vendor-btn"
                  disabled={createVendorSubmitting}
                >
                  {createVendorSubmitting ? (
                    <>
                      <span
                        className="spinner-border spinner-border-sm me-2"
                        role="status"
                        aria-hidden="true"
                      ></span>
                      Saving…
                    </>
                  ) : (
                    'Create vendor'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PurchaseOrderReturnAdd;
