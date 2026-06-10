import { renderToBuffer } from "@react-pdf/renderer"

import type { VelocityReconciliationReport } from "@/lib/velocity-reconciliation"
import { ReconciliationDocument } from "./reconciliation-document"

/**
 * Render the Velocity reconciliation report as a PDF buffer.
 */
export async function generateReconciliationPdfBuffer(
  report: VelocityReconciliationReport,
): Promise<Buffer> {
  return renderToBuffer(<ReconciliationDocument report={report} />)
}
