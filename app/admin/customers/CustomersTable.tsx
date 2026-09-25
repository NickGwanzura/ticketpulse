"use client"

import DataTable, { type DataTableColumn } from "@/components/ui/DataTable"
import type { CustomerRow } from "@/lib/customers"
import { formatCurrency, formatDateShort } from "@/lib/utils"

// Column render/sort functions cannot cross from a Server Component into the
// client DataTable, so the table is defined client-side.

const CUSTOMER_COLUMNS: DataTableColumn<CustomerRow>[] = [
  {
    key: "name",
    label: "Buyer",
    hideable: false,
    sortable: true,
    sortValue: (c) => c.name ?? c.email,
    exportValue: (c) => c.name ?? "",
    render: (c) => (
      <>
        <p className="text-[14px] font-semibold tracking-tight text-ink">{c.name ?? "—"}</p>
        <p className="text-[12px] text-ink-3 mt-0.5">{c.email}{c.phone ? ` · ${c.phone}` : ""}</p>
      </>
    ),
  },
  {
    key: "orders",
    label: "Orders",
    align: "right",
    sortable: true,
    sortValue: (c) => c.orderCount,
    exportValue: (c) => String(c.orderCount),
    render: (c) => <span className="tabular-nums">{c.orderCount}</span>,
  },
  {
    key: "events",
    label: "Events attended",
    sortable: true,
    sortValue: (c) => c.eventCount,
    exportValue: (c) => c.events.join("; "),
    render: (c) => (
      <span className="text-[13px] text-ink-2 line-clamp-1" title={c.events.join(", ")}>
        {c.eventCount} — {c.events.join(", ")}
      </span>
    ),
  },
  {
    key: "totalSpent",
    label: "Lifetime spend",
    align: "right",
    sortable: true,
    sortValue: (c) => c.totalSpent,
    exportValue: (c) => c.totalSpent.toFixed(2),
    render: (c) => <span className="font-bold tabular-nums">{formatCurrency(c.totalSpent, "USD")}</span>,
  },
  {
    key: "firstPurchase",
    label: "First purchase",
    sortable: true,
    sortValue: (c) => (c.firstPurchaseAt ? new Date(c.firstPurchaseAt).getTime() : 0),
    exportValue: (c) => c.firstPurchaseAt ?? "",
    render: (c) => <span className="text-[13px] text-ink-2 whitespace-nowrap">{c.firstPurchaseAt ? formatDateShort(new Date(c.firstPurchaseAt)) : "—"}</span>,
  },
  {
    key: "lastPurchase",
    label: "Last purchase",
    sortable: true,
    sortValue: (c) => (c.lastPurchaseAt ? new Date(c.lastPurchaseAt).getTime() : 0),
    exportValue: (c) => c.lastPurchaseAt ?? "",
    render: (c) => <span className="text-[13px] text-ink-2 whitespace-nowrap">{c.lastPurchaseAt ? formatDateShort(new Date(c.lastPurchaseAt)) : "—"}</span>,
  },
]

export default function CustomersTable({ rows }: { rows: CustomerRow[] }) {
  return <DataTable tableId="admin-customers" columns={CUSTOMER_COLUMNS} rows={rows} getRowId={(c) => c.email} exportFilename="customers" />
}
