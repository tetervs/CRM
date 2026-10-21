const router = require('express').Router()
const { getUsers, getManagers, getUser, createUser, updateRole, updateUser, deleteUser, hardDeleteUser, resetPassword } = require('../controllers/userController')
const { protect } = require('../middleware/authMiddleware')
const { requireRole } = require('../middleware/roleMiddleware')
const { createUserRules, updateUserRules, updateRoleRules, mongoId } = require('../middleware/validators')
const validate = require('../middleware/validate')

router.use(protect)

router.get('/managers', getManagers)
router.get('/',         getUsers)
router.post('/',        createUserRules, validate, requireRole('head', 'admin'), createUser)
router.get('/:id',      mongoId(), validate, requireRole('head', 'admin'), getUser)
router.put('/:id/role', updateRoleRules, validate, requireRole('head', 'admin'), updateRole)
router.patch('/:id',    updateUserRules, validate, requireRole('head', 'admin'), updateUser)
router.post('/:id/reset-password', mongoId(), validate, requireRole('head', 'admin'), resetPassword)
router.delete('/:id/permanent', mongoId(), validate, requireRole('head'), hardDeleteUser)
router.delete('/:id',   mongoId(), validate, requireRole('head', 'admin'), deleteUser)

module.exports = router
