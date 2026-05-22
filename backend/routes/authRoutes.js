const router = require('express').Router()
const { login, getMe, changePassword, changePasswordFirstTime } = require('../controllers/authController')
const { protect } = require('../middleware/authMiddleware')
const { authLimiter } = require('../middleware/rateLimiter')
const { loginRules } = require('../middleware/validators')
const validate = require('../middleware/validate')

router.post('/login',                       /*authLimiter,*/ loginRules, validate, login)
router.get('/me',                           protect, getMe)
router.post('/change-password',             protect, changePassword)
router.post('/change-password-first-time',  protect, changePasswordFirstTime)

module.exports = router
