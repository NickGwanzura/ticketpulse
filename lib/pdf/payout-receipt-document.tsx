import { existsSync } from "node:fs"
import path from "node:path"
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer"

export type PayoutReceiptData = {
  receiptNumber: string
  payoutReference: string
  issuedAt: Date
  paidAt: Date
  organizerName: string
  organizerEmail: string
  eventTitle: string | null
  method: string
  /** Already masked, e.g. "Stanbic Bank · J Doe · ****1234". */
  destination: string
  amount: number
  currency: string
  /** Bank / EcoCash transaction reference recorded by TicketPulse. */
  transactionReference: string | null
  availableBalanceAfter: number
}

export async function generatePayoutReceiptPdfBuffer(data: PayoutReceiptData): Promise<Buffer> {
  return renderToBuffer(<PayoutReceiptDocument data={data} />)
}

const COLORS = { brand: "#131132", ink: "#0a2540", ink2: "#5a6d7c", ink3: "#8a9caa", line: "#e2e8f0", paper: "#ffffff", paper2: "#F6F9FC", emerald: "#10B981" }

const styles = StyleSheet.create({
  page: { padding: 40, backgroundColor: COLORS.paper, fontFamily: "Helvetica", fontSize: 10, color: COLORS.ink },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", borderBottom: `2px solid ${COLORS.brand}`, paddingBottom: 12, marginBottom: 22 },
  logo: { width: 84, height: 46, marginBottom: 4 },
  brand: { fontSize: 16, fontWeight: "bold", color: COLORS.brand },
  title: { fontSize: 10, color: COLORS.ink2 },
  meta: { fontSize: 8, color: COLORS.ink3, textAlign: "right" },
  h1: { fontSize: 20, fontWeight: "bold", color: COLORS.brand, lineHeight: 1.2, marginBottom: 4 },
  paidBadge: { alignSelf: "flex-start", backgroundColor: "#D1FAE5", color: "#047857", fontSize: 8, fontWeight: "bold", paddingVertical: 3, paddingHorizontal: 8, borderRadius: 10, marginBottom: 16 },
  amountCard: { backgroundColor: COLORS.brand, borderRadius: 8, padding: 18, marginBottom: 18 },
  amountLabel: { fontSize: 8, color: "#b9c1d9", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 },
  amountValue: { fontSize: 26, fontWeight: "bold", color: COLORS.paper },
  table: { border: `1px solid ${COLORS.line}`, borderRadius: 6, marginBottom: 16 },
  row: { flexDirection: "row", borderBottom: `1px solid ${COLORS.line}`, paddingVertical: 8, paddingHorizontal: 12 },
  rowLast: { borderBottom: "none" },
  label: { width: 140, color: COLORS.ink2 },
  value: { flex: 1, fontWeight: "bold", color: COLORS.ink },
  note: { fontSize: 8, color: COLORS.ink3, lineHeight: 1.5 },
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, flexDirection: "row", justifyContent: "space-between", borderTop: `1px solid ${COLORS.line}`, paddingTop: 8, fontSize: 7, color: COLORS.ink3 },
})

function logoPath(): string | null {
  const file = path.join(process.cwd(), "public", "ticketpulse-logo-email.png")
  return existsSync(file) ? file : null
}

function money(value: number, currency: string) {
  return `${currency} ${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function day(d: Date) {
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })
}

function PayoutReceiptDocument({ data }: { data: PayoutReceiptData }) {
  const logo = logoPath()
  const rows: [string, string][] = [
    ["Receipt number", data.receiptNumber],
    ["Payout reference", data.payoutReference],
    ["Date paid", day(data.paidAt)],
    ["Paid to", data.organizerName],
    ["Method", data.method],
    ["Destination", data.destination],
    ["Event", data.eventTitle ?? "All events"],
    ["Transaction reference", data.transactionReference ?? "Not recorded"],
    ["Balance still available", money(data.availableBalanceAfter, data.currency)],
  ]
  return (
    <Document title={`TicketPulse payout receipt ${data.receiptNumber}`} author="TicketPulse">
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            {logo ? <Image src={logo} style={styles.logo} /> : <Text style={styles.brand}>TicketPulse</Text>}
            <Text style={styles.title}>Payout receipt</Text>
          </View>
          <View>
            <Text style={styles.meta}>Issued {day(data.issuedAt)}</Text>
            <Text style={styles.meta}>{data.receiptNumber}</Text>
          </View>
        </View>

        <Text style={styles.h1}>Payment sent</Text>
        <Text style={styles.paidBadge}>PAID</Text>

        <View style={styles.amountCard}>
          <Text style={styles.amountLabel}>Amount paid</Text>
          <Text style={styles.amountValue}>{money(data.amount, data.currency)}</Text>
        </View>

        <View style={styles.table}>
          {rows.map(([label, value], i) => (
            <View key={label} style={[styles.row, i === rows.length - 1 ? styles.rowLast : {}]} wrap={false}>
              <Text style={styles.label}>{label}</Text>
              <Text style={styles.value}>{value}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.note}>
          This receipt confirms that TicketPulse has paid the amount above from your net ticket earnings (ticket sales less the TicketPulse fee).
          Bank transfers can take your bank some time to show. Your full payout statement is attached or available from the Payouts page.
          Questions: ticketpulse.tech/contact, quoting {data.payoutReference}.
        </Text>

        <View style={styles.footer} fixed>
          <Text>TicketPulse · Payout receipt {data.receiptNumber}</Text>
          <Text>{data.organizerEmail}</Text>
        </View>
      </Page>
    </Document>
  )
}
