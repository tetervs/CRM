const router = require('express').Router()
const { getLeads, createLead, getLead, updateLead, deleteLead, updateStatus, convertToProject, getOverdueFollowups } = require('../controllers/leadController')
const { protect } = require('../middleware/authMiddleware')
const { requireRole } = require('../middleware/roleMiddleware')
const { createLeadRules, updateLeadRules, statusRules, convertLeadRules, mongoId } = require('../middleware/validators')
const validate = require('../middleware/validate')

router.use(protect)
// 'ca' is read-only across this whole router — added here for GET access, then
// explicitly excluded again on every mutating route below.
router.use(requireRole('head', 'admin', 'manager', 'sales', 'ca'))

router.get('/',                    getLeads)
router.get('/overdue-followups',   getOverdueFollowups)
router.post('/',                   createLeadRules, validate, requireRole('head', 'admin', 'manager', 'sales'), createLead)
router.get('/:id',                 mongoId(), validate, getLead)
router.put('/:id',        updateLeadRules, validate, requireRole('head', 'admin', 'manager', 'sales'), updateLead)
router.delete('/:id',     mongoId(), validate, requireRole('admin'), deleteLead)
router.patch('/:id/status', statusRules, validate, requireRole('head', 'admin', 'manager', 'sales'), updateStatus)
router.post('/:id/convert', convertLeadRules, validate, requireRole('head', 'admin'), convertToProject)

module.exports = router
