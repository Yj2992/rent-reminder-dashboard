import { useEffect, useMemo, useState } from "react"
import axios from "axios"
import { useRouter } from "next/router"

type Invoice = {
  invoiceId: string
  tenantName: string
  tenantEmail?: string
  dueDate?: string
  invoiceNumber?: string
  amount: number
  currency: string
  status: string
  publicUrl?: string
  paymentUrl?: string
  alreadyPaid?: boolean
}

type PaymentOrder = {
  keyId: string
  orderId: string
  amount: number
  currency: string
  invoiceId: string
  tenantName: string
  description: string
}

const backendBaseUrl =
  process.env.NEXT_PUBLIC_BACKEND_BASE_URL || "https://ktor-sendgrid-backend.onrender.com"

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

function formatAmount(amountPaise: number, currency: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amountPaise / 100)
}

function readableStatus(status: string, paid: boolean) {
  if (paid) return "Paid"
  if (status?.toUpperCase() === "FAILED") return "Failed"
  return "Pending"
}

export default function PayPage() {
  const router = useRouter()
  const { tenantId } = router.query
  const token = Array.isArray(tenantId) ? tenantId[0] : tenantId
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [error, setError] = useState("")

  const paid = invoice?.alreadyPaid || invoice?.status === "PAID"
  const statusLabel = readableStatus(invoice?.status || "", Boolean(paid))
  const amountText = useMemo(
    () => (invoice ? formatAmount(invoice.amount, invoice.currency) : ""),
    [invoice]
  )

  useEffect(() => {
    if (!token) return
    setLoading(true)
    setError("")
    axios
      .get(`${backendBaseUrl}/public/invoices/${encodeURIComponent(token)}`)
      .then((response) => setInvoice(response.data))
      .catch(() => setError("This payment link is invalid or no longer available."))
      .finally(() => setLoading(false))
  }, [token])

  async function refreshInvoice() {
    if (!token) return
    setLoading(true)
    setError("")
    try {
      const response = await axios.get(`${backendBaseUrl}/public/invoices/${encodeURIComponent(token)}`)
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
      const createRes = await axios.post<PaymentOrder>(`${backendBaseUrl}/payments/create-order`, { token })
      const order = createRes.data

      await loadRazorpayScript()

      const options: any = {
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: "Rentomatic",
        description: order.description,
        order_id: order.orderId,
        handler: async function (response: any) {
          try {
            await axios.post(`${backendBaseUrl}/payments/verify`, {
              token,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
            })
            router.push(`/success?invoice=${encodeURIComponent(order.invoiceId)}&token=${encodeURIComponent(token)}`)
          } catch {
            router.push(`/failed?invoice=${encodeURIComponent(order.invoiceId)}&token=${encodeURIComponent(token)}`)
          }
        },
        prefill: {
          name: invoice.tenantName || "",
          email: invoice.tenantEmail || "",
        },
        notes: {
          invoice_id: invoice.invoiceId,
          invoice_number: invoice.invoiceNumber || "",
        },
        theme: { color: "#1f6f5b" },
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
    } catch {
      setError("Could not start payment. Please check your connection and try again.")
      setPaying(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f5f7f8] px-4 py-6 text-[#17211f]">
        <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-3xl items-center justify-center">
          <div className="w-full max-w-md rounded-lg border border-[#d8e2df] bg-white p-6 shadow-sm">
            <div className="mb-5 h-3 w-28 rounded-full bg-[#dce7e3]" />
            <div className="mb-3 h-8 w-3/4 rounded bg-[#eef3f1]" />
            <div className="mb-6 h-4 w-1/2 rounded bg-[#eef3f1]" />
            <div className="space-y-3 rounded-lg border border-[#e1e8e6] bg-[#f8faf9] p-4">
              <div className="h-4 w-full rounded bg-[#e7eeeb]" />
              <div className="h-4 w-5/6 rounded bg-[#e7eeeb]" />
              <div className="h-4 w-2/3 rounded bg-[#e7eeeb]" />
            </div>
            <p className="mt-5 text-sm text-[#5d6d68]">Loading secure invoice...</p>
          </div>
        </div>
      </main>
    )
  }

  if (error && !invoice) {
    return (
      <main className="min-h-screen bg-[#f5f7f8] px-4 py-6 text-[#17211f]">
        <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-3xl items-center justify-center">
          <section className="w-full max-w-md rounded-lg border border-[#f0c9c2] bg-white p-6 text-center shadow-sm">
            <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#a33d2f]">Payment link unavailable</p>
            <h1 className="text-2xl font-bold">This link cannot be opened</h1>
            <p className="mt-3 text-[#5d6d68]">{error}</p>
            <button
              onClick={refreshInvoice}
              className="mt-6 w-full rounded-lg bg-[#1f6f5b] px-4 py-3 font-semibold text-white transition hover:bg-[#185846]"
            >
              Try again
            </button>
            <p className="mt-4 text-sm text-[#6f7e79]">Ask the property manager to resend the latest invoice link.</p>
          </section>
        </div>
      </main>
    )
  }

  if (!invoice) return null

  return (
    <main className="min-h-screen bg-[#f5f7f8] text-[#17211f]">
      <header className="border-b border-[#dce5e2] bg-white">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-lg font-bold">Rentomatic</p>
            <p className="text-xs text-[#6f7e79]">Secure rent payment</p>
          </div>
          <span className="rounded-full border border-[#cfe0da] bg-[#eef7f3] px-3 py-1 text-xs font-semibold text-[#1f6f5b]">
            Razorpay checkout
          </span>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-5xl gap-5 px-4 py-6 lg:grid-cols-[1fr_360px]">
        <section className="rounded-lg border border-[#dce5e2] bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#1f6f5b]">{invoice.invoiceNumber || "Rent invoice"}</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight">{invoice.tenantName || "Tenant"}</h1>
              <p className="mt-2 text-[#5d6d68]">{invoice.tenantEmail || "Email not available"}</p>
            </div>
            <div
              className={`w-fit rounded-full px-3 py-1 text-sm font-semibold ${
                paid
                  ? "bg-[#e9f8ef] text-[#207348]"
                  : statusLabel === "Failed"
                  ? "bg-[#fff0ed] text-[#a33d2f]"
                  : "bg-[#fff7df] text-[#80610d]"
              }`}
            >
              {statusLabel}
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <InfoTile label="Amount" value={amountText} strong />
            <InfoTile label="Due date" value={invoice.dueDate || "Due soon"} />
            <InfoTile label="Invoice ID" value={invoice.invoiceId} compact />
          </div>

          <div className="mt-6 rounded-lg border border-[#dce5e2] bg-[#f8faf9] p-4">
            <h2 className="font-semibold">Before you pay</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <TrustStep title="Review invoice" text="Check the amount and due date." active />
              <TrustStep title="Pay securely" text="UPI, card, wallet, or netbanking." active={!paid} />
              <TrustStep title="Receipt email" text={paid ? "Payment is already complete." : "Sent after payment succeeds."} active={paid} />
            </div>
          </div>

          {error && (
            <div className="mt-5 rounded-lg border border-[#f0c9c2] bg-[#fff7f5] p-4 text-sm text-[#8e3429]">
              {error}
            </div>
          )}
        </section>

        <aside className="rounded-lg border border-[#dce5e2] bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-[#5d6d68]">Amount payable</p>
          <p className="mt-2 text-4xl font-bold">{amountText}</p>
          <p className="mt-2 text-sm text-[#6f7e79]">Paid receipts are sent to the tenant email after successful verification.</p>

          <div className="mt-6 space-y-3">
            {invoice.publicUrl && (
              <a
                href={invoice.publicUrl}
                target="_blank"
                rel="noreferrer"
                className="block w-full rounded-lg border border-[#bfd6cf] px-4 py-3 text-center font-semibold text-[#1f6f5b] transition hover:bg-[#eef7f3]"
              >
                View invoice PDF
              </a>
            )}

            <button
              onClick={startPayment}
              disabled={Boolean(paid) || paying}
              className={`w-full rounded-lg px-4 py-3 font-semibold transition ${
                paid
                  ? "cursor-not-allowed bg-[#e9f8ef] text-[#207348]"
                  : "bg-[#1f6f5b] text-white hover:bg-[#185846] hover:shadow-md"
              }`}
            >
              {paid ? "Payment complete" : paying ? "Opening secure checkout..." : "Pay now"}
            </button>

            {!paid && paying && (
              <p className="text-center text-sm text-[#6f7e79]">Keep this page open until checkout finishes.</p>
            )}
          </div>

          {!paid && (
            <div className="mt-6 grid grid-cols-2 gap-2 text-center text-xs font-semibold text-[#5d6d68]">
              <span className="rounded bg-[#f1f5f3] px-2 py-2">UPI</span>
              <span className="rounded bg-[#f1f5f3] px-2 py-2">Card</span>
              <span className="rounded bg-[#f1f5f3] px-2 py-2">Wallet</span>
              <span className="rounded bg-[#f1f5f3] px-2 py-2">Netbanking</span>
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
    <div className="rounded-lg border border-[#e1e8e6] bg-[#fbfcfc] p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#6f7e79]">{label}</p>
      <p className={`mt-2 break-words ${strong ? "text-xl font-bold" : "font-semibold"} ${compact ? "text-xs" : ""}`}>
        {value}
      </p>
    </div>
  )
}

function TrustStep({ title, text, active }: { title: string; text: string; active: boolean }) {
  return (
    <div className="rounded-lg bg-white p-3">
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${active ? "bg-[#1f6f5b]" : "bg-[#c7d2cf]"}`} />
        <p className="font-semibold">{title}</p>
      </div>
      <p className="mt-2 text-sm text-[#6f7e79]">{text}</p>
    </div>
  )
}
