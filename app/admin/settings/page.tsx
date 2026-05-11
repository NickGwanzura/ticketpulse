import {
  Settings as SettingsIcon,
  Shield,
  Bell,
  CreditCard,
  ToggleLeft,
  History,
} from "lucide-react"
import PageHeader from "@/components/dashboard/PageHeader"
import {
  applyApprovedProposals,
  approveProposal,
  exportImmutableAudit,
  getPendingProposals,
  getSettingsAudit,
  getSettingsBundle,
  getSettingsVersions,
  rejectProposal,
  rollbackSetting,
  saveSettings,
  type AuditFilter,
  type PlatformEnv,
} from "./actions"

function ToggleField({
  name,
  label,
  hint,
  checked,
}: {
  name: string
  label: string
  hint?: string
  checked: boolean
}) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-xl bg-paper-2 ring-1 ring-line p-4 cursor-pointer">
      <span className="min-w-0">
        <span className="text-[13px] font-semibold tracking-tight text-ink block">{label}</span>
        {hint ? <span className="text-[12px] text-ink-2 mt-0.5 block">{hint}</span> : null}
      </span>
      <input
        type="checkbox"
        name={name}
        defaultChecked={checked}
        className="mt-0.5 h-4 w-4 rounded border-line text-navy focus:ring-blue/30"
      />
    </label>
  )
}

function parseEnv(searchParams?: Record<string, string | string[] | undefined>): PlatformEnv {
  const env = typeof searchParams?.env === "string" ? searchParams.env : "prod"
  if (env === "dev" || env === "stage" || env === "prod") return env
  return "prod"
}

function buildAuditFilter(searchParams?: Record<string, string | string[] | undefined>): AuditFilter {
  const key = typeof searchParams?.key === "string" ? searchParams.key : "all"
  const action = typeof searchParams?.action === "string" ? searchParams.action : "all"
  const sourceAction = typeof searchParams?.sourceAction === "string" ? searchParams.sourceAction : "all"
  const page = typeof searchParams?.page === "string" ? Number(searchParams.page) : 1

  return {
    env: parseEnv(searchParams),
    key: (key as AuditFilter["key"]) ?? "all",
    action: (action as AuditFilter["action"]) ?? "all",
    sourceAction: (sourceAction as AuditFilter["sourceAction"]) ?? "all",
    page: Number.isFinite(page) && page > 0 ? page : 1,
    pageSize: 20,
  }
}

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const resolvedSearchParams = (await searchParams) ?? {}
  const env = parseEnv(resolvedSearchParams)
  const settings = await getSettingsBundle(env)
  const versions = await getSettingsVersions(env)
  const auditFilter = buildAuditFilter(resolvedSearchParams)
  const audit = await getSettingsAudit(auditFilter)
  const proposals = await getPendingProposals(env)
  const immutableAuditExport = await exportImmutableAudit(env)

  return (
    <div className="tp-fade-up">
      <PageHeader
        eyebrow="Settings"
        title="Platform settings"
        subtitle="Live controls for feature rollout, payments, notifications, and security."
        width="full"
      />

      <div className="px-5 md:px-8 py-8 md:py-10 space-y-6">
        <form action={saveSettings} className="space-y-6">
          <section className="rounded-2xl border border-line bg-paper overflow-hidden">
            <div className="px-5 md:px-6 py-4 border-b border-line">
              <h2 className="text-[15px] font-semibold tracking-tight text-ink">Environment scope</h2>
            </div>
            <div className="p-5 md:p-6 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <label htmlFor="env" className="block text-[12.5px] font-semibold text-ink mb-1.5">Environment</label>
                <select
                  id="env"
                  name="env"
                  defaultValue={env}
                  className="w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-[13.5px] text-ink"
                >
                  <option value="dev">dev</option>
                  <option value="stage">stage</option>
                  <option value="prod">prod</option>
                </select>
              </div>
              <ToggleField
                name="requires_approval"
                label="Require approval"
                hint="Non-super-admin changes will be proposed for approval."
                checked={false}
              />
              <div>
                <label htmlFor="apply_after" className="block text-[12.5px] font-semibold text-ink mb-1.5">Apply after (optional)</label>
                <input
                  id="apply_after"
                  name="apply_after"
                  type="datetime-local"
                  className="w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-[13.5px] text-ink"
                />
              </div>
            </div>
          </section>
          <input type="hidden" name="version_featureFlags" value={String(versions.featureFlags)} />
          <input type="hidden" name="version_paymentConfig" value={String(versions.paymentConfig)} />
          <input type="hidden" name="version_notificationRules" value={String(versions.notificationRules)} />
          <input type="hidden" name="version_securityConfig" value={String(versions.securityConfig)} />

          <section className="rounded-2xl border border-line bg-paper overflow-hidden">
            <div className="px-5 md:px-6 py-4 border-b border-line flex items-center gap-2">
              <ToggleLeft size={14} className="text-ink-3" />
              <h2 className="text-[15px] font-semibold tracking-tight text-ink">Feature flags</h2>
            </div>
            <div className="p-5 md:p-6 space-y-3">
              <ToggleField
                name="ff_checkoutV2"
                label="Checkout v2"
                hint="Enable next-generation checkout flow."
                checked={settings.featureFlags.checkoutV2}
              />
              <ToggleField
                name="ff_analyticsV2"
                label="Analytics v2"
                hint="Enable upgraded analytics views and aggregations."
                checked={settings.featureFlags.analyticsV2}
              />
              <ToggleField
                name="ff_organizerBetaTools"
                label="Organizer beta tools"
                hint="Expose beta tooling to organizers."
                checked={settings.featureFlags.organizerBetaTools}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-line bg-paper overflow-hidden">
            <div className="px-5 md:px-6 py-4 border-b border-line flex items-center gap-2">
              <CreditCard size={14} className="text-ink-3" />
              <h2 className="text-[15px] font-semibold tracking-tight text-ink">Payments</h2>
            </div>
            <div className="p-5 md:p-6 space-y-3">
              <ToggleField name="pay_ecoCashEnabled" label="Enable EcoCash" checked={settings.paymentConfig.ecoCashEnabled} />
              <ToggleField name="pay_cardEnabled" label="Enable Card" checked={settings.paymentConfig.cardEnabled} />
              <ToggleField name="pay_bankEnabled" label="Enable Bank" checked={settings.paymentConfig.bankEnabled} />
              <ToggleField name="pay_usdCashEnabled" label="Enable USD cash" checked={settings.paymentConfig.usdCashEnabled} />
              <div>
                <label htmlFor="pay_failoverOrder" className="block text-[12.5px] font-semibold text-ink mb-1.5">
                  Failover order (comma-separated)
                </label>
                <input
                  id="pay_failoverOrder"
                  name="pay_failoverOrder"
                  type="text"
                  defaultValue={settings.paymentConfig.failoverOrder.join(", ")}
                  className="w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-[13.5px] text-ink focus:outline-none focus:border-line-2 focus:ring-4 focus:ring-blue/10"
                />
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-line bg-paper overflow-hidden">
            <div className="px-5 md:px-6 py-4 border-b border-line flex items-center gap-2">
              <Bell size={14} className="text-ink-3" />
              <h2 className="text-[15px] font-semibold tracking-tight text-ink">Notification rules</h2>
            </div>
            <div className="p-5 md:p-6 space-y-3">
              <ToggleField name="nr_orderPaid" label="Order paid notifications" checked={settings.notificationRules.orderPaid} />
              <ToggleField name="nr_orderRefunded" label="Order refunded notifications" checked={settings.notificationRules.orderRefunded} />
              <ToggleField name="nr_payoutProcessed" label="Payout processed notifications" checked={settings.notificationRules.payoutProcessed} />
              <ToggleField name="nr_disputeOpened" label="Dispute opened notifications" checked={settings.notificationRules.disputeOpened} />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="nr_digestFrequency" className="block text-[12.5px] font-semibold text-ink mb-1.5">Digest frequency</label>
                  <select
                    id="nr_digestFrequency"
                    name="nr_digestFrequency"
                    defaultValue={settings.notificationRules.digestFrequency}
                    className="w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-[13.5px] text-ink focus:outline-none focus:border-line-2 focus:ring-4 focus:ring-blue/10"
                  >
                    <option value="hourly">Hourly</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="nr_adminAlertEmail" className="block text-[12.5px] font-semibold text-ink mb-1.5">Admin alert email</label>
                  <input
                    id="nr_adminAlertEmail"
                    name="nr_adminAlertEmail"
                    type="email"
                    defaultValue={settings.notificationRules.adminAlertEmail}
                    className="w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-[13.5px] text-ink focus:outline-none focus:border-line-2 focus:ring-4 focus:ring-blue/10"
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-line bg-paper overflow-hidden">
            <div className="px-5 md:px-6 py-4 border-b border-line flex items-center gap-2">
              <Shield size={14} className="text-ink-3" />
              <h2 className="text-[15px] font-semibold tracking-tight text-ink">Security & sessions</h2>
            </div>
            <div className="p-5 md:p-6 space-y-3">
              <ToggleField name="sec_enforceAdmin2FA" label="Enforce 2FA for admins" checked={settings.securityConfig.enforceAdmin2FA} />
              <ToggleField name="sec_enforceOrganizer2FA" label="Enforce 2FA for organizers" checked={settings.securityConfig.enforceOrganizer2FA} />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="sec_sessionMaxAgeHours" className="block text-[12.5px] font-semibold text-ink mb-1.5">
                    Session max age (hours)
                  </label>
                  <input
                    id="sec_sessionMaxAgeHours"
                    name="sec_sessionMaxAgeHours"
                    type="number"
                    min={1}
                    max={24 * 60}
                    defaultValue={settings.securityConfig.sessionMaxAgeHours}
                    className="w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-[13.5px] text-ink focus:outline-none focus:border-line-2 focus:ring-4 focus:ring-blue/10"
                  />
                </div>
                <div>
                  <label htmlFor="sec_maxConcurrentSessions" className="block text-[12.5px] font-semibold text-ink mb-1.5">
                    Max concurrent sessions
                  </label>
                  <input
                    id="sec_maxConcurrentSessions"
                    name="sec_maxConcurrentSessions"
                    type="number"
                    min={1}
                    max={100}
                    defaultValue={settings.securityConfig.maxConcurrentSessions}
                    className="w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-[13.5px] text-ink focus:outline-none focus:border-line-2 focus:ring-4 focus:ring-blue/10"
                  />
                </div>
                <div>
                  <label htmlFor="sec_passwordMinLength" className="block text-[12.5px] font-semibold text-ink mb-1.5">
                    Password min length
                  </label>
                  <input
                    id="sec_passwordMinLength"
                    name="sec_passwordMinLength"
                    type="number"
                    min={6}
                    max={64}
                    defaultValue={settings.securityConfig.passwordMinLength}
                    className="w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-[13.5px] text-ink focus:outline-none focus:border-line-2 focus:ring-4 focus:ring-blue/10"
                  />
                </div>
              </div>
            </div>
          </section>

          <div className="rounded-2xl border border-line bg-paper-2 px-5 md:px-6 py-4 space-y-3">
            <div className="flex items-center gap-2">
              <SettingsIcon size={14} className="text-ink-3" />
              <p className="text-[12px] text-ink-2">
                Changes persist and are logged in audit trail. Security/payment changes require a reason.
              </p>
            </div>
            <div>
              <label htmlFor="change_reason" className="block text-[12.5px] font-semibold text-ink mb-1.5">
                Change reason
              </label>
              <input
                id="change_reason"
                name="change_reason"
                type="text"
                placeholder="Why is this change needed?"
                className="w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-[13.5px] text-ink focus:outline-none focus:border-line-2 focus:ring-4 focus:ring-blue/10"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-xl bg-navy px-5 py-2.5 text-[13.5px] font-semibold text-white shadow-sm shadow-navy/20 hover:bg-navy-700 transition-colors"
              >
                Save changes
              </button>
            </div>
          </div>
        </form>

        <section className="rounded-2xl border border-line bg-paper overflow-hidden">
          <div className="px-5 md:px-6 py-4 border-b border-line flex items-center justify-between gap-3">
            <h2 className="text-[15px] font-semibold tracking-tight text-ink">Approvals inbox</h2>
            <form action={async () => {
              "use server"
              await applyApprovedProposals(env)
            }}>
              <button className="rounded-lg border border-line px-2.5 py-1.5 text-[12px] font-semibold">Apply approved now</button>
            </form>
          </div>
          {proposals.length > 0 ? (
            <ul className="divide-y divide-line">
              {proposals.map((proposal) => (
                <li key={proposal.id} className="px-5 md:px-6 py-3.5 flex flex-col gap-3">
                  <div>
                    <p className="text-[13px] font-semibold text-ink">{proposal.key} ({proposal.action})</p>
                    <p className="text-[12px] text-ink-3">
                      Requested by {proposal.requestedByEmail ?? "unknown"} • env={proposal.env}
                    </p>
                    <p className="text-[12px] text-ink-2 mt-0.5">Reason: {proposal.reason}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <form action={async () => {
                      "use server"
                      await approveProposal(proposal.id)
                    }}>
                      <button className="rounded-lg border border-line px-2.5 py-1.5 text-[12px] font-semibold hover:bg-paper-2">Approve</button>
                    </form>
                    <form action={async (formData) => {
                      "use server"
                      const rejectReason = String(formData.get("reject_reason") ?? "")
                      await rejectProposal(proposal.id, rejectReason)
                    }} className="flex items-center gap-2">
                      <input name="reject_reason" type="text" placeholder="Reject reason" className="rounded-lg border border-line bg-paper px-2 py-1 text-[12px]" />
                      <button className="rounded-lg border border-line px-2.5 py-1.5 text-[12px] font-semibold hover:bg-paper-2">Reject</button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-5 md:px-6 py-6 text-[12.5px] text-ink-3">No pending approvals for this environment.</div>
          )}
        </section>

        <section className="rounded-2xl border border-line bg-paper overflow-hidden">
          <div className="px-5 md:px-6 py-4 border-b border-line flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <History size={14} className="text-ink-3" />
              <h2 className="text-[15px] font-semibold tracking-tight text-ink">Settings audit trail</h2>
            </div>
            <form method="get" className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="env" value={env} />
              <select
                name="key"
                defaultValue={auditFilter.key ?? "all"}
                className="rounded-lg border border-line bg-paper px-2.5 py-1.5 text-[12px]"
              >
                <option value="all">All keys</option>
                <option value="featureFlags">featureFlags</option>
                <option value="paymentConfig">paymentConfig</option>
                <option value="notificationRules">notificationRules</option>
                <option value="securityConfig">securityConfig</option>
              </select>
              <select
                name="action"
                defaultValue={auditFilter.action ?? "all"}
                className="rounded-lg border border-line bg-paper px-2.5 py-1.5 text-[12px]"
              >
                <option value="all">All actions</option>
                <option value="create">create</option>
                <option value="update">update</option>
                <option value="rollback">rollback</option>
              </select>
              <select
                name="sourceAction"
                defaultValue={auditFilter.sourceAction ?? "all"}
                className="rounded-lg border border-line bg-paper px-2.5 py-1.5 text-[12px]"
              >
                <option value="all">All sources</option>
                <option value="save">save</option>
                <option value="rollback">rollback</option>
              </select>
              <button className="rounded-lg border border-line px-2.5 py-1.5 text-[12px] font-semibold">Apply</button>
            </form>
          </div>

          {audit.items.length > 0 ? (
            <>
              <ul className="divide-y divide-line">
                {audit.items.map((item) => (
                  <li key={item.id} className="px-5 md:px-6 py-3.5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-ink">{item.key}</p>
                      <p className="text-[12px] text-ink-3">
                        {item.action} / {item.sourceAction} by {item.actorEmail ?? "unknown"} ({item.actorRole ?? "n/a"})
                      </p>
                      {item.reason ? (
                        <p className="text-[12px] text-ink-2 mt-0.5">Reason: {item.reason}</p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-[12px] text-ink-2 whitespace-nowrap">
                        {item.createdAt.toLocaleString()}
                      </p>
                      <form
                        action={async (formData) => {
                          "use server"
                          const reason = String(formData.get("rollback_reason") ?? "").trim()
                          await rollbackSetting(String(formData.get("log_id") ?? ""), reason)
                        }}
                        className="flex items-center gap-2"
                      >
                        <input type="hidden" name="log_id" value={item.id} />
                        <input
                          type="text"
                          name="rollback_reason"
                          placeholder="Rollback reason"
                          className="rounded-lg border border-line bg-paper px-2 py-1 text-[12px]"
                        />
                        <button
                          type="submit"
                          className="rounded-lg border border-line px-2.5 py-1.5 text-[12px] font-semibold hover:bg-paper-2"
                        >
                          Rollback
                        </button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="px-5 md:px-6 py-3.5 border-t border-line flex items-center justify-between text-[12px] text-ink-2">
                <p>
                  Page {audit.page} of {audit.totalPages} • {audit.total} entries
                </p>
                <div className="flex items-center gap-2">
                  <a
                    href={`?env=${env}&key=${auditFilter.key ?? "all"}&action=${auditFilter.action ?? "all"}&sourceAction=${auditFilter.sourceAction ?? "all"}&page=${Math.max(1, audit.page - 1)}`}
                    className={`rounded-lg border border-line px-2.5 py-1.5 ${audit.page <= 1 ? "pointer-events-none opacity-50" : ""}`}
                  >
                    Previous
                  </a>
                  <a
                    href={`?env=${env}&key=${auditFilter.key ?? "all"}&action=${auditFilter.action ?? "all"}&sourceAction=${auditFilter.sourceAction ?? "all"}&page=${Math.min(audit.totalPages, audit.page + 1)}`}
                    className={`rounded-lg border border-line px-2.5 py-1.5 ${audit.page >= audit.totalPages ? "pointer-events-none opacity-50" : ""}`}
                  >
                    Next
                  </a>
                </div>
              </div>
            </>
          ) : (
            <div className="px-5 md:px-6 py-6 text-[12.5px] text-ink-3">
              No settings changes logged yet.
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-line bg-paper overflow-hidden">
          <div className="px-5 md:px-6 py-4 border-b border-line">
            <h2 className="text-[15px] font-semibold tracking-tight text-ink">Immutable audit export</h2>
          </div>
          <div className="p-5 md:p-6">
            <p className="text-[12px] text-ink-3 mb-2">Signed audit chain snapshot for env: {env}</p>
            <pre className="max-h-72 overflow-auto rounded-xl bg-paper-2 ring-1 ring-line p-3 text-[11px] text-ink-2 whitespace-pre-wrap">
              {immutableAuditExport}
            </pre>
          </div>
        </section>
      </div>
    </div>
  )
}
