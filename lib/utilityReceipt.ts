/** Download only genuine PDF responses; reject an older server's HTML response. */
export async function downloadUtilityReceipt(url: string, token: string, billId: string) {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!response.ok) throw new Error("A verified receipt is not available yet. Refresh the bill or contact support.")
  const blob = await response.blob()
  if (!response.headers.get("content-type")?.includes("application/pdf") || await blob.slice(0, 5).text() !== "%PDF-") {
    throw new Error("The receipt server needs updating. Please try again after deployment.")
  }
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = objectUrl
  link.download = `utility-receipt-${billId.replace(/[^a-zA-Z0-9-]/g, "")}.pdf`
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
}
