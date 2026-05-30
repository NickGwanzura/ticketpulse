import { renderToBuffer } from "@react-pdf/renderer"
import { TicketDocument, type TicketPageData } from "./ticket-document"

/**
 * Generate a PDF buffer from ticket data using @react-pdf/renderer.
 */
export async function generateTicketPdfBuffer(
  tickets: TicketPageData[],
): Promise<Buffer> {
  if (tickets.length === 0) {
    // Empty document fallback
    const empty = <TicketDocument tickets={[]} />
    return renderToBuffer(empty)
  }

  const doc = <TicketDocument tickets={tickets} />
  return renderToBuffer(doc)
}
