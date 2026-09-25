import { Settings as SettingsIcon } from "lucide-react"
import PageHeader from "@/components/dashboard/PageHeader"
import { formatDate } from "@/lib/utils"
import { getPlatformSettings, updatePlatformSettings } from "./actions"
import { Save } from "lucide-react"

export default async function AdminSettingsPage() {
  const settings = await getPlatformSettings()

  return (
    <div className="tp-fade-up">
      <PageHeader
        eyebrow="Settings"
        title="Platform settings"
        subtitle="Defaults that apply across every event and organizer."
        width="full"
      />

      <div className="px-5 md:px-8 py-8 md:py-10">
        <form
          action={async (formData: FormData) => {
            "use server"
            await updatePlatformSettings(formData)
          }}
          className="rounded-2xl border border-line bg-paper overflow-hidden max-w-2xl tp-fade-up-1"
        >
          <div className="px-5 md:px-6 py-4 border-b border-line flex items-center gap-2">
            <SettingsIcon size={14} className="text-ink-3" />
            <h2 className="text-[15px] font-semibold tracking-tight text-ink">General</h2>
          </div>

          <div className="p-5 md:p-6 space-y-5">
            <div>
              <label htmlFor="platformName" className="block text-[13px] font-semibold text-ink mb-1.5">
                Platform name
              </label>
              <input
                id="platformName"
                name="platformName"
                type="text"
                defaultValue={settings.platformName}
                required
                className="w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-[14px] text-ink focus:outline-none focus:border-line-2 focus:ring-4 focus:ring-brand-500/10"
              />
            </div>

            <div>
              <label htmlFor="supportEmail" className="block text-[13px] font-semibold text-ink mb-1.5">
                Support email
              </label>
              <input
                id="supportEmail"
                name="supportEmail"
                type="email"
                defaultValue={settings.supportEmail}
                required
                className="w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-[14px] text-ink focus:outline-none focus:border-line-2 focus:ring-4 focus:ring-brand-500/10"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="defaultCurrency" className="block text-[13px] font-semibold text-ink mb-1.5">
                  Default currency
                </label>
                <select
                  id="defaultCurrency"
                  name="defaultCurrency"
                  defaultValue={settings.defaultCurrency}
                  required
                  className="w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-[14px] text-ink focus:outline-none focus:border-line-2 focus:ring-4 focus:ring-brand-500/10"
                >
                  <option value="USD">USD</option>
                </select>
              </div>

              <div>
                <label htmlFor="platformFeePercent" className="block text-[13px] font-semibold text-ink mb-1.5">
                  Platform fee (%)
                </label>
                <input
                  id="platformFeePercent"
                  name="platformFeePercent"
                  type="number"
                  defaultValue={settings.platformFeePercent}
                  readOnly
                  aria-describedby="platformFeeHelp"
                  required
                  className="w-full cursor-not-allowed rounded-xl border border-line bg-paper-2 px-3.5 py-2.5 text-[14px] text-ink-2"
                />
                <p id="platformFeeHelp" className="mt-1.5 text-[11px] text-ink-3">Fixed system-wide at 6% per ticket sold.</p>
              </div>
            </div>

            <div className="flex items-start justify-between gap-4 rounded-xl bg-paper-2 ring-1 ring-line p-4">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold tracking-tight text-ink">Maintenance mode</p>
                <p className="text-[12px] text-ink-2 mt-0.5">
                  Temporarily block checkout while you investigate issues.
                </p>
              </div>
              <label className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full bg-paper ring-1 ring-line transition-colors has-[:checked]:bg-brand-600">
                <input
                  name="maintenanceMode"
                  type="checkbox"
                  value="on"
                  defaultChecked={settings.maintenanceMode}
                  className="peer sr-only"
                />
                <span className="inline-block h-4 w-4 translate-x-1 rounded-full bg-ink-3 shadow-sm transition-transform peer-checked:translate-x-6 peer-checked:bg-white" />
              </label>
            </div>
          </div>

          <div className="px-5 md:px-6 py-4 border-t border-line bg-paper-2 flex items-center justify-between gap-3">
            <p className="text-[12px] text-ink-3">
              Last updated {settings.updatedAt ? formatDate(settings.updatedAt) : "—"}
            </p>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-[14px] font-semibold text-white shadow-sm shadow-brand-600/20 hover:bg-brand-700 active:scale-[0.99] transition"
            >
              <Save size={14} /> Save changes
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
