import { Settings as SettingsIcon } from "lucide-react"

export default function AdminSettingsPage() {
  return (
    <div>
      <div className="border-b border-line bg-paper-2">
        <div className="px-5 md:px-8 py-9 md:py-12">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">Settings</p>
          <h1 className="text-[28px] md:text-[34px] font-bold tracking-tight leading-tight text-ink">
            Platform settings
          </h1>
          <p className="mt-1.5 text-[14px] text-ink-2">
            Defaults that apply across every event and organizer.
          </p>
        </div>
      </div>

      <div className="px-5 md:px-8 py-8 md:py-10">
        <form className="rounded-2xl border border-line bg-paper overflow-hidden max-w-2xl">
          <div className="px-5 md:px-6 py-4 border-b border-line flex items-center gap-2">
            <SettingsIcon size={14} className="text-ink-3" />
            <h2 className="text-[15px] font-semibold tracking-tight text-ink">General</h2>
          </div>

          <div className="p-5 md:p-6 space-y-5">
            <div>
              <label htmlFor="platform-name" className="block text-[12.5px] font-semibold text-ink mb-1.5">Platform name</label>
              <input
                id="platform-name"
                type="text"
                defaultValue="TicketPulse"
                className="w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-[13.5px] text-ink focus:outline-none focus:border-line-2 focus:ring-4 focus:ring-blue/10"
              />
            </div>

            <div>
              <label htmlFor="support-email" className="block text-[12.5px] font-semibold text-ink mb-1.5">Support email</label>
              <input
                id="support-email"
                type="email"
                defaultValue="support@ticketpulse.co.zw"
                className="w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-[13.5px] text-ink focus:outline-none focus:border-line-2 focus:ring-4 focus:ring-blue/10"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="default-currency" className="block text-[12.5px] font-semibold text-ink mb-1.5">Default currency</label>
                <select
                  id="default-currency"
                  defaultValue="USD"
                  className="w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-[13.5px] text-ink focus:outline-none focus:border-line-2 focus:ring-4 focus:ring-blue/10"
                >
                  <option value="USD">USD</option>
                  <option value="ZWL">ZWL</option>
                  <option value="ZAR">ZAR</option>
                </select>
              </div>

              <div>
                <label htmlFor="fee-percentage" className="block text-[12.5px] font-semibold text-ink mb-1.5">Platform fee (%)</label>
                <input
                  id="fee-percentage"
                  type="number"
                  defaultValue={8}
                  step={0.1}
                  min={0}
                  max={100}
                  className="w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-[13.5px] text-ink focus:outline-none focus:border-line-2 focus:ring-4 focus:ring-blue/10"
                />
              </div>
            </div>

            <div className="flex items-start justify-between gap-4 rounded-xl bg-paper-2 ring-1 ring-line p-4">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold tracking-tight text-ink">Maintenance mode</p>
                <p className="text-[12px] text-ink-2 mt-0.5">Temporarily block checkout while you investigate issues.</p>
              </div>
              <button
                type="button"
                aria-label="Toggle maintenance"
                className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full bg-paper ring-1 ring-line transition-colors"
              >
                <span className="inline-block h-4 w-4 translate-x-1 rounded-full bg-ink-3 shadow-sm transition-transform" />
              </button>
            </div>
          </div>

          <div className="px-5 md:px-6 py-4 border-t border-line bg-paper-2 flex items-center justify-between gap-3">
            <p className="text-[11.5px] text-ink-3">Demo settings, changes won&apos;t persist.</p>
            <button
              type="submit"
              disabled
              className="inline-flex items-center justify-center rounded-xl bg-navy px-5 py-2.5 text-[13.5px] font-semibold text-white shadow-sm shadow-navy/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save changes
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
