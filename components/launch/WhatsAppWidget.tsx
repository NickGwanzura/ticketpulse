interface Props {
  phone: string
  message?: string
  label?: string
}

export default function WhatsAppWidget({
  phone,
  message = "Hi TicketPulse, I'd like early access info.",
  label = "Chat on WhatsApp",
}: Props) {
  const href = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="group fixed bottom-20 right-3 z-50 inline-flex items-center gap-2 rounded-full bg-[#25D366] py-2.5 pl-2.5 pr-3 text-white shadow-[0_18px_40px_-12px_rgba(37,211,102,0.55)] ring-1 ring-white/30 transition-all hover:scale-[1.03] hover:bg-[#1FBA59] active:scale-[0.99] sm:bottom-7 sm:right-7 sm:gap-2.5 sm:py-3 sm:pl-3.5 sm:pr-4"
    >
      <span className="relative inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/15 sm:h-7 sm:w-7">
        <span className="absolute inset-0 rounded-full bg-white/30 animate-ping opacity-60" aria-hidden />
        <svg viewBox="0 0 32 32" width="18" height="18" fill="currentColor" aria-hidden className="relative">
          <path d="M19.11 17.42c-.27-.13-1.59-.78-1.84-.87-.25-.09-.43-.13-.61.13-.18.27-.7.87-.86 1.05-.16.18-.32.2-.59.07-.27-.13-1.13-.41-2.16-1.32-.8-.71-1.34-1.59-1.5-1.86-.16-.27-.02-.42.12-.55.12-.12.27-.32.41-.48.13-.16.18-.27.27-.45.09-.18.05-.34-.02-.48-.07-.13-.61-1.46-.83-2-.22-.53-.45-.46-.61-.46-.16-.01-.34-.01-.52-.01-.18 0-.48.07-.73.34-.25.27-.95.93-.95 2.27 0 1.34.97 2.63 1.11 2.81.13.18 1.91 2.91 4.62 4.08.65.28 1.15.45 1.55.58.65.21 1.24.18 1.71.11.52-.08 1.59-.65 1.81-1.27.22-.62.22-1.16.16-1.27-.06-.11-.25-.18-.52-.31zM16.05 5.34h-.01c-5.91 0-10.7 4.78-10.7 10.66 0 2.1.61 4.06 1.66 5.71l-1.09 3.96 4.07-1.06c1.59.87 3.39 1.33 5.21 1.33h.01c5.91 0 10.7-4.78 10.7-10.66 0-2.85-1.11-5.52-3.13-7.54-2.02-2.01-4.71-3.4-7.72-3.4zm0 19.51c-1.59 0-3.13-.43-4.49-1.23l-.32-.19-3.34.87.89-3.25-.21-.33c-.88-1.4-1.34-3.01-1.34-4.7 0-4.83 3.94-8.76 8.79-8.76 2.36 0 4.57.91 6.23 2.57 1.66 1.66 2.57 3.86 2.57 6.21.01 4.83-3.93 8.81-8.78 8.81z" />
        </svg>
      </span>
      <span className="pr-0.5 text-[12px] font-semibold tracking-tight sm:text-[13px]">{label}</span>
    </a>
  )
}
