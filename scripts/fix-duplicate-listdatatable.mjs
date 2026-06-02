import fs from 'fs';
import path from 'path';

const routes = fs.readdirSync('src/routes', { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => path.join('src/routes', d.name, 'index.jsx'))
  .filter((f) => fs.existsSync(f));

const dupRe =
  /(<div className="card-body pt-0 px-0 pb-0">\s*<ListDataTable[\s\S]*?>\s*)<div className="card-body pt-0 px-0 pb-0">\s*<ListDataTable/;

for (const file of routes) {
  let c = fs.readFileSync(file, 'utf8');
  if (!c.includes('ListDataTable')) continue;
  const before = c;
  c = c.replace(dupRe, '$1<ListDataTable');
  c = c.replace(
    /\n  \/\/ Calculate pagination info\n  const startItem[\s\S]*?const endItem[^\n]+\n  \/\/ Reusable Pagination Component\n\n/,
    '\n'
  );
  if (c !== before) {
    fs.writeFileSync(file, c);
    console.log('fixed', file);
  }
}
