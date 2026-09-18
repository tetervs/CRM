// Roles whose project headship triggers the 3-step chain (no separate
// "project head's manager" link needed — an admin/head/manager project head is
// already senior enough that the chain goes straight to the overall approver).
const THREE_STEP_HEAD_ROLES = ['admin', 'head', 'manager']

// Builds the ordered approval chain for a reimbursement, given the resolved
// participants. Pure function — no DB access — so it's unit-testable on its own.
// Person-anchored steps (projectHead, projectHeadManager, overallApprover) carry
// a specific `user`; role-anchored steps (ca, caPay) leave `user` null since any
// active ca-role user may act on them.
//
// Steps whose designated `user` is the submitter are pre-marked 'Approved' (with
// no reviewedBy — an auto-skip, not a real review) per the conflict-of-interest
// rule: nobody approves their own request, even by way of a coincidental chain
// position. Role-anchored steps are never pre-skipped this way — self-conflict
// there is enforced per-action instead (see reimbursementController's isSelf),
// so a different ca-role user can still act even if the submitter is also ca.
const buildApprovalChain = ({ projectHead, projectHeadManager, overallApprover, submittedById }) => {
  const isThreeStep = THREE_STEP_HEAD_ROLES.includes(projectHead.role)

  const steps = [
    { role: 'projectHead', label: 'Project Head Approval', user: projectHead._id, status: 'Pending' },
  ]

  if (!isThreeStep) {
    steps.push({ role: 'projectHeadManager', label: "Project Head's Manager Approval", user: projectHeadManager._id, status: 'Pending' })
  }

  steps.push({ role: 'overallApprover', label: 'Overall Approval', user: overallApprover._id, status: 'Pending' })
  steps.push({ role: 'ca', label: 'CA Approval', user: null, status: 'Pending' })
  steps.push({ role: 'caPay', label: 'Marked Paid', user: null, status: 'Pending' })

  const submittedByStr = submittedById.toString()
  return steps.map((step) => (
    step.user && step.user.toString() === submittedByStr
      ? { ...step, status: 'Approved' }
      : step
  ))
}

// First step still awaiting action — the chain's "whose turn is it" pointer.
const currentChainStep = (approvalChain) => (approvalChain || []).find((s) => s.status === 'Pending') || null

// Whether `user` may act on `step` right now: exact match for person-anchored
// steps, role match for role-anchored ones (ca / caPay — both require User.role
// 'ca'; caPay isn't itself a User.role, it's just this step's semantic tag).
const isStepActor = (step, user) => {
  if (!step) return false
  if (step.user) return step.user.toString() === user._id.toString()
  return user.role === 'ca'
}

module.exports = { THREE_STEP_HEAD_ROLES, buildApprovalChain, currentChainStep, isStepActor }
