const nodemailer = require('nodemailer')

// ── Reusable transporter ──────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true', // true for port 465
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

// ── Send email verification ────────────────────────────────────────────────────
const sendVerificationEmail = async (to, name, token) => {
  const verifyUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email?token=${token}`

  await transporter.sendMail({
    from: `"SalesPilot" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to,
    subject: 'Verify your SalesPilot account',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:32px;border:1px solid #e2e8f0;border-radius:8px;">
        <h2 style="color:#4f46e5;margin-bottom:8px;">Welcome to SalesPilot, ${name}!</h2>
        <p style="color:#475569;line-height:1.6;">
          Thanks for signing up. Please verify your email address to activate your account.
          This link expires in <strong>24 hours</strong>.
        </p>
        <a href="${verifyUrl}"
           style="display:inline-block;margin:24px 0;padding:12px 28px;background:#4f46e5;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;">
          Verify Email Address
        </a>
        <p style="color:#94a3b8;font-size:12px;">
          If you didn't create an account, you can safely ignore this email.<br/>
          Or copy this link: <a href="${verifyUrl}" style="color:#4f46e5;">${verifyUrl}</a>
        </p>
      </div>
    `,
  })
}

const sendReimbursementNotification = async (to, name, event, reimbursement) => {
  const EVENTS = {
    head_approved:    { subject: 'Reimbursement Head-Approved',    color: '#F59E0B', label: 'Head Approved',    body: 'Your reimbursement has been approved by your manager and is pending finance review.' },
    finance_approved: { subject: 'Reimbursement Finance-Approved', color: '#8B5CF6', label: 'Finance Approved', body: 'Your reimbursement has been approved by finance and will be processed for payment shortly.' },
    rejected:         { subject: 'Reimbursement Rejected',         color: '#EF4444', label: 'Rejected',         body: 'Unfortunately, your reimbursement request has been rejected.' },
    paid:             { subject: 'Reimbursement Paid',             color: '#10B981', label: 'Paid',             body: 'Your reimbursement has been paid. Please check your account.' },
  }

  const ev = EVENTS[event]
  if (!ev) return

  const amount = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(reimbursement.totalAmount || 0)

  await transporter.sendMail({
    from: `"SalesPilot" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to,
    subject: `${ev.subject} — ${amount}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:32px;border:1px solid #e2e8f0;border-radius:8px;">
        <h2 style="color:${ev.color};margin-bottom:8px;">${ev.label}</h2>
        <p style="color:#475569;line-height:1.6;">Hi ${name}, ${ev.body}</p>
        <p style="color:#475569;">Amount: <strong>${amount}</strong></p>
        ${reimbursement.rejectionReason ? `<p style="color:#ef4444;font-size:13px;">Reason: ${reimbursement.rejectionReason}</p>` : ''}
        <p style="color:#94a3b8;font-size:12px;">This is an automated notification from SalesPilot.</p>
      </div>
    `,
  })
}

module.exports = { sendVerificationEmail, sendReimbursementNotification }
