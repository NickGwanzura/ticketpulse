import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from "@react-pdf/renderer"

export type TicketPageData = {
  eventTitle: string
  tierName: string
  buyerName: string
  orderId: string
  ticketId: string
  qrCodeDataUrl: string
  humanCode: string
  venue?: string | null
  eventDate?: string | null
}

const COLORS = {
  brand: "#131132",
  brandLight: "#4A4870",
  ink: "#0a2540",
  ink2: "#5a6d7c",
  ink3: "#8a9caa",
  line: "#e2e8f0",
  paper: "#ffffff",
  emerald: "#10B981",
  emeraldLight: "#D1FAE5",
}

const styles = StyleSheet.create({
  page: {
    width: "105mm",
    height: "148mm",
    padding: 0,
    backgroundColor: COLORS.paper,
    fontFamily: "Helvetica",
  },
  header: {
    backgroundColor: COLORS.brand,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerText: {
    color: COLORS.paper,
    fontSize: 10,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
  headerCode: {
    color: "#ffffffaa",
    fontSize: 8,
    fontFamily: "Courier",
  },
  body: {
    flexDirection: "row",
    flex: 1,
    padding: 16,
    gap: 12,
  },
  leftColumn: {
    flex: 1,
    justifyContent: "space-between",
  },
  rightColumn: {
    width: 110,
    alignItems: "center",
    justifyContent: "center",
    borderLeft: `1px dashed ${COLORS.line}`,
    paddingLeft: 12,
    gap: 4,
  },
  tierBadge: {
    backgroundColor: COLORS.emeraldLight,
    color: "#047857",
    fontSize: 8,
    fontWeight: "bold",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    alignSelf: "flex-start",
    marginBottom: 6,
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: COLORS.ink,
    lineHeight: 1.2,
    marginBottom: 8,
  },
  detailRow: {
    marginBottom: 6,
  },
  detailLabel: {
    fontSize: 6,
    fontWeight: "bold",
    color: COLORS.ink3,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 1,
  },
  detailText: {
    fontSize: 8.5,
    fontWeight: "bold",
    color: COLORS.ink,
  },
  divider: {
    borderTop: `1px solid ${COLORS.line}`,
    marginTop: 8,
    paddingTop: 6,
  },
  label: {
    fontSize: 7,
    fontWeight: "bold",
    color: COLORS.ink3,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  mono: {
    fontSize: 8,
    fontFamily: "Courier",
    color: COLORS.ink,
    marginTop: 2,
    wordBreak: "break-all",
  },
  qrImage: {
    width: 90,
    height: 90,
  },
  qrLabel: {
    fontSize: 7,
    fontFamily: "Courier",
    color: COLORS.ink3,
    maxWidth: 100,
  },
  footer: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  issuedText: {
    fontSize: 7,
    color: COLORS.ink3,
    textAlign: "center",
  },
})

function TicketPage({ data }: { data: TicketPageData }) {
  return (
    <Page size="A6" style={styles.page}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerText}>TicketPulse</Text>
        <Text style={styles.headerCode}>{data.humanCode}</Text>
      </View>

      {/* Body */}
      <View style={styles.body}>
        <View style={styles.leftColumn}>
          <View>
            <Text style={styles.tierBadge}>{data.tierName}</Text>
            <Text style={styles.eventTitle}>{data.eventTitle}</Text>
            {data.eventDate && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Starts</Text>
                <Text style={styles.detailText}>{data.eventDate}</Text>
              </View>
            )}
            {data.venue && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Venue</Text>
                <Text style={styles.detailText}>{data.venue}</Text>
              </View>
            )}
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Ticket holder</Text>
              <Text style={styles.detailText}>{data.buyerName}</Text>
            </View>
          </View>

          <View style={styles.divider}>
            <Text style={styles.label}>Order reference</Text>
            <Text style={styles.mono}>{data.orderId.slice(0, 8).toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.rightColumn}>
          {data.qrCodeDataUrl ? (
            <Image src={data.qrCodeDataUrl} style={styles.qrImage} />
          ) : (
            <View style={[styles.qrImage, { backgroundColor: COLORS.line }]} />
          )}
          <Text style={styles.qrLabel}>{data.ticketId.slice(0, 16)}</Text>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.issuedText}>
          Issued {new Date().toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </Text>
      </View>
    </Page>
  )
}

export function TicketDocument({ tickets }: { tickets: TicketPageData[] }) {
  return (
    <Document>
      {tickets.map((t, i) => (
        <TicketPage key={i} data={t} />
      ))}
    </Document>
  )
}
