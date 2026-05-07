const router = require('express').Router()
const { getMilestones, createMilestone, updateMilestone, deleteMilestone } = require('../controllers/milestoneController')
const { protect } = require('../middleware/authMiddleware')
const { requireRole } = require('../middleware/roleMiddleware')
const { mongoId } = require('../middleware/validators')
const validate = require('../middleware/validate')

router.use(protect)

router.get('/project/:projectId',  mongoId('projectId'), validate, getMilestones)
router.post('/',                   requireRole('finance_head', 'admin', 'manager'), createMilestone)
router.patch('/:id',               [mongoId(), requireRole('finance_head', 'admin', 'manager')], validate, updateMilestone)
router.delete('/:id',              [mongoId(), requireRole('finance_head', 'admin')],             validate, deleteMilestone)

module.exports = router
