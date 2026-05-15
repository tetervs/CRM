const rateLimit = require('express-rate-limit')

// Key by authenticated user ID — export routes always run behind protect,
// so req.user is guaranteed. No IP fallback needed.
const userKeyGenerator = (req) => req.user._id.toString()

/**
 * Strict limiter for login & register — 5 attempts per 15 minutes per IP.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,   // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false,
  message: {
    message: 'Too many login attempts. Please try again after 15 minutes.',
  },
})

/**
 * General limiter for all other API routes — 100 requests per 15 minutes per IP.
 */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Too many requests. Please slow down and try again later.',
  },
})

// ── Export-specific limiters (per authenticated user) ─────────────────────────

const reimbursementExportLimiter = rateLimit({
  windowMs:     60 * 60 * 1000, // 1 hour
  max:          10,
  keyGenerator: userKeyGenerator,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { message: 'Reimbursement export limit reached (10 per hour). Please try again later.' },
})

const leadPdfLimiter = rateLimit({
  windowMs:     60 * 60 * 1000,
  max:          30,
  keyGenerator: userKeyGenerator,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { message: 'Lead PDF export limit reached (30 per hour). Please try again later.' },
})

const projectPdfLimiter = rateLimit({
  windowMs:     60 * 60 * 1000,
  max:          30,
  keyGenerator: userKeyGenerator,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { message: 'Project PDF export limit reached (30 per hour). Please try again later.' },
})

module.exports = { authLimiter, generalLimiter, reimbursementExportLimiter, leadPdfLimiter, projectPdfLimiter }
