const Reimbursement = require('../models/Reimbursement')
const Project = require('../models/Project')
const User = require('../models/User')
const { createNotification } = require('../utils/notify')
const { buildReimbursementFilter } = require('../utils/exportFilters')
const { buildApprovalChain, currentChainStep, isStepActor } = require('../utils/approvalChain')

const PRIVILEGED = ['head', 'admin', 'ca']

// Reject's floor mirrors each role's only other action on the flow: a manager can only
// reject what they'd otherwise head-approve (Pending), ca only what she'd otherwise
// finance-approve (Head Approved). head/admin have no floor — full authority throughout.
// Legacy-flow only — reimbursements with an approvalChain use isStepActor instead.
const REJECT_FLOOR = { manager: 'Pending', ca: 'Head Approved' }

const populateFields = 'submittedBy headReviewedBy financeReviewedBy paidBy currentApprover approvalChain.user approvalChain.reviewedBy'

// Notifies whoever the chain's current step designates: the specific person for
// a person-anchored step, or every active ca-role user for a role-anchored one
// (ca / caPay — there's usually exactly one, but the step doesn't assume that).
const notifyCurrentStep = async (reimbursement, message) => {
  const step = currentChainStep(reimbursement.approvalChain)
  if (!step) return
  if (step.user) {
    createNotification({ recipientId: step.user, message, type: 'reimbursement', link: `/reimbursements/${reimbursement._id}` })
    return
  }
  const caUsers = await User.find({ role: 'ca', isActive: true }).select('_id')
  caUsers.forEach((u) => {
    createNotification({ recipientId: u._id, message, type: 'reimbursement', link: `/reimbursements/${reimbursement._id}` })
  })
}

const getReimbursements = async (req, res) => {
  try {
    const filter = buildReimbursementFilter(req.user)

    const reimbursements = await Reimbursement.find(filter)
      .populate('submittedBy', 'name email role')
      .populate('headReviewedBy', 'name')
      .populate('financeReviewedBy', 'name')
      .populate('paidBy', 'name')
      .populate('currentApprover', 'name role')
      .sort({ createdAt: -1 })

    res.json(reimbursements)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

const createReimbursement = async (req, res) => {
  try {
    let items
    try {
      items = typeof req.body.items === 'string' ? JSON.parse(req.body.items) : req.body.items
    } catch {
      return res.status(400).json({ message: 'items must be a valid JSON array' })
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'At least one item is required' })
    }

    // Matches the upload middleware's 10-file cap — every item now needs its own
    // proof image, so the item limit can't exceed how many files a request can carry.
    if (items.length > 10) {
      return res.status(400).json({ message: 'A reimbursement cannot have more than 10 items' })
    }

    const invalidItem = items.find((i) => !i.description?.trim() || !(Number(i.amount) > 0))
    if (invalidItem) {
      return res.status(400).json({ message: 'Each item needs a description and amount greater than 0' })
    }

    const longDesc = items.find((i) => i.description.trim().length > 200)
    if (longDesc) {
      return res.status(400).json({ message: 'Item description must be at most 200 characters' })
    }

    const missingClientId = items.find((i) => !i.clientId || typeof i.clientId !== 'string')
    if (missingClientId) {
      return res.status(400).json({ message: 'Each item must reference its proof upload' })
    }

    const uniqueClientIds = new Set(items.map((i) => i.clientId))
    if (uniqueClientIds.size !== items.length) {
      return res.status(400).json({ message: 'Each item must have a unique proof reference' })
    }

    // Match uploaded files back to items by clientId, not position — item order/count
    // in the form can change independently of anything else, so array index isn't a
    // safe key. Every item needs exactly one proof file, and no extra/orphaned files.
    const files = req.files || []
    if (files.length !== items.length) {
      return res.status(400).json({ message: 'Each expense item requires exactly one proof image' })
    }

    const fileByClientId = new Map()
    for (const file of files) {
      const match = /^proof_(.+)$/.exec(file.fieldname)
      if (!match) {
        return res.status(400).json({ message: `Unexpected upload field: ${file.fieldname}` })
      }
      fileByClientId.set(match[1], file)
    }

    const validItems = items.map((i) => {
      const file = fileByClientId.get(i.clientId)
      if (!file) return null
      return { description: i.description, amount: Number(i.amount), proofFile: file.secure_url }
    })
    if (validItems.some((i) => i === null)) {
      return res.status(400).json({ message: 'Proof image missing for one or more items' })
    }

    const { notes, projectId } = req.body
    if (notes && notes.length > 1000) {
      return res.status(400).json({ message: 'Notes must be at most 1000 characters' })
    }

    const mongoose = require('mongoose')
    if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ message: 'A project is required' })
    }

    const project = await Project.findById(projectId).populate('projectHead', 'role manager')
    if (!project) {
      return res.status(400).json({ message: 'Project not found' })
    }

    // ── Build the approval chain ────────────────────────────────────────────
    const projectHead = project.projectHead
    let projectHeadManager = null
    if (!['admin', 'head', 'manager'].includes(projectHead.role)) {
      if (!projectHead.manager) {
        return res.status(400).json({
          message: "This project's head has no manager assigned — required before reimbursements can be submitted against this project.",
        })
      }
      projectHeadManager = await User.findById(projectHead.manager)
    }

    const overallApprover = await User.findOne({ isOverallApprover: true, isActive: true })
    if (!overallApprover) {
      return res.status(500).json({ message: 'No overall approver is configured — contact an admin.' })
    }

    const approvalChain = buildApprovalChain({
      projectHead,
      projectHeadManager,
      overallApprover,
      submittedById: req.user._id,
    })
    const firstStep = currentChainStep(approvalChain)

    const totalAmount = validItems.reduce((sum, item) => sum + Number(item.amount), 0)

    const reimbursement = await Reimbursement.create({
      submittedBy:     req.user._id,
      items:           validItems,
      totalAmount,
      notes,
      project:         projectId,
      approvalChain,
      currentApprover: firstStep?.user || null,
    })
    await reimbursement.populate('submittedBy', 'name email role')

    await notifyCurrentStep(reimbursement, `New reimbursement request from ${req.user.name} needs your approval`)

    res.status(201).json(reimbursement)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

const getReimbursement = async (req, res) => {
  try {
    const reimbursement = await Reimbursement.findById(req.params.id)
      .populate('submittedBy', 'name email role')
      .populate('headReviewedBy', 'name')
      .populate('financeReviewedBy', 'name')
      .populate('paidBy', 'name')
      .populate('currentApprover', 'name email role')
      .populate('approvalChain.user', 'name email role')
      .populate('approvalChain.reviewedBy', 'name')

    if (!reimbursement) return res.status(404).json({ message: 'Reimbursement not found' })

    const { role, _id } = req.user
    const isOwner = reimbursement.submittedBy._id.toString() === _id.toString()
    const isChainParticipant = reimbursement.approvalChain?.some(
      (s) => s.user && s.user._id.toString() === _id.toString()
    )
    if (!PRIVILEGED.includes(role) && role !== 'manager' && !isOwner && !isChainParticipant) {
      return res.status(403).json({ message: 'Access denied' })
    }

    res.json(reimbursement)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

const isSelf = (reimbursement, userId) => reimbursement.submittedBy.toString() === userId.toString()

// Resolves the current step for a chain-based reimbursement and checks whether
// req.user may act on it right now, for an action restricted to `allowedStepRoles`
// (pass null — used by reject — to allow whatever the current step is). Returns
// the step on success, or sends the error response itself and returns null.
const resolveActionableStep = (req, res, reimbursement, allowedStepRoles) => {
  const step = currentChainStep(reimbursement.approvalChain)
  if (!step || (allowedStepRoles && !allowedStepRoles.includes(step.role))) {
    res.status(400).json({ message: 'This reimbursement is not at a stage this action applies to' })
    return null
  }
  if (isSelf(reimbursement, req.user._id)) {
    res.status(403).json({ message: 'You cannot act on your own reimbursement' })
    return null
  }
  if (!isStepActor(step, req.user)) {
    res.status(403).json({ message: 'It is not your turn to act on this reimbursement' })
    return null
  }
  return step
}

const headApprove = async (req, res) => {
  try {
    const reimbursement = await Reimbursement.findById(req.params.id)
    if (!reimbursement) return res.status(404).json({ message: 'Reimbursement not found' })

    // ── Chain-based reimbursement: approves whichever non-CA step is current
    // (project head, their manager, or the overall approver — all person-anchored). ──
    if (reimbursement.approvalChain?.length) {
      const step = resolveActionableStep(req, res, reimbursement, ['projectHead', 'projectHeadManager', 'overallApprover'])
      if (!step) return

      step.status = 'Approved'
      step.reviewedBy = req.user._id
      step.reviewedAt = new Date()
      const next = currentChainStep(reimbursement.approvalChain)
      reimbursement.currentApprover = next?.user || null
      await reimbursement.save()
      await reimbursement.populate(populateFields, 'name email role')

      createNotification({
        recipientId: reimbursement.submittedBy._id,
        message:     `Your reimbursement request has been approved (${step.label})`,
        type:        'reimbursement',
        link:        `/reimbursements/${reimbursement._id}`,
      })
      if (next) await notifyCurrentStep(reimbursement, 'A reimbursement needs your approval')

      return res.json(reimbursement)
    }

    // ── Legacy flat flow — pre-chain reimbursements only ──────────────────────
    if (!['head', 'admin', 'manager'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' })
    }
    if (isSelf(reimbursement, req.user._id)) {
      return res.status(403).json({ message: 'You cannot approve your own reimbursement' })
    }
    if (reimbursement.status !== 'Pending') {
      return res.status(400).json({ message: 'Only Pending reimbursements can be head-approved' })
    }

    reimbursement.status = 'Head Approved'
    reimbursement.headReviewedBy = req.user._id
    reimbursement.headReviewedAt = new Date()
    await reimbursement.save()
    await reimbursement.populate(populateFields, 'name email role')

    createNotification({
      recipientId: reimbursement.submittedBy._id,
      message:     `Your reimbursement request has been head-approved`,
      type:        'reimbursement',
      link:        `/reimbursements/${reimbursement._id}`,
    })

    // Route to the approving manager's own head for final approval.
    // (req.user.manager is null for head/admin, who can finance-approve directly.)
    if (req.user.manager) {
      createNotification({
        recipientId: req.user.manager,
        message:     `A reimbursement from ${reimbursement.submittedBy.name} needs final approval`,
        type:        'reimbursement',
        link:        `/reimbursements/${reimbursement._id}`,
      })
    }
    res.json(reimbursement)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

const financeApprove = async (req, res) => {
  try {
    const reimbursement = await Reimbursement.findById(req.params.id)
    if (!reimbursement) return res.status(404).json({ message: 'Reimbursement not found' })

    // ── Chain-based: CA's review step. Distinct from markPaid on purpose — an
    // audit trail that separates "reviewed and accepted" from "actually paid". ──
    if (reimbursement.approvalChain?.length) {
      const step = resolveActionableStep(req, res, reimbursement, ['ca'])
      if (!step) return

      step.status = 'Approved'
      step.reviewedBy = req.user._id
      step.reviewedAt = new Date()
      const next = currentChainStep(reimbursement.approvalChain) // the caPay step
      reimbursement.currentApprover = next?.user || null
      await reimbursement.save()
      await reimbursement.populate(populateFields, 'name email role')

      createNotification({
        recipientId: reimbursement.submittedBy._id,
        message:     `Your reimbursement request has been finance-approved`,
        type:        'reimbursement',
        link:        `/reimbursements/${reimbursement._id}`,
      })
      if (next) await notifyCurrentStep(reimbursement, 'A reimbursement is ready to mark as paid')

      return res.json(reimbursement)
    }

    // ── Legacy flat flow — pre-chain reimbursements only ──────────────────────
    if (!['head', 'admin', 'ca'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' })
    }
    if (isSelf(reimbursement, req.user._id)) {
      return res.status(403).json({ message: 'You cannot approve your own reimbursement' })
    }
    if (reimbursement.status !== 'Head Approved') {
      return res.status(400).json({ message: 'Only Head Approved reimbursements can be finance-approved' })
    }

    reimbursement.status = 'Finance Approved'
    reimbursement.financeReviewedBy = req.user._id
    reimbursement.financeReviewedAt = new Date()
    await reimbursement.save()
    await reimbursement.populate(populateFields, 'name email role')

    createNotification({
      recipientId: reimbursement.submittedBy._id,
      message:     `Your reimbursement request has been finance-approved`,
      type:        'reimbursement',
      link:        `/reimbursements/${reimbursement._id}`,
    })
    res.json(reimbursement)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

const rejectReimbursement = async (req, res) => {
  try {
    const reimbursement = await Reimbursement.findById(req.params.id)
    if (!reimbursement) return res.status(404).json({ message: 'Reimbursement not found' })
    if (['Paid', 'Rejected'].includes(reimbursement.status)) {
      return res.status(400).json({ message: 'Cannot reject a paid or already rejected reimbursement' })
    }

    // ── Chain-based: whoever currently holds the ball can reject instead of
    // approving, at any step — including CA. ──────────────────────────────────
    if (reimbursement.approvalChain?.length) {
      const step = resolveActionableStep(req, res, reimbursement, null)
      if (!step) return

      step.status = 'Rejected'
      step.reviewedBy = req.user._id
      step.reviewedAt = new Date()
      reimbursement.status = 'Rejected'
      reimbursement.rejectionReason = req.body.reason || ''
      reimbursement.currentApprover = null
      await reimbursement.save()
      await reimbursement.populate(populateFields, 'name email role')

      createNotification({
        recipientId: reimbursement.submittedBy._id,
        message:     `Your reimbursement request has been rejected`,
        type:        'reimbursement',
        link:        `/reimbursements/${reimbursement._id}`,
      })

      return res.json(reimbursement)
    }

    // ── Legacy flat flow — pre-chain reimbursements only ──────────────────────
    if (isSelf(reimbursement, req.user._id)) {
      return res.status(403).json({ message: 'You cannot reject your own reimbursement' })
    }
    if (!['head', 'admin', 'manager', 'ca'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' })
    }
    const floor = REJECT_FLOOR[req.user.role]
    if (floor && reimbursement.status !== floor) {
      return res.status(400).json({ message: `Only ${floor} reimbursements can be rejected at this stage` })
    }

    reimbursement.status = 'Rejected'
    reimbursement.rejectionReason = req.body.reason || ''
    await reimbursement.save()
    await reimbursement.populate(populateFields, 'name email role')

    createNotification({
      recipientId: reimbursement.submittedBy._id,
      message:     `Your reimbursement request has been rejected`,
      type:        'reimbursement',
      link:        `/reimbursements/${reimbursement._id}`,
    })
    res.json(reimbursement)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

const markPaid = async (req, res) => {
  try {
    const reimbursement = await Reimbursement.findById(req.params.id)
    if (!reimbursement) return res.status(404).json({ message: 'Reimbursement not found' })

    // ── Chain-based: the terminal step. Only ca, no one else, at any point —
    // same rule as the legacy branch below, just chain-driven instead of status-driven. ──
    if (reimbursement.approvalChain?.length) {
      const step = resolveActionableStep(req, res, reimbursement, ['caPay'])
      if (!step) return

      step.status = 'Approved'
      step.reviewedBy = req.user._id
      step.reviewedAt = new Date()
      reimbursement.status = 'Paid'
      reimbursement.paidBy = req.user._id
      reimbursement.paidAt = new Date()
      reimbursement.currentApprover = null
      await reimbursement.save()
      await reimbursement.populate(populateFields, 'name email role')

      createNotification({
        recipientId: reimbursement.submittedBy._id,
        message:     `Your reimbursement has been paid`,
        type:        'reimbursement',
        link:        `/reimbursements/${reimbursement._id}`,
      })

      return res.json(reimbursement)
    }

    // ── Legacy flat flow — pre-chain reimbursements only. CA only, no one else,
    // at any point — same absolute rule as the chain path above. ─────────────
    if (req.user.role !== 'ca') {
      return res.status(403).json({ message: 'Access denied' })
    }
    if (isSelf(reimbursement, req.user._id)) {
      return res.status(403).json({ message: 'You cannot mark your own reimbursement as paid' })
    }
    if (reimbursement.status !== 'Finance Approved') {
      return res.status(400).json({ message: 'Only Finance Approved reimbursements can be marked paid' })
    }

    reimbursement.status = 'Paid'
    reimbursement.paidBy = req.user._id
    reimbursement.paidAt = new Date()
    await reimbursement.save()
    await reimbursement.populate(populateFields, 'name email role')

    createNotification({
      recipientId: reimbursement.submittedBy._id,
      message:     `Your reimbursement has been paid`,
      type:        'reimbursement',
      link:        `/reimbursements/${reimbursement._id}`,
    })
    res.json(reimbursement)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

module.exports = { getReimbursements, createReimbursement, getReimbursement, headApprove, financeApprove, rejectReimbursement, markPaid }
