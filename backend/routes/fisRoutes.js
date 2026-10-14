const router = require('express').Router()
const c = require('../controllers/fisController')
const { protect } = require('../middleware/authMiddleware')
const { requireFisRole } = require('../middleware/fisAuth')

// Gate the whole router first so even unknown /api/fis/* paths answer 403 to non-FIS users.
router.use(protect, requireFisRole('fis_admin', 'fis_member'))

const admin = requireFisRole('fis_admin')

router.get('/config',    c.getConfig)
router.put('/config',    admin, c.updateConfig)
router.get('/people',    c.getPeople)
router.get('/cases',     c.listCases)
router.post('/cases',    c.createCase)
router.get('/cases/:id', c.getCase)
router.put('/cases/:id', c.updateCase)
router.patch('/cases/:id', c.updateCase)
router.get('/dashboard', admin, c.dashboard)
router.get('/report',    admin, c.report)

module.exports = router
