const { body, param } = require('express-validator')

// ─── Shared reusable rules ────────────────────────────────────────────────────

const mongoId = (field = 'id') =>
  param(field).isMongoId().withMessage(`${field} must be a valid ID`)

// ─── Auth ─────────────────────────────────────────────────────────────────────

const ALLOWED_DOMAIN = 'in-quest.co.in'

const registerRules = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ max: 100 }).withMessage('Name must be at most 100 characters')
    .matches(/^[\p{L}\p{N} .'-]+$/u).withMessage('Name contains invalid characters'),

  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Must be a valid email address')
    .isLength({ max: 254 }).withMessage('Email is too long')
    .normalizeEmail()
    .custom((email) => {
      const allowedEmails = ['adityateterve@gmail.com']
      if (!email.endsWith(`@${ALLOWED_DOMAIN}`) && !allowedEmails.includes(email.toLowerCase())) {
        throw new Error('Not permitted to register')
      }
      return true
    }),

  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 6, max: 128 }).withMessage('Password must be 6–128 characters'),

]

const loginRules = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Must be a valid email address')
    .isLength({ max: 254 }).withMessage('Email is too long')
    .normalizeEmail(),

  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ max: 128 }).withMessage('Password is too long'),
]

// ─── Leads ──────────────────────────────────────────────────────────────────

const VALID_STATUSES = ['New', 'Contacted', 'Proposal Sent', 'Won', 'Lost']

const createLeadRules = [
  body('title')
    .trim()
    .notEmpty().withMessage('Title is required')
    .isLength({ max: 200 }).withMessage('Title must be at most 200 characters'),

  body('contactName')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 100 }).withMessage('Contact name must be at most 100 characters'),

  body('contactEmail')
    .optional({ checkFalsy: true })
    .trim()
    .isEmail().withMessage('Contact email must be a valid email')
    .isLength({ max: 254 }).withMessage('Contact email is too long')
    .normalizeEmail(),

  body('contactPhone')
    .optional({ checkFalsy: true })
    .trim()
    .matches(/^[\d\s\+\-\(\)\.]{0,20}$/).withMessage('Phone number is invalid'),

  body('dealValue')
    .optional()
    .isFloat({ min: 0, max: 1_000_000_000 }).withMessage('Deal value must be a positive number up to 1 billion'),

  body('status')
    .optional()
    .isIn(VALID_STATUSES).withMessage(`Status must be one of: ${VALID_STATUSES.join(', ')}`),

  body('notes')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 2000 }).withMessage('Notes must be at most 2000 characters'),

  body('tags')
    .optional()
    .isArray({ max: 20 }).withMessage('Tags must be an array of at most 20 items'),

  body('tags.*')
    .optional()
    .trim()
    .isLength({ max: 50 }).withMessage('Each tag must be at most 50 characters')
    .matches(/^[\w\s\-]+$/).withMessage('Tags can only contain letters, numbers, spaces, and hyphens'),
]

const updateLeadRules = [
  mongoId(),
  body('title')
    .optional()
    .trim()
    .notEmpty().withMessage('Title cannot be empty')
    .isLength({ max: 200 }).withMessage('Title must be at most 200 characters'),
  body('contactName')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 100 }).withMessage('Contact name must be at most 100 characters'),
  body('contactEmail')
    .optional({ checkFalsy: true })
    .trim()
    .isEmail().withMessage('Contact email must be a valid email')
    .isLength({ max: 254 }).withMessage('Contact email is too long')
    .normalizeEmail(),
  body('contactPhone')
    .optional({ checkFalsy: true })
    .trim()
    .matches(/^[\d\s\+\-\(\)\.]{0,20}$/).withMessage('Phone number is invalid'),
  body('dealValue')
    .optional()
    .isFloat({ min: 0, max: 1_000_000_000 }).withMessage('Deal value must be a positive number up to 1 billion'),
  body('status')
    .optional()
    .isIn(VALID_STATUSES).withMessage(`Status must be one of: ${VALID_STATUSES.join(', ')}`),
  body('notes')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 2000 }).withMessage('Notes must be at most 2000 characters'),
  body('tags')
    .optional()
    .isArray({ max: 20 }).withMessage('Tags must be an array of at most 20 items'),
  body('tags.*')
    .optional()
    .trim()
    .isLength({ max: 50 }).withMessage('Each tag must be at most 50 characters')
    .matches(/^[\w\s\-]+$/).withMessage('Tags can only contain letters, numbers, spaces, and hyphens'),
]

const statusRules = [
  mongoId(),
  body('status')
    .notEmpty().withMessage('Status is required')
    .isIn(VALID_STATUSES).withMessage(`Status must be one of: ${VALID_STATUSES.join(', ')}`),
]

// ─── Users ────────────────────────────────────────────────────────────────────

const updateRoleRules = [
  mongoId(),
  body('role')
    .notEmpty().withMessage('Role is required')
    .isIn(['finance_head', 'admin', 'manager', 'sales', 'employee']).withMessage('Role must be finance_head, admin, manager, sales, or employee'),
]

// ─── Departments ──────────────────────────────────────────────────────────────

const departmentCreateRules = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ max: 100 }).withMessage('Name must be at most 100 characters'),
  body('code')
    .trim()
    .notEmpty().withMessage('Code is required')
    .isLength({ max: 20 }).withMessage('Code must be at most 20 characters')
    .matches(/^[A-Za-z0-9_-]+$/).withMessage('Code must contain only letters, numbers, underscores, or hyphens'),
]

const departmentUpdateRules = [
  mongoId(),
  body('name')
    .optional()
    .trim()
    .notEmpty().withMessage('Name cannot be empty')
    .isLength({ max: 100 }).withMessage('Name must be at most 100 characters'),
  body('code')
    .optional()
    .trim()
    .isLength({ max: 20 }).withMessage('Code must be at most 20 characters')
    .matches(/^[A-Za-z0-9_-]+$/).withMessage('Code must contain only letters, numbers, underscores, or hyphens'),
]

// ─── Projects ────────────────────────────────────────────────────────────────

const PROJECT_STATUSES = ['Active', 'On Hold', 'Completed']

const convertLeadRules = [
  mongoId(),
  body('projectHeadId')
    .notEmpty().withMessage('Project head is required')
    .isMongoId().withMessage('projectHeadId must be a valid ID'),
  body('budget')
    .optional()
    .isFloat({ min: 0 }).withMessage('Budget must be a non-negative number'),
]

const projectStatusRules = [
  body('status')
    .notEmpty().withMessage('Status is required')
    .isIn(PROJECT_STATUSES).withMessage(`Status must be one of: ${PROJECT_STATUSES.join(', ')}`),
]

const progressUpdateRules = [
  body('note')
    .trim()
    .notEmpty().withMessage('Note is required')
    .isLength({ max: 1000 }).withMessage('Note must be at most 1000 characters'),
]

const expenseRules = [
  body('description')
    .trim()
    .notEmpty().withMessage('Description is required')
    .isLength({ max: 200 }).withMessage('Description must be at most 200 characters'),
  body('amount')
    .notEmpty().withMessage('Amount is required')
    .isFloat({ min: 0 }).withMessage('Amount must be a non-negative number'),
]

// ─── Reimbursements ──────────────────────────────────────────────────────────

const reimbursementCreateRules = [
  body('items')
    .isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.description')
    .trim()
    .notEmpty().withMessage('Item description is required')
    .isLength({ max: 200 }).withMessage('Item description must be at most 200 characters'),
  body('items.*.amount')
    .isFloat({ min: 0.01 }).withMessage('Item amount must be greater than 0'),
  body('notes')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 1000 }).withMessage('Notes must be at most 1000 characters'),
]

const reimbursementActionRules = [
  mongoId(),
  body('reason')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 500 }).withMessage('Reason must be at most 500 characters'),
]

module.exports = {
  registerRules,
  loginRules,
  createLeadRules,
  updateLeadRules,
  statusRules,
  updateRoleRules,
  departmentCreateRules,
  departmentUpdateRules,
  convertLeadRules,
  projectStatusRules,
  progressUpdateRules,
  expenseRules,
  reimbursementCreateRules,
  reimbursementActionRules,
  mongoId,
}
