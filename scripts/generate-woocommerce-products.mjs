import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const categoriesPath = path.join(root, 'woocommerce_categories.csv');
const outPath = path.join(root, 'woocommerce_products.csv');

const PRODUCT_COUNT = 100;

const brands = [
  'NorthPeak',
  'BlueLine',
  'TerraCraft',
  'SwiftPack',
  'AeroWear',
  'NovaTech',
  'PrimeHome',
  'ZenFit',
  'UrbanEdge',
  'CoastLite',
  'SilverOak',
  'BrightPath',
  'CoreVibe',
  'PeakFlow',
  'TrueForm',
];

const adjectives = [
  'Premium',
  'Classic',
  'Essential',
  'Deluxe',
  'Pro',
  'Compact',
  'Ultra',
  'Smart',
  'Eco',
  'Daily',
  'Signature',
  'Studio',
  'Active',
  'Heritage',
  'Modern',
];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const money = (min, max) => (Math.random() * (max - min) + min).toFixed(2);

const escapeCsv = (v) => {
  const s = String(v ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const sanitizeLabel = (s) =>
  String(s)
    .replace(/'/g, '')
    .replace(/&/g, 'and')
    .replace(/\s+/g, ' ')
    .trim();

const parseCategoriesCsv = (text) => {
  const lines = text.replace(/^\uFEFF/, '').trim().split(/\r?\n/);
  const header = lines[0].split(',');
  const nameIdx = header.indexOf('name');
  const parentIdx = header.indexOf('parent');

  return lines.slice(1).map((line) => {
    const cols = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        cols.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    cols.push(cur);
    return {
      name: cols[nameIdx]?.trim() ?? '',
      parent: cols[parentIdx]?.trim() ?? '',
    };
  });
};

const categoryPath = (cat) => {
  const parent = sanitizeLabel(cat.parent);
  const name = sanitizeLabel(cat.name);
  return parent ? `${parent} > ${name}` : name;
};

const categoriesRaw = fs.readFileSync(categoriesPath, 'utf8');
const allCategories = parseCategoriesCsv(categoriesRaw);
const leafCategories = allCategories.filter((c) => c.parent);
const categoryPool = leafCategories.length > 0 ? leafCategories : allCategories;

const usedSkus = new Set();
const products = [];

for (let i = 1; i <= PRODUCT_COUNT; i++) {
  const cat = categoryPool[(i - 1) % categoryPool.length];
  const brand = pick(brands);
  const adj = pick(adjectives);
  const model = `${rand(100, 999)}${String.fromCharCode(65 + rand(0, 25))}${rand(10, 99)}`;
  const catLabel = sanitizeLabel(cat.name);
  const name = `${brand} ${adj} ${catLabel} ${model}`;

  let sku = `woo-import-${String(i).padStart(4, '0')}`;
  while (usedSkus.has(sku)) sku = `${sku}-${rand(10, 99)}`;
  usedSkus.add(sku);

  const isPremium =
    cat.parent === 'Jewelry & Watches' ||
    cat.parent === 'Electronics' ||
    cat.parent === 'Furniture';
  const regularPrice = money(isPremium ? 29.99 : 9.99, isPremium ? 899.99 : 249.99);
  const weight = (Math.random() * 5 + 0.5).toFixed(2);
  const categories = categoryPath(cat);
  const shortDescription = 'This is a simple product.';
  const description =
    'Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. ' +
    'Vestibulum tortor quam, feugiat vitae, ultricies eget, tempor sit amet, ante.';

  products.push({
    Type: 'simple',
    SKU: sku,
    Name: name,
    Published: '1',
    'Is featured?': '0',
    'Visibility in catalog': 'visible',
    'Short description': shortDescription,
    Description: description,
    'Tax status': 'taxable',
    'Tax class': '',
    'In stock?': '1',
    Stock: '',
    'Backorders allowed?': '0',
    'Sold individually?': '0',
    'Weight (lbs)': weight,
    'Length (in)': String(rand(4, 20)),
    'Width (in)': String(rand(4, 16)),
    'Height (in)': String(rand(1, 10)),
    'Allow customer reviews?': '1',
    'Purchase note': '',
    'Sale price': '',
    'Regular price': regularPrice,
    Categories: categories,
    Tags: '',
    'Shipping class': '',
    Images: '',
  });
}

// Match WooCommerce official sample_products.csv headers exactly.
const headers = [
  'ID',
  'Type',
  'SKU',
  'Name',
  'Published',
  'Is featured?',
  'Visibility in catalog',
  'Short description',
  'Description',
  'Date sale price starts',
  'Date sale price ends',
  'Tax status',
  'Tax class',
  'In stock?',
  'Stock',
  'Backorders allowed?',
  'Sold individually?',
  'Weight (lbs)',
  'Length (in)',
  'Width (in)',
  'Height (in)',
  'Allow customer reviews?',
  'Purchase note',
  'Sale price',
  'Regular price',
  'Categories',
  'Tags',
  'Shipping class',
  'Images',
  'Download limit',
  'Download expiry days',
  'Parent',
  'Grouped products',
  'Upsells',
  'Cross-sells',
  'External URL',
  'Button text',
  'Position',
];

const quoteHeader = (h) => (/[?,\s]/.test(h) ? `"${h}"` : h);

const lines = [
  headers.map(quoteHeader).join(','),
  ...products.map((p) =>
    headers
      .map((h) => {
        if (h === 'ID') return '';
        return escapeCsv(p[h] ?? '');
      })
      .join(',')
  ),
];

fs.writeFileSync(outPath, `\ufeff${lines.join('\r\n')}`, 'utf8');
console.log(`Wrote ${products.length} products to ${outPath}`);
