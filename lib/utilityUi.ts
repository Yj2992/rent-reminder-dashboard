export type Service = "ELECTRICITY" | "WATER" | "GAS"
export type HubAccount = { id: string; rent_id: string; utility_type: Service; operator_name: string; consumer_number: string; active?: boolean; property_name?: string; responsibility?: string | null }
export type HubBill = { id: string; utility_account_id: string; rent_id: string; bill_amount_paise: number; due_date?: string | null; created_at?: string; status?: string; bill_status?: string; collection_status?: string; bbps_status?: string; billing_period?: string | null; consumer_name?: string | null; provider_txn_id?: string | null; bbps_ref_id?: string | null; responsibility?: string | null; collected_amount_paise?: number; tenant_collected_paise?: number; landlord_collected_paise?: number }
export type UtilityPayerRole = "TENANT" | "LANDLORD"
export function utilitySharePaise(total: number, responsibility: string | null | undefined, payer: UtilityPayerRole) {
  if (responsibility === "SHARED") return payer === "TENANT" ? Math.ceil(total / 2) : Math.floor(total / 2)
  return total
}
export function utilityShareRemaining(bill: HubBill, responsibility: string | null | undefined, payer: UtilityPayerRole) {
  const paid = payer === "TENANT" ? bill.tenant_collected_paise || 0 : bill.landlord_collected_paise || 0
  return Math.max(0, utilitySharePaise(bill.bill_amount_paise, responsibility, payer) - paid)
}
export type BillStage = "due" | "checking" | "processing" | "paid" | "review" | "cancelled"
export function utilityStage(bill: HubBill): BillStage {
  if (bill.bbps_status === "BBPS_SUCCESS") return "paid"
  if (bill.bbps_status === "LEGACY_CONFIRMED") return "review"
  if (bill.status === "CANCELLED" || bill.bill_status === "CANCELLED") return "cancelled"
  if (["BBPS_FAILED", "REFUNDED"].includes(bill.bbps_status || "") || ["REFUNDED", "REVIEW_REQUIRED"].includes(bill.status || "") || bill.collection_status === "REFUNDED" || bill.bill_status === "MANUAL_REVIEW") return "review"
  if (bill.collection_status === "COLLECTED" || ["ENQUEUED", "WAITING_FOR_FLOAT", "BALANCE_CHECK_FAILED", "PROCESSING", "RECONCILIATION_REQUIRED", "REFUND_PENDING"].includes(bill.bbps_status || "") || bill.status === "SETTLEMENT_PENDING") return "processing"
  if (!bill.bbps_status && (bill.status === "PAID" || bill.bill_status === "PAID")) return "paid"
  if (bill.status === "PAID" || bill.bill_status === "PAID") return "review"
  if (bill.collection_status === "IN_PROGRESS" || bill.status === "PAYMENT_PENDING") return "checking"
  if ((!bill.bbps_status || bill.bbps_status === "IDLE") && (["PENDING", "FAILED"].includes(bill.collection_status || "") || ["UNPAID", "OVERDUE"].includes(bill.status || "")) && bill.bill_amount_paise > 0) return "due"
  return "review"
}
export const stageCopy: Record<BillStage, { label: string; detail: string }> = {
  due: { label: "Ready to pay", detail: "Review the bill, then continue to secure checkout. Rentomatic collects your payment and approves payment to the utility provider." },
  checking: { label: "Checking payment", detail: "A checkout is already open. If money was debited, refresh and wait for confirmation. If you did not complete payment, you can resume the existing checkout." },
  processing: { label: "Payment received", detail: "Your collection is recorded. Rentomatic is handling approval and provider confirmation. No additional payment is needed." },
  paid: { label: "Paid", detail: "This bill is recorded as paid. Download the available payment confirmation below." },
  review: { label: "Needs review", detail: "This bill needs a status review. Contact your property manager or Rentomatic support before paying again." },
  cancelled: { label: "Cancelled", detail: "This bill was cancelled and cannot be paid." },
}
export function currentUtilityBills(bills: HubBill[]) {
  const seen = new Set<string>()
  return [...bills].sort((a,b) => (b.created_at || "").localeCompare(a.created_at || "")).filter(bill => {
    const key = bill.utility_account_id || bill.id
    const newerExists = seen.has(key)
    if (utilityStage(bill) === "cancelled") return true
    seen.add(key)
    return utilityStage(bill) !== "due" || !newerExists
  })
}
export const utilityMoney = (paise: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(paise / 100)
export function utilityDate(value?: string | null) {
  if (!value) return "Date unavailable"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
}
