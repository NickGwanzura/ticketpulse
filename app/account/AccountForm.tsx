"use client"

import { useState, useTransition } from "react"
import { Mail, Phone } from "lucide-react"
import ImageUploader from "@/components/ui/ImageUploader"
import { updateAccountProfile } from "./actions"
import { inputBaseClass } from "@/lib/utils"

interface Props {
  initialName:  string | null
  initialEmail: string | null
  initialPhone: string | null
  initialImage: string | null
  initialBio:   string | null
}

export default function AccountForm({
  initialName,
  initialEmail,
  initialPhone,
  initialImage,
  initialBio,
}: Props) {
  const [name,  setName]  = useState(initialName  ?? "")
  const [phone, setPhone] = useState(initialPhone ?? "")
  const [bio,   setBio]   = useState(initialBio   ?? "")
  const [image, setImage] = useState<string | null>(initialImage ?? null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const [isPending, startTransition] = useTransition()

  function handleReset() {
    setName(initialName   ?? "")
    setPhone(initialPhone ?? "")
    setBio(initialBio     ?? "")
    setImage(initialImage ?? null)
    setError(null)
    setSaved(false)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaved(false)
    startTransition(async () => {
      try {
        await updateAccountProfile({
          name:  name.trim() || null,
          image: image       ?? null,
          phone: phone.trim() || null,
          bio:   bio.trim()   || null,
        })
        setSaved(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong")
      }
    })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-line bg-paper p-6 md:p-7 space-y-5"
    >
      {/* Avatar uploader */}
      <ImageUploader
        kind="avatar"
        value={image}
        onChange={setImage}
        aspectRatio="square"
        label="Profile photo"
        helperText="2 MB max. JPEG, PNG, WebP, AVIF."
        className="max-w-[200px]"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
        <div>
          <label className="block text-[11.5px] font-medium text-ink-2 mb-1.5">Full name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            className={inputBaseClass}
          />
        </div>
        <div>
          <label className="block text-[11.5px] font-medium text-ink-2 mb-1.5">Email</label>
          <div className="relative">
            <Mail size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-3" />
            <input
              type="email"
              defaultValue={initialEmail ?? ""}
              className="w-full bg-paper-2 border border-line rounded-xl pl-10 pr-4 py-3 text-sm text-ink-2"
              readOnly
            />
          </div>
        </div>
        <div>
          <label className="block text-[11.5px] font-medium text-ink-2 mb-1.5">Phone</label>
          <div className="relative">
            <Phone size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-3" />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={30}
              placeholder="+263 77…"
              className={`${inputBaseClass} pl-10 pr-4`}
            />
          </div>
        </div>
        <div>
          <label className="block text-[11.5px] font-medium text-ink-2 mb-1.5">Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Tell us a bit about yourself"
            className={`${inputBaseClass} resize-none`}
          />
        </div>
      </div>

      {error && (
        <p className="text-[12.5px] text-rose-600 font-medium">{error}</p>
      )}
      {saved && (
        <p className="text-[12.5px] text-green-600 font-medium">Changes saved.</p>
      )}

      <div className="flex items-center justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={handleReset}
          disabled={isPending}
          className="text-sm font-medium text-ink-2 hover:text-ink px-3 py-2 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-xl bg-green-600 text-white text-sm font-semibold px-4 py-2.5 hover:bg-green-700 transition-colors shadow-sm shadow-green-600/20 disabled:opacity-60"
        >
          {isPending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  )
}
