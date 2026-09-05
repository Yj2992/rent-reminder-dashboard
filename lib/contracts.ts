export type {
  TenantPortalActionResult,
  TenantPortalInvoice,
  TenantPortalManualProofResult,
  TenantPortalOwnerAlertItem,
  TenantPortalOwnerAlertsResponse,
  TenantPortalPaymentHistoryInvoice,
  TenantPortalPaymentHistoryResponse,
  TenantPortalReminderSettings,
} from "./generatedSharedContracts"

export type TenantPortalPaymentOrder = {
  keyId: string
  orderId: string
  amount: number
  currency: string
  invoiceId: string
  tenantName: string
  description: string
  gateway?: string
  paymentSessionId?: string | null
  cfOrderToken?: string | null
  environment?: string
  customerPhone?: string | null
  customerEmail?: string | null
}

export type TenantPortalPaymentStatus = {
  status: "PAID" | "PENDING" | "FAILED" | "RECONCILIATION_REQUIRED" | string
  invoiceId?: string | null
  orderId?: string | null
  amount?: number | null
  currency?: string | null
  paidAt?: string | null
  receiptUrl?: string | null
  message?: string | null
}
