const STORAGE_PREFIX = 'ai-pos:product-import-templates';

export const BUILTIN_MAPPING_TEMPLATES = [
  {
    id: 'builtin-woocommerce',
    name: 'WooCommerce Products',
    builtin: true,
    mappings: [
      { sourceHeader: 'Name', targetKey: 'name' },
      { sourceHeader: 'SKU', targetKey: 'sku' },
      { sourceHeader: 'Regular price', targetKey: 'price' },
      { sourceHeader: 'Sale price', targetKey: '' },
      { sourceHeader: 'Categories', targetKey: 'category' },
      { sourceHeader: 'Stock', targetKey: 'stock' },
      { sourceHeader: 'Description', targetKey: 'description' },
      { sourceHeader: 'Images', targetKey: 'image' },
      { sourceHeader: 'Published', targetKey: 'status' },
      { sourceHeader: 'Type', targetKey: 'product_type' },
      { sourceHeader: 'Weight (lbs)', targetKey: 'weight' },
      { sourceHeader: 'Length (in)', targetKey: 'length' },
      { sourceHeader: 'Width (in)', targetKey: 'width' },
      { sourceHeader: 'Height (in)', targetKey: 'height' },
    ],
  },
  {
    id: 'builtin-shopify',
    name: 'Shopify Products',
    builtin: true,
    mappings: [
      { sourceHeader: 'Title', targetKey: 'name' },
      { sourceHeader: 'Variant SKU', targetKey: 'sku' },
      { sourceHeader: 'Variant Barcode', targetKey: 'barcode' },
      { sourceHeader: 'Variant Price', targetKey: 'price' },
      { sourceHeader: 'Variant Inventory Qty', targetKey: 'stock' },
      { sourceHeader: 'Vendor', targetKey: 'brand' },
      { sourceHeader: 'Body HTML', targetKey: 'description' },
      { sourceHeader: 'Body (HTML)', targetKey: 'description' },
      { sourceHeader: 'Image Src', targetKey: 'image' },
    ],
  },
  {
    id: 'builtin-generic',
    name: 'Generic CSV',
    builtin: true,
    mappings: [
      { sourceHeader: 'Name', targetKey: 'name' },
      { sourceHeader: 'SKU', targetKey: 'sku' },
      { sourceHeader: 'Barcode', targetKey: 'barcode' },
      { sourceHeader: 'Category', targetKey: 'category' },
      { sourceHeader: 'Brand', targetKey: 'brand' },
      { sourceHeader: 'Wholesale Price', targetKey: 'wholesale_price' },
      { sourceHeader: 'Price', targetKey: 'price' },
      { sourceHeader: 'Stock', targetKey: 'stock' },
      { sourceHeader: 'Tax', targetKey: 'tax_rate' },
      { sourceHeader: 'Description', targetKey: 'description' },
      { sourceHeader: 'Status', targetKey: 'status' },
    ],
  },
];

function storageKey(companyId) {
  const id = String(companyId || 'default').trim() || 'default';
  return `${STORAGE_PREFIX}:${id}`;
}

function readStore(companyId) {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(storageKey(companyId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStore(companyId, templates) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(storageKey(companyId), JSON.stringify(templates));
}

export function listMappingTemplates(companyId) {
  return [...BUILTIN_MAPPING_TEMPLATES, ...readStore(companyId)];
}

export function saveMappingTemplate(companyId, name, mappings) {
  const label = String(name || '').trim();
  if (!label) throw new Error('Enter a name for this mapping template.');
  const compact = (mappings || [])
    .filter((row) => row?.sourceHeader)
    .map((row) => ({
      sourceHeader: String(row.sourceHeader),
      targetKey: row.targetKey || '',
    }));
  const templates = readStore(companyId);
  const existingIndex = templates.findIndex(
    (item) => String(item.name).toLowerCase() === label.toLowerCase()
  );
  const record = {
    id: existingIndex >= 0 ? templates[existingIndex].id : `${Date.now()}`,
    name: label,
    mappings: compact,
    updatedAt: new Date().toISOString(),
  };
  if (existingIndex >= 0) templates[existingIndex] = record;
  else templates.push(record);
  writeStore(companyId, templates);
  return record;
}

export function deleteMappingTemplate(companyId, templateId) {
  if (String(templateId || '').startsWith('builtin-')) return;
  const templates = readStore(companyId).filter((item) => item.id !== templateId);
  writeStore(companyId, templates);
}

export function applyMappingTemplate(headers, template, currentMappings) {
  if (!template || !Array.isArray(template.mappings)) return currentMappings;
  const byHeader = new Map(
    template.mappings.map((row) => [String(row.sourceHeader || '').trim().toLowerCase(), row.targetKey || ''])
  );
  const used = new Set();
  return (currentMappings || []).map((row, index) => {
    const header = String(headers[index] ?? row.sourceHeader ?? '')
      .trim()
      .toLowerCase();
    const targetKey = byHeader.has(header) ? byHeader.get(header) : row.targetKey;
    if (targetKey && used.has(targetKey)) {
      return { ...row, targetKey: '', confidence: 'none', auto: false };
    }
    if (targetKey) used.add(targetKey);
    return {
      ...row,
      targetKey: targetKey || '',
      confidence: targetKey ? 'high' : 'none',
      auto: Boolean(targetKey),
    };
  });
}
