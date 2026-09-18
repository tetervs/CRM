const router = require('express').Router()
const {
  getReimbursements, createReimbursement, getReimbursement,
  headApprove, financeApprove, rejectReimbursement, markPaid,
} = require('../controllers/reimbursementController')
const { protect } = require('../middleware/authMiddleware')
const { reimbursementActionRules, mongoId } = require('../middleware/validators')
const validate = require('../middleware/validate')
const upload = require('../middleware/upload')

router.use(protect)

router.get('/',    getReimbursements)
// upload.any() — field names are dynamic (proof_<clientId>, one per item), not static.
// limits/fileFilter (5MB/file, image mimetypes only) still apply from the shared multer instance.
router.post('/',   upload.any(), createReimbursement)
router.get('/:id', mongoId(), validate, getReimbursement)

// No role() gate on these four — a chain-based reimbursement's actor can be any
// role (an ordinary employee project head, their manager, etc.), so the real
// authorization now happens inside each controller: the chain's isStepActor
// check for chain-based reimbursements, or a role check in the legacy branch
// for older ones with no chain. See resolveActionableStep in the controller.
router.patch('/:id/head-approve',    mongoId(), validate, headApprove)
router.patch('/:id/finance-approve', mongoId(), validate, financeApprove)
router.patch('/:id/reject',          reimbursementActionRules, validate, rejectReimbursement)
router.patch('/:id/pay',             mongoId(), validate, markPaid)

module.exports = router
