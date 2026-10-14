const mongoose = require('mongoose')
const defaults = require('../utils/fisDefaults')

// Singleton document (key 'default'). Created lazily from fisDefaults on first read.
const schema = new mongoose.Schema({
  key:         { type: String, default: 'default', unique: true },
  dueSoonDays: { type: Number, min: 0, default: defaults.dueSoonDays },
  staleDays:   { type: Number, min: 1, default: defaults.staleDays },
  phases:      [String],
  stagePhase:  [{ _id: false, stage: String, phase: String }],
  caseTypes:   [{ _id: false, code: String, name: String, stages: [String] }],
}, { timestamps: true })

module.exports = mongoose.model('FisConfig', schema)
