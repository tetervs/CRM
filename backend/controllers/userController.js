const User = require('../models/User')

const getUsers = async (req, res) => {
  try {
    const filter = {}
    if (req.query.role) filter.role = req.query.role
    const users = await User.find(filter).select('-password').sort({ createdAt: -1 })
    res.json(users)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

const getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password')
    if (!user) return res.status(404).json({ message: 'User not found' })
    res.json(user)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

const updateRole = async (req, res) => {
  try {
    const { role } = req.body
    const validRoles = ['admin', 'manager', 'sales', 'employee']
    if (!validRoles.includes(role)) return res.status(400).json({ message: 'Invalid role' })

    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true }).select('-password')
    if (!user) return res.status(404).json({ message: 'User not found' })
    res.json(user)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

const deleteUser = async (req, res) => {
  try {
    // Soft delete — deactivate instead of removing
    const user = await User.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true }).select('-password')
    if (!user) return res.status(404).json({ message: 'User not found' })
    res.json({ message: 'User deactivated', user })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

module.exports = { getUsers, getUser, updateRole, deleteUser }
