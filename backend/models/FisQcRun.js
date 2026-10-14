const mongoose = require('mongoose')
const ObjectId = mongoose.Schema.Types.ObjectId

const itemSchema = new mongoose.Schema({
  key:     { type: String, required: true },   // "G8" or "CH5@<subjectId>"
  code:    { type: String, required: true },
  subject: { type: String, default: null },    // subject id, null for case-level items
  status:  { type: String, enum: ['unset', 'Pass', 'Issue', 'N/A'], default: 'unset' },
  note:    { type: String, default: '' },      // required for Issue
  reason:  { type: String, default: '' },      // required for N/A
  recheck: { type: Boolean, default: false },  // reset by a send-back, needs another look
}, { _id: false })

// A closed round is the read-only snapshot; there is no separate snapshot collection.
const roundSchema = new mongoose.Schema({
  n:         { type: Number, required: true },
  label:     { type: String, required: true },
  state:     { type: String, enum: ['open', 'closed'], default: 'open' },
  startedAt: { type: Date, default: Date.now },
  closedAt:  { type: Date, default: null },
  closedBy:  { type: ObjectId, ref: 'User', default: null },
  closedFor: { type: String, enum: ['sent_back', 'passed', null], default: null },
  items:     [itemSchema],
}, { _id: false })

const schema = new mongoose.Schema({
  case:            { type: ObjectId, ref: 'FisCase', required: true, unique: true },
  templateVersion: { type: Number, required: true },
  scope:           { kind: { type: String, enum: ['Full', 'Partial'], default: 'Full' }, text: { type: String, default: '' } },
  underlyingType:  { type: String, default: null },  // QC (direct) only: report type being reviewed
  cctv:            { type: Boolean, default: false }, // SRA/TVRA: includes CCTV blind spot analysis
  subjects:        [{ _id: false, id: String, label: String }],
  noSubjectsInScope: {
    ticked: { type: Boolean, default: false }, reason: String, by: { type: ObjectId, ref: 'User' }, at: Date,
  },
  status:  { type: String, enum: ['inProgress', 'passed'], default: 'inProgress' },
  passed:  { by: { type: ObjectId, ref: 'User' }, at: Date },
  reopens: [{ _id: false, by: { type: ObjectId, ref: 'User' }, at: Date, reason: String, fromRound: Number }],
  rounds:  [roundSchema],
  createdBy: { type: ObjectId, ref: 'User' },
}, { timestamps: true })

module.exports = mongoose.model('FisQcRun', schema)
