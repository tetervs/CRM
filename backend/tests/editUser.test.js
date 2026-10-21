const jwt = require('jsonwebtoken')
const mongoose = require('mongoose')
const request = require('supertest')
const { MongoMemoryServer } = require('mongodb-memory-server')

jest.setTimeout(180000)

let mem, app, User, Department, UserAuditLog, dept
const ids = {}
const tok = {}
const auth = (l) => ({ Authorization: `Bearer ${tok[l]}` })
const patch = (who, target, body) => request(app).patch(`/api/users/${ids[target]}`).set(auth(who)).send(body)

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret'
  process.env.NODE_ENV = 'development'
  process.env.ALLOWED_EMAIL_DOMAINS = 'x.com,y.com'
  mem = await MongoMemoryServer.create()
  const uri = mem.getUri('salespilot_dev')
  process.env.MONGO_URI = uri
  await mongoose.connect(uri)
  app = require('../server')
  User = require('../models/User')
  Department = require('../models/Department')
  UserAuditLog = require('../models/UserAuditLog')

  dept = await Department.create({ name: 'Ops', code: 'OPS' })
  const mk = async (label, role, extra = {}) => {
    const u = await User.create({ name: label, email: `${label}@x.com`, password: 'pw1234', role, ...extra })
    ids[label] = u._id
    tok[label] = jwt.sign({ id: u._id }, process.env.JWT_SECRET)
  }
  await mk('head', 'head')
  await mk('head2', 'head')
  await mk('admin', 'admin')
  await mk('manager', 'manager')
  await mk('sales', 'sales', { manager: undefined })
  await mk('victim', 'employee')
  await mk('employee2', 'employee', { manager: ids.manager })
})

afterAll(async () => {
  await mongoose.disconnect()
  await mem.stop()
})

describe('PATCH /users/:id — who', () => {
  test.each(['manager', 'sales', 'victim'])('%s gets 403 on edit', async (who) => {
    expect((await patch(who, 'sales', { name: 'Zed' })).status).toBe(403)
  })
  test.each(['manager', 'sales', 'victim'])('%s gets 403 on reset', async (who) => {
    const r = await request(app).post(`/api/users/${ids.victim}/reset-password`).set(auth(who))
    expect(r.status).toBe(403)
  })
  test('head and admin can edit', async () => {
    expect((await patch('head', 'victim', { name: 'Vic' })).status).toBe(200)
    expect((await patch('admin', 'victim', { name: 'Victor' })).status).toBe(200)
  })
  test('admin cannot touch a head account or assign head', async () => {
    expect((await patch('admin', 'head2', { name: 'Nope' })).status).toBe(403)
    expect((await patch('admin', 'victim', { role: 'head' })).status).toBe(403)
    const r = await request(app).post(`/api/users/${ids.head2}/reset-password`).set(auth('admin'))
    expect(r.status).toBe(403)
  })
})

describe('email', () => {
  test('must be unique', async () => {
    const r = await patch('head', 'victim', { email: 'admin@x.com' })
    expect(r.status).toBe(400)
    expect(r.body.message).toMatch(/already/i)
  })
  test('must be on the allowed domain list', async () => {
    const r = await patch('head', 'victim', { email: 'victim@evil.com' })
    expect(r.status).toBe(400)
    expect(r.body.message).toMatch(/domain/i)
  })
  test('allowed domain succeeds and is lowercased', async () => {
    const r = await patch('head', 'victim', { email: 'Victor.New@Y.com' })
    expect(r.status).toBe(200)
    expect(r.body.email).toBe('victor.new@y.com')
  })
})

describe('self-protection', () => {
  test.each([['role', 'manager'], ['isActive', false], ['fisRole', 'fis_admin']])('cannot change own %s', async (f, v) => {
    const r = await patch('admin', 'admin', { [f]: v })
    expect(r.status).toBe(400)
    expect((await User.findById(ids.admin))[f]).not.toBe(v)
  })
  test('can edit own name; unchanged role/status in payload is fine', async () => {
    const r = await patch('admin', 'admin', { name: 'Adm', role: 'admin', isActive: true, fisRole: null })
    expect(r.status).toBe(200)
  })
})

describe('last head', () => {
  // An acting head is always an active head, so the API alone can only reach this
  // through a race (two heads demoting each other). Simulate "no other active head".
  test('cannot demote or deactivate the last remaining head', async () => {
    const real = User.exists.bind(User)
    const spy = jest.spyOn(User, 'exists').mockImplementation((f) => (f && f.role === 'head' ? Promise.resolve(null) : real(f)))
    expect((await patch('head', 'head2', { role: 'admin' })).status).toBe(400)
    expect((await patch('head', 'head2', { isActive: false })).status).toBe(400)
    spy.mockRestore()
    expect((await User.findById(ids.head2)).role).toBe('head')
  })
  test('with another active head, demotion is allowed', async () => {
    expect((await patch('head', 'head2', { role: 'admin' })).status).toBe(200)
    await User.updateOne({ _id: ids.head2 }, { role: 'head' })
  })
})

describe('deactivate', () => {
  test('inactive user cannot log in and existing token dies instantly', async () => {
    expect((await request(app).get('/api/auth/me').set(auth('victim'))).status).toBe(200)
    expect((await patch('head', 'victim', { isActive: false })).status).toBe(200)
    expect((await request(app).get('/api/auth/me').set(auth('victim'))).status).toBe(401)
    const login = await request(app).post('/api/auth/login').send({ email: 'victor.new@y.com', password: 'pw1234' })
    expect(login.status).toBe(403)
  })
  test('DELETE is soft and shares the guards (self / last head)', async () => {
    const self = await request(app).delete(`/api/users/${ids.head}`).set(auth('head'))
    expect(self.status).toBe(400)
    expect(await User.countDocuments({ _id: ids.head })).toBe(1)
  })
})

describe('fisRole', () => {
  test('head can set and clear; GET /users/:id shows it to head', async () => {
    expect((await patch('head', 'manager', { fisRole: 'fis_member' })).body.fisRole).toBe('fis_member')
    const g = await request(app).get(`/api/users/${ids.manager}`).set(auth('head'))
    expect(g.body.fisRole).toBe('fis_member')
    const c = await patch('head', 'manager', { fisRole: null })
    expect(c.status).toBe(200)
    expect((await User.findById(ids.manager)).fisRole).toBeNull()
  })
  test('invalid value rejected', async () => {
    expect((await patch('head', 'manager', { fisRole: 'god' })).status).toBe(422)
  })
})

describe('audit log', () => {
  test('one row per changed field with actor, old and new', async () => {
    await UserAuditLog.deleteMany({})
    await patch('head', 'sales', { name: 'Sally', role: 'manager', fisRole: 'fis_member' })
    // role->manager on a user without a manager is refused, so only retry without role
    expect(await UserAuditLog.countDocuments()).toBe(0)
    const r = await patch('head', 'sales', { name: 'Sally', fisRole: 'fis_member' })
    expect(r.status).toBe(200)
    const rows = await UserAuditLog.find({ target: ids.sales }).sort({ field: 1 })
    expect(rows.map((x) => [x.field, x.oldValue, x.newValue])).toEqual([
      ['fisRole', null, 'fis_member'],
      ['name', 'sales', 'Sally'],
    ])
    expect(String(rows[0].actor)).toBe(String(ids.head))
    expect(rows[0].createdAt).toBeInstanceOf(Date)
  })
  test('no-op edit logs nothing', async () => {
    const n = await UserAuditLog.countDocuments()
    await patch('head', 'sales', { name: 'Sally' })
    expect(await UserAuditLog.countDocuments()).toBe(n)
  })
})

describe('reset password', () => {
  test('returns temp password once, forces change, unlocks, logged without the secret', async () => {
    await User.updateOne({ _id: ids.sales }, { lockUntil: new Date(Date.now() + 1e6), failedLoginAttempts: 5 })
    const r = await request(app).post(`/api/users/${ids.sales}/reset-password`).set(auth('admin'))
    expect(r.status).toBe(200)
    expect(r.body.tempPassword.length).toBeGreaterThanOrEqual(10)
    const login = await request(app).post('/api/auth/login').send({ email: 'sales@x.com', password: r.body.tempPassword })
    expect(login.status).toBe(200)
    expect(login.body.user.mustChangePassword).toBe(true)
    const row = await UserAuditLog.findOne({ target: ids.sales, field: 'password' })
    expect(JSON.stringify(row)).not.toContain(r.body.tempPassword)
    const again = await request(app).get(`/api/users/${ids.sales}`).set(auth('head'))
    expect(JSON.stringify(again.body)).not.toContain(r.body.tempPassword)
  })
})

describe('session invalidation', () => {
  const h = (t) => ({ Authorization: `Bearer ${t}` })
  test('reset password: old token 401, new login works', async () => {
    const oldTok = jwt.sign({ id: ids.employee2 }, process.env.JWT_SECRET)
    expect((await request(app).get('/api/auth/me').set(h(oldTok))).status).toBe(200)
    const r = await request(app).post(`/api/users/${ids.employee2}/reset-password`).set(auth('head'))
    expect(r.status).toBe(200)
    expect((await request(app).get('/api/auth/me').set(h(oldTok))).status).toBe(401)
    const login = await request(app).post('/api/auth/login').send({ email: 'employee2@x.com', password: r.body.tempPassword })
    expect(login.status).toBe(200)
    expect((await request(app).get('/api/auth/me').set(h(login.body.token))).status).toBe(200)
  })
  test('change-password-first-time and change-password invalidate the old token and return a working one', async () => {
    const t0 = jwt.sign({ id: ids.employee2, t: Date.now() }, process.env.JWT_SECRET)
    const first = await request(app).post('/api/auth/change-password-first-time').set(h(t0)).send({ newPassword: 'newpass1' })
    expect(first.status).toBe(200)
    expect((await request(app).get('/api/auth/me').set(h(t0))).status).toBe(401)
    expect((await request(app).get('/api/auth/me').set(h(first.body.token))).status).toBe(200)
    const second = await request(app).post('/api/auth/change-password').set(h(first.body.token)).send({ currentPassword: 'newpass1', newPassword: 'newpass2' })
    expect(second.status).toBe(200)
    expect((await request(app).get('/api/auth/me').set(h(first.body.token))).status).toBe(401)
    expect((await request(app).get('/api/auth/me').set(h(second.body.token))).status).toBe(200)
  })
})

describe('deactivate / reactivate (head + admin)', () => {
  test('admin can deactivate and reactivate a non-head', async () => {
    expect((await patch('admin', 'employee2', { isActive: false })).status).toBe(200)
    expect((await User.findById(ids.employee2)).isActive).toBe(false)
    expect((await patch('admin', 'employee2', { isActive: true })).status).toBe(200)
    expect((await User.findById(ids.employee2)).isActive).toBe(true)
  })
  test('admin cannot deactivate a head; head can deactivate and reactivate another head', async () => {
    expect((await patch('admin', 'head2', { isActive: false })).status).toBe(403)
    expect((await request(app).delete(`/api/users/${ids.head2}`).set(auth('admin'))).status).toBe(403)
    expect((await patch('head', 'head2', { isActive: false })).status).toBe(200)
    expect((await patch('head', 'head2', { isActive: true })).status).toBe(200)
  })
  test('manager/sales get 403', async () => {
    tok.sales = jwt.sign({ id: ids.sales, t: Date.now() }, process.env.JWT_SECRET) // earlier test reset sales' password
    expect((await patch('manager', 'employee2', { isActive: false })).status).toBe(403)
    expect((await patch('sales', 'employee2', { isActive: false })).status).toBe(403)
  })
})

describe('manager (Reports To) edit', () => {
  test('sets manager; validates manager role; required for employee; forbidden for admin', async () => {
    expect((await patch('head', 'employee2', { manager: String(ids.sales) })).status).toBe(400)
    expect((await patch('head', 'employee2', { manager: String(ids.manager) })).status).toBe(200)
    expect((await patch('head', 'employee2', { manager: null })).status).toBe(400)
    expect((await patch('head', 'admin', { manager: String(ids.head) })).status).toBe(400)
  })
})

describe('hard delete (head only)', () => {
  const del = (who, target, body) => request(app).delete(`/api/users/${ids[target]}/permanent`).set(auth(who)).send(body)
  const mkUser = async (label, extra = {}) => {
    const u = await User.create({ name: label, email: `${label}@x.com`, password: 'pw1234', role: 'employee', ...extra })
    ids[label] = u._id
    return u
  }

  test('admin / manager get 403; user survives', async () => {
    await mkUser('del1')
    expect((await del('admin', 'del1', { confirmEmail: 'del1@x.com' })).status).toBe(403)
    expect((await del('manager', 'del1', { confirmEmail: 'del1@x.com' })).status).toBe(403)
    expect(await User.exists({ _id: ids.del1 })).toBeTruthy()
  })
  test('requires matching confirmEmail', async () => {
    expect((await del('head', 'del1', {})).status).toBe(400)
    expect((await del('head', 'del1', { confirmEmail: 'nope@x.com' })).status).toBe(400)
    expect(await User.exists({ _id: ids.del1 })).toBeTruthy()
  })
  test('zero-reference user is deleted and logged with email + name', async () => {
    const r = await del('head', 'del1', { confirmEmail: 'DEL1@x.com' })
    expect(r.status).toBe(200)
    expect(await User.exists({ _id: ids.del1 })).toBeNull()
    const row = await UserAuditLog.findOne({ field: 'deleted', target: ids.del1 })
    expect(row.targetEmail).toBe('del1@x.com')
    expect(row.targetName).toBe('del1')
    expect(String(row.actor)).toBe(String(ids.head))
  })
  test('cannot delete yourself', async () => {
    expect((await del('head', 'head', { confirmEmail: 'head@x.com' })).status).toBe(400)
    expect(await User.exists({ _id: ids.head })).toBeTruthy()
  })
  test('cannot delete the last remaining head', async () => {
    const real = User.exists.bind(User)
    const spy = jest.spyOn(User, 'exists').mockImplementation((f) => (f && f.role === 'head' ? Promise.resolve(null) : real(f)))
    const r = await del('head', 'head2', { confirmEmail: 'head2@x.com' })
    spy.mockRestore()
    expect(r.status).toBe(400)
    expect(r.body.message).toMatch(/last/i)
    expect(await User.exists({ _id: ids.head2 })).toBeTruthy()
  })
  test('a head can delete another head when one remains', async () => {
    await mkUser('head3', { role: 'head' })
    expect((await del('head', 'head3', { confirmEmail: 'head3@x.com' })).status).toBe(200)
  })

  const refs = (id) => [
    ['leads',           'Lead',           { owner: id }],
    ['leads',           'Lead',           { activityLog: [{ performedBy: id }] }],
    ['projects',        'Project',        { projectHead: id }],
    ['projects',        'Project',        { teamMembers: [id] }],
    ['reimbursements',  'Reimbursement',  { submittedBy: id }],
    ['reimbursements',  'Reimbursement',  { approvalChain: [{ user: id }] }],
    ['manpowerPulls',   'ManpowerPull',   { pulledEmployee: id }],
    ['milestones',      'Milestone',      { createdBy: id }],
    ['notifications',   'Notification',   { recipient: id }],
    ['exportAuditLogs', 'ExportAuditLog', { userId: id }],
    ['fisCases',        'FisCase',        { support2: id }],
    ['fisCaseHistory',  'FisCaseHistory', { by: id }],
    ['fisQcRuns',       'FisQcRun',       { createdBy: id }],
    ['fisQcRuns',       'FisQcRun',       { rounds: [{ closedBy: id }] }],
    ['userAuditLog',    'UserAuditLog',   { actor: id }],
    ['directReports',   'User',           { manager: id }],
  ]
  test.each(refs(new mongoose.Types.ObjectId()).map((r, i) => [i, r[0], r[1]]))('reference #%i in %s (%s) -> 409 with counts, user kept', async (i, label, model) => {
    const u = await mkUser(`ref${i}`)
    const doc = refs(u._id)[i][2]
    const Model = model === 'User' ? User : require(`../models/${model}`)
    const ins = await Model.collection.insertOne(doc)
    const r = await del('head', `ref${i}`, { confirmEmail: `ref${i}@x.com` })
    await Model.collection.deleteOne({ _id: ins.insertedId })
    expect(r.status).toBe(409)
    expect(r.body.counts[label]).toBe(1)
    expect(await User.exists({ _id: u._id })).toBeTruthy()
  })
  test('rows where the user is only the TARGET are not activity: edit then delete succeeds', async () => {
    const u = await mkUser('edited')
    expect((await patch('head', 'edited', { name: 'Edited Name' })).status).toBe(200)
    expect(await UserAuditLog.countDocuments({ target: u._id })).toBeGreaterThan(0)
    expect((await del('head', 'edited', { confirmEmail: 'edited@x.com' })).status).toBe(200)
    expect(await User.exists({ _id: u._id })).toBeNull()
  })
  test('counts are reported per collection', async () => {
    const u = await mkUser('multi')
    const Lead = require('../models/Lead')
    const Notification = require('../models/Notification')
    await Lead.collection.insertOne({ owner: u._id })
    await Notification.collection.insertMany([{ recipient: u._id }, { recipient: u._id }])
    const r = await del('head', 'multi', { confirmEmail: 'multi@x.com' })
    expect(r.status).toBe(409)
    expect(r.body.counts).toEqual({ leads: 1, notifications: 2 })
  })
})

describe('Add User applies ALLOWED_EMAIL_DOMAINS', () => {
  const add = (email) => request(app).post('/api/users').set(auth('head')).send({ name: 'New Person', email, role: 'admin', department: String(dept._id), password: 'secret12' })
  test('disallowed domain -> 400, nothing created', async () => {
    const r = await add('new@evil.com')
    expect(r.status).toBe(400)
    expect(r.body.message).toMatch(/domain/i)
    expect(await User.exists({ email: 'new@evil.com' })).toBeNull()
  })
  test('allowed domain (any case) -> 201', async () => {
    const r = await add('New.Person@Y.com')
    expect(r.status).toBe(201)
    expect(r.body.user.email).toBe('new.person@y.com')
  })
})
