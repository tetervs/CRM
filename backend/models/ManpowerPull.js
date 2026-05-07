const mongoose = require('mongoose')

const manpowerPullSchema = new mongoose.Schema({
  project:  { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  pulledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  pulledEmployee: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  freelancerName: { type: String },
  freelancerEmail: { type: String },
  employeeType: { type: String, enum: ['inhouse', 'freelancer'], required: true },
  reason: { type: String, maxlength: 300, default: '' },
  date: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
})

module.exports = mongoose.model('ManpowerPull', manpowerPullSchema)
