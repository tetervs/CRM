const PDFDocument = require('pdfkit')
const {
  MARGIN, CONTENT_W,
  fmtDate, fmtDateTime, fmtCurrency,
  drawBanner, drawMeta, drawSectionHeader, drawField, drawDivider, addPageNumbers,
  DARK, MUTED, LIGHT, BRAND, BORDER,
} = require('./pdfHelpers')

const renderLeadPdf = (lead, branding) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        bufferPages: true,
        size: 'A4',
        margins: { top: 90, bottom: 60, left: MARGIN, right: MARGIN },
      })

      const chunks = []
      doc.on('data',  (c) => chunks.push(c))
      doc.on('error', reject)
      doc.on('end',   () => resolve(Buffer.concat(chunks)))

      // Banner on first page; repeat on subsequent pages via event
      drawBanner(doc, branding)
      doc.on('pageAdded', () => drawBanner(doc, branding))

      doc.moveDown(0.4)
      drawMeta(doc, branding)

      // ── Lead Details ─────────────────────────────────────────────────────────
      drawSectionHeader(doc, 'Lead Details')

      drawField(doc, 'Lead / Company',  lead.title)
      drawField(doc, 'Contact Name',    lead.contactName)
      drawField(doc, 'Contact Email',   lead.contactEmail)
      drawField(doc, 'Contact Phone',   lead.contactPhone)
      drawField(doc, 'Status',          lead.status)
      drawField(doc, 'Deal Value',      fmtCurrency(lead.dealValue))
      drawField(doc, 'Owner',           lead.owner?.name)
      drawField(doc, 'Created',         fmtDateTime(lead.createdAt))
      if (lead.followUpDate) {
        drawField(doc, 'Follow-up Date', fmtDate(lead.followUpDate))
      }
      if (lead.tags?.length) {
        drawField(doc, 'Tags', lead.tags.join(', '))
      }

      // ── Notes ────────────────────────────────────────────────────────────────
      if (lead.notes?.trim()) {
        drawSectionHeader(doc, 'Notes')
        doc.fontSize(9).font('Helvetica').fillColor(DARK)
          .text(lead.notes.trim(), MARGIN, doc.y, { width: CONTENT_W })
        doc.moveDown(0.4)
      }

      // ── Activity Log ─────────────────────────────────────────────────────────
      drawSectionHeader(doc, 'Activity Log')

      if (lead.activityLog?.length) {
        const log = [...lead.activityLog].reverse() // most recent first
        log.forEach((entry, i) => {
          if (doc.y > doc.page.height - 80) { doc.addPage() }

          const y = doc.y

          // Bullet dot
          doc.circle(MARGIN + 4, y + 4, 3).fill('#64748B')

          // Action text
          doc.fontSize(9).font('Helvetica').fillColor(DARK)
            .text(entry.action, MARGIN + 14, y, { width: CONTENT_W - 14 })

          // By / when
          const byLine = [
            entry.performedBy?.name,
            fmtDateTime(entry.timestamp),
          ].filter(Boolean).join(' · ')

          doc.fontSize(8).font('Helvetica').fillColor(LIGHT)
            .text(byLine, MARGIN + 14, doc.y, { width: CONTENT_W - 14 })

          doc.moveDown(i < log.length - 1 ? 0.4 : 0.2)
          if (i < log.length - 1) {
            doc.moveTo(MARGIN + 4, doc.y)
              .lineTo(MARGIN + 4, doc.y + 8)
              .strokeColor(BORDER).lineWidth(0.8).stroke()
            doc.moveDown(0.35)
          }
        })
      } else {
        doc.fontSize(9).fillColor(LIGHT).text('No activity recorded.', MARGIN, doc.y)
        doc.moveDown(0.4)
      }

      // ── Page numbers ──────────────────────────────────────────────────────────
      addPageNumbers(doc)
      doc.flushPages()
      doc.end()
    } catch (err) {
      reject(err)
    }
  })
}

module.exports = { renderLeadPdf }
