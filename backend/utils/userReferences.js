// Every place a User _id can be referenced. Used to decide whether a user can be hard-deleted.
const SOURCES = [
  ['leads',            'Lead',            ['owner', 'activityLog.performedBy']],
  ['projects',         'Project',         ['projectHead', 'teamMembers', 'expenses.loggedBy', 'progressUpdates.updatedBy']],
  ['reimbursements',   'Reimbursement',   ['submittedBy', 'headReviewedBy', 'financeReviewedBy', 'paidBy', 'currentApprover', 'approvalChain.user', 'approvalChain.reviewedBy']],
  ['manpowerPulls',    'ManpowerPull',    ['pulledBy', 'pulledEmployee']],
  ['milestones',       'Milestone',       ['assignedTo', 'createdBy']],
  ['notifications',    'Notification',    ['recipient']],
  ['exportAuditLogs',  'ExportAuditLog',  ['userId']],
  ['fisCases',         'FisCase',         ['caseLead', 'support1', 'support2', 'assignedBy', 'createdBy']],
  ['fisCaseHistory',   'FisCaseHistory',  ['by']],
  ['fisQcRuns',        'FisQcRun',        ['createdBy', 'passed.by', 'noSubjectsInScope.by', 'reopens.by', 'rounds.closedBy']],
  ['fisQcTemplates',   'FisQcTemplate',   ['createdBy']],
  ['userAuditLog',     'UserAuditLog',    ['actor']], // target-only rows are history about the user, not activity by them
  ['directReports',    'User',            ['manager']],
]

// -> { collectionLabel: count } containing only non-zero entries.
async function userReferences(id) {
  const counts = {}
  await Promise.all(SOURCES.map(async ([label, model, paths]) => {
    const n = await require(`../models/${model}`).countDocuments({ $or: paths.map((p) => ({ [p]: id })) })
    if (n) counts[label] = n
  }))
  return counts
}

module.exports = { userReferences }
