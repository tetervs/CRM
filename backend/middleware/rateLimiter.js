const rateLimit = require('express-rate-limit')

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

module.exports = { authLimiter, generalLimiter }
