/**
 * Returns a date as YYYY-MM-DD string using the LOCAL timezone (not UTC).
 * Use this everywhere instead of new Date().toISOString().slice(0, 10)
 * which incorrectly returns UTC date — wrong for UTC+7 (Indonesia).
 */
export function localDateStr(date: Date = new Date()): string {
  return (
    `${date.getFullYear()}-` +
    `${String(date.getMonth() + 1).padStart(2, '0')}-` +
    `${String(date.getDate()).padStart(2, '0')}`
  )
}
