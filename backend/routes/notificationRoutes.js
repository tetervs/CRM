const router = require('express').Router()
const { getNotifications, markRead, markAllRead } = require('../controllers/notificationController')
const { protect } = require('../middleware/authMiddleware')
const { mongoId } = require('../middleware/validators')
const validate = require('../middleware/validate')

router.use(protect)

router.get('/',              getNotifications)
router.patch('/read-all',    markAllRead)
router.patch('/:id/read',    mongoId(), validate, markRead)

module.exports = router
