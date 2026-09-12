"use client"
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useMemo, useState } from "react"
import { ArrowUpDown, ArrowUp, ArrowDown, Download, Columns3 } from "lucide-react"

export type DataTableColumn<T> = {
  key: string
  label: string
  /** Right-aligns the header + cells — use for money/counts. */
  align?: "left" | "right"
  /** Omit to make the column always visible (can't be hidden via the Columns menu). */
  hideable?: boolean
  sortable?: boolean
  /** Required for sortable columns — the raw value to compare. */
  sortValue?: (row: T) => string | number
  /** Value written to the CSV export; falls back to sortValue, then "". */
  exportValue?: (row: T) => string
  render: (row: T) => React.ReactNode
}

type SortState = { key: string; direction: "asc" | "desc" } | null

function toCsvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

/**
 * Shared list-table primitive: sortable columns, a column-visibility menu
 * (persisted per table via localStorage), row selection with a bulk-actions
 * slot, and CSV export — the four things every admin list table lacked
 * before this (each was a hand-rolled <table> with none of it).
 */
export default function DataTable<T>({
  tableId,
  columns,
  rows,
  getRowId,
  renderBulkActions,
  exportFilename,
  emptyState,
}: {
  /** Unique per table — used as the localStorage key for column visibility. */
  tableId: string
  columns: DataTableColumn<T>[]
  rows: T[]
  getRowId: (row: T) => string
  renderBulkActions?: (selectedIds: string[], clearSelection: () => void) => React.ReactNode
  exportFilename?: string
  emptyState?: React.ReactNode
}) {
  const storageKey = `datatable:${tableId}:hidden-columns`

  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(new Set())
  const [columnMenuOpen, setColumnMenuOpen] = useState(false)
  const [sort, setSort] = useState<SortState>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) setHiddenKeys(new Set(JSON.parse(raw)))
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  function toggleColumn(key: string) {
    setHiddenKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      try {
        localStorage.setItem(storageKey, JSON.stringify([...next]))
      } catch { /* ignore */ }
      return next
    })
  }

  const visibleColumns = columns.filter((c) => !hiddenKeys.has(c.key))

  const sortedRows = useMemo(() => {
    if (!sort) return rows
    const col = columns.find((c) => c.key === sort.key)
    if (!col?.sortValue) return rows
    const withKeys = rows.map((row) => ({ row, v: col.sortValue!(row) }))
    withKeys.sort((a, b) => {
      if (a.v < b.v) return sort.direction === "asc" ? -1 : 1
      if (a.v > b.v) return sort.direction === "asc" ? 1 : -1
      return 0
    })
    return withKeys.map((w) => w.row)
  }, [rows, sort, columns])

  function toggleSort(key: string) {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, direction: "asc" }
      if (prev.direction === "asc") return { key, direction: "desc" }
      return null
    })
  }

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected((prev) =>
      prev.size === sortedRows.length ? new Set() : new Set(sortedRows.map((r) => getRowId(r))),
    )
  }

  function exportCsv() {
    const header = visibleColumns.map((c) => toCsvCell(c.label)).join(",")
    const lines = sortedRows.map((row) =>
      visibleColumns
        .map((c) => toCsvCell(c.exportValue?.(row) ?? String(c.sortValue?.(row) ?? "")))
        .join(","),
    )
    const csv = [header, ...lines].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${exportFilename ?? tableId}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (rows.length === 0 && emptyState) return <>{emptyState}</>

  return (
    <div>
      <div className="flex items-center justify-between gap-2 px-1 pb-2">
        <div className="text-[12.5px] text-ink-3">
          {selected.size > 0 ? `${selected.size} selected` : `${rows.length} row${rows.length === 1 ? "" : "s"}`}
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && renderBulkActions?.(
            [...selected],
            () => setSelected(new Set()),
          )}
          <div className="relative">
            <button
              type="button"
              onClick={() => setColumnMenuOpen((o) => !o)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-paper px-3 py-1.5 text-[12.5px] font-medium text-ink-2 hover:text-ink hover:border-line-2 transition-colors"
            >
              <Columns3 size={13} /> Columns
            </button>
            {columnMenuOpen && (
              <div className="absolute right-0 z-20 mt-1 w-56 rounded-xl border border-line bg-paper shadow-lg p-2">
                {columns.filter((c) => c.hideable !== false).map((c) => (
                  <label key={c.key} className="flex items-center gap-2 px-2 py-1.5 text-[13px] text-ink-2 hover:bg-paper-2 rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!hiddenKeys.has(c.key)}
                      onChange={() => toggleColumn(c.key)}
                    />
                    {c.label}
                  </label>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-paper px-3 py-1.5 text-[12.5px] font-medium text-ink-2 hover:text-ink hover:border-line-2 transition-colors"
          >
            <Download size={13} /> Export CSV
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line bg-paper">
        <table className="w-full">
          <thead>
            <tr className="border-b border-line text-[11px] font-semibold tracking-widest text-ink-3 uppercase">
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={selected.size > 0 && selected.size === sortedRows.length}
                  onChange={toggleAll}
                  aria-label="Select all rows"
                />
              </th>
              {visibleColumns.map((c) => (
                <th
                  key={c.key}
                  className={`px-3 py-3 font-semibold ${c.align === "right" ? "text-right" : "text-left"}`}
                >
                  {c.sortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(c.key)}
                      className="inline-flex items-center gap-1 hover:text-ink transition-colors"
                    >
                      {c.label}
                      {sort?.key === c.key ? (
                        sort.direction === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                      ) : (
                        <ArrowUpDown size={12} className="opacity-40" />
                      )}
                    </button>
                  ) : (
                    c.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {sortedRows.map((row) => {
              const id = getRowId(row)
              return (
                <tr key={id} className={`hover:bg-paper-2 transition-colors ${selected.has(id) ? "bg-paper-2" : ""}`}>
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={selected.has(id)} onChange={() => toggleRow(id)} aria-label="Select row" />
                  </td>
                  {visibleColumns.map((c) => (
                    <td key={c.key} className={`px-3 py-3 text-[13.5px] text-ink ${c.align === "right" ? "text-right" : "text-left"}`}>
                      {c.render(row)}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
