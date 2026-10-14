import { useEffect, useState } from 'react'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import useFisStore from '../store/fisStore'

const area = 'w-full px-3 py-2 text-sm rounded-md border border-surface-border bg-white focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-light'
const lines = (s) => s.split('\n').map((x) => x.trim()).filter(Boolean)

export default function FisSettings() {
  const { config, loadRefs, saveConfig } = useFisStore()
  const [due, setDue] = useState('')
  const [stale, setStale] = useState('')
  const [phases, setPhases] = useState('')
  const [types, setTypes] = useState([])
  const [map, setMap] = useState({})
  const [msg, setMsg] = useState({ ok: true, text: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadRefs(true) }, [loadRefs])
  useEffect(() => {
    if (!config) return
    setDue(String(config.dueSoonDays)); setStale(String(config.staleDays))
    setPhases(config.phases.join('\n'))
    setTypes(config.caseTypes.map((t) => ({ code: t.code, name: t.name, stages: t.stages.join('\n') })))
    setMap(Object.fromEntries(config.stagePhase.map((m) => [m.stage, m.phase])))
  }, [config])

  const phaseList = lines(phases)
  // Every stage that appears in any case type, plus anything already mapped.
  const allStages = [...new Set([...types.flatMap((t) => lines(t.stages)), ...Object.keys(map)])]
  const setType = (i, k, v) => setTypes((ts) => ts.map((t, j) => (j === i ? { ...t, [k]: v } : t)))

  const save = async () => {
    setSaving(true); setMsg({ ok: true, text: '' })
    try {
      await saveConfig({
        dueSoonDays: Number(due), staleDays: Number(stale), phases: phaseList,
        stagePhase: allStages.filter((s) => map[s] && phaseList.includes(map[s])).map((stage) => ({ stage, phase: map[stage] })),
        caseTypes: types.map((t) => ({ code: t.code, name: t.name, stages: lines(t.stages) })),
      })
      setMsg({ ok: true, text: 'Saved.' })
    } catch (e) {
      setMsg({ ok: false, text: e.response?.data?.message || 'Failed to save' })
    } finally { setSaving(false) }
  }

  if (!config) return <PageWrapper><p className="text-sm text-slate-400">Loading…</p></PageWrapper>

  return (
    <PageWrapper>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900">FIS settings</h1>
          <p className="text-sm text-slate-500 mt-0.5">Existing cases keep their stage if it is removed here; they are flagged instead.</p>
        </div>
        <div className="flex items-center gap-3">
          {msg.text && <span className={`text-sm ${msg.ok ? 'text-emerald-600' : 'text-red-600'}`}>{msg.text}</span>}
          <Button onClick={save} loading={saving}>Save settings</Button>
        </div>
      </div>

      <div className="space-y-6">
        <Card title="Thresholds">
          <div className="grid grid-cols-2 gap-4 max-w-md">
            <Input label="Due soon (days)" type="number" value={due} onChange={(e) => setDue(e.target.value)} />
            <Input label="Stale after (days)" type="number" value={stale} onChange={(e) => setStale(e.target.value)} />
          </div>
        </Card>

        <Card title="Phases (ordered, one per line)">
          <textarea rows={6} className={`${area} max-w-md`} value={phases} onChange={(e) => setPhases(e.target.value)} />
        </Card>

        <Card title="Case types and stages (ordered, one stage per line)">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {types.map((t, i) => (
              <div key={i} className="border border-surface-border rounded-lg p-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <Input label="Code" value={t.code} onChange={(e) => setType(i, 'code', e.target.value)} />
                  <Input label="Full name" value={t.name} onChange={(e) => setType(i, 'name', e.target.value)} />
                </div>
                <textarea rows={Math.max(4, lines(t.stages).length + 1)} className={area} value={t.stages} onChange={(e) => setType(i, 'stages', e.target.value)} />
                <button className="text-xs text-red-600" onClick={() => setTypes((ts) => ts.filter((_, j) => j !== i))}>Remove type</button>
              </div>
            ))}
          </div>
          <div className="mt-3">
            <Button variant="secondary" size="sm" onClick={() => setTypes((ts) => [...ts, { code: '', name: '', stages: 'Case intake\nClosed' }])}>+ Add case type</Button>
          </div>
        </Card>

        <Card title="Stage → phase map">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5">
            {allStages.map((s) => (
              <div key={s} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-700">{s}</span>
                <select
                  value={map[s] || ''} onChange={(e) => setMap((m) => ({ ...m, [s]: e.target.value }))}
                  className={`px-2 py-1 text-sm rounded-md border bg-white ${map[s] ? 'border-surface-border' : 'border-amber-400'}`}
                >
                  <option value="">Unmapped</option>
                  {phaseList.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </PageWrapper>
  )
}
