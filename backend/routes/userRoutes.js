const router = require('express').Router()
const { getUsers, getManagers, getUser, createUser, updateRole, deleteUser } = require('../controllers/userController')
const { protect } = require('../middleware/authMiddleware')
const { requireRole } = require('../middleware/roleMiddleware')
const { createUserRules, updateRoleRules, mongoId } = require('../middleware/validators')
const validate = require('../middleware/validate')

router.use(protect)

router.get('/managers', getManagers)
router.get('/',         getUsers)
router.post('/',        createUserRules, validate, requireRole('finance_head', 'admin'), createUser)
router.get('/:id',      mongoId(), validate, requireRole('finance_head', 'admin'), getUser)
router.put('/:id/role', updateRoleRules, validate, requireRole('finance_head', 'admin'), updateRole)
router.delete('/:id',   mongoId(), validate, requireRole('finance_head', 'admin'), deleteUser)

module.exports = router
