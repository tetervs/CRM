import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Card } from '../components/ui/Card'
import { FisCaseForm } from '../components/shared/FisCaseForm'
import { FisQcPanel } from '../components/shared/FisQcPanel'
import useFisStore from '../store/fisStore'
import api from '../api/index'
import useAuthStore from '../store/authStore'
import { fmtDateTime, DEADLINE_STYLE, isFisAdmin } from '../utils/fis'

const FIELD_LABEL = {
  created: 'Case created', caseRef: 'Case ref', caseType: 'Case type', caseLead: 'Lead', support1: 'Support 1',
  support2: 'Support 2', assignedBy: 'Assigned by', dateAssigned: 'Date assigned', deadline: 'Deadline',
  stage: 'Stage', remarks: 'Remarks',
}

export default function FisCaseDetail() {
  const { id } = useParams()
  const { config, people, loadRefs } = useFisStore()
  const { user } = useAuthStore()
  const [c, setC] = useState(null)
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [tab, setTab] = useState('details')

  const load = useCallback(
    () => api.get(`/fis/cases/${id}`).then((r) => setC(r.data)).catch((e) => setError(e.response?.status === 403 ? 'You are not on this case.' : 'Case not found')),
    [id],
  )
  useEffect(() => { loadRefs(); load() }, [loadRefs, load])

  const save = async (body) => {
    setSaving(true); setFormError(''); setSaved(false)
    try {
      await api.put(`/fis/cases/${id}`, body)
      await load()
      setSaved(true)
    } catch (e) {
      setFormError(e.response?.data?.message || 'Failed to save')
    } finally { setSaving(false) }
  }

  if (error) return <PageWrapper><p className="text-sm text-red-600">{error}</p><Link to="/fis" className="text-sm text-brand-primary">Back to cases</Link></PageWrapper>
  if (!c || !config) return <PageWrapper><p className="text-sm text-slate-400">Loading…</p></PageWrapper>

  return (
    <PageWrapper>
      <Link to="/fis" className="text-sm text-brand-primary">&larr; Cases</Link>
      <div className="flex flex-wrap items-center gap-3 mt-2 mb-5">
        <h1 className="text-xl font-bold text-slate-900">#{c.serialNo} · {c.caseRef}</h1>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${DEADLINE_STYLE[c.deadlineStatus]}`}>{c.deadlineStatus}</span>
        {c.phase && <span className="px-2 py-0.5 rounded-full text-xs bg-indigo-50 text-brand-primary">Phase: {c.phase}</span>}
        {c.step && <span className="text-sm text-slate-500">Step {c.step.n} of {c.step.of}</span>}
        <span className={`px-2 py-0.5 rounded text-xs ${c.stale ? 'bg-amber-200 text-amber-900 font-semibold' : 'text-slate-500'}`}>
          {c.daysSinceStage} days since stage change
        </span>
      </div>

      {c.stageMissing && (
        <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
          Stage &ldquo;{c.stage}&rdquo; no longer exists for {c.caseType}. It has not been changed — pick a current stage when ready.
        </div>
      )}

      {c.canEdit && (
        <div className="flex gap-1 mb-4 border-b border-surface-border">
          {[['details', 'Details'], ['qc', 'QC']].map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 ${tab === k ? 'border-brand-primary text-brand-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              {label}
            </button>
          ))}
        </div>
      )}

      {tab === 'qc' && c.canEdit && (
        <Card title="QC checklist">
          <FisQcPanel caseData={c} isAdmin={isFisAdmin(user)}
            stages={config.caseTypes.find((t) => t.code === c.caseType)?.stages || []}
            onMoveStage={async (stage) => { await api.put(`/fis/cases/${id}`, { stage }); await load() }} />
        </Card>
      )}

      <div className={`grid grid-cols-1 lg:grid-cols-3 gap-5 ${tab === 'qc' && c.canEdit ? 'hidden' : ''}`}>
        <Card title="Details" className="lg:col-span-2">
          <FisCaseForm key={c.updatedAt} initial={c} config={config} people={people} onSubmit={save} mode={!c.canEdit ? 'view' : isFisAdmin(user) ? 'full' : 'member'} submitLabel="Save changes" error={formError} saving={saving} />
          {!c.canEdit && <p className="mt-2 text-xs text-slate-500">View only &mdash; you created this case but are not lead or support on it.</p>}
          {c.canEdit && !isFisAdmin(user) && <p className="mt-2 text-xs text-slate-500">You can update stage and remarks. Other fields are changed by a FIS admin.</p>}
          {saved && <p className="mt-2 text-xs text-emerald-600">Saved.</p>}
        </Card>

        <Card title="History">
          <ol className="space-y-3">
            {c.history.map((h) => (
              <li key={h._id} className="border-l-2 border-brand-light pl-3">
                <p className="text-sm text-slate-800">
                  <span className="font-medium">{FIELD_LABEL[h.field] || h.field}</span>
                  {h.field === 'created' ? <>: {h.to}</> : <>: {h.from || '—'} &rarr; {h.to || '—'}</>}
                </p>
                <p className="text-xs text-slate-400">{h.by?.name || 'Unknown'} · {fmtDateTime(h.at)}</p>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </PageWrapper>
  )
}
