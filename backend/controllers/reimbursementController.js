const Reimbursement = require('../models/Reimbursement')
const Project = require('../models/Project')
const { sendReimbursementNotification } = require('../utils/mailer')
const { createNotification } = require('../utils/notify')
const { buildReimbursementFilter } = require('../utils/exportFilters')

const PRIVILEGED = ['finance_head', 'admin']

const populateFields = 'submittedBy headReviewedBy financeReviewedBy paidBy'

const getReimbursements = async (req, res) => {
  try {
    const filter = buildReimbursementFilter(req.user)

    const reimbursements = await Reimbursement.find(filter)
      .populate('submittedBy', 'name email role')
      .populate('headReviewedBy', 'name')
      .populate('financeReviewedBy', 'name')
      .populate('paidBy', 'name')
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

    if (items.length > 50) {
      return res.status(400).json({ message: 'A reimbursement cannot have more than 50 items' })
    }

    const invalidItem = items.find((i) => !i.description?.trim() || !(Number(i.amount) > 0))
    if (invalidItem) {
      return res.status(400).json({ message: 'Each item needs a description and amount greater than 0' })
    }
    const validItems = items

    const longDesc = items.find((i) => i.description.trim().length > 200)
    if (longDesc) {
      return res.status(400).json({ message: 'Item description must be at most 200 characters' })
    }

    const { notes, projectId } = req.body
    if (notes && notes.length > 1000) {
      return res.status(400).json({ message: 'Notes must be at most 1000 characters' })
    }

    if (projectId) {
      const mongoose = require('mongoose')
      if (!mongoose.Types.ObjectId.isValid(projectId)) {
        return res.status(400).json({ message: 'projectId must be a valid ID' })
      }
    }

    const totalAmount = validItems.reduce((sum, item) => sum + Number(item.amount), 0)
    const proofFiles  = (req.files || []).map((f) => f.path)

    const reimbursement = await Reimbursement.create({
      submittedBy: req.user._id,
      items: validItems.map((i) => ({ description: i.description, amount: Number(i.amount) })),
      totalAmount,
      notes,
      proofFiles,
      ...(projectId ? { project: projectId } : {}),
    })
    await reimbursement.populate('submittedBy', 'name email role')

    if (projectId) {
      const project = await Project.findById(projectId)
      if (project && project.projectHead) {
        createNotification({
          recipientId: project.projectHead,
          message:     `New reimbursement request submitted for project "${project.title}" by ${req.user.name}`,
          type:        'reimbursement',
          link:        `/reimbursements/${reimbursement._id}`,
        })
      }
    }

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

    if (!reimbursement) return res.status(404).json({ message: 'Reimbursement not found' })

    const { role, _id } = req.user
    const isOwner = reimbursement.submittedBy._id.toString() === _id.toString()
    if (!PRIVILEGED.includes(role) && role !== 'manager' && !isOwner) {
      return res.status(403).json({ message: 'Access denied' })
    }

    res.json(reimbursement)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

const notify = async (reimbursement, event) => {
  try {
    await sendReimbursementNotification(
      reimbursement.submittedBy.email,
      reimbursement.submittedBy.name,
      event,
      reimbursement,
    )
  } catch (_) {}
}

const headApprove = async (req, res) => {
  try {
    const reimbursement = await Reimbursement.findById(req.params.id)
    if (!reimbursement) return res.status(404).json({ message: 'Reimbursement not found' })
    if (reimbursement.status !== 'Pending') {
      return res.status(400).json({ message: 'Only Pending reimbursements can be head-approved' })
    }

    reimbursement.status = 'Head Approved'
    reimbursement.headReviewedBy = req.user._id
    reimbursement.headReviewedAt = new Date()
    await reimbursement.save()
    await reimbursement.populate(populateFields, 'name email role')

    await notify(reimbursement, 'head_approved')
    createNotification({
      recipientId: reimbursement.submittedBy._id,
      message:     `Your reimbursement request has been head-approved`,
      type:        'reimbursement',
      link:        `/reimbursements/${reimbursement._id}`,
    })
    res.json(reimbursement)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

const financeApprove = async (req, res) => {
  try {
    const reimbursement = await Reimbursement.findById(req.params.id)
    if (!reimbursement) return res.status(404).json({ message: 'Reimbursement not found' })
    if (reimbursement.status !== 'Head Approved') {
      return res.status(400).json({ message: 'Only Head Approved reimbursements can be finance-approved' })
    }

    reimbursement.status = 'Finance Approved'
    reimbursement.financeReviewedBy = req.user._id
    reimbursement.financeReviewedAt = new Date()
    await reimbursement.save()
    await reimbursement.populate(populateFields, 'name email role')

    await notify(reimbursement, 'finance_approved')
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

    reimbursement.status = 'Rejected'
    reimbursement.rejectionReason = req.body.reason || ''
    await reimbursement.save()
    await reimbursement.populate(populateFields, 'name email role')

    await notify(reimbursement, 'rejected')
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
    if (reimbursement.status !== 'Finance Approved') {
      return res.status(400).json({ message: 'Only Finance Approved reimbursements can be marked paid' })
    }

    reimbursement.status = 'Paid'
    reimbursement.paidBy = req.user._id
    reimbursement.paidAt = new Date()
    await reimbursement.save()
    await reimbursement.populate(populateFields, 'name email role')

    await notify(reimbursement, 'paid')
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
