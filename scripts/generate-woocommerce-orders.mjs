import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const productsPath = path.join(root, 'woocommerce_products.csv');
const outPath = path.join(root, 'woocommerce_orders.csv');

const ORDER_COUNT = 50;
const ORDER_NUMBER_START = 10001;

const firstNames = [
  'James',
  'Mary',
  'Robert',
  'Patricia',
  'John',
  'Jennifer',
  'Michael',
  'Linda',
  'David',
  'Elizabeth',
  'Sarah',
  'Daniel',
  'Emily',
  'Chris',
  'Jessica',
  'Andrew',
  'Ashley',
  'Ryan',
  'Amanda',
  'Kevin',
];

const lastNames = [
  'Smith',
  'Johnson',
  'Williams',
  'Brown',
  'Jones',
  'Garcia',
  'Miller',
  'Davis',
  'Rodriguez',
  'Martinez',
  'Wilson',
  'Anderson',
  'Taylor',
  'Thomas',
  'Moore',
  'Jackson',
  'Martin',
  'Lee',
  'Thompson',
  'White',
];

const cities = [
  { city: 'New York', state: 'NY', postcode: '10001' },
  { city: 'Los Angeles', state: 'CA', postcode: '90001' },
  { city: 'Chicago', state: 'IL', postcode: '60601' },
  { city: 'Houston', state: 'TX', postcode: '77001' },
  { city: 'Phoenix', state: 'AZ', postcode: '85001' },
  { city: 'Philadelphia', state: 'PA', postcode: '19101' },
  { city: 'San Antonio', state: 'TX', postcode: '78201' },
  { city: 'San Diego', state: 'CA', postcode: '92101' },
  { city: 'Dallas', state: 'TX', postcode: '75201' },
  { city: 'Austin', state: 'TX', postcode: '78701' },
];

const streets = [
  'Oak Street',
  'Maple Avenue',
  'Cedar Lane',
  'Pine Road',
  'Elm Drive',
  'Washington Blvd',
  'Lakeview Court',
  'Highland Park',
  'River Road',
  'Sunset Boulevard',
];

const paymentMethods = [
  { method: 'cod', title: 'Cash on delivery' },
  { method: 'bacs', title: 'Direct bank transfer' },
  { method: 'cheque', title: 'Check payments' },
  { method: 'stripe', title: 'Credit Card (Stripe)' },
  { method: 'paypal', title: 'PayPal' },
];

const statuses = [
  { status: 'completed', weight: 70 },
  { status: 'processing', weight: 20 },
  { status: 'on-hold', weight: 7 },
  { status: 'pending', weight: 3 },
];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const money = (n) => Number(n).toFixed(2);

const escapeCsv = (v) => {
  const s = String(v ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

const parseCsvLine = (line) => {
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
  return cols;
};

const parseProductsCsv = (text) => {
  const lines = text.replace(/^\uFEFF/, '').trim().split(/\r?\n/);
  const header = parseCsvLine(lines[0]);
  const skuIdx = header.indexOf('SKU');
  const nameIdx = header.indexOf('Name');
  const priceIdx = header.indexOf('Regular price');

  return lines.slice(1).map((line) => {
    const cols = parseCsvLine(line);
    return {
      sku: cols[skuIdx]?.trim() ?? '',
      name: cols[nameIdx]?.trim() ?? '',
      price: Number(cols[priceIdx]) || 0,
    };
  }).filter((p) => p.sku && p.name && p.price > 0);
};

const pickWeighted = (items) => {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item.status;
  }
  return items[0].status;
};

const formatDate = (date) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

const products = parseProductsCsv(fs.readFileSync(productsPath, 'utf8'));
if (products.length === 0) {
  console.error('No products found in woocommerce_products.csv');
  process.exit(1);
}

/** WebToffee / Order Import Export for WooCommerce — one row per line item. */
const headers = [
  'order_number',
  'order_date',
  'paid_date',
  'completed_date',
  'status',
  'payment_method',
  'payment_method_title',
  'order_currency',
  'shipping_total',
  'tax_total',
  'discount_total',
  'order_total',
  'customer_email',
  'customer_note',
  'billing_first_name',
  'billing_last_name',
  'billing_company',
  'billing_address_1',
  'billing_address_2',
  'billing_city',
  'billing_state',
  'billing_postcode',
  'billing_country',
  'billing_phone',
  'billing_email',
  'shipping_first_name',
  'shipping_last_name',
  'shipping_company',
  'shipping_address_1',
  'shipping_address_2',
  'shipping_city',
  'shipping_state',
  'shipping_postcode',
  'shipping_country',
  'product_name',
  'sku',
  'quantity',
  'item_total',
];

const rows = [];
const now = Date.now();

for (let i = 0; i < ORDER_COUNT; i++) {
  const orderNumber = ORDER_NUMBER_START + i;
  const first = pick(firstNames);
  const last = pick(lastNames);
  const loc = pick(cities);
  const streetNo = rand(100, 9999);
  const street = pick(streets);
  const address1 = `${streetNo} ${street}`;
  const address2 = Math.random() < 0.2 ? `Apt ${rand(1, 40)}` : '';
  const email = `${first.toLowerCase()}.${last.toLowerCase()}${rand(1, 99)}@example.com`;
  const phone = `+1-${rand(200, 989)}-${rand(200, 989)}-${String(rand(1000, 9999))}`;
  const pay = pick(paymentMethods);
  const status = pickWeighted(statuses);

  const daysAgo = rand(0, 89);
  const orderDate = new Date(now - daysAgo * 24 * 60 * 60 * 1000 - rand(0, 86400000));
  const orderDateStr = formatDate(orderDate);
  const paidDateStr =
    status === 'completed' || status === 'processing'
      ? formatDate(new Date(orderDate.getTime() + rand(5, 120) * 60000))
      : '';
  const completedDateStr = status === 'completed' ? paidDateStr || orderDateStr : '';

  const itemCount = rand(1, 3);
  const usedProductIdx = new Set();
  const lineItems = [];

  for (let j = 0; j < itemCount; j++) {
    let idx = rand(0, products.length - 1);
    let guard = 0;
    while (usedProductIdx.has(idx) && guard++ < 20) {
      idx = rand(0, products.length - 1);
    }
    usedProductIdx.add(idx);
    const product = products[idx];
    const qty = rand(1, 3);
    const itemTotal = product.price * qty;
    lineItems.push({
      product_name: product.name,
      sku: product.sku,
      quantity: qty,
      item_total: itemTotal,
    });
  }

  const subtotal = lineItems.reduce((sum, item) => sum + item.item_total, 0);
  const shippingTotal = subtotal >= 100 ? 0 : money(rand(5, 12));
  const taxTotal = '0.00';
  const discountTotal = '0.00';
  const orderTotal = money(Number(subtotal) + Number(shippingTotal));

  lineItems.forEach((item, lineIndex) => {
    rows.push({
      order_number: orderNumber,
      order_date: orderDateStr,
      paid_date: paidDateStr,
      completed_date: completedDateStr,
      status,
      payment_method: pay.method,
      payment_method_title: pay.title,
      order_currency: 'USD',
      shipping_total: lineIndex === 0 ? shippingTotal : '',
      tax_total: lineIndex === 0 ? taxTotal : '',
      discount_total: lineIndex === 0 ? discountTotal : '',
      order_total: lineIndex === 0 ? orderTotal : '',
      customer_email: email,
      customer_note: lineIndex === 0 && Math.random() < 0.1 ? 'Please leave at the front door.' : '',
      billing_first_name: first,
      billing_last_name: last,
      billing_company: '',
      billing_address_1: address1,
      billing_address_2: address2,
      billing_city: loc.city,
      billing_state: loc.state,
      billing_postcode: loc.postcode,
      billing_country: 'US',
      billing_phone: phone,
      billing_email: email,
      shipping_first_name: first,
      shipping_last_name: last,
      shipping_company: '',
      shipping_address_1: address1,
      shipping_address_2: address2,
      shipping_city: loc.city,
      shipping_state: loc.state,
      shipping_postcode: loc.postcode,
      shipping_country: 'US',
      product_name: item.product_name,
      sku: item.sku,
      quantity: item.quantity,
      item_total: money(item.item_total),
    });
  });
}

const lines = [
  headers.join(','),
  ...rows.map((row) => headers.map((h) => escapeCsv(row[h] ?? '')).join(',')),
];

fs.writeFileSync(outPath, `\ufeff${lines.join('\r\n')}`, 'utf8');
console.log(
  `Wrote ${ORDER_COUNT} orders (${rows.length} line items) to ${outPath}`
);
console.log('Import with: WooCommerce > WebToffee Import Export > Import > Order');
