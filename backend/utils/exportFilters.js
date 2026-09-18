const buildReimbursementFilter = (user) => {
  const { role, _id } = user
  if (['head', 'admin', 'manager', 'ca'].includes(role)) return {}
  // A non-privileged user (e.g. an ordinary employee who's a Project Head or a
  // Project Head's manager) still needs to see reimbursements sitting at their
  // step in the approval chain, not just their own submissions.
  return { $or: [{ submittedBy: _id }, { 'approvalChain.user': _id }] }
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
