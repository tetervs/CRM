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
router.post('/',   upload.array('proofFiles', 10), createReimbursement)
router.get('/:id', mongoId(), validate, getReimbursement)

router.patch('/:id/head-approve',
  mongoId(), validate,
  requireRole('finance_head', 'admin', 'manager'),
  headApprove)

router.patch('/:id/finance-approve',
  mongoId(), validate,
  requireRole('finance_head', 'admin'),
  financeApprove)

router.patch('/:id/reject',
  reimbursementActionRules, validate,
  requireRole('finance_head', 'admin', 'manager'),
  rejectReimbursement)

router.patch('/:id/pay',
  mongoId(), validate,
  requireRole('finance_head', 'admin'),
  markPaid)

module.exports = router
