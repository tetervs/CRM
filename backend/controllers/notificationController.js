const Notification = require('../models/Notification')

const getNotifications = async (req, res) => {
  try {
    const filter = { recipient: req.user._id }
    if (req.query.unreadOnly === 'true') filter.isRead = false

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(50)

    res.json(notifications)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

const markRead = async (req, res) => {
  try {
    const n = await Notification.findOne({ _id: req.params.id, recipient: req.user._id })
    if (!n) return res.status(404).json({ message: 'Notification not found' })
    n.isRead = true
    await n.save()
    res.json(n)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

const markAllRead = async (req, res) => {
  try {
    await Notification.updateMany({ recipient: req.user._id, isRead: false }, { isRead: true })
    res.json({ message: 'All notifications marked as read' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

module.exports = { getNotifications, markRead, markAllRead }
