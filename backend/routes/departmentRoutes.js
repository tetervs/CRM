const router = require('express').Router()
const { getDepartments, createDepartment, updateDepartment, toggleDepartment } = require('../controllers/departmentController')
const { protect } = require('../middleware/authMiddleware')
const { requireRole } = require('../middleware/roleMiddleware')
const { departmentCreateRules, departmentUpdateRules, mongoId } = require('../middleware/validators')
const validate = require('../middleware/validate')

router.use(protect)

router.get('/',               getDepartments)
router.post('/',              departmentCreateRules, validate, requireRole('finance_head', 'admin'), createDepartment)
router.put('/:id',            departmentUpdateRules, validate, requireRole('finance_head', 'admin'), updateDepartment)
router.patch('/:id/toggle',   mongoId(), validate, requireRole('finance_head', 'admin'), toggleDepartment)

module.exports = router
