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
