# Reimbursement Proof Uploads + Project Department & ID Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Cloudinary-backed image proof uploads to reimbursements, and department assignment + auto-generated unique project IDs when converting a lead to a project.

**Architecture:** Feature 1 — multer streams uploaded images to Cloudinary on `POST /reimbursements`; URLs stored in `proofFiles: [String]` on the Reimbursement model; displayed as a clickable thumbnail grid in ReimbursementDetail. Feature 2 — `convertToProject` accepts `departmentId`, counts existing projects per department to sequence the ID, and stores `projectId` (format `INQ/DEPT/PN/MONYY`) on the Project model; displayed as a badge in ProjectDetail header and as a subtitle in the Projects list.

**Tech Stack:** Node.js/Express, Mongoose, multer v1, multer-storage-cloudinary v4, cloudinary SDK v2, React, Zustand, Tailwind CSS

---

## File Map

**Create:**
- `backend/config/cloudinary.js` — Cloudinary SDK v2 init
- `backend/middleware/upload.js` — multer + CloudinaryStorage middleware (images only, max 10)
- `backend/utils/projectId.js` — pure `generateProjectId(deptCode, count, date)` function
- `backend/tests/projectId.test.js` — Jest unit tests for ID generation

**Modify:**
- `backend/models/Reimbursement.js` — add `proofFiles: [String]`
- `backend/models/Project.js` — add `department: ref Department (required)`, `projectId: String (unique, sparse)`
- `backend/routes/reimbursementRoutes.js` — prepend upload middleware to POST; remove `reimbursementCreateRules, validate` (incompatible with multipart)
- `backend/controllers/reimbursementController.js` — parse `items` from JSON string, validate inline, store `req.files` URLs
- `backend/controllers/leadController.js` — accept `departmentId`, use `generateProjectId`, populate `department` in response
- `backend/controllers/projectController.js` — add `.populate('department', 'name code')` in `getProject` and `getProjects`
- `backend/middleware/validators.js` — add `departmentId` to `convertLeadRules`
- `frontend/src/store/reimbursementStore.js` — `createReimbursement` passes FormData straight to axios
- `frontend/src/pages/NewReimbursement.jsx` — add "Proof of Spending" card with file picker + thumbnails; submit as FormData
- `frontend/src/pages/ReimbursementDetail.jsx` — add "Proof of Spending" card with thumbnail grid
- `frontend/src/pages/LeadDetail.jsx` — add department dropdown in convert modal; pass `departmentId`
- `frontend/src/pages/ProjectDetail.jsx` — display `project.projectId` badge in header
- `frontend/src/pages/Projects.jsx` — show `project.projectId` subtitle on each project card

---

## Task 1: Install backend dependencies

**Files:**
- Run in: `backend/`

- [ ] **Step 1: Install packages**

```bash
cd backend && npm install cloudinary multer multer-storage-cloudinary
```

Expected output: packages added, no peer-dep errors.

- [ ] **Step 2: Verify install**

```bash
cd backend && node -e "require('cloudinary'); require('multer'); require('multer-storage-cloudinary'); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/package.json backend/package-lock.json
git commit -m "chore: install cloudinary, multer, multer-storage-cloudinary"
```

---

## Task 2: Create Cloudinary config

**Files:**
- Create: `backend/config/cloudinary.js`

- [ ] **Step 1: Create the file**

`backend/config/cloudinary.js`:
```js
const cloudinary = require('cloudinary').v2

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

module.exports = cloudinary
```

- [ ] **Step 2: Verify config loads**

```bash
cd backend && node -e "
require('dotenv').config()
const c = require('./config/cloudinary')
console.log('cloud_name:', c.config().cloud_name)
"
```

Expected: prints your Cloudinary cloud name (not undefined).

- [ ] **Step 3: Commit**

```bash
git add backend/config/cloudinary.js
git commit -m "feat: add Cloudinary SDK config"
```

---

## Task 3: Create upload middleware

**Files:**
- Create: `backend/middleware/upload.js`

- [ ] **Step 1: Create the file**

`backend/middleware/upload.js`:
```js
const multer = require('multer')
const { CloudinaryStorage } = require('multer-storage-cloudinary')
const cloudinary = require('../config/cloudinary')

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder:          'reimbursements',
    resource_type:   'image',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
  },
})

const upload = multer({
  storage,
  limits: { files: 10 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true)
    } else {
      cb(Object.assign(new Error('Only image files are allowed'), { status: 400 }), false)
    }
  },
})

module.exports = upload
```

- [ ] **Step 2: Verify module loads without error**

```bash
cd backend && node -e "require('dotenv').config(); require('./middleware/upload'); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/middleware/upload.js
git commit -m "feat: add multer-cloudinary upload middleware"
```

---

## Task 4: Update Reimbursement model

**Files:**
- Modify: `backend/models/Reimbursement.js`

- [ ] **Step 1: Add proofFiles field**

In `backend/models/Reimbursement.js`, add `proofFiles` to the schema. The full schema block should now read:

```js
const reimbursementSchema = new mongoose.Schema({
  submittedBy:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  items:             [itemSchema],
  totalAmount:       { type: Number, required: true, min: 0 },
  status:            { type: String, enum: ['Pending', 'Head Approved', 'Finance Approved', 'Rejected', 'Paid'], default: 'Pending' },
  notes:             { type: String, maxlength: 1000 },
  rejectionReason:   { type: String, maxlength: 500 },
  headReviewedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  headReviewedAt:    { type: Date },
  financeReviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  financeReviewedAt: { type: Date },
  paidBy:            { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  paidAt:            { type: Date },
  project:           { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  proofFiles:        [{ type: String }],
}, { timestamps: true })
```

- [ ] **Step 2: Verify model loads**

```bash
cd backend && node -e "require('dotenv').config(); const R = require('./models/Reimbursement'); console.log('proofFiles path:', R.schema.path('proofFiles')?.instance)"
```

Expected: `proofFiles path: Array`

- [ ] **Step 3: Commit**

```bash
git add backend/models/Reimbursement.js
git commit -m "feat: add proofFiles field to Reimbursement model"
```

---

## Task 5: Update POST /reimbursements route

**Files:**
- Modify: `backend/routes/reimbursementRoutes.js`

The `reimbursementCreateRules` validator uses `body('items').isArray()` which fails with multipart/form-data (items arrives as a JSON string). Remove it from the POST route and add the upload middleware instead. Validation moves to the controller.

- [ ] **Step 1: Update the route file**

Replace the entire `backend/routes/reimbursementRoutes.js` with:

```js
const router = require('express').Router()
const {
  getReimbursements, createReimbursement, getReimbursement,
  headApprove, financeApprove, rejectReimbursement, markPaid,
} = require('../controllers/reimbursementController')
const { protect } = require('../middleware/authMiddleware')
const { requireRole } = require('../middleware/roleMiddleware')
const { reimbursementActionRules, mongoId } = require('../middleware/validators')
const validate = require('../middleware/validate')
const upload = require('../middleware/upload')

router.use(protect)

router.get('/',    getReimbursements)
router.post('/',   upload.array('proofFiles', 10), createReimbursement)
router.get('/:id', mongoId(), validate, getReimbursement)

router.patch('/:id/head-approve',
  mongoId(), validate,
  requireRole('finance_head', 'admin', 'manager'),
  headApprove)

router.patch('/:id/finance-approve',
  mongoId(), validate,
  requireRole('finance_head', 'admin'),
  financeApprove)

router.patch('/:id/reject',
  reimbursementActionRules, validate,
  requireRole('finance_head', 'admin', 'manager'),
  rejectReimbursement)

router.patch('/:id/pay',
  mongoId(), validate,
  requireRole('finance_head', 'admin'),
  markPaid)

module.exports = router
```

- [ ] **Step 2: Verify server starts**

```bash
cd backend && node -e "require('dotenv').config(); require('./routes/reimbursementRoutes'); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/routes/reimbursementRoutes.js
git commit -m "feat: add upload middleware to POST /reimbursements route"
```

---

## Task 6: Update createReimbursement controller

**Files:**
- Modify: `backend/controllers/reimbursementController.js`

With multipart, `req.body.items` is a JSON string, not an array. Parse it and validate inline. Uploaded file URLs are in `req.files` (each has `.path` = Cloudinary secure URL).

- [ ] **Step 1: Replace the createReimbursement function**

In `backend/controllers/reimbursementController.js`, replace the `createReimbursement` function with:

```js
const createReimbursement = async (req, res) => {
  try {
    let items
    try {
      items = typeof req.body.items === 'string' ? JSON.parse(req.body.items) : req.body.items
    } catch {
      return res.status(400).json({ message: 'items must be a valid JSON array' })
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'At least one item is required' })
    }

    const validItems = items.filter((i) => i.description?.trim() && Number(i.amount) > 0)
    if (validItems.length === 0) {
      return res.status(400).json({ message: 'Each item needs a description and amount greater than 0' })
    }

    const { notes, projectId } = req.body
    const totalAmount = validItems.reduce((sum, item) => sum + Number(item.amount), 0)
    const proofFiles  = (req.files || []).map((f) => f.path)

    const reimbursement = await Reimbursement.create({
      submittedBy: req.user._id,
      items: validItems.map((i) => ({ description: i.description, amount: Number(i.amount) })),
      totalAmount,
      notes,
      proofFiles,
      ...(projectId ? { project: projectId } : {}),
    })
    await reimbursement.populate('submittedBy', 'name email role')

    if (projectId) {
      const project = await Project.findById(projectId)
      if (project && project.projectHead) {
        createNotification({
          recipientId: project.projectHead,
          message:     `New reimbursement request submitted for project "${project.title}" by ${req.user.name}`,
          type:        'reimbursement',
          link:        `/reimbursements/${reimbursement._id}`,
        })
      }
    }

    res.status(201).json(reimbursement)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}
```

- [ ] **Step 2: Start the backend and submit a test reimbursement without files**

```bash
cd backend && npm run dev
```

In another terminal:
```bash
curl -s -X POST http://localhost:5000/api/reimbursements \
  -H "Authorization: Bearer <your_token>" \
  -F 'items=[{"description":"Test item","amount":100}]' \
  -F 'notes=test' | jq .
```

Expected: `201` response with `proofFiles: []`.

- [ ] **Step 3: Test with an image file**

```bash
curl -s -X POST http://localhost:5000/api/reimbursements \
  -H "Authorization: Bearer <your_token>" \
  -F 'items=[{"description":"Receipt","amount":200}]' \
  -F 'proofFiles=@/path/to/test-image.jpg' | jq .proofFiles
```

Expected: array with one Cloudinary HTTPS URL.

- [ ] **Step 4: Commit**

```bash
git add backend/controllers/reimbursementController.js
git commit -m "feat: update createReimbursement to handle multipart and store proof file URLs"
```

---

## Task 7: Update reimbursementStore to pass FormData

**Files:**
- Modify: `frontend/src/store/reimbursementStore.js`

The page will build `FormData` and pass it directly. The store just forwards it to axios, which auto-sets `Content-Type: multipart/form-data` when given a `FormData` object.

- [ ] **Step 1: The createReimbursement action requires no change**

The existing action already works:
```js
createReimbursement: async (payload) => {
  const { data } = await api.post('/reimbursements', payload)
  set((s) => ({ reimbursements: [data, ...s.reimbursements] }))
  return data
},
```

`payload` will now be a `FormData` instance. Axios detects this and sets the correct Content-Type automatically. No changes needed here.

- [ ] **Step 2: Verify**

Open `frontend/src/store/reimbursementStore.js` and confirm `createReimbursement` passes `payload` to `api.post` without modification. No edit required.

---

## Task 8: Add file upload UI to NewReimbursement

**Files:**
- Modify: `frontend/src/pages/NewReimbursement.jsx`

- [ ] **Step 1: Add file state and handlers**

At the top of the `NewReimbursement` component (after the existing `useState` declarations), add:

```js
const [proofFiles, setProofFiles] = useState([])

const handleFileChange = (e) => {
  const picked = Array.from(e.target.files)
  setProofFiles((prev) => {
    const combined = [...prev, ...picked]
    return combined.slice(0, 10)
  })
  e.target.value = ''
}

const removeFile = (index) => setProofFiles((prev) => prev.filter((_, i) => i !== index))
```

- [ ] **Step 2: Update handleSubmit to build FormData**

Replace the existing `handleSubmit` function with:

```js
const handleSubmit = async (e) => {
  e.preventDefault()
  setError('')
  const validItems = items.filter((i) => i.description.trim() && Number(i.amount) > 0)
  if (validItems.length === 0) {
    setError('Add at least one item with a description and amount.')
    return
  }
  setSubmitting(true)
  try {
    const fd = new FormData()
    fd.append('items', JSON.stringify(validItems))
    if (notes) fd.append('notes', notes)
    if (prefilledProjectId) fd.append('projectId', prefilledProjectId)
    proofFiles.forEach((file) => fd.append('proofFiles', file))

    const result = await createReimbursement(fd)
    navigate(`/reimbursements/${result._id}`)
  } catch (err) {
    setError(err.response?.data?.message || 'Failed to submit reimbursement')
    setSubmitting(false)
  }
}
```

- [ ] **Step 3: Add the Proof of Spending Card to the JSX**

Add this card between the "Notes" card and the submit buttons (after the closing `</Card>` of the Notes section):

```jsx
<Card title="Proof of Spending (optional)">
  <div className="space-y-3">
    {proofFiles.length < 10 && (
      <label className="flex items-center gap-2 cursor-pointer text-sm text-brand-primary hover:text-brand-hover font-medium">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add images ({proofFiles.length}/10)
        <input
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
      </label>
    )}

    {proofFiles.length > 0 && (
      <div className="flex flex-wrap gap-2">
        {proofFiles.map((file, i) => (
          <div key={i} className="relative group">
            <img
              src={URL.createObjectURL(file)}
              alt={file.name}
              className="w-20 h-20 object-cover rounded-lg border border-surface-border"
            />
            <button
              type="button"
              onClick={() => removeFile(i)}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    )}
  </div>
</Card>
```

- [ ] **Step 4: Smoke test in browser**

```bash
cd frontend && npm run dev
```

1. Navigate to New Reimbursement.
2. Add an expense item.
3. Click "Add images" and select 2 screenshots — confirm thumbnails appear.
4. Click ✕ on one — confirm it's removed.
5. Submit — confirm redirect to ReimbursementDetail.
6. In MongoDB or Cloudinary dashboard, confirm `proofFiles` array has the URL.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/NewReimbursement.jsx
git commit -m "feat: add image proof upload UI to new reimbursement form"
```

---

## Task 9: Add proof card to ReimbursementDetail

**Files:**
- Modify: `frontend/src/pages/ReimbursementDetail.jsx`

- [ ] **Step 1: Add the Proof of Spending Card**

In the `lg:col-span-2` column, add this card after the closing `</Card>` of the "Notes" card (before the "Actions" card):

```jsx
{r.proofFiles?.length > 0 && (
  <Card title="Proof of Spending">
    <div className="flex flex-wrap gap-2">
      {r.proofFiles.map((url, i) => (
        <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="shrink-0">
          <img
            src={url}
            alt={`Proof ${i + 1}`}
            className="w-20 h-20 object-cover rounded-lg border border-surface-border hover:opacity-80 transition-opacity"
          />
        </a>
      ))}
    </div>
  </Card>
)}
```

- [ ] **Step 2: Test in browser**

1. Open a reimbursement that has `proofFiles`.
2. Confirm thumbnail grid appears below the Notes card.
3. Click a thumbnail — confirm it opens the full image in a new tab.
4. Open a reimbursement with no files — confirm the card does not render.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/ReimbursementDetail.jsx
git commit -m "feat: show proof of spending thumbnails in reimbursement detail"
```

---

## Task 10: Update Project model

**Files:**
- Modify: `backend/models/Project.js`

- [ ] **Step 1: Add department and projectId fields**

Replace `backend/models/Project.js` with:

```js
const mongoose = require('mongoose')

const expenseSchema = new mongoose.Schema({
  description: { type: String, required: true, maxlength: 200 },
  amount:      { type: Number, required: true, min: 0 },
  loggedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  date:        { type: Date, default: Date.now },
}, { _id: false })

const progressSchema = new mongoose.Schema({
  note:      { type: String, required: true, maxlength: 1000 },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  timestamp: { type: Date, default: Date.now },
}, { _id: false })

const projectSchema = new mongoose.Schema({
  title:           { type: String, required: true, trim: true },
  lead:            { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true },
  projectHead:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  department:      { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
  projectId:       { type: String, unique: true, sparse: true },
  status:          { type: String, enum: ['Active', 'On Hold', 'Completed'], default: 'Active' },
  teamMembers:     [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  budget:          { type: Number, default: 0, min: 0 },
  expenses:        [expenseSchema],
  progressUpdates: [progressSchema],
  completedAt:     { type: Date, default: null },
}, { timestamps: true })

projectSchema.index({ projectHead: 1, status: 1 })

module.exports = mongoose.model('Project', projectSchema)
```

- [ ] **Step 2: Verify model loads**

```bash
cd backend && node -e "require('dotenv').config(); const P = require('./models/Project'); console.log('department:', P.schema.path('department')?.instance, '| projectId:', P.schema.path('projectId')?.instance)"
```

Expected: `department: ObjectID | projectId: String`

- [ ] **Step 3: Commit**

```bash
git add backend/models/Project.js
git commit -m "feat: add department and projectId fields to Project model"
```

---

## Task 11: Create generateProjectId utility + Jest tests

**Files:**
- Create: `backend/utils/projectId.js`
- Create: `backend/tests/projectId.test.js`

- [ ] **Step 1: Create the utility function**

`backend/utils/projectId.js`:
```js
const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']

/**
 * @param {string} deptCode  - uppercase department code e.g. "FIS"
 * @param {number} count     - existing project count for this department (0-indexed → P1 for first)
 * @param {Date}   date      - defaults to now; controls MON and YY segment
 */
function generateProjectId(deptCode, count, date = new Date()) {
  const mon = MONTHS[date.getMonth()]
  const yy  = String(date.getFullYear()).slice(-2)
  return `INQ/${deptCode}/P${count + 1}/${mon}${yy}`
}

module.exports = { generateProjectId }
```

- [ ] **Step 2: Set up Jest**

```bash
cd backend && npm install --save-dev jest
```

Add to `backend/package.json` under `"scripts"`:
```json
"test": "jest"
```

- [ ] **Step 3: Write the failing tests**

`backend/tests/projectId.test.js`:
```js
const { generateProjectId } = require('../utils/projectId')

describe('generateProjectId', () => {
  test('first project in a department is P1', () => {
    const date = new Date('2026-05-11')
    expect(generateProjectId('FIS', 0, date)).toBe('INQ/FIS/P1/MAY26')
  })

  test('sequential numbering: third project is P3', () => {
    const date = new Date('2026-05-11')
    expect(generateProjectId('FIS', 2, date)).toBe('INQ/FIS/P3/MAY26')
  })

  test('different departments are independent', () => {
    const date = new Date('2026-05-11')
    expect(generateProjectId('IT', 0, date)).toBe('INQ/IT/P1/MAY26')
  })

  test('month and year are from conversion date', () => {
    const date = new Date('2025-01-15')
    expect(generateProjectId('OPS', 0, date)).toBe('INQ/OPS/P1/JAN25')
  })

  test('december wraps correctly', () => {
    const date = new Date('2026-12-01')
    expect(generateProjectId('FIS', 4, date)).toBe('INQ/FIS/P5/DEC26')
  })
})
```

- [ ] **Step 4: Run tests — verify they fail first**

```bash
cd backend && npx jest tests/projectId.test.js --verbose
```

Expected: 5 tests FAIL (function not yet loaded — wait, the function exists so they should pass. Actually no — run tests before writing implementation to verify the test file itself works).

Actually since the utility is already written in Step 1, run now to confirm all pass:

```bash
cd backend && npx jest tests/projectId.test.js --verbose
```

Expected output:
```
✓ first project in a department is P1
✓ sequential numbering: third project is P3
✓ different departments are independent
✓ month and year are from conversion date
✓ december wraps correctly

Tests: 5 passed
```

- [ ] **Step 5: Commit**

```bash
git add backend/utils/projectId.js backend/tests/projectId.test.js backend/package.json backend/package-lock.json
git commit -m "feat: add generateProjectId utility with Jest tests"
```

---

## Task 12: Update convertLeadRules validator

**Files:**
- Modify: `backend/middleware/validators.js`

- [ ] **Step 1: Add departmentId validation to convertLeadRules**

In `backend/middleware/validators.js`, replace the `convertLeadRules` array:

```js
const convertLeadRules = [
  mongoId(),
  body('projectHeadId')
    .notEmpty().withMessage('Project head is required')
    .isMongoId().withMessage('projectHeadId must be a valid ID'),
  body('departmentId')
    .notEmpty().withMessage('Department is required')
    .isMongoId().withMessage('departmentId must be a valid ID'),
  body('budget')
    .optional()
    .isFloat({ min: 0 }).withMessage('Budget must be a non-negative number'),
]
```

- [ ] **Step 2: Commit**

```bash
git add backend/middleware/validators.js
git commit -m "feat: add departmentId validation to convertLeadRules"
```

---

## Task 13: Update convertToProject controller

**Files:**
- Modify: `backend/controllers/leadController.js`

- [ ] **Step 1: Replace the convertToProject function**

In `backend/controllers/leadController.js`, replace the `convertToProject` function with:

```js
const convertToProject = async (req, res) => {
  try {
    const Project    = require('../models/Project')
    const User       = require('../models/User')
    const Department = require('../models/Department')
    const { generateProjectId } = require('../utils/projectId')

    const { projectHeadId, budget, departmentId } = req.body

    const lead = await Lead.findById(req.params.id)
    if (!lead) return res.status(404).json({ message: 'Lead not found' })
    if (lead.status !== 'Won') return res.status(400).json({ message: 'Only Won leads can be converted to projects' })

    const exists = await Project.findOne({ lead: lead._id })
    if (exists) return res.status(400).json({ message: 'A project already exists for this lead' })

    const headUser = await User.findById(projectHeadId)
    if (!headUser || headUser.role !== 'manager') {
      return res.status(400).json({ message: 'Project head must be a manager' })
    }

    const dept = await Department.findById(departmentId)
    if (!dept || !dept.isActive) {
      return res.status(400).json({ message: 'Department not found or inactive' })
    }

    const count     = await Project.countDocuments({ department: departmentId })
    const projectId = generateProjectId(dept.code, count)

    const project = await Project.create({
      title:       lead.title,
      lead:        lead._id,
      projectHead: projectHeadId,
      department:  departmentId,
      projectId,
      budget:      Number(budget) || 0,
    })

    lead.activityLog.push({
      action:      `Lead converted to project by ${req.user.name}`,
      performedBy: req.user._id,
    })
    await lead.save()

    createNotification({
      recipientId: projectHeadId,
      message:     `You have been assigned as project head by ${req.user.name}`,
      type:        'project',
      link:        `/projects/${project._id}`,
    })

    await project.populate([
      { path: 'projectHead', select: 'name email' },
      { path: 'department',  select: 'name code' },
    ])
    res.status(201).json(project)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}
```

- [ ] **Step 2: Test via curl**

Start the backend (`cd backend && npm run dev`) then:

```bash
curl -s -X POST http://localhost:5000/api/leads/<won-lead-id>/convert \
  -H "Authorization: Bearer <admin_or_finance_head_token>" \
  -H "Content-Type: application/json" \
  -d '{"projectHeadId":"<manager_id>","departmentId":"<dept_id>","budget":50000}' | jq '{projectId, department}'
```

Expected: `{ "projectId": "INQ/FIS/P1/MAY26", "department": { "name": "Finance", "code": "FIS" } }`

- [ ] **Step 3: Commit**

```bash
git add backend/controllers/leadController.js
git commit -m "feat: generate unique projectId and assign department on lead conversion"
```

---

## Task 14: Populate department in projectController

**Files:**
- Modify: `backend/controllers/projectController.js`

- [ ] **Step 1: Add department populate to getProject**

In `getProject`, add `.populate('department', 'name code')` to the chain:

```js
const project = await Project.findById(req.params.id)
  .populate('projectHead', 'name email role')
  .populate('teamMembers', 'name email role')
  .populate('lead', 'title status dealValue')
  .populate('expenses.loggedBy', 'name')
  .populate('progressUpdates.updatedBy', 'name')
  .populate('department', 'name code')
```

- [ ] **Step 2: Add department populate to getProjects**

In `getProjects`, add `.populate('department', 'name code')` to the chain:

```js
const projects = await Project.find(filter)
  .populate('projectHead', 'name email')
  .populate('teamMembers', 'name email')
  .populate('lead', 'title')
  .populate('department', 'name code')
  .sort({ createdAt: -1 })
```

- [ ] **Step 3: Verify**

```bash
curl -s http://localhost:5000/api/projects/<project-id> \
  -H "Authorization: Bearer <token>" | jq '{projectId, department}'
```

Expected: `{ "projectId": "INQ/FIS/P1/MAY26", "department": { "name": "Finance", "code": "FIS" } }`

- [ ] **Step 4: Commit**

```bash
git add backend/controllers/projectController.js
git commit -m "feat: populate department in project responses"
```

---

## Task 15: Update LeadDetail convert modal

**Files:**
- Modify: `frontend/src/pages/LeadDetail.jsx`

- [ ] **Step 1: Add departmentId to convertForm state**

Change the initial `convertForm` state from:
```js
const [convertForm, setConvertForm] = useState({ projectHeadId: '', budget: '' })
```
to:
```js
const [convertForm, setConvertForm] = useState({ projectHeadId: '', departmentId: '', budget: '' })
```

- [ ] **Step 2: Add departments state and fetch**

After the `const [users, setUsers] = useState([])` line, add:
```js
const [departments, setDepartments] = useState([])
```

- [ ] **Step 3: Fetch departments when modal opens**

In `openConvertModal`, after the existing manager fetch, add the department fetch. Replace the function with:

```js
const openConvertModal = async () => {
  setConvertError('')
  setConvertForm({ projectHeadId: '', departmentId: '', budget: lead?.dealValue || '' })
  try {
    const [managersRes, deptsRes] = await Promise.all([
      users.length === 0 ? api.get('/users?role=manager') : Promise.resolve({ data: users }),
      departments.length === 0 ? api.get('/departments') : Promise.resolve({ data: departments }),
    ])
    if (users.length === 0) setUsers(managersRes.data)
    if (departments.length === 0) setDepartments(deptsRes.data.filter((d) => d.isActive))
  } catch (_) {}
  setShowConvertModal(true)
}
```

- [ ] **Step 4: Add departmentId validation to handleConvert**

Replace the validation block at the top of `handleConvert`:

```js
const handleConvert = async () => {
  if (!convertForm.projectHeadId) {
    setConvertError('Select a project head.')
    return
  }
  if (!convertForm.departmentId) {
    setConvertError('Select a department.')
    return
  }
  setConverting(true)
  setConvertError('')
  try {
    const project = await convertLead(id, {
      projectHeadId: convertForm.projectHeadId,
      departmentId:  convertForm.departmentId,
      budget:        Number(convertForm.budget) || 0,
    })
    setShowConvertModal(false)
    navigate(`/projects/${project._id}`)
  } catch (err) {
    setConvertError(err.response?.data?.message || 'Failed to convert lead')
    setConverting(false)
  }
}
```

- [ ] **Step 5: Add department dropdown to the modal JSX**

In the convert modal JSX, find the existing project head `<select>` and add the department `<select>` after it. The modal body should contain:

```jsx
{/* Project Head */}
<div className="mb-3">
  <label className="text-xs font-medium text-slate-600 uppercase tracking-wide block mb-1">Project Head</label>
  <select
    value={convertForm.projectHeadId}
    onChange={(e) => setConvertForm((f) => ({ ...f, projectHeadId: e.target.value }))}
    className="w-full px-3 py-2 text-sm rounded-md border border-surface-border bg-white focus:outline-none focus:border-brand-primary"
  >
    <option value="">Select a manager</option>
    {users.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
  </select>
</div>

{/* Department */}
<div className="mb-3">
  <label className="text-xs font-medium text-slate-600 uppercase tracking-wide block mb-1">Department</label>
  <select
    value={convertForm.departmentId}
    onChange={(e) => setConvertForm((f) => ({ ...f, departmentId: e.target.value }))}
    className="w-full px-3 py-2 text-sm rounded-md border border-surface-border bg-white focus:outline-none focus:border-brand-primary"
  >
    <option value="">Select a department</option>
    {departments.map((d) => <option key={d._id} value={d._id}>{d.name} ({d.code})</option>)}
  </select>
</div>

{/* Budget */}
<div className="mb-4">
  <Input
    label="Budget (₹)"
    type="number"
    value={convertForm.budget}
    onChange={(e) => setConvertForm((f) => ({ ...f, budget: e.target.value }))}
  />
</div>
```

> Note: check the existing modal JSX structure and replace the inner form fields with the above block. Preserve the existing error display and action buttons.

- [ ] **Step 6: Test in browser**

1. Mark a lead as "Won".
2. Click "Convert to Project" — confirm modal shows both dropdowns.
3. Select a manager and a department, set a budget, click Convert.
4. Confirm redirect to the new project page.
5. Confirm the `projectId` is visible (after Task 16).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/LeadDetail.jsx
git commit -m "feat: add department dropdown to lead conversion modal"
```

---

## Task 16: Show projectId in ProjectDetail

**Files:**
- Modify: `frontend/src/pages/ProjectDetail.jsx`

- [ ] **Step 1: Add projectId badge to the page header**

In `ProjectDetail.jsx`, find the page header section. It currently has a back button, project title, and status badge. Add the `projectId` below the title. The header block should read:

```jsx
<div className="flex items-center gap-3 mb-6">
  <button onClick={() => navigate('/projects')} className="text-slate-400 hover:text-slate-600 transition-colors">
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  </button>
  <div className="flex-1 min-w-0">
    <h2 className="text-lg font-bold text-slate-900 truncate">{project.title}</h2>
    <div className="flex items-center gap-2 mt-0.5">
      {project.projectId && (
        <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
          {project.projectId}
        </span>
      )}
      {project.department?.name && (
        <span className="text-xs text-slate-400">{project.department.name}</span>
      )}
    </div>
  </div>
  <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_STYLE[project.status] || 'bg-slate-100 text-slate-600'}`}>
    {project.status}
  </span>
</div>
```

- [ ] **Step 2: Test in browser**

Open a project that was converted with a department. Confirm the `projectId` badge (e.g. `INQ/FIS/P1/MAY26`) and department name appear in the header.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/ProjectDetail.jsx
git commit -m "feat: display projectId badge and department in project detail header"
```

---

## Task 17: Show projectId on Projects list

**Files:**
- Modify: `frontend/src/pages/Projects.jsx`

- [ ] **Step 1: Add projectId below the project title in each card**

In the project card JSX, find the title/status row. Add the `projectId` line immediately below `<h3>`:

```jsx
<div className="flex items-start justify-between gap-2 mb-3">
  <div className="min-w-0">
    <h3 className="text-sm font-semibold text-slate-900 leading-snug line-clamp-2">{project.title}</h3>
    {project.projectId && (
      <p className="font-mono text-xs text-slate-400 mt-0.5">{project.projectId}</p>
    )}
  </div>
  <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${statusStyle[project.status] || 'bg-slate-100 text-slate-600'}`}>
    {project.status}
  </span>
</div>
```

- [ ] **Step 2: Test in browser**

Open the Projects list. Confirm each project shows its `projectId` in monospace text below the title. Old projects (before this feature) show nothing for that line (the `&&` guard handles it).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Projects.jsx
git commit -m "feat: show projectId subtitle on project cards in Projects list"
```

---

## Self-Review Checklist

- [x] Spec: `proofFiles: [String]` on Reimbursement — Task 4
- [x] Spec: multer + Cloudinary, image only, max 10 — Task 3
- [x] Spec: multipart on POST /reimbursements — Task 5 + 6
- [x] Spec: FormData in NewReimbursement + thumbnail previews — Task 8
- [x] Spec: proof card in ReimbursementDetail — Task 9
- [x] Spec: access control unchanged (owner/manager/admin/fh) — no task needed (existing logic covers it)
- [x] Spec: `department: ref Department (required)` on Project — Task 10
- [x] Spec: `projectId: String (unique, sparse)` on Project — Task 10
- [x] Spec: departmentId accepted + validated in convertToProject — Tasks 12 + 13
- [x] Spec: ID format INQ/{code}/P{n+1}/{MON}{YY} — Task 11 + 13
- [x] Spec: sequential per department via countDocuments — Task 13
- [x] Spec: department dropdown in convert modal — Task 15
- [x] Spec: projectId badge in ProjectDetail header — Task 16
- [x] Spec: projectId subtitle in Projects list — Task 17
- [x] Spec: department populated in project responses — Task 14
