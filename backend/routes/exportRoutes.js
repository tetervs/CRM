const router  = require('express').Router()
const { exportReimbursements, exportLeadPdf, exportProjectPdf, exportAnalytics } = require('../controllers/exportController')
const { protect }      = require('../middleware/authMiddleware')
const { requireRole }  = require('../middleware/roleMiddleware')
const { mongoId }      = require('../middleware/validators')
const validate         = require('../middleware/validate')
const {
  reimbursementExportLimiter,
  leadPdfLimiter,
  projectPdfLimiter,
  analyticsExportLimiter,
} = require('../middleware/rateLimiter')

router.use(protect)

// Reimbursements: any authenticated user (filter limits visibility)
router.get('/reimbursements',
  reimbursementExportLimiter,
  exportReimbursements
)

// Lead PDF: same role gate as the lead list route (no employee access)
router.get('/leads/:leadId',
  requireRole('head', 'admin', 'manager', 'sales'),
  mongoId('leadId'), validate,
  leadPdfLimiter,
  exportLeadPdf
)

// Project PDF: any authenticated user (access check inside handler)
router.get('/projects/:projectId',
  mongoId('projectId'), validate,
  projectPdfLimiter,
  exportProjectPdf
)

// Analytics XLSX: same role gate as the Analytics page itself
router.get('/analytics',
  requireRole('head', 'admin', 'ca'),
  analyticsExportLimiter,
  exportAnalytics
)

module.exports = router
