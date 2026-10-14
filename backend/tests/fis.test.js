const path = require('path')
const { spawnSync } = require('child_process')
const jwt = require('jsonwebtoken')
const mongoose = require('mongoose')
const request = require('supertest')
const { MongoMemoryServer } = require('mongodb-memory-server')

jest.setTimeout(180000)

const ROOT = path.join(__dirname, '..')
const ASOF = '2026-10-14'
let mem, app, User, FisCase, FisCaseHistory, FisConfig, uri
const tok = {}  // label -> bearer token
const ids = {}  // label -> user id

const auth = (label) => ({ Authorization: `Bearer ${tok[label]}` })
const runScript = (script, mongoUri, extra = []) =>
  spawnSync('node', [path.join(ROOT, 'scripts', script), ...extra], {
    env: { ...process.env, MONGO_URI: mongoUri, NODE_ENV: 'development' }, encoding: 'utf8',
  })

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret'
  process.env.NODE_ENV = 'development'
  mem = await MongoMemoryServer.create()
  uri = mem.getUri('salespilot_dev')
  process.env.MONGO_URI = uri
  await mongoose.connect(uri)
  app = require('../server')
  User = require('../models/User')
  FisCase = require('../models/FisCase')
  FisCaseHistory = require('../models/FisCaseHistory')
  FisConfig = require('../models/FisConfig')

  // Real seed script, run twice (idempotency), against the in-memory dev DB.
  for (let i = 0; i < 2; i++) {
    const r = runScript('seedFis.js', uri)
    expect(r.status).toBe(0)
  }

  // Non-FIS users: every existing role (fisRole null), incl. a BGV-department sales user.
  for (const role of ['head', 'ca', 'admin', 'manager', 'sales', 'employee']) {
    const u = await User.create({ name: role, email: `${role}@x.com`, password: 'pw', role })
    ids[role] = u._id
  }
  const bgv = await User.create({ name: 'bgv', email: 'bgv@x.com', password: 'pw', role: 'sales' })
  ids.bgv = bgv._id

  for (const [label, email] of [['praveen', 'praveen'], ['mahak', 'mahak'], ['yogesh', 'yogesh'], ['shreya', 'shreya']]) {
    const u = await User.findOne({ email: `${email}@fis-dev.example.com` })
    ids[label] = u._id
    tok[label] = jwt.sign({ id: u._id }, process.env.JWT_SECRET)
  }
  for (const label of ['head', 'ca', 'admin', 'manager', 'sales', 'employee', 'bgv']) {
    tok[label] = jwt.sign({ id: ids[label] }, process.env.JWT_SECRET)
  }
})

afterAll(async () => {
  await mongoose.disconnect()
  await mem.stop()
})

const NON_FIS = ['head', 'ca', 'admin', 'manager', 'sales', 'employee', 'bgv']
const ROUTES = [
  ['get', '/api/fis/config'], ['put', '/api/fis/config'], ['get', '/api/fis/people'],
  ['get', '/api/fis/cases'], ['post', '/api/fis/cases'], ['get', '/api/fis/cases/507f1f77bcf86cd799439011'],
  ['put', '/api/fis/cases/507f1f77bcf86cd799439011'], ['get', '/api/fis/dashboard'], ['get', '/api/fis/report'],
  ['get', '/api/fis/does-not-exist'],
]

describe('access: users without fisRole', () => {
  test.each(NON_FIS)('%s gets 403 on every /api/fis route', async (label) => {
    for (const [method, url] of ROUTES) {
      const res = await request(app)[method](url).set(auth(label)).send({})
      expect([method, url, res.status]).toEqual([method, url, 403])
    }
  })

  test('no token -> 401', async () => {
    expect((await request(app).get('/api/fis/cases')).status).toBe(401)
  })

  test('fisRole is not derived from role: head/admin roles with fisRole null stay blocked', async () => {
    const u = await User.findById(ids.head)
    expect(u.fisRole).toBeNull()
  })
})

describe('access: fis_member', () => {
  test('403 on admin dashboard, report and config update', async () => {
    for (const [method, url] of [['get', '/api/fis/dashboard'], ['get', '/api/fis/report'], ['put', '/api/fis/config']]) {
      expect((await request(app)[method](url).set(auth('mahak')).send({})).status).toBe(403)
    }
  })

  test('list shows only own cases; 403 on a case they are not on', async () => {
    const mine = await request(app).get('/api/fis/cases').set(auth('yogesh'))
    expect(mine.body).toEqual([])
    const mahak = await request(app).get('/api/fis/cases').set(auth('mahak'))
    expect(mahak.body.map((c) => c.caseRef).sort()).toEqual(['Dashmesh', 'TBD'])

    const dashmesh = await FisCase.findOne({ caseRef: 'Dashmesh' })
    expect((await request(app).get(`/api/fis/cases/${dashmesh._id}`).set(auth('yogesh'))).status).toBe(403)
    expect((await request(app).put(`/api/fis/cases/${dashmesh._id}`).set(auth('yogesh')).send({ remarks: 'x' })).status).toBe(403)
    expect((await request(app).get(`/api/fis/cases/${dashmesh._id}`).set(auth('shreya'))).status).toBe(200)
  })

  test('any member can create a case', async () => {
    const res = await request(app).post('/api/fis/cases').set(auth('yogesh'))
      .send({ caseRef: 'EP-001', caseType: 'EP', caseLead: String(ids.yogesh) })
    expect(res.status).toBe(201)
    expect(res.body.stage).toBe('Case intake')
    expect(res.body.step).toEqual({ n: 1, of: 8 })
    expect(res.body.phase).toBe('Intake and scoping')
  })

  test('asOf is admin-only', async () => {
    const plain = await request(app).get('/api/fis/cases').set(auth('mahak'))
    const pinned = await request(app).get('/api/fis/cases?asOf=2000-01-01').set(auth('mahak'))
    expect(pinned.body.map((c) => c.daysSinceStage)).toEqual(plain.body.map((c) => c.daysSinceStage))
    const admin = await request(app).get('/api/fis/cases?asOf=2000-01-01').set(auth('praveen'))
    expect(admin.body.find((c) => c.caseRef === 'Dashmesh').daysSinceStage).toBeLessThan(0) // admin's asOf is honoured
  })
})

describe('seeded data', () => {
  test('seed is idempotent', async () => {
    expect(await FisCase.countDocuments({ caseRef: 'Dashmesh' })).toBe(1)
    expect(await User.countDocuments({ fisRole: 'fis_admin' })).toBe(3)
    expect(await User.countDocuments({ fisRole: 'fis_member' })).toBe(5)
  })

  test(`dashboard as of ${ASOF}: Open 3, Overdue 0, Due soon 1, Closed 2`, async () => {
    // Remove the case created by the member test so numbers match the seed.
    await FisCase.deleteOne({ caseRef: 'EP-001' })
    const res = await request(app).get(`/api/fis/dashboard?asOf=${ASOF}`).set(auth('praveen'))
    expect(res.status).toBe(200)
    expect(res.body.tiles).toMatchObject({ open: 3, overdue: 0, dueSoon: 1, closed: 2 })
    expect(res.body.noLead.open).toBe(1) // Sukla Dey
  })

  test('review report from 2026-10-01', async () => {
    const res = await request(app).get(`/api/fis/report?from=2026-10-01&to=${ASOF}&asOf=${ASOF}`).set(auth('praveen'))
    expect(res.status).toBe(200)
    const cctv = res.body.cases.find((c) => c.caseRef.startsWith('Nykaa CCTV'))
    const sop = res.body.cases.find((c) => c.caseRef.startsWith('Nykaa SOP'))
    expect(cctv).toMatchObject({ outcome: 'late', daysToClose: 66 })
    expect(sop).toMatchObject({ outcome: 'onTime', daysToClose: 62 })
    expect(res.body.perMonth).toHaveLength(12)
  })
})

describe('stage change', () => {
  test('writes history, resets stale counter, closing sets closedAt and reopening clears it', async () => {
    const c = await FisCase.findOne({ caseRef: 'Dashmesh' })
    const before = await request(app).get(`/api/fis/cases/${c._id}?asOf=${ASOF}`).set(auth('praveen'))
    expect(before.body.daysSinceStage).toBe(5)

    // Remarks edit must NOT reset the stale counter
    await request(app).put(`/api/fis/cases/${c._id}`).set(auth('mahak')).send({ remarks: 'called client' })
    expect((await FisCase.findById(c._id)).stageChangedAt.toISOString()).toBe(c.stageChangedAt.toISOString())

    const res = await request(app).put(`/api/fis/cases/${c._id}`).set(auth('mahak')).send({ stage: 'OSINT research' })
    expect(res.status).toBe(200)
    expect(res.body.daysSinceStage).toBe(0)
    expect(res.body.stale).toBe(false)
    expect(res.body.phase).toBe('Research and fieldwork')

    const hist = await FisCaseHistory.find({ case: c._id, field: 'stage' })
    expect(hist).toHaveLength(1)
    expect(hist[0]).toMatchObject({ from: 'Case proposal', to: 'OSINT research' })
    expect(String(hist[0].by)).toBe(String(ids.mahak))

    const closed = await request(app).put(`/api/fis/cases/${c._id}`).set(auth('mahak')).send({ stage: 'Closed' })
    expect(closed.body.closedAt).toBeTruthy()
    expect(closed.body.deadlineStatus).toBe('Closed')
    const reopened = await request(app).put(`/api/fis/cases/${c._id}`).set(auth('mahak')).send({ stage: 'Report writing' })
    expect(reopened.body.closedAt).toBeNull()
  })

  test('rejects a stage that is not in the case type', async () => {
    const c = await FisCase.findOne({ caseRef: 'TBD' })
    const res = await request(app).put(`/api/fis/cases/${c._id}`).set(auth('shreya')).send({ stage: 'Draft 1' })
    expect(res.status).toBe(400)
  })

  test('stale = days since STAGE change >= staleDays', async () => {
    const c = await FisCase.findOne({ caseRef: 'TBD' })
    await FisCase.updateOne({ _id: c._id }, { stageChangedAt: new Date('2026-10-01T10:00:00+05:30') })
    const res = await request(app).get(`/api/fis/cases/${c._id}?asOf=${ASOF}`).set(auth('praveen'))
    expect(res.body).toMatchObject({ daysSinceStage: 13, stale: true })
  })
})

describe('config editing', () => {
  test('removing a stage from a case type flags existing cases instead of breaking them', async () => {
    const cfg = (await request(app).get('/api/fis/config').set(auth('praveen'))).body
    const caseTypes = cfg.caseTypes.map((t) => (t.code === 'Corporate investigation'
      ? { ...t, stages: t.stages.filter((s) => s !== 'Case intake') } : t))
    const put = await request(app).put('/api/fis/config').set(auth('praveen')).send({ ...cfg, caseTypes })
    expect(put.status).toBe(200)

    const tbd = await FisCase.findOne({ caseRef: 'TBD' }) // stage: Case intake (now removed)
    const get = await request(app).get(`/api/fis/cases/${tbd._id}`).set(auth('shreya'))
    expect(get.status).toBe(200)
    expect(get.body).toMatchObject({ stage: 'Case intake', stageMissing: true, step: null })
    // editing other fields still works
    expect((await request(app).put(`/api/fis/cases/${tbd._id}`).set(auth('shreya')).send({ remarks: 'ok' })).status).toBe(200)
    const dash = await request(app).get(`/api/fis/dashboard?asOf=${ASOF}`).set(auth('praveen'))
    expect(dash.status).toBe(200)
  })
})

describe('member edit rights', () => {
  let caseId
  beforeAll(async () => {
    const res = await request(app).post('/api/fis/cases').set(auth('praveen'))
      .send({ caseRef: 'RIGHTS', caseType: 'SOPs', caseLead: String(ids.mahak) })
    caseId = res.body._id
  })
  afterAll(async () => {
    await FisCase.deleteOne({ _id: caseId })
    await FisCaseHistory.deleteMany({ case: caseId })
  })

  const RESTRICTED = {
    caseRef: 'changed', caseType: 'EP', caseLead: null, support1: () => String(ids.yogesh), support2: () => String(ids.yogesh),
    assignedBy: () => String(ids.mahak), dateAssigned: '2026-01-01', deadline: '2026-12-31',
  }

  test.each(Object.keys(RESTRICTED))('member PATCH of %s -> 403', async (field) => {
    const v = typeof RESTRICTED[field] === 'function' ? RESTRICTED[field]() : RESTRICTED[field]
    const res = await request(app).patch(`/api/fis/cases/${caseId}`).set(auth('mahak')).send({ [field]: v })
    expect(res.status).toBe(403)
    const unchanged = await FisCase.findById(caseId)
    expect(unchanged.caseType).toBe('SOPs')
  })

  test('member PATCH of stage and remarks -> 200', async () => {
    expect((await request(app).patch(`/api/fis/cases/${caseId}`).set(auth('mahak')).send({ stage: 'Draft 1' })).status).toBe(200)
    expect((await request(app).patch(`/api/fis/cases/${caseId}`).set(auth('mahak')).send({ remarks: 'note' })).status).toBe(200)
  })

  test('a restricted field mixed with stage is rejected as a whole', async () => {
    const res = await request(app).patch(`/api/fis/cases/${caseId}`).set(auth('mahak')).send({ stage: 'Draft 2', deadline: '2026-12-31' })
    expect(res.status).toBe(403)
    expect((await FisCase.findById(caseId)).stage).toBe('Draft 1')
  })

  test('fis_admin can still edit restricted fields', async () => {
    const res = await request(app).patch(`/api/fis/cases/${caseId}`).set(auth('praveen')).send({ deadline: '2026-12-31', support1: String(ids.shreya) })
    expect(res.status).toBe(200)
  })

  test('member can set restricted fields at creation', async () => {
    const res = await request(app).post('/api/fis/cases').set(auth('yogesh'))
      .send({ caseRef: 'CREATE-ALL', caseType: 'EP', caseLead: String(ids.yogesh), deadline: '2026-12-31', assignedBy: String(ids.praveen) })
    expect(res.status).toBe(201)
    await FisCase.deleteOne({ _id: res.body._id })
  })
})

describe('creator visibility', () => {
  let caseId
  beforeAll(async () => {
    // yogesh creates a case he is NOT on (lead is mahak)
    const res = await request(app).post('/api/fis/cases').set(auth('yogesh')).send({ caseRef: 'CREATOR-ONLY', caseType: 'SOPs', caseLead: String(ids.mahak) })
    caseId = res.body._id
  })
  afterAll(async () => {
    await FisCase.deleteOne({ _id: caseId })
    await FisCaseHistory.deleteMany({ case: caseId })
  })

  test('creator sees it in their list and can open it, flagged view-only', async () => {
    const list = await request(app).get('/api/fis/cases').set(auth('yogesh'))
    expect(list.body.map((c) => c.caseRef)).toContain('CREATOR-ONLY')
    const get = await request(app).get(`/api/fis/cases/${caseId}`).set(auth('yogesh'))
    expect(get.status).toBe(200)
    expect(get.body.canEdit).toBe(false)
  })

  test('creator-only cannot edit (403), even stage/remarks', async () => {
    expect((await request(app).patch(`/api/fis/cases/${caseId}`).set(auth('yogesh')).send({ remarks: 'x' })).status).toBe(403)
    expect((await request(app).put(`/api/fis/cases/${caseId}`).set(auth('yogesh')).send({ stage: 'Draft 1' })).status).toBe(403)
  })

  test('creator who is also lead/support can edit stage and remarks', async () => {
    const mine = await request(app).post('/api/fis/cases').set(auth('yogesh')).send({ caseRef: 'CREATOR-LEAD', caseType: 'SOPs', caseLead: String(ids.yogesh) })
    const res = await request(app).patch(`/api/fis/cases/${mine.body._id}`).set(auth('yogesh')).send({ remarks: 'ok' })
    expect(res.status).toBe(200)
    await FisCase.deleteOne({ _id: mine.body._id })
  })

  test('a different member who is not creator/lead/support still gets 403', async () => {
    expect((await request(app).get(`/api/fis/cases/${caseId}`).set(auth('shreya'))).status).toBe(403)
  })

  test('the lead can edit it', async () => {
    expect((await request(app).patch(`/api/fis/cases/${caseId}`).set(auth('mahak')).send({ remarks: 'lead edit' })).status).toBe(200)
  })
})

describe('fisRole is hidden from users without a fisRole', () => {
  test('GET /api/users as head/sales/employee never contains fisRole', async () => {
    for (const label of ['head', 'admin', 'sales', 'employee']) {
      const res = await request(app).get('/api/users').set(auth(label))
      expect(res.status).toBe(200)
      expect(res.text).not.toContain('fisRole')
    }
  })

  test('/auth/me for a non-FIS user has no fisRole', async () => {
    const res = await request(app).get('/api/auth/me').set(auth('manager'))
    expect(res.text).not.toContain('fisRole')
  })

  test('a FIS member still sees fisRole (own /auth/me, and in GET /api/users)', async () => {
    expect((await request(app).get('/api/auth/me').set(auth('mahak'))).body.fisRole).toBe('fis_member')
    const users = await request(app).get('/api/users').set(auth('praveen'))
    expect(users.text).toContain('fisRole')
  })
})

describe('DB guard', () => {
  test('seedFis refuses the production DB "test"', async () => {
    const prodMem = await MongoMemoryServer.create()
    try {
      const r = runScript('seedFis.js', prodMem.getUri('test'), ['--prod'])
      expect(r.status).toBe(1)
      expect(r.stdout).toContain('DB: test')
      expect(r.stderr).toContain('Refusing')
      const conn = await mongoose.createConnection(prodMem.getUri('test')).asPromise()
      expect(await conn.db.collection('users').countDocuments()).toBe(0)
      await conn.close()
    } finally { await prodMem.stop() }
  })

  test('set-fis-roles refuses to run without --prod', () => {
    const r = spawnSync('node', [path.join(ROOT, 'scripts', 'set-fis-roles.js')], { encoding: 'utf8' })
    expect(r.status).toBe(1)
    expect(r.stderr).toContain('without --prod')
  })
})
