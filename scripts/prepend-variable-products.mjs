import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const csvPath = path.join(__dirname, '..', 'shopify_products.csv');

const escapeCsv = (v) => {
  const s = String(v ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const money = (n) => n.toFixed(2);

const products = [
  {
    handle: 'shopify-var-0001',
    title: 'CloudNine Premium Mens Hoodie',
    vendor: 'CloudNine',
    type: 'Clothing',
    tags: 'CloudNine, Clothing, variable',
    collection: "Men's Hoodies",
    colors: ['Black', 'Navy', 'Olive'],
    sizes: ['S', 'M', 'L', 'XL'],
    base: 89.99,
  },
  {
    handle: 'shopify-var-0002',
    title: 'AeroWear Classic Womens Tee',
    vendor: 'AeroWear',
    type: 'Clothing',
    tags: 'AeroWear, Clothing, variable',
    collection: "Women's T-Shirts",
    colors: ['White', 'Pink', 'Teal'],
    sizes: ['XS', 'S', 'M', 'L'],
    base: 34.99,
  },
  {
    handle: 'shopify-var-0003',
    title: 'RavenCove Kids Joggers',
    vendor: 'RavenCove',
    type: 'Clothing',
    tags: 'RavenCove, Clothing, variable',
    collection: 'Kids Pants',
    colors: ['Red', 'Blue', 'Yellow'],
    sizes: ['4', '6', '8', '10'],
    base: 29.99,
  },
  {
    handle: 'shopify-var-0004',
    title: 'NorthPeak Active Running Shorts',
    vendor: 'NorthPeak',
    type: 'Clothing',
    tags: 'NorthPeak, Clothing, variable',
    collection: 'Activewear',
    colors: ['Black', 'Gray', 'Green'],
    sizes: ['S', 'M', 'L', 'XL'],
    base: 42.5,
  },
  {
    handle: 'shopify-var-0005',
    title: 'FrostLine Essential Winter Jacket',
    vendor: 'FrostLine',
    type: 'Clothing',
    tags: 'FrostLine, Clothing, variable',
    collection: 'Outerwear',
    colors: ['Charcoal', 'Burgundy', 'Forest'],
    sizes: ['S', 'M', 'L', 'XL'],
    base: 129.99,
  },
  {
    handle: 'shopify-var-0006',
    title: 'TerraCraft Studio Denim Shirt',
    vendor: 'TerraCraft',
    type: 'Clothing',
    tags: 'TerraCraft, Clothing, variable',
    collection: "Men's Shirts",
    colors: ['Indigo', 'Light Blue', 'Black'],
    sizes: ['S', 'M', 'L', 'XL'],
    base: 59.99,
  },
  {
    handle: 'shopify-var-0007',
    title: 'BrightPath Signature Yoga Leggings',
    vendor: 'BrightPath',
    type: 'Clothing',
    tags: 'BrightPath, Clothing, variable',
    collection: 'Activewear',
    colors: ['Black', 'Purple', 'Coral'],
    sizes: ['XS', 'S', 'M', 'L'],
    base: 48.0,
  },
  {
    handle: 'shopify-var-0008',
    title: 'StoneBridge Heritage Polo',
    vendor: 'StoneBridge',
    type: 'Clothing',
    tags: 'StoneBridge, Clothing, variable',
    collection: "Men's Polos",
    colors: ['White', 'Navy', 'Maroon'],
    sizes: ['S', 'M', 'L', 'XL'],
    base: 54.99,
  },
  {
    handle: 'shopify-var-0009',
    title: 'CoreVibe Modern Tank Top',
    vendor: 'CoreVibe',
    type: 'Clothing',
    tags: 'CoreVibe, Clothing, variable',
    collection: "Women's Tops",
    colors: ['Black', 'White', 'Mint'],
    sizes: ['XS', 'S', 'M', 'L'],
    base: 24.99,
  },
  {
    handle: 'shopify-var-0010',
    title: 'HarborView Deluxe Swim Trunks',
    vendor: 'HarborView',
    type: 'Clothing',
    tags: 'HarborView, Clothing, variable',
    collection: 'Swimwear',
    colors: ['Navy', 'Coral', 'Sky Blue'],
    sizes: ['S', 'M', 'L', 'XL'],
    base: 39.99,
  },
];

const sizeBump = { XS: 0, 4: 0, S: 0, 6: 2, M: 2, 8: 4, L: 4, 10: 6, XL: 6 };
const body =
  '<p>This is a variable product with Color and Size options.</p>' +
  '<p>Choose your preferred color and size combination.</p>';

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

const variantRows = [];
for (const p of products) {
  let first = true;
  for (const color of p.colors) {
    for (const size of p.sizes) {
      const colorCode = color.replace(/\s+/g, '').toUpperCase().slice(0, 8);
      const sku = `${p.handle}-${colorCode}-${size}`;
      const price = money(p.base + (sizeBump[size] ?? 0));
      const row = {
        Handle: p.handle,
        Title: first ? p.title : '',
        'Body (HTML)': first ? body : '',
        Vendor: first ? p.vendor : '',
        Type: first ? p.type : '',
        Tags: first ? p.tags : '',
        Published: first ? 'true' : '',
        'Option1 Name': first ? 'Color' : '',
        'Option1 Value': color,
        'Option2 Name': first ? 'Size' : '',
        'Option2 Value': size,
        'Option3 Name': '',
        'Option3 Value': '',
        'Variant SKU': sku,
        'Variant Grams': String(rand(280, 950)),
        'Variant Inventory Tracker': 'shopify',
        'Variant Inventory Qty': String(rand(15, 120)),
        'Variant Inventory Policy': 'deny',
        'Variant Fulfillment Service': 'manual',
        'Variant Price': price,
        'Variant Compare-at Price': '',
        'Variant Requires Shipping': 'true',
        'Variant Taxable': 'true',
        'Variant Barcode': '',
        'Image Src': '',
        'Image Alt Text': '',
        Collection: first ? p.collection : '',
      };
      variantRows.push(headers.map((h) => escapeCsv(row[h] ?? '')).join(','));
      first = false;
    }
  }
}

const existing = fs.readFileSync(csvPath, 'utf8').replace(/^\uFEFF/, '');
const lines = existing.trim().split(/\r?\n/);
const header = lines[0];
const rest = lines.slice(1);

// Skip if variable products already prepended (idempotent).
const alreadyHas = rest.some((line) => line.startsWith('shopify-var-0001,'));
const bodyLines = alreadyHas ? rest : [...variantRows, ...rest];

fs.writeFileSync(csvPath, `${header}\n${bodyLines.join('\n')}\n`, 'utf8');
console.log(
  alreadyHas
    ? 'Variable products already present; no changes made.'
    : `Prepended ${products.length} variable products (${variantRows.length} variant rows).`
);
