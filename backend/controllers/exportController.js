const Reimbursement  = require('../models/Reimbursement')
const Lead           = require('../models/Lead')
const Project        = require('../models/Project')
const ManpowerPull   = require('../models/ManpowerPull')
const { buildReimbursementFilter, buildLeadFilter, buildProjectFilter } = require('../utils/exportFilters')
const { parseDateRange }       = require('../utils/dateRange')
const { getBrandingData }      = require('../utils/exportBranding')
const { logExportAudit }       = require('../utils/auditLog')
const { buildReimbursementsXlsx } = require('../templates/reimbursementsXlsx')
const { renderLeadPdf }        = require('../templates/leadPdf')
const { renderProjectPdf }     = require('../templates/projectPdf')

const getIp = (req) =>
  req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || ''

// ── Reimbursements → XLSX ─────────────────────────────────────────────────────
const exportReimbursements = async (req, res) => {
  const { from, to } = parseDateRange(req.query.from, req.query.to)
  const roleFilter   = buildReimbursementFilter(req.user)
  const filter       = { ...roleFilter, createdAt: { $gte: from, $lte: to } }

  const auditBase = {
    userId:     req.user._id,
    userName:   req.user.name,
    userRole:   req.user.role,
    exportType: 'reimbursements_xlsx',
    filters:    { from: from.toISOString(), to: to.toISOString() },
    ipAddress:  getIp(req),
    userAgent:  req.headers['user-agent'] || '',
  }

  let reimbursements
  try {
    reimbursements = await Reimbursement.find(filter)
      .populate('submittedBy',       'name email role')
      .populate('headReviewedBy',    'name')
      .populate('financeReviewedBy', 'name')
      .populate('paidBy',            'name')
      .populate('project',           'title')
      .sort({ createdAt: -1 })
  } catch (err) {
    logExportAudit({ ...auditBase, status: 'failed', errorMessage: err.message })
    return res.status(500).json({ message: 'Failed to fetch reimbursements' })
  }

  let wb
  try {
    const branding = getBrandingData(req.user, { from, to }, 'Reimbursements Report')
    wb = await buildReimbursementsXlsx(reimbursements, branding)
  } catch (err) {
    logExportAudit({ ...auditBase, status: 'failed', errorMessage: err.message })
    return res.status(500).json({ message: 'Failed to generate Excel file' })
  }

  const fromLabel = from.toISOString().slice(0, 7)
  const toLabel   = to.toISOString().slice(0, 7)
  const filename  = `reimbursements_${fromLabel}_to_${toLabel}.xlsx`

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)

  try {
    await wb.xlsx.write(res)
    res.end()
    logExportAudit({ ...auditBase, status: 'success', recordCount: reimbursements.length })
  } catch (err) {
    // Headers already sent — log the failure but can't send error JSON
    logExportAudit({ ...auditBase, status: 'failed', errorMessage: err.message })
    console.error('[Export] xlsx stream error:', err.message)
  }
}

// ── Lead → PDF ────────────────────────────────────────────────────────────────
const exportLeadPdf = async (req, res) => {
  const leadId    = req.params.leadId
  const auditBase = {
    userId:     req.user._id,
    userName:   req.user.name,
    userRole:   req.user.role,
    exportType: 'lead_pdf',
    resourceId: leadId,
    filters:    {},
    ipAddress:  getIp(req),
    userAgent:  req.headers['user-agent'] || '',
  }

  let lead
  try {
    lead = await Lead.findById(leadId)
      .populate('owner',                   'name email')
      .populate('activityLog.performedBy', 'name')

    if (!lead) {
      logExportAudit({ ...auditBase, status: 'failed', errorMessage: 'Lead not found' })
      return res.status(404).json({ message: 'Lead not found' })
    }

    // Sales can only export their own leads
    if (req.user.role === 'sales' && lead.owner?._id?.toString() !== req.user._id.toString()) {
      logExportAudit({ ...auditBase, status: 'failed', errorMessage: 'Access denied' })
      return res.status(403).json({ message: 'Access denied' })
    }
  } catch (err) {
    logExportAudit({ ...auditBase, status: 'failed', errorMessage: err.message })
    return res.status(500).json({ message: 'Failed to fetch lead' })
  }

  auditBase.resourceName = lead.title

  let pdfBuffer
  try {
    const branding = getBrandingData(req.user, { from: lead.createdAt, to: new Date() }, `Lead Dossier — ${lead.title}`)
    pdfBuffer = await renderLeadPdf(lead, branding)
  } catch (err) {
    logExportAudit({ ...auditBase, status: 'failed', errorMessage: err.message })
    return res.status(500).json({ message: 'Failed to generate PDF' })
  }

  const safeName = lead.title.replace(/[^a-z0-9]/gi, '_').slice(0, 40)
  const filename = `lead_${leadId}_${safeName}.pdf`

  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.end(pdfBuffer)

  logExportAudit({ ...auditBase, status: 'success', recordCount: 1 })
}

// ── Project → PDF ─────────────────────────────────────────────────────────────
const exportProjectPdf = async (req, res) => {
  const projectId = req.params.projectId
  const auditBase = {
    userId:     req.user._id,
    userName:   req.user.name,
    userRole:   req.user.role,
    exportType: 'project_pdf',
    resourceId: projectId,
    filters:    {},
    ipAddress:  getIp(req),
    userAgent:  req.headers['user-agent'] || '',
  }

  let project, reimbursements, manpowerPulls
  try {
    project = await Project.findById(projectId)
      .populate('projectHead',             'name email role')
      .populate('teamMembers',             'name email role')
      .populate('lead',                    'title status dealValue')
      .populate('expenses.loggedBy',       'name')
      .populate('progressUpdates.updatedBy', 'name')
      .populate('department',              'name code')

    if (!project) {
      logExportAudit({ ...auditBase, status: 'failed', errorMessage: 'Project not found' })
      return res.status(404).json({ message: 'Project not found' })
    }

    // Verify access using the same logic as getProject
    const PRIVILEGED = ['finance_head', 'admin', 'manager']
    const userId = req.user._id.toString()
    const isPrivileged = PRIVILEGED.includes(req.user.role)
    const isHead = (project.projectHead?._id || project.projectHead).toString() === userId
    const isMember = project.teamMembers?.some((m) => (m._id || m).toString() === userId)

    if (!isPrivileged && !isHead && !isMember) {
      logExportAudit({ ...auditBase, status: 'failed', errorMessage: 'Access denied' })
      return res.status(403).json({ message: 'Access denied' })
    }

    ;[reimbursements, manpowerPulls] = await Promise.all([
      Reimbursement.find({ project: projectId })
        .populate('submittedBy', 'name')
        .sort({ createdAt: -1 }),
      ManpowerPull.find({ project: projectId })
        .populate('pulledBy',       'name')
        .populate('pulledEmployee', 'name')
        .sort({ createdAt: -1 }),
    ])
  } catch (err) {
    logExportAudit({ ...auditBase, status: 'failed', errorMessage: err.message })
    return res.status(500).json({ message: 'Failed to fetch project data' })
  }

  auditBase.resourceName = project.title

  let pdfBuffer
  try {
    const branding = getBrandingData(
      req.user,
      { from: project.createdAt, to: project.completedAt || new Date() },
      `Project Dossier — ${project.title}`
    )
    pdfBuffer = await renderProjectPdf(project, reimbursements, manpowerPulls, branding)
  } catch (err) {
    logExportAudit({ ...auditBase, status: 'failed', errorMessage: err.message })
    return res.status(500).json({ message: 'Failed to generate PDF' })
  }

  const safeName = project.title.replace(/[^a-z0-9]/gi, '_').slice(0, 40)
  const filename = `project_${projectId}_${safeName}.pdf`

  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.end(pdfBuffer)

  logExportAudit({ ...auditBase, status: 'success', recordCount: 1 })
}

module.exports = { exportReimbursements, exportLeadPdf, exportProjectPdf }
