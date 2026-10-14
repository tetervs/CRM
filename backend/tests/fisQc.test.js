const path = require('path')
const { spawnSync } = require('child_process')
const jwt = require('jsonwebtoken')
const mongoose = require('mongoose')
const request = require('supertest')
const { MongoMemoryServer } = require('mongodb-memory-server')

jest.setTimeout(240000)

const ROOT = path.join(__dirname, '..')
let mem, app, User, FisCase, FisQcRun, FisQcTemplate
const tok = {}
const ids = {}
const auth = (l) => ({ Authorization: `Bearer ${tok[l]}` })
const runScript = (script, uri) =>
  spawnSync('node', [path.join(ROOT, 'scripts', script)], { env: { ...process.env, MONGO_URI: uri, NODE_ENV: 'development' }, encoding: 'utf8' })

const api = (method, url, who, body) => request(app)[method](url).set(auth(who)).send(body || {})

// Creates a case as praveen (fis_admin); mahak is lead, shreya support 1.
async function makeCase(caseType, extra = {}) {
  const res = await api('post', '/api/fis/cases', 'praveen',
    { caseRef: `T-${Math.random().toString(36).slice(2, 7)}`, caseType, caseLead: String(ids.mahak), support1: String(ids.shreya), ...extra })
  expect(res.status).toBe(201)
  return res.body._id
}
const startQc = (id, body, who = 'brishti') => api('post', `/api/fis/cases/${id}/qc`, who, body)
const getRun = async (id, who = 'brishti') => (await api('get', `/api/fis/cases/${id}/qc`, who)).body.run
const cur = (run) => run.rounds[run.rounds.length - 1]
const setItem = (id, key, body, who = 'brishti') => api('put', `/api/fis/cases/${id}/qc/items/${encodeURIComponent(key)}`, who, body)

async function passAll(id) {
  const run = await getRun(id)
  for (const i of cur(run).items) {
    if (i.status === 'Pass' || i.status === 'N/A') continue
    const r = await setItem(id, i.key, { status: 'Pass' })
    expect(r.status).toBe(200)
  }
}

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret'
  process.env.NODE_ENV = 'development'
  mem = await MongoMemoryServer.create()
  const uri = mem.getUri('salespilot_dev')
  process.env.MONGO_URI = uri
  await mongoose.connect(uri)
  app = require('../server')
  User = require('../models/User')
  FisCase = require('../models/FisCase')
  FisQcRun = require('../models/FisQcRun')
  FisQcTemplate = require('../models/FisQcTemplate')

  expect(runScript('seedFis.js', uri).status).toBe(0)
  const q1 = runScript('seedFisQc.js', uri)
  expect(q1.status).toBe(0)
  const q2 = runScript('seedFisQc.js', uri)
  expect(q2.stdout).toContain('nothing to do') // idempotent
  expect(await FisQcTemplate.countDocuments()).toBe(1)

  for (const role of ['head', 'ca', 'admin', 'manager', 'sales', 'employee']) {
    const u = await User.create({ name: role, email: `${role}@x.com`, password: 'pw', role })
    ids[role] = u._id
    tok[role] = jwt.sign({ id: u._id }, process.env.JWT_SECRET)
  }
  const bgv = await User.create({ name: 'bgv', email: 'bgv@x.com', password: 'pw', role: 'sales' })
  ids.bgv = bgv._id
  tok.bgv = jwt.sign({ id: bgv._id }, process.env.JWT_SECRET)
  for (const n of ['praveen', 'niharika', 'brishti', 'mahak', 'shreya', 'yogesh']) {
    const u = await User.findOne({ email: `${n}@fis-dev.example.com` })
    ids[n] = u._id
    tok[n] = jwt.sign({ id: u._id }, process.env.JWT_SECRET)
  }
})

afterAll(async () => {
  await mongoose.disconnect()
  await mem.stop()
})

describe('item counts', () => {
  test.each([
    ['CHDD/SMDD', 50], ['DDD', 45], ['EP', 32], ['SOPs', 44],
  ])('%s = %i', async (type, n) => {
    const id = await makeCase(type)
    const res = await startQc(id)
    expect(res.status).toBe(201)
    expect(cur(res.body.run).items).toHaveLength(n)
  })

  test('VDD/TPDD with 2 subjects = 32 + 12 + 20 = 64', async () => {
    const id = await makeCase('VDD/TPDD')
    expect(cur((await startQc(id)).body.run).items).toHaveLength(44)
    await api('post', `/api/fis/cases/${id}/qc/subjects`, 'brishti', { label: 'D1' })
    const res = await api('post', `/api/fis/cases/${id}/qc/subjects`, 'brishti', { label: 'D2' })
    expect(cur(res.body.run).items).toHaveLength(64)
    expect(cur(res.body.run).items.filter((i) => i.subject).every((i) => /^CH(4|5|6|7|8|9|10|11|12|13)$/.test(i.code))).toBe(true)
  })

  test('Corporate investigation with 1 subject = 32 + 12 + 17 = 61', async () => {
    const id = await makeCase('Corporate investigation')
    expect(cur((await startQc(id)).body.run).items).toHaveLength(44)
    const res = await api('post', `/api/fis/cases/${id}/qc/subjects`, 'brishti', { label: 'S1' })
    expect(cur(res.body.run).items).toHaveLength(61)
  })

  test('SRA/TVRA = 43 with CCTV off, 48 with it on', async () => {
    const id = await makeCase('SRA/TVRA')
    const run = (await startQc(id)).body.run
    expect(cur(run).items).toHaveLength(43)
    expect(run.cctvApplicable).toBe(true)
    const on = await api('patch', `/api/fis/cases/${id}/qc`, 'brishti', { cctv: true })
    expect(cur(on.body.run).items).toHaveLength(48)
    const off = await api('patch', `/api/fis/cases/${id}/qc`, 'brishti', { cctv: false })
    expect(cur(off.body.run).items).toHaveLength(43)
  })

  test('turning CCTV off is blocked while a CCTV item already has a status', async () => {
    const id = await makeCase('SRA/TVRA')
    await startQc(id, { cctv: true })
    await setItem(id, 'SR12', { status: 'Pass' })
    expect((await api('patch', `/api/fis/cases/${id}/qc`, 'brishti', { cctv: false })).status).toBe(400)
  })

  test('QC (direct): needs an underlying type; G + DQ + that section', async () => {
    const id = await makeCase('QC (direct)')
    expect((await startQc(id)).status).toBe(400)
    const res = await startQc(id, { underlyingType: 'SOPs', scope: { kind: 'Partial', text: 'language only' } })
    expect(res.status).toBe(201)
    expect(cur(res.body.run).items).toHaveLength(32 + 2 + 12)
    expect(res.body.run.scope).toMatchObject({ kind: 'Partial', text: 'language only' })
  })

  test('Partial scope needs a description', async () => {
    const id = await makeCase('EP')
    await startQc(id)
    expect((await api('patch', `/api/fis/cases/${id}/qc`, 'brishti', { scope: { kind: 'Partial', text: '' } })).status).toBe(400)
    expect((await api('patch', `/api/fis/cases/${id}/qc`, 'brishti', { scope: { kind: 'Partial', text: 'grammar' } })).status).toBe(200)
  })
})

describe('item validation', () => {
  let id
  beforeAll(async () => { id = await makeCase('EP'); await startQc(id) })

  test('Issue without a note -> 400 (also blank note)', async () => {
    expect((await setItem(id, 'G1', { status: 'Issue' })).status).toBe(400)
    expect((await setItem(id, 'G1', { status: 'Issue', note: '   ' })).status).toBe(400)
  })
  test('N/A without a reason -> 400', async () => {
    expect((await setItem(id, 'G1', { status: 'N/A' })).status).toBe(400)
  })
  test('valid Issue / N/A / Pass / unset', async () => {
    expect((await setItem(id, 'G1', { status: 'Issue', note: 'page 6, case 2' })).status).toBe(200)
    expect((await setItem(id, 'G2', { status: 'N/A', reason: 'no personal matters' })).status).toBe(200)
    expect((await setItem(id, 'G3', { status: 'Pass' })).status).toBe(200)
    const r = await setItem(id, 'G1', { status: 'unset' })
    expect(cur(r.body.run).items.find((i) => i.key === 'G1')).toMatchObject({ status: 'unset', note: '' })
  })
  test('bad status / unknown key', async () => {
    expect((await setItem(id, 'G4', { status: 'Maybe' })).status).toBe(400)
    expect((await setItem(id, 'ZZ99', { status: 'Pass' })).status).toBe(404)
  })
})

describe('rounds', () => {
  test('send back: Issue items and G8/G9/G14 reset with re-check, everything else kept', async () => {
    const id = await makeCase('CHDD/SMDD')
    await startQc(id)
    for (const k of ['G1', 'G8', 'G9', 'G14', 'CH1']) await setItem(id, k, { status: 'Pass' })
    await setItem(id, 'G2', { status: 'Issue', note: 'page 6' })
    await setItem(id, 'G3', { status: 'N/A', reason: 'out of scope' })

    const res = await api('post', `/api/fis/cases/${id}/qc/send-back`, 'brishti')
    expect(res.status).toBe(200)
    const run = res.body.run
    expect(run.rounds).toHaveLength(2)
    expect(run.rounds[0]).toMatchObject({ state: 'closed', closedFor: 'sent_back' })
    expect(run.rounds[0].items.find((i) => i.key === 'G2')).toMatchObject({ status: 'Issue', note: 'page 6' }) // snapshot intact
    expect(run.rounds[0].items.find((i) => i.key === 'G8').status).toBe('Pass')

    const r2 = Object.fromEntries(cur(run).items.map((i) => [i.key, i]))
    for (const k of ['G2', 'G8', 'G9', 'G14']) expect(r2[k]).toMatchObject({ status: 'unset', recheck: true })
    expect(r2.G1).toMatchObject({ status: 'Pass', recheck: false })
    expect(r2.CH1).toMatchObject({ status: 'Pass', recheck: false })
    expect(r2.G3).toMatchObject({ status: 'N/A', reason: 'out of scope', recheck: false })
    expect(r2.G4).toMatchObject({ status: 'unset', recheck: false })
    expect(run.qcStatus).toBe('Round 2')

    // marking a re-check item clears its highlight
    const after = await setItem(id, 'G8', { status: 'Pass' })
    expect(cur(after.body.run).items.find((i) => i.key === 'G8').recheck).toBe(false)
  })

  test('SOPs rounds are labelled by draft, reviewer picks', async () => {
    const id = await makeCase('SOPs')
    expect((await startQc(id)).body.run.rounds[0].label).toBe('Draft 1')
    expect((await api('post', `/api/fis/cases/${id}/qc/send-back`, 'brishti', { label: 'Round 2' })).status).toBe(400)
    const res = await api('post', `/api/fis/cases/${id}/qc/send-back`, 'brishti', { label: 'Draft 2' })
    expect(res.body.run.rounds.map((r) => r.label)).toEqual(['Draft 1', 'Draft 2'])
  })

  test('issue log: raised/resolved rounds, open flag', async () => {
    const id = await makeCase('EP')
    await startQc(id)
    await setItem(id, 'G12', { status: 'Issue', note: 'page 6, case 2' })
    await setItem(id, 'G13', { status: 'Issue', note: 'screenshot missing' })
    await api('post', `/api/fis/cases/${id}/qc/send-back`, 'brishti')
    await setItem(id, 'G12', { status: 'Pass' })
    const log = (await getRun(id)).issueLog
    const g12 = log.find((e) => e.code === 'G12')
    const g13 = log.find((e) => e.code === 'G13')
    expect(g12).toMatchObject({ note: 'page 6, case 2', raisedRound: 1, resolvedRound: 2, open: false })
    expect(g13).toMatchObject({ raisedRound: 1, resolvedRound: null, open: true })
  })

  test('subjects: duplicate rejected; removal blocked once checked, allowed while unset', async () => {
    const id = await makeCase('VDD/TPDD')
    await startQc(id)
    const a = await api('post', `/api/fis/cases/${id}/qc/subjects`, 'brishti', { label: 'D1' })
    const sid = a.body.run.subjects[0].id
    expect((await api('post', `/api/fis/cases/${id}/qc/subjects`, 'brishti', { label: 'd1' })).status).toBe(409)
    expect((await api('post', `/api/fis/cases/${id}/qc/subjects`, 'brishti', { label: '' })).status).toBe(400)
    await setItem(id, `CH5@${sid}`, { status: 'Pass' })
    expect((await api('delete', `/api/fis/cases/${id}/qc/subjects/${sid}`, 'brishti')).status).toBe(400)
    await setItem(id, `CH5@${sid}`, { status: 'unset' })
    const del = await api('delete', `/api/fis/cases/${id}/qc/subjects/${sid}`, 'brishti')
    expect(del.status).toBe(200)
    expect(cur(del.body.run).items).toHaveLength(44)
  })
})

describe('sign-off, reopen', () => {
  test('blocked with an open Issue or unchecked items, allowed when all Pass / N/A', async () => {
    const id = await makeCase('EP')
    await startQc(id)
    expect((await api('post', `/api/fis/cases/${id}/qc/pass`, 'brishti')).status).toBe(400) // nothing checked
    await passAll(id)
    await setItem(id, 'G5', { status: 'Issue', note: 'PAN format differs' })
    const blocked = await api('post', `/api/fis/cases/${id}/qc/pass`, 'brishti')
    expect(blocked.status).toBe(400)
    expect(blocked.body.message).toMatch(/open Issue/)
    expect((await getRun(id)).canPass).toBe(false)

    await setItem(id, 'G5', { status: 'N/A', reason: 'no PAN in this case' })
    expect((await getRun(id)).canPass).toBe(true)
    const ok = await api('post', `/api/fis/cases/${id}/qc/pass`, 'brishti')
    expect(ok.status).toBe(200)
    expect(ok.body.run).toMatchObject({ status: 'passed', qcStatus: 'Passed' })
    expect(String(ok.body.run.passed.by)).toBe(String(ids.brishti))
    expect(ok.body.run.passed.at).toBeTruthy()
    // passed = read-only
    expect((await setItem(id, 'G1', { status: 'Pass' })).status).toBe(409)
  })

  test('reopen: reason required, only when passed, carries everything forward, clears Passed, is logged', async () => {
    const id = await makeCase('EP')
    await startQc(id)
    expect((await api('post', `/api/fis/cases/${id}/qc/reopen`, 'brishti', { reason: 'x' })).status).toBe(409) // not passed
    await passAll(id)
    await api('post', `/api/fis/cases/${id}/qc/pass`, 'brishti')

    expect((await api('post', `/api/fis/cases/${id}/qc/reopen`, 'brishti', {})).status).toBe(400)
    const res = await api('post', `/api/fis/cases/${id}/qc/reopen`, 'brishti', { reason: 'client sent a revised report' })
    expect(res.status).toBe(200)
    const run = res.body.run
    expect(run.status).toBe('inProgress')
    expect(run.passed?.at).toBeUndefined()
    expect(run.qcStatus).toBe('Round 2')
    expect(run.rounds[0]).toMatchObject({ state: 'closed', closedFor: 'passed' })
    expect(cur(run).items.every((i) => i.status === 'Pass' && !i.recheck)).toBe(true) // everything carried, no resets
    expect(cur(run).items).toHaveLength(32)
    expect(run.reopens).toHaveLength(1)
    expect(run.reopens[0]).toMatchObject({ reason: 'client sent a revised report', fromRound: 1 })
    expect(String(run.reopens[0].by)).toBe(String(ids.brishti))
    expect(run.reopens[0].at).toBeTruthy()
    expect((await setItem(id, 'G1', { status: 'Issue', note: 'n' })).status).toBe(200) // editable again
  })

  test.each(['VDD/TPDD', 'Corporate investigation'])('%s with no subjects: Pass blocked unless "no subjects in scope" ticked with a reason', async (type) => {
    const id = await makeCase(type)
    await startQc(id)
    await passAll(id)
    const run = await getRun(id)
    expect(run.subjectRule).toBeTruthy()
    const blocked = await api('post', `/api/fis/cases/${id}/qc/pass`, 'brishti')
    expect(blocked.status).toBe(400)
    expect(blocked.body.message).toMatch(/No subjects added/)

    expect((await api('patch', `/api/fis/cases/${id}/qc`, 'brishti', { noSubjects: { ticked: true } })).status).toBe(400)
    expect((await api('patch', `/api/fis/cases/${id}/qc`, 'brishti', { noSubjects: { ticked: true, reason: '  ' } })).status).toBe(400)
    const tick = await api('patch', `/api/fis/cases/${id}/qc`, 'brishti', { noSubjects: { ticked: true, reason: 'entity-only engagement' } })
    expect(tick.status).toBe(200)
    expect(tick.body.run.noSubjectsInScope).toMatchObject({ ticked: true, reason: 'entity-only engagement' })
    expect(String(tick.body.run.noSubjectsInScope.by)).toBe(String(ids.brishti))
    expect((await api('post', `/api/fis/cases/${id}/qc/pass`, 'brishti')).status).toBe(200)
  })

  test('VDD with subjects all Pass passes without the tick', async () => {
    const id = await makeCase('VDD/TPDD')
    await startQc(id)
    await api('post', `/api/fis/cases/${id}/qc/subjects`, 'brishti', { label: 'D1' })
    await passAll(id)
    expect((await api('post', `/api/fis/cases/${id}/qc/pass`, 'brishti')).status).toBe(200)
  })

  test('tracker list shows qcStatus: Not started / In progress / Round N / Passed', async () => {
    const a = await makeCase('EP', { caseRef: 'QS-a' })
    const b = await makeCase('EP', { caseRef: 'QS-b' })
    const c = await makeCase('EP', { caseRef: 'QS-c' })
    const d = await makeCase('EP', { caseRef: 'QS-d' })
    await startQc(b)
    await startQc(c); await api('post', `/api/fis/cases/${c}/qc/send-back`, 'brishti')
    await startQc(d); await passAll(d); await api('post', `/api/fis/cases/${d}/qc/pass`, 'brishti')
    const list = (await api('get', '/api/fis/cases', 'brishti')).body
    const st = (ref) => list.find((x) => x.caseRef === ref).qcStatus
    expect([st('QS-a'), st('QS-b'), st('QS-c'), st('QS-d')]).toEqual(['Not started', 'In progress', 'Round 2', 'Passed'])
    // a member on the case sees it too
    const mine = (await api('get', '/api/fis/cases', 'mahak')).body
    expect(mine.find((x) => x.caseRef === 'QS-d').qcStatus).toBe('Passed')
  })
})

describe('access', () => {
  let id
  const QC_ROUTES = (cid) => [
    ['get', `/api/fis/cases/${cid}/qc`], ['post', `/api/fis/cases/${cid}/qc`], ['patch', `/api/fis/cases/${cid}/qc`],
    ['post', `/api/fis/cases/${cid}/qc/subjects`], ['delete', `/api/fis/cases/${cid}/qc/subjects/abc`],
    ['put', `/api/fis/cases/${cid}/qc/items/G1`], ['post', `/api/fis/cases/${cid}/qc/send-back`],
    ['post', `/api/fis/cases/${cid}/qc/pass`], ['post', `/api/fis/cases/${cid}/qc/reopen`],
    ['get', '/api/fis/qc-template'], ['post', '/api/fis/qc-template/items'], ['patch', '/api/fis/qc-template/items/G1'],
    ['delete', '/api/fis/qc-template/items/G1'], ['post', '/api/fis/qc-template/sections'], ['put', '/api/fis/qc-template/case-types'],
  ]
  const WRITES = (cid) => QC_ROUTES(cid).filter(([m]) => m !== 'get')

  beforeAll(async () => {
    id = await makeCase('CHDD/SMDD') // mahak lead, shreya support 1
    await startQc(id)
    await setItem(id, 'G1', { status: 'Issue', note: 'page 6, case 2' })
  })

  test.each(['head', 'ca', 'admin', 'manager', 'sales', 'employee', 'bgv'])('%s (no fisRole) -> 403 on every QC route', async (who) => {
    for (const [m, url] of QC_ROUTES(id)) {
      const res = await api(m, url, who)
      expect([m, url, res.status]).toEqual([m, url, 403])
    }
  })

  test.each(['mahak', 'shreya'])('%s (lead / support 1) can view QC incl. Issue notes', async (who) => {
    const res = await api('get', `/api/fis/cases/${id}/qc`, who)
    expect(res.status).toBe(200)
    expect(cur(res.body.run).items.find((i) => i.key === 'G1')).toMatchObject({ status: 'Issue', note: 'page 6, case 2' })
  })

  test('support 2 can view', async () => {
    const cid = await makeCase('EP', { support2: String(ids.yogesh) })
    await startQc(cid)
    expect((await api('get', `/api/fis/cases/${cid}/qc`, 'yogesh')).status).toBe(200)
  })

  test.each(['mahak', 'shreya'])('%s: every QC write -> 403, nothing changes', async (who) => {
    for (const [m, url] of WRITES(id)) {
      const res = await api(m, url, who, { status: 'Pass', note: 'x', label: 'x', reason: 'x' })
      expect([m, url, res.status]).toEqual([m, url, 403])
    }
    expect(cur(await getRun(id)).items.find((i) => i.key === 'G1').status).toBe('Issue')
  })

  test('member not on the case -> 403 on view and writes', async () => {
    expect((await api('get', `/api/fis/cases/${id}/qc`, 'yogesh')).status).toBe(403)
    for (const [m, url] of WRITES(id)) expect((await api(m, url, 'yogesh')).status).toBe(403)
  })

  test('creator-only (not lead/support) -> 403 on QC and no qcStatus in the list', async () => {
    const res = await api('post', '/api/fis/cases', 'yogesh', { caseRef: 'CREATOR-QC', caseType: 'EP', caseLead: String(ids.mahak) })
    const cid = res.body._id
    expect((await api('get', `/api/fis/cases/${cid}/qc`, 'yogesh')).status).toBe(403)
    const row = (await api('get', '/api/fis/cases', 'yogesh')).body.find((x) => x.caseRef === 'CREATOR-QC')
    expect(row.qcStatus).toBeNull()
  })

  test('all three fis_admins can write (incl. one not on the case)', async () => {
    for (const who of ['brishti', 'praveen', 'niharika']) {
      expect((await setItem(id, 'G20', { status: 'Pass' }, who)).status).toBe(200)
    }
  })

  test('unknown QC start on missing case / bad id', async () => {
    expect((await api('get', '/api/fis/cases/507f1f77bcf86cd799439011/qc', 'brishti')).status).toBe(404)
    expect((await api('get', '/api/fis/cases/not-an-id/qc', 'brishti')).status).toBe(404)
    const cid = await makeCase('EP')
    expect((await api('get', `/api/fis/cases/${cid}/qc`, 'brishti')).body.run).toBeNull()
  })
})

describe('issue log grouping', () => {
  test('an issue raised again in later rounds stays in ONE row', async () => {
    const id = await makeCase('EP')
    await startQc(id)
    const send = () => api('post', `/api/fis/cases/${id}/qc/send-back`, 'brishti')
    await setItem(id, 'G12', { status: 'Issue', note: 'page 6, case 2' })
    await send()
    await setItem(id, 'G12', { status: 'Issue', note: 'page 6 still wrong, case 2' }) // raised again
    await send()
    let log = (await getRun(id)).issueLog.filter((e) => e.code === 'G12')
    expect(log).toHaveLength(1)
    expect(log[0]).toMatchObject({ raisedRounds: [1, 2], reraised: 1, open: true, resolvedRound: null, note: 'page 6 still wrong, case 2' })
    await setItem(id, 'G12', { status: 'Pass' })
    log = (await getRun(id)).issueLog.filter((e) => e.code === 'G12')
    expect(log).toHaveLength(1)
    expect(log[0]).toMatchObject({ raisedRound: 1, raisedRounds: [1, 2], resolvedRound: 3, open: false })
  })

  test('different subjects of the same check are separate rows', async () => {
    const id = await makeCase('VDD/TPDD')
    await startQc(id)
    const a = (await api('post', `/api/fis/cases/${id}/qc/subjects`, 'brishti', { label: 'D1' })).body.run.subjects[0].id
    const b = (await api('post', `/api/fis/cases/${id}/qc/subjects`, 'brishti', { label: 'D2' })).body.run.subjects[1].id
    await setItem(id, `CH6@${a}`, { status: 'Issue', note: 'x' })
    await setItem(id, `CH6@${b}`, { status: 'Issue', note: 'y' })
    expect((await getRun(id)).issueLog.filter((e) => e.code === 'CH6')).toHaveLength(2)
  })
})

describe('seedFisQc guard', () => {
  const run = (uri, args, input) => spawnSync('node', [path.join(ROOT, 'scripts', 'seedFisQc.js'), ...args],
    { env: { ...process.env, MONGO_URI: uri, NODE_ENV: 'development' }, encoding: 'utf8', input })
  const count = async (uri) => {
    const conn = await mongoose.createConnection(uri).asPromise()
    const n = await conn.db.collection('fisqctemplates').countDocuments()
    await conn.close()
    return n
  }
  let prodMem, prodUri
  beforeAll(async () => { prodMem = await MongoMemoryServer.create(); prodUri = prodMem.getUri('test') })
  afterAll(async () => { await prodMem.stop() })

  test('refuses the production DB without --prod', async () => {
    const r = run(prodUri, [])
    expect(r.status).toBe(1)
    expect(r.stdout).toContain('DB: test')
    expect(r.stderr).toContain('without --prod')
    expect(await count(prodUri)).toBe(0)
  })

  test('--prod asks for confirmation; anything but "yes" aborts without writing', async () => {
    const r = run(prodUri, ['--prod'], 'no\n')
    expect(r.stdout).toContain('Type "yes"')
    expect(r.stdout).toContain('Aborted')
    expect(await count(prodUri)).toBe(0)
  })

  test('--prod + "yes" seeds once; running again changes nothing', async () => {
    const r = run(prodUri, ['--prod'], 'yes\n')
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('Seeded QC template v1: 8 sections, 117 items')
    expect(await count(prodUri)).toBe(1)
    expect(run(prodUri, ['--prod'], 'yes\n').stdout).toContain('nothing to do')
    expect(await count(prodUri)).toBe(1)
  })
})

describe('template versioning (runs last: it changes the template)', () => {
  test('editing the template does not change an existing run', async () => {
    const id = await makeCase('EP')
    const before = (await startQc(id)).body.run
    expect(before.templateVersion).toBe(1)
    const g1Text = cur(before).items.find((i) => i.key === 'G1').text

    const add = await api('post', '/api/fis/qc-template/items', 'brishti', { section: 'G', group: 'Scope and case details', text: 'A new general check.' })
    expect(add.status).toBe(201)
    expect(add.body.version).toBe(2)
    expect((await api('patch', '/api/fis/qc-template/items/G1', 'brishti', { text: 'Reworded G1' })).status).toBe(200)
    expect((await api('delete', '/api/fis/qc-template/items/G2', 'brishti')).status).toBe(200)

    const run = await getRun(id)
    expect(run.templateVersion).toBe(1)
    expect(cur(run).items).toHaveLength(32)
    expect(cur(run).items.find((i) => i.key === 'G1').text).toBe(g1Text)
    expect(cur(run).items.some((i) => i.key === 'G2')).toBe(true)

    // a new run picks up the latest version: 32 + 1 added - 1 removed = 32, G33 present, G2 gone
    const id2 = await makeCase('EP')
    const fresh = (await startQc(id2)).body.run
    expect(fresh.templateVersion).toBe(4)
    expect(cur(fresh).items.find((i) => i.key === 'G33').text).toBe('A new general check.')
    expect(cur(fresh).items.find((i) => i.key === 'G1').text).toBe('Reworded G1')
    expect(cur(fresh).items.some((i) => i.key === 'G2')).toBe(false)
    // versions are immutable rows
    expect(await FisQcTemplate.countDocuments()).toBe(4)
    expect((await FisQcTemplate.findOne({ version: 1 })).sections[0].groups[0].items[0].text).toBe(g1Text)
  })

  test('removed codes are never reused', async () => {
    const add = await api('post', '/api/fis/qc-template/items', 'brishti', { section: 'G', group: 'Scope and case details', text: 'Another.' })
    const codes = add.body.sections.find((s) => s.code === 'G').groups.flatMap((g) => g.items.map((i) => i.code))
    expect(codes).toContain('G34')
    expect(codes).not.toContain('G2')
  })

  test('EP checks can be added without a deploy: new section + mapping', async () => {
    expect((await api('post', '/api/fis/qc-template/sections', 'brishti', { code: 'EP', title: 'Executive Protection' })).status).toBe(201)
    expect((await api('post', '/api/fis/qc-template/sections', 'brishti', { code: 'EP', title: 'dup' })).status).toBe(409)
    const item = await api('post', '/api/fis/qc-template/items', 'brishti', { section: 'EP', group: 'Risk report', text: 'Threat picture matches the brief.' })
    expect(item.status).toBe(201)
    const cfg = (await api('get', '/api/fis/qc-template', 'brishti')).body
    const map = { ...cfg.rules.byCaseType, EP: ['EP'] }
    expect((await api('put', '/api/fis/qc-template/case-types', 'brishti', { byCaseType: { ...map, SOPs: ['NOPE'] } })).status).toBe(400)
    expect((await api('put', '/api/fis/qc-template/case-types', 'brishti', { byCaseType: map })).status).toBe(200)
    const id = await makeCase('EP')
    const run = (await startQc(id)).body.run
    expect(cur(run).items.some((i) => i.key === 'EP1')).toBe(true)
  })

  test('template validation', async () => {
    expect((await api('post', '/api/fis/qc-template/items', 'brishti', { section: 'ZZ', group: 'g', text: 't' })).status).toBe(400)
    expect((await api('post', '/api/fis/qc-template/items', 'brishti', { section: 'G', group: 'g', text: ' ' })).status).toBe(400)
    expect((await api('patch', '/api/fis/qc-template/items/NOPE1', 'brishti', { text: 'x' })).status).toBe(404)
  })
})
