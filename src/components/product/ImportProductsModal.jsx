import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FaCheck, FaFileImport } from 'react-icons/fa6';
import AppModal from '../AppModal.jsx';
import ConfirmDialog from '../support/ConfirmDialog.jsx';
import NavIcon from '../NavIcon.jsx';
import TablePagination from '../TablePagination.jsx';
import { usePermissions } from '../../hooks/usePermissions.js';
import { toast } from '../../utils/toast.js';
import { exportRowsToCsv } from '../../utils/listExport.js';
import { fetchCategoriesRequest, createCategoryRequest } from '../../features/categories/categoriesAPI.js';
import { fetchBrandsRequest, createBrandRequest } from '../../features/brands/brandsAPI.js';
import {
  createProductRequest,
  fetchAllProductsForExportRequest,
  fetchProductImportFormRequest,
  updateProductRequest,
} from '../../features/products/productsAPI.js';
import {
  PRODUCT_IMPORT_FIELDS,
  autoMapColumns,
  buildSampleTemplateRows,
  getMissingRequiredMappings,
  mergeBackendImportSchema,
  normalizeHeader,
} from '../../features/products/productImportFields.js';
import {
  PRODUCT_IMPORT_ACCEPT,
  PRODUCT_IMPORT_MAX_BYTES,
  PRODUCT_IMPORT_MAX_ROWS,
  parseProductImportFile,
  validateImportFile,
} from '../../features/products/productImportParse.js';
import {
  applyMappingTemplate,
  deleteMappingTemplate,
  listMappingTemplates,
  saveMappingTemplate,
} from '../../features/products/productImportTemplates.js';
import {
  IMPORT_DUPLICATE_NAME_MODES,
  IMPORT_EXISTING_MODES,
  IMPORT_MATCH_MODES,
  applyCategoryLookupToRows,
  buildCreatePayload,
  buildNameLookup,
  buildUpdatePayload,
  chunkItems,
  collectCategorySegments,
  generateProductSlug,
  pickCreatedCategory,
  recordId,
  recordName,
  rowsReadyToImport,
  runWithConcurrency,
  splitCategoryPlan,
  uniqueCategorySlug,
  validateImportRowsAsync,
} from '../../features/products/productImportEngine.js';
import './import-products-modal.css';

const STEPS = [
  { id: 'upload', label: 'Upload' },
  { id: 'map', label: 'Map fields' },
  { id: 'preview', label: 'Preview' },
  { id: 'confirm', label: 'Confirm' },
  { id: 'progress', label: 'Import' },
];

const emptyProgress = () => ({
  total: 0,
  processed: 0,
  created: 0,
  updated: 0,
  skipped: 0,
  failed: 0,
  errors: [],
  done: false,
  batch: 0,
  batches: 0,
  phase: 'products',
  categoryTotal: 0,
  categoryProcessed: 0,
  categoryCreated: 0,
});

function getSessionCompanyId() {
  if (typeof window === 'undefined') return '';
  try {
    const raw = window.localStorage.getItem('companyData');
    if (!raw) return '';
    const company = JSON.parse(raw);
    return String(company?._id ?? company?.id ?? '').trim();
  } catch {
    return '';
  }
}

function confidenceBadge(mapping) {
  if (!mapping.auto && mapping.targetKey) {
    return <span className="import-badge import-badge-manual">Manual</span>;
  }
  if (mapping.confidence === 'high') {
    return <span className="import-badge import-badge-high">Auto matched</span>;
  }
  if (mapping.confidence === 'medium') {
    return <span className="import-badge import-badge-medium">Suggested match</span>;
  }
  return <span className="import-badge import-badge-none">Not matched</span>;
}

function formatBytes(size) {
  if (!size) return '0 B';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ImportProductsModal({ open, onClose, onImported }) {
  const { canCreate } = usePermissions('products');
  const { canCreate: canCreateCategory } = usePermissions('categories');
  const { canCreate: canCreateBrand } = usePermissions('brands');
  const fileInputRef = useRef(null);
  const importLockRef = useRef(false);

  const [step, setStep] = useState('upload');
  const [fields, setFields] = useState(PRODUCT_IMPORT_FIELDS);
  const [dragOver, setDragOver] = useState(false);
  const [parseError, setParseError] = useState('');
  const [parsing, setParsing] = useState(false);
  const [fileMeta, setFileMeta] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [rawRows, setRawRows] = useState([]);
  const [mappings, setMappings] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [existingProducts, setExistingProducts] = useState([]);
  const [catalogStatus, setCatalogStatus] = useState('idle');
  const [existingStatus, setExistingStatus] = useState('idle');
  const [validated, setValidated] = useState(null);
  const [existingMode, setExistingMode] = useState('skip');
  const [matchBy, setMatchBy] = useState('sku_then_barcode');
  const [skipDuplicateNames, setSkipDuplicateNames] = useState(true);
  const [createMissingCategories, setCreateMissingCategories] = useState(true);
  const [resolutions, setResolutions] = useState({ category: {}, brand: {} });
  const [creatingLookup, setCreatingLookup] = useState('');
  const [templates, setTemplates] = useState([]);
  const [templateName, setTemplateName] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [progress, setProgress] = useState(emptyProgress);
  const [previewPage, setPreviewPage] = useState(1);
  const [previewLimit, setPreviewLimit] = useState(25);
  const [previewFilter, setPreviewFilter] = useState('all');
  const [prepare, setPrepare] = useState({ phase: 'idle', processed: 0, total: 0 });
  const validationSeqRef = useRef(0);

  const companyId = getSessionCompanyId();

  const resetWizard = useCallback(() => {
    setStep('upload');
    setDragOver(false);
    setParseError('');
    setParsing(false);
    setFileMeta(null);
    setHeaders([]);
    setRawRows([]);
    setMappings([]);
    setValidated(null);
    setExistingMode('skip');
    setMatchBy('sku_then_barcode');
    setSkipDuplicateNames(true);
    setCreateMissingCategories(true);
    setResolutions({ category: {}, brand: {} });
    setCreatingLookup('');
    setTemplateName('');
    setSelectedTemplateId('');
    setConfirmOpen(false);
    setProgress(emptyProgress());
    setPreviewPage(1);
    setPreviewLimit(25);
    setPreviewFilter('all');
    setPrepare({ phase: 'idle', processed: 0, total: 0 });
    validationSeqRef.current += 1;
    importLockRef.current = false;
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    resetWizard();
    setTemplates(listMappingTemplates(companyId));
    setCatalogStatus('loading');

    let cancelled = false;
    Promise.all([
      fetchCategoriesRequest({ page: 1, limit: 2000 }).catch(() => ({ data: [] })),
      fetchBrandsRequest({ page: 1, limit: 2000 }).catch(() => ({ data: [] })),
      fetchProductImportFormRequest().catch(() => null),
    ]).then(([categoryResult, brandResult, schema]) => {
      if (cancelled) return;
      setCategories(Array.isArray(categoryResult?.data) ? categoryResult.data : []);
      setBrands(Array.isArray(brandResult?.data) ? brandResult.data : []);
      if (schema) setFields(mergeBackendImportSchema(PRODUCT_IMPORT_FIELDS, schema));
      setCatalogStatus('succeeded');
    });

    return () => {
      cancelled = true;
    };
  }, [open, companyId, resetWizard]);

  const missingRequired = useMemo(
    () => getMissingRequiredMappings(mappings, fields),
    [mappings, fields]
  );

  const mappedFields = useMemo(
    () => fields.filter((field) => mappings.some((row) => row.targetKey === field.key)),
    [fields, mappings]
  );
  const categoryPlan = useMemo(
    () => splitCategoryPlan(collectCategorySegments(rawRows, mappings), categories),
    [rawRows, mappings, categories]
  );

  const runValidation = useCallback(
    async (
      nextExisting = existingProducts,
      nextCategories = categories,
      nextBrands = brands,
      nextResolutions = resolutions
    ) => {
      if (!rawRows.length) {
        setValidated(null);
        setPrepare({ phase: 'idle', processed: 0, total: 0 });
        return null;
      }
      const seq = validationSeqRef.current + 1;
      validationSeqRef.current = seq;
      setPrepare({ phase: 'validate', processed: 0, total: rawRows.length });
      const result = await validateImportRowsAsync(
        {
          rows: rawRows,
          mappings,
          fields,
          existingProducts: nextExisting,
          categories: nextCategories,
          brands: nextBrands,
          resolutions: nextResolutions,
          options: { existingMode, matchBy, skipDuplicateNames, createMissingCategories },
        },
        {
          onProgress: (processed, total) => {
            if (validationSeqRef.current !== seq) return;
            setPrepare({ phase: 'validate', processed, total });
          },
        }
      );
      if (validationSeqRef.current !== seq) return null;
      setValidated(result);
      setPreviewPage(1);
      setPrepare({ phase: 'idle', processed: 0, total: 0 });
      return result;
    },
    [rawRows, mappings, fields, existingProducts, categories, brands, resolutions, existingMode, matchBy, skipDuplicateNames, createMissingCategories]
  );

  const handleFile = async (file) => {
    const localError = validateImportFile(file);
    if (localError) {
      setParseError(localError);
      return;
    }
    setParsing(true);
    setParseError('');
    try {
      await new Promise((resolve) => setTimeout(resolve, 40));
      const parsed = await parseProductImportFile(file);
      const nextMappings = autoMapColumns(parsed.headers, fields).map((row) => ({
        ...row,
        sample: parsed.rows[0]?.[row.sourceIndex] || '',
      }));
      setFileMeta({
        name: parsed.fileName,
        size: parsed.fileSize,
        truncated: parsed.truncated,
        totalRows: parsed.totalRows,
      });
      setHeaders(parsed.headers);
      setRawRows(parsed.rows);
      setMappings(nextMappings);
      setValidated(null);
      setStep('map');
    } catch (error) {
      setParseError(error?.message || 'Failed to read the uploaded file.');
    } finally {
      setParsing(false);
    }
  };

  const handleMappingChange = (sourceIndex, targetKey) => {
    setMappings((prev) => {
      const next = prev.map((row) => {
        if (row.sourceIndex !== sourceIndex) {
          if (targetKey && row.targetKey === targetKey) {
            return { ...row, targetKey: '', confidence: 'none', auto: false };
          }
          return row;
        }
        return {
          ...row,
          targetKey,
          auto: false,
          confidence: targetKey ? 'high' : 'none',
        };
      });
      return next;
    });
    setValidated(null);
  };

  const downloadSample = () => {
    const sample = buildSampleTemplateRows(fields);
    exportRowsToCsv({
      columns: sample.headers.map((label, index) => ({ key: `c${index}`, label })),
      rows: sample.rows.map((row) =>
        Object.fromEntries(row.map((value, index) => [`c${index}`, value]))
      ),
      filename: 'product-import-template',
    });
  };

  const handleSaveTemplate = () => {
    try {
      saveMappingTemplate(companyId, templateName, mappings);
      setTemplates(listMappingTemplates(companyId));
      setTemplateName('');
      toast.success('Mapping template saved.');
    } catch (error) {
      toast.error(error?.message || 'Could not save mapping template.');
    }
  };

  const handleApplyTemplate = (templateId) => {
    setSelectedTemplateId(templateId);
    const template = templates.find((item) => item.id === templateId);
    if (!template) return;
    setMappings((prev) =>
      applyMappingTemplate(headers, template, prev).map((row, index) => ({
        ...row,
        sample: rawRows[0]?.[index] || row.sample || '',
      }))
    );
    setValidated(null);
  };

  const goToPreview = async () => {
    if (missingRequired.length > 0) {
      toast.error('Please map all required fields before continuing.');
      return;
    }
    setStep('preview');
    setExistingStatus('loading');
    setPrepare({ phase: 'catalog', processed: 0, total: 0 });
    try {
      const products = await fetchAllProductsForExportRequest(
        {
          includeInactive: true,
          populate: '',
        },
        ({ loaded, total }) => {
          setPrepare({ phase: 'catalog', processed: loaded, total: total || loaded });
        }
      );
      setExistingProducts(products);
      setExistingStatus('succeeded');
    } catch (error) {
      setExistingProducts([]);
      setExistingStatus('failed');
      toast.error(error?.message || 'Could not load existing products for duplicate checks.');
    }
  };

  useEffect(() => {
    if (step !== 'preview' && step !== 'confirm') return undefined;
    if (rawRows.length === 0) return undefined;
    if (existingStatus === 'loading') return undefined;
    runValidation();
    return undefined;
  }, [existingMode, matchBy, skipDuplicateNames, createMissingCategories, resolutions, step, rawRows.length, existingStatus, runValidation]);

  const updateResolution = (kind, raw, patch) => {
    const key = String(raw || '').trim().toLowerCase();
    setResolutions((prev) => ({
      ...prev,
      [kind]: {
        ...prev[kind],
        [key]: { ...(prev[kind]?.[key] || { raw }), ...patch },
      },
    }));
  };

  const handleCreateLookup = async (kind, unmatched) => {
    const label = unmatched.label || unmatched.raw;
    setCreatingLookup(`${kind}:${unmatched.raw}`);
    try {
      if (kind === 'category') {
        const result = await createCategoryRequest({
          name: label,
          slug: generateProductSlug(label),
        });
        const created =
          result?.data && typeof result.data === 'object' && !Array.isArray(result.data)
            ? result.data
            : result;
        const id = recordId(created);
        if (!id) throw new Error('Category was created but no id was returned.');
        const record = { ...created, name: label };
        setCategories((prev) => [...prev, record]);
        updateResolution('category', unmatched.raw, {
          action: 'create',
          id,
          label,
        });
        toast.success(`Created category “${label}”.`);
      } else {
        const result = await createBrandRequest({ name: label });
        const created =
          result?.data && typeof result.data === 'object' && !Array.isArray(result.data)
            ? result.data
            : result;
        const id = recordId(created);
        if (!id) throw new Error('Brand was created but no id was returned.');
        const record = { ...created, name: label };
        setBrands((prev) => [...prev, record]);
        updateResolution('brand', unmatched.raw, {
          action: 'create',
          id,
          label,
        });
        toast.success(`Created brand “${label}”.`);
      }
    } catch (error) {
      toast.error(error?.message || `Failed to create ${kind}.`);
    } finally {
      setCreatingLookup('');
    }
  };

  const readyCount = (validated?.summary?.create || 0) + (validated?.summary?.update || 0);
  const preparing = prepare.phase !== 'idle';
  const filteredPreviewRows = useMemo(() => {
    const rows = validated?.rows || [];
    if (previewFilter === 'ready') {
      return rows.filter((row) => row.status === 'ready' || row.status === 'warning');
    }
    if (previewFilter === 'warning') return rows.filter((row) => row.status === 'warning');
    if (previewFilter === 'skip') return rows.filter((row) => row.status === 'skip');
    if (previewFilter === 'error') return rows.filter((row) => row.status === 'error');
    return rows;
  }, [validated, previewFilter]);
  const previewTotalPages = Math.max(1, Math.ceil(filteredPreviewRows.length / Math.max(previewLimit, 1)));
  const safePreviewPage = Math.min(previewPage, previewTotalPages);
  const pagedPreviewRows = useMemo(() => {
    const start = (safePreviewPage - 1) * previewLimit;
    return filteredPreviewRows.slice(start, start + previewLimit);
  }, [filteredPreviewRows, safePreviewPage, previewLimit]);

  const errorRows = useMemo(
    () => (validated?.rows || []).filter((row) => row.status === 'error'),
    [validated]
  );

  const startImport = async () => {
    if (importLockRef.current) return;
    const current = validated;
    const readyRows = rowsReadyToImport(current?.rows || []);
    if (!current || readyRows.length === 0) {
      toast.error('There are no valid products ready to import.');
      return;
    }

    importLockRef.current = true;
    setConfirmOpen(false);
    setStep('progress');

    try {
    let workingCategories = [...categories];
    let workingRows = readyRows;
    const categoryErrors = [];
    const plan = splitCategoryPlan(collectCategorySegments(rawRows, mappings), workingCategories);

    const mappedKeys = current.mappedKeys;
    const batchCount = Math.ceil(readyRows.length / 100);
    setProgress({
      ...emptyProgress(),
      total: readyRows.length,
      batch: 0,
      batches: batchCount,
      phase: plan.missing.length && createMissingCategories && canCreateCategory ? 'categories' : 'products',
      categoryTotal: plan.missing.length,
      categoryProcessed: 0,
      categoryCreated: 0,
    });

    if (createMissingCategories && canCreateCategory && plan.missing.length > 0) {
      const usedSlugs = new Set(
        workingCategories
          .map((cat) => String(cat.slug || cat.category_slug || '').trim().toLowerCase())
          .filter(Boolean)
      );
      const lookup = buildNameLookup(workingCategories, ['name', 'category_name']);
      for (let i = 0; i < plan.missing.length; i += 1) {
        const segment = plan.missing[i];
        const parentRecord = segment.parentName
          ? lookup.byName.get(normalizeHeader(segment.parentName))
          : null;
        const parentId = parentRecord ? recordId(parentRecord) : '';
        try {
          const result = await createCategoryRequest({
            name: segment.name,
            slug: uniqueCategorySlug(segment.name, usedSlugs),
            ...(parentId ? { parent_id: parentId } : {}),
          });
          const created = pickCreatedCategory(result) || {};
          const id = String(created._id ?? created.id ?? created.category_id ?? '').trim();
          if (!id) {
            throw new Error(`Category “${segment.name}” was created but no id was returned.`);
          }
          const record = {
            ...created,
            _id: id,
            name: created.name || created.category_name || segment.name,
          };
          workingCategories.push(record);
          lookup.byId.set(id.toLowerCase(), record);
          lookup.byName.set(normalizeHeader(record.name), record);
          setProgress((prev) => ({
            ...prev,
            phase: 'categories',
            categoryProcessed: i + 1,
            categoryCreated: (prev.categoryCreated || 0) + 1,
            categoryTotal: plan.missing.length,
          }));
        } catch (error) {
          const entry = {
            row: 0,
            sku: '',
            name: segment.name,
            error: error?.message || `Failed to create category “${segment.name}”`,
          };
          categoryErrors.push(entry);
          setProgress((prev) => ({
            ...prev,
            phase: 'categories',
            categoryProcessed: i + 1,
            categoryTotal: plan.missing.length,
            errors: [...(prev.errors || []), entry],
          }));
        }
      }
      setCategories(workingCategories);
      workingRows = rowsReadyToImport(
        applyCategoryLookupToRows(
          readyRows,
          buildNameLookup(workingCategories, ['name', 'category_name'])
        )
      );
    }

    const jobs = [];
    for (const slice of chunkItems(workingRows, 400)) {
      slice.forEach((row) => {
        const built =
          row.action === 'update'
            ? buildUpdatePayload(row.values, mappedKeys)
            : buildCreatePayload(row.values);
        jobs.push({
          ...built,
          action: row.action,
          existingId: row.values.existingId || built.existingId,
          rowNumber: row.rowNumber,
          sku: row.values.sku || '',
          name: row.values.name || '',
        });
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    const categoriesCreatedCount = Math.max(0, workingCategories.length - categories.length);
    const productBatchCount = Math.max(1, Math.ceil(jobs.length / 100));
    const nextProgress = {
      total: jobs.length,
      processed: 0,
      created: 0,
      updated: 0,
      skipped: current?.summary?.skipped || 0,
      failed: 0,
      errors: [...categoryErrors],
      done: false,
      batch: 0,
      batches: productBatchCount,
      phase: 'products',
      categoryTotal: plan.missing.length,
      categoryProcessed: plan.missing.length,
      categoryCreated: categoriesCreatedCount,
    };

    if (jobs.length === 0) {
      nextProgress.done = true;
      setProgress({ ...nextProgress });
      if (categoriesCreatedCount > 0) onImported?.();
      return;
    }

    const batches = chunkItems(jobs, 100);
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
      const batch = batches[batchIndex];
      nextProgress.batch = batchIndex + 1;
      setProgress({ ...nextProgress });
      await runWithConcurrency(
        batch,
        4,
        async (item) => {
          if (item.action === 'update' && item.existingId) {
            await updateProductRequest(item.existingId, item.productData, item.images);
            return 'updated';
          }
          await createProductRequest(item.productData, item.images);
          return 'created';
        },
        (item, outcome) => {
          nextProgress.processed += 1;
          if (outcome.ok) {
            if (outcome.value === 'updated') nextProgress.updated += 1;
            else nextProgress.created += 1;
          } else {
            nextProgress.failed += 1;
            nextProgress.errors.push({
              row: item.rowNumber,
              sku: item.sku,
              name: item.name,
              error: outcome.error?.message || 'Import failed',
            });
          }
          setProgress({ ...nextProgress });
        }
      );
    }

    nextProgress.done = true;
    setProgress({ ...nextProgress });
    if (nextProgress.created + nextProgress.updated + categoriesCreatedCount > 0) {
      onImported?.();
    }
    } catch (error) {
      setProgress((prev) => ({
        ...prev,
        done: true,
        errors: [
          ...(prev.errors || []),
          { row: 0, sku: '', name: '', error: error?.message || 'Import failed' },
        ],
      }));
    } finally {
      importLockRef.current = false;
    }
  };

  const downloadErrorReport = () => {
    const rows = [
      ...(validated?.rows || [])
        .filter((row) => row.status === 'error')
        .map((row) => ({
          row: row.rowNumber,
          sku: row.values.sku || '',
          name: row.values.name || '',
          error: row.errors.join('; '),
        })),
      ...progress.errors,
    ];
    if (rows.length === 0) {
      toast.error('There are no errors to download.');
      return;
    }
    exportRowsToCsv({
      columns: [
        { key: 'row', label: 'Row' },
        { key: 'sku', label: 'SKU' },
        { key: 'name', label: 'Product Name' },
        { key: 'error', label: 'Error' },
      ],
      rows,
      filename: 'product-import-errors',
    });
  };

  const importing = step === 'progress' && !progress.done;
  const busy = parsing || importing || preparing;
  const percent = progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0;
  const preparePercent =
    prepare.total > 0 ? Math.round((prepare.processed / prepare.total) * 100) : prepare.phase === 'idle' ? 0 : 5;

  useEffect(() => {
    if (!busy) return undefined;
    const onBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = 'Import is in progress. If you reload, the import will stop.';
      return event.returnValue;
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [busy]);

  const footer = (() => {
    if (step === 'upload') {
      return (
        <>
          <button type="button" className="btn btn-sm btn-outline-secondary mb-0" onClick={onClose}>
            Cancel
          </button>
        </>
      );
    }
    if (step === 'map') {
      return (
        <>
          <button type="button" className="btn btn-sm btn-outline-secondary mb-0" onClick={() => setStep('upload')}>
            Back
          </button>
          <button
            type="button"
            className="btn btn-sm btn-primary mb-0"
            onClick={goToPreview}
            disabled={missingRequired.length > 0 || parsing}
          >
            Continue to preview
          </button>
        </>
      );
    }
    if (step === 'preview') {
      return (
        <>
          <button type="button" className="btn btn-sm btn-outline-secondary mb-0" onClick={() => setStep('map')}>
            Back
          </button>
          <button
            type="button"
            className="btn btn-sm btn-primary mb-0"
            onClick={() => setStep('confirm')}
            disabled={!readyCount || preparing}
          >
            Continue
          </button>
        </>
      );
    }
    if (step === 'confirm') {
      return (
        <>
          <button type="button" className="btn btn-sm btn-outline-secondary mb-0" onClick={() => setStep('preview')}>
            Back
          </button>
          <button
            type="button"
            className="btn btn-sm btn-primary mb-0"
            onClick={() => setConfirmOpen(true)}
            disabled={!readyCount || importing || preparing}
          >
            Import {readyCount.toLocaleString()} product{readyCount === 1 ? '' : 's'}
          </button>
        </>
      );
    }
    return (
      <>
        {progress.done ? (
          <>
            <button type="button" className="btn btn-sm btn-outline-secondary mb-0" onClick={downloadErrorReport}>
              Download error report
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-primary mb-0"
              onClick={() => {
                resetWizard();
              }}
            >
              Import another file
            </button>
            <button type="button" className="btn btn-sm btn-primary mb-0" onClick={onClose}>
              View products
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-sm btn-outline-secondary mb-0" disabled>
            Importing…
          </button>
        )}
      </>
    );
  })();

  if (!open || canCreate === false) return null;

  return (
    <>
      <AppModal
        open={open}
        onClose={busy ? undefined : onClose}
        title="Import Products"
        subtitle={
          step === 'upload'
            ? 'Upload your product file and we’ll automatically detect and match its columns with your product fields.'
            : fileMeta
              ? `${fileMeta.name} · ${formatBytes(fileMeta.size)} · ${fileMeta.totalRows.toLocaleString()} row${fileMeta.totalRows === 1 ? '' : 's'}`
              : ''
        }
        size="full"
        disableBackdropClose={busy}
        footer={footer}
      >
        <div className="import-products-wizard">
          {busy ? (
            <div className="alert alert-warning py-2 mb-0 import-dont-reload" role="status">
              <strong>Do not reload or close this window.</strong>{' '}
              {parsing
                ? 'Reading your file…'
                : prepare.phase === 'catalog'
                  ? 'Loading existing products…'
                  : prepare.phase === 'validate'
                    ? 'Validating rows…'
                    : 'Import is running. Reloading will stop the import and may leave it incomplete.'}
            </div>
          ) : null}
          <ol className="import-products-steps">
            {STEPS.map((item, index) => {
              const currentIndex = STEPS.findIndex((stepItem) => stepItem.id === step);
              const done = index < currentIndex;
              const active = item.id === step;
              return (
                <li key={item.id} className={active ? 'is-active' : done ? 'is-done' : ''}>
                  <span className="step-index">{done ? '✓' : index + 1}</span>
                  {item.label}
                </li>
              );
            })}
          </ol>

          {step === 'upload' ? (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                className="d-none"
                accept={PRODUCT_IMPORT_ACCEPT}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />
              <div
                className={`import-dropzone ${dragOver ? 'is-dragging' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleFile(file);
                }}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
                }}
              >
                <NavIcon icon={FaFileImport} size={28} className="text-primary mb-2" />
                <div className="import-dropzone-title">Drag & drop your file here</div>
                <div className="import-dropzone-or">or</div>
                <button type="button" className="btn btn-sm btn-primary mb-0">
                  Browse File
                </button>
                {parsing ? (
                  <div className="text-muted text-sm mt-3">
                    <span className="spinner-border spinner-border-sm me-2" role="status" />
                    Reading file… this can take a minute for large files.
                  </div>
                ) : null}
              </div>
              {parseError ? <div className="alert alert-danger py-2 mt-3 mb-0">{parseError}</div> : null}
              <div className="import-meta-list mt-3">
                <div className="import-meta-card">
                  <span className="label">Supported formats</span>
                  CSV, XLS, XLSX
                </div>
                <div className="import-meta-card">
                  <span className="label">Maximum file size</span>
                  {Math.round(PRODUCT_IMPORT_MAX_BYTES / (1024 * 1024))} MB · up to{' '}
                  {PRODUCT_IMPORT_MAX_ROWS.toLocaleString()} rows
                </div>
                <div className="import-meta-card">
                  <span className="label">Sample template</span>
                  <button type="button" className="btn btn-link btn-sm p-0" onClick={downloadSample}>
                    Download sample template
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {step === 'map' ? (
            <>
              <div className="d-flex flex-wrap gap-2 align-items-end">
                <div className="flex-grow-1">
                  <label className="form-label mb-1 text-xs text-uppercase fw-bold text-muted" htmlFor="import-template">
                    Mapping template
                  </label>
                  <select
                    id="import-template"
                    className="form-select form-select-sm"
                    value={selectedTemplateId}
                    onChange={(e) => handleApplyTemplate(e.target.value)}
                  >
                    <option value="">Use auto-detected mapping</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label mb-1 text-xs text-uppercase fw-bold text-muted" htmlFor="import-template-name">
                    Save mapping template
                  </label>
                  <div className="d-flex gap-2">
                    <input
                      id="import-template-name"
                      className="form-control form-control-sm"
                      placeholder="WooCommerce Products"
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                    />
                    <button type="button" className="btn btn-sm btn-outline-primary mb-0" onClick={handleSaveTemplate}>
                      Save
                    </button>
                  </div>
                </div>
                {selectedTemplateId && !selectedTemplateId.startsWith('builtin-') ? (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-danger mb-0"
                    onClick={() => {
                      deleteMappingTemplate(companyId, selectedTemplateId);
                      setTemplates(listMappingTemplates(companyId));
                      setSelectedTemplateId('');
                    }}
                  >
                    Delete template
                  </button>
                ) : null}
              </div>

              <div className="import-required-list">
                {fields
                  .filter((field) => field.required && !field.hasDefault)
                  .map((field) => {
                    const mapped = mappings.some((row) => row.targetKey === field.key) ||
                      (field.key === 'price' && mappings.some((row) => row.targetKey === 'price_before_tax'));
                    return (
                      <span key={field.key} className={`import-required-chip ${mapped ? 'is-ok' : 'is-missing'}`}>
                        {mapped ? '✓' : '⚠'} {field.label} {mapped ? 'mapped' : 'not mapped'}
                      </span>
                    );
                  })}
              </div>
              {missingRequired.length > 0 ? (
                <div className="alert alert-warning py-2 mb-0">Please map all required fields before continuing.</div>
              ) : null}
              {fileMeta?.truncated ? (
                <div className="alert alert-warning py-2 mb-0">
                  This file has more than {PRODUCT_IMPORT_MAX_ROWS.toLocaleString()} rows. Only the first{' '}
                  {PRODUCT_IMPORT_MAX_ROWS.toLocaleString()} will be imported.
                </div>
              ) : null}

              <div className="import-map-scroll">
                <table className="table table-sm align-middle import-map-table mb-0">
                  <thead>
                    <tr>
                      <th>Uploaded column</th>
                      <th>Sample data</th>
                      <th>Import as</th>
                      <th>Match</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mappings.map((row) => (
                      <tr key={row.sourceIndex}>
                        <td>
                          <strong>{row.sourceHeader}</strong>
                        </td>
                        <td className="text-muted text-sm">{row.sample || '—'}</td>
                        <td>
                          <select
                            className="form-select form-select-sm"
                            value={row.targetKey}
                            onChange={(e) => handleMappingChange(row.sourceIndex, e.target.value)}
                          >
                            <option value="">Do not import</option>
                            {fields.map((field) => (
                              <option key={field.key} value={field.key}>
                                {field.label}
                                {field.required ? ' *' : ''}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>{confidenceBadge(row)}</td>
                        <td>{row.targetKey ? '✓' : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}

          {step === 'preview' ? (
            <>
              {existingStatus === 'loading' || catalogStatus === 'loading' || preparing ? (
                <div className="import-prepare-panel">
                  <div className="text-muted text-sm mb-2">
                    <span className="spinner-border spinner-border-sm me-2" role="status" />
                    {prepare.phase === 'catalog'
                      ? `Loading existing products${prepare.total ? ` (${prepare.processed.toLocaleString()} / ${prepare.total.toLocaleString()})` : '…'}`
                      : prepare.phase === 'validate'
                        ? `Validating ${prepare.processed.toLocaleString()} / ${prepare.total.toLocaleString()} rows`
                        : 'Checking existing products, categories, and brands…'}
                  </div>
                  <div className="import-progress-bar">
                    <span style={{ width: `${preparePercent}%` }} />
                  </div>
                </div>
              ) : null}

              <div className="import-stats">
                <div className="import-stat">
                  <span className="value">{(validated?.summary.total || 0).toLocaleString()}</span>
                  <span className="label">Products found</span>
                </div>
                <div className="import-stat is-success">
                  <span className="value">{(validated?.summary.ready || 0).toLocaleString()}</span>
                  <span className="label">Ready to import</span>
                </div>
                <div className="import-stat is-warning">
                  <span className="value">{(validated?.summary.warnings || 0).toLocaleString()}</span>
                  <span className="label">Warnings</span>
                </div>
                <div className="import-stat is-danger">
                  <span className="value">{(validated?.summary.errors || 0).toLocaleString()}</span>
                  <span className="label">Errors</span>
                </div>
              </div>

              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label mb-1 text-xs text-uppercase fw-bold text-muted">Existing products</label>
                  {IMPORT_EXISTING_MODES.map((mode) => (
                    <div className="form-check" key={mode.value}>
                      <input
                        className="form-check-input"
                        type="radio"
                        name="import-existing-mode"
                        id={`import-existing-${mode.value}`}
                        checked={existingMode === mode.value}
                        onChange={() => setExistingMode(mode.value)}
                      />
                      <label className="form-check-label" htmlFor={`import-existing-${mode.value}`}>
                        {mode.label}
                      </label>
                    </div>
                  ))}
                </div>
                <div className="col-md-6">
                  <label className="form-label mb-1 text-xs text-uppercase fw-bold text-muted">Match by</label>
                  {IMPORT_MATCH_MODES.map((mode) => (
                    <div className="form-check" key={mode.value}>
                      <input
                        className="form-check-input"
                        type="radio"
                        name="import-match-by"
                        id={`import-match-${mode.value}`}
                        checked={matchBy === mode.value}
                        onChange={() => setMatchBy(mode.value)}
                      />
                      <label className="form-check-label" htmlFor={`import-match-${mode.value}`}>
                        {mode.label}
                      </label>
                    </div>
                  ))}
                </div>
                <div className="col-12">
                  <label className="form-label mb-1 text-xs text-uppercase fw-bold text-muted">
                    If the product name is duplicate, should we skip it?
                  </label>
                  {IMPORT_DUPLICATE_NAME_MODES.map((mode) => (
                    <div className="form-check" key={mode.value}>
                      <input
                        className="form-check-input"
                        type="radio"
                        name="import-duplicate-name"
                        id={`import-duplicate-name-${mode.value}`}
                        checked={skipDuplicateNames === (mode.value === 'skip')}
                        onChange={() => setSkipDuplicateNames(mode.value === 'skip')}
                      />
                      <label className="form-check-label" htmlFor={`import-duplicate-name-${mode.value}`}>
                        {mode.label}
                      </label>
                    </div>
                  ))}
                  <small className="text-muted">
                    Checks names already in your catalog and names repeated in this file. SKU/barcode matches still
                    follow the existing-product setting above.
                  </small>
                </div>
                {mappings.some((row) => row.targetKey === 'category') ? (
                  <div className="col-12">
                    <div className="form-check">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="import-create-categories"
                        checked={createMissingCategories}
                        onChange={(e) => setCreateMissingCategories(e.target.checked)}
                        disabled={!canCreateCategory}
                      />
                      <label className="form-check-label" htmlFor="import-create-categories">
                        Create missing categories first, then import products with category_id
                      </label>
                    </div>
                    <small className="text-muted">
                      {categoryPlan.existing.length.toLocaleString()} already in catalog
                      {categoryPlan.missing.length
                        ? ` · ${categoryPlan.missing.length.toLocaleString()} will be created first`
                        : ''}
                      {!canCreateCategory ? ' · You do not have permission to create categories.' : ''}
                    </small>
                  </div>
                ) : null}
              </div>

              {validated?.unmatchedCategories?.length ? (
                <div className="card border-warning">
                  <div className="card-body py-3">
                    <h6 className="mb-2">
                      {createMissingCategories && canCreateCategory
                        ? 'Categories to create first'
                        : 'Unmatched categories'}
                    </h6>
                    {createMissingCategories && canCreateCategory ? (
                      <p className="text-sm text-muted mb-2">
                        These names are not in your catalog yet. They will be created first so products can use
                        category_id.
                      </p>
                    ) : null}
                    <div className="import-lookup-list">
                      {validated.unmatchedCategories.map((item) => {
                        const current = resolutions.category[String(item.raw).trim().toLowerCase()] || {};
                        if (createMissingCategories && canCreateCategory) {
                          return (
                            <div className="import-lookup-row" key={item.raw}>
                              <div>
                                <strong>{item.raw}</strong>
                                <div className="text-xs text-muted">Will be created first</div>
                              </div>
                            </div>
                          );
                        }
                        return (
                          <div className="import-lookup-row" key={item.raw}>
                            <div>
                              <strong>{item.raw}</strong>
                              <div className="text-xs text-muted">Not found</div>
                            </div>
                            <select
                              className="form-select form-select-sm"
                              value={current.id || ''}
                              onChange={(e) => {
                                const id = e.target.value;
                                const cat = categories.find((record) => recordId(record) === id);
                                updateResolution('category', item.raw, {
                                  action: id ? 'map' : 'skip_value',
                                  id,
                                  label: cat ? recordName(cat, ['name', 'category_name']) : '',
                                });
                              }}
                            >
                              <option value="">Skip this value</option>
                              {categories.map((cat) => (
                                <option key={recordId(cat)} value={recordId(cat)}>
                                  {recordName(cat, ['name', 'category_name'])}
                                </option>
                              ))}
                            </select>
                            <div className="d-flex gap-1">
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary mb-0"
                                onClick={() =>
                                  updateResolution('category', item.raw, { action: 'skip_row', id: '', label: '' })
                                }
                              >
                                Skip rows
                              </button>
                              {canCreateCategory ? (
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-primary mb-0"
                                  disabled={creatingLookup === `category:${item.raw}`}
                                  onClick={() => handleCreateLookup('category', item)}
                                >
                                  Create new
                                </button>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : null}

              {validated?.unmatchedBrands?.length ? (
                <div className="card border-warning">
                  <div className="card-body py-3">
                    <h6 className="mb-2">Unmatched brands</h6>
                    <div className="import-lookup-list">
                      {validated.unmatchedBrands.map((item) => {
                        const current = resolutions.brand[String(item.raw).trim().toLowerCase()] || {};
                        return (
                          <div className="import-lookup-row" key={item.raw}>
                            <div>
                              <strong>{item.raw}</strong>
                              <div className="text-xs text-muted">Not found</div>
                            </div>
                            <select
                              className="form-select form-select-sm"
                              value={current.id || ''}
                              onChange={(e) => {
                                const id = e.target.value;
                                const brand = brands.find((record) => recordId(record) === id);
                                updateResolution('brand', item.raw, {
                                  action: id ? 'map' : 'skip_value',
                                  id,
                                  label: brand ? recordName(brand, ['name', 'brand_name']) : '',
                                });
                              }}
                            >
                              <option value="">Skip this value</option>
                              {brands.map((brand) => (
                                <option key={recordId(brand)} value={recordId(brand)}>
                                  {recordName(brand, ['name', 'brand_name'])}
                                </option>
                              ))}
                            </select>
                            <div className="d-flex gap-1">
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary mb-0"
                                onClick={() =>
                                  updateResolution('brand', item.raw, { action: 'skip_row', id: '', label: '' })
                                }
                              >
                                Skip rows
                              </button>
                              {canCreateBrand ? (
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-primary mb-0"
                                  disabled={creatingLookup === `brand:${item.raw}`}
                                  onClick={() => handleCreateLookup('brand', item)}
                                >
                                  Create new
                                </button>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="d-flex flex-wrap gap-2">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'ready', label: 'Ready' },
                  { id: 'warning', label: 'Warnings' },
                  { id: 'skip', label: 'Skipped' },
                  { id: 'error', label: 'Errors' },
                ].map((filter) => (
                  <button
                    key={filter.id}
                    type="button"
                    className={`btn btn-sm mb-0 ${previewFilter === filter.id ? 'btn-primary' : 'btn-outline-secondary'}`}
                    onClick={() => {
                      setPreviewFilter(filter.id);
                      setPreviewPage(1);
                    }}
                  >
                    {filter.label}
                    {filter.id === 'error' && errorRows.length ? ` (${errorRows.length})` : ''}
                  </button>
                ))}
              </div>

              <div className="import-preview-scroll">
                <table className="table table-sm align-middle mb-0">
                  <thead>
                    <tr>
                      <th>#</th>
                      {mappedFields.slice(0, 8).map((field) => (
                        <th key={field.key}>{field.label}</th>
                      ))}
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedPreviewRows.map((row) => (
                      <tr key={row.rowNumber}>
                        <td>{row.rowNumber}</td>
                        {mappedFields.slice(0, 8).map((field) => (
                          <td key={field.key} className="text-sm">
                            {String(
                              field.key === 'category'
                                ? row.values.categoryLabel || row.values.category || ''
                                : field.key === 'brand'
                                  ? row.values.brandLabel || row.values.brand || ''
                                  : row.values[field.key] ?? ''
                            ) || '—'}
                          </td>
                        ))}
                        <td>
                          {row.status === 'error' ? (
                            <span className="text-danger text-xs">{row.errors[0]}</span>
                          ) : row.status === 'skip' ? (
                            <span className="text-muted text-xs">Will skip</span>
                          ) : row.status === 'warning' ? (
                            <span className="text-warning text-xs">{row.warnings[0]}</span>
                          ) : (
                            <span className="text-success text-xs">Ready</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <TablePagination
                selectId="import-preview-page-size"
                pagination={{
                  page: safePreviewPage,
                  limit: previewLimit,
                  total: filteredPreviewRows.length,
                  totalPages: previewTotalPages,
                }}
                onPageChange={setPreviewPage}
                onLimitChange={(limit) => {
                  setPreviewLimit(limit);
                  setPreviewPage(1);
                }}
                hidden={!filteredPreviewRows.length}
              />
              {errorRows.length > 0 && previewFilter !== 'error' ? (
                <div>
                  <h6 className="text-sm mb-2">Row errors</h6>
                  <ul className="text-sm mb-0">
                    {errorRows.slice(0, 12).map((row) => (
                      <li key={row.rowNumber}>
                        Row {row.rowNumber}
                        {row.values.sku ? ` · SKU ${row.values.sku}` : ''}: {row.errors.join('; ')}
                      </li>
                    ))}
                  </ul>
                  {errorRows.length > 12 ? (
                    <button
                      type="button"
                      className="btn btn-link btn-sm px-0"
                      onClick={() => {
                        setPreviewFilter('error');
                        setPreviewPage(1);
                      }}
                    >
                      View all {errorRows.length.toLocaleString()} errors
                    </button>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : null}

          {step === 'confirm' ? (
            <div>
              {readyCount >= 500 ? (
                <div className="alert alert-warning py-2">
                  <strong>Do not reload or close this window</strong> after you start the import. Large files are
                  processed in batches of 100 with on-screen progress.
                </div>
              ) : null}
              <h6 className="mb-3">Ready to import</h6>
              {createMissingCategories && canCreateCategory && categoryPlan.missing.length > 0 ? (
                <div className="alert alert-info py-2">
                  Step 1: create {categoryPlan.missing.length.toLocaleString()} missing{' '}
                  {categoryPlan.missing.length === 1 ? 'category' : 'categories'}. Step 2: import products with
                  category_id.
                </div>
              ) : null}
              <div className="import-stats mb-3">
                <div className="import-stat">
                  <span className="value">{(validated?.summary.total || 0).toLocaleString()}</span>
                  <span className="label">Total rows</span>
                </div>
                <div className="import-stat is-success">
                  <span className="value">{(validated?.summary.create || 0).toLocaleString()}</span>
                  <span className="label">New products</span>
                </div>
                <div className="import-stat">
                  <span className="value">{(validated?.summary.update || 0).toLocaleString()}</span>
                  <span className="label">Products to update</span>
                </div>
                {mappings.some((row) => row.targetKey === 'category') ? (
                  <>
                    <div className="import-stat">
                      <span className="value">{categoryPlan.existing.length.toLocaleString()}</span>
                      <span className="label">Categories in catalog</span>
                    </div>
                    {createMissingCategories && canCreateCategory ? (
                      <div className="import-stat is-success">
                        <span className="value">{categoryPlan.missing.length.toLocaleString()}</span>
                        <span className="label">Categories to create first</span>
                      </div>
                    ) : null}
                  </>
                ) : null}
                <div className="import-stat is-warning">
                  <span className="value">{(validated?.summary.skipped || 0).toLocaleString()}</span>
                  <span className="label">Skipped</span>
                </div>
                <div className="import-stat is-danger">
                  <span className="value">{(validated?.summary.errors || 0).toLocaleString()}</span>
                  <span className="label">Errors</span>
                </div>
              </div>
              <p className="text-xs text-uppercase fw-bold text-muted mb-2">Fields being imported</p>
              <div className="import-required-list">
                {mappedFields.map((field) => (
                  <span key={field.key} className="import-required-chip is-ok">
                    ✓ {field.label}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {step === 'progress' ? (
            <div>
              {progress.done ? (
                <div className="text-center py-3">
                  <div className="import-result-icon mb-3">
                    <NavIcon icon={FaCheck} size={22} />
                  </div>
                  <h5 className="mb-1">Import completed</h5>
                  <p className="text-muted text-sm">
                    {progress.categoryCreated
                      ? `${progress.categoryCreated.toLocaleString()} categories created · `
                      : ''}
                    {progress.created.toLocaleString()} created · {progress.updated.toLocaleString()} updated ·{' '}
                    {progress.skipped.toLocaleString()} skipped · {progress.failed.toLocaleString()} failed
                  </p>
                </div>
              ) : (
                <>
                  <div className="alert alert-warning py-2">
                    <strong>Do not reload or close this window</strong> until the import finishes. Reloading will stop
                    the import.
                  </div>
                  <h6>
                    {progress.phase === 'categories' ? 'Importing categories first…' : 'Importing products…'}
                  </h6>
                  <div className="import-progress-bar mb-2">
                    <span
                      style={{
                        width: `${
                          progress.phase === 'categories'
                            ? progress.categoryTotal
                              ? Math.round((progress.categoryProcessed / progress.categoryTotal) * 100)
                              : 0
                            : percent
                        }%`,
                      }}
                    />
                  </div>
                  {progress.phase === 'categories' ? (
                    <p className="text-sm mb-3">
                      {progress.categoryProcessed.toLocaleString()} / {progress.categoryTotal.toLocaleString()}{' '}
                      categories processed · {progress.categoryCreated.toLocaleString()} created
                    </p>
                  ) : (
                    <>
                      <p className="text-sm mb-1">
                        {percent}% · {progress.processed.toLocaleString()} / {progress.total.toLocaleString()} products
                        processed
                      </p>
                      {progress.batches > 1 ? (
                        <p className="text-sm text-muted mb-3">
                          Batch {progress.batch || 1} of {progress.batches} (100 products per batch)
                        </p>
                      ) : (
                        <div className="mb-3" />
                      )}
                    </>
                  )}
                </>
              )}
              <div className="import-stats">
                {progress.categoryTotal > 0 || progress.categoryCreated > 0 ? (
                  <div className="import-stat is-success">
                    <span className="value">{(progress.categoryCreated || 0).toLocaleString()}</span>
                    <span className="label">Categories created</span>
                  </div>
                ) : null}
                <div className="import-stat is-success">
                  <span className="value">{progress.created.toLocaleString()}</span>
                  <span className="label">Created</span>
                </div>
                <div className="import-stat">
                  <span className="value">{progress.updated.toLocaleString()}</span>
                  <span className="label">Updated</span>
                </div>
                <div className="import-stat is-warning">
                  <span className="value">{progress.skipped.toLocaleString()}</span>
                  <span className="label">Skipped</span>
                </div>
                <div className="import-stat is-danger">
                  <span className="value">{progress.failed.toLocaleString()}</span>
                  <span className="label">Failed</span>
                </div>
              </div>
              {progress.errors.length > 0 ? (
                <ul className="text-sm mt-3 mb-0">
                  {progress.errors.slice(0, 8).map((item) => (
                    <li key={`${item.row}-${item.error}`}>
                      Row {item.row}
                      {item.sku ? ` · ${item.sku}` : ''}: {item.error}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      </AppModal>

      <ConfirmDialog
        open={confirmOpen}
        title="Start import?"
        message={`Import ${readyCount.toLocaleString()} product${readyCount === 1 ? '' : 's'} now? This cannot be undone automatically.`}
        confirmLabel={`Import ${readyCount.toLocaleString()} products`}
        loading={importing}
        onClose={() => setConfirmOpen(false)}
        onConfirm={startImport}
      />
    </>
  );
}