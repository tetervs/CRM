const parseDateRange = (fromParam, toParam) => {
  const now = new Date()

  let from
  if (fromParam) {
    from = new Date(fromParam.length === 7 ? `${fromParam}-01` : fromParam)
    from.setHours(0, 0, 0, 0)
  } else {
    from = new Date(now)
    from.setMonth(from.getMonth() - 6)
    from.setDate(1)
    from.setHours(0, 0, 0, 0)
  }

  let to
  if (toParam) {
    if (toParam.length === 7) {
      to = new Date(`${toParam}-01`)
      to.setMonth(to.getMonth() + 1)
      to.setDate(0)
      to.setHours(23, 59, 59, 999)
    } else {
      to = new Date(toParam)
      to.setHours(23, 59, 59, 999)
    }
  } else {
    to = new Date(now)
    to.setHours(23, 59, 59, 999)
  }

  return { from, to }
}

module.exports = { parseDateRange }
