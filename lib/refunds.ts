export type RefundAllocationLine = {
  id: string
  type: string
  tierId: string | null
  quantity: number
  total: string | number
}

export type RefundAllocationTicket = {
  id: string
  tierId: string | null
}

function cents(value: string | number): number {
  const amount = Number(value)
  if (!Number.isFinite(amount)) throw new Error("Invalid money amount")
  return Math.round(amount * 100)
}

/**
 * Allocate the actual paid order total back across its line items (including
 * any order-level promo), then across individual tickets. Largest-remainder
 * allocation keeps the cents deterministic and never refunds more than paid.
 */
export function allocateTicketRefunds(
  orderTotal: string | number,
  lines: RefundAllocationLine[],
  orderTickets: RefundAllocationTicket[],
): Map<string, number> {
  const subtotalByLine = lines.map((line) => cents(line.total))
  const subtotal = subtotalByLine.reduce((sum, value) => sum + value, 0)
  const paidTotal = cents(orderTotal)
  if (subtotal <= 0 || paidTotal < 0 || paidTotal > subtotal) {
    throw new Error("Order totals are not valid for a refund")
  }

  const exactLinePaid = subtotalByLine.map((lineTotal) => (lineTotal * paidTotal) / subtotal)
  const allocatedLinePaid = exactLinePaid.map(Math.floor)
  const remainingCents = paidTotal - allocatedLinePaid.reduce((sum, value) => sum + value, 0)
  const remainderOrder = exactLinePaid
    .map((amount, index) => ({ index, remainder: amount - Math.floor(amount) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index)
  for (let index = 0; index < remainingCents; index += 1) {
    allocatedLinePaid[remainderOrder[index].index] += 1
  }

  const ticketValueByTier = new Map<string, { amount: number; quantity: number }>()
  for (const [index, line] of lines.entries()) {
    if (line.type !== "ticket" || !line.tierId || line.quantity <= 0) continue
    const group = ticketValueByTier.get(line.tierId) ?? { amount: 0, quantity: 0 }
    group.amount += allocatedLinePaid[index]
    group.quantity += line.quantity
    ticketValueByTier.set(line.tierId, group)
  }

  const ticketsByTier = new Map<string, RefundAllocationTicket[]>()
  for (const ticket of orderTickets) {
    if (!ticket.tierId) continue
    const group = ticketsByTier.get(ticket.tierId) ?? []
    group.push(ticket)
    ticketsByTier.set(ticket.tierId, group)
  }

  const allocations = new Map<string, number>()
  for (const [tierId, groupTickets] of ticketsByTier) {
    const lineValue = ticketValueByTier.get(tierId)
    if (!lineValue) continue
    if (groupTickets.length > lineValue.quantity) {
      throw new Error("Ticket count exceeds the order quantity")
    }
    const base = Math.floor(lineValue.amount / lineValue.quantity)
    const extraCents = lineValue.amount % lineValue.quantity
    groupTickets.forEach((ticket, index) => {
      allocations.set(ticket.id, base + (index < extraCents ? 1 : 0))
    })
  }

  return allocations
}

export function isOutsideStandardRefundWindow(
  eventStartsAt: Date | string | null | undefined,
  now = new Date(),
): boolean {
  if (!eventStartsAt) return true
  const startsAt = eventStartsAt instanceof Date ? eventStartsAt : new Date(eventStartsAt)
  if (!Number.isFinite(startsAt.getTime())) return true
  return now.getTime() > startsAt.getTime() - 24 * 60 * 60 * 1000
}
