export function paymentResult(status?: string | null) {
  switch (status) {
    case "PAID": return { title: "Payment confirmed", detail: "The latest payment status is confirmed as paid.", terminal: true }
    case "PARTIAL":
    case "PARTIALLY_PAID": return { title: "Part payment received", detail: "A balance remains. Review the latest invoice before paying the remainder.", terminal: true }
    case "COLLECTED": return { title: "Payment collected", detail: "Funds are collected. Utility approval and provider confirmation are still pending. Do not pay again.", terminal: true }
    case "PARTIALLY_COLLECTED": return { title: "Part of the bill collected", detail: "The full utility amount has not been collected yet. Review each payer’s share before any further payment.", terminal: true }
    case "FAILED": return { title: "Payment unsuccessful", detail: "This attempt failed. Review the latest invoice and any bank debit before starting another payment.", terminal: true }
    case "RECONCILIATION_REQUIRED": return { title: "Payment needs review", detail: "The outcome needs confirmation. Do not pay again while it is being checked.", terminal: true }
    case "PENDING":
    case "PROCESSING": return { title: "Payment confirmation pending", detail: "Confirmation is pending. Do not start another payment yet.", terminal: false }
    default: return { title: "Payment status not confirmed", detail: "Check the latest status before making another payment.", terminal: false }
  }
}

export function legacyPortalDestination(query: Record<string, string | string[] | undefined>) {
  const token = typeof query.token === "string" ? query.token.trim() : ""
  const order = typeof query.order_id === "string" ? query.order_id.trim() : ""
  if (token) return `/pay/${encodeURIComponent(token)}${order ? `?order_id=${encodeURIComponent(order)}` : ""}`
  // An order ID is a reference, never a bearer token.
  if (order) return `/failed?order_id=${encodeURIComponent(order)}`
  return typeof query.ref === "string" ? `/tenant?ref=${encodeURIComponent(query.ref)}` : "/tenant"
}
