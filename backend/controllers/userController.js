const User = require('../models/User')
const crypto = require('crypto')
const Department = require('../models/Department')
const UserAuditLog = require('../models/UserAuditLog')
const { userReferences } = require('../utils/userReferences')

const CREATABLE_ROLES   = ['employee', 'sales', 'manager', 'admin']
const MANAGER_REQUIRED   = ['employee', 'sales', 'manager']
const MANAGER_FORBIDDEN  = ['admin']
const MANAGER_OR_HIGHER  = ['manager', 'admin', 'head']
// A manager's own "manager" is who they report to for approvals — must be
// head or admin, never another manager.
const MANAGER_REPORTS_TO = ['head', 'admin']

const getUsers = async (req, res) => {
  try {
    const filter = {}
    if (req.query.role) filter.role = req.query.role

    // Employee/sales only see colleagues in their own department — head,
    // admin, and manager stay unrestricted (same org-wide pattern used for
    // leads/projects/reimbursements/manpower filtering elsewhere in this codebase).
    if (['employee', 'sales'].includes(req.user.role)) {
      filter.department = req.user.department
    }

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
// head/admin sit above departments and are always eligible — only
// 'manager' candidates are department-scoped, so a manager can still be
// linked to a head as their reports-to.
const getManagers = async (req, res) => {
  try {
    const filter = { isActive: true }
    if (req.query.department) {
      filter.$or = [
        { role: { $in: ['head', 'admin'] } },
        { role: 'manager', department: req.query.department },
      ]
    } else {
      filter.role = { $in: MANAGER_OR_HIGHER }
    }
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
    res.locals.keepFisRole = true // head/admin-only route; the edit modal needs it to prefill "FIS access"
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
    const { name, email, role, department, manager, password, designation } = req.body

    if (!CREATABLE_ROLES.includes(role)) {
      return res.status(400).json({ message: `Role must be one of: ${CREATABLE_ROLES.join(', ')}` })
    }

    const normEmail = email.toLowerCase().trim()
    if (!emailDomainAllowed(normEmail)) return res.status(400).json({ message: 'Email domain is not allowed' })
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
      if (role === 'manager' && !MANAGER_REPORTS_TO.includes(managerDoc.role)) {
        return res.status(400).json({ message: 'A manager must report to head or admin' })
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
      designation: designation?.trim() || '',
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

// `manager` is optional here — omit it to change only the role, unchanged from
// before this field became editable post-creation. When present (including
// explicit null, to clear it), it's validated the same way createUser does.
const updateRole = async (req, res) => {
  try {
    const { role } = req.body
    const validRoles = ['admin', 'manager', 'sales', 'employee']
    if (!validRoles.includes(role)) return res.status(400).json({ message: 'Invalid role' })

    const update = { role }

    if ('manager' in req.body) {
      const manager = req.body.manager || null
      if (manager) {
        if (MANAGER_FORBIDDEN.includes(role)) {
          return res.status(400).json({ message: `A ${role} cannot be assigned a manager` })
        }
        const managerDoc = await User.findById(manager)
        if (!managerDoc) return res.status(400).json({ message: 'Assigned manager not found' })
        if (!MANAGER_OR_HIGHER.includes(managerDoc.role)) {
          return res.status(400).json({ message: 'Assigned manager must have role manager or higher' })
        }
        if (role === 'manager' && !MANAGER_REPORTS_TO.includes(managerDoc.role)) {
          return res.status(400).json({ message: 'A manager must report to head or admin' })
        }
      } else if (MANAGER_REQUIRED.includes(role)) {
        return res.status(400).json({ message: `A manager is required for the ${role} role` })
      }
      update.manager = manager
    }

    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true })
      .select('-password')
      .populate('department', 'name code')
      .populate('manager', 'name email role')
    if (!user) return res.status(404).json({ message: 'User not found' })
    res.json(user)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

const EDITABLE = ['name', 'email', 'role', 'department', 'manager', 'isActive', 'fisRole']
const ID_FIELDS = ['department', 'manager']

// ALLOWED_EMAIL_DOMAINS (comma-separated) — enforced only when set.
const emailDomainAllowed = (email) => {
  const list = (process.env.ALLOWED_EMAIL_DOMAINS || '').split(',').map((d) => d.trim().toLowerCase()).filter(Boolean)
  return !list.length || list.includes(email.split('@')[1])
}

// Only a head may touch a head account or hand out the head role — otherwise an
// admin could reset a head's password and take the account over.
const headGuard = (actor, target, newRole) =>
  actor.role !== 'head' && (target.role === 'head' || newRole === 'head')

const updateUser = async (req, res) => {
  try {
    const target = await User.findById(req.params.id)
    if (!target) return res.status(404).json({ message: 'User not found' })

    // Normalise, then keep only fields that actually change.
    const body = { ...req.body }
    if (typeof body.email === 'string') body.email = body.email.toLowerCase().trim()
    if (typeof body.name === 'string') body.name = body.name.trim()
    if ('fisRole' in body && !body.fisRole) body.fisRole = null
    if ('manager' in body && !body.manager) body.manager = null
    if ('department' in body && !body.department) body.department = null
    const changes = {}
    for (const f of EDITABLE) {
      if (!(f in body)) continue
      const cur = ID_FIELDS.includes(f) ? (target[f] ? String(target[f]) : null) : target[f]
      if ((body[f] ?? null) !== (cur ?? null)) changes[f] = body[f]
    }

    if (headGuard(req.user, target, changes.role)) {
      return res.status(403).json({ message: 'Only a head can modify head accounts or assign the head role' })
    }

    const isSelf = String(target._id) === String(req.user._id)
    if (isSelf && ['role', 'isActive', 'fisRole'].some((f) => f in changes)) {
      return res.status(400).json({ message: 'You cannot change your own role, status or FIS access' })
    }

    if ('email' in changes) {
      if (!emailDomainAllowed(changes.email)) {
        return res.status(400).json({ message: 'Email domain is not allowed' })
      }
      if (await User.exists({ email: changes.email, _id: { $ne: target._id } })) {
        return res.status(400).json({ message: 'Email already registered' })
      }
    }
    if (changes.department && !(await Department.findById(changes.department))) {
      return res.status(400).json({ message: 'Department not found' })
    }
    // Manager rules — same as createUser/updateRole, applied to the resulting role + manager.
    const newRole = changes.role || target.role
    const newManager = 'manager' in changes ? changes.manager : target.manager
    if (changes.manager) {
      if (MANAGER_FORBIDDEN.includes(newRole)) return res.status(400).json({ message: `A ${newRole} cannot be assigned a manager` })
      if (String(changes.manager) === String(target._id)) return res.status(400).json({ message: 'A user cannot report to themselves' })
      const mgr = await User.findById(changes.manager)
      if (!mgr) return res.status(400).json({ message: 'Assigned manager not found' })
      if (!MANAGER_OR_HIGHER.includes(mgr.role)) return res.status(400).json({ message: 'Assigned manager must have role manager or higher' })
      if (newRole === 'manager' && !MANAGER_REPORTS_TO.includes(mgr.role)) return res.status(400).json({ message: 'A manager must report to head or admin' })
    }
    if (('role' in changes || 'manager' in changes) && MANAGER_REQUIRED.includes(newRole) && !newManager) {
      return res.status(400).json({ message: `A manager (Reports To) is required for the ${newRole} role` })
    }
    const leavingHead = target.role === 'head' && target.isActive &&
      ((changes.role && changes.role !== 'head') || changes.isActive === false)
    if (leavingHead && !(await User.exists({ role: 'head', isActive: true, _id: { $ne: target._id } }))) {
      return res.status(400).json({ message: 'Cannot demote or deactivate the last remaining head' })
    }

    const fields = Object.keys(changes)
    if (fields.length) {
      const before = Object.fromEntries(fields.map((f) => [f, target[f]]))
      target.set(changes)
      await target.save()
      await UserAuditLog.insertMany(fields.map((f) => ({
        actor: req.user._id, target: target._id, targetEmail: target.email, targetName: target.name, field: f, oldValue: before[f] ?? null, newValue: changes[f] ?? null,
      })))
    }

    res.locals.keepFisRole = true
    const user = await User.findById(target._id)
      .select('-password')
      .populate('department', 'name code')
      .populate('manager', 'name email role')
    res.json(user)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// No hard delete — deactivate goes through the same guarded path as the edit modal.
const deleteUser = (req, res) => {
  req.body = { isActive: false }
  return updateUser(req, res)
}

// Head-only permanent delete. Refused (409 + per-collection counts) if the user is
// referenced anywhere — those users must be deactivated instead.
const hardDeleteUser = async (req, res) => {
  try {
    const target = await User.findById(req.params.id)
    if (!target) return res.status(404).json({ message: 'User not found' })
    if (String(target._id) === String(req.user._id)) return res.status(400).json({ message: 'You cannot delete yourself' })
    if ((req.body?.confirmEmail || '').toLowerCase().trim() !== target.email) {
      return res.status(400).json({ message: 'confirmEmail must match the user email' })
    }
    if (target.role === 'head' && !(await User.exists({ role: 'head', isActive: true, _id: { $ne: target._id } }))) {
      return res.status(400).json({ message: 'Cannot delete the last remaining head' })
    }
    const counts = await userReferences(target._id)
    if (Object.keys(counts).length) {
      return res.status(409).json({ message: 'User has activity — deactivate instead', counts })
    }
    await target.deleteOne()
    await UserAuditLog.create({
      actor: req.user._id, target: target._id, targetEmail: target.email, targetName: target.name,
      field: 'deleted', oldValue: { email: target.email, name: target.name, role: target.role }, newValue: null,
    })
    res.json({ message: 'User deleted' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// Temp password is returned once; only a hash is stored and the log never holds it.
const resetPassword = async (req, res) => {
  try {
    const target = await User.findById(req.params.id)
    if (!target) return res.status(404).json({ message: 'User not found' })
    if (headGuard(req.user, target)) {
      return res.status(403).json({ message: 'Only a head can reset a head account' })
    }
    const tempPassword = crypto.randomBytes(9).toString('base64url')
    target.password = tempPassword
    target.mustChangePassword = true
    target.passwordChangedAt = new Date()
    target.failedLoginAttempts = 0
    target.lockUntil = null
    await target.save()
    await UserAuditLog.create({ actor: req.user._id, target: target._id, targetEmail: target.email, targetName: target.name, field: 'password', newValue: 'reset' })
    res.json({ tempPassword })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

module.exports = { getUsers, getManagers, getUser, createUser, updateRole, updateUser, deleteUser, hardDeleteUser, resetPassword }
