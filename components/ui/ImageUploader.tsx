"use client"

import {
  useCallback,
  useId,
  useRef,
  useState,
  type DragEvent,
  type ChangeEvent,
} from "react"
import { UploadCloud, X, Star, Loader2, AlertCircle, GripVertical } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  UPLOAD_LIMITS,
  ALLOWED_IMAGE_MIME,
  type UploadKind,
} from "@/lib/upload-limits"

// Types

type AspectRatio = "square" | "wide" | "portrait" | "free"

type CommonProps = {
  kind: UploadKind
  vendorId?: string
  eventId?: string
  aspectRatio?: AspectRatio
  label?: string
  helperText?: string
  className?: string
  disabled?: boolean
}

type SingleProps = CommonProps & {
  multiple?: false
  value?: string | null
  onChange?: (url: string | null) => void
  values?: never
  onValuesChange?: never
  maxItems?: never
}

type MultiProps = CommonProps & {
  multiple: true
  values?: string[]
  onValuesChange?: (urls: string[]) => void
  maxItems?: number
  value?: never
  onChange?: never
}

type Props = SingleProps | MultiProps

type SignResponse = { uploadUrl: string; publicUrl: string; key: string }

type UploadState = {
  id: string
  filename: string
  progress: number      // 0..1
  error?: string
}

// Utilities

const ASPECT_CLASS: Record<AspectRatio, string> = {
  square:   "aspect-square",
  wide:     "aspect-[16/9]",
  portrait: "aspect-[3/4]",
  free:     "",
}

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`
  return `${bytes} B`
}

function uploadToR2(uploadUrl: string, file: File, onProgress: (p: number) => void): Promise<void> {
  // fetch() does not surface upload progress in browsers, so we use XHR.
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("PUT", uploadUrl, true)
    xhr.setRequestHeader("Content-Type", file.type)
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) onProgress(ev.loaded / ev.total)
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new Error(`Upload failed with status ${xhr.status}`))
    }
    xhr.onerror = () => reject(new Error("Network error during upload"))
    xhr.onabort = () => reject(new Error("Upload aborted"))
    xhr.send(file)
  })
}


export default function ImageUploader(props: Props) {
  const {
    kind,
    vendorId,
    eventId,
    aspectRatio = "square",
    label,
    helperText,
    className,
    disabled,
  } = props

  const multiple = props.multiple === true
  const maxItems = multiple ? props.maxItems ?? 12 : 1

  const items: string[] = multiple
    ? props.values ?? []
    : props.value
      ? [props.value]
      : []

  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [uploads, setUploads] = useState<UploadState[]>([])
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const inputId = useId()

  const limit = UPLOAD_LIMITS[kind]
  const remaining = Math.max(0, maxItems - items.length)
  const acceptAttr = ALLOWED_IMAGE_MIME.join(",")
  const triggerDisabled = !!disabled || remaining === 0

  // Emit changes
  const emit = useCallback((next: string[]) => {
    if (multiple) {
      props.onValuesChange?.(next)
    } else {
      props.onChange?.(next[0] ?? null)
    }
  }, [multiple, props])

  // File processing
  const processFiles = useCallback(async (fileList: FileList | File[]) => {
    const files = Array.from(fileList).slice(0, remaining)
    if (files.length === 0) return

    for (const file of files) {
      const id = `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

      // Client validation
      if (!(ALLOWED_IMAGE_MIME as readonly string[]).includes(file.type)) {
        setUploads((u) => [...u, { id, filename: file.name, progress: 0, error: "Unsupported file type" }])
        continue
      }
      if (file.size > limit) {
        setUploads((u) => [...u, {
          id,
          filename: file.name,
          progress: 0,
          error: `File too large (max ${formatBytes(limit)})`,
        }])
        continue
      }

      setUploads((u) => [...u, { id, filename: file.name, progress: 0 }])

      try {
        // 1) Presign
        const signRes = await fetch("/api/uploads/sign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind,
            filename: file.name,
            contentType: file.type,
            contentLength: file.size,
            vendorId,
            eventId,
          }),
        })

        if (!signRes.ok) {
          let msg = `Sign failed (${signRes.status})`
          try {
            const data = await signRes.json()
            if (typeof data?.error === "string") msg = data.error
          } catch { /* ignore */ }
          throw new Error(msg)
        }

        const { uploadUrl, publicUrl }: SignResponse = await signRes.json()

        // 2) PUT to R2 with progress
        await uploadToR2(uploadUrl, file, (p) => {
          setUploads((u) => u.map((it) => (it.id === id ? { ...it, progress: p } : it)))
        })

        // 3) Mark complete & append to values
        setUploads((u) => u.filter((it) => it.id !== id))
        // Snapshot current items at the time of completion to avoid races.
        if (multiple) {
          const current = (props.values ?? []) as string[]
          props.onValuesChange?.([...current, publicUrl].slice(0, maxItems))
        } else {
          props.onChange?.(publicUrl)
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed"
        setUploads((u) => u.map((it) => (it.id === id ? { ...it, error: message } : it)))
      }
    }
  }, [remaining, limit, kind, vendorId, eventId, multiple, maxItems, props])

  // Drag-drop on the dropzone
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
    if (triggerDisabled) return
    if (e.dataTransfer.files?.length) {
      void processFiles(e.dataTransfer.files)
    }
  }

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      void processFiles(e.target.files)
    }
    e.target.value = "" // allow re-selecting the same file
  }

  // Reorder via HTML5 drag-and-drop (multi mode)
  const onItemDragStart = (i: number) => (e: DragEvent<HTMLDivElement>) => {
    setDraggingIndex(i)
    e.dataTransfer.effectAllowed = "move"
    // Required for Firefox drag
    e.dataTransfer.setData("text/plain", String(i))
  }
  const onItemDragOver = (i: number) => (e: DragEvent<HTMLDivElement>) => {
    if (draggingIndex === null || draggingIndex === i) return
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
  }
  const onItemDrop = (i: number) => (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (draggingIndex === null || draggingIndex === i) return
    const next = items.slice()
    const [moved] = next.splice(draggingIndex, 1)
    next.splice(i, 0, moved)
    setDraggingIndex(null)
    emit(next)
  }
  const onItemDragEnd = () => setDraggingIndex(null)

  // Item actions
  const removeAt = (i: number) => {
    const next = items.slice()
    next.splice(i, 1)
    emit(next)
  }
  const setPrimary = (i: number) => {
    if (i === 0) return
    const next = items.slice()
    const [moved] = next.splice(i, 1)
    next.unshift(moved)
    emit(next)
  }

  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      {label && (
        <label htmlFor={inputId} className="text-[13px] font-medium text-ink tracking-tight">
          {label}
        </label>
      )}

      {/* Existing previews */}
      {items.length > 0 && (
        <div
          className={cn(
            "grid gap-3",
            multiple
              ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4"
              : "grid-cols-1 max-w-xs",
          )}
        >
          {items.map((url, i) => (
            <div
              key={`${url}-${i}`}
              draggable={multiple}
              onDragStart={multiple ? onItemDragStart(i) : undefined}
              onDragOver={multiple ? onItemDragOver(i) : undefined}
              onDrop={multiple ? onItemDrop(i) : undefined}
              onDragEnd={multiple ? onItemDragEnd : undefined}
              className={cn(
                "relative group rounded-xl overflow-hidden border bg-paper",
                ASPECT_CLASS[aspectRatio],
                draggingIndex === i ? "border-blue ring-2 ring-green-500/20 opacity-60" : "border-line",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
                draggable={false}
              />

              {/* Primary badge (multi mode) */}
              {multiple && i === 0 && (
                <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 rounded-md bg-navy/90 text-white text-[10.5px] font-semibold px-1.5 py-0.5 tracking-tight">
                  <Star size={10} strokeWidth={3} className="fill-white" /> Primary
                </span>
              )}

              {/* Drag handle (multi mode) */}
              {multiple && items.length > 1 && (
                <span
                  className="absolute top-1.5 right-9 inline-flex items-center justify-center w-6 h-6 rounded-md bg-white/90 text-ink-2 shadow-sm cursor-grab active:cursor-grabbing"
                  aria-hidden
                >
                  <GripVertical size={12} />
                </span>
              )}

              {/* Set-as-primary (multi, non-primary) */}
              {multiple && i !== 0 && (
                <button
                  type="button"
                  onClick={() => setPrimary(i)}
                  title="Set as primary"
                  className="absolute bottom-1.5 left-1.5 inline-flex items-center justify-center w-7 h-7 rounded-md bg-white/90 text-ink-2 hover:text-navy hover:bg-white shadow-sm transition opacity-0 group-hover:opacity-100"
                >
                  <Star size={13} />
                </button>
              )}

              {/* Remove */}
              <button
                type="button"
                onClick={() => removeAt(i)}
                title="Remove"
                className="absolute top-1.5 right-1.5 inline-flex items-center justify-center w-7 h-7 rounded-md bg-white/90 text-ink-2 hover:text-rose-600 hover:bg-white shadow-sm transition"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* In-flight uploads */}
      {uploads.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {uploads.map((u) => (
            <li
              key={u.id}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-[12.5px]",
                u.error
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : "border-line bg-paper-2 text-ink-2",
              )}
            >
              {u.error ? (
                <AlertCircle size={14} className="shrink-0" />
              ) : (
                <Loader2 size={14} className="shrink-0 animate-spin text-blue" />
              )}
              <span className="truncate font-medium">{u.filename}</span>
              {u.error ? (
                <span className="ml-auto truncate">{u.error}</span>
              ) : (
                <span className="ml-auto tabular-nums text-ink-3">
                  {Math.round(u.progress * 100)}%
                </span>
              )}
              {u.error && (
                <button
                  type="button"
                  onClick={() => setUploads((s) => s.filter((it) => it.id !== u.id))}
                  className="ml-1 text-rose-700/70 hover:text-rose-700"
                  aria-label="Dismiss error"
                >
                  <X size={12} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Dropzone trigger */}
      {!triggerDisabled && (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              inputRef.current?.click()
            }
          }}
          className={cn(
            "flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-7 cursor-pointer text-center transition",
            "hover:border-line-2 hover:bg-paper-2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-green-500/20",
            dragOver
              ? "border-blue bg-green-500/5"
              : "border-line bg-paper",
          )}
        >
          <UploadCloud size={20} className="text-ink-3" strokeWidth={1.75} />
          <p className="text-[13px] font-medium text-ink tracking-tight">
            Drop {multiple ? "images" : "an image"} or click to upload
          </p>
          <p className="text-[11.5px] text-ink-3">
            JPG, PNG, WebP, AVIF · up to {formatBytes(limit)}
            {multiple && remaining < maxItems
              ? ` · ${remaining} of ${maxItems} slots left`
              : multiple
                ? ` · up to ${maxItems} items`
                : ""}
          </p>
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            className="sr-only"
            accept={acceptAttr}
            multiple={multiple}
            onChange={onPick}
            disabled={triggerDisabled}
          />
        </div>
      )}

      {triggerDisabled && remaining === 0 && multiple && (
        <p className="text-[11.5px] text-ink-3">
          Maximum of {maxItems} {maxItems === 1 ? "image" : "images"} reached. Remove one to add another.
        </p>
      )}

      {helperText && (
        <p className="text-[11.5px] text-ink-3">{helperText}</p>
      )}
    </div>
  )
}
