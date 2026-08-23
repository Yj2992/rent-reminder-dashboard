const segment = (value: string) => encodeURIComponent(value.trim())

export const tenantRoutes = {
  dashboard: "/tenant/me",
  profile: "/tenant/profile",
  household: "/tenant/household",
  householdMember: (id: string) => `/tenant/household/${segment(id)}`,
  maintenance: "/tenant/maintenance",
  maintenanceAttachments: (id: string) => `/tenant/maintenance/${segment(id)}/attachments`,
  maintenanceReopen: (id: string) => `/tenant/maintenance/${segment(id)}/reopen`,
  maintenanceCancel: (id: string) => `/tenant/maintenance/${segment(id)}/cancel`,
  documents: "/tenant/documents",
  document: (id: string) => `/tenant/documents/${segment(id)}`,
  documentReplace: (id: string) => `/tenant/documents/${segment(id)}/replace`,
  leaseDownload: (id: string) => `/tenant/leases/${segment(id)}/download`,
  leaseAcknowledge: (id: string) => `/tenant/leases/${segment(id)}/acknowledge`,
}
