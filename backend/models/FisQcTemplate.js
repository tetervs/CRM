const mongoose = require('mongoose')

// Immutable, versioned checklist. Editing never mutates a row: a new version is inserted.
// Runs pin the version they started on (FisQcRun.templateVersion).
const schema = new mongoose.Schema({
  version:   { type: Number, required: true, unique: true },
  note:      { type: String, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  sections: [{
    _id: false, code: String, title: String, intro: String,
    groups: [{ _id: false, name: String, items: [{ _id: false, code: String, text: String }] }],
  }],
  // { always, byCaseType, perSubject, conditional, recheckAfterRevision, ... } — see backend/seed JSON
  rules:    { type: mongoose.Schema.Types.Mixed, default: {} },
  // Last number used per section code, carried forward so removed codes are never reused.
  counters: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true })

module.exports = mongoose.model('FisQcTemplate', schema)
