# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Communication Rules

- Short sentences: 3-6 words
- Drop articles ("Fix bug" not "Fix the bug")
- No preamble or pleasantries
- Run tools first, show results, stop

---

## Project

SalesPilot — Monday CRM-like Sales Management Tool. MERN stack.

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | React (Vite), React Router v6, Axios, Zustand, react-beautiful-dnd, Recharts |
| Styling | Tailwind CSS only — no inline styles |
| Backend | Node.js, Express |
| Database | MongoDB + Mongoose |
| Auth | JWT + bcryptjs |
| Email | Nodemailer (SMTP) |

---

## Role Hierarchy

`head > admin > manager > sales > employee`

`ca` (Chartered Accountant / finance approver) is a separate, narrow role — reimbursement final-approval and mark-paid only. Not part of the management hierarchy above and not creatable through the Add User UI (script-created only, same as `head`).

### Sidebar Access Matrix

| Page | head | admin | manager | sales | employee | ca |
|---|---|---|---|---|---|---|
| Dashboard | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Pipeline | ✓ | ✓ | ✓ | ✓ | — | — |
| Leads | ✓ | ✓ | ✓ | ✓ | — | — |
| Team | ✓ | ✓ | ✓ | — | — | — |
| Employees | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Manpower | ✓ | ✓ | ✓ | — | — | — |
| Projects | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Reimbursements | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Analytics | ✓ | ✓ | — | — | — | — |
| Departments (Settings) | ✓ | ✓ | — | — | — | — |

`ca` has page-open access to Employees/Projects/Reimbursements same as any non-privileged role (route isn't gated), but no privileged actions on Employees/Projects, and only reimbursement final-approve/reject/mark-paid actions there.

---

## Folder Structure

```
crm-project/
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── ui/        # Button, Input, Badge, Modal, Card, StatCard
│       │   ├── layout/    # Sidebar.jsx, Navbar.jsx, PageWrapper.jsx
│       │   └── shared/    # KanbanCard.jsx, LeadTable.jsx, UserPerformanceDrawer.jsx
│       ├── pages/
│       │   # Login, Register, VerifyEmail
│       │   # Dashboard, Pipeline, Leads, LeadDetail
│       │   # Team, Employees, Manpower
│       │   # Projects, ProjectDetail
│       │   # Reimbursements, NewReimbursement, ReimbursementDetail
│       │   # Analytics, Departments
│       ├── store/
│       │   # authStore.js, leadStore.js, projectStore.js
│       │   # reimbursementStore.js, notificationStore.js
│       ├── api/           # index.js — Axios instance + interceptors
│       └── utils/
└── backend/
    ├── config/
    │   ├── db.js
    │   └── seed.js        # Seeds default departments on startup (idempotent)
    ├── controllers/
    │   # authController, leadController, userController
    │   # analyticsController, departmentController, manpowerController
    │   # projectController, reimbursementController, notificationController
    ├── middleware/
    │   # authMiddleware.js, roleMiddleware.js, validators.js, validate.js
    │   # rateLimiter.js
    ├── models/
    │   # User.js, Lead.js, Department.js, ManpowerPull.js
    │   # Project.js, Reimbursement.js, Notification.js
    ├── routes/
    │   # authRoutes, leadRoutes, userRoutes, analyticsRoutes
    │   # departmentRoutes, manpowerRoutes, projectRoutes
    │   # reimbursementRoutes, notificationRoutes
    ├── utils/
    │   ├── mailer.js      # sendVerificationEmail, sendReimbursementNotification
    │   └── notify.js      # createNotification (non-blocking in-app)
    └── server.js
```

---

## Commands

```bash
# Frontend dev
cd frontend && npm run dev

# Backend dev
cd backend && npm run dev   # nodemon server.js

# Install frontend deps
cd frontend && npm install react-router-dom axios zustand react-beautiful-dnd recharts
cd frontend && npm install -D tailwindcss postcss autoprefixer

# Install backend deps
cd backend && npm install express mongoose cors dotenv bcryptjs jsonwebtoken nodemon \
  helmet morgan cookie-parser express-rate-limit express-validator nodemailer
```

---

## Environment

`backend/.env` — required vars:
```
MONGO_URI=
JWT_SECRET=
PORT=5000
FRONTEND_URL=http://localhost:5173
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

---

## API

Base URL: `http://localhost:5000/api`
Auth header: `Authorization: Bearer <token>`

### Endpoints

| Method | Route | Roles | Notes |
|---|---|---|---|
| POST | /auth/register | public | bcrypt round 10, sends verification email |
| POST | /auth/login | public | returns JWT + user |
| GET | /auth/me | any | returns current user |
| GET | /verify-email?token= | public | verifies email token |
| GET | /users | any | ?role=manager filter supported |
| GET | /users/:id | head, admin | |
| PUT | /users/:id/role | head, admin | |
| DELETE | /users/:id | head, admin | soft delete (isActive=false) |
| GET | /leads | head/admin/mgr/sales | role-filtered |
| POST | /leads | head/admin/mgr/sales | |
| GET | /leads/:id | head/admin/mgr/sales | sales: own only |
| PUT | /leads/:id | head/admin/mgr/sales | sales: own only |
| DELETE | /leads/:id | admin | |
| PATCH | /leads/:id/status | head/admin/mgr/sales | appends to activityLog |
| POST | /leads/:id/convert | head, admin | projectHead must be manager/head/admin role |
| GET | /projects | any authed | role-filtered |
| GET | /projects/:id | any authed | access check |
| PATCH | /projects/:id/status | head/admin/projectHead | |
| POST | /projects/:id/progress | project members | |
| POST | /projects/:id/expenses | project members | |
| PATCH | /projects/:id/complete | head, admin | returns summary |
| GET | /reimbursements | any authed | role-filtered |
| POST | /reimbursements | any authed | totalAmount server-calculated |
| GET | /reimbursements/:id | owner/mgr/head/admin/ca | |
| PATCH | /reimbursements/:id/head-approve | head/admin/manager | |
| PATCH | /reimbursements/:id/finance-approve | head/admin/ca | |
| PATCH | /reimbursements/:id/reject | head/admin/manager/ca | |
| PATCH | /reimbursements/:id/pay | head/admin/ca | |
| GET | /notifications | any authed | ?unreadOnly=true |
| PATCH | /notifications/read-all | any authed | |
| PATCH | /notifications/:id/read | any authed | owner-check |
| GET | /manpower | head/admin/manager | |
| POST | /manpower | head/admin/manager | |
| GET | /departments | any authed | |
| POST | /departments | head, admin | |
| PUT | /departments/:id | head, admin | |
| DELETE | /departments/:id | head, admin | |
| GET | /analytics/overview | head, admin | |
| GET | /analytics/pipeline | head, admin | |
| GET | /analytics/performance | head, admin | |
| GET | /analytics/trend | head, admin | |
| GET | /analytics/performance/:userId | head, admin | per-user stats |

---

## Data Models

### User
```js
{
  name, email, password (hashed), role: ['head','ca','admin','manager','sales','employee'],
  isActive (default true), department (ref), createdAt,
  verificationToken, isVerified, failedLoginAttempts, lockUntil
}
```

### Lead
```js
{
  title, contactName, contactEmail, contactPhone, dealValue,
  status: ['New','Contacted','Proposal Sent','Won','Lost'],
  owner: ref User, notes, tags[], activityLog: [{action, performedBy, timestamp}],
  createdAt, updatedAt
}
```

### Department
```js
{ name (unique), code (unique, uppercase), isActive, createdAt }
```

### Project
```js
{
  title, lead: ref Lead, projectHead: ref User (must be manager role),
  status: ['Active','On Hold','Completed'], teamMembers: [ref User],
  budget, expenses: [{description, amount, loggedBy, date}],
  progressUpdates: [{note, updatedBy, timestamp}], completedAt,
  createdAt, updatedAt
}
```

### Reimbursement
```js
{
  submittedBy: ref User, items: [{description, amount}],
  totalAmount (server-calculated, never trusted from client),
  status: ['Pending','Head Approved','Finance Approved','Rejected','Paid'],
  notes, rejectionReason,
  headReviewedBy, headReviewedAt, financeReviewedBy, financeReviewedAt,
  paidBy, paidAt, createdAt, updatedAt
}
```

### ManpowerPull
```js
{
  pulledBy: ref User, pulledEmployee: ref User,
  freelancerName, freelancerEmail,
  employeeType: ['inhouse','freelancer'],
  reason, date, createdAt
}
```
> Section 6 pending: add `project: ref Project (required)`

### Notification
```js
{
  recipient: ref User, message (maxlength 300),
  type: ['reimbursement','project','lead','system'],
  link (frontend route), isRead (default false), createdAt
}
```

---

## State (Zustand)

### authStore
- State: `user`, `token`, `isAuthenticated`
- Actions: `login()`, `register()`, `logout()`, `loadFromStorage()`, `fetchMe()`
- Token persisted in localStorage

### leadStore
- State: `leads[]`, `loading`, `error`
- Actions: `fetchLeads()`, `createLead()`, `updateLead()`, `deleteLead()`, `updateLeadStatus()`

### projectStore
- State: `projects[]`, `current`, `loading`, `error`
- Actions: `fetchProjects(params)`, `fetchProject(id)`, `convertLead(leadId, payload)`, `updateStatus()`, `addProgress()`, `logExpense()`, `completeProject()`

### reimbursementStore
- State: `reimbursements[]`, `current`, `loading`, `error`
- Actions: `fetchReimbursements()`, `fetchReimbursement(id)`, `createReimbursement()`, `headApprove()`, `financeApprove()`, `rejectReimbursement()`, `markPaid()`

### notificationStore
- State: `notifications[]`, `unreadCount`, `loading`
- Actions: `fetchNotifications()`, `fetchUnreadCount()`, `markRead(id)`, `markAllRead()`, `startPolling()`, `stopPolling()`
- Polling: every 15 seconds via `setInterval` in `startPolling()`

---

## Frontend Conventions

- Named exports for components, default exports for pages
- Tailwind only — no inline styles
- `PageWrapper` handles protected route logic (redirect to `/login` if no token)
- Axios interceptor attaches Bearer token; 401 triggers logout + redirect

---

## Design System

```js
// tailwind.config.js colors
brand:   { primary: '#6366F1', hover: '#4F46E5', light: '#EEF2FF' }
surface: { bg: '#F8FAFC', card: '#FFFFFF', border: '#E2E8F0' }
sidebar: { bg: '#0F172A', text: '#94A3B8', active: '#6366F1', hover: '#1E293B' }
status:  { new: '#3B82F6', contacted: '#F59E0B', proposal: '#8B5CF6', won: '#10B981', lost: '#EF4444' }
```

Dark sidebar, light content area. Dense, professional — no generic AI aesthetic.

---

## Important Implementation Notes

- **Notification polling**: 15 seconds, starts after successful auth in App.jsx, stops on logout and unmount
- **totalAmount**: always server-calculated in reimbursementController — never trusted from client
- **seed.js**: runs on every server start, idempotent — only seeds if departments collection is empty
- **notify.js**: non-blocking — createNotification is fire-and-forget, all errors caught and logged, never throws to callers
- **Project head role**: must be `manager`, `head`, or `admin` — enforced in `convertToProject` backend (returns 400 if not), frontend LeadDetail fetches `GET /users/managers` to populate dropdown
- **employee role**: no access to leads, pipeline, analytics, or manpower logging
- **getUsers supports role filter**: `GET /users?role=manager` returns only managers

### Section 6 Changes (complete)
- Manpower pulls are project-scoped — `projectId` required on create; backend validates requester is projectHead or admin/head
- Pulling an inhouse employee auto-adds them to `project.teamMembers` (gives project access) and sends in-app notification
- Only `employee` and `sales` roles can be pulled into projects — backend returns 400 for managers/admins
- Team page shows only `head`, `admin`, `manager`, `ca` roles with Analyse button
- Employees page shows only `sales`, `employee` roles; head/admin can edit role via modal (employee ↔ sales ↔ manager for admins)
- `userController.updateRole` allows `employee` role (added in Section 6); `GET /users?role=` filter supported
- `GET /manpower` server-side filtered (head/admin: all; manager: their projects; sales/employee: own pulls)

### Section 7 Changes (complete)
- `finance_head` renamed to `head`, keeping every permission it had
- New `ca` role added — reimbursement final-approval, reject, and mark-paid only; not creatable through the Add User UI, script-created only (`backend/scripts/createCaUser.js`), same pattern as `head`
- Team page grouped into Head / Admin / Manager / CA sections
- Employees page grouped by department
- Convert-to-Project "Approved Budget" is now a required field (both frontend and backend validation)
- Convert-to-Project "Project Head" dropdown now accepts manager, head, or admin (was manager-only)
