const router = require('express').Router()
const c = require('../controllers/fisController')
const q = require('../controllers/fisQcController')
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

// QC. Reads: fis_admin or the case's lead/support (checked in the controller). Writes: fis_admin only.
router.get('/cases/:id/qc',                  q.getQc)
router.post('/cases/:id/qc',                 admin, q.startQc)
router.patch('/cases/:id/qc',                admin, q.updateQc)
router.post('/cases/:id/qc/subjects',        admin, q.addSubject)
router.delete('/cases/:id/qc/subjects/:sid', admin, q.removeSubject)
router.put('/cases/:id/qc/items/:key',       admin, q.setItem)
router.post('/cases/:id/qc/send-back',       admin, q.sendBack)
router.post('/cases/:id/qc/pass',            admin, q.passQc)
router.post('/cases/:id/qc/reopen',          admin, q.reopenQc)

// QC template (versioned; each edit creates a new version)
router.get('/qc-template',                   admin, q.getTemplate)
router.post('/qc-template/items',            admin, q.addItem)
router.patch('/qc-template/items/:code',     admin, q.editItem)
router.delete('/qc-template/items/:code',    admin, q.removeItem)
router.post('/qc-template/sections',         admin, q.addSection)
router.put('/qc-template/case-types',        admin, q.setCaseTypeMap)

module.exports = router
