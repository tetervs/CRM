const mongoose = require('mongoose')

const schema = new mongoose.Schema({
  case:  { type: mongoose.Schema.Types.ObjectId, ref: 'FisCase', required: true, index: true },
  by:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  at:    { type: Date, default: Date.now },
  field: String,
  from:  String,
  to:    String,
})

module.exports = mongoose.model('FisCaseHistory', schema)
