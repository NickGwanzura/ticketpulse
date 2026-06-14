import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer"

export type OrdersReconReportRow = {
  id: string
  eventTitle: string
  customerName: string
  customerEmail: string
  customerPhone: string
  status: string
  paymentMethod: string
  paymentRef: string
  paymentTrace: string
  salesOrderTrace: string
  deliveryStatus: string
  ticketCount: number
  ledgerCount: number
  amount: number
  currency: string
  createdAt: string
  paidAt: string
}

export type OrdersReconReport = {
  title: string
  generatedAt: Date
  generatedBy: string
  scope: string
  filters: {
    search?: string
    status?: string
  }
  totals: {
    orderCount: number
    gross: number
    paidGross: number
    pendingGross: number
    voidGross: number
    paidOrders: number
    pendingOrders: number
    voidOrders: number
    paidNoTickets: number
    duplicateLedgerOrders: number
    deliveryFailures: number
  }
  rows: OrdersReconReportRow[]
}

const styles = StyleSheet.create({
  page: {
    padding: 28,
    fontSize: 8,
    color: "#09233f",
    fontFamily: "Helvetica",
  },
  eyebrow: {
    fontSize: 8,
    color: "#66758a",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 5,
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 9,
    color: "#66758a",
    marginBottom: 14,
  },
  summaryGrid: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  summaryCard: {
    flex: 1,
    border: "1 solid #dfe5ee",
    borderRadius: 8,
    padding: 8,
  },
  summaryLabel: {
    fontSize: 7,
    color: "#66758a",
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: 700,
  },
  summaryValueSmall: {
    fontSize: 8.5,
    fontWeight: 700,
    lineHeight: 1.25,
  },
  issueValue: {
    color: "#b91c1c",
  },
  table: {
    border: "1 solid #dfe5ee",
    borderRadius: 6,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    borderBottom: "1 solid #e8edf4",
    minHeight: 28,
  },
  head: {
    backgroundColor: "#f4f7fb",
  },
  cell: {
    padding: 4,
    borderRight: "1 solid #e8edf4",
  },
  headText: {
    fontSize: 6,
    fontWeight: 700,
    color: "#66758a",
    textTransform: "uppercase",
  },
  text: {
    fontSize: 7,
    lineHeight: 1.25,
  },
  muted: {
    color: "#66758a",
  },
  bold: {
    fontWeight: 700,
  },
  danger: {
    color: "#b91c1c",
    fontWeight: 700,
  },
  foot: {
    position: "absolute",
    left: 28,
    right: 28,
    bottom: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    color: "#8a97aa",
    fontSize: 7,
  },
})

function money(value: number, currency = "USD") {
  return `${currency} ${Number(value || 0).toFixed(2)}`
}

function formatDate(value: string) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toISOString().slice(0, 10)
}

function short(value: string, length = 8) {
  return value ? value.slice(0, length) : "-"
}

function OrdersTable({ rows }: { rows: OrdersReconReportRow[] }) {
  return (
    <View style={styles.table}>
      <View style={[styles.row, styles.head]} fixed>
        <View style={[styles.cell, { width: "10%" }]}><Text style={styles.headText}>Order</Text></View>
        <View style={[styles.cell, { width: "16%" }]}><Text style={styles.headText}>Event / buyer</Text></View>
        <View style={[styles.cell, { width: "10%" }]}><Text style={styles.headText}>Status</Text></View>
        <View style={[styles.cell, { width: "9%" }]}><Text style={styles.headText}>Amount</Text></View>
        <View style={[styles.cell, { width: "10%" }]}><Text style={styles.headText}>Payment</Text></View>
        <View style={[styles.cell, { width: "15%" }]}><Text style={styles.headText}>Trace</Text></View>
        <View style={[styles.cell, { width: "10%" }]}><Text style={styles.headText}>Delivery</Text></View>
        <View style={[styles.cell, { width: "8%" }]}><Text style={styles.headText}>Tickets</Text></View>
        <View style={[styles.cell, { width: "7%" }]}><Text style={styles.headText}>Ledger</Text></View>
        <View style={[styles.cell, { width: "5%", borderRight: 0 }]}><Text style={styles.headText}>Date</Text></View>
      </View>
      {rows.map((row) => {
        const paidWithoutTickets = ["paid", "completed"].includes(row.status) && row.ticketCount === 0
        const duplicateLedger = row.ledgerCount > 1
        const deliveryFailed = row.deliveryStatus === "FAILED" || row.deliveryStatus === "EMAIL_FAILED"
        const revenueStatus = ["paid", "completed"].includes(row.status)
        return (
          <View key={row.id} style={styles.row} wrap={false}>
            <View style={[styles.cell, { width: "10%" }]}>
              <Text style={[styles.text, styles.bold]}>{short(row.id)}</Text>
              <Text style={[styles.text, styles.muted]}>{short(row.paymentRef)}</Text>
            </View>
            <View style={[styles.cell, { width: "16%" }]}>
              <Text style={[styles.text, styles.bold]}>{row.eventTitle || "-"}</Text>
              <Text style={[styles.text, styles.muted]}>{row.customerName || row.customerEmail || "-"}</Text>
            </View>
            <View style={[styles.cell, { width: "10%" }]}><Text style={styles.text}>{row.status}</Text></View>
            <View style={[styles.cell, { width: "9%" }]}><Text style={[styles.text, revenueStatus ? styles.bold : styles.muted]}>{money(row.amount, row.currency)}</Text></View>
            <View style={[styles.cell, { width: "10%" }]}><Text style={styles.text}>{row.paymentMethod || "-"}</Text></View>
            <View style={[styles.cell, { width: "15%" }]}>
              <Text style={styles.text}>TX {short(row.paymentTrace, 10)}</Text>
              <Text style={[styles.text, styles.muted]}>SO {short(row.salesOrderTrace, 10)}</Text>
            </View>
            <View style={[styles.cell, { width: "10%" }]}><Text style={deliveryFailed ? styles.danger : styles.text}>{row.deliveryStatus || "-"}</Text></View>
            <View style={[styles.cell, { width: "8%" }]}><Text style={paidWithoutTickets ? styles.danger : styles.text}>{row.ticketCount}</Text></View>
            <View style={[styles.cell, { width: "7%" }]}><Text style={duplicateLedger ? styles.danger : styles.text}>{row.ledgerCount}</Text></View>
            <View style={[styles.cell, { width: "5%", borderRight: 0 }]}><Text style={styles.text}>{formatDate(row.createdAt)}</Text></View>
          </View>
        )
      })}
    </View>
  )
}

export function OrdersReconDocument({ report }: { report: OrdersReconReport }) {
  const filterText = [
    report.filters.search ? `Search: ${report.filters.search}` : null,
    report.filters.status && report.filters.status !== "all" ? `Status: ${report.filters.status}` : null,
  ].filter(Boolean).join(" · ") || "No filters"
  const reconWarnings = report.totals.paidNoTickets + report.totals.duplicateLedgerOrders + report.totals.deliveryFailures
  const orderMix = `${report.totals.paidOrders} paid · ${report.totals.pendingOrders} pending · ${report.totals.voidOrders} void`

  return (
    <Document title={report.title} author="TicketPulse">
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.eyebrow}>TicketPulse reconciliation export</Text>
        <Text style={styles.title}>{report.title}</Text>
        <Text style={styles.subtitle}>
          {report.scope} · Generated {report.generatedAt.toISOString()} by {report.generatedBy} · {filterText}
        </Text>

        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Orders</Text>
            <Text style={styles.summaryValue}>{report.totals.orderCount}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Confirmed revenue</Text>
            <Text style={styles.summaryValue}>{money(report.totals.paidGross)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Pending value</Text>
            <Text style={styles.summaryValue}>{money(report.totals.pendingGross)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Void / expired</Text>
            <Text style={styles.summaryValue}>{money(report.totals.voidGross)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Status mix</Text>
            <Text style={styles.summaryValueSmall}>{orderMix}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Recon warnings</Text>
            <Text style={reconWarnings > 0 ? [styles.summaryValue, styles.issueValue] : styles.summaryValue}>
              {reconWarnings}
            </Text>
          </View>
        </View>

        <OrdersTable rows={report.rows} />

        <View style={styles.foot} fixed>
          <Text>All-order volume: {money(report.totals.gross)} · Paid/no tickets: {report.totals.paidNoTickets} · Duplicate ledgers: {report.totals.duplicateLedgerOrders} · Delivery failures: {report.totals.deliveryFailures}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}

export async function generateOrdersReconPdfBuffer(report: OrdersReconReport): Promise<Buffer> {
  return renderToBuffer(<OrdersReconDocument report={report} />)
}
