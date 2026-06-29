"use client"

import { useState, useTransition, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  Music2,
  Trash2,
  Pencil,
  Plus,
  ExternalLink,
  X,
  GripVertical,
  MicVocal,
} from "lucide-react"

import {
  addLineupMemberAction,
  updateLineupMemberAction,
  deleteLineupMemberAction,
  reorderLineupAction,
} from "../actions"

export type LineupMember = {
  id: string
  name: string
  role: string | null
  bio: string | null
  imageUrl: string | null
  socialUrl: string | null
  displayOrder: number | null
}

type Props = {
  members: LineupMember[]
  eventId: string
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("")
}

function inputCls(hasError?: boolean) {
  return [
    "w-full rounded-xl border bg-paper-2 px-3 py-2.5 text-[13px] text-ink",
    "placeholder:text-ink-3 focus:outline-none focus:ring-4",
    hasError
      ? "border-rose-300 focus:border-rose-400 focus:ring-rose-500/15"
      : "border-line focus:border-brand-500/50 focus:ring-brand-500/10",
  ].join(" ")
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[12px] font-semibold text-ink-2 mb-1">
      {children}
    </label>
  )
}

type MemberFormProps = {
  eventId: string
  member?: LineupMember
  onDone: () => void
}

function MemberForm({ eventId, member, onDone }: MemberFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  const isEdit = !!member

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = isEdit
        ? await updateLineupMemberAction(member.id, eventId, formData)
        : await addLineupMemberAction(eventId, formData)

      if (!result.ok) {
        setError(result.error ?? "Something went wrong.")
        return
      }
      router.refresh()
      onDone()
    })
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-3">
      {error && (
        <p className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-[12px] text-rose-700">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label>Name *</Label>
          <input
            name="name"
            required
            defaultValue={member?.name ?? ""}
            placeholder="e.g. DJ Khaled"
            className={inputCls()}
          />
        </div>
        <div>
          <Label>Role</Label>
          <input
            name="role"
            defaultValue={member?.role ?? ""}
            placeholder="e.g. DJ, Performer, Speaker"
            className={inputCls()}
          />
        </div>
      </div>

      <div>
        <Label>Bio</Label>
        <textarea
          name="bio"
          defaultValue={member?.bio ?? ""}
          placeholder="Short description shown on the event page…"
          rows={3}
          className={[inputCls(), "resize-none"].join(" ")}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label>Image URL</Label>
          <input
            name="imageUrl"
            type="url"
            defaultValue={member?.imageUrl ?? ""}
            placeholder="https://…"
            className={inputCls()}
          />
        </div>
        <div>
          <Label>Social / Website URL</Label>
          <input
            name="socialUrl"
            type="url"
            defaultValue={member?.socialUrl ?? ""}
            placeholder="https://instagram.com/…"
            className={inputCls()}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-ink/90 transition disabled:opacity-60"
        >
          {isPending ? "Saving…" : isEdit ? "Save changes" : "Add member"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line px-4 py-2.5 text-[13px] font-medium text-ink-2 hover:text-ink hover:border-line-2 transition"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

type MemberCardProps = {
  member: LineupMember
  eventId: string
  onEdit: () => void
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>
}

function MemberCard({ member, eventId, onEdit, dragHandleProps }: MemberCardProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)

  function handleDelete() {
    startTransition(async () => {
      await deleteLineupMemberAction(member.id, eventId)
      router.refresh()
    })
  }

  return (
    <div className="flex items-start gap-3 rounded-xl border border-line bg-paper p-4">
      {/* Drag handle */}
      <div
        {...dragHandleProps}
        className="mt-0.5 shrink-0 cursor-grab text-ink-3 hover:text-ink-2 transition-colors touch-none"
        title="Drag to reorder"
      >
        <GripVertical size={16} />
      </div>

      {/* Avatar */}
      <div className="shrink-0">
        {member.imageUrl ? (
          <img
            src={member.imageUrl}
            alt={member.name}
            className="h-11 w-11 rounded-full object-cover border border-line"
          />
        ) : (
          <div className="h-11 w-11 rounded-full bg-paper-2 border border-line flex items-center justify-center">
            <span className="text-[13px] font-bold text-ink-2">
              {getInitials(member.name)}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-ink leading-snug truncate">
              {member.name}
            </p>
            {member.role && (
              <p className="text-[12px] text-ink-3 mt-0.5 flex items-center gap-1">
                <MicVocal size={11} className="shrink-0" />
                {member.role}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            {member.socialUrl && (
              <a
                href={member.socialUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-lg p-1.5 text-ink-3 hover:text-brand-600 hover:bg-brand-50 transition"
                title="Open social link"
              >
                <ExternalLink size={13} />
              </a>
            )}
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center justify-center rounded-lg p-1.5 text-ink-3 hover:text-ink hover:bg-paper-2 transition"
              title="Edit"
            >
              <Pencil size={13} />
            </button>
            {confirming ? (
              <span className="flex items-center gap-1.5">
                <span className="text-[12px] text-rose-600 font-medium">Delete?</span>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isPending}
                  className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1 text-[12px] font-semibold text-white hover:bg-rose-700 transition disabled:opacity-60"
                >
                  {isPending ? "…" : "Yes"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-[12px] font-medium text-ink-2 hover:text-ink transition"
                >
                  No
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="inline-flex items-center justify-center rounded-lg p-1.5 text-ink-3 hover:text-rose-600 hover:bg-rose-50 transition"
                title="Delete"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>

        {member.bio && (
          <p className="mt-1.5 text-[12px] text-ink-2 line-clamp-2 leading-relaxed">
            {member.bio}
          </p>
        )}
      </div>
    </div>
  )
}

export default function LineupManager({ members: initialMembers, eventId }: Props) {
  const router = useRouter()
  const [members, setMembers] = useState<LineupMember[]>(initialMembers)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Keep local members in sync when server refreshes props
  // (Next.js passes new props on router.refresh())
  const prevInitial = useRef(initialMembers)
  if (prevInitial.current !== initialMembers) {
    prevInitial.current = initialMembers
    setMembers(initialMembers)
  }

  // Drag state
  const dragIndex = useRef<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [isPendingReorder, startReorderTransition] = useTransition()

  function handleDragStart(index: number) {
    dragIndex.current = index
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault()
    setDragOverIndex(index)
  }

  function handleDrop(dropIndex: number) {
    const fromIndex = dragIndex.current
    if (fromIndex === null || fromIndex === dropIndex) {
      dragIndex.current = null
      setDragOverIndex(null)
      return
    }

    const reordered = [...members]
    const [moved] = reordered.splice(fromIndex, 1)
    reordered.splice(dropIndex, 0, moved)

    setMembers(reordered)
    dragIndex.current = null
    setDragOverIndex(null)

    startReorderTransition(async () => {
      await reorderLineupAction(eventId, reordered.map((m) => m.id))
      router.refresh()
    })
  }

  function handleDragEnd() {
    dragIndex.current = null
    setDragOverIndex(null)
  }

  return (
    <div className="space-y-5">
      {/* Add member toggle */}
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-ink-2">
          {members.length === 0
            ? "No lineup members yet."
            : `${members.length} member${members.length === 1 ? "" : "s"}`}
        </p>
        <button
          type="button"
          onClick={() => {
            setShowAddForm((v) => !v)
            setEditingId(null)
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-ink/90 transition"
        >
          {showAddForm ? (
            <>
              <X size={13} /> Cancel
            </>
          ) : (
            <>
              <Plus size={13} /> Add member
            </>
          )}
        </button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="rounded-xl border border-dashed border-line bg-paper-2/40 p-5">
          <p className="text-[14px] font-semibold text-ink mb-4">New lineup member</p>
          <MemberForm
            eventId={eventId}
            onDone={() => setShowAddForm(false)}
          />
        </div>
      )}

      {/* Member list */}
      {members.length === 0 && !showAddForm && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line bg-paper-2/30 py-14 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-paper-2 border border-line mb-3">
            <Music2 size={20} className="text-ink-3" />
          </div>
          <p className="text-[14px] font-semibold text-ink">No performers yet</p>
          <p className="mt-1 text-[13px] text-ink-3 max-w-xs">
            Add DJs, speakers, bands, and performers to display on your event page.
          </p>
        </div>
      )}

      {members.length > 0 && (
        <div className="space-y-2">
          {members.map((member, index) =>
            editingId === member.id ? (
              <div
                key={member.id}
                className="rounded-xl border border-brand-200 bg-paper p-5"
              >
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[14px] font-semibold text-ink">Edit member</p>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="inline-flex items-center justify-center rounded-lg p-1.5 text-ink-3 hover:text-ink hover:bg-paper-2 transition"
                  >
                    <X size={14} />
                  </button>
                </div>
                <MemberForm
                  eventId={eventId}
                  member={member}
                  onDone={() => setEditingId(null)}
                />
              </div>
            ) : (
              <div
                key={member.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={() => handleDrop(index)}
                onDragEnd={handleDragEnd}
                className={[
                  "transition-opacity",
                  dragOverIndex === index && dragIndex.current !== index
                    ? "opacity-50 ring-2 ring-brand-400 rounded-xl"
                    : "",
                  isPendingReorder ? "opacity-70" : "",
                ].join(" ")}
              >
                <MemberCard
                  member={member}
                  eventId={eventId}
                  onEdit={() => {
                    setEditingId(member.id)
                    setShowAddForm(false)
                  }}
                  dragHandleProps={{
                    onMouseDown: (e) => e.currentTarget.parentElement?.setAttribute("draggable", "true"),
                  }}
                />
              </div>
            ),
          )}
        </div>
      )}

      {members.length > 1 && (
        <p className="text-[11px] text-ink-3 text-center">
          Drag members to reorder how they appear on the event page.
        </p>
      )}
    </div>
  )
}
