// Generated from RentomaticKMP shared Kotlin contracts.

// Run `npm run shared:sync-contracts` to refresh this file.



export type TenantPortalActionResult = {
  ok?: boolean | null
  invoiceId?: string | null
  status?: string | null
  message?: string | null
}

export type TenantPortalInvoice = {
  invoiceId: string
  tenantName: string
  tenantEmail?: string | null
  companyName?: string | null
  dueDate?: string | null
  invoiceNumber?: string | null
  amount: number
  currency?: string
  status: string
  publicUrl?: string | null
  paymentUrl?: string | null
  alreadyPaid?: boolean
  bankName?: string | null
  accountNumber?: string | null
  branchName?: string | null
  ifsc?: string | null
  upi?: string | null
  manualPaymentStatus?: string | null
  manualPaymentReviewNote?: string | null
  manualPaymentMethod?: string | null
}

export type TenantPortalPaymentOrder = {
  gateway?: "CASHFREE" | "RAZORPAY" | string
  keyId?: string
  orderId: string
  paymentSessionId?: string | null
  amount: number
  currency: string
  invoiceId: string
  tenantName: string
  description: string
  customerPhone?: string | null
  customerEmail?: string | null
  environment?: "PRODUCTION" | "SANDBOX" | string
}

export type TenantPortalManualProofResult = {
  ok: boolean
  invoiceId?: string | null
  status?: string | null
  message?: string | null
  proofUrl?: string | null
}

export type TenantPortalOwnerAlertItem = {
  id: string
  kind?: string
  status?: string
  invoiceId: string
  invoiceNumber?: string | null
  tenantName?: string | null
  tenantEmail?: string | null
  title: string
  message: string
  manualPaymentMethod?: string | null
  manualPaymentReviewNote?: string | null
  createdAt?: string | null
  readAt?: string | null
}

export type TenantPortalOwnerAlertsResponse = {
  alerts?: TenantPortalOwnerAlertItem[]
}

export type TenantPortalReminderSettings = {
  userId?: string | null
  threeDaysBefore?: boolean
  onDueDate?: boolean
  fiveDaysAfter?: boolean
  serverReady?: boolean
  statusMessage?: string | null
  updatedAt?: string | null
  lastRunAt?: string | null
  lastRunSent?: number
  lastRunSkipped?: number
  lastRunFailed?: number
  lastRunDryRun?: boolean
  lastRunSummary?: string | null
}

export type TenantPortalPaymentHistoryTimelineEvent = {
  key?: string | null
  title?: string | null
  detail?: string | null
  status?: string | null
  timestamp?: string | null
}

export type TenantPortalPaymentHistoryInvoice = {
  invoiceId?: string | null
  rentId?: string | null
  tenantName?: string | null
  tenantEmail?: string | null
  reminderType?: string | null
  sentAt?: string | null
  openedAt?: string | null
  invoiceOpenedEvents?: string[]
  dueDate?: string | null
  invoiceNumber?: string | null
  amount?: number | null
  currency?: string | null
  status?: string | null
  paymentStatus?: string | null
  invoiceFileName?: string | null
  invoiceContentHash?: string | null
  publicUrl?: string | null
  paymentUrl?: string | null
  paymentToken?: string | null
  razorpayOrderId?: string | null
  razorpayPaymentId?: string | null
  paidAt?: string | null
  paidInvoiceSentAt?: string | null
  paidInvoiceOpenedAt?: string | null
  paidInvoiceOpenedEvents?: string[]
  paidInvoiceEmailStatus?: string | null
  manualPaymentMethod?: string | null
  manualPaymentStatus?: string | null
  manualPaymentSubmittedAt?: string | null
  manualPaymentReviewedAt?: string | null
  manualPaymentReviewNote?: string | null
  manualPaymentProofUrl?: string | null
  timelineEvents?: TenantPortalPaymentHistoryTimelineEvent[]
  createdAt?: string | null
  updatedAt?: string | null
}

export type TenantPortalPaymentHistoryResponse = {
  invoices?: TenantPortalPaymentHistoryInvoice[]
}

