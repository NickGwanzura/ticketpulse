import { fireEvent, render, screen } from "@testing-library/react"
import { expect, it, vi } from "vitest"

vi.mock("@/app/vendors/apply/actions", () => ({
  applyVendorAction: vi.fn(),
  initialVendorApplyState: { error: null, fieldErrors: {} },
}))

import { applyVendorAction } from "@/app/vendors/apply/actions"
import VendorApplicationForm from "@/app/vendors/apply/VendorApplicationForm"

const defaults = {
  businessName: "",
  category: "",
  city: "",
  phone: "",
  description: "",
  portfolioLink: "",
}

it("requires only the basic business details and terms", () => {
  render(<VendorApplicationForm email="hello@example.co.zw" defaults={defaults} resubmitting={false} />)

  expect(screen.getByLabelText("Business name")).toBeRequired()
  expect(screen.getByLabelText("Category")).toBeRequired()
  expect(screen.getByLabelText("Primary city")).toBeRequired()
  expect(screen.getByLabelText("Phone")).toBeRequired()
  expect(screen.getByText("hello@example.co.zw")).toBeVisible()
  expect(screen.getByRole("checkbox")).toBeRequired()
  expect(screen.getByLabelText(/About your service/)).not.toBeRequired()
  expect(screen.getByLabelText(/Portfolio link/)).not.toBeRequired()
})

it("keeps entered details and shows the field error after validation fails", async () => {
  vi.mocked(applyVendorAction).mockResolvedValueOnce({
    error: "Please correct the highlighted fields and submit again.",
    fieldErrors: { city: ["City is too short"] },
  })

  render(<VendorApplicationForm email="hello@example.co.zw" defaults={defaults} resubmitting={false} />)
  fireEvent.change(screen.getByLabelText("Business name"), { target: { value: "SAVS Manufacturing" } })
  fireEvent.change(screen.getByLabelText("Category"), { target: { value: "other" } })
  fireEvent.change(screen.getByLabelText("Primary city"), { target: { value: "H" } })
  fireEvent.change(screen.getByLabelText("Phone"), { target: { value: "+263 77 123 4567" } })
  const form = screen.getByRole("button", { name: /submit application/i }).closest("form")
  expect(form).not.toBeNull()
  fireEvent.submit(form!)

  expect(await screen.findByRole("alert")).toHaveTextContent("Please correct the highlighted fields")
  expect(screen.getByLabelText("Business name")).toHaveValue("SAVS Manufacturing")
  expect(screen.getByLabelText("Primary city")).toHaveValue("H")
  expect(screen.getByText("City is too short")).toBeVisible()
})
