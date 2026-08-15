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
  return decodeURIComponent(v.replace(/^\/+/, "").replace(/^pay\//, ""))
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
    <main className="min-h-screen bg-[#f4f7fb] text-[#182133]">
      <header className="border-b border-[#ccd5e4] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#2151c5] font-bold text-white shadow-sm">
              R
            </span>
            <div>
              <b className="text-xl font-bold tracking-tight text-[#182133]">Rentomatic</b>
              <p className="text-xs text-[#60708d]">Renting, simplified for everyone</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <a
              href="https://app.rentomatic.in/login"
              className="rounded-[14px] border border-[#ccd5e4] bg-white px-4 py-2 text-sm font-semibold text-[#182133] transition hover:bg-[#f4f7fb] hover:border-[#b4c2d6]"
            >
              Landlord sign in
            </a>
            <button
              onClick={() => router.push("/login")}
              className="rounded-[14px] bg-[#2151c5] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1a43a7]"
            >
              Tenant sign in
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.1fr_.9fr]">
        <div>
          <span className="inline-flex items-center rounded-full bg-[#dde7ff] px-3.5 py-1 text-xs font-semibold tracking-wide text-[#1a42a5]">
            One platform for landlords and tenants
          </span>
          <h1 className="mt-4 max-w-2xl text-4xl font-bold leading-tight tracking-tight text-[#182133] sm:text-5xl">
            Bills, maintenance and documents without the confusion.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-[#60708d]">
            Choose your portal. Landlords manage properties and collections; tenants use their assigned email and Tenant ID to access the right home.
          </p>

          <div className="mt-8 grid max-w-xl gap-3.5 sm:grid-cols-2">
            <a
              href="https://app.rentomatic.in/login"
              className="group rounded-[20px] border border-[#ccd5e4] bg-white p-5 shadow-sm transition hover:border-[#2151c5] hover:shadow-md"
            >
              <b className="text-lg font-bold text-[#182133]">I’m a landlord</b>
              <span className="mt-1.5 block text-sm text-[#60708d]">Manage tenants, billing and properties</span>
              <span className="mt-4 block text-sm font-semibold text-[#2151c5] group-hover:underline">
                Landlord sign in →
              </span>
            </a>

            <button
              onClick={() => router.push("/login")}
              className="rounded-[20px] bg-[#2151c5] p-5 text-left text-white shadow-sm transition hover:bg-[#1a43a7] hover:shadow-md"
            >
              <b className="text-lg font-bold">I’m a tenant</b>
              <span className="mt-1.5 block text-sm text-[#dde7ff]">Pay bills, report issues and open documents</span>
              <span className="mt-4 block text-sm font-semibold text-white underline">
                Tenant sign in →
              </span>
            </button>
          </div>

          <a href="#invoice" className="mt-5 inline-block text-xs font-semibold text-[#60708d] underline hover:text-[#182133]">
            Open an invoice without signing in
          </a>
        </div>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <Feature title="Bills & receipts" text="One clear bill per month with payment history." icon="receipt" />
          <Feature title="Maintenance" text="Report an issue with a photo and track its status." icon="wrench" />
          <Feature title="Document vault" text="Securely share PDFs and images with your manager." icon="shield" />
          <Feature title="Tenant IDs" text="One Gmail can access multiple tenancies safely." icon="key" />
        </div>
      </section>

      <section id="invoice" className="border-y border-[#ccd5e4] bg-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[#2151c5]">Have an invoice link?</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-[#182133] sm:text-3xl">Open it without signing in</h2>
            <p className="mt-3 text-sm leading-6 text-[#60708d]">
              Paste the secure payment link from your invoice email. Existing payment links continue to work exactly as before.
            </p>
          </div>
          <form onSubmit={openInvoice} className="rounded-[20px] border border-[#ccd5e4] bg-[#fcfdff] p-5 shadow-sm">
            <label className="block text-sm font-semibold text-[#182133]">
              Payment link or token
              <textarea
                value={invoice}
                onChange={(e) => setInvoice(e.target.value)}
                rows={3}
                placeholder="https://rentomatic.in/pay/your-token"
                className="mt-2 w-full resize-none rounded-[14px] border border-[#ccd5e4] bg-white p-3 text-sm text-[#182133] outline-none transition focus:border-[#2151c5] focus:ring-2 focus:ring-[#dde7ff]"
              />
            </label>
            <button
              disabled={!token}
              className="mt-3 w-full rounded-[14px] bg-[#2151c5] p-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#1a43a7] disabled:opacity-40"
            >
              Open invoice
            </button>
          </form>
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-wrap justify-between gap-3 px-4 py-8 text-xs text-[#60708d] sm:px-6">
        <span>© Rentomatic</span>
        <span>Private access · Secure documents · Clear records</span>
      </footer>
    </main>
  )
}

function Feature({ title, text }: { title: string; text: string; icon?: string }) {
  return (
    <div className="rounded-[20px] border border-[#ccd5e4] bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-[12px] bg-[#dde7ff] font-bold text-[#2151c5]">
        ✓
      </div>
      <h2 className="font-bold text-[#182133]">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-[#60708d]">{text}</p>
    </div>
  )
}
