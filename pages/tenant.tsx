import axios from "axios"
import { FormEvent, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/router"
import { tenantAuth } from "../lib/tenantAuth"
import { OWNER_BACKEND_BASE_URL } from "../lib/sharedRules"
import { tenantRoutes } from "../lib/tenantRoutes"

type Invoice = {
  id: string
  invoice_number?: string
  due_date?: string
  amount: number
  paid_amount?: number
  credited_amount?: number
  refunded_amount?: number
  late_fee_paise?: number
  grace_period_days?: number
  status: string
  payment_token?: string
}

export type TenantUtilityAccount = {
  id: string
  rent_id: string
  utility_type: "ELECTRICITY" | "GAS"
  operator_id: string
  operator_name: string
  consumer_number: string
  account_holder_name?: string
}

export type TenantUtilityBill = {
  id: string
  utility_account_id: string
  rent_id: string
  provider: string
  billing_period?: string
  bill_amount_paise: number
  due_date?: string
  consumer_name?: string
  units_consumed?: number
  status: "UNPAID" | "PAYMENT_PENDING" | "SETTLEMENT_PENDING" | "PAID" | "OVERDUE" | "CANCELLED" | "REVIEW_REQUIRED"
  paid_at?: string
}

export type TenantUtilityReceipt = {
  id: string
  bill_id: string
  receipt_number: string
  storage_path: string
}

type Dashboard = {
  rentId: string
  tenantId?: string
  tenantName?: string
  tenantEmail: string
  invoices: Invoice[]
  maintenance: any[]
  leases: any[]
  documents: any[]
  notifications: any[]
  deposit?: { originalAmountPaise: number }
  depositEntries: any[]
  utilityAccounts?: TenantUtilityAccount[]
  utilityBills?: TenantUtilityBill[]
  utilityReceipts?: TenantUtilityReceipt[]
}

type Attachment = {
  id: string
  fileName: string
  stage: string
  uploadedBy: string
  url: string
}

type Household = {
  id: string
  rentId: string
  name: string
  relationship: string
  phone?: string
  email?: string
}

type ProfilePayload = {
  profile: {
    fullName: string
    phone?: string
    emergencyContactName?: string
    emergencyContactPhone?: string
  }
  household: Household[]
}

type Tab = "home" | "bills" | "utilities" | "maintenance" | "documents" | "lease" | "profile"

const api = process.env.NEXT_PUBLIC_BACKEND_BASE_URL || OWNER_BACKEND_BASE_URL
axios.defaults.timeout = 90_000

const money = (p: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(p / 100)

const outstanding = (invoice: Invoice) =>
  Math.max(0, invoice.amount + (invoice.late_fee_paise || 0) - (invoice.paid_amount || 0) - (invoice.credited_amount || 0))

const title = (s: string) =>
  s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())

const maintenanceStatusLabel = (status: string) => ({
  ISSUE_REPORTED: "Reported",
  OPEN: "Reported",
  TRIAGED: "Reviewed",
  ACKNOWLEDGED: "Reviewed",
  WORK_ORDER_CREATED: "Work order created",
  VENDOR_ASSIGNED: "Technician assigned",
  ASSIGNED: "Technician assigned",
  SCHEDULED: "Visit scheduled",
  IN_PROGRESS: "Work in progress",
  INSPECTION_PENDING: "Awaiting inspection",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
  REOPENED: "Reopened",
} as Record<string, string>)[status] || title(status)

const maintenanceStage = (status: string) => {
  if (["RESOLVED", "CLOSED"].includes(status)) return 4
  if (["IN_PROGRESS", "INSPECTION_PENDING"].includes(status)) return 3
  if (["WORK_ORDER_CREATED", "VENDOR_ASSIGNED", "ASSIGNED", "SCHEDULED"].includes(status)) return 2
  if (["TRIAGED", "ACKNOWLEDGED"].includes(status)) return 1
  return 0
}

const retryableReadStatuses = new Set([429, 502, 503, 504])

async function authenticatedGet<T = any>(url: string, access: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await axios.get<T>(url, { timeout: 90_000, headers: { Authorization: `Bearer ${access}` } })
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined
      if (attempt === 2 || !status || !retryableReadStatuses.has(status)) throw error
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt))
    }
  }
  throw new Error("Request failed")
}

export default function TenantHome() {
  const router = useRouter()
  const [items, setItems] = useState<Dashboard[]>([])
  const [selected, setSelected] = useState(0)
  const [tab, setTab] = useState<Tab>("home")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const [issue, setIssue] = useState({ title: "", description: "", category: "PLUMBING", priority: "MEDIUM" })
  const [photo, setPhoto] = useState<File | null>(null)
  const [vault, setVault] = useState({ title: "", category: "OTHER" })
  const [vaultFile, setVaultFile] = useState<File | null>(null)
  const [message, setMessage] = useState("")
  const [progress, setProgress] = useState(0)
  const [attachments, setAttachments] = useState<Record<string, Attachment[]>>({})
  const [profile, setProfile] = useState<ProfilePayload>({ profile: { fullName: "" }, household: [] })
  const [member, setMember] = useState({ name: "", relationship: "OTHER", phone: "", email: "" })

  async function token() {
    return (await tenantAuth?.auth.getSession()).data.session?.access_token
  }

  async function load() {
    const access = await token()
    if (!access) {
      router.replace("/login")
      return
    }
    try {
      const [r, p] = await Promise.all([
        authenticatedGet(`${api}${tenantRoutes.dashboard}`, access),
        authenticatedGet(`${api}${tenantRoutes.profile}`, access).catch(() => ({
          data: { profile: { fullName: "" }, household: [] },
        })),
      ])
      setItems(r.data.accounts)
      setProfile(p.data)
      setSelected((current) => Math.min(current, Math.max(0, r.data.accounts.length - 1)))
      setError("")
    } catch (e) {
      if (axios.isAxiosError(e) && e.response?.status === 401) {
        await tenantAuth?.auth.signOut()
        router.replace("/login")
        return
      }
      setError(axios.isAxiosError(e) ? String(e.response?.data?.message || e.message) : "Could not load your tenant portal")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    if (!router.isReady || !items.length) return
    const tenancy = typeof router.query.tenancy === "string" ? router.query.tenancy : ""
    if (!tenancy) return
    const match = items.findIndex((item) => item.tenantId === tenancy || item.rentId === tenancy)
    if (match >= 0) setSelected(match)
  }, [items, router.isReady, router.query.tenancy])

  const d = items[selected]
  const openBills = useMemo(
    () => d?.invoices.filter((x) => ["ISSUED", "PARTIALLY_PAID", "OVERDUE", "PENDING", "UNPAID"].includes(x.status)) || [],
    [d]
  )
  const paid = useMemo(() => d?.invoices.filter((x) => x.status === "PAID") || [], [d])

  function selectTenancy(index: number) {
    const account = items[index]
    setSelected(index)
    setTab("home")
    if (account) {
      router.replace({ pathname: "/tenant", query: { tenancy: account.tenantId || account.rentId } }, undefined, { shallow: true })
    }
  }

  async function logout() {
    await tenantAuth?.auth.signOut()
    router.replace("/login")
  }

  async function logoutEverywhere() {
    if (!confirm("Sign out of Rentomatic on every device?")) return
    await tenantAuth?.auth.signOut({ scope: "global" })
    router.replace("/login")
  }

  async function report(e: FormEvent) {
    e.preventDefault()
    if (!d) return
    setBusy(true)
    setError("")
    setMessage("")
    try {
      const access = await token()
      let photoBase64: string | undefined
      if (photo) photoBase64 = await fileData(photo)
      await axios.post(
        `${api}${tenantRoutes.maintenance}`,
        { rentId: d.rentId, ...issue, photoBase64, photoFileName: photo?.name, photoMimeType: photo?.type },
        { headers: { Authorization: `Bearer ${access}` } }
      )
      setIssue({ title: "", description: "", category: "PLUMBING", priority: "MEDIUM" })
      setPhoto(null)
      setMessage("Maintenance request submitted. Your property manager can now review it.")
      await load()
    } catch (e) {
      setError(axios.isAxiosError(e) ? String(e.response?.data?.message || e.message) : "Could not submit request")
    } finally {
      setBusy(false)
    }
  }

  async function openDoc(id: string) {
    try {
      const access = await token()
      if (!access) throw new Error("Session expired")
      const r = await authenticatedGet(`${api}${tenantRoutes.document(id)}`, access)
      window.open(r.data.url, "_blank", "noopener,noreferrer")
    } catch {
      setError("Could not open this document. Please retry.")
    }
  }

  async function loadAttachments(id: string) {
    const access = await token()
    if (!access) return
    try {
      const r = await authenticatedGet(`${api}${tenantRoutes.maintenanceAttachments(id)}`, access)
      setAttachments((x) => ({ ...x, [id]: r.data }))
    } catch {
      setError("Could not load maintenance photos. Please retry.")
    }
  }

  async function uploadDoc(e: FormEvent) {
    e.preventDefault()
    if (!d || !vaultFile) return
    setBusy(true)
    setError("")
    setMessage("")
    try {
      if (!["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(vaultFile.type))
        throw new Error("Choose a PDF, JPG, PNG or WebP file.")
      if (vaultFile.size > 10 * 1024 * 1024) throw new Error("File must be 10 MB or smaller.")
      const access = await token()
      setProgress(20)
      await axios.post(
        `${api}${tenantRoutes.documents}`,
        {
          rentId: d.rentId,
          title: vault.title,
          category: vault.category,
          fileName: vaultFile.name,
          mimeType: vaultFile.type,
          documentBase64: await fileData(vaultFile),
          tenantVisible: true,
        },
        {
          headers: { Authorization: `Bearer ${access}` },
          onUploadProgress: (e) => e.total && setProgress(20 + Math.round((e.loaded / e.total) * 80)),
        }
      )
      setVault({ title: "", category: "OTHER" })
      setVaultFile(null)
      setProgress(100)
      setMessage("Document uploaded securely and shared with your property manager.")
      await load()
    } catch (e) {
      setError(axios.isAxiosError(e) ? String(e.response?.data?.message || e.message) : e instanceof Error ? e.message : "Could not upload document")
    } finally {
      setBusy(false)
      setTimeout(() => setProgress(0), 800)
    }
  }

  async function replaceDoc(id: string, file: File | null) {
    if (!file) return
    setBusy(true)
    try {
      if (!["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024)
        throw new Error("Choose a PDF or image up to 10 MB.")
      const access = await token()
      setProgress(5)
      await axios.post(
        `${api}${tenantRoutes.documentReplace(id)}`,
        { fileName: file.name, mimeType: file.type, documentBase64: await fileData(file) },
        {
          headers: { Authorization: `Bearer ${access}` },
          onUploadProgress: (e) => e.total && setProgress(Math.round((e.loaded / e.total) * 100)),
        }
      )
      setMessage("Document replaced. Its revision history was preserved.")
      await load()
    } catch (e) {
      setError(axios.isAxiosError(e) ? String(e.response?.data?.message || e.message) : e instanceof Error ? e.message : "Replacement failed")
    } finally {
      setBusy(false)
      setTimeout(() => setProgress(0), 800)
    }
  }

  async function saveProfile(e: FormEvent) {
    e.preventDefault()
    const access = await token()
    if (!access) return
    setBusy(true)
    try {
      await axios.post(`${api}${tenantRoutes.profile}`, profile.profile, { headers: { Authorization: `Bearer ${access}` } })
      setMessage("Profile saved.")
      await load()
    } catch (e) {
      setError(axios.isAxiosError(e) ? String(e.response?.data?.message || e.message) : "Could not save profile")
    } finally {
      setBusy(false)
    }
  }

  async function addMember(e: FormEvent) {
    e.preventDefault()
    if (!d) return
    const access = await token()
    if (!access) return
    setBusy(true)
    try {
      await axios.post(`${api}${tenantRoutes.household}`, { ...member, rentId: d.rentId }, { headers: { Authorization: `Bearer ${access}` } })
      setMember({ name: "", relationship: "OTHER", phone: "", email: "" })
      setMessage("Household member added.")
      await load()
    } catch (e) {
      setError(axios.isAxiosError(e) ? String(e.response?.data?.message || e.message) : "Could not add member")
    } finally {
      setBusy(false)
    }
  }

  async function removeMember(id: string) {
    if (!confirm("Remove this household member?")) return
    const access = await token()
    if (!access) return
    await axios.delete(`${api}${tenantRoutes.householdMember(id)}`, { headers: { Authorization: `Bearer ${access}` } })
    await load()
  }

  async function reopen(id: string) {
    const reason = prompt("Tell your property manager why this needs more work")?.trim()
    if (!reason) return
    const access = await token()
    await axios.post(`${api}${tenantRoutes.maintenanceReopen(id)}`, { reason }, { headers: { Authorization: `Bearer ${access}` } })
    setMessage("Request reopened and your property manager was notified.")
    await load()
  }

  async function cancelMaintenance(id: string) {
    if (!confirm("Cancel this maintenance request? It will remain in your history.")) return
    const access = await token()
    await axios.post(`${api}${tenantRoutes.maintenanceCancel(id)}`, {}, { headers: { Authorization: `Bearer ${access}` } })
    setMessage("Maintenance request cancelled.")
    await load()
  }

  async function acknowledgeLease(id: string) {
    const note = prompt("Optional acknowledgement note") || undefined
    const access = await token()
    await axios.post(`${api}${tenantRoutes.leaseAcknowledge(id)}`, { note }, { headers: { Authorization: `Bearer ${access}` } })
    setMessage("Lease acknowledged.")
    await load()
  }

  async function openLease(id: string) {
    try {
      const access = await token()
      if (!access) throw new Error("Session expired")
      const r = await authenticatedGet(`${api}${tenantRoutes.leaseDownload(id)}`, access)
      window.open(r.data.url, "_blank", "noopener,noreferrer")
    } catch {
      setError("Could not open the lease. Please retry.")
    }
  }

  if (loading) return <Message text="Opening your tenant portal…" />
  if (!d)
    return (
      <Message
        text={
          error || "Your email address is not assigned to a Tenant ID yet. Ask your property manager to add it."
        }
      />
    )

  const balance =
    (d.deposit?.originalAmountPaise || 0) +
    d.depositEntries.filter((x) => x.entryType === "ADJUSTMENT_CREDIT").reduce((s, x) => s + x.amountPaise, 0) -
    d.depositEntries.filter((x) => ["DEDUCTION", "REFUND", "ADJUSTMENT_DEBIT"].includes(x.entryType)).reduce((s, x) => s + x.amountPaise, 0)

  return (
    <main className="min-h-screen bg-[var(--rm-bg)] pb-24 text-[var(--rm-text)] md:pb-0">
      <header className="sticky top-0 z-30 border-b border-[#ccd5e4] bg-[#f4f7fb]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2151c5] font-bold text-white shadow-sm">
              R
            </span>
            <div>
              <b className="text-lg font-semibold tracking-tight text-[#182133]">Rentomatic</b>
              <p className="text-xs text-[#68716c]">Tenant ID · {d.tenantId || "Pending"}</p>
            </div>
          </div>
          <button
            onClick={() => setTab("profile")}
            className="rounded-xl border border-[#ccd5e4] bg-white px-4 py-2 text-sm font-semibold text-[#182133] shadow-sm transition hover:border-[#b4c2d6] hover:bg-[#f0f6ff]"
          >
            Account
          </button>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-7 px-4 py-6 sm:px-6 md:grid-cols-[220px_1fr] lg:py-8">
        <aside className="hidden h-fit rounded-2xl border border-[#ccd5e4] bg-white p-3 shadow-[var(--rm-shadow)] md:block">
          <label className="block p-2 text-xs font-bold uppercase tracking-wider text-[#60708d]">Your tenancy</label>
          {items.length > 1 ? (
            <select
              className="mb-3 w-full rounded-[14px] border border-[#ccd5e4] bg-[#fcfdff] p-2.5 text-sm font-semibold text-[#182133] outline-none focus:border-[#2151c5]"
              value={selected}
              onChange={(e) => {
                selectTenancy(Number(e.target.value))
              }}
            >
              {items.map((x, i) => (
                <option value={i} key={`${x.tenantId}-${x.rentId}`}>
                  {x.tenantId || "Tenant"} · {x.tenantName}
                </option>
              ))}
            </select>
          ) : (
            <div className="mb-3 rounded-[14px] border border-[#dde7ff] bg-[#f4f8ff] p-3">
              <b className="text-sm font-bold text-[#2151c5]">{d.tenantId || "Tenant ID pending"}</b>
              <p className="text-xs text-[#60708d]">{d.tenantName}</p>
            </div>
          )}
          {(["home", "bills", "utilities", "maintenance", "documents", "lease", "profile"] as Tab[]).map((x) => (
            <button
              key={x}
              onClick={() => setTab(x)}
              className={`mb-1 w-full rounded-xl px-3.5 py-2.5 text-left text-sm font-semibold transition ${
                tab === x ? "bg-[#2151c5] text-white shadow-sm" : "text-[#33415c] hover:bg-[#f0f6ff]"
              }`}
            >
              {x === "utilities" ? "⚡ Electricity Bills" : x === "bills" ? "Rent Invoices" : title(x)}
            </button>
          ))}
        </aside>

        <section>
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-[#d3def1] bg-[#f0f6ff] px-5 py-5 sm:px-6">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#2151c5]">
                {tab === "home" ? "Your home" : "Tenant workspace"}
              </p>
              <h1 className="mt-1 text-3xl font-semibold tracking-[-0.025em] text-[#182133]">
                {tab === "home" ? `Welcome, ${d.tenantName || d.tenantEmail}` : title(tab)}
              </h1>
            </div>
            {items.length > 1 && (
              <span className="rounded-full border border-[#dde7ff] bg-[#dde7ff] px-3.5 py-1 text-xs font-semibold text-[#1a42a5]">
                {items.length} tenancies linked to this email account
              </span>
            )}
          </div>

          {items.length > 1 && (
            <label className="mb-5 block rounded-[20px] border border-[#ccd5e4] bg-white p-3.5 shadow-sm md:hidden">
              <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-[#60708d]">Switch tenancy</span>
              <select
                className="w-full rounded-[14px] border border-[#ccd5e4] bg-[#fcfdff] p-3 font-semibold text-[#182133]"
                value={selected}
                onChange={(e) => {
                  selectTenancy(Number(e.target.value))
                }}
              >
                {items.map((x, i) => (
                  <option value={i} key={`${x.tenantId}-${x.rentId}`}>
                    {x.tenantId || "Tenant"} · {x.tenantName}
                  </option>
                ))}
              </select>
            </label>
          )}

          {error && (
            <p className="mb-4 rounded-[14px] border border-[#f8c8c2] bg-[#fee4e1] p-4 text-sm font-medium text-[#9b2a1a]">
              {error}
            </p>
          )}

          {message && (
            <p className="mb-4 rounded-[14px] border border-[#b0e5d8] bg-[#d7f4ec] p-4 text-sm font-medium text-[#096352]">
              {message}
            </p>
          )}

          {tab === "home" && (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <Stat label="Amount due" value={money(openBills.reduce((sum, invoice) => sum + outstanding(invoice), 0))} accent />
                <Stat label="Open requests" value={String(d.maintenance.filter((x) => !["RESOLVED", "CLOSED", "CANCELLED"].includes(x.status)).length)} />
                <Stat label="Deposit balance" value={d.deposit ? money(balance) : "Not recorded"} />
              </div>
              {d.notifications?.length > 0 && (
                <Card title="Recent updates">
                  {d.notifications.slice(0, 5).map((n: any) => (
                    <div key={n.id} className="border-b border-[#ccd5e4]/50 py-3 last:border-b-0">
                      <b className="font-bold text-[#182133]">{n.title}</b>
                      <p className="text-sm text-[#60708d]">{n.message}</p>
                    </div>
                  ))}
                </Card>
              )}
              <Card title="Next actions">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Action
                    text={openBills.length ? `${openBills.length} bill${openBills.length > 1 ? "s" : ""} need attention` : "Rent is up to date"}
                    go={() => setTab("bills")}
                  />
                  <Action text="Report or track maintenance" go={() => setTab("maintenance")} />
                  <Action text={`${d.documents.length} shared document${d.documents.length === 1 ? "" : "s"}`} go={() => setTab("documents")} />
                </div>
              </Card>
            </>
          )}

          {tab === "bills" && (
            <Card title="Rent Invoices & Receipts">
              <h3 className="text-base font-bold text-[#182133]">To pay</h3>
              {openBills.length ? (
                openBills.map((x) => <Bill key={x.id} x={x} open={() => x.payment_token && router.push(`/pay/${x.payment_token}`)} />)
              ) : (
                <Empty text="No rent is currently due." />
              )}
              <h3 className="mt-8 text-base font-bold text-[#182133]">Rent Payment history</h3>
              {paid.length ? (
                paid.map((x) => <Bill key={x.id} x={x} open={() => x.payment_token && router.push(`/pay/${x.payment_token}`)} />)
              ) : (
                <Empty text="No rent receipts yet." />
              )}
            </Card>
          )}

          {tab === "utilities" && (
            <Card title="⚡ Electricity & Utility Bills">
              {(() => {
                const accounts = d.utilityAccounts || []
                const bills = d.utilityBills || []
                const receipts = d.utilityReceipts || []

                const dueNowBills = bills.filter(b => b.status === "UNPAID" || b.status === "PAYMENT_PENDING" || b.status === "OVERDUE")
                const processingBills = bills.filter(b => b.status === "SETTLEMENT_PENDING")
                const paidBills = bills.filter(b => b.status === "PAID")

                return (
                  <div className="space-y-6">
                    {/* 1. DUE NOW GROUP */}
                    <div>
                      <h3 className="text-base font-bold text-[#182133]">Due Now</h3>
                      {dueNowBills.length === 0 ? (
                        <div className="mt-2 rounded-[16px] border border-[#eef3fa] bg-[#f8fafc] p-4 text-xs text-[#60708d]">
                          No utility bills are currently due for payment.
                        </div>
                      ) : (
                        <div className="mt-3 space-y-3">
                          {dueNowBills.map(bill => {
                            const acc = accounts.find(a => a.id === bill.utility_account_id)
                            const opName = acc?.operator_name || "Electricity Provider"
                            const consumer = acc?.consumer_number || bill.consumer_name || ""

                            return (
                              <div key={bill.id} className="rounded-[20px] border border-[#dbe4f0] bg-white p-5 shadow-sm transition hover:shadow-md">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#dde7ff] text-xs font-bold text-[#1f6ad8]">⚡</span>
                                      <h4 className="font-bold text-[#182133]">{opName}</h4>
                                    </div>
                                    <p className="mt-1 text-xs text-[#60708d]">
                                      Consumer No: <span className="font-mono font-semibold text-[#182133]">••••••{consumer.slice(-6)}</span> {bill.due_date ? `· Due ${bill.due_date}` : ""}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <span className="text-lg font-extrabold text-[#182133]">{money(bill.bill_amount_paise)}</span>
                                    <span className="ml-2 rounded-full bg-[#ffe4e1] px-2 py-0.5 text-[11px] font-bold text-[#9b2a1f]">DUE</span>
                                  </div>
                                </div>

                                <div className="mt-4 flex gap-2 border-t border-[#f0f4f9] pt-3">
                                  <button
                                    onClick={async () => {
                                      try {
                                        const access = await token()
                                        const res = await axios.post(
                                          `${api}/tenant/utility-bills/${bill.id}/payment-order`,
                                          {},
                                          { headers: { Authorization: `Bearer ${access}` } }
                                        )
                                        if (res.data?.paymentToken) {
                                          router.push(`/pay/${res.data.paymentToken}`)
                                        } else if (res.data?.paymentUrl) {
                                          router.push(res.data.paymentUrl)
                                        } else {
                                          alert(res.data?.message || "Could not initialize checkout. Please try again.")
                                        }
                                      } catch (err: any) {
                                        alert(err.response?.data?.message || "Failed to initialize payment checkout")
                                      }
                                    }}
                                    className="rounded-[12px] bg-[#1f6ad8] px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#144eb0]"
                                  >
                                    Review & Pay Now →
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    {/* 2. PROCESSING GROUP */}
                    <div>
                      <h3 className="text-base font-bold text-[#182133]">Processing Settlements</h3>
                      {processingBills.length === 0 ? (
                        <div className="mt-2 rounded-[16px] border border-[#eef3fa] bg-[#f8fafc] p-4 text-xs text-[#60708d]">
                          No utility payments are currently in settlement processing.
                        </div>
                      ) : (
                        <div className="mt-2 space-y-2">
                          {processingBills.map(bill => {
                            const acc = accounts.find(a => a.id === bill.utility_account_id)
                            return (
                              <div key={bill.id} className="rounded-[16px] border border-[#f0dfa0] bg-[#fffdf2] p-4 text-xs text-[#8a6000]">
                                <div className="flex items-center justify-between font-bold">
                                  <div className="flex items-center gap-2">
                                    <span>⏳</span>
                                    <span>Payment received — Settlement in progress for {acc?.operator_name || "DISCOM"}</span>
                                  </div>
                                  <span>{money(bill.bill_amount_paise)}</span>
                                </div>
                                <p className="mt-1 text-[#60708d]">
                                  Your payment of {money(bill.bill_amount_paise)} is being cleared directly with your electricity board via Bharat Connect. No further action is required.
                                </p>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    {/* 3. HISTORY GROUP */}
                    <div>
                      <h3 className="text-base font-bold text-[#182133]">Payment History & Official Receipts</h3>
                      {paidBills.length === 0 ? (
                        <div className="mt-2 rounded-[16px] border border-[#eef3fa] bg-[#f8fafc] p-4 text-xs text-[#60708d]">
                          No settled utility receipts on record yet.
                        </div>
                      ) : (
                        <div className="mt-3 overflow-hidden rounded-[16px] border border-[#dbe4f0] bg-white">
                          <table className="w-full text-left text-xs">
                            <thead className="border-b border-[#dbe4f0] bg-[#f8fafc] text-[#60708d]">
                              <tr>
                                <th className="p-3.5 font-semibold">Utility Board</th>
                                <th className="p-3.5 font-semibold">Billing Period</th>
                                <th className="p-3.5 font-semibold">Amount</th>
                                <th className="p-3.5 font-semibold">Status</th>
                                <th className="p-3.5 font-semibold">Receipt</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#eef3fa]">
                              {paidBills.map(bill => {
                                const acc = accounts.find(a => a.id === bill.utility_account_id)

                                return (
                                  <tr key={bill.id}>
                                    <td className="p-3.5 font-bold text-[#182133]">{acc?.operator_name || "Electricity Board"}</td>
                                    <td className="p-3.5 text-[#60708d]">{bill.billing_period || bill.due_date || "—"}</td>
                                    <td className="p-3.5 font-bold text-[#182133]">{money(bill.bill_amount_paise)}</td>
                                    <td className="p-3.5">
                                      <span className="rounded-full bg-[#d4f4e2] px-2 py-0.5 text-[10px] font-bold text-[#1a6641]">
                                        BBPS CLEARED
                                      </span>
                                    </td>
                                    <td className="p-3.5">
                                      <button
                                        onClick={async () => {
                                          const access = await token()
                                          if (!access) return
                                          window.open(`${api}/utility/receipts/${bill.id}/download?token=${encodeURIComponent(access)}`, "_blank")
                                        }}
                                        className="rounded-[8px] border border-[#dbe4f0] px-2.5 py-1 text-[11px] font-semibold text-[#1f6ad8] hover:bg-[#f4f8ff]"
                                      >
                                        Download Receipt
                                      </button>
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })()}
            </Card>
          )}

          {tab === "maintenance" && (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card title="Report a Maintenance Issue">
                <p className="mb-4 rounded-xl border border-[#c7d7f5] bg-[#f0f6ff] px-4 py-3 text-xs leading-5 text-[#33415c]">
                  Requests, photos and status updates are shared with your property manager in the same maintenance record.
                </p>
                <form onSubmit={report} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-[#60708d]">Category</label>
                    <div className="mt-1.5 grid grid-cols-4 gap-1.5">
                      {[
                        { id: "PLUMBING", label: "🚰 Plumbing" },
                        { id: "ELECTRICAL", label: "⚡ Electrical" },
                        { id: "HVAC", label: "❄️ AC / HVAC" },
                        { id: "APPLIANCE", label: "📺 Appliance" },
                        { id: "CARPENTRY", label: "🚪 Carpentry" },
                        { id: "PAINTING", label: "🎨 Painting" },
                        { id: "CLEANING", label: "🧹 Cleaning" },
                        { id: "OTHER", label: "🛠️ Other" },
                      ].map((cat) => (
                        <button
                          type="button"
                          key={cat.id}
                          onClick={() => setIssue({ ...issue, category: cat.id })}
                          className={`rounded-xl py-2 px-1 text-center text-xs font-bold transition ${
                            issue.category === cat.id
                              ? "bg-[#1f6ad8] text-white shadow-sm"
                              : "bg-[#f1f5fa] text-[#182133] hover:bg-[#e2eaf5]"
                          }`}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#60708d]">What needs attention?</label>
                    <input
                      required
                      className="input mt-1"
                      placeholder="e.g. Tap leaking in master bathroom"
                      value={issue.title}
                      onChange={(e) => setIssue({ ...issue, title: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#60708d]">Detailed Description</label>
                    <textarea
                      required
                      rows={3}
                      className="input mt-1"
                      placeholder="Describe the issue, exact location, or preferred technician visit timing..."
                      value={issue.description}
                      onChange={(e) => setIssue({ ...issue, description: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#60708d]">Urgency / Priority</label>
                    <div className="mt-1.5 grid grid-cols-4 gap-2">
                      {[
                        { id: "LOW", label: "Low", color: "bg-emerald-50 text-emerald-800 border-emerald-200" },
                        { id: "MEDIUM", label: "Medium", color: "bg-blue-50 text-blue-800 border-blue-200" },
                        { id: "HIGH", label: "High", color: "bg-amber-50 text-amber-800 border-amber-200" },
                        { id: "URGENT", label: "Urgent", color: "bg-red-50 text-red-800 border-red-200" },
                      ].map((pri) => (
                        <button
                          type="button"
                          key={pri.id}
                          onClick={() => setIssue({ ...issue, priority: pri.id })}
                          className={`rounded-xl border py-2 text-center text-xs font-bold transition ${
                            issue.priority === pri.id
                              ? `${pri.color} ring-2 ring-[#1f6ad8]`
                              : "border-[#dbe4f0] bg-white text-[#60708d] hover:bg-slate-50"
                          }`}
                        >
                          {pri.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#60708d]">Photo Attachment (Optional)</label>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="input mt-1 file:mr-3 file:rounded-lg file:border-0 file:bg-[#dde7ff] file:px-3 file:py-1 file:text-xs file:font-semibold file:text-[#1a42a5]"
                      onChange={(e) => setPhoto(e.target.files?.[0] || null)}
                    />
                    {photo && (
                      <div className="mt-2 flex items-center justify-between rounded-xl bg-blue-50/60 p-2 text-xs font-semibold text-[#1a42a5]">
                        <span>📷 {photo.name}</span>
                        <button type="button" onClick={() => setPhoto(null)} className="text-red-600 hover:text-red-800">
                          Remove
                        </button>
                      </div>
                    )}
                  </div>

                  <button disabled={busy} className="btn-primary w-full py-3 text-sm font-bold shadow-md">
                    {busy ? "Submitting Request…" : "Submit Maintenance Request"}
                  </button>
                </form>
              </Card>

              <Card title="Your Maintenance Requests">
                {d.maintenance.length ? (
                  <div className="space-y-4">
                    {d.maintenance.map((x) => {
                      const isClosed = ["RESOLVED", "CLOSED"].includes(x.status)
                      const isCancelled = x.status === "CANCELLED"
                      const canCancel = ["ISSUE_REPORTED", "OPEN", "TRIAGED", "REOPENED"].includes(x.status)
                      const isProgress = ["TRIAGED", "ACKNOWLEDGED", "WORK_ORDER_CREATED", "VENDOR_ASSIGNED", "IN_PROGRESS", "INSPECTION_PENDING", "SCHEDULED", "ASSIGNED", "REOPENED"].includes(x.status)
                      const stage = maintenanceStage(x.status)

                      return (
                        <div key={x.id} className="rounded-2xl border border-[#dbe4f0] bg-white p-4 shadow-sm transition hover:border-[#b4cbef]">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700">
                                  {x.category ? `${x.category}` : "REPAIR"}
                                </span>
                                <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                                  x.priority === "URGENT"
                                    ? "bg-red-100 text-red-800"
                                    : x.priority === "HIGH"
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-slate-100 text-slate-700"
                                }`}>
                                  {x.priority || "MEDIUM"}
                                </span>
                              </div>
                              <h4 className="mt-1.5 text-sm font-bold text-[#182133]">{x.title}</h4>
                            </div>

                            <span
                              className={`rounded-full px-3 py-0.5 text-xs font-bold ${
                                isClosed
                                  ? "bg-emerald-100 text-emerald-800"
                                  : isCancelled
                                  ? "bg-slate-100 text-slate-700"
                                  : isProgress
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-blue-100 text-blue-800"
                              }`}
                            >
                              {maintenanceStatusLabel(x.status || "ISSUE_REPORTED")}
                            </span>
                          </div>

                          <p className="mt-2 text-xs text-[#60708d]">{x.description}</p>

                          <div className="mt-3 grid grid-cols-5 gap-1" aria-label={`Maintenance progress: ${maintenanceStatusLabel(x.status)}`}>
                            {["Reported", "Reviewed", "Assigned", "Repair", "Done"].map((label, index) => (
                              <div key={label} className="min-w-0 text-center">
                                <div className={`h-1.5 rounded-full ${index <= stage ? "bg-[#2151c5]" : "bg-[#dbe4f0]"}`} />
                                <span className={`mt-1 block truncate text-[9px] font-semibold ${index <= stage ? "text-[#1a42a5]" : "text-[#8491a6]"}`}>{label}</span>
                              </div>
                            ))}
                          </div>

                          <div className="mt-3 border-l-2 border-[#1f6ad8] pl-3 text-xs space-y-1.5 text-[#60708d]">
                            <p>
                              <strong className="text-[#182133]">Reported:</strong>{" "}
                              {x.createdAt ? new Date(x.createdAt).toLocaleString() : "Recently"}
                            </p>
                            {x.assigneeName && (
                              <div className="rounded-xl bg-blue-50/80 p-2 text-xs text-[#1a42a5] flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <span className="font-bold">🔧 Assigned Technician:</span> {x.assigneeName}
                                  {x.assigneeContact ? ` · ${x.assigneeContact}` : ""}
                                </div>
                                {x.assigneeContact && (
                                  <div className="flex gap-1.5">
                                    <a
                                      href={`https://wa.me/${x.assigneeContact.replace(/[^0-9]/g, "")}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="rounded-lg bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-emerald-700"
                                    >
                                      WhatsApp
                                    </a>
                                    <a
                                      href={`tel:${x.assigneeContact}`}
                                      className="rounded-lg border border-[#ccd5e4] bg-white px-2 py-0.5 text-[10px] font-bold text-[#182133] hover:bg-slate-50"
                                    >
                                      Call
                                    </a>
                                  </div>
                                )}
                              </div>
                            )}
                            {x.appointmentAt && (
                              <p className="text-indigo-900 font-medium">
                                📅 <strong>Technician Visit:</strong> {new Date(x.appointmentAt).toLocaleString()}
                              </p>
                            )}
                            {x.ownerNote && (
                              <p className="text-blue-900 font-medium">
                                💬 <strong>Manager note:</strong> {x.ownerNote}
                              </p>
                            )}
                            {x.resolvedAt && (
                              <p className="text-emerald-700 font-bold">
                                ✓ <strong>Resolved:</strong> {new Date(x.resolvedAt).toLocaleString()}
                              </p>
                            )}
                          </div>

                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#f0f4f9] pt-3">
                            <button
                              onClick={() => loadAttachments(x.id)}
                              className="rounded-xl border border-[#dbe4f0] bg-white px-3 py-1.5 text-xs font-semibold text-[#182133] hover:bg-[#f4f7fb]"
                            >
                              📷 {attachments[x.id] ? "Hide Photos" : "Show Photos"}
                            </button>

                            {isClosed && (
                              <button
                                onClick={() => reopen(x.id)}
                                className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100"
                              >
                                Reopen Request
                              </button>
                            )}
                            {canCancel && (
                              <button
                                onClick={() => cancelMaintenance(x.id)}
                                className="rounded-xl border border-red-200 bg-white px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50"
                              >
                                Cancel request
                              </button>
                            )}
                          </div>

                          {attachments[x.id] && (
                            <div className="mt-3 grid grid-cols-2 gap-3">
                              {attachments[x.id].map((p) => (
                                <a
                                  key={p.id}
                                  href={p.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="overflow-hidden rounded-xl border border-[#dbe4f0] bg-white shadow-sm"
                                >
                                  <img src={p.url} alt={`${p.stage} maintenance`} className="h-28 w-full object-cover" />
                                  <span className="block p-1.5 text-[11px] font-bold text-[#182133]">
                                    {title(p.stage)} photo
                                  </span>
                                </a>
                              ))}
                              {!attachments[x.id].length && <p className="col-span-2 text-xs text-[#60708d]">No photos added yet.</p>}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <Empty text="No maintenance requests yet. Report an issue anytime." />
                )}
              </Card>
            </div>
          )}

          {tab === "documents" && (
            <div className="grid gap-5 lg:grid-cols-2">
              <Card title="Document vault">
                <p className="mb-4 rounded-xl border border-[#c7d7f5] bg-[#f0f6ff] px-4 py-3 text-xs leading-5 text-[#33415c]">
                  Landlord files are read-only. Files you upload are shared only with the manager of this tenancy and can be replaced here.
                </p>
                {progress > 0 && (
                  <div className="mb-4">
                    <div className="mb-1 flex justify-between text-xs font-semibold text-[#182133]">
                      <span>Secure upload</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[#e7eef8]">
                      <div className="h-full bg-[#2151c5] transition-all" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                )}
                {d.documents.length ? (
                  d.documents.map((x) => (
                    <div key={x.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ccd5e4] py-4 last:border-b-0">
                      <button onClick={() => openDoc(x.id)} className="min-w-0 flex-1 text-left">
                        <b className="font-bold text-[#182133]">{x.title}</b>
                        <small className="block truncate text-xs text-[#60708d]">
                          {title(x.category)} · {x.fileName} · revision {x.revision || 1}
                        </small>
                        <small className="mt-1 block text-xs text-[#60708d]">
                          <span className={`mr-1.5 inline-flex rounded-full px-2 py-0.5 font-semibold ${x.uploadedBy === "TENANT" ? "bg-[#dde7ff] text-[#1a43a7]" : "bg-[#e7eef8] text-[#33415c]"}`}>
                            {x.uploadedBy === "TENANT" ? "Uploaded by you" : "Shared by landlord"}
                          </span>
                          {x.expiresOn ? ` · expires ${x.expiresOn}` : ""}
                        </small>
                      </button>
                      <div className="flex gap-2">
                        <button
                          onClick={() => openDoc(x.id)}
                          className="rounded-[12px] border border-[#ccd5e4] bg-white px-3 py-1.5 text-xs font-semibold text-[#182133] transition hover:bg-[#f4f7fb]"
                        >
                          Preview
                        </button>
                        {x.uploadedBy === "TENANT" && (
                          <label className="cursor-pointer rounded-[12px] border border-[#ccd5e4] bg-white px-3 py-1.5 text-xs font-semibold text-[#182133] transition hover:bg-[#f4f7fb]">
                            Replace
                            <input
                              type="file"
                              className="hidden"
                              accept="application/pdf,image/jpeg,image/png,image/webp"
                              onChange={(e) => replaceDoc(x.id, e.target.files?.[0] || null)}
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <Empty text="No documents have been shared yet." />
                )}
              </Card>
              <Card title="Upload a document">
                <form onSubmit={uploadDoc} className="space-y-3.5">
                  <input
                    required
                    className="input"
                    placeholder="Document title"
                    value={vault.title}
                    onChange={(e) => setVault({ ...vault, title: e.target.value })}
                  />
                  <select className="input" value={vault.category} onChange={(e) => setVault({ ...vault, category: e.target.value })}>
                    <option value="IDENTITY_PAN">PAN card</option>
                    <option value="IDENTITY_AADHAAR">Aadhaar card</option>
                    <option value="ADDRESS_PROOF">Address proof</option>
                    <option value="PAYMENT">Payment or receipt</option>
                    <option value="OTHER">Other document</option>
                  </select>
                  <input
                    required
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    className="input file:mr-3 file:rounded-lg file:border-0 file:bg-[#dde7ff] file:px-3 file:py-1 file:text-xs file:font-semibold file:text-[#1a42a5]"
                    onChange={(e) => setVaultFile(e.target.files?.[0] || null)}
                  />
                  <p className="text-xs text-[#60708d]">PDF, JPG, PNG or WebP · maximum 10 MB.</p>
                  <button disabled={busy} className="btn-primary w-full">
                    {busy ? `Uploading ${progress}%` : "Upload securely"}
                  </button>
                </form>
              </Card>
            </div>
          )}

          {tab === "lease" && (
            <div className="grid gap-5 lg:grid-cols-2">
              <Card title="Lease details">
                {d.leases.length ? (
                  d.leases.map((x) => (
                    <div key={x.id} className="border-b border-[#ccd5e4] py-3 last:border-b-0">
                      <b className="font-bold text-[#182133]">{x.title}</b>
                      <p className="mt-1 text-sm text-[#60708d]">
                        Ends {x.leaseEndOn} · {title(x.status)}
                      </p>
                      <button
                        onClick={() => openLease(x.id)}
                        className="mt-3 rounded-[12px] border border-[#ccd5e4] bg-white px-4 py-2 text-xs font-semibold text-[#182133] shadow-sm transition hover:bg-[#f4f7fb]"
                      >
                        Review agreement
                      </button>
                      {x.acknowledgedAt ? (
                        <p className="mt-2 text-xs font-semibold text-[#096352]">
                          Acknowledged {new Date(x.acknowledgedAt).toLocaleDateString()}
                        </p>
                      ) : (
                        x.acknowledgementRequired !== false && (
                          <button
                            onClick={() => acknowledgeLease(x.id)}
                            className="ml-2 mt-3 rounded-[12px] bg-[#2151c5] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#1a43a7]"
                          >
                            Acknowledge agreement
                          </button>
                        )
                      )}
                    </div>
                  ))
                ) : (
                  <Empty text="No lease details shared." />
                )}
              </Card>
              <Card title="Security deposit">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#60708d]">Current balance</span>
                  <b className="text-lg font-bold text-[#182133]">{d.deposit ? money(balance) : "Not recorded"}</b>
                </div>
                {d.depositEntries.map((x) => (
                  <div key={x.id} className="mt-3 flex justify-between border-t border-[#ccd5e4]/50 pt-3 text-xs">
                    <span>
                      <b className="text-[#182133]">{title(x.entryType)}</b>
                      <small className="block text-[#60708d]">{x.description}</small>
                    </span>
                    <b className="text-[#182133]">{money(x.amountPaise)}</b>
                  </div>
                ))}
              </Card>
            </div>
          )}

          {tab === "profile" && (
            <div className="grid gap-5 lg:grid-cols-2">
              <Card title="Your profile">
                <form onSubmit={saveProfile} className="space-y-3.5">
                  <label className="block text-sm font-semibold text-[#182133]">
                    Full name
                    <input
                      required
                      className="input mt-1"
                      value={profile.profile.fullName}
                      onChange={(e) => setProfile({ ...profile, profile: { ...profile.profile, fullName: e.target.value } })}
                    />
                  </label>
                  <label className="block text-sm font-semibold text-[#182133]">
                    Phone
                    <input
                      type="tel"
                      className="input mt-1"
                      value={profile.profile.phone || ""}
                      onChange={(e) => setProfile({ ...profile, profile: { ...profile.profile, phone: e.target.value } })}
                    />
                  </label>
                  <label className="block text-sm font-semibold text-[#182133]">
                    Emergency contact
                    <input
                      className="input mt-1"
                      value={profile.profile.emergencyContactName || ""}
                      onChange={(e) =>
                        setProfile({ ...profile, profile: { ...profile.profile, emergencyContactName: e.target.value } })
                      }
                    />
                  </label>
                  <label className="block text-sm font-semibold text-[#182133]">
                    Emergency phone
                    <input
                      type="tel"
                      className="input mt-1"
                      value={profile.profile.emergencyContactPhone || ""}
                      onChange={(e) =>
                        setProfile({ ...profile, profile: { ...profile.profile, emergencyContactPhone: e.target.value } })
                      }
                    />
                  </label>
                  <button disabled={busy} className="btn-primary w-full">
                    Save profile
                  </button>
                </form>
              </Card>
              <Card title="Household members">
                <form onSubmit={addMember} className="grid gap-3 sm:grid-cols-2">
                  <input
                    required
                    className="input"
                    placeholder="Member name"
                    value={member.name}
                    onChange={(e) => setMember({ ...member, name: e.target.value })}
                  />
                  <select className="input" value={member.relationship} onChange={(e) => setMember({ ...member, relationship: e.target.value })}>
                    <option value="FAMILY">Family</option>
                    <option value="SPOUSE">Spouse</option>
                    <option value="CHILD">Child</option>
                    <option value="ROOMMATE">Roommate</option>
                    <option value="OTHER">Other</option>
                  </select>
                  <input
                    className="input"
                    placeholder="Phone (optional)"
                    value={member.phone}
                    onChange={(e) => setMember({ ...member, phone: e.target.value })}
                  />
                  <input
                    type="email"
                    className="input"
                    placeholder="Email (optional)"
                    value={member.email}
                    onChange={(e) => setMember({ ...member, email: e.target.value })}
                  />
                  <button disabled={busy} className="btn-primary sm:col-span-2">
                    Add member
                  </button>
                </form>
                <div className="mt-4">
                  {profile.household
                    .filter((x) => x.rentId === d.rentId)
                    .map((x) => (
                      <div key={x.id} className="flex justify-between border-t border-[#ccd5e4]/50 py-3 text-xs">
                        <span>
                          <b className="text-[#182133]">{x.name}</b>
                          <small className="block text-[#60708d]">
                            {title(x.relationship)}
                            {x.phone ? ` · ${x.phone}` : ""}
                          </small>
                        </span>
                        <button onClick={() => removeMember(x.id)} className="font-semibold text-[#c53b27] hover:underline">
                          Remove
                        </button>
                      </div>
                    ))}
                </div>
                <div className="mt-5 border-t border-[#ccd5e4] pt-5">
                  <h3 className="text-sm font-bold text-[#182133]">Sessions</h3>
                  <p className="mt-1 text-xs text-[#60708d]">You are signed in on this device as {d.tenantEmail}.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={logout}
                      className="rounded-[12px] border border-[#ccd5e4] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#182133] shadow-sm transition hover:bg-[#f4f7fb]"
                    >
                      Sign out here
                    </button>
                    <button
                      onClick={logoutEverywhere}
                      className="rounded-[12px] border border-[#f8c8c2] bg-[#fee4e1] px-3.5 py-1.5 text-xs font-semibold text-[#9b2a1a] transition hover:bg-[#fcd2cc]"
                    >
                      Sign out everywhere
                    </button>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </section>
      </div>

      <nav
        aria-label="Tenant portal"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-[#ccd5e4] bg-white/95 px-2 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-12px_36px_rgba(24,33,51,0.10)] backdrop-blur-xl md:hidden"
      >
        {(["home", "bills", "maintenance", "documents", "lease"] as Tab[]).map((x) => (
          <button
            key={x}
            onClick={() => setTab(x)}
            className={`min-w-0 rounded-xl px-1 py-2 text-[10px] font-bold transition ${
              tab === x ? "bg-[#dde7ff] text-[#1a43a7]" : "text-[#60708d]"
            }`}
          >
            {x === "maintenance" ? "Repairs" : x === "documents" ? "Vault" : title(x)}
          </button>
        ))}
      </nav>
    </main>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5 rounded-2xl border border-[#ccd5e4] bg-white p-5 shadow-[var(--rm-shadow)] sm:p-6">
      <h2 className="mb-4 text-lg font-semibold tracking-tight text-[#182133]">{title}</h2>
      {children}
    </div>
  )
}

function Stat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-[#ccd5e4] bg-white p-5 shadow-[var(--rm-shadow)]">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#68716c]">{label}</p>
      <b className={`mt-1.5 block text-2xl font-semibold tracking-tight ${accent ? "text-[#2151c5]" : "text-[#182133]"}`}>{value}</b>
    </div>
  )
}

function Action({ text, go }: { text: string; go: () => void }) {
  return (
    <button
      onClick={go}
      className="rounded-xl border border-[#ccd5e4] bg-[#f8faff] p-4 text-left font-semibold transition hover:border-[#b4c2d6] hover:bg-[#f0f6ff]"
    >
      <span className="block text-sm text-[#182133]">{text}</span>
      <span className="mt-2 block text-xs font-bold text-[#2151c5]">Open →</span>
    </button>
  )
}

function Bill({ x, open }: { x: Invoice; open: () => void }) {
  const due = outstanding(x)
  const refunded = (x.refunded_amount || 0) > 0
  const failed = x.status === "PAYMENT_FAILED"
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 border-b border-[#ccd5e4] py-4 last:border-b-0 ${
        failed ? "rounded-[14px] bg-[#fee4e1] p-3 border-0" : ""
      }`}
    >
      <span>
        <b className="font-bold text-[#182133]">{x.invoice_number || "Rent invoice"}</b>
        <small className="block text-xs text-[#60708d]">
          Due {x.due_date || "—"} · {failed ? "Payment failed — no charge confirmed" : title(x.status)}
          {x.grace_period_days ? ` · ${x.grace_period_days}-day grace` : ""}
        </small>
        {x.late_fee_paise ? <small className="block text-xs font-semibold text-[#82530c]">Includes {money(x.late_fee_paise)} late fee</small> : null}
        {refunded && (
          <small className="mt-1 block text-xs font-semibold text-[#1a42a5]">
            Refund processed: {money(x.refunded_amount || 0)}. Your balance has been recalculated.
          </small>
        )}
      </span>
      <span className="text-right">
        <b className="text-base font-bold text-[#182133]">{money(x.status === "PAID" ? x.amount + (x.late_fee_paise || 0) : due)}</b>
        {x.paid_amount || x.credited_amount || x.refunded_amount ? (
          <small className="block text-xs text-[#60708d]">
            Original {money(x.amount)} · paid {money(x.paid_amount || 0)}
            {refunded ? ` · refunded ${money(x.refunded_amount || 0)}` : ""}
          </small>
        ) : null}
      </span>
      {x.payment_token && (
        <button
          onClick={open}
          className={`rounded-[12px] px-4 py-2 text-xs font-bold text-white shadow-sm transition ${
            x.status === "PAID" ? "bg-[#0f8a73] hover:bg-[#0c725f]" : failed ? "bg-[#c53b27] hover:bg-[#a82d1c]" : "bg-[#2151c5] hover:bg-[#1a43a7]"
          }`}
        >
          {x.status === "PAID" ? "Receipt" : failed ? "Retry safely" : "Pay balance"}
        </button>
      )}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <p className="my-3 rounded-[14px] bg-[#e7eef8] p-4 text-xs font-medium text-[#60708d]">{text}</p>
}

function Message({ text }: { text: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f4f7fb] p-6 text-[#182133]">
      <div className="max-w-md rounded-[20px] border border-[#ccd5e4] bg-white p-8 text-center shadow-sm">
        <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-[12px] bg-[#2151c5] text-lg font-bold text-white shadow-sm">
          R
        </span>
        <b className="mt-3 block text-2xl font-bold tracking-tight text-[#182133]">Rentomatic</b>
        <p className="mt-2 text-sm text-[#60708d]">{text}</p>
      </div>
    </main>
  )
}

function fileData(file: File) {
  return new Promise<string>((ok, no) => {
    const r = new FileReader()
    r.onload = () => ok(String(r.result))
    r.onerror = no
    r.readAsDataURL(file)
  })
}
