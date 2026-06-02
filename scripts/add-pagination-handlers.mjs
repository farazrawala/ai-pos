import fs from 'fs';
import path from 'path';

const snippet = `
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      dispatch(setPage(newPage));
    }
  };

  const handleLimitChange = (limit) => {
    dispatch(setLimit(limit));
  };
`;

for (const d of fs.readdirSync('src/routes')) {
  const f = path.join('src/routes', d, 'index.jsx');
  if (!fs.existsSync(f)) continue;
  let c = fs.readFileSync(f, 'utf8');
  if (!c.includes('ListDataTable') || c.includes('const handlePageChange')) continue;
  const idx = c.indexOf('const handleSearchChange');
  if (idx === -1) continue;
  const lineStart = c.lastIndexOf('\n', idx) + 1;
  c = c.slice(0, lineStart) + snippet + c.slice(lineStart);
  fs.writeFileSync(f, c);
  console.log('handlers', d);
}
