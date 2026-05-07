const ManpowerPull = require('../models/ManpowerPull')
const Project = require('../models/Project')
const User = require('../models/User')
const { createNotification } = require('../utils/notify')

const PRIVILEGED = ['finance_head', 'admin']

const createPull = async (req, res) => {
  try {
    const { projectId, pulledEmployee, employeeType, freelancerName, freelancerEmail, reason } = req.body

    const project = await Project.findById(projectId)
    if (!project) return res.status(404).json({ message: 'Project not found' })

    const { role, _id, name } = req.user
    const isPrivileged = PRIVILEGED.includes(role)
    if (!isPrivileged && project.projectHead.toString() !== _id.toString()) {
      return res.status(403).json({ message: 'You can only pull manpower for projects you head' })
    }

    let employeeId
    if (employeeType === 'inhouse' && pulledEmployee) {
      const emp = await User.findById(pulledEmployee)
      if (!emp || !['employee', 'sales'].includes(emp.role)) {
        return res.status(400).json({ message: 'Only employee and sales users can be pulled into projects' })
      }
      employeeId = pulledEmployee

      await Project.findByIdAndUpdate(projectId, { $addToSet: { teamMembers: pulledEmployee } })

      createNotification({
        recipientId: pulledEmployee,
        message:     `You have been pulled into project "${project.title}" by ${name}`,
        type:        'project',
        link:        `/projects/${project._id}`,
      })
    }

    const pull = await ManpowerPull.create({
      project:        projectId,
      pulledBy:       _id,
      pulledEmployee: employeeId,
      employeeType,
      freelancerName:  employeeType === 'freelancer' ? freelancerName : undefined,
      freelancerEmail: employeeType === 'freelancer' ? freelancerEmail : undefined,
      reason,
    })

    await ManpowerPull.populate(pull, [
      { path: 'pulledBy',       select: 'name role' },
      { path: 'pulledEmployee', select: 'name role' },
      { path: 'project',        select: 'title' },
    ])

    res.status(201).json(pull)
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
}

const getPulls = async (req, res) => {
  try {
    const { role, _id } = req.user
    let filter = {}

    if (PRIVILEGED.includes(role)) {
      filter = {}
    } else if (role === 'manager') {
      const myProjects = await Project.find({ projectHead: _id }).select('_id')
      filter = { project: { $in: myProjects.map((p) => p._id) } }
    } else {
      filter = { pulledEmployee: _id }
    }

    const pulls = await ManpowerPull.find(filter)
      .populate('pulledBy',       'name role')
      .populate('pulledEmployee', 'name role')
      .populate('project',        'title')
      .sort({ createdAt: -1 })

    res.json(pulls)
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
}

const createProjectPull = async (req, res) => {
  try {
    const projectId = req.params.id
    const { pulledEmployee, employeeType, freelancerName, freelancerEmail, reason } = req.body

    const project = await Project.findById(projectId)
    if (!project) return res.status(404).json({ message: 'Project not found' })

    const { role, _id, name } = req.user
    const isPrivileged = PRIVILEGED.includes(role)
    if (!isPrivileged && project.projectHead.toString() !== _id.toString()) {
      return res.status(403).json({ message: 'You can only pull manpower for projects you head' })
    }

    let employeeId
    if (employeeType === 'inhouse' && pulledEmployee) {
      const emp = await User.findById(pulledEmployee)
      if (!emp || !['employee', 'sales'].includes(emp.role)) {
        return res.status(400).json({ message: 'Only employee and sales users can be pulled into projects' })
      }
      employeeId = pulledEmployee
      await Project.findByIdAndUpdate(projectId, { $addToSet: { teamMembers: pulledEmployee } })
      createNotification({
        recipientId: pulledEmployee,
        message:     `You have been pulled into project "${project.title}" by ${name}`,
        type:        'project',
        link:        `/projects/${project._id}`,
      })
    }

    const pull = await ManpowerPull.create({
      project:        projectId,
      pulledBy:       _id,
      pulledEmployee: employeeId,
      employeeType,
      freelancerName:  employeeType === 'freelancer' ? freelancerName : undefined,
      freelancerEmail: employeeType === 'freelancer' ? freelancerEmail : undefined,
      reason,
    })

    await ManpowerPull.populate(pull, [
      { path: 'pulledBy',       select: 'name role' },
      { path: 'pulledEmployee', select: 'name role' },
    ])

    res.status(201).json(pull)
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
}

const getProjectPulls = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
    if (!project) return res.status(404).json({ message: 'Project not found' })

    const { role, _id } = req.user
    const isPrivileged = PRIVILEGED.includes(role)
    const isHead   = project.projectHead.toString() === _id.toString()
    const isMember = project.teamMembers.some((m) => (m._id || m).toString() === _id.toString())

    if (!isPrivileged && !isHead && !isMember) {
      return res.status(403).json({ message: 'Access denied' })
    }

    const pulls = await ManpowerPull.find({ project: req.params.id })
      .populate('pulledBy',       'name role')
      .populate('pulledEmployee', 'name role')
      .sort({ createdAt: -1 })

    res.json(pulls)
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
}

module.exports = { createPull, getPulls, getProjectPulls, createProjectPull }
