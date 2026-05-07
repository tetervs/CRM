const Milestone = require('../models/Milestone')
const Project   = require('../models/Project')

const PRIVILEGED = ['finance_head', 'admin', 'manager']

const canAccessProject = (project, userId, role) => {
  if (PRIVILEGED.includes(role)) return true
  const id = userId.toString()
  const headId = (project.projectHead._id || project.projectHead).toString()
  const isMember = project.teamMembers.some((m) => (m._id || m).toString() === id)
  return headId === id || isMember
}

const getMilestones = async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId)
    if (!project) return res.status(404).json({ message: 'Project not found' })
    if (!canAccessProject(project, req.user._id, req.user.role)) {
      return res.status(403).json({ message: 'Access denied' })
    }

    const milestones = await Milestone.find({ project: req.params.projectId })
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name')
      .sort({ dueDate: 1 })

    res.json(milestones)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

const createMilestone = async (req, res) => {
  try {
    const { projectId, title, description, dueDate, assignedTo } = req.body

    const project = await Project.findById(projectId)
    if (!project) return res.status(404).json({ message: 'Project not found' })
    if (!canAccessProject(project, req.user._id, req.user.role)) {
      return res.status(403).json({ message: 'Access denied' })
    }

    const milestone = await Milestone.create({
      title,
      description,
      dueDate,
      project: projectId,
      assignedTo: assignedTo || null,
      createdBy: req.user._id,
    })

    await milestone.populate('assignedTo', 'name email')
    await milestone.populate('createdBy', 'name')

    res.status(201).json(milestone)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

const updateMilestone = async (req, res) => {
  try {
    const { role, _id } = req.user
    const milestone = await Milestone.findById(req.params.id).populate('project')
    if (!milestone) return res.status(404).json({ message: 'Milestone not found' })

    const project = milestone.project
    if (!canAccessProject(project, _id, role)) {
      return res.status(403).json({ message: 'Access denied' })
    }

    const { title, description, dueDate, status, assignedTo } = req.body

    if (title !== undefined)       milestone.title       = title
    if (description !== undefined) milestone.description = description
    if (dueDate !== undefined)     milestone.dueDate     = dueDate
    if (status !== undefined)      milestone.status      = status
    if (assignedTo !== undefined)  milestone.assignedTo  = assignedTo || null

    await milestone.save()
    await milestone.populate('assignedTo', 'name email')
    await milestone.populate('createdBy', 'name')

    res.json(milestone)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

const deleteMilestone = async (req, res) => {
  try {
    const milestone = await Milestone.findById(req.params.id)
    if (!milestone) return res.status(404).json({ message: 'Milestone not found' })

    await milestone.deleteOne()
    res.json({ message: 'Deleted' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

module.exports = { getMilestones, createMilestone, updateMilestone, deleteMilestone }
