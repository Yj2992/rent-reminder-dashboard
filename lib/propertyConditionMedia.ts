export type ConditionStage = "BEFORE_RENT" | "AFTER_RENT"
export type ConditionRating = "EXCELLENT" | "GOOD" | "FAIR" | "DAMAGED"
export type ConditionMediaKind = "PHOTO" | "VIDEO"

export interface ConditionDocumentInput {
  id: string
  display_name: string
  description?: string | null
  document_type: string
  category?: string | null
  property_id?: string | null
  unit_id?: string | null
  tenant_id?: string | null
  lease_id?: string | null
  current_version_id?: string | null
  created_at: string
  archived_at?: string | null
  tags?: string[]
}

export interface ParsedConditionMedia {
  doc: ConditionDocumentInput
  stage: ConditionStage
  room: string
  rating: ConditionRating
  mediaKind: ConditionMediaKind
  title: string
  notes: string
}

export const CONDITION_ROOMS = [
  "Living Room",
  "Bedroom 1",
  "Bedroom 2",
  "Kitchen",
  "Bathroom",
  "Balcony / Terrace",
  "Exterior / Entrance",
  "Appliances & Fixtures",
  "Full Walkthrough Video",
  "Other",
] as const

export const ACCEPTED_CONDITION_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "video/mp4",
  "video/quicktime",
  "video/webm",
])

export const MAX_CONDITION_MEDIA_BYTES = 50 * 1024 * 1024

export function isVideoMimeType(mimeType: string | null | undefined): boolean {
  return String(mimeType || "").toLowerCase().startsWith("video/")
}

export function validateConditionMediaType(file: { type: string; name?: string }): string {
  const mime = (file.type || "").toLowerCase()
  const name = (file.name || "").toLowerCase()
  const extAllowed = /\.(jpe?g|png|webp|heic|heif|mp4|mov|webm)$/i.test(name)

  if (!ACCEPTED_CONDITION_MIME_TYPES.has(mime) && !extAllowed) {
    return "Unsupported file type. Upload a JPG, PNG, WebP, HEIC photo or MP4, MOV, WebM video."
  }
  return ""
}

export function validateConditionMediaFile(file: { type: string; size: number; name?: string }): string {
  const typeError = validateConditionMediaType(file)
  if (typeError) return typeError
  if (file.size > MAX_CONDITION_MEDIA_BYTES) {
    return "File exceeds the 50 MB limit. Compress the photo or video and try again."
  }
  return ""
}

export function inferMediaKindFromFile(file: { type: string; name?: string }): ConditionMediaKind {
  if (isVideoMimeType(file.type) || /\.(mp4|mov|webm)$/i.test(file.name || "")) {
    return "VIDEO"
  }
  return "PHOTO"
}

export function buildConditionDisplayName(
  stage: ConditionStage,
  room: string,
  customTitle: string
): string {
  const stageLabel = stage === "BEFORE_RENT" ? "Before Rent" : "After Rent"
  const cleanRoom = room.trim() || "General"
  const cleanTitle = customTitle.trim()
  return cleanTitle
    ? `[${stageLabel} · ${cleanRoom}] ${cleanTitle}`
    : `[${stageLabel} · ${cleanRoom}] Inspection Media`
}

export function encodeConditionDescription(meta: {
  stage: ConditionStage
  room: string
  rating: ConditionRating
  mediaKind: ConditionMediaKind
  notes?: string
}): string {
  const cleanRoom = meta.room.replace(/\|/g, "/").trim() || "General"
  const cleanNotes = (meta.notes || "").replace(/\|/g, "/").trim()
  return [
    `STAGE:${meta.stage}`,
    `ROOM:${cleanRoom}`,
    `RATING:${meta.rating}`,
    `MEDIA:${meta.mediaKind}`,
    cleanNotes ? `NOTES:${cleanNotes}` : "",
  ]
    .filter(Boolean)
    .join("|")
}

export function parseConditionRecord(doc: ConditionDocumentInput): ParsedConditionMedia | null {
  if (doc.archived_at) return null
  const desc = doc.description || ""
  const name = doc.display_name || ""

  const stageMatch = desc.match(/STAGE:(BEFORE_RENT|AFTER_RENT)/)
  const nameIsBefore = /^\[Before Rent\b/i.test(name)
  const nameIsAfter = /^\[After Rent\b/i.test(name)

  if (!stageMatch && !nameIsBefore && !nameIsAfter) {
    return null
  }

  const stage: ConditionStage = stageMatch
    ? (stageMatch[1] as ConditionStage)
    : nameIsAfter
      ? "AFTER_RENT"
      : "BEFORE_RENT"

  const roomMatch = desc.match(/ROOM:([^|]+)/)
  const nameRoomMatch = name.match(/^\[(?:Before|After) Rent\s*·\s*([^\]]+)\]/i)
  const room = (roomMatch?.[1] || nameRoomMatch?.[1] || "Other").trim()

  const ratingMatch = desc.match(/RATING:(EXCELLENT|GOOD|FAIR|DAMAGED)/)
  const rating: ConditionRating = (ratingMatch?.[1] as ConditionRating) || "GOOD"

  const mediaMatch = desc.match(/MEDIA:(PHOTO|VIDEO)/)
  const mediaKind: ConditionMediaKind =
    (mediaMatch?.[1] as ConditionMediaKind) ||
    (room.toLowerCase().includes("video") ? "VIDEO" : "PHOTO")

  const notesMatch = desc.match(/NOTES:(.+)$/)
  const notes = (notesMatch?.[1] || "").trim()

  const strippedTitle = name.replace(/^\[(?:Before|After) Rent[^\]]*\]\s*/i, "").trim()

  return {
    doc,
    stage,
    room,
    rating,
    mediaKind,
    title: strippedTitle || room,
    notes,
  }
}

export function groupBeforeAfterByRoom<T extends ParsedConditionMedia>(items: T[]): Array<{
  room: string
  before: T[]
  after: T[]
}> {
  const map = new Map<string, { before: T[]; after: T[] }>()
  for (const item of items) {
    const entry = map.get(item.room) || { before: [], after: [] }
    if (item.stage === "BEFORE_RENT") {
      entry.before.push(item)
    } else {
      entry.after.push(item)
    }
    map.set(item.room, entry)
  }

  return Array.from(map.entries())
    .map(([room, buckets]) => ({
      room,
      before: buckets.before.sort(
        (a, b) => new Date(b.doc.created_at).getTime() - new Date(a.doc.created_at).getTime()
      ),
      after: buckets.after.sort(
        (a, b) => new Date(b.doc.created_at).getTime() - new Date(a.doc.created_at).getTime()
      ),
    }))
    .sort((a, b) => a.room.localeCompare(b.room))
}
