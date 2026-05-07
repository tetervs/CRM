const mongoose = require('mongoose')
const { ObjectId } = mongoose.Schema.Types

const milestoneSchema = new mongoose.Schema({
  title:      { type: String, required: true, trim: true, maxlength: 200 },
  description:{ type: String, trim: true, maxlength: 1000 },
  dueDate:    { type: Date, required: true },
  status:     { type: String, enum: ['pending', 'in-progress', 'completed'], default: 'pending' },
  project:    { type: ObjectId, ref: 'Project', required: true },
  assignedTo: { type: ObjectId, ref: 'User', default: null },
  createdBy:  { type: ObjectId, ref: 'User' },
}, { timestamps: true })

milestoneSchema.index({ project: 1, dueDate: 1 })

module.exports = mongoose.model('Milestone', milestoneSchema)
