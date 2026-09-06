import { useEffect, useMemo, useRef, useState } from "react"
import axios from "axios"
import { useRouter } from "next/router"
import { TenantPortalInvoice, TenantPortalPaymentOrder } from "../../lib/contracts"
import {
  OWNER_BACKEND_BASE_URL,
  PAYMENTS_CREATE_ORDER_PATH,
  PAYMENTS_MANUAL_PROOF_PATH,
  PUBLIC_INVOICES_PATH,
  canonicalPaymentStatus,
  isManualPaymentApproved,
  isManualPaymentDeclined,
  isManualPaymentUnderReview,
  readableManualPaymentStatus,
  resolveInvoiceStatusLabel,
} from "../../lib/sharedRules"

const backendBaseUrl =
  process.env.NEXT_PUBLIC_BACKEND_BASE_URL || OWNER_BACKEND_BASE_URL

function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("Not in browser"))
    if ((window as any).Razorpay) return resolve()
    const script = document.createElement("script")
    script.src = "https://checkout.razorpay.com/v1/checkout.js"
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error("Failed to load Razorpay script"))
    document.body.appendChild(script)
  })
}

function loadCashfreeScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("Not in browser"))
    if ((window as any).loadCashfree || (window as any).Cashfree) return resolve()
    const script = document.createElement("script")
    script.src = "https://sdk.cashfree.com/js/v3/cashfree.js"
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error("Failed to load Cashfree checkout SDK"))
    document.body.appendChild(script)
  })
}

function newPaymentAttemptKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `checkout-${crypto.randomUUID()}`
  }
  return `checkout-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function formatAmount(amountPaise: number, currency: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amountPaise / 100)
}

function paymentMethodLabel(method: string) {
  switch (method) {
    case "UPI":
      return "UPI"
    case "NEFT_RTGS":
      return "NEFT / RTGS"
    default:
      return "Bank transfer"
  }
}

function paymentErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const responseData = error.response?.data
    if (typeof responseData === "string" && responseData.trim()) {
      return responseData
    }
    if (responseData && typeof responseData === "object" && "message" in responseData) {
      const message = (responseData as { message?: unknown }).message
      if (typeof message === "string" && message.trim()) {
        return message
      }
    }
    return error.message || "Could not start payment. Please try again."
  }

  if (error instanceof Error) {
    return error.message
  }

  return "Could not start payment. Please check your connection and try again."
}

export default function PayPage() {
  const router = useRouter()
  const { tenantId, order_id } = router.query
  const rawToken = Array.isArray(tenantId) ? tenantId[0] : tenantId
  const token = useMemo(() => {
    if (!rawToken) return ""
    const decoded = decodeURIComponent(rawToken)
    return decoded
      .replace(/^\{\{1\}\}/, "")
      .replace(/^%7B%7B1%7D%7D/i, "")
      .replace(/^\{\{.*?\}\}/, "")
      .trim()
  }, [rawToken])
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)
  const [uploadingProof, setUploadingProof] = useState(false)
  const [invoice, setInvoice] = useState<TenantPortalInvoice | null>(null)
  const [error, setError] = useState("")
  const [manualMethod, setManualMethod] = useState("UPI")
  const [manualNote, setManualNote] = useState("")
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [manualMessage, setManualMessage] = useState("")
  const [partialRupees,setPartialRupees]=useState("")
  const paymentAttempt = useRef<{ key: string; amount?: number } | null>(null)

  const manualReviewStatus = invoice?.manualPaymentStatus?.trim().toUpperCase() || ""
  const paymentStatus = canonicalPaymentStatus(invoice?.status)
  const manualReviewPending = isManualPaymentUnderReview(invoice?.manualPaymentStatus)
  const manualReviewApproved = isManualPaymentApproved(invoice?.manualPaymentStatus)
  const manualReviewDeclined = isManualPaymentDeclined(invoice?.manualPaymentStatus)
  const paid = Boolean(invoice?.alreadyPaid) || manualReviewApproved || paymentStatus === "PAID"
  const statusLabel = resolveInvoiceStatusLabel({
    paymentStatus: invoice?.status,
    manualPaymentStatus: invoice?.manualPaymentStatus,
    alreadyPaid: invoice?.alreadyPaid,
  })
  const manualStatusLabel = readableManualPaymentStatus(invoice?.manualPaymentStatus)
  const amountText = useMemo(
    () => (invoice ? formatAmount(invoice.amount, invoice.currency) : ""),
    [invoice]
  )

  useEffect(() => {
    if (!token) return
    setLoading(true)
    setError("")
    axios
      .get(`${backendBaseUrl}${PUBLIC_INVOICES_PATH}/${encodeURIComponent(token)}`)
      .then((response) => {
        setInvoice(response.data)

        // FI-004: provider return only moves the browser to authoritative status polling.
        if (order_id && typeof order_id === "string") {
          router.push(`/success?invoice=${encodeURIComponent(response.data.invoiceId)}&token=${encodeURIComponent(token)}&order_id=${encodeURIComponent(order_id)}`)
        }
      })
      .catch(() => setError("This payment link is invalid or no longer available."))
      .finally(() => setLoading(false))
  }, [token, order_id])

  async function refreshInvoice() {
    if (!token) return
    setLoading(true)
    setError("")
    try {
      const response = await axios.get(`${backendBaseUrl}${PUBLIC_INVOICES_PATH}/${encodeURIComponent(token)}`)
      setInvoice(response.data)
    } catch {
      setError("This payment link is invalid or no longer available.")
    } finally {
      setLoading(false)
    }
  }

  async function startPayment() {
    if (!token || !invoice || paid) return

    setPaying(true)
    setError("")

    try {
      const requestedAmount = partialRupees ? Math.round(Number(partialRupees) * 100) : undefined
      if (requestedAmount != null && (!Number.isFinite(requestedAmount) || requestedAmount <= 0 || requestedAmount > invoice.amount)) {
        throw new Error("Enter a partial amount up to the outstanding balance.")
      }
      if (!paymentAttempt.current || paymentAttempt.current.amount !== requestedAmount) {
        paymentAttempt.current = { key: newPaymentAttemptKey(), amount: requestedAmount }
      }
      const createRes = await axios.post<TenantPortalPaymentOrder>(`${backendBaseUrl}${PAYMENTS_CREATE_ORDER_PATH}`, {
        token,
        amount: requestedAmount,
        idempotencyKey: paymentAttempt.current.key,
      })
      const order = createRes.data

      if (order.gateway === "CASHFREE" && order.paymentSessionId) {
        // --- 1. CASHFREE PRIMARY CHECKOUT ---
        await loadCashfreeScript()
        const isSandbox = order.environment?.toUpperCase() === "SANDBOX"
        const cashfree = (window as any).Cashfree({ mode: isSandbox ? "sandbox" : "production" })

        cashfree.checkout({
          paymentSessionId: order.paymentSessionId,
          redirectTarget: "_modal",
        }).then((result: any) => {
          if (result.error) {
            setPaying(false)
            setError(result.error.message || "Cashfree payment was cancelled or failed.")
          }
          if (result.paymentDetails) {
            router.push(`/success?invoice=${encodeURIComponent(order.invoiceId)}&token=${encodeURIComponent(token)}&order_id=${encodeURIComponent(order.orderId)}`)
          }
        })
      } else {
        // --- 2. RAZORPAY FALLBACK CHECKOUT ---
        await loadRazorpayScript()

        const options: any = {
          key: order.keyId,
          amount: order.amount,
          currency: order.currency,
          name: invoice.companyName || "Rentomatic",
          description: order.description,
          order_id: order.orderId,
          handler: async function () {
            await router.push(`/success?invoice=${encodeURIComponent(order.invoiceId)}&token=${encodeURIComponent(token)}&order_id=${encodeURIComponent(order.orderId)}`)
          },
          prefill: {
            name: invoice.tenantName || "",
            email: invoice.tenantEmail || "",
          },
          notes: {
            invoice_id: invoice.invoiceId,
            invoice_number: invoice.invoiceNumber || "",
          },
          theme: { color: "#1f6ad8" },
          method: { upi: true, card: true, wallet: true, netbanking: true },
          retry: { enabled: true, max_count: 2 },
          modal: {
            ondismiss: () => setPaying(false),
          },
        }

        const checkout = new (window as any).Razorpay(options)
        checkout.on("payment.failed", () => {
          setPaying(false)
          setError("Payment was not completed. Please retry or use another payment method.")
        })
        checkout.open()
      }
    } catch (error) {
      setError(paymentErrorMessage(error))
      setPaying(false)
    }
  }

  async function submitManualProof() {
    if (!token || !invoice || paid || !proofFile) return

    setUploadingProof(true)
    setError("")
    setManualMessage("")

    try {
      const formData = new FormData()
      formData.append("token", token)
      formData.append("method", manualMethod)
      if (manualNote.trim()) {
        formData.append("note", manualNote.trim())
      }
      formData.append("proof", proofFile)

      const response = await axios.post(`${backendBaseUrl}${PAYMENTS_MANUAL_PROOF_PATH}`, formData)
      setManualMessage(response.data?.message || "Payment proof uploaded. Your landlord will review it.")
      setProofFile(null)
      setManualNote("")
      await refreshInvoice()
    } catch {
      setError("Could not upload payment proof. Please try again with a clear screenshot.")
    } finally {
      setUploadingProof(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f4f7fb] px-4 py-6 text-[#182133]">
        <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-3xl items-center justify-center">
          <div className="w-full max-w-md rounded-3xl border border-[#d8e1ee] bg-white p-8 shadow-sm">
            <div className="mb-5 h-3 w-28 rounded-full bg-[#e8eef6]" />
            <div className="mb-3 h-8 w-3/4 rounded-xl bg-[#eff6ff]" />
            <div className="mb-6 h-4 w-1/2 rounded bg-[#f4f7fb]" />
            <div className="space-y-3 rounded-2xl border border-[#e8eef6] bg-[#f8fafd] p-4">
              <div className="h-4 w-full rounded bg-[#e2eaf5]" />
              <div className="h-4 w-5/6 rounded bg-[#e2eaf5]" />
              <div className="h-4 w-2/3 rounded bg-[#e2eaf5]" />
            </div>
            <p className="mt-5 text-sm text-[#60708d] text-center font-medium">Loading secure invoice…</p>
          </div>
        </div>
      </main>
    )
  }

  if (error && !invoice) {
    return (
      <main className="min-h-screen bg-[#f4f7fb] px-4 py-6 text-[#182133]">
        <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-3xl items-center justify-center">
          <section className="w-full max-w-md rounded-3xl border border-[#f8c8c2] bg-white p-8 text-center shadow-lg">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-[#c53b27]">Payment link unavailable</p>
            <h1 className="text-2xl font-extrabold text-[#182133]">This link cannot be opened</h1>
            <p className="mt-3 text-sm text-[#60708d]">{error}</p>
            <button
              onClick={refreshInvoice}
              className="mt-6 w-full rounded-2xl bg-[#1f6ad8] px-4 py-3.5 font-bold text-white transition hover:bg-[#1756b5] shadow-xs active:scale-[0.99]"
            >
              Try again
            </button>
            <p className="mt-4 text-xs text-[#7384a2]">Ask the property manager to resend the latest payment link.</p>
          </section>
        </div>
      </main>
    )
  }

  if (!invoice) return null

  const isUtilityBill = Boolean(
    invoice?.invoiceNumber?.startsWith("EBILL-") ||
    invoice?.companyName?.toLowerCase().includes("electricity") ||
    token.startsWith("util_")
  )

  return (
    <main className="min-h-screen bg-[#f4f7fb] text-[#182133]">
      <header className="border-b border-[#d8e1ee] bg-white sticky top-0 z-30 shadow-2xs">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1f6ad8] font-bold text-white shadow-xs">
              {isUtilityBill ? "⚡" : "R"}
            </span>
            <div>
              <p className="text-base font-bold text-[#182133] leading-tight">
                {isUtilityBill ? (invoice.companyName || "Electricity Board") : (invoice.companyName || "Rentomatic")}
              </p>
              <p className="text-xs text-[#60708d]">
                {isUtilityBill ? "Bharat Connect • BBPS Verified Utility Desk" : "Secure Rent & Property Desk"}
              </p>
            </div>
          </div>
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
            isUtilityBill 
              ? "border-[#bfdbfe] bg-[#eff6ff] text-[#1e40af]" 
              : "border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d]"
          }`}>
            <span className={`h-2 w-2 rounded-full ${isUtilityBill ? "bg-[#1f6ad8]" : "bg-[#15803d]"}`} />
            {isUtilityBill ? "BBPS Instant Settlement" : "1-Click UPI Checkout"}
          </span>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_380px]">
        <section className="rounded-3xl border border-[#d8e1ee] bg-white p-6 sm:p-7 shadow-xs">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <span className="inline-block text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-lg bg-[#eff6ff] text-[#1f6ad8] border border-[#bfdbfe]">
                {isUtilityBill ? "Electricity Bill" : (invoice.invoiceNumber || "Rent Statement")}
              </span>
              <h1 className="mt-2.5 text-3xl font-extrabold tracking-tight text-[#182133]">
                {invoice.tenantName || "Valued Customer"}
              </h1>
              <p className="mt-1.5 text-sm font-medium text-[#60708d]">
                {isUtilityBill ? "Biller: " : "Payee: "}
                <span className="font-semibold text-[#182133]">{invoice.companyName || "Rentomatic"}</span>
              </p>
              {invoice.tenantEmail && (
                <p className="mt-1 text-xs text-[#60708d]">{invoice.tenantEmail}</p>
              )}
            </div>
            <div
              className={`w-fit rounded-full px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider ${
                paid
                  ? "bg-[#dcfce7] text-[#15803d] border border-[#86efac]"
                  : statusLabel === "Under review"
                  ? "bg-[#eff6ff] text-[#1e40af] border border-[#bfdbfe]"
                  : statusLabel === "Failed"
                  ? "bg-[#fee2e2] text-[#dc2626] border border-[#fca5a5]"
                  : "bg-[#fffbeb] text-[#b45309] border border-[#fde68a]"
              }`}
            >
              {paid ? "✓ SETTLED & PAID" : statusLabel}
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <InfoTile label="Total Payable" value={amountText} strong />
            <InfoTile label="Due Date" value={invoice.dueDate || "Due on presentation"} />
            <InfoTile label={isUtilityBill ? "Consumer Number" : "Invoice Ref"} value={isUtilityBill ? invoice.invoiceNumber?.replace("EBILL-", "") || invoice.invoiceId : invoice.invoiceId} compact />
          </div>

          <div className="mt-6 rounded-2xl border border-[#d8e8fe] bg-gradient-to-br from-[#f8fafd] to-[#f0f7ff] p-5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#1e40af]">
              {isUtilityBill ? "⚡ BBPS Settlement Assurance" : "Payment Verification Steps"}
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <TrustStep 
                title={isUtilityBill ? "1. Verified Bill" : "1. Review Amount"} 
                text={isUtilityBill ? "Fetched live from State DISCOM via BBPS." : "Check monthly rent & details."} 
                active 
              />
              <TrustStep
                title={isUtilityBill ? "2. Instant Clearing" : "2. Choose Method"}
                text={isUtilityBill ? "Directly credited to DISCOM without delay." : "UPI, Netbanking, Cards or Proof."}
                active={!paid && !manualReviewPending}
              />
              <TrustStep
                title={paid ? "Official Receipt" : manualReviewPending ? "Owner Review" : "Instant Receipt"}
                text={
                  paid
                    ? "Download government BBPS clearing receipt."
                    : manualReviewPending
                    ? "Proof under landlord verification."
                    : "Delivered immediately after checkout."
                }
                active={paid || manualReviewPending}
              />
            </div>
          </div>

          {error && (
            <div className="mt-5 rounded-2xl border border-[#f8c8c2] bg-[#feece9] p-4 text-sm text-[#c53b27]">
              {error}
            </div>
          )}
        </section>

        <aside className="rounded-3xl border border-[#d8e1ee] bg-white p-6 sm:p-7 shadow-xs">
          <p className="text-xs font-bold uppercase tracking-wider text-[#1f6ad8]">
            {isUtilityBill ? "Total Electricity Bill" : "Amount Payable"}
          </p>
          <p className="mt-2 text-4xl font-extrabold text-[#182133] tracking-tight">{amountText}</p>
          <p className="mt-2 text-xs text-[#60708d] leading-relaxed">
            {isUtilityBill 
              ? "Official BBPS receipt with NPCI reference number generated instantly upon payment." 
              : "Paid rent receipts are delivered to your WhatsApp and email automatically."}
          </p>

          {!paid && !isUtilityBill && (
            <label className="mt-5 block text-xs font-bold uppercase tracking-wider text-[#60708d]">
              Pay a partial amount (optional)
              <input 
                type="number" 
                min="1" 
                max={invoice.amount / 100} 
                step="0.01" 
                value={partialRupees} 
                onChange={e => setPartialRupees(e.target.value)} 
                placeholder={`Full balance ${amountText}`} 
                className="mt-2 w-full rounded-2xl border border-[#d7e1ef] px-4 py-2.5 text-sm font-medium text-[#182133] outline-none focus:border-[#1f6ad8] focus:ring-2 focus:ring-[#d9e8ff]"
              />
              <span className="mt-1 block text-[11px] font-normal text-[#8091a5]">Leave blank to pay the full balance.</span>
            </label>
          )}

          {manualStatusLabel && !paid && (
            <div className="mt-5 rounded-2xl border border-[#dbe4f0] bg-[#f8fbff] p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#60708d]">Manual Verification</p>
              <p className="mt-1 font-semibold text-[#182133]">{manualStatusLabel}</p>
              {invoice?.manualPaymentMethod && (
                <p className="mt-1 text-xs text-[#60708d]">Method: {paymentMethodLabel(invoice.manualPaymentMethod)}</p>
              )}
              {invoice?.manualPaymentReviewNote && (
                <p className="mt-2 text-xs text-[#60708d] bg-white p-2.5 rounded-xl border border-[#e2ebf6]">{invoice.manualPaymentReviewNote}</p>
              )}
              {manualReviewPending && (
                <button
                  type="button"
                  onClick={refreshInvoice}
                  className="mt-3 w-full rounded-xl border border-[#bfdbfe] bg-white px-3 py-2 text-xs font-bold text-[#1f6ad8] transition hover:bg-[#eff6ff]"
                >
                  Refresh status
                </button>
              )}
            </div>
          )}

          <div className="mt-6 space-y-3">
            {invoice.publicUrl && (
              <a
                href={invoice.publicUrl}
                target="_blank"
                rel="noreferrer"
                className="block w-full rounded-2xl border border-[#d8e1ee] bg-[#f8fbff] px-4 py-3 text-center text-sm font-bold text-[#1f6ad8] transition hover:bg-[#eff6ff] hover:border-[#bfdbfe]"
              >
                {paid ? "📄 View Verified Receipt PDF" : "📄 View Statement PDF"}
              </a>
            )}

            <button
              onClick={startPayment}
              disabled={Boolean(paid) || paying}
              className={`w-full rounded-2xl px-4 py-3.5 text-sm font-bold text-white shadow-xs transition ${
                paid
                  ? "cursor-not-allowed bg-[#dcfce7] text-[#15803d] shadow-none"
                  : "bg-gradient-to-r from-[#1f6ad8] to-[#1e40af] hover:from-[#1756b5] hover:to-[#1e3a8a] hover:shadow-md active:scale-[0.99]"
              }`}
            >
              {paid ? "✓ Payment Settled" : paying ? "Opening Cashfree UPI..." : "💳 Pay with UPI / GPay / Cards"}
            </button>

            {!paid && paying && (
              <p className="text-center text-xs text-[#60708d]">Keep this window open until payment is confirmed.</p>
            )}
          </div>

          {!paid && !manualReviewPending && (
            <>
              <div className="mt-5 grid grid-cols-4 gap-1.5 text-center text-[10px] font-bold text-[#60708d]">
                <span className="rounded-xl bg-[#f0f4f9] py-1.5">GPay</span>
                <span className="rounded-xl bg-[#f0f4f9] py-1.5">PhonePe</span>
                <span className="rounded-xl bg-[#f0f4f9] py-1.5">Paytm</span>
                <span className="rounded-xl bg-[#f0f4f9] py-1.5">Cards</span>
              </div>

              {invoice.invoiceNumber?.startsWith("EBILL") ||
              invoice.companyName?.toLowerCase().includes("board") ||
              invoice.companyName?.toLowerCase().includes("discom") ||
              invoice.companyName?.toLowerCase().includes("electricity") ||
              invoice.companyName?.toLowerCase().includes("gas") ? (
                <div className="mt-6 rounded-2xl border border-[#bfdbfe] bg-[#eff6ff] p-4 text-center">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1f6ad8]">
                    ⚡ Bharat Connect (BBPS) Direct Clearing
                  </span>
                  <p className="mt-1.5 text-xs leading-relaxed text-[#51637d]">
                    To guarantee instant clearing with your DISCOM/Board and provide official BBPS receipts, utility bills are settled directly online via UPI, Cards, or Netbanking.
                  </p>
                </div>
              ) : (
                <div className="mt-6 rounded-2xl border border-[#d8e1ee] bg-[#f8fafd] p-4">
                  <p className="text-sm font-bold text-[#182133]">Pay by direct bank transfer / UPI ID</p>
                  <p className="mt-1 text-xs text-[#60708d]">
                    After payment, upload your transfer screenshot so your landlord can review and verify.
                  </p>

                  <div className="mt-4 space-y-2 rounded-xl border border-[#e2eaf5] bg-white p-3.5 text-xs text-[#182133]">
                    {invoice.bankName && <p><span className="font-semibold text-[#60708d]">Bank:</span> {invoice.bankName}</p>}
                    {invoice.accountNumber && <p><span className="font-semibold text-[#60708d]">Account:</span> {invoice.accountNumber}</p>}
                    {invoice.branchName && <p><span className="font-semibold text-[#60708d]">Branch:</span> {invoice.branchName}</p>}
                    {invoice.ifsc && <p><span className="font-semibold text-[#60708d]">IFSC:</span> {invoice.ifsc}</p>}
                    {invoice.upi && <p><span className="font-semibold text-[#60708d]">UPI ID:</span> {invoice.upi}</p>}
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {["UPI", "NEFT_RTGS"].map((option) => {
                      const selected = manualMethod === option
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => setManualMethod(option)}
                          className={`rounded-xl border px-3 py-2.5 text-xs font-bold transition ${
                            selected
                              ? "border-[#1f6ad8] bg-[#eff6ff] text-[#1f6ad8]"
                              : "border-[#d8e1ee] bg-white text-[#60708d]"
                          }`}
                        >
                          {paymentMethodLabel(option)}
                        </button>
                      )
                    })}
                  </div>

                  <label className="mt-4 block text-xs font-bold text-[#182133]">
                    Payment screenshot
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) => setProofFile(event.target.files?.[0] || null)}
                      className="mt-1.5 block w-full rounded-xl border border-[#d8e1ee] bg-white px-3 py-2 text-xs text-[#182133]"
                    />
                  </label>

                  <label className="mt-3 block text-xs font-bold text-[#182133]">
                    Note or reference / UTR
                    <textarea
                      value={manualNote}
                      onChange={(event) => setManualNote(event.target.value)}
                      rows={2}
                      placeholder="UPI reference / UTR number"
                      className="mt-1.5 w-full resize-none rounded-xl border border-[#d8e1ee] bg-white px-3 py-2 text-xs text-[#182133] outline-none transition placeholder:text-[#9aa9c0] focus:border-[#1f6ad8] focus:ring-2 focus:ring-[#d9e8ff]"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={submitManualProof}
                    disabled={uploadingProof || !proofFile}
                    className={`mt-4 w-full rounded-xl px-4 py-2.5 text-xs font-bold transition ${
                      uploadingProof || !proofFile
                        ? "cursor-not-allowed bg-[#e2eaf5] text-[#9aa9c0]"
                        : "bg-[#1f6ad8] text-white hover:bg-[#1756b5] hover:shadow-xs"
                    }`}
                  >
                    {uploadingProof ? "Uploading proof..." : "Upload payment proof"}
                  </button>

                  {manualMessage && (
                    <p className="mt-3 text-xs text-[#15803d] font-bold">{manualMessage}</p>
                  )}
                </div>
              )}
            </>
          )}

          {!paid && manualReviewPending && (
            <div className="mt-6 rounded-2xl border border-[#bfdbfe] bg-[#eff6ff] p-4">
              <p className="text-sm font-bold text-[#1e40af]">Payment proof submitted</p>
              <p className="mt-1.5 text-xs text-[#475569]">
                Your {paymentMethodLabel(invoice.manualPaymentMethod || manualMethod)} proof has been uploaded.
                The landlord will review it before marking this invoice paid.
              </p>
              <button
                type="button"
                onClick={refreshInvoice}
                className="mt-3 w-full rounded-xl bg-[#1f6ad8] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#1756b5] shadow-xs"
              >
                Check latest status
              </button>
            </div>
          )}
        </aside>
      </div>
    </main>
  )
}

function InfoTile({
  label,
  value,
  strong = false,
  compact = false,
}: {
  label: string
  value: string
  strong?: boolean
  compact?: boolean
}) {
  return (
    <div className="rounded-2xl border border-[#d8e1ee] bg-[#f8fafd] p-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-[#60708d]">{label}</p>
      <p className={`mt-1.5 break-words ${strong ? "text-xl font-extrabold text-[#182133]" : "font-bold text-[#182133]"} ${compact ? "text-xs font-mono text-[#1f6ad8]" : ""}`}>
        {value}
      </p>
    </div>
  )
}

function TrustStep({ title, text, active }: { title: string; text: string; active: boolean }) {
  return (
    <div className="rounded-xl bg-white border border-[#d8e1ee] p-3.5 shadow-2xs">
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${active ? "bg-[#1f6ad8]" : "bg-[#cbd5e1]"}`} />
        <p className="text-xs font-bold text-[#182133]">{title}</p>
      </div>
      <p className="mt-1.5 text-[11px] text-[#60708d] leading-relaxed">{text}</p>
    </div>
  )
}
