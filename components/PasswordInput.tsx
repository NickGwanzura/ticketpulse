"use client"

import { useState } from "react"
import { Lock, Eye, EyeOff } from "lucide-react"

interface PasswordInputProps {
  name?: string
  placeholder?: string
  autoComplete?: string
  minLength?: number
  required?: boolean
  iconClassName?: string
  inputClassName?: string
}

export default function PasswordInput({
  name = "password",
  placeholder = "••••••••",
  autoComplete = "current-password",
  minLength = 8,
  required = true,
  iconClassName = "text-ink-2",
  inputClassName = "",
}: PasswordInputProps) {
  const [show, setShow] = useState(false)

  return (
    <div className="relative">
      <Lock size={14} className={`absolute left-4 top-1/2 -translate-y-1/2 ${iconClassName}`} />
      <input
        type={show ? "text" : "password"}
        name={name}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className={`w-full bg-paper border border-line-2 rounded-xl pl-10 pr-10 py-3.5 text-[15px] text-ink placeholder:text-ink-2 focus:outline-none focus:border-blue focus:ring-4 focus:ring-blue/10 transition ${inputClassName}`}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-ink-3 hover:text-ink transition-colors"
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  )
}
