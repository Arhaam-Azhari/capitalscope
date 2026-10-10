export function csvCell(value: string | number | null | undefined) {
  if (value == null) return '';
  if (typeof value === 'number') return String(value);
  // I quote text and protect formula-like fields while leaving signed dollar changes numeric.
  const safe = /^[=+@-]/.test(value.trimStart()) || /^[\t\r\n]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

