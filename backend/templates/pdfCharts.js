const { MARGIN, CONTENT_W, DARK, MUTED, fmtCurrency } = require('./pdfHelpers')

const STATUS_COLORS = {
  'Pending':          '#3B82F6',
  'Head Approved':    '#F59E0B',
  'Finance Approved': '#8B5CF6',
  'Paid':             '#10B981',
  'Rejected':         '#EF4444',
}

// A single horizontal bar split into colored segments proportional to each
// segment's value, with a color-keyed legend beneath it. Pure pdfkit rect()
// calls — no charting library, no SVG layer.
const drawSegmentedBar = (doc, segments, { height = 14 } = {}) => {
  if (doc.y > doc.page.height - 100) doc.addPage()

  const total = segments.reduce((s, seg) => s + seg.value, 0)
  const y = doc.y

  doc.rect(MARGIN, y, CONTENT_W, height).fill('#F1F5F9')

  if (total > 0) {
    let x = MARGIN
    segments.filter((s) => s.value > 0).forEach((seg) => {
      const w = (seg.value / total) * CONTENT_W
      doc.rect(x, y, w, height).fill(seg.color)
      x += w
    })
  }

  doc.y = y + height + 8

  const legendItems = segments.filter((s) => s.value > 0)
  const ly = doc.y
  let lx = MARGIN
  doc.fontSize(8).font('Helvetica')
  legendItems.forEach((seg) => {
    doc.rect(lx, ly + 1, 7, 7).fill(seg.color)
    doc.fillColor(MUTED).text(seg.label, lx + 10, ly, { lineBreak: false })
    lx += 10 + doc.widthOfString(seg.label) + 16
  })

  doc.y = ly + 16
  doc.fillColor(DARK)
}

const drawBudgetBar = (doc, budget, spent) => {
  const withinBudget = Math.min(spent, budget)
  const overBudget   = Math.max(spent - budget, 0)
  const remaining     = Math.max(budget - spent, 0)

  drawSegmentedBar(doc, [
    { label: `Spent (${fmtCurrency(withinBudget)})`,      value: withinBudget, color: '#6366F1' },
    { label: `Over Budget (${fmtCurrency(overBudget)})`,  value: overBudget,   color: '#EF4444' },
    { label: `Remaining (${fmtCurrency(remaining)})`,      value: remaining,    color: '#E2E8F0' },
  ])
}

const drawReimbursementStatusBar = (doc, reimbursements) => {
  const counts = {}
  reimbursements.forEach((r) => { counts[r.status] = (counts[r.status] || 0) + 1 })

  drawSegmentedBar(doc, Object.entries(counts).map(([status, count]) => ({
    label: `${status} (${count})`,
    value: count,
    color: STATUS_COLORS[status] || '#94A3B8',
  })))
}

module.exports = { drawBudgetBar, drawReimbursementStatusBar }
