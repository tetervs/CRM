const PDFDocument = require('pdfkit')
const {
  MARGIN, CONTENT_W,
  fmtDate, fmtDateTime, fmtCurrency,
  drawBanner, drawFooter, drawMeta, drawSectionHeader, drawField,
  DARK, LIGHT, BRAND, BORDER,
} = require('./pdfHelpers')

const TABLE_HDR_BG = '#F1F5F9'
const TABLE_HDR_FG = '#334155'

const drawTableHeader = (doc, cols) => {
  const y = doc.y
  doc.rect(MARGIN, y, CONTENT_W, 18).fill(TABLE_HDR_BG)
  let x = MARGIN + 6
  cols.forEach(({ label, width }) => {
    doc.fontSize(8).font('Helvetica-Bold').fillColor(TABLE_HDR_FG)
      .text(label, x, y + 4, { width: width - 6, lineBreak: false })
    x += width
  })
  doc.moveDown(0.1)
  doc.y = y + 22
  doc.fillColor(DARK)
}

const drawTableRow = (doc, cols, values, shade) => {
  if (doc.y > doc.page.height - 80) { doc.addPage() }
  const y = doc.y
  if (shade) {
    doc.rect(MARGIN, y, CONTENT_W, 16).fill('#F8FAFC')
  }
  let x = MARGIN + 6
  cols.forEach(({ width }, i) => {
    doc.fontSize(8).font('Helvetica').fillColor(DARK)
      .text(String(values[i] ?? '—'), x, y + 3, { width: width - 10, lineBreak: false })
    x += width
  })
  doc.y = y + 18
}

const renderProjectPdf = (project, reimbursements, manpowerPulls, branding) => {
  return new Promise((resolve, reject) => {
    try {
      let pageNum = 0

      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 90, bottom: 60, left: MARGIN, right: MARGIN },
        autoFirstPage: false,
      })

      const chunks = []
      doc.on('data',  (c) => chunks.push(c))
      doc.on('error', reject)
      doc.on('end',   () => resolve(Buffer.concat(chunks)))
      doc.on('pageAdded', () => {
        pageNum++
        drawFooter(doc, pageNum)
        drawBanner(doc, branding)
      })

      doc.addPage()

      doc.moveDown(0.4)
      drawMeta(doc, branding)

      // ── Project Overview ──────────────────────────────────────────────────────
      drawSectionHeader(doc, 'Project Overview')

      drawField(doc, 'Project Name',   project.title)
      drawField(doc, 'Project ID',     project.projectId || '—')
      drawField(doc, 'Department',     project.department?.name)
      drawField(doc, 'Status',         project.status)
      drawField(doc, 'Project Head',   project.projectHead?.name)
      drawField(doc, 'Created',        fmtDate(project.createdAt))
      if (project.completedAt) {
        drawField(doc, 'Completed',    fmtDate(project.completedAt))
      }
      if (project.lead) {
        drawField(doc, 'Source Lead',  project.lead?.title || '—')
      }

      // ── Budget Summary ────────────────────────────────────────────────────────
      drawSectionHeader(doc, 'Budget & Financials')

      const totalExpenses = project.expenses?.reduce((s, e) => s + e.amount, 0) || 0
      const profit = project.budget - totalExpenses

      drawField(doc, 'Budget',          fmtCurrency(project.budget))
      drawField(doc, 'Total Expenses',  fmtCurrency(totalExpenses))
      drawField(doc, 'Remaining',       fmtCurrency(profit))

      // ── Expenses Table ────────────────────────────────────────────────────────
      if (project.expenses?.length) {
        doc.moveDown(0.4)
        const expCols = [
          { label: 'Description',  width: 220 },
          { label: 'Amount (₹)',   width: 100 },
          { label: 'Logged By',    width: 110 },
          { label: 'Date',         width: 65  },
        ]
        drawTableHeader(doc, expCols)
        project.expenses.forEach((e, i) => {
          drawTableRow(doc, expCols, [
            e.description,
            fmtCurrency(e.amount),
            e.loggedBy?.name || '—',
            fmtDate(e.date),
          ], i % 2 === 0)
        })
      }

      // ── Team Members ──────────────────────────────────────────────────────────
      drawSectionHeader(doc, 'Team')

      const teamCols = [
        { label: 'Name',   width: 180 },
        { label: 'Role',   width: 120 },
        { label: 'Email',  width: 195 },
      ]
      drawTableHeader(doc, teamCols)

      // Project head first
      drawTableRow(doc, teamCols, [
        project.projectHead?.name || '—',
        'manager (Project Head)',
        project.projectHead?.email || '—',
      ], false)

      project.teamMembers?.forEach((m, i) => {
        drawTableRow(doc, teamCols, [
          m.name || '—',
          m.role || '—',
          m.email || '—',
        ], (i + 1) % 2 === 0)
      })

      // ── Manpower Pulled ───────────────────────────────────────────────────────
      if (manpowerPulls?.length) {
        drawSectionHeader(doc, 'Manpower Pulled')

        const mpCols = [
          { label: 'Name',        width: 170 },
          { label: 'Type',        width: 80  },
          { label: 'Pulled By',   width: 130 },
          { label: 'Reason',      width: 110 },
          { label: 'Date',        width: 5   }, // remainder
        ]
        // Fix last col width
        mpCols[4].width = CONTENT_W - mpCols.slice(0, 4).reduce((s, c) => s + c.width, 0)

        drawTableHeader(doc, mpCols)
        manpowerPulls.forEach((p, i) => {
          const name = p.employeeType === 'freelancer'
            ? (p.freelancerName || 'Freelancer')
            : (p.pulledEmployee?.name || '—')
          drawTableRow(doc, mpCols, [
            name,
            p.employeeType,
            p.pulledBy?.name || '—',
            p.reason || '—',
            fmtDate(p.createdAt),
          ], i % 2 === 0)
        })
      }

      // ── Linked Reimbursements ─────────────────────────────────────────────────
      if (reimbursements?.length) {
        drawSectionHeader(doc, 'Linked Reimbursements')

        const reimCols = [
          { label: 'Submitted By',   width: 130 },
          { label: 'Submitted On',   width: 90  },
          { label: 'Items',          width: 155 },
          { label: 'Total (₹)',      width: 75  },
          { label: 'Status',         width: 45  }, // remainder
        ]
        reimCols[4].width = CONTENT_W - reimCols.slice(0, 4).reduce((s, c) => s + c.width, 0)

        drawTableHeader(doc, reimCols)
        reimbursements.forEach((r, i) => {
          drawTableRow(doc, reimCols, [
            r.submittedBy?.name || '—',
            fmtDate(r.createdAt),
            r.items.map((it) => it.description).join(', '),
            fmtCurrency(r.totalAmount),
            r.status,
          ], i % 2 === 0)
        })

        // Reimbursement total line
        doc.moveDown(0.3)
        const reimTotal = reimbursements.reduce((s, r) => s + r.totalAmount, 0)
        const y = doc.y
        doc.fontSize(9).font('Helvetica-Bold').fillColor(DARK)
          .text(`Total Reimbursements: ${fmtCurrency(reimTotal)}`, MARGIN, y, { align: 'right', width: CONTENT_W })
        doc.moveDown(0.4)
      }

      // ── Progress Updates ──────────────────────────────────────────────────────
      if (project.progressUpdates?.length) {
        drawSectionHeader(doc, 'Progress Updates')

        const updates = [...project.progressUpdates].reverse()
        updates.forEach((u, i) => {
          if (doc.y > doc.page.height - 80) { doc.addPage() }
          const y = doc.y

          doc.circle(MARGIN + 4, y + 4, 3).fill('#64748B')

          doc.fontSize(9).font('Helvetica').fillColor(DARK)
            .text(u.note, MARGIN + 14, y, { width: CONTENT_W - 14 })

          doc.fontSize(8).font('Helvetica').fillColor(LIGHT)
            .text(
              [u.updatedBy?.name, fmtDateTime(u.timestamp)].filter(Boolean).join(' · '),
              MARGIN + 14, doc.y,
              { width: CONTENT_W - 14 }
            )

          doc.moveDown(i < updates.length - 1 ? 0.5 : 0.2)
        })
      }

      doc.end()
    } catch (err) {
      reject(err)
    }
  })
}

module.exports = { renderProjectPdf }
