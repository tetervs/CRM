const mongoose = require('mongoose')
const Lead = require('../models/Lead')
const User = require('../models/User')
const ManpowerPull = require('../models/ManpowerPull')

const overview = async (req, res) => {
  try {
    const [total, wonLeads, activeLeads] = await Promise.all([
      Lead.countDocuments(),
      Lead.find({ status: 'Won' }),
      Lead.countDocuments({ status: { $nin: ['Won', 'Lost'] } }),
    ])

    const revenue = wonLeads.reduce((s, l) => s + l.dealValue, 0)
    const conversionRate = total > 0 ? Math.round((wonLeads.length / total) * 100) : 0

    res.json({ totalLeads: total, revenue, conversionRate, activeDeals: activeLeads })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

const pipeline = async (req, res) => {
  try {
    const statuses = ['New', 'Contacted', 'Proposal Sent', 'Won', 'Lost']
    const counts = await Promise.all(
      statuses.map(async (status) => ({
        status,
        count: await Lead.countDocuments({ status }),
      }))
    )
    res.json(counts)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

const performance = async (req, res) => {
  try {
    const [users, totalsByOwner, wonByOwner] = await Promise.all([
      User.find({ isActive: true }).select('name email role'),
      Lead.aggregate([{ $group: { _id: '$owner', totalLeads: { $sum: 1 } } }]),
      Lead.aggregate([
        { $match: { status: 'Won' } },
        { $group: { _id: '$owner', won: { $sum: 1 }, revenue: { $sum: '$dealValue' } } },
      ]),
    ])

    const totalsMap = Object.fromEntries(totalsByOwner.map((r) => [r._id.toString(), r.totalLeads]))
    const wonMap = Object.fromEntries(wonByOwner.map((r) => [r._id.toString(), { won: r.won, revenue: r.revenue }]))

    const stats = users.map((user) => {
      const id = user._id.toString()
      const { won = 0, revenue = 0 } = wonMap[id] || {}
      return { user: { _id: user._id, name: user.name, role: user.role }, totalLeads: totalsMap[id] || 0, won, revenue }
    })

    res.json(stats.sort((a, b) => b.revenue - a.revenue))
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

const trend = async (req, res) => {
  try {
    const now = new Date()
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)

    const results = await Lead.aggregate([
      { $match: { status: 'Won', updatedAt: { $gte: sixMonthsAgo } } },
      { $group: {
        _id: { year: { $year: '$updatedAt' }, month: { $month: '$updatedAt' } },
        revenue: { $sum: '$dealValue' },
        count: { $sum: 1 },
      }},
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ])

    const dataMap = Object.fromEntries(
      results.map((r) => [`${r._id.year}-${r._id.month}`, r])
    )

    const months = []
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${date.getFullYear()}-${date.getMonth() + 1}`
      const entry = dataMap[key] || { revenue: 0, count: 0 }
      months.push({
        month: date.toLocaleString('en-US', { month: 'short' }),
        revenue: entry.revenue,
        count: entry.count,
      })
    }

    res.json(months)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

const STATUSES = ['New', 'Contacted', 'Proposal Sent', 'Won', 'Lost']

const userPerformance = async (req, res) => {
  try {
    const userObjectId = new mongoose.Types.ObjectId(req.params.userId)

    const user = await User.findById(userObjectId).select('name email role')
    if (!user) return res.status(404).json({ message: 'User not found' })

    const [leadStats, manpowerRequests, recentActivity] = await Promise.all([
      Lead.aggregate([
        { $match: { owner: userObjectId } },
        { $group: {
          _id: '$status',
          count: { $sum: 1 },
          revenue: { $sum: '$dealValue' },
        }},
      ]),

      ManpowerPull.find({ pulledBy: userObjectId })
        .sort({ createdAt: -1 })
        .select('reason employeeType createdAt'),

      Lead.aggregate([
        { $match: { owner: userObjectId, 'activityLog.0': { $exists: true } } },
        { $unwind: '$activityLog' },
        { $sort: { 'activityLog.timestamp': -1 } },
        { $limit: 20 },
        { $project: {
          _id: 0,
          action: '$activityLog.action',
          timestamp: '$activityLog.timestamp',
          leadTitle: '$title',
        }},
      ]),
    ])

    const buckets = Object.fromEntries(leadStats.map((s) => [s._id, s]))
    const byStatus = Object.fromEntries(STATUSES.map((s) => [s, buckets[s]?.count || 0]))
    const total = STATUSES.reduce((sum, s) => sum + byStatus[s], 0)
    const won = byStatus['Won']
    const revenue = buckets['Won']?.revenue || 0
    const conversionRate = total > 0 ? Math.round((won / total) * 100) : 0

    res.json({
      user,
      totalLeads: total,
      byStatus,
      won,
      revenue,
      conversionRate,
      manpowerRequests: { total: manpowerRequests.length, list: manpowerRequests },
      recentActivity,
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

module.exports = { overview, pipeline, performance, trend, userPerformance }
