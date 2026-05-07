const Department = require('../models/Department')

const getDepartments = async (req, res) => {
  try {
    const departments = await Department.find().sort({ name: 1 })
    res.json(departments)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

const createDepartment = async (req, res) => {
  try {
    const { name, code } = req.body
    const dept = await Department.create({ name, code })
    res.status(201).json(dept)
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: 'Department name or code already exists' })
    }
    res.status(500).json({ message: err.message })
  }
}

const updateDepartment = async (req, res) => {
  try {
    const dept = await Department.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    )
    if (!dept) return res.status(404).json({ message: 'Department not found' })
    res.json(dept)
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: 'Department name or code already exists' })
    }
    res.status(500).json({ message: err.message })
  }
}

const toggleDepartment = async (req, res) => {
  try {
    const dept = await Department.findById(req.params.id)
    if (!dept) return res.status(404).json({ message: 'Department not found' })
    dept.isActive = !dept.isActive
    await dept.save()
    res.json(dept)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

module.exports = { getDepartments, createDepartment, updateDepartment, toggleDepartment }
