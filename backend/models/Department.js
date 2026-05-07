const mongoose = require('mongoose')

const departmentSchema = new mongoose.Schema({
  name:      { type: String, required: true, unique: true, trim: true, maxlength: 100 },
  code:      { type: String, required: true, unique: true, uppercase: true, trim: true, maxlength: 20 },
  isActive:  { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
})

module.exports = mongoose.model('Department', departmentSchema)
