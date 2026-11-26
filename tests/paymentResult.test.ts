import { describe, expect, it } from "vitest"
import { legacyPortalDestination, paymentResult } from "../lib/paymentResult"

describe("payment result states", () => {
  it.each(["PAID", "PARTIAL", "PARTIALLY_PAID", "COLLECTED", "PARTIALLY_COLLECTED", "FAILED", "RECONCILIATION_REQUIRED"])("stops polling for %s", (status) => {
    expect(paymentResult(status).terminal).toBe(true)
  })
  it("does not present unknown or pending states as paid", () => {
    for (const status of [undefined, "PENDING", "PROCESSING", "unexpected"]) {
      expect(paymentResult(status).terminal).toBe(false)
      expect(paymentResult(status).title).not.toBe("Payment confirmed")
    }
  })
  it("distinguishes collection from provider settlement", () => {
    expect(paymentResult("COLLECTED").detail).toContain("provider confirmation")
    expect(paymentResult("PARTIALLY_COLLECTED").title).not.toBe(paymentResult("COLLECTED").title)
  })
})
describe("legacy payment destinations", () => {
  it("preserves and encodes token and order separately", () => {
    expect(legacyPortalDestination({token:"a/b",order_id:"order&1"})).toBe("/pay/a%2Fb?order_id=order%261")
  })
  it("never upgrades an order reference into an access token", () => {
    expect(legacyPortalDestination({order_id:"order-1"})).toBe("/failed?order_id=order-1")
  })
  it("rejects ambiguous token arrays and keeps destinations internal", () => {
    expect(legacyPortalDestination({token:["a","b"]})).toBe("/tenant")
    expect(legacyPortalDestination({ref:"https://example.com"})).toBe("/tenant?ref=https%3A%2F%2Fexample.com")
  })
})
