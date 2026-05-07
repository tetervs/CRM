const router = require('express').Router()
const {
  getProjects, getProject, updateProjectStatus,
  addProgressUpdate, logExpense, completeProject,
} = require('../controllers/projectController')
const { getProjectPulls, createProjectPull } = require('../controllers/manpowerController')
const { protect } = require('../middleware/authMiddleware')
const { requireRole } = require('../middleware/roleMiddleware')
const { projectStatusRules, progressUpdateRules, expenseRules, mongoId } = require('../middleware/validators')
const validate = require('../middleware/validate')

router.use(protect)

router.get('/',                                           getProjects)
router.get('/:id',           mongoId(), validate,         getProject)
router.patch('/:id/status',  [mongoId(), ...projectStatusRules],  validate, updateProjectStatus)
router.post('/:id/progress', [mongoId(), ...progressUpdateRules], validate, addProgressUpdate)
router.post('/:id/expenses', [mongoId(), ...expenseRules],        validate, logExpense)
router.patch('/:id/complete',  mongoId(), validate, requireRole('finance_head', 'admin'), completeProject)
router.get('/:id/manpower',  mongoId(), validate, getProjectPulls)
router.post('/:id/manpower', mongoId(), validate, createProjectPull)

module.exports = router
