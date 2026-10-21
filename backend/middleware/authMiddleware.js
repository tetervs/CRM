const jwt = require('jsonwebtoken')
const User = require('../models/User')

const protect = async (req, res, next) => {
  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Not authorized — no token' })
  }

  const token = auth.split(' ')[1]
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const user = await User.findById(decoded.id).select('-password')
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Not authorized — user inactive or not found' })
    }
    // `t` is the ms-precision issue time (see signToken); older tokens fall back to iat seconds.
    if (user.passwordChangedAt && (decoded.t ?? decoded.iat * 1000) < user.passwordChangedAt.getTime()) {
      return res.status(401).json({ message: 'Not authorized — password changed, please log in again' })
    }
    req.user = user
    // fisRole is only visible to FIS users: strip it from every JSON response for everyone else.
    if (!user.fisRole) {
      res.json = (body) => res.type('json').send(JSON.stringify(body, (k, v) => (k === 'fisRole' && !res.locals.keepFisRole ? undefined : v)))
    }
    next()
  } catch {
    return res.status(401).json({ message: 'Not authorized — invalid token' })
  }
}

module.exports = { protect }
