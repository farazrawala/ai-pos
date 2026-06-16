import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
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
import { formatInvoiceDate } from '../../features/orders/invoiceViewMapper.js';
import {
  fetchSalesReturnById,
  updateSalesReturn,
  clearCurrentSalesReturn,
  clearUpdateStatus,
} from '../../features/salesReturns/salesReturnsSlice.js';
import {
  fetchProductActiveRequest,
  fetchProductByIdRequest,
} from '../../features/products/productsAPI.js';
import { fetchWarehousesRequest } from '../../features/warehouse/warehouseAPI.js';
import {
  fetchUsersListRequest,
  formatUserOptionLabel,
  getUserOptionValue,
} from '../../features/users/usersAPI.js';
import { fetchAccountsRequest } from '../../features/accounts/accountsAPI.js';
import { buildExpenseDefaultAccountFilterParams } from '../../features/expenses/expensesAPI.js';
import { PO_STATUS_OPTIONS, sanitizeAmountPaidInput } from './srFormConstants.js';
import { poStatusBadgeClass } from '../purchase_order/poFormConstants.js';
import SearchInputIcon from '../../components/SearchInputIcon.jsx';
import { toast } from '../../utils/toast.js';
import '../purchase_order/po-form-module.css';

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

/** API may return populated refs; coerce to a plain id string for `<select value>` and comparisons. */
function pickIdString(raw) {
  if (raw == null || raw === '') return '';
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const id = raw._id ?? raw.id ?? raw.$oid;
    return id != null ? String(id).trim() : '';
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) return String(raw);
  const s = String(raw).trim();
  if (s === '[object Object]') return '';
  return s;
}

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

const shopName =
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_SHOP_NAME
    ? String(import.meta.env.VITE_SHOP_NAME)
    : 'Store';

const fmt = (n) =>
  `PKR ${Number(n).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const roundMoney2 = (n) => {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 100) / 100;
};

/**
 * Per-line shipping: Total Shipping ÷ Qty → Shipping Per Unit; Final Rate = base Rate + per unit; Amount = Final Rate × Qty.
 * Empty Total Shipping resets to base rate only. Qty ≤ 0 → shipping per unit 0.
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
  const n = parseFloat(String(raw ?? '').replace(/,/g, '').trim());
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

const newLineKey = () => `po-edit-line-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const resolveProductId = (it) => {
  if (!it || typeof it !== 'object') return '';
  const p = it.product_id;
  if (typeof p === 'string' || typeof p === 'number') return String(p).trim();
  if (p && typeof p === 'object') return String(p._id ?? p.id ?? '').trim();
  return String(it.productId ?? it.product?._id ?? it.product?.id ?? '').trim();
};

const linesFromPurchaseOrder = (po) => {
  if (!po || typeof po !== 'object') return [];
  const raw = [
    po.items,
    po.sales_return_items,
    po.salesReturnItems,
    po.sales_order_items,
    po.salesOrderItems,
    po.lines,
    po.products,
  ].find(Array.isArray);
  if (!raw) return [];
  return raw
    .map((it) => {
      const prodObj =
        it?.product && typeof it.product === 'object'
          ? it.product
          : typeof it?.product_id === 'object' && it?.product_id
            ? it.product_id
            : null;
      const productId = resolveProductId(it);
      if (!productId) return null;
      const qtyRaw = it.qty ?? it.quantity ?? it.qty_ordered ?? 1;
      const priceRaw = it.price ?? it.rate ?? it.unit_price;
      const qtyStr = qtyRaw != null ? String(qtyRaw) : '1';
      const tsLine = it.total_shipping ?? it.totalShipping;
      const totalShipStr =
        tsLine != null && String(tsLine).trim() !== '' ? String(tsLine).trim() : '';
      const spuLine = it.shipping_per_unit ?? it.shippingPerUnit;

      let rateStr = '';
      if (priceRaw != null && String(priceRaw).trim() !== '') {
        const p = parseFloat(String(priceRaw).replace(/,/g, ''));
        if (totalShipStr !== '') {
          let spu = parseFloat(String(spuLine ?? '').replace(/,/g, ''));
          if (!Number.isFinite(spu)) {
            const q = parseFloat(String(qtyRaw).replace(/,/g, ''));
            const ts = parseFloat(totalShipStr.replace(/,/g, ''));
            spu = Number.isFinite(q) && q > 0 && Number.isFinite(ts) ? ts / q : 0;
          }
          rateStr = Number.isFinite(p)
            ? String(roundMoney2(Math.max(0, p - (Number.isFinite(spu) ? spu : 0))))
            : String(priceRaw);
        } else {
          rateStr = String(priceRaw);
        }
      } else if (it.amount != null) {
        const q = parseFloat(String(qtyRaw).replace(/,/g, ''));
        if (Number.isFinite(q) && q > 0) {
          const perUnit = Number(it.amount) / q;
          if (totalShipStr !== '') {
            const ts = parseFloat(totalShipStr.replace(/,/g, ''));
            const spu = Number.isFinite(ts) && q > 0 ? ts / q : 0;
            rateStr = String(roundMoney2(Math.max(0, perUnit - spu)));
          } else {
            rateStr = String(perUnit);
          }
        }
      }
      const whRaw = it.warehouse_id ?? it.warehouseId ?? it.warehouse;
      const warehouseId = pickIdString(whRaw);
      const invFromProduct =
        prodObj && Array.isArray(prodObj.warehouse_inventory) ? prodObj.warehouse_inventory : [];
      const wi = it.warehouse_inventory;
      const invFromLine = Array.isArray(wi) ? wi : wi && typeof wi === 'object' ? [wi] : [];
      const warehouseInventoryRows =
        invFromProduct.length > 0 ? invFromProduct : invFromLine;
      const presetWarehouseInventoryId = pickIdString(
        it.warehouse_inventory_id ?? it.warehouseInventoryId
      );
      return {
        key: newLineKey(),
        productId,
        label: productPickerLabel(prodObj || it) || `Product #${productId}`,
        qty: qtyStr,
        rate: rateStr,
        totalShipping: totalShipStr,
        warehouseId,
        warehouseInventoryRows,
        presetWarehouseInventoryId,
        presetWarehouseId: warehouseId,
      };
    })
    .filter(Boolean);
};

const recordToForm = (po) => ({
  sales_order_no:
    po?.sales_return_no ??
    po?.salesReturnNo ??
    po?.sales_order_no ??
    po?.po_no ??
    po?.order_no ??
    po?.reference ??
    po?.ref_no ??
    '',
  customer_id: (() => {
    if (po?.customer_id != null && po.customer_id !== '') return pickIdString(po.customer_id);
    if (po?.customer_id != null && po.customer_id !== '') return pickIdString(po.customer_id);
    if (po?.customer != null) {
      if (typeof po.customer === 'object') return pickIdString(po.customer._id ?? po.customer);
      return pickIdString(po.customer);
    }
    return '';
  })(),
  order_status:
    po?.return_status ??
    po?.returnStatus ??
    po?.order_status ??
    po?.status ??
    po?.sales_order_status ??
    po?.po_status ??
    'placed',
  notes: po?.notes ?? po?.remarks ?? po?.description ?? '',
  expected_delivery_date: (() => {
    const raw = po?.expected_delivery_date ?? po?.expectedDeliveryDate ?? '';
    if (raw == null || String(raw).trim() === '') return localDateInputValue();
    const s = String(raw);
    return s.length >= 10 ? s.slice(0, 10) : s;
  })(),
  discount: po?.discount != null && po?.discount !== '' ? String(po.discount) : '',
  shipment: (() => {
    const v = po?.shipment ?? po?.shipping;
    if (v == null || v === '') return '';
    return String(v);
  })(),
  account_id: (() => {
    const raw = po?.account_id ?? po?.payment_method_accounts_id;
    if (raw == null || raw === '') return '';
    return pickIdString(raw);
  })(),
  amount_received: (() => {
    const paid = po?.amount_paid ?? po?.amount_received;
    if (paid != null && String(paid).trim() !== '') return String(paid);
    return '';
  })(),
});

const SalesReturnEdit = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { id } = useParams();
  const { currentSalesReturn, fetchStatus, fetchError, updateStatus, updateError } = useSelector(
    (state) => state.salesReturns
  );
  const authUser = useSelector((state) => state.user.user);
  const authCompany = useSelector((state) => state.user.company);
  const [form, setForm] = useState(recordToForm(null));
  const [lines, setLines] = useState([]);
  const [errors, setErrors] = useState({});
  const [users, setUsers] = useState([]);
  const [usersStatus, setUsersStatus] = useState('idle');
  const [usersError, setUsersError] = useState(null);
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
  const isSubmitting = updateStatus === 'loading';

  useEffect(() => {
    let cancelled = false;
    setUsersStatus('loading');
    setUsersError(null);
    (async () => {
      try {
        const list = await fetchUsersListRequest({ limit: 2000, skip: 0 });
        const arr = Array.isArray(list) ? list : [];
        if (!cancelled) {
          setUsers(arr);
          setUsersStatus('succeeded');
        }
      } catch (err) {
        console.error('[Sales return edit] Failed to load users for customer dropdown', err);
        if (!cancelled) {
          setUsers([]);
          setUsersError(err?.message || 'Could not load users');
          setUsersStatus('failed');
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
        console.error('[Sales return edit] Failed to load payment accounts', err);
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
    if (id) dispatch(fetchSalesReturnById(id));
    return () => {
      dispatch(clearCurrentSalesReturn());
      dispatch(clearUpdateStatus());
    };
  }, [dispatch, id]);

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
        console.warn('[Sales return edit] Could not load company branding', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authUser, authCompany]);

  useEffect(() => {
    if (currentSalesReturn) {
      setForm(recordToForm(currentSalesReturn));
      setLines(linesFromPurchaseOrder(currentSalesReturn));
      setAmountPaidDirty(false);
    }
  }, [currentSalesReturn]);

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

  const customerOptions = useMemo(
    () =>
      [...users]
        .filter((u) => getUserOptionValue(u))
        .sort((a, b) => formatUserOptionLabel(a).localeCompare(formatUserOptionLabel(b))),
    [users]
  );

  const customerLabel = useMemo(() => {
    const sid = String(form.customer_id ?? '').trim();
    if (!sid) return 'No customer selected';
    const u = customerOptions.find((x) => String(getUserOptionValue(x)) === sid);
    return u ? formatUserOptionLabel(u) : `Customer #${sid}`;
  }, [form.customer_id, customerOptions]);

  const customerIdInList =
    !form.customer_id ||
    customerOptions.some((u) => String(getUserOptionValue(u)).trim() === String(form.customer_id).trim());

  const accountOptions = useMemo(
    () =>
      [...accounts]
        .filter((a) => accountOptionValue(a))
        .sort((x, y) => accountOptionLabel(x).localeCompare(accountOptionLabel(y))),
    [accounts]
  );

  const accountIdInList =
    !form.account_id ||
    accountOptions.some((a) => accountOptionValue(a) === String(form.account_id));

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
      const pid = String(product._id ?? product.id ?? '').trim();
      if (!pid) return;

      let resolved = product;
      if (productPickerWholesalePrice(product) === null) {
        try {
          const detail = await fetchProductByIdRequest(pid);
          const full = normalizeProductDetail(detail);
          if (full) resolved = { ...product, ...full };
        } catch (err) {
          console.warn('[Sales return edit] Could not load product wholesale price', err);
        }
      }

      const rate = productPickerDefaultLineRate(resolved);
      setLines((prev) => [
        ...prev,
        {
          key: newLineKey(),
          productId: pid,
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
          presetWarehouseInventoryId: '',
          presetWarehouseId: '',
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

  const amountPaidNum = useMemo(() => parseMoneyInput(form.amount_received), [form.amount_received]);
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

  const srPrintDate = useMemo(() => {
    const raw =
      currentSalesReturn?.createdAt ??
      currentSalesReturn?.created_at ??
      currentSalesReturn?.updatedAt ??
      currentSalesReturn?.updated_at;
    if (raw) return formatInvoiceDate(raw);
    if (form.expected_delivery_date) {
      const d = new Date(`${String(form.expected_delivery_date).slice(0, 10)}T12:00:00`);
      if (!Number.isNaN(d.getTime())) return formatInvoiceDate(d.toISOString());
    }
    return formatInvoiceDate(new Date().toISOString());
  }, [currentSalesReturn, form.expected_delivery_date]);

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

    const customerUser = customerOptions.find(
      (u) => String(getUserOptionValue(u)) === String(form.customer_id).trim()
    );
    const payAccount = accountOptions.find(
      (a) => accountOptionValue(a) === String(form.account_id).trim()
    );

    await openNormalInvoicePrint(
      {
        printerSettings: settings,
        companyBrand: brand,
        invoiceNo: form.sales_order_no.trim() || '—',
        invoiceDate: srPrintDate,
        terms: form.notes.trim() || 'Sales Return',
        note: form.expected_delivery_date
          ? `Expected delivery: ${formatDisplayDate(form.expected_delivery_date)}`
          : '',
        billTo: {
          name: customerLabel,
          phone: String(
            customerUser?.mobile ?? customerUser?.phone ?? customerUser?.phoneNumber ?? ''
          ).trim(),
          email: String(customerUser?.email ?? '').trim(),
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
        documentTitlePrefix: 'Sales Return',
        invoiceNumberPrefix: 'SR#',
        documentHeading: 'SALES RETURN',
        billToLabel: 'Customer',
        dateLabel: 'Return Date:',
      }
    );
  }, [
    printerSettings,
    companyBrand,
    authUser,
    authCompany,
    customerOptions,
    accountOptions,
    form.sales_order_no,
    form.notes,
    form.expected_delivery_date,
    form.customer_id,
    form.account_id,
    form.amount_received,
    srPrintDate,
    customerLabel,
    printLines,
    summary,
    amountPaidNum,
    paymentRemaining,
  ]);

  const hasSaveableLines = useMemo(
    () => lines.some((d) => String(d?.productId ?? '').trim()),
    [lines]
  );

  const hasCustomer = Boolean(String(form.customer_id ?? '').trim());
  const hasPaymentAccount = Boolean(String(form.account_id ?? '').trim());

  const submitDisabled =
    isSubmitting || !hasSaveableLines || !hasCustomer || !id || !hasPaymentAccount;
  const submitButtonTitle = !hasCustomer
    ? 'Select a customer'
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
        const resolvedInv = resolveWarehouseInventoryId(d?.warehouseInventoryRows, warehouse_id);
        const presetInv = String(d?.presetWarehouseInventoryId ?? '').trim();
        const presetWid = String(d?.presetWarehouseId ?? '').trim();
        let warehouse_inventory_id = resolvedInv;
        if (!warehouse_inventory_id && presetInv && presetWid && presetWid === warehouse_id) {
          warehouse_inventory_id = presetInv;
        }
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

    const totalRounded = roundMoney2(summary.total);
    const paidRounded = roundMoney2(parseMoneyInput(form.amount_received));
    const remainingAmount = Math.max(0, totalRounded - paidRounded);
    const accountStr = String(form.account_id ?? '').trim();

    return {
      customer_id: form.customer_id.trim(),
      sales_order_no: form.sales_order_no.trim(),
      notes: form.notes.trim(),
      order_status: form.order_status || 'placed',
      discount: form.discount.trim(),
      shipment: form.shipment.trim() || undefined,
      account_id: accountStr === '' ? undefined : accountStr,
      payment_method_accounts_id: accountStr === '' ? undefined : accountStr,
      amount_received: form.amount_received,
      remaining_amount: String(remainingAmount),
      total_amount: String(totalRounded),
      items: itemRows,
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!id) return;
    if (!hasCustomer) {
      setErrors({ submit: 'Select a customer (customer) before saving.' });
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
    try {
      await dispatch(
        updateSalesReturn({ salesReturnId: id, salesReturnData: buildPayload() })
      ).unwrap();
      navigate('/sales-returns');
    } catch (err) {
      const submitError =
        (typeof err === 'string'
          ? err
          : String(err?.payload ?? err?.message ?? err ?? '').trim()) ||
        'Failed to update sales return';
      setErrors((prev) => ({
        ...prev,
        submit: submitError,
      }));
      toast.error(submitError, { delay: 12000 });
    }
  };

  const customerSelectDisabled = isSubmitting || usersStatus === 'loading';
  const accountSelectDisabled = isSubmitting || accountsStatus === 'loading';

  if (fetchStatus === 'loading') {
    return (
      <div className="po-form-page container-fluid py-4">
        <div className="card shadow-sm po-form-card mx-auto" style={{ maxWidth: 1200 }}>
          <div className="card-body py-5 text-center text-muted">Loading sales return…</div>
        </div>
      </div>
    );
  }
  if (fetchStatus === 'failed') {
    return (
      <div className="po-form-page container-fluid py-4">
        <div className="card shadow-sm po-form-card mx-auto" style={{ maxWidth: 1200 }}>
          <div className="card-body">
            <div className="alert alert-danger mb-3" role="alert">
              {fetchError || 'Failed to load sales return.'}
            </div>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={() => navigate('/sales-returns')}
            >
              Back to list
            </button>
          </div>
        </div>
      </div>
    );
  }

  const returnRefLabel = form.sales_order_no.trim() || '—';
  const statusLabel = form.order_status
    ? form.order_status.charAt(0).toUpperCase() + form.order_status.slice(1)
    : '—';

  return (
    <div className="po-form-page container-fluid py-4 px-0">
      <div className="row mt-4">
        <div className="col-12" style={{ padding: '20px' }}>
          <div className="card shadow-sm po-form-card">
            <div className="card-header pb-3">
              <div className="row align-items-center w-100 g-2">
                <div className="col-lg-6">
                  <button
                    type="button"
                    className="po-form-back"
                    onClick={() => navigate('/sales-returns')}
                  >
                    <i className="fas fa-arrow-left" aria-hidden="true" />
                    Back to list
                  </button>
                  <h5 className="po-form-header-title mb-0">Edit sales return</h5>
                  <div className="po-form-meta mt-2">
                    <span className="po-form-ref-badge">{returnRefLabel}</span>
                    <span className={`badge text-xxs ${poStatusBadgeClass(form.order_status)}`}>
                      {statusLabel}
                    </span>
                    <span className="po-form-total-pill">Total {fmt(summary.total)}</span>
                  </div>
                </div>
                <div className="col-lg-6">
                  <div className="po-form-header-actions mt-2 mt-lg-0">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-success"
                      onClick={handleNormalPrint}
                      disabled={!hasSaveableLines}
                      title={!hasSaveableLines ? 'Add at least one product line' : 'A4 print'}
                    >
                      <i className="fas fa-print me-1" aria-hidden="true" />
                      Print
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="card-body pt-3">
              <form id="po-edit-form" onSubmit={handleSubmit}>
                {updateError ? (
                  <div className="alert alert-warning py-2 mb-3" role="alert">
                    {updateError}
                  </div>
                ) : null}
                {errors.submit ? (
                  <div className="alert alert-danger py-2 mb-3" role="alert">
                    {errors.submit}
                  </div>
                ) : null}

                <div className="po-form-doc-strip">
                  <div className="po-form-company">
                    {companyBrand.logoUrl ? (
                      <img
                        src={companyBrand.logoUrl}
                        alt={`${companyBrand.name} logo`}
                        className="po-form-company-logo"
                      />
                    ) : (
                      <div className="po-form-company-logo-fallback">
                        {companyBrand.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="po-form-company-name">{companyBrand.name}</div>
                      <div className="po-form-company-meta">
                        {[companyBrand.email, companyBrand.phone].filter(Boolean).join(' · ') ||
                          'Sales return'}
                      </div>
                    </div>
                  </div>
                  <div className="text-md-end">
                    <div className="text-uppercase text-muted small fw-bold mb-1">Return total</div>
                    <div className="h5 mb-0 fw-bold text-dark">{fmt(summary.total)}</div>
                  </div>
                </div>

                <div className="po-form-section">
                  <div className="po-form-section-title">Return details</div>
                  <div className="row g-3">
                    <div className="col-lg-6">
                      <label className="form-label" htmlFor="po-edit-customer">
                        Customer <span className="text-danger">*</span>
                      </label>
                      {usersStatus === 'failed' && usersError ? (
                        <div className="alert alert-warning py-2 mb-2" role="alert">
                          {usersError}
                        </div>
                      ) : null}
                      <select
                        id="po-edit-customer"
                        className="form-select form-select-sm"
                        value={String(form.customer_id ?? '')}
                        onChange={(e) => setForm((p) => ({ ...p, customer_id: e.target.value }))}
                        disabled={customerSelectDisabled}
                      >
                        <option value="">Select customer</option>
                        {!customerIdInList && form.customer_id ? (
                          <option value={String(form.customer_id)}>
                            Customer id: {String(form.customer_id)}
                          </option>
                        ) : null}
                        {customerOptions.map((u) => {
                          const value = getUserOptionValue(u);
                          return (
                            <option key={value} value={value}>
                              {formatUserOptionLabel(u)}
                            </option>
                          );
                        })}
                      </select>
                      {hasCustomer ? (
                        <span className="d-block small text-muted mt-1">{customerLabel}</span>
                      ) : null}
                    </div>
                    <div className="col-md-6 col-lg-3">
                      <label className="form-label" htmlFor="po-edit-expected">
                        Expected delivery
                      </label>
                      <input
                        id="po-edit-expected"
                        type="date"
                        className="form-control form-control-sm"
                        value={form.expected_delivery_date}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, expected_delivery_date: e.target.value }))
                        }
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="col-md-6 col-lg-3">
                      <label className="form-label" htmlFor="po-edit-status">
                        Return status
                      </label>
                      <select
                        id="po-edit-status"
                        className="form-select form-select-sm"
                        value={form.order_status}
                        onChange={(e) => setForm((p) => ({ ...p, order_status: e.target.value }))}
                        disabled={isSubmitting}
                      >
                        {form.order_status && !PO_STATUS_OPTIONS.includes(form.order_status) ? (
                          <option value={form.order_status}>{form.order_status}</option>
                        ) : null}
                        {PO_STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {s.charAt(0).toUpperCase() + s.slice(1)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="po-form-section">
                  <div className="po-form-section-title">Line items</div>
                  <p className="po-form-section-hint">
                    Search to add products, then set warehouse, rate, quantity, and optional shipping per
                    line.
                  </p>
                  <label className="form-label" htmlFor="po-edit-product-search">
                    Add product
                  </label>
                  <div className="po-form-product-search mb-3">
                    <div className="input-group input-group-sm">
                      <span className="input-group-text">
                        <SearchInputIcon />
                      </span>
                      <input
                        id="po-edit-product-search"
                        type="search"
                        className="form-control"
                        placeholder="Search name, SKU, or barcode (min. 2 characters)…"
                        value={addProductQuery}
                        onChange={(e) => setAddProductQuery(e.target.value)}
                        autoComplete="off"
                        disabled={isSubmitting}
                      />
                    </div>
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
                                  Wholesale{' '}
                                  {fmt(productPickerWholesalePrice(p) ?? productPickerUnitPrice(p))}
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                  </div>

                  <div className="po-form-table-wrap">
                    <div className="po-form-table-scroll">
                      <table className="table po-form-table mb-0">
                        <thead>
                          <tr>
                            <th className="text-center po-form-col-sno">#</th>
                            <th className="po-form-col-desc">Description</th>
                            <th className="po-form-col-wh">Warehouse</th>
                            <th className="text-end po-form-col-num">Rate</th>
                            <th className="text-end po-form-col-num">Qty</th>
                            <th className="text-end po-form-col-ship">Ship / unit</th>
                            <th className="text-end po-form-col-ship">Total ship</th>
                            <th className="text-end po-form-col-amt">Amount</th>
                            <th className="text-center po-form-col-action" aria-label="Remove row" />
                          </tr>
                        </thead>
                        <tbody>
                          {lines.length === 0 ? (
                            <tr>
                              <td colSpan={9} className="text-center text-muted py-4">
                                No line items. Search above to add products.
                              </td>
                            </tr>
                          ) : (
                            lines.map((row, i) => {
                              const derived = computeLineDerived(row);
                              const { shippingPerUnit, amount, hasLineShipping } = derived;
                              return (
                                <tr key={row.key}>
                                  <td className="text-center text-muted">{i + 1}</td>
                                  <td>
                                    <div className="po-form-line-desc" title={row.label}>
                                      {row.label}
                                    </div>
                                    {!String(row.productId || '').trim() ? (
                                      <div className="small text-warning">Missing product</div>
                                    ) : null}
                                  </td>
                                  <td>
                                    <select
                                      className="form-select form-select-sm"
                                      aria-label={`Warehouse for line ${i + 1}`}
                                      value={String(row.warehouseId ?? '')}
                                      onChange={(e) =>
                                        handleLineEdit(row.key, 'warehouseId', e.target.value)
                                      }
                                      disabled={isSubmitting || warehousesStatus === 'loading'}
                                    >
                                      <option value="">Select</option>
                                      {(() => {
                                        const wid = String(row.warehouseId ?? '').trim();
                                        if (
                                          wid &&
                                          !warehouseOptions.some((w) => warehouseOptionValue(w) === wid)
                                        ) {
                                          return (
                                            <option value={wid} title={wid}>
                                              Current (not in list)
                                            </option>
                                          );
                                        }
                                        return null;
                                      })()}
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
                                  <td className="text-end">
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
                                  <td className="text-end">
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
                                  <td className="text-end">
                                    <div
                                      className="po-form-readonly-cell"
                                      title="Total shipping ÷ qty"
                                      aria-label={`Shipping per unit for line ${i + 1}`}
                                    >
                                      {hasLineShipping ? fmt(shippingPerUnit) : '—'}
                                    </div>
                                  </td>
                                  <td className="text-end">
                                    <input
                                      type="number"
                                      min={0}
                                      step="0.01"
                                      className="form-control form-control-sm text-end"
                                      placeholder="0"
                                      aria-label={`Total shipping for line ${i + 1}`}
                                      value={row.totalShipping ?? ''}
                                      onChange={(e) =>
                                        handleLineEdit(row.key, 'totalShipping', e.target.value)
                                      }
                                      disabled={isSubmitting}
                                    />
                                  </td>
                                  <td className="text-end fw-semibold text-nowrap">{fmt(amount)}</td>
                                  <td className="text-center">
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
                  </div>
                </div>

                <div className="po-form-section">
                  <div className="row g-4">
                    <div className="col-lg-6">
                      <div className="po-form-section-title">Notes</div>
                      <label className="form-label visually-hidden" htmlFor="po-edit-notes">
                        Notes
                      </label>
                      <textarea
                        id="po-edit-notes"
                        className="form-control form-control-sm"
                        rows={5}
                        value={form.notes}
                        onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                        disabled={isSubmitting}
                        placeholder="Internal notes…"
                      />
                    </div>
                    <div className="col-lg-6">
                      <div className="po-form-summary-panel">
                        <div className="po-form-section-title mb-3">Summary &amp; payment</div>
                        <div className="row g-2 mb-2">
                          <div className="col-6">
                            <label className="form-label" htmlFor="po-edit-shipment">
                              Shipment
                            </label>
                            <input
                              id="po-edit-shipment"
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
                          <div className="col-6">
                            <label className="form-label" htmlFor="po-edit-discount">
                              Discount
                            </label>
                            <input
                              id="po-edit-discount"
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
                            <label className="form-label" htmlFor="po-edit-account">
                              Mode of payment <span className="text-danger">*</span>
                            </label>
                            {accountsStatus === 'failed' && accountsError ? (
                              <div className="alert alert-warning py-2 mb-2" role="alert">
                                {accountsError}
                              </div>
                            ) : null}
                            <select
                              id="po-edit-account"
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
                              {!accountIdInList && form.account_id ? (
                                <option value={form.account_id}>Payment id: {form.account_id}</option>
                              ) : null}
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
                        <div className="po-form-summary-box">
                          <div className="po-form-summary-row">
                            <span>Sub total</span>
                            <span>{fmt(summary.subTotal)}</span>
                          </div>
                          <div className="po-form-summary-row">
                            <span>Shipment</span>
                            <span>{fmt(summary.shipment)}</span>
                          </div>
                          <div className="po-form-summary-row">
                            <span>Discount</span>
                            <span>−{fmt(summary.discount)}</span>
                          </div>
                          <div className="po-form-summary-row po-form-summary-total">
                            <span>Total</span>
                            <span>{fmt(summary.total)}</span>
                          </div>
                        </div>
                        <div className="row g-2 mt-3">
                          <div className="col-6">
                            <label className="form-label" htmlFor="po-edit-received">
                              Amount paid
                            </label>
                            <input
                              id="po-edit-received"
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
                          <div className="col-6">
                            <label className="form-label" htmlFor="po-edit-remaining">
                              Remaining
                            </label>
                            <input
                              id="po-edit-remaining"
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
                  </div>
                </div>

                <div className="po-form-footer">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    disabled={isSubmitting}
                    onClick={() => navigate('/sales-returns')}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
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
                        Save changes
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesReturnEdit;
