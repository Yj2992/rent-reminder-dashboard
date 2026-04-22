import { FormEvent, useMemo, useState } from "react"
import { useRouter } from "next/router"

function extractPaymentToken(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ""

  try {
    const url = new URL(trimmed)
    const segments = url.pathname.split("/").filter(Boolean)
    if (segments.length >= 2 && segments[0] === "pay") {
      return decodeURIComponent(segments[1])
    }
  } catch {
    // Not a full URL, continue treating it as a raw token.
  }

  const normalized = trimmed.replace(/^\/+/, "")
  if (normalized.startsWith("pay/")) {
    return decodeURIComponent(normalized.slice(4))
  }

  return trimmed
}

export default function Home() {
  const router = useRouter()
  const [inputValue, setInputValue] = useState("")
  const token = useMemo(() => extractPaymentToken(inputValue), [inputValue])
  const canContinue = token.length > 0

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canContinue) return
    router.push(`/pay/${encodeURIComponent(token)}`)
  }

  return (
    <main className="min-h-screen bg-[#f5f7f8] text-[#17211f]">
      <header className="border-b border-[#dce5e2] bg-white">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-lg font-bold">Rentomatic</p>
            <p className="text-xs text-[#6f7e79]">Tenant payment portal</p>
          </div>
          <span className="rounded-full border border-[#cfe0da] bg-[#eef7f3] px-3 py-1 text-xs font-semibold text-[#1f6f5b]">
            Secure invoice access
          </span>
        </div>
      </header>

      <div className="mx-auto grid min-h-[calc(100vh-73px)] w-full max-w-5xl gap-5 px-4 py-6 lg:grid-cols-[1.1fr_420px]">
        <section className="rounded-lg border border-[#dce5e2] bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-[#1f6f5b]">Pay rent securely</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight">Open your invoice and complete payment</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[#5d6d68]">
            Paste the full payment link from your email, or enter only the token after <span className="font-semibold text-[#17211f]">/pay/</span>.
            We will open the exact invoice tied to that link.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <PortalStep title="Open invoice" text="Check the rent amount and due date." />
            <PortalStep title="Pay online" text="Complete payment with Razorpay checkout." />
            <PortalStep title="Get receipt" text="A paid invoice is sent after verification." />
          </div>
        </section>

        <aside className="rounded-lg border border-[#dce5e2] bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-[#5d6d68]">Invoice access</p>
          <h2 className="mt-2 text-2xl font-bold">Paste your payment link</h2>
          <p className="mt-3 text-sm leading-6 text-[#5d6d68]">
            This portal accepts either the full link from the email or just the payment token.
          </p>

          <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[#17211f]">Payment link or token</span>
              <textarea
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                placeholder="https://rent-reminder-dashboard.onrender.com/pay/your-token"
                rows={4}
                className="w-full resize-none rounded-lg border border-[#d5dfdc] bg-[#fbfcfc] px-4 py-3 text-sm text-[#17211f] outline-none transition placeholder:text-[#8a9894] focus:border-[#1f6f5b] focus:ring-2 focus:ring-[#d8ebe4]"
              />
            </label>

            {canContinue && (
              <div className="rounded-lg border border-[#dce5e2] bg-[#f8faf9] p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#6f7e79]">Detected token</p>
                <p className="mt-2 break-all font-semibold text-[#17211f]">{token}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={!canContinue}
              className={`w-full rounded-lg px-4 py-3 font-semibold transition ${
                canContinue
                  ? "bg-[#1f6f5b] text-white hover:bg-[#185846] hover:shadow-md"
                  : "cursor-not-allowed bg-[#d7dfdc] text-[#7d8a86]"
              }`}
            >
              Open invoice
            </button>
          </form>

          <div className="mt-6 rounded-lg border border-[#e1e8e6] bg-[#fbfcfc] p-4">
            <p className="text-sm font-semibold text-[#17211f]">Need the link again?</p>
            <p className="mt-2 text-sm leading-6 text-[#5d6d68]">
              Ask your property manager to resend the latest invoice email if this page does not open your payment.
            </p>
          </div>
        </aside>
      </div>
    </main>
  )
}

function PortalStep({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-lg border border-[#e1e8e6] bg-[#fbfcfc] p-4">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-[#1f6f5b]" />
        <p className="font-semibold">{title}</p>
      </div>
      <p className="mt-2 text-sm text-[#6f7e79]">{text}</p>
    </div>
  )
}
