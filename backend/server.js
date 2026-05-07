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

// ── CORS — strict allowlist ──────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))


// ── Body parsing with size limits ────────────────────────────────────────────
app.use(express.json({ limit: '20kb' }))          // reject oversized JSON bodies
app.use(express.urlencoded({ extended: false, limit: '20kb' }))
app.use(cookieParser())

// ── General rate limiting (auth routes have their own — see authRoutes.js) ───
app.use('/api', generalLimiter)

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

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))

// ── 404 ──────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ message: 'Route not found' }))

// ── Global error handler ─────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  // Don't leak stack traces to the client in production
  const isDev = process.env.NODE_ENV !== 'production'
  console.error(err.stack)
  res.status(err.status || 500).json({
    message: err.message || 'Internal server error',
    ...(isDev && { stack: err.stack }),
  })
})

const PORT = process.env.PORT || 5000
app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
