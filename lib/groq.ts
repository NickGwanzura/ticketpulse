/**
 * GROQ API client for AI-powered features.
 * Uses the OpenAI-compatible Chat Completions endpoint.
 *
 * Environment variable: GROQ_API_KEY
 * Endpoint: https://api.groq.com/openai/v1/chat/completions
 */

const GROQ_API_KEY = process.env.GROQ_API_KEY ?? ""
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
const MODEL = "llama-3.3-70b-versatile"

interface GroqMessage {
  role: "system" | "user" | "assistant"
  content: string
}

interface GroqChoice {
  message: { content: string }
}

interface GroqResponse {
  choices: GroqChoice[]
}

async function groqCompletion(
  messages: GroqMessage[],
  temperature = 0.7,
  maxTokens = 512,
): Promise<string> {
  if (!GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not set")
  }

  const res = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
    signal: AbortSignal.timeout(15_000),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`GROQ API error ${res.status}: ${body}`)
  }

  const data: GroqResponse = await res.json()
  return data.choices?.[0]?.message?.content?.trim() ?? ""
}

/**
 * Generate an event description using GROQ.
 *
 * @param title   Event title
 * @param category Event category (concert, marathon, etc.)
 * @param venue   Venue name
 * @param city    City
 * @param tags    Comma-separated tags (optional)
 * @returns       A short, engaging event description
 */
export async function generateEventDescription(
  title: string,
  category: string,
  venue: string,
  city: string,
  tags?: string,
): Promise<string> {
  const systemPrompt = `You are an expert event copywriter for TicketPulse, a ticketing platform based in Zimbabwe. 
Write short, engaging event descriptions that are 2-4 sentences long. 
Use UK English spelling. Be specific and vivid. Do not use markdown or bullet points.
Keep it to one paragraph.`

  const tagLine = tags ? ` Tags: ${tags}.` : ""
  const userPrompt = `Write a description for a "${category}" event titled "${title}" taking place at "${venue}" in "${city}".${tagLine}
The description should make people want to attend. Mention the vibe and what to expect.`

  return groqCompletion(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    0.7,
    300,
  )
}

/**
 * Suggest location details (country, address) from venue + city using GROQ.
 *
 * @param venue Venue name
 * @param city  City name
 * @returns     An object with suggested country and/or address, or null fields
 */
export async function suggestLocation(
  venue: string,
  city: string,
): Promise<{ country: string | null; address: string | null }> {
  const systemPrompt = `You are a geography assistant. Given a venue name and a city, respond with ONLY a JSON object containing "country" and "address" fields.
- country: the country where the city is located (full name, e.g. "Zimbabwe")
- address: the street address or area of the venue if known, otherwise null
Do not include any explanation or markdown. Only valid JSON.`

  const userPrompt = `Venue: "${venue}", City: "${city}". What country is this in and what is the likely address?`

  try {
    const raw = await groqCompletion(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      0.3,
      150,
    )

    // Try to extract JSON from the response (it might be wrapped in markdown)
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(jsonMatch?.[0] ?? raw) as {
      country?: string | null
      address?: string | null
    }

    return {
      country: parsed.country ?? null,
      address: parsed.address ?? null,
    }
  } catch {
    return { country: null, address: null }
  }
}
