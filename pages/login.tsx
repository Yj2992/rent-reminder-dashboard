import { FormEvent, useState } from "react"
import { useRouter } from "next/router"
import { tenantAuth, tenantAuthConfigured } from "../lib/tenantAuth"

export default function TenantLogin() {
  const router = useRouter()
  const [mode, setMode] = useState<"login" | "activate">("login")
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

  return (
    <main className="grid min-h-screen place-items-center bg-[#f4f7fb] p-5 text-[#182133] animate-fade-in-up">
      <section className="w-full max-w-md rounded-3xl border border-[#ccd5e4] bg-white p-7 shadow-xs sm:p-8">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#1f6ad8] to-[#2563eb] font-black text-white shadow-xs text-base">
            R
          </span>
          <p className="text-xs font-bold uppercase tracking-wider text-[#1f6ad8]">Rentomatic Tenant Portal</p>
        </div>

        <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-[#182133] sm:text-3xl">
          {mode === "login" ? "Tenant Login" : "Activate Your Account"}
        </h1>
        <p className="mt-2 text-xs leading-5 text-[#60708d]">
          Use the registered email address provided by your landlord or property manager.
        </p>

        {!tenantAuthConfigured && (
          <p className="mt-4 rounded-xl border border-[#f5d9aa] bg-[#ffe6bf] p-3 text-xs font-medium text-[#82530c]">
            Tenant authentication is awaiting its Supabase configuration.
          </p>
        )}

        {error && (
          <p className="mt-4 rounded-xl border border-[#bfdbfe] bg-[#eff6ff] p-3 text-xs font-semibold text-[#1f6ad8]">
            {error}
          </p>
        )}

        <button
          onClick={google}
          disabled={!tenantAuthConfigured}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-[#ccd5e4] bg-white px-4 py-2.5 text-xs font-bold text-[#182133] shadow-xs transition hover:bg-[#f4f7fb] hover:border-[#1f6ad8] active:scale-[0.99] disabled:opacity-50"
        >
          <span>Continue with Google</span>
        </button>

        <div className="my-5 flex items-center gap-3 text-xs font-medium text-[#60708d]">
          <span className="h-px flex-1 bg-[#ccd5e4]" />
          OR
          <span className="h-px flex-1 bg-[#ccd5e4]" />
        </div>

        <form onSubmit={submit} className="space-y-4">
          <label className="block text-xs font-bold uppercase tracking-wider text-[#182133]">
            Email address
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="tenant@example.com"
              className="mt-1.5 w-full rounded-xl border border-[#ccd5e4] bg-white px-4 py-2.5 text-xs font-semibold text-[#182133] outline-none transition placeholder:text-[#60708d] focus:border-[#1f6ad8] focus:ring-2 focus:ring-[#eff6ff]"
              required
            />
          </label>
          <label className="block text-xs font-bold uppercase tracking-wider text-[#182133]">
            Password
            <input
              type="password"
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1.5 w-full rounded-xl border border-[#ccd5e4] bg-white px-4 py-2.5 text-xs font-semibold text-[#182133] outline-none transition placeholder:text-[#60708d] focus:border-[#1f6ad8] focus:ring-2 focus:ring-[#eff6ff]"
              required
            />
          </label>
          <button
            disabled={busy || !tenantAuthConfigured}
            className="w-full rounded-xl bg-[#1f6ad8] px-4 py-3 text-xs font-bold text-white shadow-xs transition hover:bg-[#1756b5] active:scale-[0.99] disabled:opacity-50"
          >
            {busy ? "Please wait…" : mode === "login" ? "Sign In →" : "Create Tenant Account →"}
          </button>
        </form>

        <button
          onClick={() => {
            setError("")
            setMode(mode === "login" ? "activate" : "login")
          }}
          className="mt-5 w-full text-center text-xs font-bold text-[#1f6ad8] transition hover:underline"
        >
          {mode === "login" ? "First time? Activate account" : "Back to sign in"}
        </button>
      </section>
    </main>
  )
}
