const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Bill = require('../models/Bill');
const Feedback = require('../models/Feedback');
const Session = require('../models/Session');
const MenuItem = require('../models/MenuItem');
const { protect, authorize } = require('../middleware/auth');

// GET /api/analytics/overview
router.get('/overview', protect, authorize('admin'), async (req, res) => {
  try {
    const today = new Date(); today.setHours(0,0,0,0);
    const todayEnd = new Date(); todayEnd.setHours(23,59,59,999);

    const [todayOrders, todayBills, totalOrders, avgFeedback] = await Promise.all([
      Order.countDocuments({ createdAt: { $gte: today, $lte: todayEnd } }),
      Bill.find({ paidAt: { $gte: today, $lte: todayEnd }, status: 'paid' }),
      Order.countDocuments(),
      Feedback.aggregate([{ $group: { _id: null, avg: { $avg: '$rating' } } }])
    ]);

    const todayRevenue = todayBills.reduce((s, b) => s + b.total, 0);
    const avgOrderValue = todayOrders > 0 ? todayRevenue / todayOrders : 0;

    res.json({
      success: true,
      data: {
        todayOrders, todayRevenue: Math.round(todayRevenue * 100) / 100,
        avgOrderValue: Math.round(avgOrderValue * 100) / 100,
        totalOrders,
        avgRating: avgFeedback[0]?.avg ? Math.round(avgFeedback[0].avg * 10) / 10 : 0,
        activeSessions: await Session.countDocuments({ status: 'active' })
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/analytics/sales
router.get('/sales', protect, authorize('admin'), async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const sales = await Bill.aggregate([
      { $match: { paidAt: { $gte: startDate }, status: 'paid' } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$paidAt' } }, total: { $sum: '$total' }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    res.json({ success: true, data: sales });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/analytics/popular-items
router.get('/popular-items', protect, authorize('admin'), async (req, res) => {
  try {
    const items = await MenuItem.find().sort({ totalOrdered: -1 }).limit(10)
      .select('name totalOrdered price category').populate('category', 'name');
    res.json({ success: true, data: items });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/analytics/peak-hours
router.get('/peak-hours', protect, authorize('admin'), async (req, res) => {
  try {
    const peakHours = await Order.aggregate([
      { $group: { _id: { $hour: '$createdAt' }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    res.json({ success: true, data: peakHours });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/analytics/export
router.get('/export', protect, authorize('admin'), async (req, res) => {
  try {
    const { format = 'csv', period = 'daily' } = req.query;
    let startDate = new Date(); startDate.setHours(0,0,0,0);

    if (period === 'weekly') startDate.setDate(startDate.getDate() - 7);
    else if (period === 'monthly') startDate.setMonth(startDate.getMonth() - 1);

    const bills = await Bill.find({ paidAt: { $gte: startDate }, status: 'paid' }).sort('paidAt');

    if (format === 'csv') {
      let csv = 'Date,Table,Subtotal,Tax,Total,Payment Method\n';
      for (const b of bills) {
        csv += `${b.paidAt?.toISOString()},${b.tableNumber},${b.subtotal},${b.taxAmount},${b.total},${b.paymentMethod}\n`;
      }
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=report-${period}.csv`);
      return res.send(csv);
    }

    res.json({ success: true, data: bills });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
