import { useCallback, useEffect, useState } from 'react'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import useFisStore from '../store/fisStore'
import api from '../api/index'

const field = 'w-full px-3 py-2 text-sm rounded-md border border-surface-border bg-white focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-light'
const errMsg = (e) => e.response?.data?.message || 'Request failed'

function ItemLine({ item, onEdit, onRemove }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(item.text)
  return (
    <li className="flex items-start gap-3 px-3 py-2">
      <span className="w-12 shrink-0 text-xs font-semibold text-slate-500 pt-0.5">{item.code}</span>
      {editing ? (
        <div className="flex-1 flex gap-2">
          <input className={field} value={text} onChange={(e) => setText(e.target.value)} />
          <Button size="sm" onClick={async () => { if (await onEdit(item.code, text)) setEditing(false) }}>Save</Button>
          <Button size="sm" variant="ghost" onClick={() => { setText(item.text); setEditing(false) }}>Cancel</Button>
        </div>
      ) : (
        <>
          <p className="flex-1 text-sm text-slate-800">{item.text}</p>
          <button className="text-xs text-brand-primary" onClick={() => setEditing(true)}>Edit</button>
          <button className="text-xs text-red-600" onClick={() => onRemove(item.code)}>Remove</button>
        </>
      )}
    </li>
  )
}

function AddItem({ section, onAdd }) {
  const [group, setGroup] = useState(section.groups[0]?.name || '')
  const [text, setText] = useState('')
  return (
    <div className="mt-3 flex flex-wrap gap-2 items-center">
      <input className={`${field} max-w-xs`} list={`groups-${section.code}`} value={group} onChange={(e) => setGroup(e.target.value)} placeholder="Group (pick or type new)" />
      <datalist id={`groups-${section.code}`}>{section.groups.map((g) => <option key={g.name} value={g.name} />)}</datalist>
      <input className={`${field} flex-1 min-w-64`} value={text} onChange={(e) => setText(e.target.value)} placeholder="New check text" />
      <Button size="sm" onClick={async () => { if (await onAdd({ section: section.code, group, text })) setText('') }}>Add check</Button>
    </div>
  )
}

export default function FisQcSettings() {
  const { config, loadRefs } = useFisStore()
  const [t, setT] = useState(null)
  const [msg, setMsg] = useState({ ok: true, text: '' })
  const [newSec, setNewSec] = useState({ code: '', title: '' })

  const load = useCallback(() => api.get('/fis/qc-template').then((r) => setT(r.data)).catch((e) => setMsg({ ok: false, text: errMsg(e) })), [])
  useEffect(() => { loadRefs(); load() }, [loadRefs, load])

  // Every edit creates a new template version. Existing QC runs keep the version they started on.
  const run = async (fn, okText) => {
    try { const r = await fn(); setT(r.data); setMsg({ ok: true, text: `${okText}. Now version ${r.data.version}.` }); return true }
    catch (e) { setMsg({ ok: false, text: errMsg(e) }); return false }
  }

  if (!t || !config) return <PageWrapper><p className="text-sm text-slate-400">{msg.text || 'Loading…'}</p></PageWrapper>
  const map = t.rules.byCaseType || {}
  const toggleMap = (type, code) => {
    const cur = map[type] || []
    const next = cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code]
    return run(() => api.put('/fis/qc-template/case-types', { byCaseType: { ...map, [type]: next } }), 'Mapping saved')
  }

  return (
    <PageWrapper>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900">QC checklist</h1>
          <p className="text-sm text-slate-500 mt-0.5">Template version {t.version}. Each change creates a new version; existing QC runs keep theirs.</p>
        </div>
        {msg.text && <span className={`text-sm ${msg.ok ? 'text-emerald-600' : 'text-red-600'}`}>{msg.text}</span>}
      </div>

      <div className="space-y-6">
        <Card title="Which sections apply to each case type">
          <p className="text-xs text-slate-400 mb-3">Section {(t.rules.always || []).join(', ')} always applies. Per-subject ranges and the re-check list are fixed.</p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead><tr>
                <th className="px-3 py-1 text-left text-xs text-slate-500 uppercase">Case type</th>
                {t.sections.map((s) => <th key={s.code} className="px-3 py-1 text-xs text-slate-500 uppercase" title={s.title}>{s.code}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-surface-border">
                {Object.keys(map).map((type) => (
                  <tr key={type}>
                    <td className="px-3 py-1.5">{type}</td>
                    {t.sections.map((s) => (
                      <td key={s.code} className="px-3 py-1.5 text-center">
                        <input type="checkbox" checked={(map[type] || []).includes(s.code)} onChange={() => toggleMap(type, s.code)} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {t.sections.map((s) => (
          <Card key={s.code} title={`${s.code}: ${s.title}`}>
            {s.groups.map((g) => (
              <div key={g.name} className="mb-3">
                <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">{g.name}</p>
                <ul className="border border-surface-border rounded-lg divide-y divide-surface-border">
                  {g.items.map((it) => (
                    <ItemLine key={it.code} item={it}
                      onEdit={(code, text) => run(() => api.patch(`/fis/qc-template/items/${code}`, { text }), `${code} updated`)}
                      onRemove={(code) => run(() => api.delete(`/fis/qc-template/items/${code}`), `${code} removed`)} />
                  ))}
                </ul>
              </div>
            ))}
            {!s.groups.length && <p className="text-sm text-slate-400">No checks yet.</p>}
            <AddItem section={s} onAdd={(b) => run(() => api.post('/fis/qc-template/items', b), 'Check added')} />
          </Card>
        ))}

        <Card title="Add a section (e.g. EP)">
          <div className="flex flex-wrap gap-2 max-w-2xl">
            <input className={`${field} w-24`} value={newSec.code} onChange={(e) => setNewSec({ ...newSec, code: e.target.value })} placeholder="Code" />
            <input className={`${field} flex-1`} value={newSec.title} onChange={(e) => setNewSec({ ...newSec, title: e.target.value })} placeholder="Title" />
            <Button size="sm" onClick={async () => { if (await run(() => api.post('/fis/qc-template/sections', newSec), 'Section added')) setNewSec({ code: '', title: '' }) }}>Add section</Button>
          </div>
        </Card>
      </div>
    </PageWrapper>
  )
}
