import axios from "axios"
import { FormEvent, useEffect, useState } from "react"
import { useRouter } from "next/router"

const backend = process.env.NEXT_PUBLIC_BACKEND_BASE_URL || "https://ktor-sendgrid-backend.onrender.com"

type Invoice = { id: string; invoice_number?: string; due_date?: string; amount: number; currency?: string; status: string; payment_token?: string }
type Maintenance = { id: string; title: string; description: string; priority: string; status: string; ownerNote?: string; reportedAt?: string }
type Lease = { id: string; title: string; leaseEndOn: string; status: string }
type Deposit = { originalAmountPaise: number; status: string }
type DepositEntry = { id: string; entryType: string; amountPaise: number; description: string; occurredOn: string }
type VaultDocument = { id:string; category:string; title:string; fileName:string; mimeType:string; expiresOn?:string }
type Dashboard = { tenantName?: string; tenantEmail: string; invoices: Invoice[]; maintenance: Maintenance[]; leases: Lease[]; deposit?: Deposit; depositEntries: DepositEntry[]; documents:VaultDocument[] }

const money = (paise: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(paise / 100)
const pill = (value: string) => value.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase())

export default function TenantDashboard() {
  const router = useRouter()
  const token = Array.isArray(router.query.token) ? router.query.token[0] : router.query.token
  const [data, setData] = useState<Dashboard | null>(null)
  const [error, setError] = useState("")
  const [sending, setSending] = useState(false)
  const [form, setForm] = useState({ title: "", description: "", priority: "MEDIUM" })
  const [photo, setPhoto] = useState<File | null>(null)

  const load = async () => {
    if (!token) return
    try { setData((await axios.get(`${backend}/tenant/dashboard/${encodeURIComponent(token)}`)).data); setError("") }
    catch { setError("This dashboard link is invalid, expired, or temporarily unavailable.") }
  }
  useEffect(() => { load() }, [token])

  async function submitMaintenance(event: FormEvent) {
    event.preventDefault()
    if (!token || !form.title.trim() || !form.description.trim()) return
    setSending(true); setError("")
    try {
      let photoBase64: string | undefined
      if (photo) photoBase64 = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(photo) })
      await axios.post(`${backend}/tenant/dashboard/${encodeURIComponent(token)}/maintenance`, {
        rentId: "from-secure-link", ...form, photoBase64, photoFileName: photo?.name, photoMimeType: photo?.type,
      })
      setForm({ title: "", description: "", priority: "MEDIUM" }); setPhoto(null); await load()
    } catch (e) { setError(axios.isAxiosError(e) ? String(e.response?.data?.message || e.message) : "Could not submit request") }
    finally { setSending(false) }
  }
  async function openDocument(id:string){if(!token)return;try{const result=await axios.get(`${backend}/tenant/dashboard/${encodeURIComponent(token)}/documents/${encodeURIComponent(id)}`);window.open(result.data.url,"_blank","noopener,noreferrer")}catch{setError("Could not open this document. Please try again.")}}

  if (error && !data) return <Message title="Dashboard unavailable" text={error} />
  if (!data) return <Message title="Opening your dashboard" text="Loading bills, receipts and requests…" />

  const deductions = data.depositEntries.filter(e => e.entryType === "DEDUCTION" || e.entryType === "REFUND" || e.entryType === "ADJUSTMENT_DEBIT").reduce((s, e) => s + e.amountPaise, 0)
  const credits = data.depositEntries.filter(e => e.entryType === "ADJUSTMENT_CREDIT").reduce((s, e) => s + e.amountPaise, 0)
  const depositBalance = (data.deposit?.originalAmountPaise || 0) + credits - deductions

  return <main className="min-h-screen bg-[#f4f7f6] text-[#17211f]">
    <header className="border-b border-[#dce5e2] bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4"><div><b className="text-lg">Rentomatic</b><p className="text-xs text-[#6f7e79]">Tenant home</p></div><span className="rounded-full bg-[#e7f4ef] px-3 py-1 text-xs font-semibold text-[#17634f]">Secure access</span></div></header>
    <div className="mx-auto max-w-6xl px-4 py-7">
      <p className="text-sm text-[#61716c]">Welcome back</p><h1 className="text-3xl font-bold">{data.tenantName || data.tenantEmail}</h1>
      {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Open bills" value={String(data.invoices.filter(i => i.status !== "PAID").length)} />
        <Stat label="Maintenance open" value={String(data.maintenance.filter(m => !["RESOLVED", "CLOSED"].includes(m.status)).length)} />
        <Stat label="Deposit balance" value={data.deposit ? money(depositBalance) : "Not recorded"} />
      </div>

      <section className="mt-7 grid gap-6 lg:grid-cols-[1.25fr_.75fr]">
        <div className="space-y-6">
          <Card title="Bills & receipts" subtitle="Payable invoices and completed payment records">
            {data.invoices.length ? data.invoices.map(i => <div key={i.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-[#edf1ef] py-4 first:border-0">
              <div><b>{i.invoice_number || "Rent invoice"}</b><p className="text-sm text-[#6f7e79]">Due {i.due_date || "date not set"}</p></div>
              <div className="text-right"><b>{money(i.amount)}</b><p className="text-xs font-semibold text-[#1f6f5b]">{pill(i.status)}</p></div>
              {i.payment_token && <button onClick={() => router.push(`/pay/${i.payment_token}`)} className="rounded-lg bg-[#1f6f5b] px-4 py-2 text-sm font-semibold text-white">{i.status === "PAID" ? "View receipt" : "Open bill"}</button>}
            </div>) : <Empty text="No bills have been shared yet." />}
          </Card>

          <Card title="Maintenance" subtitle="Follow every request from reported to resolved">
            {data.maintenance.length ? data.maintenance.map(m => <div key={m.id} className="border-t border-[#edf1ef] py-4 first:border-0"><div className="flex items-center justify-between"><b>{m.title}</b><span className="rounded-full bg-[#eef4f2] px-2.5 py-1 text-xs font-semibold">{pill(m.status)}</span></div><p className="mt-1 text-sm text-[#61716c]">{m.description}</p>{m.ownerNote && <p className="mt-2 rounded-lg bg-[#f6f8f7] p-3 text-sm"><b>Manager:</b> {m.ownerNote}</p>}</div>) : <Empty text="No maintenance requests." />}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Report an issue" subtitle="Add a clear photo to help your manager respond faster">
            <form onSubmit={submitMaintenance} className="space-y-3">
              <input value={form.title} onChange={e => setForm({...form, title:e.target.value})} placeholder="What needs attention?" className="w-full rounded-lg border border-[#d6e0dd] px-3 py-2.5" required />
              <textarea value={form.description} onChange={e => setForm({...form, description:e.target.value})} placeholder="Describe the issue and location" className="w-full rounded-lg border border-[#d6e0dd] px-3 py-2.5" rows={4} required />
              <select value={form.priority} onChange={e => setForm({...form, priority:e.target.value})} className="w-full rounded-lg border border-[#d6e0dd] px-3 py-2.5"><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>URGENT</option></select>
              <label className="block rounded-lg border border-dashed border-[#bfcfca] p-3 text-sm text-[#52635e]">Photo (optional, max 8 MB)<input type="file" accept="image/*" className="mt-2 block w-full text-xs" onChange={e => setPhoto(e.target.files?.[0] || null)} /></label>
              <button disabled={sending} className="w-full rounded-lg bg-[#1f6f5b] px-4 py-3 font-semibold text-white disabled:opacity-60">{sending ? "Submitting…" : "Submit request"}</button>
            </form>
          </Card>

          <Card title="Lease" subtitle="Agreement dates and renewal reminders">
            {data.leases.length ? data.leases.map(l => <div key={l.id} className="border-t border-[#edf1ef] py-3 first:border-0"><b>{l.title}</b><p className="text-sm text-[#61716c]">Ends {l.leaseEndOn} · {pill(l.status)}</p></div>) : <Empty text="No lease document shared yet." />}
          </Card>
          <Card title="Document vault" subtitle="Documents your property manager shared with you">
            {data.documents?.length ? data.documents.map(d=><button key={d.id} onClick={()=>openDocument(d.id)} className="flex w-full items-center justify-between border-t py-3 text-left first:border-0"><span><b>{d.title}</b><span className="block text-sm text-[#61716c]">{d.category.replace(/_/g," ")} · {d.fileName}</span></span><span className="text-sm font-semibold text-[#1f6f5b]">Open</span></button>) : <Empty text="No documents have been shared with you." />}
          </Card>

          <Card title="Security deposit" subtitle="Receipts, deductions and refunds recorded by your manager">
            {data.deposit ? <><div className="flex justify-between py-2"><span>Original deposit</span><b>{money(data.deposit.originalAmountPaise)}</b></div><div className="flex justify-between border-t py-3"><span>Current balance</span><b>{money(depositBalance)}</b></div>{data.depositEntries.map(e => <div key={e.id} className="border-t py-3 text-sm"><div className="flex justify-between"><b>{pill(e.entryType)}</b><b>{money(e.amountPaise)}</b></div><p className="text-[#61716c]">{e.description} · {e.occurredOn}</p></div>)}</> : <Empty text="No security deposit ledger has been shared." />}
          </Card>
        </div>
      </section>
    </div>
  </main>
}

function Card({title, subtitle, children}:{title:string; subtitle:string; children:React.ReactNode}) { return <section className="rounded-xl border border-[#dce5e2] bg-white p-5 shadow-sm"><h2 className="text-xl font-bold">{title}</h2><p className="mb-3 mt-1 text-sm text-[#6f7e79]">{subtitle}</p>{children}</section> }
function Stat({label,value}:{label:string;value:string}) { return <div className="rounded-xl border border-[#dce5e2] bg-white p-5"><p className="text-sm text-[#6f7e79]">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></div> }
function Empty({text}:{text:string}) { return <p className="rounded-lg bg-[#f7f9f8] p-4 text-sm text-[#6f7e79]">{text}</p> }
function Message({title,text}:{title:string;text:string}) { return <main className="grid min-h-screen place-items-center bg-[#f4f7f6] p-6"><div className="max-w-md rounded-xl border bg-white p-7 text-center shadow-sm"><h1 className="text-2xl font-bold">{title}</h1><p className="mt-3 text-[#61716c]">{text}</p></div></main> }
