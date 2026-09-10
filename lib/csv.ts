/** Minimal CSV serialization — quotes a field only when it needs it, escapes internal quotes. */
function toCsvValue(value: string): string {
  // Formula-injection guard: a spreadsheet treats a cell starting with = + - @ (or a control
  // char) as a formula, so a resident named "=HYPERLINK(...)" would execute on open. Prefix a
  // single quote to force it to plain text — the standard mitigation.
  const guarded = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  if (/[",\n]/.test(guarded)) return `"${guarded.replace(/"/g, '""')}"`
  return guarded
}

export function toCsv(headers: string[], rows: string[][]): string {
  return [headers, ...rows].map((row) => row.map(toCsvValue).join(',')).join('\r\n')
}
