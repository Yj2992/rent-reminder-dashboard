import { describe, expect, it } from "vitest"
import { tenantRoutes } from "../lib/tenantRoutes"

describe("tenant API route contracts", () => {
  it("keeps dashboard, maintenance and vault routes stable", () => {
    expect(tenantRoutes.dashboard).toBe("/tenant/me")
    expect(tenantRoutes.maintenance).toBe("/tenant/maintenance")
    expect(tenantRoutes.documents).toBe("/tenant/documents")
  })

  it("encodes identifiers before placing them in paths", () => {
    expect(tenantRoutes.maintenanceAttachments("request / 1")).toBe("/tenant/maintenance/request%20%2F%201/attachments")
    expect(tenantRoutes.documentReplace("document/1")).toBe("/tenant/documents/document%2F1/replace")
    expect(tenantRoutes.leaseAcknowledge("lease / 1")).toBe("/tenant/leases/lease%20%2F%201/acknowledge")
  })
})
