import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer"

import type {
  VelocityReconciliationEvent,
  VelocityReconciliationOrder,
  VelocityReconciliationReport,
  VelocitySettlementReport,
} from "@/lib/velocity-reconciliation"

const COLORS = {
  brand: "#131132",
  ink: "#0a2540",
  ink2: "#5a6d7c",
  ink3: "#8a9caa",
  line: "#e2e8f0",
  paper: "#ffffff",
  paper2: "#F6F9FC",
  emerald: "#10B981",
  rose: "#E11D48",
  amber: "#B45309",
}

const styles = StyleSheet.create({
  page: {
    padding: 28,
    backgroundColor: COLORS.paper,
    fontFamily: "Helvetica",
    fontSize: 8,
    color: COLORS.ink,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderBottom: `2px solid ${COLORS.brand}`,
    paddingBottom: 10,
    marginBottom: 14,
  },
  brand: {
    fontSize: 14,
    fontWeight: "bold",
    color: COLORS.brand,
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 10,
    color: COLORS.ink2,
    marginTop: 2,
  },
  meta: {
    fontSize: 8,
    color: COLORS.ink3,
    textAlign: "right",
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: "bold",
    color: COLORS.brand,
    marginTop: 14,
    marginBottom: 6,
  },
  totalsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  totalCard: {
    width: "23.5%",
    border: `1px solid ${COLORS.line}`,
    borderRadius: 4,
    padding: 8,
  },
  totalLabel: {
    fontSize: 7,
    color: COLORS.ink3,
    marginBottom: 3,
  },
  totalValue: {
    fontSize: 11,
    fontWeight: "bold",
  },
  table: {
    border: `1px solid ${COLORS.line}`,
    borderRadius: 4,
  },
  tr: {
    flexDirection: "row",
    borderBottom: `1px solid ${COLORS.line}`,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  trHead: {
    backgroundColor: COLORS.paper2,
    fontWeight: "bold",
  },
  trLast: {
    borderBottom: "none",
  },
  num: {
    textAlign: "right",
  },
  critical: {
    color: COLORS.rose,
  },
  warning: {
    color: COLORS.amber,
  },
  ok: {
    color: COLORS.emerald,
  },
  footer: {
    position: "absolute",
    bottom: 16,
    left: 28,
    right: 28,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: COLORS.ink3,
  },
})

function fmt(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "—"
  return new Date(d).toISOString().slice(0, 10)
}

function Row({ cells, widths, head, last }: {
  cells: { text: string; num?: boolean; mono?: boolean; tone?: "critical" | "warning" | "ok" }[]
  widths: number[]
  head?: boolean
  last?: boolean
}) {
  return (
    <View style={[styles.tr, ...(head ? [styles.trHead] : []), ...(last ? [styles.trLast] : [])]} wrap={false}>
      {cells.map((cell, i) => (
        <Text
          key={i}
          style={[
            { width: `${widths[i]}%`, paddingRight: 4 },
            ...(cell.num ? [styles.num] : []),
            ...(cell.mono ? [{ fontFamily: "Courier", fontSize: 6.5 }] : []),
            ...(cell.tone ? [styles[cell.tone]] : []),
          ]}
        >
          {cell.text}
        </Text>
      ))}
    </View>
  )
}

function Footer() {
  return (
    <View style={styles.footer} fixed>
      <Text>TicketPulse · Velocity reconciliation</Text>
      <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
    </View>
  )
}

function EventsTable({ events }: { events: VelocityReconciliationEvent[] }) {
  const widths = [22, 11, 11, 11, 9, 9, 10, 9, 8]
  return (
    <View style={styles.table}>
      <Row
        head
        widths={widths}
        cells={[
          { text: "Event" },
          { text: "Velocity received", num: true },
          { text: "Deposited", num: true },
          { text: "Local paid revenue", num: true },
          { text: "Variance", num: true },
          { text: "Platform fee", num: true },
          { text: "Organizer net", num: true },
          { text: "Paid out", num: true },
          { text: "Issues", num: true },
        ]}
      />
      {events.map((event, i) => (
        <Row
          key={event.eventId}
          last={i === events.length - 1}
          widths={widths}
          cells={[
            { text: event.eventTitle },
            { text: fmt(event.velocityReceived), num: true },
            { text: fmt(event.velocityPaidToTicketPulse), num: true, tone: event.velocityPaidToTicketPulse >= event.velocityReceived ? "ok" : "warning" },
            { text: fmt(event.localPaidRevenue), num: true },
            { text: fmt(event.variance), num: true, tone: event.variance === 0 ? "ok" : "critical" },
            { text: fmt(event.platformFee), num: true },
            { text: fmt(event.organizerNet), num: true },
            { text: fmt(event.paidOut), num: true },
            { text: String(event.issueCount), num: true, tone: event.issueCount === 0 ? "ok" : "warning" },
          ]}
        />
      ))}
    </View>
  )
}

function OrdersTable({ orders }: { orders: VelocityReconciliationOrder[] }) {
  const widths = [14, 15, 7, 7, 7, 7, 21, 22]
  return (
    <View style={styles.table}>
      <Row
        head
        widths={widths}
        cells={[
          { text: "Event" },
          { text: "Order / buyer" },
          { text: "Status" },
          { text: "Order total", num: true },
          { text: "Velocity total", num: true },
          { text: "Variance", num: true },
          { text: "Transaction trace" },
          { text: "Issues" },
        ]}
      />
      {orders.map((order, i) => {
        const critical = order.issues.some((issue) => issue.severity === "critical")
        return (
          <Row
            key={order.orderId}
            last={i === orders.length - 1}
            widths={widths}
            cells={[
              { text: order.eventTitle },
              { text: `${order.orderId.slice(0, 8)} · ${order.buyer}` },
              { text: order.status ?? "—" },
              { text: fmt(order.orderTotal), num: true },
              { text: fmt(order.velocityLedgerTotal), num: true },
              { text: fmt(order.variance), num: true, tone: order.variance === 0 ? "ok" : "critical" },
              { text: order.transactionTrace ?? "—", mono: true },
              {
                text: order.issues.length === 0 ? "OK" : order.issues.map((issue) => issue.code).join(", "),
                mono: order.issues.length > 0,
                tone: order.issues.length === 0 ? "ok" : critical ? "critical" : "warning",
              },
            ]}
          />
        )
      })}
    </View>
  )
}

function SettlementsTable({ settlements }: { settlements: VelocitySettlementReport[] }) {
  const widths = [11, 11, 11, 10, 7, 17, 18, 15]
  return (
    <View style={styles.table}>
      <Row
        head
        widths={widths}
        cells={[
          { text: "Paid date" },
          { text: "Period start" },
          { text: "Period end" },
          { text: "Amount", num: true },
          { text: "Currency" },
          { text: "Event" },
          { text: "Reference" },
          { text: "Recorded by" },
        ]}
      />
      {settlements.map((settlement, i) => (
        <Row
          key={settlement.id}
          last={i === settlements.length - 1}
          widths={widths}
          cells={[
            { text: fmtDate(settlement.settlementDate) },
            { text: fmtDate(settlement.periodStart) },
            { text: fmtDate(settlement.periodEnd) },
            { text: fmt(settlement.amount), num: true },
            { text: settlement.currency },
            { text: settlement.eventTitle ?? "Platform-wide" },
            { text: settlement.reference },
            { text: settlement.recordedBy ?? "—" },
          ]}
        />
      ))}
    </View>
  )
}

export function ReconciliationDocument({ report }: { report: VelocityReconciliationReport }) {
  const { totals } = report
  const totalCards = [
    { label: "Velocity received", value: fmt(totals.velocityReceived) },
    { label: "Paid by Velocity to TicketPulse", value: fmt(totals.velocityPaidToTicketPulse) },
    { label: "Not yet matched", value: fmt(totals.velocityUnsettled) },
    { label: "Local paid revenue", value: fmt(totals.localPaidRevenue) },
    { label: "Variance", value: fmt(totals.variance) },
    { label: `Platform fee (${Math.round(report.feeRate * 100)}%)`, value: fmt(totals.platformFee) },
    { label: "Organizer net", value: fmt(totals.organizerNet) },
    { label: "Issues (critical / warning)", value: `${totals.criticalIssues} / ${totals.warningIssues}` },
  ]

  return (
    <Document
      title={`Velocity reconciliation ${report.generatedAt.toISOString().slice(0, 10)}`}
      author="TicketPulse"
    >
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>TICKETPULSE</Text>
            <Text style={styles.title}>Velocity payment reconciliation report</Text>
          </View>
          <View>
            <Text style={styles.meta}>Generated {report.generatedAt.toISOString().replace("T", " ").slice(0, 16)} UTC</Text>
            <Text style={styles.meta}>
              {totals.paidOrders} paid orders · {totals.settledVelocityRows} settled ledger rows · {totals.confirmedTickets} tickets
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Summary</Text>
        <View style={styles.totalsGrid}>
          {totalCards.map((card) => (
            <View key={card.label} style={styles.totalCard}>
              <Text style={styles.totalLabel}>{card.label}</Text>
              <Text style={styles.totalValue}>{card.value}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Per-event breakdown ({report.events.length})</Text>
        {report.events.length > 0 ? <EventsTable events={report.events} /> : <Text style={{ color: COLORS.ink3 }}>No Velocity events found.</Text>}

        <Footer />
      </Page>

      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.sectionTitle}>Orders ({report.orders.length})</Text>
        {report.orders.length > 0 ? <OrdersTable orders={report.orders} /> : <Text style={{ color: COLORS.ink3 }}>No Velocity orders found.</Text>}

        <Text style={styles.sectionTitle}>Velocity settlements recorded ({report.settlements.length})</Text>
        {report.settlements.length > 0 ? <SettlementsTable settlements={report.settlements} /> : <Text style={{ color: COLORS.ink3 }}>No settlements recorded.</Text>}

        <Footer />
      </Page>
    </Document>
  )
}
