import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { FaBarcode } from 'react-icons/fa6';
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
import {
  fetchPurchaseOrderById,
  updatePurchaseOrder,
  clearCurrentPurchaseOrder,
  clearUpdateStatus,
} from '../../features/purchaseOrders/purchaseOrdersSlice.js';
import {
  fetchProductActiveRequest,
  fetchProductByIdRequest,
  generateUniqueProductBarcodeRequest,
} from '../../features/products/productsAPI.js';
import { fetchWarehousesRequest } from '../../features/warehouse/warehouseAPI.js';
import {
  fetchUsersListRequest,
  formatUserOptionLabel,
  getUserOptionValue,
} from '../../features/users/usersAPI.js';
import { fetchAccountsRequest } from '../../features/accounts/accountsAPI.js';
import { buildExpenseDefaultAccountFilterParams } from '../../features/expenses/expensesAPI.js';
import {
  PO_STATUS_OPTIONS,
  poStatusBadgeClass,
  sanitizeAmountPaidInput,
} from './poFormConstants.js';
import SearchInputIcon from '../../components/SearchInputIcon.jsx';
import { toast } from '../../utils/toast.js';
import './po-form-module.css';

const productBarcode = (p) => {
  if (!p || typeof p !== 'object') return '';
  return String(p.barcode ?? '').trim();
};

const lineHasBarcode = (row) => Boolean(String(row?.barcode ?? '').trim());

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
    p.wholesale_price ?? p.wholesalePrice ?? nested?.wholesale_price ?? nested?.wholesalePrice;
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
    po.purchase_order_items,
    po.purchaseOrderItems,
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
      const warehouseInventoryRows = invFromProduct.length > 0 ? invFromProduct : invFromLine;
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
        barcode: productBarcode(prodObj || it),
        barcodeResolved: Boolean(prodObj),
      };
    })
    .filter(Boolean);
};

const recordToForm = (po) => ({
  purchase_order_no:
    po?.purchase_order_no ?? po?.po_no ?? po?.order_no ?? po?.reference ?? po?.ref_no ?? '',
  supplier_id: (() => {
    if (po?.supplier_id != null && po.supplier_id !== '') return pickIdString(po.supplier_id);
    if (po?.vendor_id != null && po.vendor_id !== '') return pickIdString(po.vendor_id);
    if (po?.supplier != null) {
      if (typeof po.supplier === 'object') return pickIdString(po.supplier._id ?? po.supplier);
      return pickIdString(po.supplier);
    }
    return '';
  })(),
  order_status:
    po?.order_status ?? po?.status ?? po?.purchase_order_status ?? po?.po_status ?? 'placed',
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

const PurchaseOrderEdit = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { id } = useParams();
  const { currentPurchaseOrder, fetchStatus, fetchError, updateStatus, updateError } = useSelector(
    (state) => state.purchaseOrders
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
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [addingSelectedProducts, setAddingSelectedProducts] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [accountsStatus, setAccountsStatus] = useState('idle');
  const [accountsError, setAccountsError] = useState(null);
  const [amountPaidDirty, setAmountPaidDirty] = useState(false);
  const [warehouses, setWarehouses] = useState([]);
  const [warehousesStatus, setWarehousesStatus] = useState('idle');
  const [poCompany, setPoCompany] = useState(null);
  const [generatingBarcodeKeys, setGeneratingBarcodeKeys] = useState(() => new Set());
  const barcodeFetchRef = useRef(new Set());
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
        console.error('[Purchase order edit] Failed to load users for supplier dropdown', err);
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
        console.error('[Purchase order edit] Failed to load payment accounts', err);
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
    if (id) dispatch(fetchPurchaseOrderById(id));
    return () => {
      dispatch(clearCurrentPurchaseOrder());
      dispatch(clearUpdateStatus());
    };
  }, [dispatch, id]);

  useEffect(() => {
    const companyId =
      getCompanyIdFromUser(authUser) || String(authCompany?._id ?? authCompany?.id ?? '').trim();
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
        console.warn('[Purchase order edit] Could not load company branding', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authUser, authCompany]);

  useEffect(() => {
    if (currentPurchaseOrder) {
      barcodeFetchRef.current = new Set();
      setForm(recordToForm(currentPurchaseOrder));
      setLines(linesFromPurchaseOrder(currentPurchaseOrder));
      setAmountPaidDirty(false);
    }
  }, [currentPurchaseOrder]);

  useEffect(() => {
    const q = addProductQuery.trim();
    if (q.length < 2) {
      setAddProductResults([]);
      setAddProductError('');
      setSelectedProductIds([]);
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
        setSelectedProductIds([]);
      } catch (e) {
        if (!cancelled) {
          setAddProductError(e?.message || 'Search failed');
          setAddProductResults([]);
          setSelectedProductIds([]);
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
    const sid = String(form.supplier_id ?? '').trim();
    if (!sid) return 'No supplier selected';
    const u = supplierOptions.find((x) => String(getUserOptionValue(x)) === sid);
    return u ? formatUserOptionLabel(u) : `Supplier #${sid}`;
  }, [form.supplier_id, supplierOptions]);

  const supplierIdInList =
    !form.supplier_id ||
    supplierOptions.some(
      (u) => String(getUserOptionValue(u)).trim() === String(form.supplier_id).trim()
    );

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

  const buildLineFromProduct = useCallback(
    async (product) => {
      if (!product || typeof product !== 'object') return null;
      const pid = String(product._id ?? product.id ?? '').trim();
      if (!pid) return null;

      let resolved = product;
      if (productPickerWholesalePrice(product) === null) {
        try {
          const detail = await fetchProductByIdRequest(pid);
          const full = normalizeProductDetail(detail);
          if (full) resolved = { ...product, ...full };
        } catch (err) {
          console.warn('[Purchase order edit] Could not load product wholesale price', err);
        }
      }

      const rate = productPickerDefaultLineRate(resolved);
      return {
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
        barcode: productBarcode(resolved),
        barcodeResolved: true,
      };
    },
    [defaultWarehouseId]
  );

  useEffect(() => {
    const unresolved = lines.filter(
      (row) =>
        String(row?.productId ?? '').trim() &&
        !row.barcodeResolved &&
        !barcodeFetchRef.current.has(String(row.productId).trim())
    );
    if (!unresolved.length) return undefined;

    const keysByProductId = new Map();
    unresolved.forEach((row) => {
      const productId = String(row.productId).trim();
      if (!keysByProductId.has(productId)) keysByProductId.set(productId, []);
      keysByProductId.get(productId).push(row.key);
    });

    let cancelled = false;
    (async () => {
      await Promise.all(
        [...keysByProductId.entries()].map(async ([productId, keys]) => {
          barcodeFetchRef.current.add(productId);
          let barcode = '';
          try {
            const detail = await fetchProductByIdRequest(productId);
            barcode = productBarcode(normalizeProductDetail(detail));
          } catch (err) {
            console.warn('[Purchase order edit] Could not load product barcode', err);
          }
          if (cancelled) return;
          const keySet = new Set(keys);
          setLines((prev) =>
            prev.map((row) =>
              keySet.has(row.key) || String(row.productId ?? '').trim() === productId
                ? { ...row, barcode, barcodeResolved: true }
                : row
            )
          );
        })
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [lines]);

  const handleAssignBarcode = useCallback(async (row) => {
    const productId = String(row?.productId ?? '').trim();
    if (!productId) {
      toast.error('Missing product on this line');
      return;
    }
    if (lineHasBarcode(row)) {
      return;
    }

    setGeneratingBarcodeKeys((prev) => new Set(prev).add(row.key));
    try {
      const result = await generateUniqueProductBarcodeRequest(productId);
      const code = String(result?.data?.barcode ?? '').trim();
      if (!code) {
        throw new Error(result?.message || 'Failed to generate unique barcode');
      }
      setLines((prev) =>
        prev.map((r) =>
          String(r.productId ?? '').trim() === productId
            ? { ...r, barcode: code, barcodeResolved: true }
            : r
        )
      );
      toast.success(result?.message || `Barcode assigned: ${code}`);
    } catch (err) {
      console.error('[Purchase order edit] Failed to assign barcode', err);
      toast.error(err?.message || 'Failed to generate barcode');
    } finally {
      setGeneratingBarcodeKeys((prev) => {
        const next = new Set(prev);
        next.delete(row.key);
        return next;
      });
    }
  }, []);

  const appendProducts = useCallback(
    async (products) => {
      const list = (Array.isArray(products) ? products : [products]).filter(Boolean);
      if (!list.length) return;
      setAddingSelectedProducts(true);
      try {
        const rows = (
          await Promise.all(list.map((product) => buildLineFromProduct(product)))
        ).filter(Boolean);
        if (!rows.length) return;
        setLines((prev) => [...prev, ...rows]);
        setAddProductQuery('');
        setAddProductResults([]);
        setSelectedProductIds([]);
        setAddProductError('');
      } finally {
        setAddingSelectedProducts(false);
      }
    },
    [buildLineFromProduct]
  );

  const toggleProductSelected = useCallback((productId) => {
    const id = String(productId || '').trim();
    if (!id) return;
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  const allVisibleProductIds = useMemo(
    () =>
      addProductResults
        .map((p) => String(p?._id ?? p?.id ?? '').trim())
        .filter(Boolean),
    [addProductResults]
  );

  const allVisibleSelected =
    allVisibleProductIds.length > 0 &&
    allVisibleProductIds.every((id) => selectedProductIds.includes(id));

  const toggleSelectAllVisible = useCallback(() => {
    setSelectedProductIds((prev) => {
      if (
        allVisibleProductIds.length > 0 &&
        allVisibleProductIds.every((id) => prev.includes(id))
      ) {
        return prev.filter((id) => !allVisibleProductIds.includes(id));
      }
      return [...new Set([...prev, ...allVisibleProductIds])];
    });
  }, [allVisibleProductIds]);

  const handleAddSelectedProducts = useCallback(async () => {
    const selected = addProductResults.filter((p) => {
      const id = String(p?._id ?? p?.id ?? '').trim();
      return id && selectedProductIds.includes(id);
    });
    await appendProducts(selected);
  }, [addProductResults, selectedProductIds, appendProducts]);

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

  const poPrintDate = useMemo(() => {
    const raw =
      currentPurchaseOrder?.createdAt ??
      currentPurchaseOrder?.created_at ??
      currentPurchaseOrder?.updatedAt ??
      currentPurchaseOrder?.updated_at;
    if (raw) return formatInvoiceDate(raw);
    if (form.expected_delivery_date) {
      const d = new Date(`${String(form.expected_delivery_date).slice(0, 10)}T12:00:00`);
      if (!Number.isNaN(d.getTime())) return formatInvoiceDate(d.toISOString());
    }
    return formatInvoiceDate(new Date().toISOString());
  }, [currentPurchaseOrder, form.expected_delivery_date]);

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
      getCompanyIdFromUser(authUser) || String(authCompany?._id ?? authCompany?.id ?? '').trim();

    if (companyId) {
      try {
        const body = await fetchCompanyById(companyId);
        const company = getCompanyFromApiBody(body);
        if (company && typeof company === 'object') {
          const merged = mergeCompanyRecordForSettings(company, authCompany);
          settings = mergePrinterSettings(extractPrinterSettingsFromCompanyBody({ data: merged }));
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
        invoiceNo: form.purchase_order_no.trim() || '—',
        invoiceDate: poPrintDate,
        terms: form.notes.trim() || 'Purchase Order',
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
        documentTitlePrefix: 'Purchase Order',
        invoiceNumberPrefix: 'PO#',
        documentHeading: 'PURCHASE ORDER',
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

  const handleGenerateBarcode = useCallback(() => {
    const qtyByProductId = new Map();
    lines.forEach((row) => {
      const productId = String(row?.productId ?? '').trim();
      if (!productId) return;
      const qtyNum = parseFloat(String(row?.qty ?? '1').replace(/,/g, ''));
      const qty = Number.isFinite(qtyNum) && qtyNum > 0 ? Math.round(qtyNum) : 1;
      qtyByProductId.set(productId, (qtyByProductId.get(productId) || 0) + qty);
    });
    if (qtyByProductId.size === 0) return;

    const productIds = [];
    const qtys = [];
    qtyByProductId.forEach((qty, productId) => {
      productIds.push(productId);
      qtys.push(String(Math.max(1, Math.min(200, qty))));
    });

    const params = new URLSearchParams();
    params.set('product_ids', productIds.join(','));
    params.set('qty', qtys.join(','));
    params.set('bType', '2'); // CODE-128
    navigate(`/barcode-print?${params.toString()}`);
  }, [lines, navigate]);

  const hasVendor = Boolean(String(form.supplier_id ?? '').trim());
  const hasPaymentAccount = Boolean(String(form.account_id ?? '').trim());

  const submitDisabled =
    isSubmitting || !hasSaveableLines || !hasVendor || !id || !hasPaymentAccount;
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
      supplier_id: form.supplier_id.trim(),
      purchase_order_no: form.purchase_order_no.trim(),
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
    if (!hasVendor) {
      setErrors({ submit: 'Select a vendor (supplier) before saving.' });
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
        updatePurchaseOrder({ purchaseOrderId: id, purchaseOrderData: buildPayload() })
      ).unwrap();
      navigate('/purchase-orders');
    } catch (err) {
      const submitError =
        (typeof err === 'string'
          ? err
          : String(err?.payload ?? err?.message ?? err ?? '').trim()) ||
        'Failed to update purchase order';
      setErrors((prev) => ({
        ...prev,
        submit: submitError,
      }));
      toast.error(submitError, { delay: 12000 });
    }
  };

  const supplierSelectDisabled = isSubmitting || usersStatus === 'loading';
  const accountSelectDisabled = isSubmitting || accountsStatus === 'loading';

  if (fetchStatus === 'loading') {
    return (
      <div className="po-form-page container-fluid py-4">
        <div className="card shadow-sm po-form-card mx-auto" style={{ maxWidth: 1200 }}>
          <div className="card-body py-5 text-center text-muted">Loading purchase order…</div>
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
              {fetchError || 'Failed to load purchase order.'}
            </div>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={() => navigate('/purchase-orders')}
            >
              Back to list
            </button>
          </div>
        </div>
      </div>
    );
  }

  const poRefLabel = form.purchase_order_no.trim() || '—';
  const statusLabel = form.order_status
    ? form.order_status.charAt(0).toUpperCase() + form.order_status.slice(1)
    : '—';

  return (
    <div className="po-form-page container-fluid py-4 px-0">
      <div className="row">
        <div className="col-12" style={{ padding: '20px' }}>
          <div className="card shadow-sm po-form-card">
            <div className="card-header pb-3">
              <div className="row align-items-center w-100 g-2">
                <div className="col-lg-6">
                  <button
                    type="button"
                    className="po-form-back"
                    onClick={() => navigate('/purchase-orders')}
                  >
                    <i className="fas fa-arrow-left" aria-hidden="true" />
                    Back to list
                  </button>
                  <h5 className="po-form-header-title mb-0">Edit purchase order</h5>
                  <div className="po-form-meta mt-2">
                    <span className="po-form-ref-badge">{poRefLabel}</span>
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
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary"
                      onClick={handleGenerateBarcode}
                      disabled={!hasSaveableLines}
                      title={
                        !hasSaveableLines
                          ? 'Add at least one product line'
                          : 'Open barcode print with these products (CODE-128)'
                      }
                    >
                      <FaBarcode className="me-1" aria-hidden="true" />
                      Generate barcode
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
                          'Purchase order'}
                      </div>
                    </div>
                  </div>
                  <div className="text-md-end">
                    <div className="text-uppercase text-muted small fw-bold mb-1">Order total</div>
                    <div className="h5 mb-0 fw-bold text-dark">{fmt(summary.total)}</div>
                  </div>
                </div>

                <div className="po-form-section">
                  <div className="po-form-section-title">Order details</div>
                  <div className="row g-3">
                    <div className="col-lg-6">
                      <label className="form-label" htmlFor="po-edit-supplier">
                        Vendor <span className="text-danger">*</span>
                      </label>
                      {usersStatus === 'failed' && usersError ? (
                        <div className="alert alert-warning py-2 mb-2" role="alert">
                          {usersError}
                        </div>
                      ) : null}
                      <select
                        id="po-edit-supplier"
                        className="form-select form-select-sm"
                        value={String(form.supplier_id ?? '')}
                        onChange={(e) => setForm((p) => ({ ...p, supplier_id: e.target.value }))}
                        disabled={supplierSelectDisabled}
                      >
                        <option value="">Select vendor</option>
                        {!supplierIdInList && form.supplier_id ? (
                          <option value={String(form.supplier_id)}>
                            Supplier id: {String(form.supplier_id)}
                          </option>
                        ) : null}
                        {supplierOptions.map((u) => {
                          const value = getUserOptionValue(u);
                          return (
                            <option key={value} value={value}>
                              {formatUserOptionLabel(u)}
                            </option>
                          );
                        })}
                      </select>
                      {hasVendor ? (
                        <span className="d-block small text-muted mt-1">{supplierLabel}</span>
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
                        Order status
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
                    Search to add products, then set warehouse, rate, quantity, and optional
                    shipping per line.
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
                    {addProductLoading ? (
                      <div className="small text-muted mt-1">Searching…</div>
                    ) : null}
                    {addProductError ? (
                      <div className="text-danger small mt-1" role="alert">
                        {addProductError}
                      </div>
                    ) : null}
                    {addProductResults.length > 0 ? (
                      <div
                        className="po-form-product-results list-group position-relative w-100 shadow-sm mt-1"
                        style={{ zIndex: 20, maxHeight: '280px', overflowY: 'auto' }}
                      >
                        <div className="list-group-item d-flex align-items-center gap-2 py-2 px-3 bg-light sticky-top">
                          <input
                            type="checkbox"
                            className="form-check-input m-0 flex-shrink-0"
                            checked={allVisibleSelected}
                            onChange={toggleSelectAllVisible}
                            disabled={isSubmitting || addingSelectedProducts}
                            aria-label="Select all search results"
                          />
                          <span className="small text-muted flex-grow-1">
                            {selectedProductIds.length > 0
                              ? `${selectedProductIds.length} selected`
                              : 'Select products'}
                          </span>
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            disabled={
                              isSubmitting ||
                              addingSelectedProducts ||
                              selectedProductIds.length === 0
                            }
                            onClick={handleAddSelectedProducts}
                          >
                            {addingSelectedProducts
                              ? 'Adding…'
                              : `Add selected${selectedProductIds.length ? ` (${selectedProductIds.length})` : ''}`}
                          </button>
                        </div>
                        {addProductResults.map((p) => {
                          const pk = String(p._id ?? p.id ?? '');
                          const checked = selectedProductIds.includes(pk);
                          return (
                            <div
                              key={pk}
                              className="list-group-item po-form-product-result-row d-flex align-items-stretch py-0 px-0 mb-0"
                            >
                              <label
                                className="po-form-product-result-check d-flex align-items-center justify-content-center px-3 mb-0"
                                title="Select for bulk add"
                              >
                                <input
                                  type="checkbox"
                                  className="form-check-input m-0 flex-shrink-0"
                                  checked={checked}
                                  onChange={() => toggleProductSelected(pk)}
                                  disabled={isSubmitting || addingSelectedProducts}
                                  aria-label={`Select ${productPickerLabel(p)}`}
                                />
                              </label>
                              <button
                                type="button"
                                className="po-form-product-result-add btn btn-link text-decoration-none text-start text-body flex-grow-1 border-0 rounded-0 py-2 px-3"
                                title="Click to add this product"
                                disabled={isSubmitting || addingSelectedProducts}
                                onClick={() => appendProducts([p])}
                              >
                                <span className="fw-semibold d-block">{productPickerLabel(p)}</span>
                                <span className="text-muted small">
                                  Wholesale{' '}
                                  {fmt(
                                    productPickerWholesalePrice(p) ?? productPickerUnitPrice(p)
                                  )}
                                </span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
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
                            <th
                              className="text-center po-form-col-action"
                              aria-label="Barcode and remove"
                            />
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
                              const hasBarcode = lineHasBarcode(row);
                              const assigningBarcode = generatingBarcodeKeys.has(row.key);
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
                                          !warehouseOptions.some(
                                            (w) => warehouseOptionValue(w) === wid
                                          )
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
                                      onChange={(e) =>
                                        handleLineEdit(row.key, 'rate', e.target.value)
                                      }
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
                                      onChange={(e) =>
                                        handleLineEdit(row.key, 'qty', e.target.value)
                                      }
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
                                  <td className="text-end fw-semibold text-nowrap">
                                    {fmt(amount)}
                                  </td>
                                  <td className="text-center">
                                    <div className="d-inline-flex align-items-center justify-content-center gap-1">
                                      {row.barcodeResolved && !hasBarcode ? (
                                        <button
                                          type="button"
                                          className="btn btn-sm btn-outline-danger d-inline-flex align-items-center justify-content-center p-0"
                                          style={{ width: '32px', height: '32px' }}
                                          title="Generate barcode for this product"
                                          aria-label={`Generate barcode for line ${i + 1}`}
                                          onClick={() => handleAssignBarcode(row)}
                                          disabled={
                                            isSubmitting ||
                                            assigningBarcode ||
                                            !String(row.productId || '').trim()
                                          }
                                        >
                                          {assigningBarcode ? (
                                            <span
                                              className="spinner-border spinner-border-sm"
                                              role="status"
                                              aria-hidden="true"
                                            />
                                          ) : (
                                            <FaBarcode size={14} aria-hidden="true" />
                                          )}
                                        </button>
                                      ) : null}
                                      <button
                                        type="button"
                                        className="btn btn-sm btn-danger d-inline-flex align-items-center justify-content-center p-0"
                                        style={{ width: '32px', height: '32px' }}
                                        title="Remove line"
                                        aria-label={`Remove line ${i + 1}`}
                                        onClick={() => removeLine(row.key)}
                                        disabled={isSubmitting}
                                      >
                                        <svg
                                          xmlns="http://www.w3.org/2000/svg"
                                          width="16"
                                          height="16"
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="2"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          aria-hidden="true"
                                        >
                                          <path d="M3 6h18" />
                                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                          <line x1="10" y1="11" x2="10" y2="17" />
                                          <line x1="14" y1="11" x2="14" y2="17" />
                                        </svg>
                                      </button>
                                    </div>
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
                                  if (next.submit === 'Mode of payment is required.')
                                    delete next.submit;
                                  return next;
                                });
                              }}
                              required
                              disabled={accountSelectDisabled}
                            >
                              <option value="">Select mode of payment</option>
                              {!accountIdInList && form.account_id ? (
                                <option value={form.account_id}>
                                  Payment id: {form.account_id}
                                </option>
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
                    onClick={() => navigate('/purchase-orders')}
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

export default PurchaseOrderEdit;
