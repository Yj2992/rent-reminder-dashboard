export const PAYMENT_STATUS_PAID = "PAID"
export const PAYMENT_STATUS_FAILED = "FAILED"
export const PAYMENT_STATUS_PENDING = "PENDING"
export const MANUAL_PAYMENT_STATUS_SUBMITTED = "SUBMITTED"
export const MANUAL_PAYMENT_STATUS_APPROVED = "APPROVED"
export const MANUAL_PAYMENT_STATUS_DECLINED = "DECLINED"
export const ACTION_APPROVE = "APPROVE"
export const ACTION_DECLINE = "DECLINE"
export const STATUS_APPROVED = "APPROVED"
export const STATUS_DECLINED = "DECLINED"
export const STATUS_READ = "READ"
export const OWNER_BACKEND_BASE_URL = "https://ktor-sendgrid-backend.onrender.com"
export const TENANT_PORTAL_BASE_URL = "https://rentomatic.in"
export const PUBLIC_INVOICES_PATH = "/public/invoices"
export const PAYMENTS_CREATE_ORDER_PATH = "/payments/create-order"
export const PAYMENTS_VERIFY_PATH = "/payments/verify"
export const PAYMENTS_MANUAL_PROOF_PATH = "/payments/manual-proof"
export const PAYMENTS_MANUAL_PROOF_REVIEW_PATH = "/payments/manual-proof/review"
export const PAYMENTS_SYNC_PAID_INVOICES_PATH = "/payments/sync-paid-invoices"
export const PAYMENTS_HISTORY_PATH = "/payments/history"
export const SEND_INVOICE_UPLOAD_PATH = "/send-invoice-upload"
export const NOTIFICATIONS_DEVICE_TOKEN_PATH = "/notifications/device-token"
export const NOTIFICATIONS_OWNER_ALERTS_PATH = "/notifications/owner-alerts"
export const NOTIFICATIONS_OWNER_ALERTS_READ_PATH = "/notifications/owner-alerts/read"

const upper = value => String(value || "").trim().toUpperCase().replace(/\s+/g, "_")
export const canonicalPaymentStatus = value => [PAYMENT_STATUS_PAID, PAYMENT_STATUS_FAILED].includes(upper(value)) ? upper(value) : PAYMENT_STATUS_PENDING
export const normalizeManualPaymentStatus = value => upper(value)
export const isManualPaymentUnderReview = value => normalizeManualPaymentStatus(value) === MANUAL_PAYMENT_STATUS_SUBMITTED
export const isManualPaymentApproved = value => normalizeManualPaymentStatus(value) === MANUAL_PAYMENT_STATUS_APPROVED
export const isManualPaymentDeclined = value => normalizeManualPaymentStatus(value) === MANUAL_PAYMENT_STATUS_DECLINED
export const hasConfirmedPayment = input => canonicalPaymentStatus(input?.paymentStatus) === PAYMENT_STATUS_PAID || Boolean(input?.paidAt) || isManualPaymentApproved(input?.manualPaymentStatus)
export const hasFailedPayment = input => canonicalPaymentStatus(input?.paymentStatus) === PAYMENT_STATUS_FAILED || isManualPaymentDeclined(input?.manualPaymentStatus)
export const readableManualPaymentStatus = value => ({ SUBMITTED: "Payment under review", APPROVED: "Payment approved", DECLINED: "Payment declined" }[normalizeManualPaymentStatus(value)] || "")
export function resolveInvoiceStatusLabel(input) { if (input?.alreadyPaid || hasConfirmedPayment(input)) return "Paid"; if (isManualPaymentUnderReview(input?.manualPaymentStatus)) return "Under review"; if (hasFailedPayment(input)) return "Failed"; return "Pending" }
export const normalizeReviewedStatus = value => upper(value)
export const actionToReviewedStatus = action => upper(action) === ACTION_APPROVE ? STATUS_APPROVED : STATUS_DECLINED
export const actionFallbackMessage = action => upper(action) === ACTION_APPROVE ? "Payment approved." : "Payment declined."
export const reviewedTitle = (status, fallback) => normalizeReviewedStatus(status) === STATUS_APPROVED ? "Payment approved" : normalizeReviewedStatus(status) === STATUS_DECLINED ? "Payment declined" : fallback
export const reviewedMessage = (status, customMessage, fallback = "") => customMessage || reviewedTitle(status, fallback)
export const isResolvedStatus = status => [STATUS_APPROVED, STATUS_DECLINED, STATUS_READ].includes(upper(status))
export const isResolvedReviewStatus = status => [STATUS_APPROVED, STATUS_DECLINED].includes(upper(status))
export const markReadStatus = currentStatus => isResolvedStatus(currentStatus) ? currentStatus : STATUS_READ
export const resolvedStatusFromHistory = history => hasConfirmedPayment(history) ? STATUS_APPROVED : hasFailedPayment(history) ? STATUS_DECLINED : null
export const reminderTypeLabel = value => ({ THREE_DAYS_BEFORE: "3 days before", ON_DUE_DATE: "On due date", FIVE_DAYS_AFTER: "5 days overdue" }[upper(value)] || String(value || "Reminder"))
