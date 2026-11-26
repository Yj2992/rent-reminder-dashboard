import { legacyPortalDestination } from "../lib/paymentResult"
import { useEffect } from "react"
import { useRouter } from "next/router"

export default function TenantPortalRedirect() {
  const router = useRouter()

  useEffect(() => {
    if (!router.isReady) return
    router.replace(legacyPortalDestination(router.query))
  }, [router.isReady, router.query])

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif", background: "#f8fafc" }}>
      <p style={{ color: "#64748b", fontSize: "14px" }}>Loading portal...</p>
    </div>
  )
}
