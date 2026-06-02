import fs from 'fs';
import path from 'path';

const files = [
  'src/routes/category/index.jsx',
  'src/routes/product/index.jsx',
  'src/routes/attribute/index.jsx',
  'src/routes/purchase_order/index.jsx',
  'src/routes/payment_receipt/index.jsx',
  'src/routes/asset/index.jsx',
  'src/routes/logs/index.jsx',
  'src/routes/expense/index.jsx',
  'src/routes/adjustment/index.jsx',
  'src/routes/amount_transfer/index.jsx',
];

const root = path.resolve('.');

for (const rel of files) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) continue;
  let c = fs.readFileSync(file, 'utf8');
  const before = c;
  c = c.replace(
    /\n  \/\/ Calculate pagination info[\s\S]*?const PaginationControls = \(\) => \{[\s\S]*?\n  \};\n/,
    '\n'
  );
  c = c.replace(/\n  const PaginationControls = \(\) => \{[\s\S]*?\n  \};\n/, '\n');
  c = c.replace(/\s*<PaginationControls \/>\s*/g, '\n');
  c = c.replace(/\s*\{!loading && !error && <PaginationControls \/>\}\s*/g, '\n');
  if (c !== before) fs.writeFileSync(file, c);
  console.log(rel, c !== before ? 'cleaned' : '—');
}
