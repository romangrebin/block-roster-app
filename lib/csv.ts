/** Minimal CSV serialization — quotes a field only when it needs it, escapes internal quotes. */
function toCsvValue(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

export function toCsv(headers: string[], rows: string[][]): string {
  return [headers, ...rows].map((row) => row.map(toCsvValue).join(',')).join('\r\n')
}
