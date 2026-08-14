import { describe, expect, it } from "vitest"
import {
  actionToReviewedStatus,
  canonicalPaymentStatus,
  markReadStatus,
  resolveInvoiceStatusLabel,
} from "../lib/sharedRules"

describe("tenant payment lifecycle", () => {
  it("only marks a confirmed payment as paid", () => {
    expect(resolveInvoiceStatusLabel({ paymentStatus: "PAID" })).toBe("Paid")
    expect(resolveInvoiceStatusLabel({ manualPaymentStatus: "SUBMITTED" })).toBe("Under review")
    expect(resolveInvoiceStatusLabel({ paymentStatus: "FAILED" })).toBe("Failed")
    expect(resolveInvoiceStatusLabel({ paymentStatus: "CREATED" })).toBe("Pending")
  })

  it("normalizes unknown gateway states safely to pending", () => {
    expect(canonicalPaymentStatus("processing")).toBe("PENDING")
    expect(canonicalPaymentStatus(undefined)).toBe("PENDING")
  })

  it("preserves resolved notifications when marking them read", () => {
    expect(actionToReviewedStatus("APPROVE")).toBe("APPROVED")
    expect(markReadStatus("DECLINED")).toBe("DECLINED")
    expect(markReadStatus("NEW")).toBe("READ")
  })
})
