const router = require('express').Router()
const { overview, pipeline, performance, trend, userPerformance } = require('../controllers/analyticsController')
const { protect } = require('../middleware/authMiddleware')
const { requireRole } = require('../middleware/roleMiddleware')
const { mongoId } = require('../middleware/validators')
const validate = require('../middleware/validate')

router.use(protect)
router.use(requireRole('head', 'admin'))

router.get('/overview',     overview)
router.get('/pipeline',     pipeline)
router.get('/performance',            requireRole('head', 'admin'), performance)
router.get('/performance/:userId',    mongoId('userId'), validate, requireRole('head', 'admin'), userPerformance)
router.get('/trend',                  trend)

module.exports = router