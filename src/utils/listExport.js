function escapeCsvCell(value) {
  const s = String(value ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function cellValue(column, row) {
  if (typeof column.value === 'function') return column.value(row);
  if (column.key != null) return row[column.key];
  return '';
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** @param {{ columns: Array<{ key?: string, label: string, value?: (row: object) => unknown }>, rows: object[], filename: string }} opts */
export function exportRowsToCsv({ columns, rows, filename }) {
  const headerLine = columns.map((c) => escapeCsvCell(c.label)).join(',');
  const bodyLines = rows.map((row) =>
    columns.map((c) => escapeCsvCell(cellValue(c, row))).join(',')
  );
  const blob = new Blob(['\ufeff', [headerLine, ...bodyLines].join('\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  triggerDownload(blob, `${filename}.csv`);
}

/** @param {{ columns: Array, rows: object[], filename: string, sheetTitle?: string }} opts */
export function exportRowsToExcel({ columns, rows, filename, sheetTitle = 'Export' }) {
  const head = columns.map((c) => `<th>${escapeHtml(c.label)}</th>`).join('');
  const body = rows
    .map((row) => {
      const cells = columns.map((c) => `<td>${escapeHtml(cellValue(c, row))}</td>`).join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"></head><body><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`;
  triggerDownload(
    new Blob(['\ufeff', html], { type: 'application/vnd.ms-excel;charset=utf-8;' }),
    `${filename}.xls`
  );
}

/** @param {{ columns: Array, rows: object[], filename: string, title?: string }} opts */
export async function exportRowsToPdf({ columns, rows, filename, title }) {
  const { jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');
  const doc = new jsPDF({
    orientation: columns.length > 6 ? 'landscape' : 'portrait',
    unit: 'pt',
    format: 'a4',
  });
  doc.setFontSize(14);
  doc.text(title || filename, 40, 36);
  autoTable(doc, {
    startY: 48,
    head: [columns.map((c) => c.label)],
    body: rows.map((row) => columns.map((c) => String(cellValue(c, row) ?? ''))),
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [94, 114, 228] },
  });
  doc.save(`${filename}.pdf`);
}
