const router = require('express').Router()
const { getUsers, getUser, updateRole, deleteUser } = require('../controllers/userController')
const { protect } = require('../middleware/authMiddleware')
const { requireRole } = require('../middleware/roleMiddleware')
const { updateRoleRules, mongoId } = require('../middleware/validators')
const validate = require('../middleware/validate')

router.use(protect)

router.get('/',       getUsers)
router.get('/:id',    mongoId(), validate, requireRole('finance_head', 'admin'), getUser)
router.put('/:id/role', updateRoleRules, validate, requireRole('finance_head', 'admin'), updateRole)
router.delete('/:id', mongoId(), validate, requireRole('finance_head', 'admin'), deleteUser)

module.exports = router
