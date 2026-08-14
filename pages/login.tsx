import { FormEvent, useState } from "react"
import { useRouter } from "next/router"
import { tenantAuth, tenantAuthConfigured } from "../lib/tenantAuth"

export default function TenantLogin() {
  const router = useRouter()
  const [mode, setMode] = useState<"login"|"activate">("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const normalizedEmail = email.trim().toLowerCase()

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!tenantAuth) return
    setBusy(true)
    setError("")
    try {
      if (!normalizedEmail.includes("@")) throw new Error("Enter the email address registered by your property manager.")
      const result = mode === "login"
        ? await tenantAuth.auth.signInWithPassword({ email: normalizedEmail, password })
        : await tenantAuth.auth.signUp({ email: normalizedEmail, password, options: { emailRedirectTo: `${window.location.origin}/tenant` } })
      if (result.error) throw result.error
      if (mode === "activate" && !result.data.session) {
        setError(`Check ${normalizedEmail} and open the confirmation email to finish activation.`)
        return
      }
      await router.push("/tenant")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Authentication failed")
    } finally {
      setBusy(false)
    }
  }

  async function google() {
    if (!tenantAuth) return
    const { error: oauthError } = await tenantAuth.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/tenant`, queryParams: { prompt: "select_account" } },
    })
    if (oauthError) setError(oauthError.message)
  }

  return <main className="grid min-h-screen place-items-center bg-[#f4f7f6] p-5"><section className="w-full max-w-md rounded-2xl border border-[#dce5e2] bg-white p-7 shadow-sm">
    <p className="text-sm font-bold text-[#1f6f5b]">Rentomatic tenant portal</p>
    <h1 className="mt-2 text-3xl font-bold">{mode==="login"?"Tenant login":"Activate your account"}</h1>
    <p className="mt-2 text-sm text-[#61716c]">Use the email registered by your property manager. Yahoo, Outlook, Gmail and other providers are supported.</p>
    {!tenantAuthConfigured&&<p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Tenant authentication is awaiting its Supabase public key.</p>}
    {error&&<p className="mt-4 rounded-xl bg-blue-50 p-3 text-sm text-blue-800">{error}</p>}
    <button onClick={google} disabled={!tenantAuthConfigured} className="mt-5 w-full rounded-xl border px-4 py-3 font-semibold disabled:opacity-50">Continue with Google</button>
    <div className="my-5 flex items-center gap-3 text-xs text-[#788681]"><span className="h-px flex-1 bg-[#dce5e2]"/>OR<span className="h-px flex-1 bg-[#dce5e2]"/></div>
    <form onSubmit={submit} className="space-y-4">
      <label className="block text-sm font-semibold">Email address<input type="email" value={email} onChange={event=>setEmail(event.target.value)} placeholder="tenant@example.com" className="mt-1 w-full rounded-xl border px-4 py-3" required/></label>
      <label className="block text-sm font-semibold">Password<input type="password" minLength={8} value={password} onChange={event=>setPassword(event.target.value)} className="mt-1 w-full rounded-xl border px-4 py-3" required/></label>
      <button disabled={busy||!tenantAuthConfigured} className="w-full rounded-xl bg-[#1f6f5b] px-4 py-3 font-semibold text-white disabled:opacity-50">{busy?"Please wait…":mode==="login"?"Sign in":"Create tenant account"}</button>
    </form>
    <button onClick={()=>{setError("");setMode(mode==="login"?"activate":"login")}} className="mt-5 w-full text-sm font-semibold text-[#1f6f5b]">{mode==="login"?"First time? Activate account":"Back to sign in"}</button>
  </section></main>
}
