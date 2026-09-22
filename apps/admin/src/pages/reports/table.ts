import { dayKey, fmtIdrShort, fmtNumber, fmtPercent } from '@cmms/fixtures'

/** A number the table shows formatted and the CSV exports raw. */
export interface Measured {
  value: number
  text: string
}

export type Cell = string | number | Measured

/** The numbers behind a chart: shown by the Table toggle and written by Export CSV. */
export interface ReportTable {
  title: string
  columns: string[]
  rows: Cell[][]
  /** Columns kept on phones, counted from the left. The rest hide below `sm`. */
  phoneColumns?: number
}

export const measure = (value: number, text: string): Measured => ({ value, text })
export const percentCell = (ratio: number) => measure(Math.round(ratio * 1000) / 10, fmtPercent(ratio))
export const hoursCell = (hours: number) => measure(Math.round(hours * 10) / 10, `${fmtNumber(hours, 1)} h`)
export const idrCell = (rupiah: number) => measure(Math.round(rupiah), fmtIdrShort(rupiah))

export const isNumeric = (cell: Cell | undefined) => typeof cell === 'number' || (typeof cell === 'object' && cell !== null)

export function cellText(cell: Cell): string {
  if (typeof cell === 'number') return fmtNumber(cell)
  return typeof cell === 'string' ? cell : cell.text
}

function csvField(cell: Cell): string {
  const raw = typeof cell === 'object' ? String(cell.value) : String(cell)
  // Spreadsheet apps run a text cell that starts with = + or @ as a formula.
  const safe = typeof cell === 'string' && /^[=+@]/.test(raw) ? `'${raw}` : raw
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/** One block per table (title, header, rows), separated by a blank line. */
export function toCsv(tables: readonly ReportTable[]): string {
  return tables
    .map((t) => [csvField(t.title), t.columns.map(csvField).join(','), ...t.rows.map((row) => row.map(csvField).join(','))].join('\r\n'))
    .join('\r\n\r\n')
}

export const csvFileName = (siteCode: string, section: string, now: number) => `cmms-${siteCode.toLowerCase()}-${section}-${dayKey(now)}.csv`

export function downloadCsv(fileName: string, tables: readonly ReportTable[]) {
  // The byte order mark tells Excel the file is UTF-8.
  const blob = new Blob(['﻿', toCsv(tables)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
