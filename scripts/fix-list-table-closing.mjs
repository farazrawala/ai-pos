import fs from 'fs';
import path from 'path';

const files = fs.readdirSync('src/routes', { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => path.join('src/routes', d.name, 'index.jsx'))
  .filter((f) => fs.existsSync(f));

for (const file of files) {
  let c = fs.readFileSync(file, 'utf8');
  if (!c.includes('ListDataTable')) continue;
  const before = c;
  c = c.replace(
    /              <\/ListDataTable>\n            <\/div><\/div>/g,
    '              </ListDataTable>\n            </div>'
  );
  c = c.replace(
    /              <\/ListDataTable>\n            <\/div>\{!loading && !error &&\n\}\n            <\/div>/g,
    '              </ListDataTable>\n            </div>'
  );
  c = c.replace(
    /              <\/ListDataTable>\n            <\/div>\{deleteError && <div className="alert alert-danger mt-3 mb-0">\{deleteError\}<\/div>\}\n            <\/div>/g,
    `              </ListDataTable>
              {deleteError && (
                <div className="alert alert-danger mx-3 mb-3" role="alert">{deleteError}</div>
              )}
            </div>`
  );
  if (c !== before) {
    fs.writeFileSync(file, c);
    console.log('fixed', file);
  }
}
