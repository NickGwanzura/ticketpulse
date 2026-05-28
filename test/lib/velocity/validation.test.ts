import { describe, it, expect } from "vitest"
import {
  validateCurrency,
  validatePaymentProcessor,
  validateAmount,
  validatePhone,
  validateSalesOrderPayload,
  validateTransactionPayload,
  isValidUUID,
} from "@/lib/velocity/validation"

describe("velocity validation", () => {
  describe("validateCurrency", () => {
    it("accepts USD", () => expect(validateCurrency("USD")).toBe(true))
    it("accepts ZWG", () => expect(validateCurrency("ZWG")).toBe(true))
    it("rejects EUR", () => expect(validateCurrency("EUR")).toBe(false))
    it("rejects empty string", () => expect(validateCurrency("")).toBe(false))
  })

  describe("validatePaymentProcessor", () => {
    it("accepts ECOCASH", () => expect(validatePaymentProcessor("ECOCASH")).toBe(true))
    it("accepts VMC", () => expect(validatePaymentProcessor("VMC")).toBe(true))
    it("accepts CASH", () => expect(validatePaymentProcessor("CASH")).toBe(true))
    it("rejects unknown", () => expect(validatePaymentProcessor("BITCOIN")).toBe(false))
  })

  describe("validateAmount", () => {
    it("accepts positive number", () => expect(validateAmount(10)).toBe(true))
    it("accepts decimal", () => expect(validateAmount(19.99)).toBe(true))
    it("rejects zero", () => expect(validateAmount(0)).toBe(false))
    it("rejects negative", () => expect(validateAmount(-5)).toBe(false))
    it("rejects NaN", () => expect(validateAmount(NaN)).toBe(false))
    it("rejects Infinity", () => expect(validateAmount(Infinity)).toBe(false))
  })

  describe("validatePhone", () => {
    it("accepts full international format", () => expect(validatePhone("+263771234567")).toBe(true))
    it("accepts with spaces", () => expect(validatePhone("+263 77 123 4567")).toBe(true))
    it("accepts with dashes", () => expect(validatePhone("+263-77-123-4567")).toBe(true))
    it("rejects missing plus", () => expect(validatePhone("263771234567")).toBe(false))
    it("rejects empty string", () => expect(validatePhone("")).toBe(false))
    it("rejects too short", () => expect(validatePhone("+123")).toBe(false))
  })

  describe("validateSalesOrderPayload", () => {
    it("returns null for valid payload", () => {
      expect(validateSalesOrderPayload({
        currency: "USD", quantity: 2, unitPrice: 25, totalAmount: 50,
      })).toBeNull()
    })

    it("rejects invalid currency", () => {
      expect(validateSalesOrderPayload({
        currency: "EUR", quantity: 1, unitPrice: 10, totalAmount: 10,
      })).toContain("Invalid currency")
    })

    it("rejects non-integer quantity", () => {
      expect(validateSalesOrderPayload({
        currency: "USD", quantity: 1.5, unitPrice: 10, totalAmount: 15,
      })).toContain("positive integer")
    })

    it("rejects mismatched total", () => {
      expect(validateSalesOrderPayload({
        currency: "USD", quantity: 2, unitPrice: 25, totalAmount: 100,
      })).toContain("quantity × unit price")
    })

    it("rejects zero quantity", () => {
      expect(validateSalesOrderPayload({
        currency: "USD", quantity: 0, unitPrice: 10, totalAmount: 0,
      })).toContain("positive integer")
    })
  })

  describe("validateTransactionPayload", () => {
    it("returns null for valid payload", () => {
      expect(validateTransactionPayload({
        amount: 50, processor: "ECOCASH", phone: "+263771234567", currency: "USD",
      })).toBeNull()
    })

    it("rejects invalid processor", () => {
      expect(validateTransactionPayload({
        amount: 50, processor: "PAYPAL", phone: "+263771234567", currency: "USD",
      })).toContain("Invalid payment processor")
    })

    it("rejects bad phone", () => {
      expect(validateTransactionPayload({
        amount: 50, processor: "ECOCASH", phone: "12345", currency: "USD",
      })).toContain("Invalid phone")
    })

    it("rejects zero amount", () => {
      expect(validateTransactionPayload({
        amount: 0, processor: "ECOCASH", phone: "+263771234567", currency: "USD",
      })).toContain("positive number")
    })
  })

  describe("isValidUUID", () => {
    it("accepts a valid UUID v4", () => {
      expect(isValidUUID("550e8400-e29b-41d4-a716-446655440000")).toBe(true)
    })
    it("accepts uppercase hex", () => {
      expect(isValidUUID("550E8400-E29B-41D4-A716-446655440000")).toBe(true)
    })
    it("rejects an email", () => {
      expect(isValidUUID("user@example.com")).toBe(false)
    })
    it("rejects a phone number", () => {
      expect(isValidUUID("+263771234567")).toBe(false)
    })
    it("rejects empty string", () => {
      expect(isValidUUID("")).toBe(false)
    })
    it("rejects too-short string", () => {
      expect(isValidUUID("abc-123")).toBe(false)
    })
    it("rejects null", () => {
      expect(isValidUUID(null as unknown as string)).toBe(false)
    })
  })
})
