const router = require('express').Router()
const { register, verifyEmail, login, getMe, changePassword, forgotPassword, resetPassword } = require('../controllers/authController')
const { protect } = require('../middleware/authMiddleware')
const { authLimiter } = require('../middleware/rateLimiter')
const { registerRules, loginRules } = require('../middleware/validators')
const validate = require('../middleware/validate')

// Open registration — domain restriction enforced in registerRules validator
router.post('/register',         /*authLimiter,*/ registerRules, validate, register)
router.post('/login',            /*authLimiter,*/ loginRules,    validate, login)
router.get('/verify/:token',     verifyEmail)
router.get('/me',                protect, getMe)
router.post('/change-password',  protect, changePassword)
router.post('/forgot-password',  forgotPassword)
router.post('/reset-password',   resetPassword)

module.exports = router
