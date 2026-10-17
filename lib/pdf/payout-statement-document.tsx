import { existsSync } from "node:fs"
import path from "node:path"
import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer"

export type PayoutStatementEventRow = {
  title: string
  startsAt: Date | null
  grossRevenue: number
  platformFee: number
  netRevenue: number
  paidOut: number
  availableBalance: number
  confirmedTicketCount: number
}

export type PayoutStatementData = {
  organizerName: string
  organizerEmail: string
  generatedAt: Date
  /** Unique, human-quotable statement reference. */
  statementNumber: string
  /** Optional filter applied to the payout ledger (summary figures are always all-time). */
  periodFrom: Date | null
  periodTo: Date | null
  events: PayoutStatementEventRow[]
  grossRevenue: number
  platformFee: number
  platformFeePercent: number
  netRevenue: number
  paidOut: number
  pendingPayouts: number
  outstandingClawbacks: number
  availableBalance: number
  confirmedTicketCount: number
  confirmedOrderCount: number
  payouts: {
    id: string
    amount: number
    currency: string
    status: string
    method: string
    eventTitle: string | null
    createdAt: Date | null
    processedAt: Date | null
    reference?: string | null
  }[]
}

export async function generatePayoutStatementPdfBuffer(data: PayoutStatementData): Promise<Buffer> {
  return renderToBuffer(<PayoutStatementDocument data={data} />)
}

function logoPath(): string | null {
  const file = path.join(process.cwd(), "public", "ticketpulse-logo-email.png")
  return existsSync(file) ? file : null
}

const COLORS = {
  brand: "#131132",
  ink: "#0a2540",
  ink2: "#5a6d7c",
  ink3: "#8a9caa",
  line: "#e2e8f0",
  paper: "#ffffff",
  paper2: "#F6F9FC",
  emerald: "#10B981",
  red: "#DC2626",
}

const styles = StyleSheet.create({
  page: {
    padding: 32,
    backgroundColor: COLORS.paper,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: COLORS.ink,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderBottom: `2px solid ${COLORS.brand}`,
    paddingBottom: 12,
    marginBottom: 16,
  },
  logo: { width: 84, height: 46, marginBottom: 4 },
  statementTag: { fontSize: 7, color: COLORS.ink3, marginTop: 2 },
  periodNote: { fontSize: 8, color: COLORS.ink2, marginBottom: 10 },
  colRef: { flex: 1.2 },
  colTickets: { flex: 0.7, textAlign: "right" },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, paddingHorizontal: 8, backgroundColor: COLORS.paper2, fontWeight: "bold" },
  brand: { fontSize: 16, fontWeight: "bold", color: COLORS.brand, letterSpacing: 0.5 },
  title: { fontSize: 10, color: COLORS.ink2, marginTop: 3 },
  meta: { fontSize: 8, color: COLORS.ink3, textAlign: "right" },
  organizerBlock: { marginBottom: 16 },
  organizerName: { fontSize: 12, fontWeight: "bold", color: COLORS.ink },
  organizerEmail: { fontSize: 8, color: COLORS.ink3, marginTop: 2 },
  heroGrid: { flexDirection: "row", gap: 8, marginBottom: 16 },
  heroCard: { flex: 1, backgroundColor: COLORS.brand, borderRadius: 6, padding: 12 },
  heroLabel: { fontSize: 7, color: "#b9c1d9", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 5 },
  heroValue: { fontSize: 15, fontWeight: "bold", color: COLORS.paper },
  sectionTitle: { fontSize: 11, fontWeight: "bold", color: COLORS.brand, marginTop: 4, marginBottom: 8 },
  calcTable: { border: `1px solid ${COLORS.line}`, borderRadius: 6, marginBottom: 16 },
  calcRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottom: `1px solid ${COLORS.line}`,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  calcRowLast: { borderBottom: "none" },
  calcLabel: { fontSize: 9, color: COLORS.ink2 },
  calcValue: { fontSize: 9, fontWeight: "bold", color: COLORS.ink },
  calcValueNegative: { fontSize: 9, fontWeight: "bold", color: COLORS.red },
  calcValueFinal: { fontSize: 11, fontWeight: "bold", color: COLORS.emerald },
  table: { border: `1px solid ${COLORS.line}`, borderRadius: 6, marginBottom: 16 },
  tr: {
    flexDirection: "row",
    borderBottom: `1px solid ${COLORS.line}`,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  trHead: { backgroundColor: COLORS.paper2, fontWeight: "bold" },
  trLast: { borderBottom: "none" },
  colEvent: { flex: 2 },
  colMethod: { flex: 1 },
  colStatus: { flex: 1 },
  colDate: { flex: 1 },
  colAmount: { flex: 1, textAlign: "right" },
  footer: {
    position: "absolute",
    bottom: 18,
    left: 32,
    right: 32,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTop: `1px solid ${COLORS.line}`,
    paddingTop: 8,
    fontSize: 7,
    color: COLORS.ink3,
  },
})

function money(value: number, currency = "USD") {
  return `${currency} ${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDate(d: Date | null) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

function Header({ data, title }: { data: PayoutStatementData; title: string }) {
  const logo = logoPath()
  return (
    <View style={styles.header}>
      <View>
        {logo ? <Image src={logo} style={styles.logo} /> : <Text style={styles.brand}>TicketPulse</Text>}
        <Text style={styles.title}>{title}</Text>
      </View>
      <View>
        <Text style={styles.meta}>Generated {formatDate(data.generatedAt)}</Text>
        <Text style={styles.meta}>Statement no. {data.statementNumber}</Text>
      </View>
    </View>
  )
}

function Footer({ data }: { data: PayoutStatementData }) {
  return (
    <View style={styles.footer} fixed>
      <Text>TicketPulse · {data.statementNumber} · {data.organizerEmail}</Text>
      <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
    </View>
  )
}

function PayoutStatementDocument({ data }: { data: PayoutStatementData }) {
  const periodLabel = data.periodFrom || data.periodTo
    ? `Period: ${data.periodFrom ? formatDate(data.periodFrom) : "start"} to ${data.periodTo ? formatDate(data.periodTo) : "today"}`
    : "Period: all time"
  const ledgerTotals = new Map<string, number>()
  for (const p of data.payouts) {
    if (p.status === "paid") ledgerTotals.set(p.currency, (ledgerTotals.get(p.currency) ?? 0) + p.amount)
  }
  return (
    <Document title={`TicketPulse payout statement ${data.statementNumber}`} author="TicketPulse">
      <Page size="A4" style={styles.page}>
        <Header data={data} title="Organiser payout summary" />

        <View style={styles.organizerBlock}>
          <Text style={styles.organizerName}>{data.organizerName}</Text>
          <Text style={styles.organizerEmail}>{data.organizerEmail}</Text>
        </View>

        <View style={styles.heroGrid}>
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>Net earnings</Text>
            <Text style={styles.heroValue}>{money(data.netRevenue)}</Text>
          </View>
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>Paid out</Text>
            <Text style={styles.heroValue}>{money(data.paidOut)}</Text>
          </View>
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>Available now</Text>
            <Text style={styles.heroValue}>{money(data.availableBalance)}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>How this was calculated</Text>
        <View style={styles.calcTable}>
          <View style={styles.calcRow}>
            <Text style={styles.calcLabel}>Gross ticket revenue ({data.confirmedTicketCount} tickets, {data.confirmedOrderCount} orders)</Text>
            <Text style={styles.calcValue}>{money(data.grossRevenue)}</Text>
          </View>
          <View style={styles.calcRow}>
            <Text style={styles.calcLabel}>TicketPulse platform fee ({data.platformFeePercent}%)</Text>
            <Text style={styles.calcValueNegative}>-{money(data.platformFee)}</Text>
          </View>
          <View style={styles.calcRow}>
            <Text style={styles.calcLabel}>Net earnings</Text>
            <Text style={styles.calcValue}>{money(data.netRevenue)}</Text>
          </View>
          <View style={styles.calcRow}>
            <Text style={styles.calcLabel}>Already paid out</Text>
            <Text style={styles.calcValueNegative}>-{money(data.paidOut)}</Text>
          </View>
          <View style={styles.calcRow}>
            <Text style={styles.calcLabel}>Pending payout requests</Text>
            <Text style={styles.calcValueNegative}>-{money(data.pendingPayouts)}</Text>
          </View>
          {data.outstandingClawbacks > 0 && (
            <View style={styles.calcRow}>
              <Text style={styles.calcLabel}>Outstanding clawbacks (refunds on already-paid tickets)</Text>
              <Text style={styles.calcValueNegative}>-{money(data.outstandingClawbacks)}</Text>
            </View>
          )}
          <View style={[styles.calcRow, styles.calcRowLast]}>
            <Text style={styles.calcLabel}>Available balance</Text>
            <Text style={styles.calcValueFinal}>{money(data.availableBalance)}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Earnings by event</Text>
        <View style={styles.table}>
          <View style={[styles.tr, styles.trHead]}>
            <Text style={styles.colEvent}>Event</Text>
            <Text style={styles.colTickets}>Tickets</Text>
            <Text style={styles.colAmount}>Gross</Text>
            <Text style={styles.colAmount}>Fee</Text>
            <Text style={styles.colAmount}>Net</Text>
            <Text style={styles.colAmount}>Available</Text>
          </View>
          {data.events.length === 0 && (
            <View style={[styles.tr, styles.trLast]}>
              <Text>No events yet.</Text>
            </View>
          )}
          {data.events.map((e, i) => (
            <View key={`${e.title}-${i}`} style={[styles.tr, i === data.events.length - 1 ? styles.trLast : {}]} wrap={false}>
              <Text style={styles.colEvent}>{e.title}</Text>
              <Text style={styles.colTickets}>{e.confirmedTicketCount}</Text>
              <Text style={styles.colAmount}>{money(e.grossRevenue)}</Text>
              <Text style={styles.colAmount}>{money(e.platformFee)}</Text>
              <Text style={styles.colAmount}>{money(e.netRevenue)}</Text>
              <Text style={styles.colAmount}>{money(e.availableBalance)}</Text>
            </View>
          ))}
        </View>
        <Footer data={data} />
      </Page>

      <Page size="A4" style={styles.page}>
        <Header data={data} title="Organiser payout statement" />
        <Text style={styles.periodNote}>{periodLabel} · {data.payouts.length} payout{data.payouts.length === 1 ? "" : "s"}</Text>

        <View style={styles.table}>
          <View style={[styles.tr, styles.trHead]} fixed>
            <Text style={styles.colDate}>Date</Text>
            <Text style={styles.colRef}>Reference</Text>
            <Text style={styles.colEvent}>Event</Text>
            <Text style={styles.colMethod}>Method</Text>
            <Text style={styles.colStatus}>Status</Text>
            <Text style={styles.colAmount}>Amount</Text>
          </View>
          {data.payouts.length === 0 && (
            <View style={[styles.tr, styles.trLast]}>
              <Text>No payouts recorded for this period.</Text>
            </View>
          )}
          {data.payouts.map((p, i) => (
            <View key={p.id} style={[styles.tr, i === data.payouts.length - 1 && ledgerTotals.size === 0 ? styles.trLast : {}]} wrap={false}>
              <Text style={styles.colDate}>{formatDate(p.processedAt ?? p.createdAt)}</Text>
              <Text style={styles.colRef}>{p.reference || p.id.slice(0, 8).toUpperCase()}</Text>
              <Text style={styles.colEvent}>{p.eventTitle ?? "General"}</Text>
              <Text style={styles.colMethod}>{p.method}</Text>
              <Text style={styles.colStatus}>{p.status}</Text>
              <Text style={styles.colAmount}>{money(p.amount, p.currency)}</Text>
            </View>
          ))}
          {[...ledgerTotals.entries()].map(([currency, total]) => (
            <View key={currency} style={styles.totalsRow} wrap={false}>
              <Text>Total paid out ({currency})</Text>
              <Text>{money(total, currency)}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.statementTag}>
          Figures are generated from TicketPulse records at the time shown above. Pending and rejected payouts are listed but not counted as paid.
        </Text>
        <Footer data={data} />
      </Page>
    </Document>
  )
}
