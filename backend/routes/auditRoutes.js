const router    = require('express').Router()
const { protect }      = require('../middleware/authMiddleware')
const { requireRole }  = require('../middleware/roleMiddleware')
const ExportAuditLog   = require('../models/ExportAuditLog')

router.use(protect)
router.use(requireRole('finance_head', 'admin'))

router.get('/exports', async (req, res) => {
  try {
    const { userId, exportType, from, to, page = 1, limit = 50 } = req.query

    const filter = {}
    if (userId)     filter.userId     = userId
    if (exportType) filter.exportType = exportType
    if (from || to) {
      filter.createdAt = {}
      if (from) filter.createdAt.$gte = new Date(from)
      if (to)   filter.createdAt.$lte = new Date(to)
    }

    const skip  = (Number(page) - 1) * Number(limit)
    const [logs, total] = await Promise.all([
      ExportAuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      ExportAuditLog.countDocuments(filter),
    ])

    res.json({ logs, total, page: Number(page), pages: Math.ceil(total / Number(limit)) })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router
