import {
  ConditionDocumentInput,
  groupBeforeAfterByRoom,
  parseConditionRecord,
  ParsedConditionMedia,
} from "./propertyConditionMedia"

export interface TenantPortalDocument {
  id: string
  title: string
  category: string
  fileName: string
  mimeType?: string
  description?: string | null
  revision?: number
  uploadedBy?: string
  expiresOn?: string | null
  createdAt?: string
  created_at?: string
}

export type TenantConditionItem = ParsedConditionMedia & {
  sourceDoc: TenantPortalDocument
}

export const MANDATORY_KYC_CATEGORIES = [
  { category: "IDENTITY_PAN", label: "PAN Card" },
  { category: "IDENTITY_AADHAAR", label: "Aadhaar Card" },
  { category: "ADDRESS_PROOF", label: "Address Proof" },
] as const

export function mapTenantDocToConditionInput(doc: TenantPortalDocument): ConditionDocumentInput {
  return {
    id: doc.id,
    display_name: doc.title || doc.fileName || "Inspection Media",
    description: doc.description || null,
    document_type: doc.mimeType || "",
    category: doc.category || "OTHER",
    created_at: doc.createdAt || doc.created_at || new Date(0).toISOString(),
  }
}

export function extractTenantConditionMedia(
  documents: TenantPortalDocument[]
): TenantConditionItem[] {
  const parsed: TenantConditionItem[] = []
  for (const doc of documents) {
    const item = parseConditionRecord(mapTenantDocToConditionInput(doc))
    if (item) {
      parsed.push({
        ...item,
        sourceDoc: doc,
      })
    }
  }
  return parsed.sort(
    (a, b) => new Date(b.doc.created_at).getTime() - new Date(a.doc.created_at).getTime()
  )
}

export function isConditionMediaDocument(doc: TenantPortalDocument): boolean {
  return parseConditionRecord(mapTenantDocToConditionInput(doc)) !== null
}

export function groupTenantConditionByRoom(items: TenantConditionItem[]) {
  return groupBeforeAfterByRoom(items)
}

export function computeMissingMandatoryKycDocs(documents: TenantPortalDocument[]) {
  const present = new Set(documents.map((doc) => doc.category))
  return MANDATORY_KYC_CATEGORIES.filter((item) => !present.has(item.category))
}
