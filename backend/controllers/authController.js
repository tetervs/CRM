const jwt = require('jsonwebtoken')
const User = require('../models/User')

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' })

// ── Login ─────────────────────────────────────────────────────────────────────
const login = async (req, res) => {
  try {
    const { email, password } = req.body

    const user = await User.findOne({ email }).select('+password')
    if (!user)           return res.status(401).json({ message: 'Invalid credentials' })
    if (!user.isActive)  return res.status(403).json({ message: 'Account deactivated' })

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

// ── Change password (auth required, knows current password) ──────────────────
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'currentPassword and newPassword are required' })
    }
    if (newPassword.length < 6 || newPassword.length > 128) {
      return res.status(400).json({ message: 'New password must be 6–128 characters' })
    }

    const user = await User.findById(req.user._id).select('+password')
    const match = await user.matchPassword(currentPassword)
    if (!match) return res.status(400).json({ message: 'Current password is incorrect' })

    user.password = newPassword
    user.mustChangePassword = false
    await user.save()
    res.json({ message: 'Password updated successfully' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// ── First-time forced password change ────────────────────────────────────────
// For admin-created accounts (mustChangePassword=true). User is already
// authenticated via the temp password, so only the new password is required.
const changePasswordFirstTime = async (req, res) => {
  try {
    const { newPassword } = req.body
    if (!newPassword) {
      return res.status(400).json({ message: 'newPassword is required' })
    }
    if (newPassword.length < 6 || newPassword.length > 128) {
      return res.status(400).json({ message: 'New password must be 6–128 characters' })
    }

    const user = await User.findById(req.user._id).select('+password')
    user.password = newPassword
    user.mustChangePassword = false
    await user.save()
    res.json({ message: 'Password updated successfully', user: user.toJSON() })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

module.exports = { login, getMe, changePassword, changePasswordFirstTime }
