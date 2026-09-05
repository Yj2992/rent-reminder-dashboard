import axios from "axios"
import Link from "next/link"
import { useRouter } from "next/router"
import { useEffect, useMemo, useState } from "react"
import { TenantPortalInvoice, TenantPortalPaymentStatus } from "../lib/contracts"
import { OWNER_BACKEND_BASE_URL, PUBLIC_INVOICES_PATH } from "../lib/sharedRules"

const backendBaseUrl =
  process.env.NEXT_PUBLIC_BACKEND_BASE_URL || OWNER_BACKEND_BASE_URL

function formatAmount(amountPaise: number, currency: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amountPaise / 100)
}

export default function Success() {
  const router = useRouter()
  const invoiceId = Array.isArray(router.query.invoice) ? router.query.invoice[0] : router.query.invoice
  const token = Array.isArray(router.query.token) ? router.query.token[0] : router.query.token
  const orderId = Array.isArray(router.query.order_id) ? router.query.order_id[0] : router.query.order_id
  const [invoice, setInvoice] = useState<TenantPortalInvoice | null>(null)
  const [paymentStatus, setPaymentStatus] = useState<TenantPortalPaymentStatus | null>(null)
  const [loading, setLoading] = useState(Boolean(token))
  const [message, setMessage] = useState("Refreshing paid invoice...")

  const paid = paymentStatus?.status === "PAID"
  const amountText = useMemo(
    () => (invoice ? formatAmount(invoice.amount, invoice.currency) : ""),
    [invoice]
  )

  useEffect(() => {
    if (!token || !orderId) {
      setMessage("A payment reference is required to check authoritative status.")
      setLoading(false)
      return
    }

    let cancelled = false
    let attempts = 0

    async function loadPaidInvoice() {
      attempts += 1
      try {
        const statusResponse = await axios.get<TenantPortalPaymentStatus>(
          `${backendBaseUrl}/public/payments/status?token=${encodeURIComponent(token)}&order_id=${encodeURIComponent(orderId)}`
        )
        if (cancelled) return
        setPaymentStatus(statusResponse.data)

        if (statusResponse.data.status === "PAID") {
          const invoiceResponse = await axios.get<TenantPortalInvoice>(
            `${backendBaseUrl}${PUBLIC_INVOICES_PATH}/${encodeURIComponent(token)}`
          )
          if (cancelled) return
          setInvoice(invoiceResponse.data)
          setMessage(statusResponse.data.message || "Payment has been committed.")
          setLoading(false)
          return
        }

        if (statusResponse.data.status === "FAILED" || statusResponse.data.status === "RECONCILIATION_REQUIRED") {
          setMessage(statusResponse.data.message)
          setLoading(false)
          return
        }

        if (attempts < 8) {
          setMessage("Payment received by gateway. Confirming payment…")
          window.setTimeout(loadPaidInvoice, 1500)
        } else {
          setMessage("Confirmation is taking longer than usual. Your payment remains pending reconciliation; please do not pay again yet.")
          setLoading(false)
        }
      } catch {
        if (cancelled) return
        if (attempts < 4) {
          window.setTimeout(loadPaidInvoice, 1500)
        } else {
          setMessage("We could not refresh the committed status. Please check again shortly; do not pay again yet.")
          setLoading(false)
        }
      }
    }

    loadPaidInvoice()

    return () => {
      cancelled = true
    }
  }, [token, orderId])

  return (
    <main className="min-h-screen bg-[#f5f7f8] px-4 py-6 text-[#17211f]">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-3xl items-center justify-center">
        <section className="w-full max-w-md rounded-lg border border-[#cfe4d7] bg-white p-6 shadow-sm">
          <div className={`mb-5 flex h-12 w-12 items-center justify-center rounded-full text-xl font-bold ${paid ? "bg-[#e9f8ef] text-[#207348]" : "bg-[#fff5d9] text-[#8a6400]"}`}>
            {paid ? "✓" : "…"}
          </div>
          <p className={`text-sm font-semibold uppercase tracking-wide ${paid ? "text-[#207348]" : "text-[#8a6400]"}`}>
            {paid ? "Payment confirmed" : "Payment processing"}
          </p>
          <h1 className="mt-2 text-3xl font-bold">{paid ? "Rent payment received" : "Confirming your payment"}</h1>
          <p className="mt-3 text-[#5d6d68]">
            {paid
              ? "Your paid invoice is updated below."
              : "We are waiting for authenticated confirmation from the payment provider."}
          </p>

          <div className="mt-5 rounded-lg border border-[#e1e8e6] bg-[#f8faf9] p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#6f7e79]">Invoice</p>
                <p className="mt-2 break-words font-semibold text-[#17211f]">
                  {invoice?.invoiceNumber || invoiceId || "Payment invoice"}
                </p>
              </div>
              <span className="rounded-full bg-[#e9f8ef] px-3 py-1 text-xs font-semibold text-[#207348]">
                {paid ? "Paid" : paymentStatus?.status === "RECONCILIATION_REQUIRED" ? "Needs review" : "Processing"}
              </span>
            </div>

            {invoice && (
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-[#6f7e79]">Tenant</p>
                  <p className="mt-1 font-semibold">{invoice.tenantName}</p>
                </div>
                <div>
                  <p className="text-[#6f7e79]">Amount</p>
                  <p className="mt-1 font-semibold">{amountText}</p>
                </div>
              </div>
            )}

            <p className="mt-4 text-sm text-[#5d6d68]">{message}</p>
          </div>

          <div className="mt-6 space-y-3">
            {invoice?.publicUrl && paid && (
              <a
                href={invoice.publicUrl}
                target="_blank"
                rel="noreferrer"
                className="block w-full rounded-lg bg-[#1f6f5b] px-4 py-3 text-center font-semibold text-white transition hover:bg-[#185846]"
              >
                View paid invoice PDF
              </a>
            )}

            {token && (
              <Link
                href={`/pay/${encodeURIComponent(token)}`}
                className={`block w-full rounded-lg px-4 py-3 text-center font-semibold transition ${
                  invoice?.publicUrl && paid
                    ? "border border-[#bfd6cf] text-[#1f6f5b] hover:bg-[#eef7f3]"
                    : "bg-[#1f6f5b] text-white hover:bg-[#185846]"
                }`}
              >
                {loading ? "Refresh invoice status" : "View invoice status"}
              </Link>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
