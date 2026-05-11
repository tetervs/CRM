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
