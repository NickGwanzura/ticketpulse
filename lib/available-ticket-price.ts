export type TicketPriceTier = {
  eventId: string
  price: number | string
  currency: string | null
  totalQuantity: number
  soldQuantity: number | null
  salesStart: Date | string | null
  salesEnd: Date | string | null
  earlyBirdPrice: number | string | null
  earlyBirdUntil: Date | string | null
  earlyBirdQuantity: number | null
}

export type EventTicketPrice = { price: number; currency: string }

/** Return the lowest currently purchasable price for each event. */
export function getLowestAvailableTicketPrices(
  tiers: TicketPriceTier[],
  now = new Date(),
): Map<string, EventTicketPrice> {
  const lowestByEvent = new Map<string, EventTicketPrice>()

  for (const tier of tiers) {
    const sold = Number(tier.soldQuantity ?? 0)
    if (Number(tier.totalQuantity ?? 0) - sold <= 0) continue
    if (tier.salesStart && new Date(tier.salesStart) > now) continue
    if (tier.salesEnd && new Date(tier.salesEnd) <= now) continue

    const earlyBirdHasSpots = tier.earlyBirdQuantity == null
      || Number(tier.earlyBirdQuantity) > sold
    const earlyBirdIsActive = tier.earlyBirdPrice != null
      && (!tier.earlyBirdUntil || new Date(tier.earlyBirdUntil) > now)
      && earlyBirdHasSpots
    const price = Number(earlyBirdIsActive ? tier.earlyBirdPrice : tier.price)
    const currency = tier.currency ?? "USD"
    const current = lowestByEvent.get(tier.eventId)

    if (!current || price < current.price) {
      lowestByEvent.set(tier.eventId, { price, currency })
    }
  }

  return lowestByEvent
}
