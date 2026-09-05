import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"

describe("FI-004 browser payment boundary", () => {
  const payPage = readFileSync("pages/pay/[tenantId].tsx", "utf8")
  const successPage = readFileSync("pages/success.tsx", "utf8")

  it("does not call browser financial verification endpoints", () => {
    expect(payPage).not.toContain("/payments/verify-cashfree")
    expect(payPage).not.toContain("PAYMENTS_VERIFY_PATH")
    expect(payPage).toContain("/success?")
  })

  it("polls authoritative status with an opaque token and matching order", () => {
    expect(successPage).toContain("/public/payments/status?token=")
    expect(successPage).toContain("order_id=")
  })

  it("shows processing before committed paid state", () => {
    expect(successPage).toContain('paid ? "Payment confirmed" : "Payment processing"')
    expect(successPage).toContain("Payment received by gateway. Confirming payment…")
    expect(successPage).not.toContain(">Payment successful<")
  })

  it("bounds polling and leaves delayed confirmation pending", () => {
    expect(successPage).toContain("attempts < 8")
    expect(successPage).toContain("remains pending reconciliation")
  })
})
