import { isVideoMimeType, MAX_CONDITION_MEDIA_BYTES } from "./propertyConditionMedia"

const TARGET_COMPRESSED_BYTES = Math.floor(MAX_CONDITION_MEDIA_BYTES * 0.9) // ~45 MB safety margin under 50 MB

export function calculateTargetVideoBitrateBps(
  durationSeconds: number,
  targetBytes: number = TARGET_COMPRESSED_BYTES,
  audioBps: number = 64_000
): number {
  const safeDuration = Math.max(durationSeconds, 1)
  const totalBps = Math.floor((targetBytes * 8) / safeDuration)
  const videoBps = totalBps - audioBps
  return Math.max(200_000, Math.min(videoBps, 4_500_000))
}

export function computeScaledDimensions(
  width: number,
  height: number,
  maxLongEdge: number
): { width: number; height: number } {
  const safeW = Math.max(width || 1280, 2)
  const safeH = Math.max(height || 720, 2)
  const longEdge = Math.max(safeW, safeH)
  if (longEdge <= maxLongEdge) {
    return {
      width: Math.max(2, Math.floor(safeW / 2) * 2),
      height: Math.max(2, Math.floor(safeH / 2) * 2),
    }
  }
  const scale = maxLongEdge / longEdge
  return {
    width: Math.max(2, Math.floor((safeW * scale) / 2) * 2),
    height: Math.max(2, Math.floor((safeH * scale) / 2) * 2),
  }
}

function pickSupportedVideoMimeType(): { mimeType: string; extension: string } {
  if (typeof MediaRecorder === "undefined") {
    throw new Error("This browser does not support in-browser video compression.")
  }
  const candidates: Array<{ mimeType: string; extension: string }> = [
    { mimeType: "video/mp4;codecs=avc1", extension: "mp4" },
    { mimeType: "video/mp4", extension: "mp4" },
    { mimeType: "video/webm;codecs=vp9,opus", extension: "webm" },
    { mimeType: "video/webm;codecs=vp8,opus", extension: "webm" },
    { mimeType: "video/webm", extension: "webm" },
  ]
  for (const candidate of candidates) {
    if (MediaRecorder.isTypeSupported(candidate.mimeType)) {
      return candidate
    }
  }
  return { mimeType: "", extension: "webm" }
}

async function compressImageFile(
  file: File,
  targetBytes: number,
  onProgress?: (percent: number) => void
): Promise<File> {
  onProgress?.(15)
  const bitmap = await createImageBitmap(file)
  try {
    const { width, height } = computeScaledDimensions(bitmap.width, bitmap.height, 2560)
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("Canvas 2D context is unavailable.")
    ctx.drawImage(bitmap, 0, 0, width, height)

    const baseName = file.name.replace(/\.[^/.]+$/, "")
    for (const quality of [0.85, 0.72, 0.58, 0.42]) {
      onProgress?.(Math.round(30 + (1 - quality) * 60))
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", quality)
      )
      if (blob && blob.size <= targetBytes) {
        onProgress?.(100)
        return new File([blob], `${baseName}-compressed.jpg`, { type: "image/jpeg" })
      }
    }
    throw new Error("Could not compress image under 50 MB.")
  } finally {
    bitmap.close()
  }
}

async function compressVideoFile(
  file: File,
  targetBytes: number,
  onProgress?: (percent: number) => void
): Promise<File> {
  const { mimeType, extension } = pickSupportedVideoMimeType()
  const objectUrl = URL.createObjectURL(file)
  const video = document.createElement("video")
  video.muted = true
  video.playsInline = true
  video.preload = "auto"
  video.src = objectUrl

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve()
      video.onerror = () =>
        reject(new Error("This video format cannot be decoded by your browser for compression."))
    })

    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 60
    const maxEdge = duration > 180 ? 854 : 1280
    const { width, height } = computeScaledDimensions(video.videoWidth, video.videoHeight, maxEdge)

    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("Canvas 2D context is unavailable.")

    const videoBitsPerSecond = calculateTargetVideoBitrateBps(duration, targetBytes)
    const canvasStream = canvas.captureStream(24)

    const mediaEl = video as HTMLVideoElement & {
      captureStream?: () => MediaStream
      mozCaptureStream?: () => MediaStream
    }
    const sourceStream = mediaEl.captureStream?.() || mediaEl.mozCaptureStream?.()
    if (sourceStream) {
      for (const audioTrack of sourceStream.getAudioTracks()) {
        canvasStream.addTrack(audioTrack)
      }
    }

    const recorderOptions: MediaRecorderOptions = {
      videoBitsPerSecond,
      audioBitsPerSecond: 64_000,
    }
    if (mimeType) recorderOptions.mimeType = mimeType

    const recorder = new MediaRecorder(canvasStream, recorderOptions)
    const chunks: BlobPart[] = []
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        chunks.push(event.data)
      }
    }

    const recordingStopped = new Promise<void>((resolve, reject) => {
      recorder.onstop = () => resolve()
      recorder.onerror = () => reject(new Error("Video compression failed during encoding."))
    })

    let rafId = 0
    const drawFrame = () => {
      if (!video.paused && !video.ended) {
        ctx.drawImage(video, 0, 0, width, height)
        const pct = Math.min(99, Math.round((video.currentTime / duration) * 100))
        onProgress?.(pct)
        rafId = requestAnimationFrame(drawFrame)
      }
    }

    recorder.start(1000)
    await video.play()
    rafId = requestAnimationFrame(drawFrame)

    await new Promise<void>((resolve) => {
      video.onended = () => resolve()
    })

    cancelAnimationFrame(rafId)
    ctx.drawImage(video, 0, 0, width, height)
    if (recorder.state !== "inactive") {
      recorder.stop()
    }
    await recordingStopped

    const finalMime = recorder.mimeType || mimeType || "video/webm"
    const compressedBlob = new Blob(chunks, { type: finalMime })
    onProgress?.(100)

    if (compressedBlob.size > MAX_CONDITION_MEDIA_BYTES) {
      throw new Error(
        `Compressed video is ${(compressedBlob.size / (1024 * 1024)).toFixed(
          1
        )} MB, which still exceeds 50 MB. Please trim the video into shorter clips.`
      )
    }

    const baseName = file.name.replace(/\.[^/.]+$/, "")
    return new File([compressedBlob], `${baseName}-compressed.${extension}`, {
      type: finalMime,
    })
  } finally {
    video.pause()
    video.removeAttribute("src")
    video.load()
    URL.revokeObjectURL(objectUrl)
  }
}

export async function compressMediaToLimitIfNeeded(
  file: File,
  onProgress?: (percent: number) => void
): Promise<{ file: File; wasCompressed: boolean }> {
  if (file.size <= MAX_CONDITION_MEDIA_BYTES) {
    return { file, wasCompressed: false }
  }

  const isVideo =
    isVideoMimeType(file.type) || /\.(mp4|mov|webm)$/i.test(file.name || "")
  const compressed = isVideo
    ? await compressVideoFile(file, TARGET_COMPRESSED_BYTES, onProgress)
    : await compressImageFile(file, TARGET_COMPRESSED_BYTES, onProgress)

  return { file: compressed, wasCompressed: true }
}
