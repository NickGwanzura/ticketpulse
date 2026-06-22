/**
 * Seed the organizer add-on packages (Sponsored Post, Graphic Design).
 *
 * Run with: npx tsx scripts/seed-packages.ts
 */
import * as dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

import { db } from "@/db"
import { organizerPackages } from "@/db/schema"
import { eq } from "drizzle-orm"

const PACKAGES = [
  {
    name: "Sponsored Post",
    slug: "sponsored-post",
    description: "Get your event in front of more eyes. A SPONSORED badge appears on your event card, your event is pinned to the top of the homepage featured section, and a sponsor banner shows on your event detail page. Lasts 7 days.",
    price: "30.00",
    currency: "USD",
    durationHours: 168, // 7 days
    features: ["sponsored_badge", "homepage_pin", "sponsor_banner"],
    active: true,
  },
  {
    name: "Graphic Design",
    slug: "graphic-design",
    description: "Let us design a professional event cover image and a shareable social media graphic. Upload your logo and a brief describing the look you want. Our design team delivers within 72 hours.",
    price: "20.00",
    currency: "USD",
    durationHours: null,
    features: ["cover_design", "social_graphic"],
    active: true,
  },
]

async function main() {
  console.log(`Seeding ${PACKAGES.length} organizer packages...`)

  for (const pkg of PACKAGES) {
    // Upsert: check if slug exists
    const existing = await db
      .select({ id: organizerPackages.id })
      .from(organizerPackages)
      .where(eq(organizerPackages.slug, pkg.slug))
      .limit(1)

    if (existing.length > 0) {
      console.log(`  • "${pkg.name}" already exists (id: ${existing[0].id}) — skipping`)
      continue
    }

    const [inserted] = await db.insert(organizerPackages).values(pkg).returning({ id: organizerPackages.id })
    console.log(`  ✓ "${pkg.name}" created (id: ${inserted.id})`)
  }

  console.log("Done.")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
