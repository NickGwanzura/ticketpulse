import * as dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

import { S3Client, PutBucketCorsCommand, GetBucketCorsCommand } from "@aws-sdk/client-s3"

const ALLOWED_ORIGINS = [
  "https://ticketpulse.tech",
  "https://www.ticketpulse.tech",
  "http://localhost:3000",
  "http://localhost:5000",
]

async function main() {
  const endpoint = process.env.R2_ENDPOINT
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  const bucket = process.env.R2_BUCKET

  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
    console.error("Missing R2 env vars. Need R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET.")
    process.exit(1)
  }

  const client = new S3Client({
    region: "auto",
    endpoint,
    forcePathStyle: false,
    credentials: { accessKeyId, secretAccessKey },
  })

  console.log(`Bucket: ${bucket}`)
  console.log(`Origins: ${ALLOWED_ORIGINS.join(", ")}`)

  try {
    const existing = await client.send(new GetBucketCorsCommand({ Bucket: bucket }))
    console.log("Existing CORS rules:")
    console.dir(existing.CORSRules, { depth: 4 })
  } catch (err) {
    const code = (err as { name?: string }).name
    if (code === "NoSuchCORSConfiguration" || code === "NoSuchCORSConfigurationError") {
      console.log("No existing CORS rules.")
    } else {
      console.warn("Could not read existing CORS:", code ?? err)
    }
  }

  await client.send(
    new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: ALLOWED_ORIGINS,
            AllowedMethods: ["PUT", "GET", "HEAD"],
            AllowedHeaders: ["*"],
            ExposeHeaders: ["ETag"],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    }),
  )

  console.log("CORS policy applied.")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
