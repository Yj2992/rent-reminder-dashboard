import { describe, expect, it } from "vitest"
import { currentUtilityBills, HubBill, utilityMoney, utilitySharePaise, utilityShareRemaining, utilityStage } from "../lib/utilityUi"
const bill = (id: string, extra: Partial<HubBill> = {}): HubBill => ({ id, utility_account_id: "meter", rent_id: "rent", bill_amount_paise: 245050, status: "UNPAID", created_at: id, ...extra })
describe("utility payment presentation", () => {
  it("never offers a new payment for collected, uncertain, legacy or refunded bills", () => {
    expect(utilityStage(bill("1", { collection_status: "COLLECTED", bbps_status: "ENQUEUED" }))).toBe("processing")
    expect(utilityStage(bill("1", { collection_status: "IN_PROGRESS" }))).toBe("checking")
    expect(utilityStage(bill("1", { bill_status: "PAID", bbps_status: "LEGACY_CONFIRMED" }))).toBe("review")
    expect(utilityStage(bill("1", { bbps_status: "REFUNDED" }))).toBe("review")
    expect(utilityStage(bill("1", { bbps_status: "BBPS_SUCCESS" }))).toBe("paid")
  })
  it("hides superseded unpaid fetches but preserves historical receipts and pending payments", () => {
    const rows = [bill("1"), bill("2", { status: "PAID" }), bill("3", { status: "SETTLEMENT_PENDING" }), bill("4"), bill("5", { status: "PAID" })]
    expect(currentUtilityBills(rows).map(b => b.id)).toEqual(["5", "3", "2"])
  })
  it("does not hide a bill just because a newer record was cancelled", () => {
    expect(currentUtilityBills([bill("1"), bill("2", { status: "CANCELLED" })]).map(b => b.id)).toEqual(["2","1"])
  })
  it("keeps paise visible during review", () => { expect(utilityMoney(245050)).toContain("2,450.50") })
  it("splits odd paise without losing or duplicating money", () => {
    expect(utilitySharePaise(10001, "SHARED", "TENANT")).toBe(5001)
    expect(utilitySharePaise(10001, "SHARED", "LANDLORD")).toBe(5000)
    expect(utilityShareRemaining(bill("s", { bill_amount_paise: 10001, tenant_collected_paise: 5001 }), "SHARED", "TENANT")).toBe(0)
  })
})
