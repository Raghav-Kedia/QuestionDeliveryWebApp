"use client"
import React, { useCallback, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { uploadQuestion } from '@/app/admin/actions'

/**
 * Client-side image compression + upload wrapper.
 * 1. User selects an image file.
 * 2. We downscale (if needed) to max 1600px (width/height) via canvas.
 * 3. Convert to WebP (quality 0.8) if browser supports; fallback original Blob.
 * 4. Submit as FormData to existing server action (still performing server-side upload to Supabase for now).
 *
 * Incremental improvement (Step 2 from earlier plan): reduces payload size & perceived latency.
 * NOTE: Further optimization (direct signed upload) can replace this round-trip in a later step.
 */
export function UploadQuestionForm({ disabled }: { disabled: boolean }) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  const processImage = useCallback(async (file: File): Promise<Blob> => {
    // Guard: Only attempt canvas flow for images
    if (!file.type.startsWith('image/')) return file
    const bitmap = await createImageBitmap(file)
    const maxDim = 1600
    let { width, height } = bitmap
    if (width > maxDim || height > maxDim) {
      const ratio = Math.min(maxDim / width, maxDim / height)
      width = Math.round(width * ratio)
      height = Math.round(height * ratio)
    }
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(bitmap, 0, 0, width, height)

    // Try WebP conversion
    const quality = 0.8
    const blob: Blob | null = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/webp', quality)
    })

    // Fallback to original if conversion failed
    return blob || file
  }, [])

  const onChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null)
    const f = e.target.files?.[0]
    if (!f) return
    setPreview(URL.createObjectURL(f))
  }, [])

  const onSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    const fileEl = fileInputRef.current
    const file = fileEl?.files?.[0]
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const processed = await processImage(file)

      const form = new FormData()
      // Preserve original name but adjust extension if we produced WebP
      let filename = file.name
      if (processed !== file && processed.type === 'image/webp') {
        filename = file.name.replace(/\.[^.]+$/, '') + '.webp'
      }
      const finalFile = new File([processed], filename, { type: processed.type || file.type })
      form.set('file', finalFile)

      await uploadQuestion(form)
      // Reset state
      if (fileEl) fileEl.value = ''
      setPreview(null)
    } catch (err: any) {
      setError(err?.message || 'Upload failed')
    } finally {
      setBusy(false)
    }
  }, [busy, processImage])

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          name="file"
          type="file"
          accept="image/*"
          disabled={disabled || busy}
          onChange={onChange}
          className="rounded-na-input border px-3 py-2 text-sm"
        />
        <Button type="submit" variant="secondary" disabled={disabled || busy}>
          {busy ? 'Uploading...' : 'Upload'}
        </Button>
      </div>
      {preview && (
        <div className="flex items-center gap-4">
          <div className="text-xs text-muted-foreground">Preview:</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="preview" className="h-16 w-auto rounded-na-card border" />
        </div>
      )}
      {error && <div className="text-xs text-neo-status-error">{error}</div>}
      <p className="text-xs text-muted-foreground">Images are auto-compressed (max 1600px, WebP) before upload.</p>
    </form>
  )
}

export default UploadQuestionForm
