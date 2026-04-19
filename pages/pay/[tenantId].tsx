import { useEffect, useState } from "react"
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
    const s = document.createElement("script")
    s.src = "https://checkout.razorpay.com/v1/checkout.js"
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error("Failed to load Razorpay script"))
    document.body.appendChild(s)
  })
}

function formatAmount(amountPaise: number, currency: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amountPaise / 100)
}

export default function PayPage() {
  const router = useRouter()
  const { tenantId } = router.query
  const token = Array.isArray(tenantId) ? tenantId[0] : tenantId
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!token) return
    setLoading(true)
    setError("")
    axios
      .get(`${backendBaseUrl}/public/invoices/${encodeURIComponent(token)}`)
      .then((r) => setInvoice(r.data))
      .catch(() => setError("This payment link is invalid or no longer available."))
      .finally(() => setLoading(false))
  }, [token])

  async function startPayment() {
    if (!token || !invoice || invoice.alreadyPaid || invoice.status === "PAID") return

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
            router.push(`/success?invoice=${encodeURIComponent(order.invoiceId)}`)
          } catch {
            router.push(`/failed?invoice=${encodeURIComponent(order.invoiceId)}`)
          }
        },
        prefill: {
          name: invoice.tenantName || "",
          email: invoice.tenantEmail || "",
        },
        theme: { color: "#2563eb" },
        method: { upi: true, card: true, wallet: true, netbanking: true },
        modal: {
          ondismiss: () => setPaying(false),
        },
      }

      new (window as any).Razorpay(options).open()
    } catch {
      setError("Could not start payment. Please try again.")
      setPaying(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <p className="text-gray-700">Loading invoice...</p>
      </div>
    )
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white shadow-xl rounded-2xl p-8 max-w-md w-full text-center border border-red-100">
          <h1 className="text-2xl font-bold text-gray-800 mb-3">Payment link unavailable</h1>
          <p className="text-gray-600">{error || "Please contact your property manager."}</p>
        </div>
      </div>
    )
  }

  const paid = invoice.alreadyPaid || invoice.status === "PAID"

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-50 to-gray-100">
      <header className="w-full bg-blue-600 text-white py-4 shadow">
        <div className="max-w-5xl mx-auto px-6 flex items-center justify-between">
          <h1 className="text-lg font-bold">Rentomatic</h1>
          <span className="text-sm opacity-80">Secure rent payment</span>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="bg-white shadow-2xl rounded-2xl p-8 w-full max-w-md border border-gray-100">
          <div className="text-center mb-7">
            <p className="text-sm font-semibold text-blue-600 mb-2">{invoice.invoiceNumber || "Rent invoice"}</p>
            <h2 className="text-2xl font-bold text-gray-800">{invoice.tenantName}</h2>
            <p className="text-gray-500 mt-2">Due {invoice.dueDate || "soon"}</p>
          </div>

          <div className="rounded-xl bg-gray-50 border border-gray-200 p-5 mb-6 space-y-3">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Status</span>
              <span className={paid ? "font-semibold text-green-600" : "font-semibold text-amber-600"}>
                {paid ? "Paid" : "Pending"}
              </span>
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>Amount</span>
              <span className="font-bold text-gray-900">{formatAmount(invoice.amount, invoice.currency)}</span>
            </div>
          </div>

          {invoice.publicUrl && (
            <a
              href={invoice.publicUrl}
              target="_blank"
              rel="noreferrer"
              className="block w-full text-center border border-blue-200 text-blue-700 py-3 rounded-lg font-semibold mb-3 hover:bg-blue-50 transition"
            >
              View invoice PDF
            </a>
          )}

          <button
            onClick={startPayment}
            disabled={paid || paying}
            className={`w-full py-3 rounded-lg font-semibold transition ${
              paid
                ? "bg-green-100 text-green-700 cursor-not-allowed"
                : "bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg"
            }`}
          >
            {paid ? "Payment complete" : paying ? "Opening checkout..." : "Pay now"}
          </button>

          {!paid && (
            <div className="mt-6 flex justify-center space-x-4 text-gray-500 text-sm">
              <span>UPI</span> <span>Card</span> <span>Wallet</span> <span>Netbanking</span>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
