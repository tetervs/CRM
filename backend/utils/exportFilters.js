const buildReimbursementFilter = (user) => {
  const { role, _id } = user
  if (['head', 'admin', 'manager', 'ca'].includes(role)) return {}
  return { submittedBy: _id }
}

const buildLeadFilter = (user) => {
  if (['head', 'admin', 'manager', 'ca'].includes(user.role)) return {}
  return { owner: user._id }
}

const buildProjectFilter = (user) => {
  const { role, _id } = user
  if (['head', 'admin', 'manager', 'ca'].includes(role)) return {}
  return { $or: [{ projectHead: _id }, { teamMembers: _id }] }
}

module.exports = { buildReimbursementFilter, buildLeadFilter, buildProjectFilter }
