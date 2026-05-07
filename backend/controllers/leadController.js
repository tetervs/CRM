const Lead = require('../models/Lead')
const { createNotification } = require('../utils/notify')

const ownerFilter = (user) => {
  if (['finance_head', 'admin', 'manager'].includes(user.role)) return {}
  return { owner: user._id }
}

const getLeads = async (req, res) => {
  try {
    const filter = ownerFilter(req.user)
    const leads = await Lead.find(filter)
      .populate('owner', 'name email')
      .populate('activityLog.performedBy', 'name')
      .sort({ createdAt: -1 })
    res.json(leads)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

const createLead = async (req, res) => {
  try {
    const { title, contactName, contactEmail, contactPhone, dealValue, status, notes, tags } = req.body
    if (!title) return res.status(400).json({ message: 'Title is required' })

    const lead = await Lead.create({
      title, contactName, contactEmail, contactPhone,
      dealValue, status, notes, tags,
      owner: req.user._id,
      activityLog: [{ action: 'Lead created', performedBy: req.user._id }],
    })
    await lead.populate('owner', 'name email')
    res.status(201).json(lead)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

const getLead = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id)
      .populate('owner', 'name email')
      .populate('activityLog.performedBy', 'name')

    if (!lead) return res.status(404).json({ message: 'Lead not found' })

    // Sales can only view their own
    if (req.user.role === 'sales' && lead.owner._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' })
    }

    res.json(lead)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

const updateLead = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id)
    if (!lead) return res.status(404).json({ message: 'Lead not found' })

    if (req.user.role === 'sales' && lead.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' })
    }

    const allowed = ['title', 'contactName', 'contactEmail', 'contactPhone', 'dealValue', 'notes', 'tags']
    allowed.forEach((f) => { if (req.body[f] !== undefined) lead[f] = req.body[f] })

    lead.activityLog.push({ action: 'Lead updated', performedBy: req.user._id })
    await lead.save()
    await lead.populate('owner', 'name email')
    res.json(lead)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

const deleteLead = async (req, res) => {
  try {
    const lead = await Lead.findByIdAndDelete(req.params.id)
    if (!lead) return res.status(404).json({ message: 'Lead not found' })
    res.json({ message: 'Lead deleted' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

const updateStatus = async (req, res) => {
  try {
    const { status } = req.body
    const validStatuses = ['New', 'Contacted', 'Proposal Sent', 'Won', 'Lost']
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' })
    }

    const lead = await Lead.findById(req.params.id)
    if (!lead) return res.status(404).json({ message: 'Lead not found' })

    if (req.user.role === 'sales' && lead.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' })
    }

    const prev = lead.status
    lead.status = status
    lead.activityLog.push({
      action: `Status changed from "${prev}" to "${status}"`,
      performedBy: req.user._id,
    })
    await lead.save()
    await lead.populate('owner', 'name email')
    res.json(lead)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

const convertToProject = async (req, res) => {
  try {
    const Project = require('../models/Project')
    const User    = require('../models/User')
    const { projectHeadId, budget } = req.body

    const lead = await Lead.findById(req.params.id)
    if (!lead) return res.status(404).json({ message: 'Lead not found' })
    if (lead.status !== 'Won') return res.status(400).json({ message: 'Only Won leads can be converted to projects' })

    const exists = await Project.findOne({ lead: lead._id })
    if (exists) return res.status(400).json({ message: 'A project already exists for this lead' })

    const headUser = await User.findById(projectHeadId)
    if (!headUser || headUser.role !== 'manager') {
      return res.status(400).json({ message: 'Project head must be a manager' })
    }

    const project = await Project.create({
      title:       lead.title,
      lead:        lead._id,
      projectHead: projectHeadId,
      budget:      Number(budget) || 0,
    })

    lead.activityLog.push({
      action:      `Lead converted to project by ${req.user.name}`,
      performedBy: req.user._id,
    })
    await lead.save()

    createNotification({
      recipientId: projectHeadId,
      message:     `You have been assigned as project head by ${req.user.name}`,
      type:        'project',
      link:        `/projects/${project._id}`,
    })

    await project.populate('projectHead', 'name email')
    res.status(201).json(project)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

module.exports = { getLeads, createLead, getLead, updateLead, deleteLead, updateStatus, convertToProject }
