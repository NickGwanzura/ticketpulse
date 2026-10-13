import { existsSync } from "node:fs"
import path from "node:path"
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer"

import { PLATFORM_FEE_PERCENT } from "@/lib/platform-fee"

export const SOP_VERSION = "1.0"
export const SOP_DATE = "13 October 2026"

const COLORS = {
  brand: "#131132",
  ink: "#0a2540",
  ink2: "#5a6d7c",
  ink3: "#8a9caa",
  line: "#e2e8f0",
  paper: "#ffffff",
  paper2: "#F6F9FC",
  emerald: "#10B981",
  amber: "#B45309",
}

const styles = StyleSheet.create({
  page: { padding: 36, paddingBottom: 56, backgroundColor: COLORS.paper, fontFamily: "Helvetica", fontSize: 10, color: COLORS.ink, lineHeight: 1.45 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", borderBottom: `2px solid ${COLORS.brand}`, paddingBottom: 10, marginBottom: 16 },
  logo: { width: 84, height: 46, marginBottom: 4 },
  brand: { fontSize: 16, fontWeight: "bold", color: COLORS.brand },
  docTitle: { fontSize: 10, color: COLORS.ink2 },
  meta: { fontSize: 8, color: COLORS.ink3, textAlign: "right" },
  h1: { fontSize: 22, lineHeight: 1.2, fontWeight: "bold", color: COLORS.brand, marginBottom: 8 },
  lead: { fontSize: 11, color: COLORS.ink2, marginBottom: 14 },
  h2: { fontSize: 13, fontWeight: "bold", color: COLORS.brand, marginTop: 14, marginBottom: 6 },
  p: { marginBottom: 6 },
  bullet: { flexDirection: "row", marginBottom: 3 },
  bulletDot: { width: 12, color: COLORS.brand },
  bulletText: { flex: 1 },
  step: { flexDirection: "row", marginBottom: 6 },
  stepNo: { width: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.brand, color: COLORS.paper, textAlign: "center", fontSize: 9, fontWeight: "bold", paddingTop: 5, marginRight: 8 },
  stepBody: { flex: 1, paddingTop: 2 },
  stepTitle: { fontWeight: "bold" },
  callout: { backgroundColor: COLORS.paper2, borderLeft: `3px solid ${COLORS.brand}`, padding: 10, marginVertical: 8 },
  calloutWarn: { backgroundColor: "#FEF3C7", borderLeft: `3px solid ${COLORS.amber}`, padding: 10, marginVertical: 8 },
  table: { border: `1px solid ${COLORS.line}`, borderRadius: 6, marginVertical: 6 },
  tr: { flexDirection: "row", borderBottom: `1px solid ${COLORS.line}`, paddingVertical: 5, paddingHorizontal: 8 },
  trHead: { backgroundColor: COLORS.paper2, fontWeight: "bold" },
  trLast: { borderBottom: "none" },
  c1: { flex: 1.1, fontWeight: "bold" },
  c2: { flex: 3 },
  num: { flex: 1, textAlign: "right" },
  footer: { position: "absolute", bottom: 20, left: 36, right: 36, flexDirection: "row", justifyContent: "space-between", borderTop: `1px solid ${COLORS.line}`, paddingTop: 6, fontSize: 7, color: COLORS.ink3 },
})

function logoPath(): string | null {
  const file = path.join(process.cwd(), "public", "ticketpulse-logo-email.png")
  return existsSync(file) ? file : null
}

function Bullets({ items }: { items: string[] }) {
  return (
    <View>
      {items.map((t) => (
        <View key={t} style={styles.bullet} wrap={false}>
          <Text style={styles.bulletDot}>•</Text>
          <Text style={styles.bulletText}>{t}</Text>
        </View>
      ))}
    </View>
  )
}

function Steps({ items }: { items: { title: string; body: string }[] }) {
  return (
    <View>
      {items.map((s, i) => (
        <View key={s.title} style={styles.step} wrap={false}>
          <Text style={styles.stepNo}>{i + 1}</Text>
          <View style={styles.stepBody}>
            <Text style={styles.stepTitle}>{s.title}</Text>
            <Text>{s.body}</Text>
          </View>
        </View>
      ))}
    </View>
  )
}

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <View style={styles.table}>
      <View style={[styles.tr, styles.trHead]}>
        {head.map((h, i) => <Text key={h} style={i === 0 ? styles.c1 : styles.c2}>{h}</Text>)}
      </View>
      {rows.map((r, ri) => (
        <View key={r[0]} style={[styles.tr, ri === rows.length - 1 ? styles.trLast : {}]} wrap={false}>
          {r.map((c, i) => <Text key={i} style={i === 0 ? styles.c1 : styles.c2}>{c}</Text>)}
        </View>
      ))}
    </View>
  )
}

export async function generateOrganiserSopPdfBuffer(): Promise<Buffer> {
  return renderToBuffer(<OrganiserSopDocument />)
}

function OrganiserSopDocument() {
  const logo = logoPath()
  const fee = PLATFORM_FEE_PERCENT
  const gross = 1000
  const feeAmt = (gross * fee) / 100
  const net = gross - feeAmt
  const usd = (n: number) => `USD ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <Document title="TicketPulse organiser payout SOP" author="TicketPulse">
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            {logo ? <Image src={logo} style={styles.logo} /> : <Text style={styles.brand}>TicketPulse</Text>}
            <Text style={styles.docTitle}>Standard operating procedure</Text>
          </View>
          <View>
            <Text style={styles.meta}>Version {SOP_VERSION}</Text>
            <Text style={styles.meta}>{SOP_DATE}</Text>
          </View>
        </View>

        <Text style={styles.h1}>Getting paid: organiser payout SOP</Text>
        <Text style={styles.lead}>
          How ticket money reaches you: what we keep, what you receive, and how to request a bank payout.
        </Text>

        <Text style={styles.h2}>1. Purpose</Text>
        <Text style={styles.p}>
          This document is for new TicketPulse organisers. It explains the platform fee, how your balance is calculated, how to request a
          payout to your bank account, and what happens after you ask. Following it keeps your payouts fast and avoids delays.
        </Text>

        <Text style={styles.h2}>2. The fee: {fee}% of ticket sales</Text>
        <Text style={styles.p}>
          TicketPulse keeps <Text style={{ fontWeight: "bold" }}>{fee}%</Text> of your confirmed ticket sales. The remaining {100 - fee}% is
          your net earnings and is what you can withdraw. The fee is deducted automatically; you never pay it separately.
        </Text>
        <Table
          head={["Example", "Amount"]}
          rows={[
            ["Confirmed ticket sales", usd(gross)],
            [`TicketPulse fee (${fee}%)`, `- ${usd(feeAmt)}`],
            ["Your net earnings", usd(net)],
          ]}
        />
        <View style={styles.callout}>
          <Text>
            Payment gateway charges are added to the buyer&apos;s total at checkout as &quot;gateway fees&quot;. They are paid by the buyer and are not taken
            from your earnings.
          </Text>
        </View>

        <Text style={styles.h2}>3. How your balance works</Text>
        <Table
          head={["Term", "Meaning"]}
          rows={[
            ["Gross revenue", "Ticket sales on paid and completed orders (tickets actually issued)."],
            ["Net earnings", `Gross revenue less the ${fee}% TicketPulse fee.`],
            ["Paid out", "Payouts already sent to you."],
            ["Pending", "Payout requests still being reviewed or processed."],
            ["Clawbacks", "Money already paid to you that a later refund showed should not have been (see section 7)."],
            ["Available balance", "Net earnings, minus paid out, pending payouts and clawbacks. This is the most you can request."],
          ]}
        />

        <View style={styles.footer} fixed>
          <Text>TicketPulse · Organiser payout SOP · v{SOP_VERSION}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.h2}>4. Payout method: USD bank transfer</Text>
        <Text style={styles.p}>Payouts are made by bank transfer, in US dollars (USD). Have these details ready:</Text>
        <Bullets items={[
          "Bank name",
          "Account holder name (exactly as it appears on the account)",
          "Account number",
        ]} />
        <View style={styles.calloutWarn}>
          <Text>
            We pay exactly the details you submit. Check the bank name, account holder and account number before sending the request. Payouts to
            incorrect details can fail or be delayed.
          </Text>
        </View>

        <Text style={styles.h2}>5. How to request a payout</Text>
        <Steps items={[
          { title: "Open Payouts", body: "Sign in to your organiser account and open Payouts. Check your available balance." },
          { title: "Choose Request payout", body: "Enter the amount you want to withdraw in USD." },
          { title: "Select bank transfer", body: "Enter your bank name, account holder name and account number." },
          { title: "Submit and keep the reference", body: "You receive an email confirmation with a short payout reference. Quote it if you contact support." },
          { title: "Wait for processing", body: "Track the status on the Payouts page (see section 6)." },
        ]} />
        <Text style={styles.h2}>Rules</Text>
        <Bullets items={[
          "Minimum request: USD 1.00.",
          "You can request up to your available balance, never more.",
          "Only one active payout request at a time. Wait for the current one to finish before asking again.",
          "Payouts are currently available in USD only.",
        ]} />

        <Text style={styles.h2}>6. What happens after you request</Text>
        <Text style={styles.p}>
          We normally process requests in about 24 hours. Bank processing times and verification checks can make it a little shorter or longer.
        </Text>
        <Table
          head={["Status", "What it means"]}
          rows={[
            ["Pending", "Received and waiting for review."],
            ["Approved", "Reviewed and cleared for payment."],
            ["Processing", "The bank transfer is being made."],
            ["Paid", "Sent to your bank. Allow your bank its usual time to show the funds."],
            ["Held", "Paused while TicketPulse completes a check. Contact support if it stays held."],
            ["Rejected", "Not approved. Contact support for the reason."],
            ["Failed", "The transfer did not go through (for example, wrong bank details). Contact support."],
            ["Cancelled", "The request was cancelled and the amount returns to your available balance."],
          ]}
        />

        <View style={styles.footer} fixed>
          <Text>TicketPulse · Organiser payout SOP · v{SOP_VERSION}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.h2}>7. Refunds and clawbacks</Text>
        <Text style={styles.p}>
          If a ticket is refunded after you have already been paid for it, the refunded amount is recorded as an outstanding clawback and
          deducted from your available balance. It reduces what you can withdraw next; you do not need to send money back. Your payout statement
          lists any outstanding clawbacks.
        </Text>

        <Text style={styles.h2}>8. Account trust levels</Text>
        <Table
          head={["Level", "Requirement"]}
          rows={[
            ["New", "Your organiser account is awaiting approval."],
            ["Verified", "TicketPulse has approved your organiser account."],
            ["Trusted", "An approved account with at least 3 payouts paid."],
          ]}
        />
        <Text style={styles.p}>Your current level and progress are shown at the top of the Payouts page.</Text>

        <Text style={styles.h2}>9. Statements and records</Text>
        <Text style={styles.p}>
          On the Payouts page, choose Download PDF for a branded payout summary and statement: your earnings by event, how your balance was
          calculated, and every payout with its date, reference, status and amount. Pick From and To dates to limit the payout list to a period.
          The statement number on each PDF identifies it if you need to refer to it later. Keep these for your own accounts and tax records.
        </Text>

        <Text style={styles.h2}>10. New organiser checklist</Text>
        <Bullets items={[
          "Complete organiser onboarding and wait for account approval.",
          "Publish your event and confirm your ticket prices. The fee is taken from ticket sales.",
          "After sales start, open Payouts to see your balance and trust level.",
          "Have your bank name, account holder name and account number ready.",
          "Request a payout once you have an available balance, and keep the payout reference.",
          "Download your statement after each payout for your records.",
        ]} />

        <Text style={styles.h2}>11. Need help?</Text>
        <Text style={styles.p}>
          Visit the Help Center or contact TicketPulse at ticketpulse.tech/contact. Include your payout reference and the email on your organiser account.
        </Text>

        <View style={styles.footer} fixed>
          <Text>TicketPulse · Organiser payout SOP · v{SOP_VERSION}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}
