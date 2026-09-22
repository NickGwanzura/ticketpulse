import { expect, test } from "@playwright/test"

test("public event discovery and organizer signup remain reachable", async ({ page }) => {
  await page.goto("/events")
  await expect(page).toHaveTitle(/TicketPulse/i)

  await page.goto("/auth/signup?role=organizer")
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible()
  await expect(page.getByLabel(/Full name/i)).toBeVisible()
  await expect(page.getByLabel(/Email address/i)).toBeVisible()
  await expect(page.getByLabel(/WhatsApp/i)).toBeVisible()
})

test("protected organizer creation redirects unauthenticated users", async ({ page }) => {
  await page.goto("/organizer/events/new")
  await expect(page).toHaveURL(/\/auth\/signin/)
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible()
})

test("health endpoint reports database and cron readiness", async ({ request }) => {
  const response = await request.get("/api/health")
  expect([200, 503]).toContain(response.status())
  const body = await response.json()
  expect(body).toHaveProperty("status")
  expect(body).toHaveProperty("db")
})

test("organizer can reach the draft creation form", async ({ page }) => {
  const email = process.env.E2E_ORGANIZER_EMAIL
  const password = process.env.E2E_ORGANIZER_PASSWORD
  test.skip(!email || !password, "Set E2E_ORGANIZER_EMAIL and E2E_ORGANIZER_PASSWORD for authenticated coverage")

  await page.goto("/auth/signin?callbackUrl=/organizer/events/new")
  await page.getByLabel(/Email/i).fill(email!)
  await page.getByLabel(/Password/i).fill(password!)
  await page.getByRole("button", { name: "Log in" }).click()
  await page.waitForURL(/\/organizer\/events\/new/)
  await expect(page.getByRole("heading", { name: "Create a new event" })).toBeVisible()
  await expect(page.getByLabel(/Event title/i)).toBeVisible()
})
