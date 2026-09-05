import { useEffect } from "react"
import { useRouter } from "next/router"

export default function TenantPortalRedirect() {
  const router = useRouter()

  useEffect(() => {
    if (!router.isReady) return
    const { token, ref, order_id } = router.query

    if (token && typeof token === "string") {
      const orderQuery = order_id && typeof order_id === "string" ? `?order_id=${encodeURIComponent(order_id)}` : ""
      router.replace(`/pay/${encodeURIComponent(token)}${orderQuery}`)
    } else if (order_id && typeof order_id === "string") {
      router.replace(`/pay/${encodeURIComponent(order_id)}?order_id=${encodeURIComponent(order_id)}`)
    } else if (ref && typeof ref === "string") {
      router.replace(`/tenant?ref=${encodeURIComponent(ref)}`)
    } else {
      router.replace("/tenant")
    }
  }, [router.isReady, router.query])

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif", background: "#f8fafc" }}>
      <p style={{ color: "#64748b", fontSize: "14px" }}>Loading portal...</p>
    </div>
  )
}
