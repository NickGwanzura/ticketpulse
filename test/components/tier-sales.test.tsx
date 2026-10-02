import { render, screen, within } from "@testing-library/react"
import { expect, it } from "vitest"
import TicketTierSalesBreakdown from "@/components/dashboard/TicketTierSalesBreakdown"

it("shows separate tier counts, stock, revenue and pending allocations", () => {
  render(<TicketTierSalesBreakdown tiers={[
    { id: "vip", eventId: "e", name: "VIP", price: 50, currency: "USD", capacity: 100, sold: 24, complimentary: 2, reserved: 4, remaining: 70, revenue: 1080 },
    { id: "ga", eventId: "e", name: "General Admission", price: 25, currency: "ZWG", capacity: 200, sold: 0, complimentary: 0, reserved: 0, remaining: 200, revenue: 0 },
  ]} />)
  const [vip, ga] = screen.getAllByRole("listitem")
  expect(vip).toHaveTextContent("VIP")
  expect(vip).toHaveTextContent("24 sold / 100 capacity")
  expect(vip).toHaveTextContent("Available70")
  expect(vip).toHaveTextContent("Complimentary2")
  expect(vip).toHaveTextContent("Reserved / pending4")
  expect(vip).toHaveTextContent("Ticket revenue$1,080")
  expect(within(vip).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "24")
  expect(ga).toHaveTextContent("0 sold / 200 capacity")
  expect(ga).toHaveTextContent("ZWG")
  expect(ga).not.toHaveTextContent("Complimentary")
})

it("displays revenue in its original currencies without adding them together", () => {
  render(<TicketTierSalesBreakdown tiers={[
    { id: "vip", eventId: "e", name: "VIP", price: 50, currency: "USD", capacity: 100, sold: 2, complimentary: 0, reserved: 0, remaining: 98, revenue: 50, revenueByCurrency: [
      { currency: "USD", amount: 50 }, { currency: "ZWG", amount: 250 },
    ] },
  ]} />)
  const tier = screen.getByRole("listitem")
  expect(tier).toHaveTextContent("Ticket revenue$50ZWG")
  expect(tier).toHaveTextContent("250")
})

it("keeps the progress bar valid if issued sales exceed capacity", () => {
  render(<TicketTierSalesBreakdown tiers={[
    { id: "vip", eventId: "e", name: "VIP", price: 10, currency: "USD", capacity: 2, sold: 3, complimentary: 0, reserved: 0, remaining: 0, revenue: 30 },
  ]} />)
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100")
})
