import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const categoriesPath = path.join(root, 'shopify_categories.csv');
const outPath = path.join(root, 'shopify_products.csv');

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
  'IronHaven',
  'VelvetArc',
  'StoneBridge',
  'CloudNine',
  'PulseWave',
  'GoldenRidge',
  'FrostLine',
  'EmberGlow',
  'LumenCraft',
  'AtlasForge',
  'HarborView',
  'WildSprout',
  'CedarPeak',
  'NeonHive',
  'QuietLeaf',
  'BoldNest',
  'CrystalBay',
  'DriftWood',
  'EverMint',
  'FluxCore',
  'GraniteFox',
  'HearthStone',
  'IvoryLane',
  'JadeRiver',
  'KineticAir',
  'LunarDust',
  'MapleCrest',
  'NimbusWorks',
  'OrbitLine',
  'PineValley',
  'QuartzField',
  'RavenCove',
  'SummitGlow',
  'TimberWolf',
  'UnitySpark',
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
  if (/[",\n\r']/.test(s)) return `"${s.replace(/"/g, '""')}"`;
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
  const titleIdx = header.indexOf('Title');
  const parentIdx = header.indexOf('Parent');

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
      title: cols[titleIdx]?.trim() ?? '',
      parent: cols[parentIdx]?.trim() ?? '',
    };
  });
};

const categoriesRaw = fs.readFileSync(categoriesPath, 'utf8');
const allCategories = parseCategoriesCsv(categoriesRaw);
const leafCategories = allCategories.filter((c) => c.parent);
const categoryPool = leafCategories.length > 0 ? leafCategories : allCategories;

const usedHandles = new Set();
const usedSkus = new Set();
const products = [];

for (let i = 1; i <= PRODUCT_COUNT; i++) {
  const cat = categoryPool[(i - 1) % categoryPool.length];
  const brand = pick(brands);
  const adj = pick(adjectives);
  const model = `${rand(100, 999)}${String.fromCharCode(65 + rand(0, 25))}${rand(10, 99)}`;
  const catLabel = sanitizeLabel(cat.title);
  const title = `${brand} ${adj} ${catLabel} ${model}`;

  let handle = `shopify-import-${String(i).padStart(4, '0')}`;
  while (usedHandles.has(handle)) handle = `${handle}-${rand(10, 99)}`;
  usedHandles.add(handle);

  let sku = `shopify-import-${String(i).padStart(4, '0')}`;
  while (usedSkus.has(sku)) sku = `${sku}-${rand(10, 99)}`;
  usedSkus.add(sku);

  const isPremium =
    cat.parent === 'Jewelry & Watches' ||
    cat.parent === 'Electronics' ||
    cat.parent === 'Furniture';
  const variantPrice = money(isPremium ? 29.99 : 9.99, isPremium ? 899.99 : 249.99);
  const weightLbs = Math.random() * 5 + 0.5;
  const variantGrams = Math.round(weightLbs * 453.592);
  const shortDescription = 'This is a simple product.';
  const bodyHtml =
    `<p>${shortDescription}</p>` +
    '<p>Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. ' +
    'Vestibulum tortor quam, feugiat vitae, ultricies eget, tempor sit amet, ante.</p>';

  products.push({
    Handle: handle,
    Title: title,
    'Body (HTML)': bodyHtml,
    Vendor: brand,
    Type: cat.parent || cat.title,
    Tags: `${brand}, ${sanitizeLabel(cat.parent || cat.title)}`,
    Published: 'true',
    'Option1 Name': 'Title',
    'Option1 Value': 'Default Title',
    'Option2 Name': '',
    'Option2 Value': '',
    'Option3 Name': '',
    'Option3 Value': '',
    'Variant SKU': sku,
    'Variant Grams': String(variantGrams),
    'Variant Inventory Tracker': 'shopify',
    'Variant Inventory Qty': String(rand(5, 250)),
    'Variant Inventory Policy': 'deny',
    'Variant Fulfillment Service': 'manual',
    'Variant Price': variantPrice,
    'Variant Compare-at Price': '',
    'Variant Requires Shipping': 'true',
    'Variant Taxable': 'true',
    'Variant Barcode': '',
    'Image Src': '',
    'Image Alt Text': '',
    Collection: cat.title,
  });
}

// Shopify product import template — headers must match exactly (case-sensitive).
// Collection is an optional column documented by Shopify for assigning manual collections.
const headers = [
  'Handle',
  'Title',
  'Body (HTML)',
  'Vendor',
  'Type',
  'Tags',
  'Published',
  'Option1 Name',
  'Option1 Value',
  'Option2 Name',
  'Option2 Value',
  'Option3 Name',
  'Option3 Value',
  'Variant SKU',
  'Variant Grams',
  'Variant Inventory Tracker',
  'Variant Inventory Qty',
  'Variant Inventory Policy',
  'Variant Fulfillment Service',
  'Variant Price',
  'Variant Compare-at Price',
  'Variant Requires Shipping',
  'Variant Taxable',
  'Variant Barcode',
  'Image Src',
  'Image Alt Text',
  'Collection',
];

const lines = [
  headers.join(','),
  ...products.map((p) => headers.map((h) => escapeCsv(p[h] ?? '')).join(',')),
];

if (!outPath.toLowerCase().endsWith('.csv')) {
  throw new Error(`Output path must end with .csv (got: ${outPath})`);
}

// Plain UTF-8 CSV (no BOM) with Unix line endings — required for Shopify import.
fs.writeFileSync(outPath, `${lines.join('\n')}\n`, { encoding: 'utf8' });
console.log(`Wrote ${products.length} products to ${outPath}`);
