const generatedModule = require("rentomatic-shared-rules-generated")

const rules =
  generatedModule?.default?.com?.rentomatic?.shared?.domain?.RentomaticSharedRulesJs ??
  generatedModule?.com?.rentomatic?.shared?.domain?.RentomaticSharedRulesJs

if (!rules) {
  throw new Error("Rentomatic shared rules JS export is unavailable.")
}

export const PAYMENT_STATUS_PAID = rules.paymentStatusPaid
export const PAYMENT_STATUS_FAILED = rules.paymentStatusFailed
export const PAYMENT_STATUS_PENDING = rules.paymentStatusPending

export const MANUAL_PAYMENT_STATUS_SUBMITTED = rules.manualPaymentStatusSubmitted
export const MANUAL_PAYMENT_STATUS_APPROVED = rules.manualPaymentStatusApproved
export const MANUAL_PAYMENT_STATUS_DECLINED = rules.manualPaymentStatusDeclined

export const ACTION_APPROVE = rules.actionApprove
export const ACTION_DECLINE = rules.actionDecline
export const STATUS_APPROVED = rules.statusApproved
export const STATUS_DECLINED = rules.statusDeclined
export const STATUS_READ = rules.statusRead
export const OWNER_BACKEND_BASE_URL = rules.ownerBackendBaseUrl
export const TENANT_PORTAL_BASE_URL = rules.tenantPortalBaseUrl
export const PUBLIC_INVOICES_PATH = rules.publicInvoicesPath
export const PAYMENTS_CREATE_ORDER_PATH = rules.paymentsCreateOrderPath
export const PAYMENTS_VERIFY_PATH = rules.paymentsVerifyPath
export const PAYMENTS_MANUAL_PROOF_PATH = rules.paymentsManualProofPath
export const PAYMENTS_MANUAL_PROOF_REVIEW_PATH = rules.paymentsManualProofReviewPath
export const PAYMENTS_SYNC_PAID_INVOICES_PATH = rules.paymentsSyncPaidInvoicesPath
export const PAYMENTS_HISTORY_PATH = rules.paymentsHistoryPath
export const SEND_INVOICE_UPLOAD_PATH = rules.sendInvoiceUploadPath
export const NOTIFICATIONS_DEVICE_TOKEN_PATH = rules.notificationsDeviceTokenPath
export const NOTIFICATIONS_OWNER_ALERTS_PATH = rules.notificationsOwnerAlertsPath
export const NOTIFICATIONS_OWNER_ALERTS_READ_PATH = rules.notificationsOwnerAlertsReadPath

export function canonicalPaymentStatus(value) {
  return rules.canonicalPaymentStatus(value)
}

export function normalizeManualPaymentStatus(value) {
  return rules.normalizeManualPaymentStatus(value)
}

export function isManualPaymentUnderReview(value) {
  return rules.isManualPaymentUnderReview(value)
}

export function isManualPaymentApproved(value) {
  return rules.isManualPaymentApproved(value)
}

export function isManualPaymentDeclined(value) {
  return rules.isManualPaymentDeclined(value)
}

export function hasConfirmedPayment(input) {
  return rules.hasConfirmedPayment(
    input?.paymentStatus,
    input?.paidAt,
    input?.manualPaymentStatus
  )
}

export function hasFailedPayment(input) {
  return rules.hasFailedPayment(
    input?.paymentStatus,
    input?.manualPaymentStatus
  )
}

export function readableManualPaymentStatus(value) {
  return rules.readableManualPaymentStatus(value)
}

export function resolveInvoiceStatusLabel(input) {
  return rules.resolveInvoiceStatusLabel(
    input?.paymentStatus,
    input?.paidAt,
    input?.manualPaymentStatus,
    Boolean(input?.alreadyPaid)
  )
}

export function normalizeReviewedStatus(value) {
  return rules.normalizeReviewedStatus(value)
}

export function actionToReviewedStatus(action) {
  return rules.actionToReviewedStatus(action)
}

export function actionFallbackMessage(action) {
  return rules.actionFallbackMessage(action)
}

export function reviewedTitle(status, fallback) {
  return rules.reviewedTitle(status, fallback)
}

export function reviewedMessage(status, customMessage, fallback = "") {
  return rules.reviewedMessage(status, customMessage, fallback)
}

export function isResolvedStatus(status) {
  return rules.isResolvedStatus(status)
}

export function isResolvedReviewStatus(status) {
  return rules.isResolvedReviewStatus(status)
}

export function markReadStatus(currentStatus) {
  return rules.markReadStatus(currentStatus)
}

export function resolvedStatusFromHistory(history) {
  return (
    rules.resolvedStatusFromHistory(
      history?.manualPaymentStatus,
      history?.manualPaymentMethod,
      history?.manualPaymentProofUrl,
      history?.paidAt,
      history?.paymentStatus
    ) || null
  )
}

export function reminderTypeLabel(reminderType) {
  return rules.reminderTypeLabel(reminderType)
}
