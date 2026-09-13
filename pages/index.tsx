import { FormEvent, useMemo, useState } from "react"
import { useRouter } from "next/router"

function paymentToken(value: string) {
  const v = value.trim()
  if (!v) return ""
  try {
    const u = new URL(v)
    const p = u.pathname.split("/").filter(Boolean)
    if (p[0] === "pay" && p[1]) return decodeURIComponent(p[1])
  } catch {}
  try { return decodeURIComponent(v.replace(/^\/+/, "").replace(/^pay\//, "")) } catch { return "" }
}

export default function Home() {
  const router = useRouter()
  const [invoice, setInvoice] = useState("")
  const token = useMemo(() => paymentToken(invoice), [invoice])

  function openInvoice(e: FormEvent) {
    e.preventDefault()
    if (token) router.push(`/pay/${encodeURIComponent(token)}`)
  }

  return (
    <main className="min-h-screen bg-[#f4f7fb] text-[#182133] animate-fade-in-up">
      {/* Navigation Header */}
      <header className="border-b border-[#ccd5e4] bg-white sticky top-0 z-30 shadow-2xs backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#1f6ad8] to-[#2563eb] font-black text-white shadow-xs text-base">
              R
            </span>
            <div>
              <b className="text-lg font-extrabold tracking-tight text-[#182133]">Rentomatic</b>
              <p className="text-[11px] font-medium text-[#60708d]">Tenant &amp; Rent Ecosystem</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <a
              href="https://app.rentomatic.in/login"
              className="rounded-xl border border-[#ccd5e4] bg-white px-4 py-2 text-xs font-bold text-[#182133] transition duration-200 hover:bg-[#f4f7fb] hover:border-[#1f6ad8] active:scale-95"
            >
              Landlord Portal
            </a>
            <button
              onClick={() => router.push("/login")}
              className="rounded-xl bg-[#1f6ad8] px-4 py-2 text-xs font-bold text-white shadow-xs transition duration-200 hover:bg-[#1756b5] active:scale-95"
            >
              Tenant Sign In →
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.1fr_.9fr]">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#bfdbfe] bg-[#eff6ff] px-3.5 py-1 text-xs font-bold text-[#1f6ad8] shadow-2xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#1f6ad8] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#1f6ad8]" />
            </span>
            <span>Unified Indian Rental Platform</span>
          </span>

          <h1 className="mt-4 max-w-2xl text-4xl font-extrabold leading-tight tracking-tight text-[#182133] sm:text-5xl">
            Rent, utilities &amp; deposits with complete clarity.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-[#60708d]">
            Pay monthly rent, view sub-meter electricity, water, and piped gas breakdowns, manage deposit escrows, and download verified BBPS receipts instantly.
          </p>

          <div className="mt-8 grid max-w-xl gap-3.5 sm:grid-cols-2">
            <a
              href="https://app.rentomatic.in/login"
              className="group rounded-3xl border border-[#ccd5e4] bg-white p-5 shadow-xs transition duration-200 hover:-translate-y-0.5 hover:border-[#1f6ad8] hover:shadow-md"
            >
              <b className="text-base font-bold text-[#182133]">I’m a Landlord</b>
              <span className="mt-1 block text-xs text-[#60708d]">Manage properties, leases, submeters &amp; collections</span>
              <span className="mt-4 block text-xs font-bold text-[#1f6ad8] group-hover:translate-x-0.5 transition duration-200">
                Landlord sign in →
              </span>
            </a>

            <button
              onClick={() => router.push("/login")}
              className="group rounded-3xl bg-gradient-to-br from-[#1f6ad8] to-[#2563eb] p-5 text-left text-white shadow-xs transition duration-200 hover:-translate-y-0.5 hover:shadow-lg"
            >
              <b className="text-base font-bold">I’m a Tenant</b>
              <span className="mt-1 block text-xs text-[#eff6ff]">Pay bills, view deposit status &amp; report maintenance</span>
              <span className="mt-4 block text-xs font-bold text-white underline group-hover:translate-x-0.5 transition duration-200">
                Tenant sign in →
              </span>
            </button>
          </div>

          <a href="#invoice" className="mt-5 inline-block text-xs font-bold text-[#1f6ad8] hover:underline">
            ⚡ Quick Pay: Open invoice or utility bill directly →
          </a>
        </div>

        {/* Feature Bento Grid */}
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Feature
            title="Rent & BBPS Utilities"
            text="Single bill combining rent with electric, water, and piped gas meters."
            icon="⚡"
          />
          <Feature
            title="Instant UPI Payments"
            text="1-tap payment via Google Pay, PhonePe, Paytm, BHIM, or NetBanking."
            icon="💳"
          />
          <Feature
            title="Deposit Protection"
            text="Transparent security deposit holding with move-out refund tracker."
            icon="🔒"
          />
          <Feature
            title="Maintenance & Vault"
            text="Report repairs with photos and store Aadhaar/PAN in secure vault."
            icon="🛠️"
          />
        </div>
      </section>

      {/* Quick Pay Invoice & Utility Search */}
      <section id="invoice" className="border-y border-[#ccd5e4] bg-white py-12">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:px-6 md:grid-cols-2 items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[#1f6ad8]">Instant Checkout</p>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-[#182133] sm:text-3xl">
              Pay rent and utilities
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#60708d]">
              Open a payment link shared with you, or sign in to see utility bills linked to your tenancy.
            </p>
          </div>

          <div className="space-y-4">
            {/* Rent Token Input */}
            <form onSubmit={openInvoice} className="rounded-3xl border border-[#ccd5e4] bg-[#fcfdff] p-5 shadow-xs">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#182133]">
                Payment link or token
                <input
                  value={invoice}
                  onChange={(e) => setInvoice(e.target.value)}
                  placeholder="Paste payment token or link (e.g. rent_...)"
                  className="mt-2 w-full rounded-xl border border-[#ccd5e4] bg-white p-3 text-xs font-semibold text-[#182133] outline-none transition focus:border-[#1f6ad8] focus:ring-2 focus:ring-[#eff6ff]"
                />
              </label>
              <button
                disabled={!token}
                className="mt-3 w-full rounded-xl bg-[#1f6ad8] p-3 text-xs font-bold text-white shadow-xs transition hover:bg-[#1756b5] active:scale-[0.99] disabled:opacity-40"
              >
                Open payment →
              </button>
            </form>

            <div className="rounded-3xl border border-blue-200 bg-blue-50/60 p-5">
              <h3 className="font-semibold">Electricity, water &amp; piped gas</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">Sign in to choose a saved utility account, review its bill and track your payments. Your property manager can add a missing connection.</p>
              <button type="button" onClick={() => router.push("/tenant?tab=utilities")} className="mt-4 w-full rounded-full bg-blue-700 px-5 py-3 text-sm font-semibold text-white">Open my utility bills</button>
            </div>

          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mx-auto flex max-w-6xl flex-wrap justify-between gap-3 px-4 py-8 text-xs text-[#60708d] sm:px-6">
        <span className="font-semibold">© Rentomatic · Indian Rental Ecosystem</span>
        <span>Verified Bharat Connect (BBPS) · Bank-grade Encryption</span>
      </footer>
    </main>
  )
}

function Feature({ title, text, icon }: { title: string; text: string; icon: string }) {
  return (
    <div className="rounded-3xl border border-[#ccd5e4] bg-white p-5 shadow-xs transition duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-[#1f6ad8]">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-[#eff6ff] text-xl text-[#1f6ad8] border border-[#bfdbfe]">
        {icon}
      </div>
      <h2 className="text-sm font-bold text-[#182133]">{title}</h2>
      <p className="mt-1 text-xs leading-5 text-[#60708d]">{text}</p>
    </div>
  )
}
