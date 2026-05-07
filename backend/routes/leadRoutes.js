const router = require('express').Router()
const { getLeads, createLead, getLead, updateLead, deleteLead, updateStatus, convertToProject } = require('../controllers/leadController')
const { protect } = require('../middleware/authMiddleware')
const { requireRole } = require('../middleware/roleMiddleware')
const { createLeadRules, updateLeadRules, statusRules, convertLeadRules, mongoId } = require('../middleware/validators')
const validate = require('../middleware/validate')

router.use(protect)
router.use(requireRole('finance_head', 'admin', 'manager', 'sales'))

router.get('/',           getLeads)
router.post('/',          createLeadRules, validate, createLead)
router.get('/:id',        mongoId(), validate, getLead)
router.put('/:id',        updateLeadRules, validate, updateLead)
router.delete('/:id',     mongoId(), validate, requireRole('admin'), deleteLead)
router.patch('/:id/status', statusRules, validate, updateStatus)
router.post('/:id/convert', convertLeadRules, validate, requireRole('finance_head', 'admin'), convertToProject)

module.exports = router
