"use client"

import { useActionState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Check, X } from "lucide-react"
import Button from "@/components/ui/Button"

type AcceptResult = { ok: boolean; error?: string; redirectTo?: string }

async function acceptInviteAction(
  _prev: AcceptResult | undefined,
  formData: FormData,
): Promise<AcceptResult> {
  const token = formData.get("token")?.toString()
  if (!token) return { ok: false, error: "Missing token." }

  const res = await fetch(`/api/invite/${token}/accept`, { method: "POST" })
  const data = await res.json()
  if (!res.ok) return { ok: false, error: data.error ?? "Failed to accept invitation." }
  return { ok: true, redirectTo: data.redirectTo ?? "/organizer" }
}

async function declineInviteAction(
  _prev: AcceptResult | undefined,
  formData: FormData,
): Promise<AcceptResult> {
  const token = formData.get("token")?.toString()
  if (!token) return { ok: false, error: "Missing token." }

  const res = await fetch(`/api/invite/${token}/decline`, { method: "POST" })
  const data = await res.json()
  if (!res.ok) return { ok: false, error: data.error ?? "Failed to decline." }
  return { ok: true }
}

export default function AcceptInviteForm({
  token,
  inviteId,
  eventId,
  eventTitle,
  email,
  isSignedIn,
  emailMatches,
}: {
  token: string
  inviteId: string
  eventId: string
  eventTitle: string
  email: string
  isSignedIn: boolean
  emailMatches: boolean
}) {
  const router = useRouter()
  const [acceptState, acceptAction, acceptPending] = useActionState(acceptInviteAction, undefined)
  const [declineState, declineAction, declinePending] = useActionState(declineInviteAction, undefined)

  if (acceptState?.ok) {
    router.push(acceptState.redirectTo ?? "/organizer")
    return null
  }

  if (declineState?.ok) {
    return (
      <div className="max-w-md w-full text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-paper mx-auto flex items-center justify-center ring-1 ring-line">
          <span className="text-2xl">👋</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Invitation declined</h1>
        <p className="text-ink-2">You have declined the invitation to organise <strong>{eventTitle}</strong>.</p>
      </div>
    )
  }

  return (
    <div className="max-w-md w-full">
      <div className="rounded-2xl border border-line bg-paper p-8 shadow-sm">
        <div className="text-center space-y-4 mb-8">
          <div className="w-16 h-16 rounded-2xl bg-green-50 mx-auto flex items-center justify-center">
            <span className="text-2xl">🎫</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Event organiser invitation</h1>
          <p className="text-ink-2 text-sm leading-relaxed">
            You have been invited to help organise
            <br />
            <strong className="text-ink">{eventTitle}</strong>.
          </p>
        </div>

        {!isSignedIn ? (
          <div className="space-y-4">
            <p className="text-sm text-ink-2 text-center">
              Sign in or create an account with <strong>{email}</strong> to accept this invitation.
            </p>
            <Link
              href={`/auth/signin?callbackUrl=/invite/${token}`}
              className="block w-full text-center rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white shadow-sm shadow-green-600/20 hover:bg-green-700 transition"
            >
              Sign in with this email
            </Link>
            <Link
              href={`/auth/signup?callbackUrl=/invite/${token}`}
              className="block w-full text-center rounded-xl border border-line px-5 py-3 text-sm font-medium text-ink hover:bg-paper-2 transition"
            >
              Create an account
            </Link>
          </div>
        ) : !emailMatches ? (
          <div className="space-y-4 text-center">
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
              You are signed in as <strong>{email}</strong>, but this invitation was sent to a different email.
              Sign in with the correct email to accept.
            </div>
            <Link
              href={`/auth/signin?callbackUrl=/invite/${token}`}
              className="block w-full text-center rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white shadow-sm shadow-green-600/20 hover:bg-green-700 transition"
            >
              Sign in with a different email
            </Link>
            <form action={declineAction}>
              <input type="hidden" name="token" value={token} />
              <button
                type="submit"
                disabled={declinePending}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-line px-5 py-3 text-sm font-medium text-ink-2 hover:bg-paper-2 transition disabled:opacity-50"
              >
                <X size={14} /> Decline invitation
              </button>
            </form>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800 text-center">
              Signed in as <strong>{email}</strong>
            </div>

            <form action={acceptAction}>
              <input type="hidden" name="token" value={token} />
              <Button
                type="submit"
                loading={acceptPending}
                fullWidth
                size="lg"
              >
                <Check size={16} /> Accept invitation
              </Button>
            </form>

            <form action={declineAction}>
              <input type="hidden" name="token" value={token} />
              <button
                type="submit"
                disabled={declinePending || acceptPending}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-line px-5 py-3 text-sm font-medium text-ink-2 hover:bg-paper-2 transition disabled:opacity-50"
              >
                <X size={14} /> Decline
              </button>
            </form>

            {(acceptState?.error || declineState?.error) && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {acceptState?.error ?? declineState?.error}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
