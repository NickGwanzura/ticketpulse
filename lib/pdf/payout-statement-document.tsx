import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer"

export type PayoutStatementData = {
  organizerName: string
  organizerEmail: string
  generatedAt: Date
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
  }[]
}

export async function generatePayoutStatementPdfBuffer(data: PayoutStatementData): Promise<Buffer> {
  return renderToBuffer(<PayoutStatementDocument data={data} />)
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

function PayoutStatementDocument({ data }: { data: PayoutStatementData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>TicketPulse</Text>
            <Text style={styles.title}>Organiser payout statement</Text>
          </View>
          <Text style={styles.meta}>Generated {formatDate(data.generatedAt)}</Text>
        </View>

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

        <Text style={styles.sectionTitle}>Payout history</Text>
        <View style={styles.table}>
          <View style={[styles.tr, styles.trHead]}>
            <Text style={styles.colEvent}>Event</Text>
            <Text style={styles.colMethod}>Method</Text>
            <Text style={styles.colStatus}>Status</Text>
            <Text style={styles.colDate}>Date</Text>
            <Text style={styles.colAmount}>Amount</Text>
          </View>
          {data.payouts.length === 0 && (
            <View style={[styles.tr, styles.trLast]}>
              <Text>No payouts recorded yet.</Text>
            </View>
          )}
          {data.payouts.map((p, i) => (
            <View key={p.id} style={[styles.tr, i === data.payouts.length - 1 ? styles.trLast : {}]}>
              <Text style={styles.colEvent}>{p.eventTitle ?? "General"}</Text>
              <Text style={styles.colMethod}>{p.method}</Text>
              <Text style={styles.colStatus}>{p.status}</Text>
              <Text style={styles.colDate}>{formatDate(p.processedAt ?? p.createdAt)}</Text>
              <Text style={styles.colAmount}>{money(p.amount, p.currency)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.footer} fixed>
          <Text>TicketPulse · Organiser payout statement</Text>
          <Text>{data.organizerEmail}</Text>
        </View>
      </Page>
    </Document>
  )
}
