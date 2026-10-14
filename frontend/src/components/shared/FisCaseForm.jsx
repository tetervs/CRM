import { useState } from 'react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { toInputDate } from '../../utils/fis'

const selectClass = 'w-full px-3 py-2 text-sm rounded-md border border-surface-border bg-white focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-light'

function Field({ label, children, hint }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-slate-600 uppercase tracking-wide">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  )
}

const idOf = (u) => (u && typeof u === 'object' ? u._id : u) || ''

// mode: 'full' (create / fis_admin) | 'member' (only stage + remarks editable) | 'view' (read-only)
export function FisCaseForm({ initial, config, people, onSubmit, submitLabel, error, saving, mode = 'full' }) {
  const locked = (k) => mode === 'view' || (mode === 'member' && k !== 'stage' && k !== 'remarks')
  const [f, setF] = useState({
    caseRef: initial?.caseRef || '',
    caseType: initial?.caseType || config.caseTypes[0]?.code || '',
    caseLead: idOf(initial?.caseLead),
    support1: idOf(initial?.support1),
    support2: idOf(initial?.support2),
    assignedBy: idOf(initial?.assignedBy),
    dateAssigned: toInputDate(initial?.dateAssigned),
    deadline: toInputDate(initial?.deadline),
    stage: initial?.stage || '',
    remarks: initial?.remarks || '',
  })
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }))

  const type = config.caseTypes.find((t) => t.code === f.caseType)
  const stages = type?.stages || []
  // Keep an orphaned stage selectable (flagged) so editing other fields never silently reassigns it.
  const orphan = f.stage && !stages.includes(f.stage)
  const stage = f.stage || stages[0] || ''

  const changeType = (e) => {
    const t = config.caseTypes.find((x) => x.code === e.target.value)
    setF((p) => ({ ...p, caseType: e.target.value, stage: t?.stages.includes(p.stage) ? p.stage : t?.stages[0] || '' }))
  }

  const submit = (e) => {
    e.preventDefault()
    if (mode === 'member') return onSubmit({ stage, remarks: f.remarks })
    onSubmit({ ...f, stage, caseLead: f.caseLead || null, support1: f.support1 || null, support2: f.support2 || null,
      assignedBy: f.assignedBy || null, dateAssigned: f.dateAssigned || null, deadline: f.deadline || null })
  }

  const personSelect = (k) => (
    <select value={f[k]} onChange={set(k)} disabled={locked(k)} className={`${selectClass} disabled:bg-slate-50 disabled:text-slate-400`}>
      <option value="">—</option>
      {people.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
    </select>
  )

  return (
    <form onSubmit={submit} className="space-y-4">
      <Input label="Case ref" required value={f.caseRef} onChange={set('caseRef')} disabled={locked('caseRef')} />
      <p className="-mt-3 text-xs text-slate-400">Use a case code, not the subject&apos;s full name (DDD especially).</p>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Case type">
          <select value={f.caseType} onChange={changeType} disabled={locked('caseType')} className={`${selectClass} disabled:bg-slate-50 disabled:text-slate-400`}>
            {config.caseTypes.map((t) => <option key={t.code} value={t.code}>{t.code}</option>)}
          </select>
        </Field>
        <Field label="Stage" hint={orphan ? 'This stage no longer exists for the case type' : undefined}>
          <select value={stage} onChange={set('stage')} disabled={locked('stage')} className={`${selectClass} disabled:bg-slate-50 disabled:text-slate-400`}>
            {orphan && <option value={f.stage}>{f.stage} (removed)</option>}
            {stages.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Lead">{personSelect("caseLead")}</Field>
        <Field label="Assigned by">{personSelect("assignedBy")}</Field>
        <Field label="Support 1">{personSelect("support1")}</Field>
        <Field label="Support 2">{personSelect("support2")}</Field>
        <Input label="Date assigned" type="date" value={f.dateAssigned} onChange={set('dateAssigned')} disabled={locked('dateAssigned')} />
        <Input label="Deadline" type="date" value={f.deadline} onChange={set('deadline')} disabled={locked('deadline')} />
      </div>

      <Field label="Remarks">
        <textarea rows={3} value={f.remarks} onChange={set('remarks')} disabled={locked('remarks')} className={`${selectClass} disabled:bg-slate-50 disabled:text-slate-400`} />
      </Field>

      {error && <p className="text-xs text-status-lost">{error}</p>}
      {mode !== 'view' && (
        <div className="flex justify-end">
          <Button type="submit" loading={saving}>{submitLabel}</Button>
        </div>
      )}
    </form>
  )
}
