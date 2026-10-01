import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { uploadPublicObject } from "@/lib/r2"
import { formatChatId, getSession, sendDocument, sendImage, sendText } from "@/lib/whatsapp"

vi.mock("@/lib/r2", () => ({
  uploadPublicObject: vi.fn().mockResolvedValue("https://cdn.example.test/whatsapp/test.pdf"),
}))

describe("Gupshup WhatsApp provider", () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubEnv("GUPSHUP_API_KEY", "test-gupshup-key")
    vi.stubEnv("GUPSHUP_APP_ID", "test-app-id")
    vi.stubEnv("GUPSHUP_APP_NAME", "Spiritus")
    vi.stubEnv("GUPSHUP_SOURCE", "263777816368")
    vi.stubEnv("WHATSAPP_COUNTRY_CODE", "263")
    vi.stubGlobal("fetch", fetchMock)
    fetchMock.mockReset()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("normalizes Zimbabwean numbers into the existing chat key format", () => {
    expect(formatChatId("0777816368")).toBe("263777816368@c.us")
    expect(formatChatId("+263 77 781 6368")).toBe("263777816368@c.us")
  })

  it("sends text using Gupshup's form-encoded WhatsApp message API", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ status: "submitted", messageId: "msg-123" }), { status: 200 }))

    const result = await sendText("0777816368", "Hello")

    expect(result.messageId).toBe("msg-123")
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("https://api.gupshup.io/wa/api/v1/msg")
    expect(new Headers(init.headers).get("apikey")).toBe("test-gupshup-key")
    const form = new URLSearchParams(String(init.body))
    expect(form.get("channel")).toBe("whatsapp")
    expect(form.get("source")).toBe("263777816368")
    expect(form.get("destination")).toBe("263777816368")
    expect(form.get("src.name")).toBe("Spiritus")
    expect(JSON.parse(form.get("message") ?? "{}")).toEqual({ type: "text", text: "Hello" })
  })

  it("uploads base64 ticket media and sends it as a Gupshup file", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ status: "submitted", messageId: "doc-123" }), { status: 200 }))

    await sendDocument({ chatId: "0777816368", base64: "cGRm", mimetype: "application/pdf", filename: "ticket.pdf", caption: "Your ticket" })

    expect(uploadPublicObject).toHaveBeenCalledWith(expect.objectContaining({
      contentType: "application/pdf",
      body: Buffer.from("cGRm", "base64"),
    }))
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const message = JSON.parse(new URLSearchParams(String(init.body)).get("message") ?? "{}")
    expect(message).toEqual({
      type: "file",
      url: "https://cdn.example.test/whatsapp/test.pdf",
      filename: "ticket.pdf",
      caption: "Your ticket",
    })
  })

  it("sends images with Gupshup's original and preview URLs", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ status: "submitted", messageId: "img-123" }), { status: 200 }))

    await sendImage({ chatId: "+263 77 123 4567", url: "https://cdn.example.test/image.jpg", caption: "New sale" })

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const message = JSON.parse(new URLSearchParams(String(init.body)).get("message") ?? "{}")
    expect(message).toEqual({
      type: "image",
      originalUrl: "https://cdn.example.test/image.jpg",
      previewUrl: "https://cdn.example.test/image.jpg",
      caption: "New sale",
    })
  })

  it("checks Gupshup app credentials through its business profile endpoint", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ status: "success", business: { id: "test-app-id", name: "Spiritus" } }), { status: 200 }))

    const status = await getSession()

    expect(status.status).toBe("ready")
    expect(status.phone).toBe("+263777816368")
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.gupshup.io/wa/app/test-app-id/business")
  })

  it("surfaces Gupshup authentication and provider errors", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ status: "error", message: "Authentication Failed" }), { status: 401 }))

    await expect(sendText("0777816368", "Hello")).rejects.toThrow("Gupshup API error: Authentication Failed")
  })
})
