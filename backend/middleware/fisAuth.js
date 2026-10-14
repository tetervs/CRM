// FIS authorization keys off user.fisRole only — never user.role.
const requireFisRole = (...fisRoles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'Not authorized' })
  if (!fisRoles.includes(req.user.fisRole)) {
    return res.status(403).json({ message: 'Access denied' })
  }
  next()
}

module.exports = { requireFisRole }
