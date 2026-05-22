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
 * ── Existing functions ──────────────────────────────────────────────────────
 */

/**
 * Generate an event description using GROQ.
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

/**
 * ── New AI features for admin + organizer dashboards ────────────────────────
 */

/* ─── 1. Smart Event Moderation ─────────────────────────────────────────── */

export interface ModerationResult {
  flagged: boolean
  reason: string | null
}

/**
 * Scan event content for inappropriate language, spam, or policy violations.
 */
export async function moderateEventContent(
  title: string,
  description: string,
  category: string,
): Promise<ModerationResult> {
  const systemPrompt = `You are a content moderation assistant for TicketPulse, a Zimbabwe-based event ticketing platform.
Analyse the event title, description, and category. Respond with ONLY a JSON object:
{ "flagged": boolean, "reason": string | null }
- flagged: true if the content contains hate speech, profanity, spam, illegal activity, misleading info, or is off-topic for the category.
- reason: if flagged, a one-sentence explanation; otherwise null.
Do not include any explanation or markdown. Only valid JSON.`

  const userPrompt = `Title: "${title}"
Category: "${category}"
Description: "${description?.slice(0, 1000) ?? ""}"`

  try {
    const raw = await groqCompletion(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      0.2,
      200,
    )
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    return JSON.parse(jsonMatch?.[0] ?? raw) as ModerationResult
  } catch {
    return { flagged: false, reason: null }
  }
}

/* ─── 2. Platform Health Brief ──────────────────────────────────────────── */

export interface PlatformBrief {
  summary: string
  highlights: string[]
}

/**
 * Generate a one-paragraph platform health summary with bullet highlights.
 */
export async function generatePlatformBrief(
  activeEvents: number,
  totalOrganizers: number,
  totalRevenue: number,
  topCategory: string,
  topCity: string,
): Promise<PlatformBrief> {
  const systemPrompt = `You are an analytics narrator for TicketPulse. Given platform metrics, respond with ONLY a JSON object:
{ "summary": "2-3 sentence narrative paragraph", "highlights": ["3-5 one-line bullet points as strings"] }
Do not include any explanation or markdown. Only valid JSON.`

  const userPrompt = `Current metrics:
- Active events: ${activeEvents}
- Organizers: ${totalOrganizers}
- Revenue: $${totalRevenue.toLocaleString()}
- Top category: ${topCategory}
- Top city: ${topCity}

Write a brief narrative and bullet highlights.`

  try {
    const raw = await groqCompletion(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      0.5,
        400,
    )
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    return JSON.parse(jsonMatch?.[0] ?? raw) as PlatformBrief
  } catch {
    return {
      summary: "Platform data is still growing. Check back after more events and sales.",
      highlights: ["No highlights yet"],
    }
  }
}

/* ─── 3. Auto Tag Suggestions ───────────────────────────────────────────── */

/**
 * Suggest relevant tags based on event title, description, and category.
 */
export async function suggestTags(
  title: string,
  description: string,
  category: string,
): Promise<string[]> {
  const systemPrompt = `You are a tagging assistant for TicketPulse. Given an event title, description, and category, suggest 3-5 relevant tags.
Respond with ONLY a JSON array of strings, e.g. ["tag1", "tag2", "tag3"].
Tags should be lowercase, single words or short phrases (max 20 chars each).
Do not include any explanation or markdown. Only valid JSON.`

  const userPrompt = `Title: "${title}"
Category: "${category}"
Description: "${description?.slice(0, 500) ?? ""}"`

  try {
    const raw = await groqCompletion(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      0.3,
      200,
    )
    const jsonMatch = raw.match(/\[[\s\S]*\]/)
    return JSON.parse(jsonMatch?.[0] ?? raw) as string[]
  } catch {
    return []
  }
}

/* ─── 4. Organizer Risk Flag ────────────────────────────────────────────── */

export interface RiskAssessment {
  risk: "low" | "medium" | "high"
  reason: string | null
}

/**
 * Assess whether a new organizer's profile or behaviour looks suspicious.
 */
export async function assessOrganizerRisk(
  organizerName: string,
  email: string,
  eventCount: number,
  firstEventTitle?: string,
): Promise<RiskAssessment> {
  const systemPrompt = `You are a risk assessment assistant for TicketPulse. Given an organizer's profile, evaluate risk level.
Respond with ONLY a JSON object:
{ "risk": "low"|"medium"|"high", "reason": string|null }
- Consider: suspicious email patterns, event title spam signals, zero events but high-risk category.
- Most organizers are low risk. Only flag medium/high when there are genuine signals.
Do not include any explanation or markdown. Only valid JSON.`

  const userPrompt = `Organizer: ${organizerName}
Email: ${email}
Events created: ${eventCount}
First event title: "${firstEventTitle ?? "N/A"}"`

  try {
    const raw = await groqCompletion(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      0.2,
      200,
    )
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    return JSON.parse(jsonMatch?.[0] ?? raw) as RiskAssessment
  } catch {
    return { risk: "low", reason: null }
  }
}

/* ─── 5. AI Email Copilot ───────────────────────────────────────────────── */

export interface EmailSuggestion {
  subject: string
  body: string
}

/**
 * Generate an email subject and body for communicating with event attendees.
 */
export async function generateEmailContent(
  eventTitle: string,
  eventDate: string,
  purpose: "reminder" | "thank_you" | "announcement" | "update" | "custom",
  customInstructions?: string,
): Promise<EmailSuggestion> {
  const purposeLabels: Record<string, string> = {
    reminder: "event reminder — remind attendees about the upcoming event date, time and venue",
    thank_you: "thank-you message — thank attendees for their support after the event",
    announcement: "announcement — share exciting news about the event",
    update: "update — inform attendees about changes or new information",
    custom: customInstructions ?? "general message",
  }

  const systemPrompt = `You are an email copywriter for TicketPulse, a Zimbabwe-based ticketing platform.
Write friendly, professional email content for event attendees. Use UK English spelling.
Respond with ONLY a JSON object:
{ "subject": "email subject line (max 60 chars)", "body": "email body (2-4 short paragraphs, warm tone, no markdown)" }
Do not include any explanation or markdown. Only valid JSON.`

  const userPrompt = `Event: "${eventTitle}"
Date: "${eventDate}"
Email purpose: ${purposeLabels[purpose] ?? purposeLabels.custom}

Write the email content.`

  try {
    const raw = await groqCompletion(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      0.6,
      400,
    )
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    return JSON.parse(jsonMatch?.[0] ?? raw) as EmailSuggestion
  } catch {
    return {
      subject: `Update: ${eventTitle}`,
      body: `Hi there,\n\nJust a quick update about ${eventTitle}. Stay tuned for more details.\n\nBest,\nThe TicketPulse Team`,
    }
  }
}

/* ─── 6. Sales Insight ──────────────────────────────────────────────────── */

/**
 * Generate a personalised sales insight or tip for an organizer based on
 * their event's performance.
 */
export async function generateSalesInsight(
  eventTitle: string,
  sold: number,
  capacity: number,
  daysRemaining: number,
  category: string,
  city: string,
): Promise<string> {
  const pct = capacity > 0 ? Math.round((sold / capacity) * 100) : 0

  const systemPrompt = `You are a sales strategist for TicketPulse. Given an event's performance metrics, write ONE actionable insight sentence.
Be specific and helpful. Use UK English spelling. Output ONLY the insight text, no markdown, no prefix.`

  const userPrompt = `Event: "${eventTitle}" (${category})
Location: ${city}
Capacity: ${capacity} | Tickets sold: ${sold} (${pct}% full)
Days until event: ${daysRemaining}

What sales insight or recommendation would you give this organizer?`

  try {
    return await groqCompletion(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      0.5,
      150,
    )
  } catch {
    return "Sales data is still coming in — check back soon for personalised insights."
  }
}

/* ─── 7. Pricing Suggestions ────────────────────────────────────────────── */

export interface PricingSuggestion {
  reasoning: string
  suggestedRange: string
}

/**
 * Suggest optimal ticket pricing based on event details.
 */
export async function suggestPricing(
  eventTitle: string,
  category: string,
  venue: string,
  city: string,
): Promise<PricingSuggestion> {
  const systemPrompt = `You are a pricing consultant for event tickets in Zimbabwe and Southern Africa.
Given event details, suggest a reasonable ticket price range in USD.
Respond with ONLY a JSON object:
{ "reasoning": "one-sentence explanation", "suggestedRange": "e.g. $10 - $25" }
Consider: event type, local market pricing, venue type, city economic factors.
Do not include any explanation or markdown. Only valid JSON.`

  const userPrompt = `Event: "${eventTitle}"
Category: "${category}"
Venue: "${venue}"
City: "${city}"`

  try {
    const raw = await groqCompletion(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      0.4,
      200,
    )
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    return JSON.parse(jsonMatch?.[0] ?? raw) as PricingSuggestion
  } catch {
    return {
      reasoning: "Based on typical event pricing in this category.",
      suggestedRange: "$5 - $30",
    }
  }
}

/* ─── 8. Social Media Blurb ─────────────────────────────────────────────── */

/**
 * Generate a short social media post to promote an event.
 */
export async function generateSocialBlurb(
  eventTitle: string,
  category: string,
  eventDate: string,
  venue: string,
  city: string,
  platform: "twitter" | "facebook" | "instagram",
): Promise<string> {
  const maxLengths = { twitter: 280, facebook: 500, instagram: 300 }
  const maxLen = maxLengths[platform]

  const systemPrompt = `You are a social media copywriter for events in Zimbabwe. Write a ${platform} post promoting an event.
Max ${maxLen} characters. Use 1-2 relevant emojis. Include a call to action. UK English spelling.
Output ONLY the post text, no quotes, no markdown.`

  const userPrompt = `Promote: "${eventTitle}" — a ${category} on ${eventDate} at ${venue}, ${city}.`

  try {
    const text = await groqCompletion(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      0.6,
      200,
    )
    return text.slice(0, maxLen)
  } catch {
    return `Don't miss ${eventTitle} on ${eventDate} at ${venue}! 🎉 Get your tickets now on TicketPulse.`
  }
}

/* ─── 9. Narrative Analytics Summary ────────────────────────────────────── */

/**
 * Generate a narrative summary of platform analytics for the admin analytics page.
 */
export async function generateNarrativeSummary(
  totalRevenue: number,
  eventCount: number,
  organizerCount: number,
  topCity: string,
  topCategory: string,
  paymentMethods: { method: string; pct: number }[],
): Promise<string> {
  const systemPrompt = `You are an analytics narrator for TicketPulse. Given platform metrics, write 2-3 concise sentences summarising the health and trends of the platform.
Use UK English spelling. Output ONLY the narrative text, no markdown.`

  const paymentSummary = paymentMethods.map((p) => `${p.method} ${p.pct}%`).join(", ")
  const userPrompt = `Revenue: $${totalRevenue.toLocaleString()}
Events: ${eventCount}
Organizers: ${organizerCount}
Top city: ${topCity}
Top category: ${topCategory}
Payment mix: ${paymentSummary}

Write a brief narrative summary.`

  try {
    return await groqCompletion(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      0.5,
      300,
    )
  } catch {
    return "Analytics data is populating as the platform grows. Check back after more events and ticket sales."
  }
}
