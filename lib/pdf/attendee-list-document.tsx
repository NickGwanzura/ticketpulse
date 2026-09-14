import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer"

export type AttendeeListData = {
  eventTitle: string
  organizerName: string
  venue: string
  startsAt: Date | null
  generatedAt: Date
  attendees: {
    name: string
    email: string
    phone: string
    ticketType: string
    checkedIn: boolean
    holderName: string
  }[]
}

export async function generateAttendeeListPdfBuffer(data: AttendeeListData): Promise<Buffer> {
  return renderToBuffer(<AttendeeListDocument data={data} />)
}

const COLORS = {
  navy: "#0A2540",
  brand: "#131132",
  ink: "#172B3A",
  muted: "#627485",
  soft: "#F4F7FA",
  line: "#DCE5EC",
  white: "#FFFFFF",
  green: "#087443",
  greenSoft: "#E8F7EF",
  amber: "#9A5B00",
  amberSoft: "#FFF5DC",
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 34,
    paddingBottom: 38,
    paddingHorizontal: 34,
    backgroundColor: COLORS.white,
    color: COLORS.ink,
    fontFamily: "Helvetica",
    fontSize: 9,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingBottom: 14,
    borderBottom: `2px solid ${COLORS.navy}`,
  },
  brand: {
    fontSize: 17,
    fontWeight: "bold",
    color: COLORS.navy,
    letterSpacing: 0.4,
  },
  reportType: {
    marginTop: 3,
    fontSize: 9,
    color: COLORS.muted,
  },
  generated: {
    fontSize: 8,
    color: COLORS.muted,
    textAlign: "right",
  },
  eventBanner: {
    marginTop: 18,
    padding: 14,
    borderRadius: 8,
    backgroundColor: COLORS.navy,
  },
  eventTitle: {
    fontSize: 17,
    fontWeight: "bold",
    color: COLORS.white,
  },
  eventMeta: {
    marginTop: 5,
    fontSize: 9,
    color: "#DCE8F2",
  },
  summaryRow: {
    flexDirection: "row",
    marginTop: 12,
    marginBottom: 18,
  },
  summaryCard: {
    flex: 1,
    marginRight: 8,
    padding: 10,
    borderRadius: 6,
    border: `1px solid ${COLORS.line}`,
    backgroundColor: COLORS.soft,
  },
  summaryCardLast: { marginRight: 0 },
  summaryLabel: {
    fontSize: 7,
    color: COLORS.muted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  summaryValue: {
    marginTop: 4,
    fontSize: 15,
    fontWeight: "bold",
    color: COLORS.navy,
  },
  sectionTitle: {
    marginBottom: 7,
    fontSize: 10,
    fontWeight: "bold",
    color: COLORS.navy,
  },
  table: {
    border: `1px solid ${COLORS.line}`,
    borderRadius: 6,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 25,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottom: `1px solid ${COLORS.line}`,
  },
  rowLast: { borderBottom: "none" },
  headerRow: {
    backgroundColor: COLORS.soft,
  },
  cell: { fontSize: 8, color: COLORS.ink },
  cellHeader: {
    fontSize: 7,
    fontWeight: "bold",
    color: COLORS.muted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  number: { width: 24, color: COLORS.muted },
  attendee: { width: "24%", paddingRight: 8 },
  contact: { width: "29%", paddingRight: 8 },
  ticket: { width: "17%", paddingRight: 8 },
  checkin: { flex: 1 },
  subline: { marginTop: 2, fontSize: 7, color: COLORS.muted },
  checked: {
    alignSelf: "flex-start",
    paddingVertical: 3,
    paddingHorizontal: 5,
    borderRadius: 4,
    backgroundColor: COLORS.greenSoft,
    color: COLORS.green,
    fontSize: 7,
    fontWeight: "bold",
  },
  notChecked: {
    alignSelf: "flex-start",
    paddingVertical: 3,
    paddingHorizontal: 5,
    borderRadius: 4,
    backgroundColor: COLORS.amberSoft,
    color: COLORS.amber,
    fontSize: 7,
    fontWeight: "bold",
  },
  footer: {
    position: "absolute",
    left: 34,
    right: 34,
    bottom: 18,
    paddingTop: 7,
    borderTop: `1px solid ${COLORS.line}`,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: COLORS.muted,
  },
})

function formatDate(value: Date | null, withTime = false) {
  if (!value) return "Date TBA"
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  })
}

function AttendeeListDocument({ data }: { data: AttendeeListData }) {
  const checkedIn = data.attendees.filter((attendee) => attendee.checkedIn).length

  return (
    <Document title={`${data.eventTitle} attendee list`} author="TicketPulse">
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.header} fixed>
          <View>
            <Text style={styles.brand}>TicketPulse</Text>
            <Text style={styles.reportType}>Branded attendee list</Text>
          </View>
          <Text style={styles.generated}>Generated {formatDate(data.generatedAt, true)}</Text>
        </View>

        <View style={styles.eventBanner}>
          <Text style={styles.eventTitle}>{data.eventTitle}</Text>
          <Text style={styles.eventMeta}>
            {data.organizerName} · {data.venue} · {formatDate(data.startsAt)}
          </Text>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Attendees</Text>
            <Text style={styles.summaryValue}>{data.attendees.length}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Checked in</Text>
            <Text style={styles.summaryValue}>{checkedIn}</Text>
          </View>
          <View style={[styles.summaryCard, styles.summaryCardLast]}>
            <Text style={styles.summaryLabel}>Remaining</Text>
            <Text style={styles.summaryValue}>{Math.max(0, data.attendees.length - checkedIn)}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Issued attendee tickets</Text>
        <View style={styles.table}>
          <View style={[styles.row, styles.headerRow]} wrap={false}>
            <Text style={[styles.cellHeader, styles.number]}>#</Text>
            <Text style={[styles.cellHeader, styles.attendee]}>Attendee</Text>
            <Text style={[styles.cellHeader, styles.contact]}>Contact</Text>
            <Text style={[styles.cellHeader, styles.ticket]}>Ticket</Text>
            <Text style={[styles.cellHeader, styles.checkin]}>Entry</Text>
          </View>
          {data.attendees.map((attendee, index) => (
            <View key={`${attendee.email}-${index}`} style={[styles.row, index === data.attendees.length - 1 ? styles.rowLast : {}]} wrap={false}>
              <Text style={[styles.cell, styles.number]}>{index + 1}</Text>
              <View style={styles.attendee}>
                <Text style={styles.cell}>{attendee.name || "Guest"}</Text>
                {attendee.holderName && attendee.holderName !== attendee.name && <Text style={styles.subline}>Holder: {attendee.holderName}</Text>}
              </View>
              <View style={styles.contact}>
                <Text style={styles.cell}>{attendee.email || "No email"}</Text>
                {attendee.phone && <Text style={styles.subline}>{attendee.phone}</Text>}
              </View>
              <Text style={[styles.cell, styles.ticket]}>{attendee.ticketType || "Ticket"}</Text>
              <View style={styles.checkin}>
                <Text style={attendee.checkedIn ? styles.checked : styles.notChecked}>{attendee.checkedIn ? "Checked in" : "Not checked in"}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.footer} fixed>
          <Text>TicketPulse · Private organiser report</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}
