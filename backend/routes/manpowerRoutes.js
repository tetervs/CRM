const router = require('express').Router()
const { createPull, getPulls } = require('../controllers/manpowerController')
const { protect } = require('../middleware/authMiddleware')
const { requireRole } = require('../middleware/roleMiddleware')

router.use(protect)

router.get('/',  requireRole('finance_head', 'admin'), getPulls)
router.post('/', requireRole('finance_head', 'admin', 'manager'), createPull)

module.exports = router
