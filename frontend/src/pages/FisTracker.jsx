import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { FisCaseForm } from '../components/shared/FisCaseForm'
import useAuthStore from '../store/authStore'
import useFisStore from '../store/fisStore'
import api from '../api/index'
import { fmtDate, DEADLINE_STYLE, ROW_STYLE, isFisAdmin } from '../utils/fis'

const selectClass = 'px-3 py-1.5 text-sm rounded-md border border-surface-border bg-white focus:outline-none focus:border-brand-primary'
const th = 'px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap'
const td = 'px-3 py-2 text-sm whitespace-nowrap'

export default function FisTracker() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const asOf = params.get('asOf')
  const { user } = useAuthStore()
  const { config, people, loadRefs } = useFisStore()
  const [cases, setCases] = useState([])
  const [error, setError] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [fType, setFType] = useState('')
  const [fPerson, setFPerson] = useState('')
  const [fDeadline, setFDeadline] = useState('')
  const [fStale, setFStale] = useState(false)
  const [fOpen, setFOpen] = useState('')

  const admin = isFisAdmin(user)

  const load = () =>
    api.get('/fis/cases', { params: asOf ? { asOf } : {} }).then((r) => setCases(r.data)).catch(() => setError('Failed to load cases'))

  useEffect(() => { loadRefs().catch(() => setError('Failed to load FIS config')); load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const shown = useMemo(() => cases.filter((c) => {
    const ids = [c.caseLead, c.support1, c.support2].map((u) => u?._id)
    return (!fType || c.caseType === fType)
      && (!fPerson || ids.includes(fPerson))
      && (!fDeadline || c.deadlineStatus === fDeadline)
      && (!fStale || c.stale)
      && (!fOpen || (fOpen === 'closed') === c.closed)
  }), [cases, fType, fPerson, fDeadline, fStale, fOpen])

  const create = async (body) => {
    setSaving(true); setFormError('')
    try {
      await api.post('/fis/cases', body)
      setShowNew(false)
      load()
    } catch (e) {
      setFormError(e.response?.data?.message || 'Failed to create case')
    } finally { setSaving(false) }
  }

  const name = (u) => u?.name || '—'

  return (
    <PageWrapper>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{admin ? 'All cases' : 'My cases'}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{shown.length} of {cases.length} shown</p>
        </div>
        <Button size="sm" onClick={() => { setFormError(''); setShowNew(true) }} disabled={!config}>+ New Case</Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <select className={selectClass} value={fType} onChange={(e) => setFType(e.target.value)}>
          <option value="">All types</option>
          {config?.caseTypes.map((t) => <option key={t.code} value={t.code}>{t.code}</option>)}
        </select>
        {admin && (
          <select className={selectClass} value={fPerson} onChange={(e) => setFPerson(e.target.value)}>
            <option value="">Everyone</option>
            {people.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
          </select>
        )}
        <select className={selectClass} value={fDeadline} onChange={(e) => setFDeadline(e.target.value)}>
          <option value="">Any deadline status</option>
          {Object.keys(DEADLINE_STYLE).map((s) => <option key={s}>{s}</option>)}
        </select>
        <select className={selectClass} value={fOpen} onChange={(e) => setFOpen(e.target.value)}>
          <option value="">Open + closed</option>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
        </select>
        <label className="flex items-center gap-1.5 text-sm text-slate-600">
          <input type="checkbox" checked={fStale} onChange={(e) => setFStale(e.target.checked)} />
          Stale only
        </label>
      </div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <div className="bg-white border border-surface-border rounded-xl shadow-sm overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-slate-50 border-b border-surface-border">
            <tr>
              {['Sl. No.', 'Case Ref', 'Case type', 'Lead', 'Support 1', 'Support 2', 'Assigned by', 'Date assigned', 'Deadline',
                'Stage', 'Phase', 'Step', 'Deadline status', 'Last updated', 'Days since update', 'Remarks'].map((h) => <th key={h} className={th}>{h}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {shown.map((c) => (
              <tr key={c._id} onClick={() => navigate(`/fis/cases/${c._id}`)} className={`cursor-pointer hover:brightness-95 ${ROW_STYLE(c)}`}>
                <td className={td}>{c.serialNo}</td>
                <td className={`${td} font-medium`}>
                  {!c.canEdit && (
                    <svg className="inline w-3.5 h-3.5 mr-1.5 -mt-0.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-label="View only">
                      <title>View only: you created this case but are not lead or support</title>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  )}
                  {c.caseRef}
                </td>
                <td className={td}>{c.caseType}</td>
                <td className={td}>{name(c.caseLead)}</td>
                <td className={td}>{name(c.support1)}</td>
                <td className={td}>{name(c.support2)}</td>
                <td className={td}>{name(c.assignedBy)}</td>
                <td className={td}>{fmtDate(c.dateAssigned)}</td>
                <td className={td}>{fmtDate(c.deadline)}</td>
                <td className={td}>
                  {c.stage}
                  {c.stageMissing && <span className="ml-1.5 px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-xs">stage removed</span>}
                </td>
                <td className={td}>{c.phase ? `Phase: ${c.phase}` : '—'}</td>
                <td className={td}>{c.step ? `${c.step.n} of ${c.step.of}` : '—'}</td>
                <td className={td}>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${DEADLINE_STYLE[c.deadlineStatus]}`}>{c.deadlineStatus}</span>
                </td>
                <td className={td}>{fmtDate(c.stageChangedAt)}</td>
                <td className={`${td} ${c.stale ? 'bg-amber-200 text-amber-900 font-semibold' : ''}`}>{c.daysSinceStage}</td>
                <td className={`${td} max-w-xs truncate`}>{c.remarks}</td>
              </tr>
            ))}
            {!shown.length && (
              <tr><td colSpan={16} className="px-3 py-8 text-center text-sm text-slate-400">No cases</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal isOpen={showNew} onClose={() => setShowNew(false)} title="New case">
        {config && <FisCaseForm config={config} people={people} onSubmit={create} submitLabel="Create case" error={formError} saving={saving} />}
      </Modal>
    </PageWrapper>
  )
}
