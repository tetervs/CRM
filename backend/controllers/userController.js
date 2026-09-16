const User = require('../models/User')
const Department = require('../models/Department')

const CREATABLE_ROLES   = ['employee', 'sales', 'manager', 'admin']
const MANAGER_REQUIRED   = ['employee', 'sales']
const MANAGER_FORBIDDEN  = ['admin']
const MANAGER_OR_HIGHER  = ['manager', 'admin', 'finance_head']

const getUsers = async (req, res) => {
  try {
    const filter = {}
    if (req.query.role) filter.role = req.query.role
    const users = await User.find(filter)
      .select('-password')
      .populate('department', 'name code')
      .populate('manager', 'name email role')
      .sort({ createdAt: -1 })
    res.json(users)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// Managers (and above) for the Add User manager dropdown, filtered by department.
const getManagers = async (req, res) => {
  try {
    const filter = { role: { $in: MANAGER_OR_HIGHER }, isActive: true }
    if (req.query.department) filter.department = req.query.department
    const managers = await User.find(filter)
      .select('name email role department')
      .populate('department', 'name code')
      .sort({ name: 1 })
    res.json(managers)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

const getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password')
      .populate('department', 'name code')
      .populate('manager', 'name email role')
    if (!user) return res.status(404).json({ message: 'User not found' })
    res.json(user)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// Admin-managed user creation. No self-signup. Returns the created user plus the
// plaintext temp password so the admin can share it manually (never emailed).
const createUser = async (req, res) => {
  try {
    const { name, email, role, department, manager, password } = req.body

    if (!CREATABLE_ROLES.includes(role)) {
      return res.status(400).json({ message: `Role must be one of: ${CREATABLE_ROLES.join(', ')}` })
    }

    const normEmail = email.toLowerCase().trim()
    const exists = await User.findOne({ email: normEmail })
    if (exists) return res.status(400).json({ message: 'Email already registered' })

    // Department required for all roles, must reference an existing department.
    if (!department) return res.status(400).json({ message: 'Department is required' })
    const dept = await Department.findById(department)
    if (!dept) return res.status(400).json({ message: 'Department not found' })

    // ── Manager rules ──────────────────────────────────────────────────────
    let managerDoc = null
    let warning = null

    if (manager) {
      if (MANAGER_FORBIDDEN.includes(role)) {
        return res.status(400).json({ message: `A ${role} cannot be assigned a manager` })
      }
      managerDoc = await User.findById(manager)
      if (!managerDoc) return res.status(400).json({ message: 'Assigned manager not found' })
      if (!MANAGER_OR_HIGHER.includes(managerDoc.role)) {
        return res.status(400).json({ message: 'Assigned manager must have role manager or higher' })
      }
      // Same-department check is a warning, not a block.
      if (!managerDoc.department) {
        warning = 'Assigned manager has no department set.'
      } else if (String(managerDoc.department) !== String(department)) {
        warning = 'Assigned manager is in a different department than the new user.'
      }
    } else if (MANAGER_REQUIRED.includes(role)) {
      return res.status(400).json({ message: `A manager is required for the ${role} role` })
    }

    const created = await User.create({
      name: name.trim(),
      email: normEmail,
      password,
      role,
      department,
      manager: managerDoc ? managerDoc._id : null,
      mustChangePassword: true,
      isActive: true,
    })

    const user = await User.findById(created._id)
      .select('-password')
      .populate('department', 'name code')
      .populate('manager', 'name email role')

    res.status(201).json({ user, ...(warning && { warning }) })
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

module.exports = { getUsers, getManagers, getUser, createUser, updateRole, deleteUser }
