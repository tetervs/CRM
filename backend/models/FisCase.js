const mongoose = require('mongoose')
const ref = { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }

const schema = new mongoose.Schema({
  serialNo:       { type: Number, unique: true, required: true },
  caseRef:        { type: String, required: true, trim: true, maxlength: 200 },
  caseType:       { type: String, required: true },
  caseLead:       ref,
  support1:       ref,
  support2:       ref,
  assignedBy:     ref,
  dateAssigned:   { type: Date, default: null },
  deadline:       { type: Date, default: null },
  stage:          { type: String, required: true },
  remarks:        { type: String, default: '', maxlength: 5000 },
  stageChangedAt: { type: Date, default: Date.now },
  closedAt:       { type: Date, default: null },
  createdBy:      ref,
}, { timestamps: true })

module.exports = mongoose.model('FisCase', schema)
