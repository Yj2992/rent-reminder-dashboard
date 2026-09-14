import { useEffect, useRef, useState } from "react"
import { currentUtilityBills, HubAccount, HubBill, Service, stageCopy, UtilityPayerRole, utilityCheckedAt, utilityDate, utilityMoney, utilitySharePaise, utilityShareRemaining, utilityStage } from "../lib/utilityUi"

const services: { id: Service; name: string; hint: string; tone: string }[] = [
  { id: "ELECTRICITY", name: "Electricity", hint: "Power your home", tone: "bg-amber-50 text-amber-600" },
  { id: "WATER", name: "Water", hint: "Water supply", tone: "bg-sky-50 text-sky-600" },
  { id: "GAS", name: "Piped gas", hint: "Your gas connection", tone: "bg-orange-50 text-orange-600" },
]
export function ServiceIcon({ type, className = "h-6 w-6" }: { type?: string; className?: string }) {
  return <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    {type === "ELECTRICITY" ? <path d="m13 2-9 12h7l-1 8 10-13h-7l1-7Z"/> : type === "WATER" ? <><path d="M12 3c-3 4-7 8-7 12a7 7 0 0 0 14 0c0-4-4-8-7-12Z"/><path d="M8 15a4 4 0 0 0 4 4"/></> : type === "GAS" ? <><path d="M13 2c2 7-5 7-3 12 2-1 4-3 4-5 3 3 5 5 5 8a7 7 0 0 1-14 0c0-5 3-6 3-10 1 2 2 3 2 3 2-2 3-4 3-8Z"/></> : <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 8h6M9 12h6"/></>}
  </svg>
}
const primary = "rounded-full bg-blue-700 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
const secondary = "rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
const responsibilityLabel = (value?: string | null) => ({ TENANT_PAYS: "Tenant pays", LANDLORD_PAYS: "Landlord pays", SHARED: "Shared payment", INFORMATIONAL: "Track only" }[value || "TENANT_PAYS"] || "Tenant pays")
const tenantCanPay = (account?: HubAccount) => ["TENANT_PAYS", "SHARED"].includes(account?.responsibility || "TENANT_PAYS")
export default function UtilityHub({ accounts, bills, loading = false, error, onRefresh, onPay, onReceipt, onAdd, onEdit, onFetch, onRemind, canPay, portalRole = "OWNER" }: {
  accounts: HubAccount[]; bills: HubBill[]; loading?: boolean; error?: string;
  onRefresh: () => void | Promise<unknown>; onPay: (bill: HubBill, payerRole: UtilityPayerRole) => Promise<void>; onReceipt: (bill: HubBill) => Promise<void>;
  onAdd?: (service: Service) => void; onEdit?: (account: HubAccount) => void; onFetch?: (account: HubAccount) => Promise<void>;
  onRemind?: (bill: HubBill, channel: "WHATSAPP" | "EMAIL") => Promise<string | void>;
  canPay?: (bill: HubBill, account: HubAccount | undefined, payerRole: UtilityPayerRole) => boolean; portalRole?: "OWNER" | "TENANT";
}) {
  const [service, setService] = useState<Service | null>(null)
  const [view, setView] = useState<"accounts" | "activity" | "receipts">("accounts")
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<HubBill | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [actionError, setActionError] = useState("")
  const [actionNotice, setActionNotice] = useState("")
  const [limit, setLimit] = useState(12)
  const dialog = useRef<HTMLDialogElement>(null)
  const actionLock = useRef(false)
  const current = currentUtilityBills(bills)
  const filtered = current.filter(b => view !== "receipts" || utilityStage(b) === "paid").filter(b => {
    const account = accounts.find(a => a.id === b.utility_account_id)
    return (!service || account?.utility_type === service) && [account?.operator_name, account?.consumer_number, account?.property_name, b.consumer_name, b.id].some(v => (v || "").toLowerCase().includes(query.toLowerCase()))
  })
  const visibleAccounts = accounts.filter(a => a.active !== false && (!service || a.utility_type === service) && [a.operator_name, a.consumer_number, a.property_name].some(v => (v || "").toLowerCase().includes(query.toLowerCase())))
  const pending = current.filter(b => ["checking", "processing", "review"].includes(utilityStage(b))).length
  const latest = selected ? bills.find(b => b.id === selected.id) || selected : null
  const selectedAccount = latest && accounts.find(a => a.id === latest.utility_account_id)
  const selectedResponsibility = latest?.responsibility || selectedAccount?.responsibility || "TENANT_PAYS"
  const tenantAllowed = selectedResponsibility === "TENANT_PAYS" || selectedResponsibility === "SHARED"
  const landlordAllowed = selectedResponsibility === "LANDLORD_PAYS" || selectedResponsibility === "SHARED"
  const tenantShare = latest ? utilitySharePaise(latest.bill_amount_paise, selectedResponsibility, "TENANT") : 0
  const landlordShare = latest ? utilitySharePaise(latest.bill_amount_paise, selectedResponsibility, "LANDLORD") : 0
  const tenantRemaining = latest ? utilityShareRemaining(latest, selectedResponsibility, "TENANT") : 0
  const landlordRemaining = latest ? utilityShareRemaining(latest, selectedResponsibility, "LANDLORD") : 0
  const payerCanPay = (role: UtilityPayerRole) => latest ? (canPay ? canPay(latest, selectedAccount || undefined, role) : true) : false
  useEffect(() => { setLimit(12) }, [service, view, query])
  useEffect(() => {
    if (!selected) return
    setActionError(""); setActionNotice("")
    const focus = document.activeElement as HTMLElement | null
    const el = dialog.current
    el?.showModal()
    return () => { el?.close(); focus?.focus() }
  }, [selected?.id])
  async function act(id: string, action: () => Promise<void | string>) {
    if (actionLock.current) return
    actionLock.current = true; setBusy(id); setActionError(""); setActionNotice("")
    try { const message = await action(); if (message) setActionNotice(message) } catch (e) { setActionError(e instanceof Error ? e.message : "That action could not be completed. Please try again.") }
    finally { setBusy(null); actionLock.current = false }
  }
  function billButton(bill: HubBill) {
    const account = accounts.find(a => a.id === bill.utility_account_id)
    const stage = utilityStage(bill)
    return <button key={bill.id} type="button" onClick={() => setSelected(bill)} className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-blue-300 hover:bg-blue-50/30">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600"><ServiceIcon type={account?.utility_type}/></span>
      <span className="min-w-0 flex-1"><span className="block truncate font-semibold text-slate-900">{account?.operator_name || bill.consumer_name || "Utility bill"}</span><span className="mt-1 block text-xs text-slate-500">{bill.billing_period || utilityDate(bill.due_date)}{account?.property_name ? " · " + account.property_name : ""}</span></span>
      <span className="shrink-0 text-right"><span className="block text-sm font-semibold text-slate-900">{utilityMoney(bill.bill_amount_paise)}</span><span className={"mt-1 block text-xs " + (stage === "paid" ? "text-emerald-700" : stage === "due" ? "text-blue-700" : "text-amber-700")}>{stageCopy[stage].label}</span></span>
    </button>
  }
  return <div className="mx-auto w-full max-w-4xl space-y-6 pb-6 text-slate-900">
    <div className="flex items-center justify-between gap-4"><div><h2 className="text-2xl font-semibold tracking-tight">Bills & utilities</h2><p className="mt-1 text-sm text-slate-500">A few simple steps to take care of your home.</p></div><button className={secondary} disabled={loading || !!busy} onClick={() => void onRefresh()}>{loading ? "Refreshing…" : "Refresh"}</button></div>
    {error && <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div>}
    {actionError && !selected && <div role="alert" className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-800">{actionError}</div>}
    <section aria-label="Choose a utility" className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-7">
      <div className="mb-5 flex items-center justify-between"><h3 className="font-semibold">What would you like to pay?</h3>{service && <button onClick={() => setService(null)} className="text-sm font-medium text-blue-700">Show all</button>}</div>
      <div className="grid grid-cols-3 gap-3 sm:gap-5">{services.map(s => <button key={s.id} aria-pressed={service === s.id} onClick={() => {setService(s.id);setView("accounts");setQuery("")}} className={"flex flex-col items-center rounded-2xl border px-2 py-5 transition focus-visible:outline-2 focus-visible:outline-blue-700 " + (service === s.id ? "border-blue-600 bg-blue-50 ring-1 ring-blue-600" : "border-slate-100 hover:border-blue-200 hover:bg-slate-50")}>
        <span className={"mb-3 flex h-12 w-12 items-center justify-center rounded-full sm:h-14 sm:w-14 " + s.tone}><ServiceIcon type={s.id} className="h-7 w-7"/></span><span className="text-sm font-semibold">{s.name}</span><span className="mt-1 hidden text-xs text-slate-500 sm:block">{s.hint}</span>
      </button>)}</div>
    </section>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex gap-1 rounded-full bg-slate-100 p-1" aria-label="Utility views">{([["accounts", "Saved accounts"], ["activity", "Activity"], ["receipts", "Receipts"]] as const).map(([key, label]) => <button key={key} aria-pressed={view === key} onClick={() => setView(key)} className={"rounded-full px-3 py-2 text-xs font-semibold sm:text-sm " + (view === key ? "bg-white text-blue-700 shadow-sm" : "text-slate-600")}>{label}</button>)}</div>
      {onAdd && service && view === "accounts" && <button className={secondary} disabled={loading} onClick={() => onAdd(service)}>+ Add account</button>}
    </div>
    {pending > 0 && view === "accounts" && <button onClick={() => {setView("activity");setService(null)}} className="flex w-full items-center justify-between rounded-2xl bg-blue-50 px-5 py-4 text-left text-sm text-blue-900"><span>{pending} {pending === 1 ? "bill has" : "bills have"} a payment update</span><span aria-hidden="true">→</span></button>}
    <label className="block"><span className="sr-only">Search provider, property or consumer number</span><input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search provider, property or consumer number" className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"/></label>
    {loading && !accounts.length && !bills.length ? <div role="status" className="rounded-3xl bg-white p-10 text-center text-sm text-slate-500">Loading your utility accounts…</div> : view === "accounts" ? <>
      <div className="space-y-3">{visibleAccounts.slice(0, limit).map(account => {
        const related = current.filter(b => b.utility_account_id === account.id)
        const bill = related.find(b => ["checking", "processing", "review"].includes(utilityStage(b))) || related.find(b => utilityStage(b) === "due") || related[0]
        const stage = bill && utilityStage(bill)
        return <article key={account.id} className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="flex items-start gap-3"><span className={"flex h-11 w-11 shrink-0 items-center justify-center rounded-full " + (services.find(s => s.id === account.utility_type)?.tone || "bg-slate-100")}><ServiceIcon type={account.utility_type}/></span>
          <div className="min-w-0 flex-1"><h3 className="break-words font-semibold">{account.operator_name}</h3><p className="mt-1 text-xs text-slate-500">{account.property_name ? account.property_name + " · " : ""}••••{account.consumer_number.slice(-4)}</p><p className="mt-1 text-xs font-medium text-blue-700">{responsibilityLabel(account.responsibility)}</p></div>
          {onEdit && <button onClick={() => onEdit(account)} className="px-2 py-1 text-xs font-semibold text-blue-700" aria-label={"Edit " + account.operator_name}>Edit</button>}</div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <div>{bill ? <><p className="text-lg font-semibold">{utilityMoney(bill.bill_amount_paise)}</p><p className="mt-0.5 text-xs text-slate-500">{stageCopy[stage!].label}{stage === "due" ? " · Due " + utilityDate(bill.due_date) : ""}</p><p className="mt-1 text-xs text-slate-400">{utilityCheckedAt(bill.provider_checked_at || bill.updated_at || bill.created_at)}</p></> : <p className="text-sm text-slate-500">No bill fetched yet</p>}</div>
            <div className="flex flex-wrap gap-2">{onFetch && (!bill || stage === "paid" || stage === "cancelled" || (stage === "due" && !(bill.collected_amount_paise || 0))) && <button disabled={!!busy || loading} onClick={() => void act(account.id, () => onFetch(account))} className={bill ? secondary : primary}>{busy === account.id ? "Checking Eko…" : !bill ? "Fetch bill" : stage === "due" ? "Refresh bill" : "Fetch next bill"}</button>}
            {bill && <button disabled={!!busy} onClick={() => setSelected(bill)} className={stage === "due" ? primary : secondary}>{stage === "due" ? "Review bill" : "View details"}</button>}</div>
          </div>
        </article>
      })}</div>
      {!visibleAccounts.length && <div className="rounded-3xl border border-dashed border-slate-300 p-8 text-center"><h3 className="font-semibold">{query ? "No matching accounts" : "No saved " + (services.find(s => s.id === service)?.name.toLowerCase() || "utility") + " accounts"}</h3><p className="mx-auto mt-2 max-w-md text-sm text-slate-500">{onAdd ? "Choose a service above, then add your provider and consumer details." : "Your property manager can link an account to your tenancy. It will appear here once added."}</p>{onAdd && service && !query && <button className={primary + " mt-5"} onClick={() => onAdd(service)}>Add account</button>}</div>}
    </> : <div className="space-y-3">{filtered.slice(0, limit).map(billButton)}{!filtered.length && <div className="rounded-3xl border border-dashed border-slate-300 p-9 text-center"><h3 className="font-semibold">{view === "receipts" ? "No receipts here yet" : "No matching bills"}</h3><p className="mt-2 text-sm text-slate-500">{view === "receipts" ? "Completed payments will appear here. Previous billing periods stay available." : "Try another service or clear your search."}</p></div>}</div>}
    {(view === "accounts" ? visibleAccounts.length : filtered.length) > limit && <button className={secondary + " w-full"} onClick={() => setLimit(n => n + 12)}>Show more</button>}
    {latest && <dialog ref={dialog} aria-labelledby="utility-review-title" onCancel={e => {e.preventDefault();if (!busy) setSelected(null)}} className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-lg overflow-y-auto rounded-3xl border-0 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-950/50">
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4"><h2 id="utility-review-title" className="font-semibold">Review utility bill</h2><button aria-label="Close bill details" disabled={!!busy} onClick={() => setSelected(null)} className="rounded-full px-3 py-2 text-slate-500 hover:bg-slate-100">✕</button></div>
      <div className="space-y-5 p-6">
        <div className="text-center"><span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-700"><ServiceIcon type={selectedAccount?.utility_type}/></span><p className="font-semibold">{selectedAccount?.operator_name || "Utility bill"}</p><p className="mt-3 text-3xl font-semibold tracking-tight">{utilityMoney(latest.bill_amount_paise)}</p><p className="mt-2 text-sm text-slate-500">{stageCopy[utilityStage(latest)].label}{(latest.collected_amount_paise || 0) > 0 ? ` · ${utilityMoney(latest.collected_amount_paise || 0)} collected` : ""}</p></div>
        <dl className="space-y-3 rounded-2xl bg-slate-50 p-4 text-sm">{[["Consumer", selectedAccount?.consumer_number || latest.consumer_name || "Not supplied"], ["Property", selectedAccount?.property_name], ["Paid by", responsibilityLabel(selectedAccount?.responsibility)], ["Due date", utilityDate(latest.due_date)], ["Last checked", utilityCheckedAt(latest.provider_checked_at || latest.updated_at || latest.created_at).replace("Checked ", "")], ["Billing period", latest.billing_period]].filter(([,v]) => v).map(([label,value]) => <div key={label} className="flex justify-between gap-5"><dt className="text-slate-500">{label}</dt><dd className="break-all text-right font-medium">{value}</dd></div>)}</dl>
        <p className="text-sm leading-6 text-slate-600">{stageCopy[utilityStage(latest)].detail}</p>
        <details className="text-xs text-slate-500"><summary className="cursor-pointer py-2">Payment references</summary><p className="break-all">Bill: {latest.id}</p>{latest.provider_txn_id && <p className="mt-2 break-all">Provider transaction: {latest.provider_txn_id}</p>}{latest.bbps_ref_id && <p className="mt-2 break-all">BBPS reference: {latest.bbps_ref_id}</p>}</details>
        {actionError && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{actionError}</p>}
        {actionNotice && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{actionNotice}</p>}
        {selectedResponsibility === "SHARED" && <section className="grid grid-cols-2 gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm"><div><p className="text-slate-500">Tenant half</p><p className="mt-1 font-semibold">{utilityMoney(tenantShare)}</p><p className="text-xs text-slate-500">{tenantRemaining ? `${utilityMoney(tenantRemaining)} remaining` : "Collected"}</p></div><div><p className="text-slate-500">Landlord half</p><p className="mt-1 font-semibold">{utilityMoney(landlordShare)}</p><p className="text-xs text-slate-500">{landlordRemaining ? `${utilityMoney(landlordRemaining)} remaining` : "Collected"}</p></div></section>}
        {["due", "checking"].includes(utilityStage(latest)) && portalRole === "TENANT" && tenantAllowed && tenantRemaining > 0 && payerCanPay("TENANT") && <button className={primary + " w-full"} disabled={!!busy || loading || !!error} onClick={() => void act(latest.id + ":tenant", () => onPay(latest, "TENANT"))}>{busy ? "Preparing checkout…" : selectedResponsibility === "SHARED" ? `Pay my half · ${utilityMoney(tenantRemaining)}` : "Continue to payment"}</button>}
        {["due", "checking"].includes(utilityStage(latest)) && portalRole === "TENANT" && (!tenantAllowed || tenantRemaining === 0) && <p className="rounded-xl bg-blue-50 p-3 text-sm text-blue-900">{tenantRemaining === 0 && tenantAllowed ? "Your share has been collected. Waiting for the remaining payment or provider confirmation." : "This bill is assigned to the property manager. You can follow its status here without paying it."}</p>}
        {["due", "checking"].includes(utilityStage(latest)) && portalRole === "OWNER" && <div className="grid gap-2 sm:grid-cols-2">{tenantAllowed && tenantRemaining > 0 && <button className={secondary} disabled={!!busy || loading || !!error} onClick={() => void act(latest.id + ":tenant", () => onPay(latest, "TENANT"))}>{busy ? "Preparing…" : selectedResponsibility === "SHARED" ? `Tenant half · ${utilityMoney(tenantRemaining)}` : "Create tenant payment link"}</button>}{landlordAllowed && landlordRemaining > 0 && <button className={primary} disabled={!!busy || loading || !!error} onClick={() => void act(latest.id + ":landlord", () => onPay(latest, "LANDLORD"))}>{busy ? "Preparing…" : selectedResponsibility === "SHARED" ? `Pay landlord half · ${utilityMoney(landlordRemaining)}` : "Pay as landlord"}</button>}</div>}
        {selectedResponsibility === "INFORMATIONAL" && ["due", "checking"].includes(utilityStage(latest)) && <p className="rounded-xl bg-slate-100 p-3 text-sm text-slate-700">This account is set to Track only. No Rentomatic checkout will be created.</p>}
        {onRemind && tenantCanPay(selectedAccount || undefined) && tenantRemaining > 0 && ["due", "checking"].includes(utilityStage(latest)) && <section aria-label="Remind tenant" className="rounded-2xl border border-slate-200 p-4"><div className="mb-3"><h3 className="text-sm font-semibold">Remind tenant</h3><p className="mt-1 text-xs leading-5 text-slate-500">Send the tenant's {selectedResponsibility === "SHARED" ? "50% share" : "bill"} and secure payment link.</p></div><div className="grid grid-cols-2 gap-2"><button className={secondary} disabled={!!busy || loading || !!error} onClick={() => void act(latest.id + ":whatsapp", () => onRemind(latest, "WHATSAPP"))}>{busy?.endsWith(":whatsapp") ? "Sending…" : "WhatsApp"}</button><button className={secondary} disabled={!!busy || loading || !!error} onClick={() => void act(latest.id + ":email", () => onRemind(latest, "EMAIL"))}>{busy?.endsWith(":email") ? "Sending…" : "Email"}</button></div></section>}
        {utilityStage(latest) === "paid" && <button className={primary + " w-full"} disabled={!!busy} onClick={() => void act(latest.id, () => onReceipt(latest))}>{busy ? "Downloading…" : "Download confirmation"}</button>}
        {!["paid","due"].includes(utilityStage(latest)) && <button className={secondary + " w-full"} disabled={!!busy || loading} onClick={() => void onRefresh()}>{loading ? "Refreshing…" : "Refresh status"}</button>}
      </div>
    </dialog>}
  </div>
}
