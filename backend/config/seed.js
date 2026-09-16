const Department = require('../models/Department')

const seedDepartments = async () => {
  const count = await Department.countDocuments()
  if (count > 0) return
  await Department.insertMany([
    { name: 'FIS', code: 'FIS' },
    { name: 'BGV', code: 'BGV' },
    { name: 'IPR', code: 'IPR' },
    { name: 'InQuest Academy', code: 'IQA' },
    { name: 'Security Systems', code: 'SS' },
  ])
  console.log('[seed] Default departments created')
}

module.exports = seedDepartments
