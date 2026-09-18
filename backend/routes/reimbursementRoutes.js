const router = require('express').Router()
const {
  getReimbursements, createReimbursement, getReimbursement,
  headApprove, financeApprove, rejectReimbursement, markPaid,
} = require('../controllers/reimbursementController')
const { protect } = require('../middleware/authMiddleware')
const { requireRole } = require('../middleware/roleMiddleware')
const { reimbursementActionRules, mongoId } = require('../middleware/validators')
const validate = require('../middleware/validate')
const upload = require('../middleware/upload')

router.use(protect)

router.get('/',    getReimbursements)
// upload.any() — field names are dynamic (proof_<clientId>, one per item), not static.
// limits/fileFilter (5MB/file, image mimetypes only) still apply from the shared multer instance.
router.post('/',   upload.any(), createReimbursement)
router.get('/:id', mongoId(), validate, getReimbursement)

router.patch('/:id/head-approve',
  mongoId(), validate,
  requireRole('head', 'admin', 'manager'),
  headApprove)

router.patch('/:id/finance-approve',
  mongoId(), validate,
  requireRole('head', 'admin', 'ca'),
  financeApprove)

router.patch('/:id/reject',
  reimbursementActionRules, validate,
  requireRole('head', 'admin', 'manager', 'ca'),
  rejectReimbursement)

router.patch('/:id/pay',
  mongoId(), validate,
  requireRole('head', 'admin', 'ca'),
  markPaid)

module.exports = router
