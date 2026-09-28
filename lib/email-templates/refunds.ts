function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]!)
}

export function refundRequestReceivedEmail(input: {
  buyerName?: string | null
  eventTitle: string
  requestId: string
  amount: string
  currency: string
  outsideStandardWindow: boolean
}) {
  const name = input.buyerName?.trim() || "there"
  const statusNote = input.outsideStandardWindow
    ? "Your request is outside the standard 24-hour window and will be reviewed as an exception. Applicable consumer rights are not affected."
    : "Your request is within the standard refund window and will be reviewed."
  const text = [
    `Hi ${name},`,
    `We received your refund request for ${input.eventTitle}.`,
    `Request reference: ${input.requestId.slice(0, 8).toUpperCase()}`,
    `Requested amount: ${input.currency} ${input.amount}`,
    statusNote,
    "This is only a request. No money has been returned yet. We will confirm the refund after the payment provider confirms it.",
  ].join("\n\n")
  const html = `
    <p>Hi ${escapeHtml(name)},</p>
    <p>We received your refund request for <strong>${escapeHtml(input.eventTitle)}</strong>.</p>
    <p>Request reference: <strong>${escapeHtml(input.requestId.slice(0, 8).toUpperCase())}</strong><br>
    Requested amount: <strong>${escapeHtml(input.currency)} ${escapeHtml(input.amount)}</strong></p>
    <p>${escapeHtml(statusNote)}</p>
    <p><strong>This is only a request.</strong> No money has been returned yet. We will confirm the refund after the payment provider confirms it.</p>
  `
  return { text, html }
}

export function refundRequestUpdateEmail(input: {
  buyerName?: string | null
  eventTitle: string
  requestId: string
  amount: string
  currency: string
  status: "approved" | "rejected" | "confirmed" | "failed"
  note?: string | null
  providerReference?: string | null
}) {
  const name = input.buyerName?.trim() || "there"
  const statusLine = input.status === "confirmed"
    ? "The payment provider has confirmed your refund. It was sent back to your original payment method. Provider posting times may vary."
    : input.status === "failed"
      ? "Velocity did not complete the refund. Your request is not recorded as refunded. Contact TicketPulse support if you need help."
      : input.status === "approved"
        ? "Your request was approved. TicketPulse will process it in Velocity; it is not complete until the payment provider confirms success."
        : "Your refund request was not approved. Contact TicketPulse support if you think it should be reviewed again."
  const text = [
    `Hi ${name},`,
    `Update for refund request ${input.requestId.slice(0, 8).toUpperCase()} (${input.eventTitle}):`,
    statusLine,
    input.status !== "rejected" ? `Refund amount: ${input.currency} ${input.amount}` : null,
    input.providerReference ? `Provider reference: ${input.providerReference}` : null,
    input.note ? `Note: ${input.note}` : null,
  ].filter(Boolean).join("\n\n")
  const html = `
    <p>Hi ${escapeHtml(name)},</p>
    <p>Update for refund request <strong>${escapeHtml(input.requestId.slice(0, 8).toUpperCase())}</strong> for <strong>${escapeHtml(input.eventTitle)}</strong>:</p>
    <p>${escapeHtml(statusLine)}</p>
    ${input.status !== "rejected" ? `<p>Refund amount: <strong>${escapeHtml(input.currency)} ${escapeHtml(input.amount)}</strong></p>` : ""}
    ${input.providerReference ? `<p>Provider reference: ${escapeHtml(input.providerReference)}</p>` : ""}
    ${input.note ? `<p>Note: ${escapeHtml(input.note)}</p>` : ""}
  `
  return { text, html }
}
