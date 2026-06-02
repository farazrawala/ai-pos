/**
 * Apply ListDataTable layout to standard list index pages.
 * node scripts/apply-list-table-layout.mjs
 */
import fs from 'fs';
import path from 'path';

const root = path.resolve('src/routes');

const pages = [
  ['category', 'categories-table-page-size', 'Loading categories…'],
  ['product', 'products-table-page-size', 'Loading products…'],
  ['attribute', 'attributes-table-page-size', 'Loading attributes…'],
  ['branch', 'branch-table-page-size', 'Loading branches…'],
  ['warehouse', 'warehouse-table-page-size', 'Loading warehouses…'],
  ['accounts', 'accounts-table-page-size', 'Loading accounts…'],
  ['orders', 'orders-table-page-size', 'Loading orders…'],
  ['logs', 'logs-table-page-size', 'Loading logs…'],
  ['expense', 'expenses-table-page-size', 'Loading expenses…'],
  ['adjustment', 'adjustments-table-page-size', 'Loading adjustments…'],
  ['amount_transfer', 'amount-transfers-table-page-size', 'Loading transfers…'],
  ['asset', 'assets-table-page-size', 'Loading assets…'],
  ['stock', 'stock-table-page-size', 'Loading stock…'],
  ['payment_receipt', 'payment-receipts-table-page-size', 'Loading payment receipts…'],
  ['purchase_order', 'purchase-orders-table-page-size', 'Loading purchase orders…'],
];

const importBlock = `import ListDataTable from '../../components/list/ListDataTable.jsx';
`;

function removePaginationControlsFunction(src) {
  const marker = 'const PaginationControls = () => {';
  let idx = src.indexOf(marker);
  if (idx === -1) return src;
  // back to start of line
  while (idx > 0 && src[idx - 1] !== '\n') idx--;
  let i = src.indexOf('{', idx);
  let depth = 0;
  const start = idx;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) {
        i++; // include closing brace
        if (src[i] === ';') i++;
        if (src[i] === '\r') i++;
        if (src[i] === '\n') i++;
        return src.slice(0, start) + src.slice(i);
      }
    }
  }
  return src;
}

function removePaginationCalc(src) {
  return src.replace(
    /\n  \/\/ Calculate pagination info\n  const startItem[\s\S]*?const endItem[^\n]+\n/,
    '\n'
  );
}

function apply(src, selectId, loadingLabel) {
  if (src.includes('ListDataTable')) return { src, ok: false, reason: 'already' };
  if (!src.includes('SearchInputIcon')) return { src, ok: false, reason: 'no search' };

  let c = src;
  c = c.replace(
    /import SearchInputIcon from '\.\.\/\.\.\/components\/SearchInputIcon\.jsx';/,
    `${importBlock}import SearchInputIcon from '../../components/SearchInputIcon.jsx';`
  );
  c = removePaginationCalc(c);
  c = removePaginationControlsFunction(c);
  c = c.replace(/\s*<PaginationControls \/>\s*/g, '\n');
  c = c.replace(/\s*\{!loading && !error && <PaginationControls \/>\}\s*/g, '\n');

  c = c.replace(
    /const handleLimitChange = \(e\) => \{\s*\n\s*dispatch\(setLimit\(Number\(e\.target\.value\)\)\);\s*\n\s*\};/g,
    'const handleLimitChange = (limit) => {\n    dispatch(setLimit(limit));\n  };'
  );

  c = c.replace(
    /<div className="card" style=\{\{ maxWidth: '100%' \}\}>/g,
    `<div className="card shadow-sm" style={{ maxWidth: '100%' }}>`
  );
  c = c.replace(/<div className="card">\n/g, '<div className="card shadow-sm">\n');

  const open = `<div className="card-body pt-0 px-0 pb-0">
              <ListDataTable
                loading={loading}
                loadingLabel="${loadingLabel}"
                error={error}
                pagination={pagination}
                onPageChange={handlePageChange}
                onLimitChange={handleLimitChange}
                selectId="${selectId}"
                showPagination={!loading && !error && pagination.total > 0}
              >`;

  // Pattern 1: standard
  const p1 =
    /<div className="card-body pt-0">\s*(?:\{\/\*[\s\S]*?\*\/\}\s*)?<div className="table-responsive">\s*\{loading &&[\s\S]*?\{error &&[\s\S]*?\{!loading && !error && \(\s*<table[\s\S]*?<\/table>\s*\)\}\s*<\/div>/;
  if (p1.test(c)) {
    c = c.replace(p1, `${open}\n                $&`.replace(/<div className="card-body pt-0">\s*(?:\{\/\*[\s\S]*?\*\/\}\s*)?<div className="table-responsive">\s*\{loading &&[\s\S]*?\{error &&[\s\S]*?\{!loading && !error && \(\s*/, ''));
  }

  // Simpler approach - two step
  const bodyStart = c.indexOf('<div className="card-body pt-0">');
  if (bodyStart === -1) return { src, ok: false, reason: 'no card-body' };

  const tableStart = c.indexOf('<table', bodyStart);
  const tableEnd = c.indexOf('</table>', tableStart) + '</table>'.length;
  if (tableStart === -1 || tableEnd < tableStart) return { src, ok: false, reason: 'no table' };

  const beforeBody = c.slice(0, bodyStart);
  let tableBlock = c.slice(tableStart, tableEnd);
  let afterTable = c.slice(tableEnd);

  // Find end of card-body (next closing at card level) - remove table-responsive wrappers and loading/error wrappers from afterTable start
  afterTable = afterTable.replace(/^\s*\)\}\s*/, '');
  afterTable = afterTable.replace(/^\s*<\/div>\s*/, '');
  afterTable = afterTable.replace(/^\s*(?:\{\/\*[\s\S]*?\*\/\}\s*)?/, '');
  afterTable = afterTable.replace(/^\s*<PaginationControls \/>\s*/, '');

  tableBlock = tableBlock.replace(/<table className="table table-flush[^"]*"/, '<table className="table align-items-center mb-0"');
  tableBlock = tableBlock.replace(/<thead className="thead-light">/g, '<thead>');

  // Remove inline pagination before table-responsive in body (accounts)
  let bodyPrefix = c.slice(bodyStart, tableStart);
  bodyPrefix = bodyPrefix.replace(/<div className="card-body pt-0">/, '');
  bodyPrefix = bodyPrefix.replace(
    /\{!loading && !error && pagination\.total > 0 && \([\s\S]*?\)\}\s*/g,
    ''
  );
  bodyPrefix = bodyPrefix.replace(/<div className="table-responsive">\s*\{loading &&[\s\S]*?\{error &&[\s\S]*?\{!loading && !error && \(\s*$/, '');

  const newBody = `${open}\n                ${tableBlock}\n              </ListDataTable>\n            </div>`;

  c = beforeBody + newBody + afterTable;
  return { src: c, ok: true };
}

for (const [dir, selectId, label] of pages) {
  const file = path.join(root, dir, 'index.jsx');
  if (!fs.existsSync(file)) continue;
  const original = fs.readFileSync(file, 'utf8');
  const result = apply(original, selectId, label);
  if (result.ok) {
    fs.writeFileSync(file, result.src);
    console.log('OK', dir);
  } else {
    console.log('SKIP', dir, result.reason);
  }
}

console.log('done');
