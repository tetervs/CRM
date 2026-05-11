# Design: Reimbursement Proof Uploads + Project Department & ID

**Date:** 2026-05-11
**Status:** Approved

---

## Feature 1 — Proof of Spending Uploads

### Goal
Allow employees to attach screenshot proof when submitting a reimbursement. Proof is viewable by the submitter, manager, admin, and finance_head on the detail page.

### Constraints
- Upload only at submission time — no post-submission edits
- Images only (screenshots) — no PDFs
- Max 10 files per reimbursement
- Storage: Cloudinary (env vars already configured)
- Backend is on Render (ephemeral filesystem — no local disk storage)

### Backend

**New packages:** `cloudinary`, `multer`, `multer-storage-cloudinary`

**`backend/config/cloudinary.js`**
- Initialise Cloudinary SDK using `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` from `process.env`

**`backend/middleware/upload.js`**
- Multer instance using `multer-storage-cloudinary`
- Cloudinary folder: `reimbursements/`
- File filter: `image/*` only — reject non-images with a 400
- Limit: max 10 files per request, field name `proofFiles`

**`backend/models/Reimbursement.js`**
- Add field: `proofFiles: [String]` — stores Cloudinary secure URLs

**`backend/controllers/reimbursementController.js` — `createReimbursement`**
- Route now receives `multipart/form-data` (multer middleware prepended)
- `items` and `notes` and `projectId` arrive as JSON strings in the FormData body — parse `items` with `JSON.parse(req.body.items)`
- Uploaded file URLs available at `req.files.map(f => f.path)` — stored in `proofFiles`
- All existing validation and notification logic unchanged

**`backend/routes/reimbursementRoutes.js`**
- `POST /reimbursements` — prepend `upload.array('proofFiles', 10)` middleware before `createReimbursement`

### Frontend

**`frontend/src/pages/NewReimbursement.jsx`**
- Add "Proof of Spending" `Card` section (optional — submitter can skip)
- Multi-file `<input type="file" accept="image/*" multiple>` capped at 10
- Show thumbnail previews of selected images before submit
- Remove individual images before submit via an ✕ button on each preview
- On submit: build `FormData`, append `items` as `JSON.stringify(validItems)`, append `notes`, append `projectId` if present, append each image file under key `proofFiles`

**`frontend/src/store/reimbursementStore.js` — `createReimbursement`**
- Accept `FormData` directly — `NewReimbursement.jsx` builds and passes it; the store does not construct FormData itself
- Pass `FormData` to `api.post('/reimbursements', formData)` — axios auto-sets `Content-Type: multipart/form-data`

**`frontend/src/pages/ReimbursementDetail.jsx`**
- Add "Proof of Spending" `Card` below the Expense Items card
- Only render if `r.proofFiles?.length > 0`
- Render thumbnail grid (`<img>` tags, `object-cover`, fixed height ~80px)
- Each thumbnail is an `<a href={url} target="_blank">` — opens full image in new tab
- No special role gating needed — access to the detail page already enforces who can see it

### Access
No changes required. Existing access control on `GET /reimbursements/:id` already restricts to owner / manager / admin / finance_head.

---

## Feature 2 — Department Assignment + Unique Project ID

### Goal
Every project must be assigned to a department at creation (lead conversion). Each project gets a unique human-readable ID in the format `INQ/{DEPT_CODE}/P{N}/{MON}{YY}`.

**Format:** `INQ/FIS/P1/MAY26`
- `INQ` — hardcoded company prefix
- `DEPT_CODE` — department `code` field (uppercase, from Department model)
- `P{N}` — sequential number per department (1-indexed, counts existing projects in that department)
- `MON` — 3-letter uppercase month of conversion date (JAN, FEB, … DEC)
- `YY` — 2-digit year of conversion date

**Sequencing:** per department — FIS has its own P1, P2…; IT has its own P1, P2…

### Backend

**`backend/models/Project.js`**
- Add `department: { type: ObjectId, ref: 'Department', required: true }`
- Add `projectId: { type: String, unique: true, sparse: true }` — sparse allows existing projects without it

**`backend/controllers/leadController.js` — `convertToProject`**
- Accept `departmentId` in `req.body`
- Validate: department exists and `isActive === true` — return 400 if not
- Count: `Project.countDocuments({ department: departmentId })` → `n`
- Generate ID:
  ```js
  const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
  const now = new Date()
  const projectId = `INQ/${dept.code}/P${n + 1}/${MONTHS[now.getMonth()]}${String(now.getFullYear()).slice(-2)}`
  ```
- Create project with `department: departmentId` and `projectId`
- Populate `department` (name, code) in the response

### Frontend

**`frontend/src/pages/LeadDetail.jsx` — convert modal**
- Fetch `GET /departments` when modal opens (alongside existing manager fetch)
- Add department `<select>` dropdown in the modal — required field
- Send `departmentId` in the `convertLead` payload
- Show validation error if no department selected

**`frontend/src/store/projectStore.js` — `convertLead`**
- Pass `departmentId` through in the payload — no other changes needed

**`frontend/src/pages/ProjectDetail.jsx`**
- Display `project.projectId` as a styled badge (e.g. `font-mono text-xs bg-slate-100 px-2 py-0.5 rounded`) in the page header, next to the project title
- Populate `department` in the project fetch response — show department name in project info

**`frontend/src/pages/Projects.jsx`**
- Show `project.projectId` as a subtitle/secondary line under each project title in the list

---

## Data Model Changes Summary

| Model | Field Added |
|---|---|
| `Reimbursement` | `proofFiles: [String]` |
| `Project` | `department: ref Department (required)` |
| `Project` | `projectId: String (unique, sparse)` |

## New Files

| File | Purpose |
|---|---|
| `backend/config/cloudinary.js` | Cloudinary SDK init |
| `backend/middleware/upload.js` | Multer + Cloudinary storage middleware |

## New Dependencies

| Package | Side |
|---|---|
| `cloudinary` | backend |
| `multer` | backend |
| `multer-storage-cloudinary` | backend |
