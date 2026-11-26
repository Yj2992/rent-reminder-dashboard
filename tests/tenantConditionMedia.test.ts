import { describe, expect, it } from "vitest"
import {
  computeMissingMandatoryKycDocs,
  extractTenantConditionMedia,
  groupTenantConditionByRoom,
  isConditionMediaDocument,
  TenantPortalDocument,
} from "../lib/tenantConditionMedia"
import {
  buildConditionDisplayName,
  encodeConditionDescription,
  validateConditionMediaFile,
} from "../lib/propertyConditionMedia"
import {
  calculateTargetVideoBitrateBps,
  computeScaledDimensions,
} from "../lib/mediaCompressor"

describe("tenantConditionMedia", () => {
  it("extracts and groups Before & After handover media by room", () => {
    const docs: TenantPortalDocument[] = [
      {
        id: "doc-1",
        title: buildConditionDisplayName("BEFORE_RENT", "Living Room", "Wall condition"),
        category: "OTHER",
        fileName: "wall-before.jpg",
        mimeType: "image/jpeg",
        description: encodeConditionDescription({
          stage: "BEFORE_RENT",
          room: "Living Room",
          rating: "EXCELLENT",
          mediaKind: "PHOTO",
          notes: "Freshly painted",
        }),
        uploadedBy: "OWNER",
        createdAt: "2026-10-01T10:00:00Z",
      },
      {
        id: "doc-2",
        title: buildConditionDisplayName("AFTER_RENT", "Living Room", "Move-out walkthrough"),
        category: "OTHER",
        fileName: "walkthrough-after.mp4",
        mimeType: "video/mp4",
        description: encodeConditionDescription({
          stage: "AFTER_RENT",
          room: "Living Room",
          rating: "GOOD",
          mediaKind: "VIDEO",
          notes: "Minor scuff near door",
        }),
        uploadedBy: "TENANT",
        createdAt: "2026-11-01T10:00:00Z",
      },
      {
        id: "doc-3",
        title: "PAN Card",
        category: "IDENTITY_PAN",
        fileName: "pan.pdf",
        mimeType: "application/pdf",
        uploadedBy: "TENANT",
      },
    ]

    const media = extractTenantConditionMedia(docs)
    expect(media).toHaveLength(2)
    expect(media[0].stage).toBe("AFTER_RENT")
    expect(media[0].mediaKind).toBe("VIDEO")
    expect(media[1].stage).toBe("BEFORE_RENT")
    expect(media[1].rating).toBe("EXCELLENT")

    const grouped = groupTenantConditionByRoom(media)
    expect(grouped).toHaveLength(1)
    expect(grouped[0].room).toBe("Living Room")
    expect(grouped[0].before).toHaveLength(1)
    expect(grouped[0].after).toHaveLength(1)

    expect(isConditionMediaDocument(docs[0])).toBe(true)
    expect(isConditionMediaDocument(docs[2])).toBe(false)
  })

  it("computes missing mandatory KYC documents", () => {
    const docs: TenantPortalDocument[] = [
      { id: "1", title: "PAN", category: "IDENTITY_PAN", fileName: "pan.pdf" },
    ]
    const missing = computeMissingMandatoryKycDocs(docs)
    expect(missing.map((m) => m.category)).toEqual(["IDENTITY_AADHAAR", "ADDRESS_PROOF"])
  })

  it("validates condition media file size and type", () => {
    expect(
      validateConditionMediaFile({ type: "video/mp4", size: 20 * 1024 * 1024, name: "tour.mp4" })
    ).toBe("")
    expect(
      validateConditionMediaFile({ type: "video/mp4", size: 60 * 1024 * 1024, name: "big.mp4" })
    ).toContain("50 MB")
    expect(
      validateConditionMediaFile({ type: "application/pdf", size: 1024, name: "doc.pdf" })
    ).toContain("Unsupported file type")
  })

  it("computes video compression bitrate and scaled dimensions", () => {
    expect(calculateTargetVideoBitrateBps(60)).toBe(4_500_000)
    expect(calculateTargetVideoBitrateBps(600)).toBe(565_145)
    expect(computeScaledDimensions(3840, 2160, 1280)).toEqual({ width: 1280, height: 720 })
  })
})
