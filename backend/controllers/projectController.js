const Project = require('../models/Project')
const { createNotification } = require('../utils/notify')
const { buildProjectFilter } = require('../utils/exportFilters')

const PRIVILEGED = ['finance_head', 'admin', 'manager']

const canAccess = (project, userId, role) => {
  if (PRIVILEGED.includes(role)) return true
  const id = userId.toString()
  const headId = (project.projectHead._id || project.projectHead).toString()
  const isHead = headId === id
  const isMember = project.teamMembers.some((m) => (m._id || m).toString() === id)
  return isHead || isMember
}

const getProjects = async (req, res) => {
  try {
    let filter = buildProjectFilter(req.user)

    if (req.query.leadId) {
      const leadCond = { lead: req.query.leadId }
      filter = Object.keys(filter).length === 0
        ? leadCond
        : { $and: [filter, leadCond] }
    }

    const projects = await Project.find(filter)
      .populate('projectHead', 'name email')
      .populate('teamMembers', 'name email')
      .populate('lead', 'title')
      .populate('department', 'name code')
      .sort({ createdAt: -1 })

    res.json(projects)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

const getProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('projectHead', 'name email role')
      .populate('teamMembers', 'name email role')
      .populate('lead', 'title status dealValue')
      .populate('expenses.loggedBy', 'name')
      .populate('progressUpdates.updatedBy', 'name')
      .populate('department', 'name code')

    if (!project) return res.status(404).json({ message: 'Project not found' })
    if (!canAccess(project, req.user._id, req.user.role)) {
      return res.status(403).json({ message: 'Access denied' })
    }

    res.json(project)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

const updateProjectStatus = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
    if (!project) return res.status(404).json({ message: 'Project not found' })

    const { role, _id } = req.user
    const isHead = project.projectHead.toString() === _id.toString()
    if (!['finance_head', 'admin'].includes(role) && !isHead) {
      return res.status(403).json({ message: 'Access denied' })
    }

    project.status = req.body.status
    await project.save()
    res.json({ status: project.status })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

const addProgressUpdate = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
    if (!project) return res.status(404).json({ message: 'Project not found' })
    if (!canAccess(project, req.user._id, req.user.role)) {
      return res.status(403).json({ message: 'Access denied' })
    }

    project.progressUpdates.push({ note: req.body.note, updatedBy: req.user._id })
    await project.save()
    await project.populate('progressUpdates.updatedBy', 'name')

    res.status(201).json(project.progressUpdates[project.progressUpdates.length - 1])
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

const logExpense = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
    if (!project) return res.status(404).json({ message: 'Project not found' })
    if (!canAccess(project, req.user._id, req.user.role)) {
      return res.status(403).json({ message: 'Access denied' })
    }

    project.expenses.push({
      description: req.body.description,
      amount:      Number(req.body.amount),
      loggedBy:    req.user._id,
    })
    await project.save()
    await project.populate('expenses.loggedBy', 'name')

    res.status(201).json(project.expenses[project.expenses.length - 1])
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

const completeProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
    if (!project) return res.status(404).json({ message: 'Project not found' })

    project.status = 'Completed'
    project.completedAt = new Date()
    await project.save()

    const totalExpenses = project.expenses.reduce((sum, e) => sum + e.amount, 0)
    const profit = project.budget - totalExpenses

    const notifyIds = [project.projectHead, ...project.teamMembers].map((id) => id.toString())
    const uniqueIds = [...new Set(notifyIds)]
    for (const recipientId of uniqueIds) {
      createNotification({
        recipientId,
        message: `Project "${project.title}" has been marked complete`,
        type:    'project',
        link:    `/projects/${project._id}`,
      })
    }

    res.json({
      project,
      summary: { budget: project.budget, totalExpenses, profit, isOverBudget: profit < 0 },
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

module.exports = { getProjects, getProject, updateProjectStatus, addProgressUpdate, logExpense, completeProject }
