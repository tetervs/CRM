import { useCallback, useEffect, useState } from 'react'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import api from '../../api/index'
import { fmtDateTime } from '../../utils/fis'

const field = 'w-full px-3 py-2 text-sm rounded-md border border-surface-border bg-white focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-light disabled:bg-slate-50'
const STATUS_BTN = {
  Pass: 'bg-emerald-600 text-white border-emerald-600',
  Issue: 'bg-red-600 text-white border-red-600',
  'N/A': 'bg-slate-500 text-white border-slate-500',
}
const errMsg = (e, fallback) => e.response?.data?.message || fallback

// One checklist row. Pass/clear save at once; Issue and N/A open a note/reason box first.
function ItemRow({ item, editable, onSave }) {
  const [pending, setPending] = useState(null) // 'Issue' | 'N/A' while the text box is open
  const [text, setText] = useState('')
  const [err, setErr] = useState('')

  const choose = (status) => {
    setErr('')
    if (status === 'Pass' || status === 'unset') return onSave(item.key, { status }).catch((e) => setErr(errMsg(e, 'Save failed')))
    setPending(status)
    setText(status === 'Issue' ? item.note : item.reason)
  }
  const submit = async () => {
    try {
      await onSave(item.key, { status: pending, [pending === 'Issue' ? 'note' : 'reason']: text })
      setPending(null)
    } catch (e) { setErr(errMsg(e, 'Save failed')) }
  }
  const recheck = item.recheck && item.status === 'unset'

  return (
    <li className={`px-3 py-2.5 ${recheck ? 'bg-amber-50 border-l-4 border-amber-400' : ''}`}>
      <div className="flex items-start gap-3">
        <span className="w-12 shrink-0 text-xs font-semibold text-slate-500 pt-0.5">{item.code}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-800">{item.text}</p>
          {recheck && <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-amber-200 text-amber-900 text-xs font-medium">re-check</span>}
          {item.status === 'Issue' && !pending && <p className="mt-1 text-sm text-red-700">Issue: {item.note}</p>}
          {item.status === 'N/A' && !pending && <p className="mt-1 text-sm text-slate-500">N/A: {item.reason}</p>}
          {pending && (
            <div className="mt-2 flex gap-2">
              <input autoFocus value={text} onChange={(e) => setText(e.target.value)} className={field}
                placeholder={pending === 'Issue' ? 'What is wrong, and where? e.g. page 6, case 2' : 'Why does this not apply?'} />
              <Button size="sm" onClick={submit}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => setPending(null)}>Cancel</Button>
            </div>
          )}
          {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
        </div>
        <div className="flex shrink-0 gap-1">
          {['Pass', 'Issue', 'N/A'].map((s) => (
            <button key={s} disabled={!editable} onClick={() => choose(item.status === s ? 'unset' : s)}
              className={`px-2.5 py-1 text-xs rounded border font-medium disabled:cursor-default ${item.status === s ? STATUS_BTN[s] : 'bg-white text-slate-600 border-surface-border hover:bg-slate-50 disabled:hover:bg-white'} ${!editable && item.status !== s ? 'opacity-40' : ''}`}>
              {s}
            </button>
          ))}
        </div>
      </div>
    </li>
  )
}

// Groups consecutive items by section/group; per-subject items are grouped under a subject heading.
function groupItems(items) {
  const blocks = []
  for (const it of items) {
    const head = it.subject ? `Subject ${it.subjectLabel}` : it.sectionTitle
    const sub = it.group
    let b = blocks[blocks.length - 1]
    if (!b || b.head !== head) { b = { head, subject: it.subject, groups: [] }; blocks.push(b) }
    let g = b.groups[b.groups.length - 1]
    if (!g || g.name !== sub) { g = { name: sub, items: [] }; b.groups.push(g) }
    g.items.push(it)
  }
  return blocks
}

const issueListText = (caseRef, run) => {
  const lines = run.issueLog.filter((e) => e.open).map((e, i) =>
    `${i + 1}. ${e.code}${e.subjectLabel ? ` [${e.subjectLabel}]` : ''} - ${e.note} (raised ${e.raisedLabels.join(', ')})`)
  return `QC issues for ${caseRef}\n${lines.join('\n') || 'None open.'}`
}

export function FisQcPanel({ caseData, isAdmin, stages, onMoveStage }) {
  const id = caseData._id
  const [run, setRun] = useState(undefined) // undefined = loading, null = not started
  const [error, setError] = useState('')
  const [viewRound, setViewRound] = useState(null)
  const [modal, setModal] = useState(null) // 'sendback' | 'reopen' | 'nosubj' | 'passed'
  const [modalText, setModalText] = useState('')
  const [modalLabel, setModalLabel] = useState('Draft 2')
  const [modalErr, setModalErr] = useState('')
  const [newSubject, setNewSubject] = useState('')
  const [start, setStart] = useState({ underlyingType: '', cctv: false })
  const [copied, setCopied] = useState(false)
  const [scopeDraft, setScopeDraft] = useState({ kind: 'Full', text: '' })

  const load = useCallback(() =>
    api.get(`/fis/cases/${id}/qc`).then((r) => { setRun(r.data.run); setViewRound(null); if (r.data.run) setScopeDraft(r.data.run.scope) })
      .catch((e) => setError(errMsg(e, 'Failed to load QC'))), [id])
  useEffect(() => { load() }, [load])

  const call = async (method, url, body) => {
    setError('')
    const r = await api[method](`/fis/cases/${id}/qc${url}`, body)
    setRun(r.data.run)
    return r.data.run
  }
  const act = async (fn) => { try { await fn() } catch (e) { setError(errMsg(e, 'Action failed')) } }
  const saveItem = (key, body) => call('put', `/items/${encodeURIComponent(key)}`, body)

  if (error && run === undefined) return <p className="text-sm text-red-600">{error}</p>
  if (run === undefined) return <p className="text-sm text-slate-400">Loading…</p>

  const direct = caseData.caseType === 'QC (direct)'
  const underlyingOptions = ['CHDD/SMDD', 'VDD/TPDD', 'Corporate investigation', 'DDD', 'SRA/TVRA', 'SOPs', 'EP']

  if (run === null) {
    if (!isAdmin) return <p className="text-sm text-slate-500">QC has not been started for this case.</p>
    return (
      <div className="max-w-md space-y-3">
        <p className="text-sm text-slate-600">QC has not been started for this case.</p>
        {direct && (
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 uppercase tracking-wide">
            Report type being reviewed
            <select className={field} value={start.underlyingType} onChange={(e) => setStart({ ...start, underlyingType: e.target.value })}>
              <option value="">Select…</option>
              {underlyingOptions.map((t) => <option key={t}>{t}</option>)}
            </select>
          </label>
        )}
        {caseData.caseType === 'SRA/TVRA' && (
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={start.cctv} onChange={(e) => setStart({ ...start, cctv: e.target.checked })} />
            Includes CCTV blind spot analysis
          </label>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
        <Button onClick={() => act(() => call('post', '', { ...(direct && { underlyingType: start.underlyingType }), cctv: start.cctv }))}>Start QC</Button>
      </div>
    )
  }

  const rounds = run.rounds
  const shown = viewRound ? rounds.find((r) => r.n === viewRound) : rounds[rounds.length - 1]
  const isCurrent = shown.n === run.currentRound
  const editable = isAdmin && isCurrent && run.status !== 'passed'
  const sop = caseData.caseType === 'SOPs'
  const nextStage = stages[stages.indexOf(caseData.stage) + 1]

  const modalGo = async () => {
    setModalErr('')
    try {
      if (modal === 'sendback') await call('post', '/send-back', { label: sop ? modalLabel : undefined })
      if (modal === 'reopen') await call('post', '/reopen', { reason: modalText, label: sop ? modalLabel : undefined })
      if (modal === 'nosubj') await call('patch', '', { noSubjects: { ticked: true, reason: modalText } })
      setModal(null); setModalText('')
    } catch (e) { setModalErr(errMsg(e, 'Failed')) }
  }
  const pass = () => act(async () => { await call('post', '/pass'); setModal('passed') })

  return (
    <div className="space-y-5">
      {run.scope.kind === 'Partial' && (
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-300 text-sm text-amber-900">
          <p className="font-semibold">Partial QC — not a full review</p>
          {run.scope.text && <p className="mt-0.5">Scope: {run.scope.text}</p>}
        </div>
      )}
      {run.subjectRule && !run.subjects.length && !run.noSubjectsInScope?.ticked && (
        <div className="p-3 rounded-lg bg-orange-50 border border-orange-300 text-sm text-orange-900">No subjects added</div>
      )}
      {run.noSubjectsInScope?.ticked && (
        <div className="p-3 rounded-lg bg-slate-50 border border-surface-border text-sm text-slate-600">
          No individuals/companies in scope: {run.noSubjectsInScope.reason}
        </div>
      )}
      {run.status === 'passed' && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-300 text-sm text-emerald-900 flex items-center justify-between gap-3">
          <span>QC passed {fmtDateTime(run.passed?.at)}.</span>
          {isAdmin && <Button size="sm" variant="secondary" onClick={() => { setModalErr(''); setModalText(''); setModal('reopen') }}>Reopen</Button>}
        </div>
      )}

      <div>
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="font-medium text-slate-800">{shown.label}{!isCurrent && ' (read-only snapshot)'}</span>
          <span className="text-slate-500">
            {shown.items.filter((i) => i.status === 'Pass' || i.status === 'N/A').length} of {shown.items.length} done
            {run.progress.issues > 0 && isCurrent && <span className="ml-2 text-red-600">{run.progress.issues} issue{run.progress.issues > 1 ? 's' : ''}</span>}
          </span>
        </div>
        <progress className="w-full h-2 [&::-webkit-progress-bar]:bg-slate-200 [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-value]:bg-brand-primary [&::-webkit-progress-value]:rounded-full [&::-moz-progress-bar]:bg-brand-primary"
          value={shown.items.filter((i) => i.status === 'Pass' || i.status === 'N/A').length} max={Math.max(1, shown.items.length)} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {rounds.length > 1 && (
          <select className="px-3 py-1.5 text-sm rounded-md border border-surface-border bg-white" value={shown.n} onChange={(e) => setViewRound(Number(e.target.value))}>
            {rounds.map((r) => <option key={r.n} value={r.n}>{r.label}{r.n === run.currentRound ? ' (current)' : ''}</option>)}
          </select>
        )}
        {isAdmin && run.cctvApplicable && editable && (
          <label className="flex items-center gap-1.5 text-sm text-slate-700">
            <input type="checkbox" checked={run.cctv} onChange={(e) => act(() => call('patch', '', { cctv: e.target.checked }))} />
            Includes CCTV blind spot analysis
          </label>
        )}
        {isAdmin && editable && (
          <select className="px-3 py-1.5 text-sm rounded-md border border-surface-border bg-white" value={scopeDraft.kind}
            onChange={(e) => {
              const kind = e.target.value
              setScopeDraft({ kind, text: kind === 'Full' ? '' : scopeDraft.text })
              if (kind === 'Full') act(() => call('patch', '', { scope: { kind: 'Full', text: '' } }))
            }}>
            <option>Full</option><option>Partial</option>
          </select>
        )}
        {isAdmin && editable && scopeDraft.kind === 'Partial' && (
          <input value={scopeDraft.text} onChange={(e) => setScopeDraft({ kind: 'Partial', text: e.target.value })}
            placeholder="Scope, e.g. language only"
            onBlur={() => scopeDraft.text.trim() && act(() => call('patch', '', { scope: scopeDraft }))}
            className="px-3 py-1.5 text-sm rounded-md border border-surface-border w-64" />
        )}
        {isAdmin && editable && direct && (
          <select className="px-3 py-1.5 text-sm rounded-md border border-surface-border bg-white" value={run.underlyingType || ''}
            onChange={(e) => act(() => call('patch', '', { underlyingType: e.target.value }))}>
            {underlyingOptions.map((t) => <option key={t}>{t}</option>)}
          </select>
        )}
        <div className="flex-1" />
        {editable && (
          <>
            <Button variant="secondary" size="sm" onClick={() => { setModalErr(''); setModalLabel('Draft 2'); setModal('sendback') }}>Send back to author</Button>
            <Button size="sm" disabled={!run.canPass} onClick={pass}>Pass QC</Button>
          </>
        )}
      </div>
      {editable && !run.canPass && run.blockers.length > 0 && (
        <p className="text-xs text-slate-500">To pass: {run.blockers.join(' · ')}</p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {groupItems(shown.items).map((b) => (
        <div key={b.head}>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">{b.head}</h3>
            {b.subject && editable && (
              <button className="text-xs text-red-600" onClick={() => act(() => call('delete', `/subjects/${b.subject}`))}>Remove subject</button>
            )}
          </div>
          {b.groups.map((g) => (
            <div key={g.name} className="mt-2">
              <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">{g.name}</p>
              <ul className="bg-white border border-surface-border rounded-lg divide-y divide-surface-border">
                {g.items.map((it) => <ItemRow key={it.key} item={it} editable={editable} onSave={saveItem} />)}
              </ul>
            </div>
          ))}
        </div>
      ))}

      {isAdmin && editable && run.subjectRule && (
        <div className="p-3 border border-dashed border-surface-border rounded-lg space-y-2">
          <p className="text-sm font-medium text-slate-800">
            {run.subjectRule.label === 'Director / key person' ? 'Add director / key person' : 'Add individual/company screened'}
          </p>
          <div className="flex gap-2 max-w-md">
            <input value={newSubject} onChange={(e) => setNewSubject(e.target.value)} className={field} placeholder="Subject case code, e.g. D1" />
            <Button size="sm" onClick={() => act(async () => { await call('post', '/subjects', { label: newSubject }); setNewSubject('') })}>Add</Button>
          </div>
          <p className="text-xs text-slate-400">Use a case code, not the subject&apos;s full name.</p>
          {!run.subjects.length && !run.noSubjectsInScope?.ticked && (
            <button className="text-xs text-brand-primary" onClick={() => { setModalErr(''); setModalText(''); setModal('nosubj') }}>No individuals/companies in scope…</button>
          )}
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-slate-900">Issue log</h3>
          {run.issueLog.some((e) => e.open) && (
            <Button size="sm" variant="secondary"
              onClick={() => navigator.clipboard.writeText(issueListText(caseData.caseRef, run)).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) })}>
              {copied ? 'Copied' : 'Copy as list'}
            </Button>
          )}
        </div>
        <div className="overflow-x-auto bg-white border border-surface-border rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50"><tr>
              {['Code', 'Subject', 'Note', 'Raised', 'Resolved'].map((h) => <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-surface-border">
              {run.issueLog.map((e, i) => (
                <tr key={i} className={e.open ? '' : 'text-slate-400'}>
                  <td className="px-3 py-2 font-medium" title={e.text}>{e.code}</td>
                  <td className="px-3 py-2">{e.subjectLabel || '—'}</td>
                  <td className="px-3 py-2">{e.note}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{e.raisedLabels.join(', ')}{e.reraised > 0 && <span className="ml-1.5 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-xs">raised again</span>}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{e.open ? <span className="text-red-600">Open</span> : e.resolvedLabel}</td>
                </tr>
              ))}
              {!run.issueLog.length && <tr><td colSpan={5} className="px-3 py-4 text-center text-slate-400">No issues raised</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {run.reopens?.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-900 mb-1">Reopened</h3>
          <ul className="text-sm text-slate-600 space-y-0.5">
            {run.reopens.map((r, i) => <li key={i}>{fmtDateTime(r.at)}: {r.reason}</li>)}
          </ul>
        </div>
      )}

      <Modal isOpen={modal === 'sendback' || modal === 'reopen' || modal === 'nosubj'} onClose={() => setModal(null)}
        title={modal === 'sendback' ? 'Send back to author' : modal === 'reopen' ? 'Reopen QC' : 'No individuals/companies in scope'}>
        <div className="space-y-3">
          {modal === 'sendback' && <p className="text-sm text-slate-600">This closes the current round as a read-only snapshot. Issue items and G8, G9, G14 reset for re-check in the next round.</p>}
          {sop && (modal === 'sendback' || modal === 'reopen') && (
            <select className={field} value={modalLabel} onChange={(e) => setModalLabel(e.target.value)}>
              <option>Draft 1</option><option>Draft 2</option>
            </select>
          )}
          {(modal === 'reopen' || modal === 'nosubj') && (
            <input autoFocus className={field} value={modalText} onChange={(e) => setModalText(e.target.value)} placeholder="Reason (required)" />
          )}
          {modalErr && <p className="text-xs text-red-600">{modalErr}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setModal(null)}>Cancel</Button>
            <Button size="sm" onClick={modalGo}>Confirm</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={modal === 'passed'} onClose={() => setModal(null)} title="QC passed">
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            {nextStage ? <>Move this case from <strong>{caseData.stage}</strong> to <strong>{nextStage}</strong>?</> : 'This case has no later stage.'}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setModal(null)}>Not now</Button>
            {nextStage && <Button size="sm" onClick={async () => { await onMoveStage(nextStage); setModal(null) }}>Move to {nextStage}</Button>}
          </div>
        </div>
      </Modal>
    </div>
  )
}
