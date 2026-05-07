const { validationResult } = require('express-validator')

/**
 * Central validation runner.
 * Pass after a chain of express-validator checks — returns 422 if any fail.
 */
const validate = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(422).json({
      message: 'Validation failed',
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    })
  }
  next()
}

module.exports = validate
