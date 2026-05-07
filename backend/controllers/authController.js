const crypto = require('crypto')
const jwt = require('jsonwebtoken')
const User = require('../models/User')
const { sendVerificationEmail } = require('../utils/mailer')

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' })

// ── Register ──────────────────────────────────────────────────────────────────
const register = async (req, res) => {
  try {
    const { name, email, password } = req.body

    const exists = await User.findOne({ email })
    if (exists) return res.status(400).json({ message: 'Email already registered' })

    // Generate a cryptographically random verification token
    const verificationToken   = crypto.randomBytes(32).toString('hex')
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 h

    const user = await User.create({
      name, email, password, role: 'sales',
      verificationToken,
      verificationExpires,
      isVerified: false,
    })

    // Send verification email — non-blocking (don't fail registration if email glitches)
    sendVerificationEmail(user.email, user.name, verificationToken).catch((err) =>
      console.error('[mailer] Failed to send verification email:', err.message)
    )

    res.status(201).json({
      message: 'Account created! Please check your email to verify your account before logging in.',
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// ── Verify Email ──────────────────────────────────────────────────────────────
const verifyEmail = async (req, res) => {
  try {
    const { token } = req.params

    const user = await User.findOne({
      verificationToken: token,
      verificationExpires: { $gt: Date.now() },
    })

    if (!user) {
      return res.status(400).json({ message: 'Verification link is invalid or has expired.' })
    }

    user.isVerified          = true
    user.verificationToken   = null
    user.verificationExpires = null
    await user.save()

    res.json({ message: 'Email verified successfully! You can now log in.' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// ── Login ─────────────────────────────────────────────────────────────────────
const login = async (req, res) => {
  try {
    const { email, password } = req.body

    const user = await User.findOne({ email }).select('+password +verificationToken +verificationExpires +failedLoginAttempts +lockUntil')
    if (!user)           return res.status(401).json({ message: 'Invalid credentials' })
    if (!user.isActive)  return res.status(403).json({ message: 'Account deactivated' })
    if (!user.isVerified) return res.status(403).json({ message: 'Please verify your email before logging in.' })

    // ── Account lockout check ─────────────────────────────────────────────
    if (user.lockUntil && user.lockUntil > Date.now()) {
      return res.status(423).json({ message: 'Account locked due to too many failed attempts. Try again in 15 minutes.' })
    }

    const match = await user.matchPassword(password)

    if (!match) {
      user.failedLoginAttempts += 1
      if (user.failedLoginAttempts >= 5) {
        user.lockUntil = new Date(Date.now() + 15 * 60 * 1000)
      }
      await user.save()
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    // ── Success — reset lockout fields ─────────────────────────────────────
    user.failedLoginAttempts = 0
    user.lockUntil = null
    await user.save()

    const token = signToken(user._id)
    res.json({ token, user: user.toJSON() })

  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// ── Get current user ──────────────────────────────────────────────────────────
const getMe = async (req, res) => {
  res.json(req.user)
}

module.exports = { register, verifyEmail, login, getMe }
