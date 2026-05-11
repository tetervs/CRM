const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']

/**
 * @param {string} deptCode  - uppercase department code e.g. "FIS"
 * @param {number} count     - existing project count for this department (0-indexed → P1 for first)
 * @param {Date}   date      - defaults to now; controls MON and YY segment
 */
function generateProjectId(deptCode, count, date = new Date()) {
  const mon = MONTHS[date.getMonth()]
  const yy  = String(date.getFullYear()).slice(-2)
  return `INQ/${deptCode}/P${count + 1}/${mon}${yy}`
}

module.exports = { generateProjectId }
