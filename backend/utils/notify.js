const Notification = require('../models/Notification')

const createNotification = async ({ recipientId, message, type, link }) => {
  try {
    await Notification.create({ recipient: recipientId, message, type, link })
  } catch (err) {
    console.error('[notify]', err.message)
  }
}

module.exports = { createNotification }
