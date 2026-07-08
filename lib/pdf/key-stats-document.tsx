import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer"

import type { PlatformKeyStats } from "@/lib/key-stats"

export async function generateKeyStatsPdfBuffer(stats: PlatformKeyStats): Promise<Buffer> {
  return renderToBuffer(<KeyStatsDocument stats={stats} />)
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
  bar: "#131132",
  barTrack: "#eef1f6",
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
  brand: {
    fontSize: 16,
    fontWeight: "bold",
    color: COLORS.brand,
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 10,
    color: COLORS.ink2,
    marginTop: 3,
  },
  meta: {
    fontSize: 8,
    color: COLORS.ink3,
    textAlign: "right",
  },
  intro: {
    fontSize: 9,
    color: COLORS.ink2,
    lineHeight: 1.5,
    marginBottom: 16,
  },
  heroGrid: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  heroCard: {
    flex: 1,
    backgroundColor: COLORS.brand,
    borderRadius: 6,
    padding: 12,
  },
  heroLabel: {
    fontSize: 7,
    color: "#b9c1d9",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 5,
  },
  heroValue: {
    fontSize: 17,
    fontWeight: "bold",
    color: COLORS.paper,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  statCard: {
    width: "23.7%",
    border: `1px solid ${COLORS.line}`,
    borderRadius: 6,
    padding: 10,
  },
  statLabel: {
    fontSize: 7,
    color: COLORS.ink3,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 13,
    fontWeight: "bold",
    color: COLORS.ink,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: COLORS.brand,
    marginTop: 4,
    marginBottom: 8,
  },
  momentumStrip: {
    flexDirection: "row",
    backgroundColor: COLORS.paper2,
    border: `1px solid ${COLORS.line}`,
    borderRadius: 6,
    padding: 12,
    gap: 24,
    marginBottom: 16,
  },
  momentumItem: {
    flexDirection: "column",
  },
  trendRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  trendLabel: {
    width: 62,
    fontSize: 8,
    color: COLORS.ink2,
  },
  trendTrack: {
    flex: 1,
    height: 11,
    backgroundColor: COLORS.barTrack,
    borderRadius: 3,
    marginRight: 8,
    overflow: "hidden",
  },
  trendBar: {
    height: 11,
    backgroundColor: COLORS.bar,
    borderRadius: 3,
  },
  trendValue: {
    width: 90,
    fontSize: 8,
    fontWeight: "bold",
    textAlign: "right",
  },
  table: {
    border: `1px solid ${COLORS.line}`,
    borderRadius: 6,
    marginBottom: 16,
  },
  tr: {
    flexDirection: "row",
    borderBottom: `1px solid ${COLORS.line}`,
    paddingVertical: 6,
    paddingHorizontal: 8,
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

function money(value: number) {
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function count(value: number) {
  return value.toLocaleString("en-US")
}

function formatDate(date: Date) {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
}

export function KeyStatsDocument({ stats }: { stats: PlatformKeyStats }) {
  const maxMonthly = Math.max(...stats.monthlyTrend.map((m) => m.revenue), 1)

  const heroCards = [
    { label: "Gross ticket sales", value: money(stats.grossSales) },
    { label: "Tickets sold", value: count(stats.ticketsSold) },
    { label: "Events hosted", value: count(stats.eventsHosted) },
    { label: "Attendees reached", value: count(stats.uniqueAttendees) },
  ]

  const statCards = [
    { label: "Confirmed orders", value: count(stats.confirmedOrders) },
    { label: "Avg order value", value: money(stats.avgOrderValue) },
    { label: "Tickets scanned at the door", value: count(stats.checkIns) },
    { label: "Cities covered", value: count(stats.citiesCovered) },
    { label: "Organizers", value: count(stats.organizers) },
    {
      label: "Average event rating",
      value: stats.avgRating != null ? `${stats.avgRating} / 5` : "—",
    },
    { label: "Approved reviews", value: count(stats.reviewCount) },
    {
      label: "Door check-in rate",
      value: stats.ticketsSold > 0 ? `${Math.round((stats.checkIns / stats.ticketsSold) * 100)}%` : "—",
    },
  ]

  return (
    <Document
      title="TicketPulse — Platform Key Statistics"
      author="TicketPulse"
      subject="Platform key statistics for prospective partners"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>TICKETPULSE</Text>
            <Text style={styles.title}>Platform Key Statistics</Text>
          </View>
          <View>
            <Text style={styles.meta}>Prepared for prospective partners</Text>
            <Text style={styles.meta}>Generated {formatDate(stats.generatedAt)}</Text>
          </View>
        </View>

        <Text style={styles.intro}>
          TicketPulse is Zimbabwe&apos;s event ticketing platform — online sales, EcoCash and card
          payments, instant ticket delivery, and QR check-in at the door. The figures below are
          live platform totals from confirmed, paid orders.
        </Text>

        <View style={styles.heroGrid}>
          {heroCards.map((card) => (
            <View key={card.label} style={styles.heroCard}>
              <Text style={styles.heroLabel}>{card.label}</Text>
              <Text style={styles.heroValue}>{card.value}</Text>
            </View>
          ))}
        </View>

        <View style={styles.statsGrid}>
          {statCards.map((card) => (
            <View key={card.label} style={styles.statCard}>
              <Text style={styles.statLabel}>{card.label}</Text>
              <Text style={styles.statValue}>{card.value}</Text>
            </View>
          ))}
        </View>

        <View style={styles.momentumStrip}>
          <View style={styles.momentumItem}>
            <Text style={styles.statLabel}>Last 30 days — revenue</Text>
            <Text style={[styles.statValue, { color: COLORS.emerald }]}>
              {money(stats.last30.revenue)}
            </Text>
          </View>
          <View style={styles.momentumItem}>
            <Text style={styles.statLabel}>Last 30 days — tickets sold</Text>
            <Text style={styles.statValue}>{count(stats.last30.tickets)}</Text>
          </View>
          <View style={styles.momentumItem}>
            <Text style={styles.statLabel}>Last 30 days — orders</Text>
            <Text style={styles.statValue}>{count(stats.last30.orders)}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Monthly gross sales — last 6 months</Text>
        <View style={{ marginBottom: 16 }}>
          {stats.monthlyTrend.map((m) => (
            <View key={m.label} style={styles.trendRow}>
              <Text style={styles.trendLabel}>{m.label}</Text>
              <View style={styles.trendTrack}>
                {m.revenue > 0 && (
                  <View
                    style={[styles.trendBar, { width: `${Math.max((m.revenue / maxMonthly) * 100, 2)}%` }]}
                  />
                )}
              </View>
              <Text style={styles.trendValue}>
                {money(m.revenue)}  ·  {count(m.tickets)} tix
              </Text>
            </View>
          ))}
        </View>

        {stats.topEvents.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Top events by gross sales</Text>
            <View style={styles.table}>
              <View style={[styles.tr, styles.trHead]}>
                <Text style={{ flex: 3 }}>Event</Text>
                <Text style={{ flex: 1.4 }}>City</Text>
                <Text style={{ flex: 1.4 }}>Date</Text>
                <Text style={[{ flex: 1 }, styles.num]}>Tickets</Text>
                <Text style={[{ flex: 1.3 }, styles.num]}>Gross</Text>
              </View>
              {stats.topEvents.map((event, i) => (
                <View
                  key={`${event.title}-${i}`}
                  style={[styles.tr, ...(i === stats.topEvents.length - 1 ? [styles.trLast] : [])]}
                >
                  <Text style={{ flex: 3 }}>{event.title}</Text>
                  <Text style={{ flex: 1.4 }}>{event.city}</Text>
                  <Text style={{ flex: 1.4 }}>
                    {event.startsAt ? formatDate(new Date(event.startsAt)) : "—"}
                  </Text>
                  <Text style={[{ flex: 1 }, styles.num]}>{count(event.ticketsSold)}</Text>
                  <Text style={[{ flex: 1.3 }, styles.num]}>{money(event.revenue)}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        <View style={styles.footer} fixed>
          <Text>TicketPulse · ticketpulse.tech</Text>
          <Text>
            Figures reflect confirmed paid orders as at {formatDate(stats.generatedAt)}.
          </Text>
        </View>
      </Page>
    </Document>
  )
}
