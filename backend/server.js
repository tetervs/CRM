require('dotenv').config()
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgan')
const cookieParser = require('cookie-parser')
const connectDB = require('./config/db')
const seedDepartments = require('./config/seed')
const { generalLimiter } = require('./middleware/rateLimiter')

const app = express()

// Connect DB then seed defaults
connectDB().then(() => seedDepartments())


// ── Security headers (Helmet) ────────────────────────────────────────────────
app.use(helmet())
app.use(morgan('combined'))

// ── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
].filter(Boolean)

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true)
    cb(new Error('CORS: origin not allowed'))
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))


// ── Body parsing with size limits ────────────────────────────────────────────
app.use(express.json({ limit: '20kb' }))          // reject oversized JSON bodies
app.use(express.urlencoded({ extended: false, limit: '20kb' }))
app.use(cookieParser())

// ── General rate limiting (auth routes have their own — see authRoutes.js) ───
// app.use('/api', generalLimiter) // Temporarily disabled for testing

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth',      require('./routes/authRoutes'))
app.use('/api/leads',     require('./routes/leadRoutes'))
app.use('/api/users',     require('./routes/userRoutes'))
app.use('/api/analytics', require('./routes/analyticsRoutes'))
app.use('/api/manpower',     require('./routes/manpowerRoutes'))
app.use('/api/departments',    require('./routes/departmentRoutes'))
app.use('/api/projects',      require('./routes/projectRoutes'))
app.use('/api/reimbursements',  require('./routes/reimbursementRoutes'))
app.use('/api/notifications',  require('./routes/notificationRoutes'))
app.use('/api/milestones',     require('./routes/milestoneRoutes'))
app.use('/api/exports',        require('./routes/exportRoutes'))
app.use('/api/audit',          require('./routes/auditRoutes'))

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))

// ── 404 ──────────────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` }))

// ── Global error handler ─────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  // Don't leak stack traces to the client in production
  const isDev = process.env.NODE_ENV !== 'production'
  console.error(err.stack)
  const status = err.code?.startsWith('LIMIT_') ? 400 : (err.status || 500)
  res.status(status).json({
    message: err.message || 'Internal server error',
    ...(isDev && { stack: err.stack }),
  })
})

const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)

  if (process.env.RENDER_EXTERNAL_URL) {
    const https = require('https')
    setInterval(() => {
      https.get(`${process.env.RENDER_EXTERNAL_URL}/api/health`, (res) => {
        console.log(`[keep-alive] ping ${res.statusCode}`)
      }).on('error', (err) => {
        console.error('[keep-alive] ping failed:', err.message)
      })
    }, 14 * 60 * 1000)
  }
})
