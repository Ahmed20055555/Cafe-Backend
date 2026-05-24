const express = require('express');
const router = express.Router();
const Session = require('../models/Session');
const Table = require('../models/Table');

// POST /api/sessions/start  (no auth – called from customer menu)
router.post('/start', async (req, res) => {
  try {
    const { tableNumber, customerName } = req.body;
    if (tableNumber === undefined || tableNumber === null) return res.status(400).json({ success: false, message: 'tableNumber required' });

    // Use virtual table 0 for takeaway/delivery, 99 for browse
    const isTakeaway = tableNumber === 0;
    const isBrowse = tableNumber === 99;

    // Find table – auto-create if it doesn't exist yet (dev / first run)
    let table = await Table.findOne({ number: tableNumber });
    if (!table) {
      table = await Table.create({ number: tableNumber, capacity: 4, location: 'indoor' });
    }

    // Block if admin locked the table
    if (table.isBlocked) {
      return res.status(403).json({ success: false, message: 'تم حجز هذه الطاولة من قِبل الإدارة', blocked: true });
    }

    // Re-use active session if present (ONLY for real tables > 0)
    if (tableNumber > 0 && table.currentSession) {
      const existing = await Session.findById(table.currentSession);
      if (existing && existing.status === 'active') {
        return res.json({ success: true, data: existing, existing: true });
      }
    }

    const session = await Session.create({ table: table._id, tableNumber: table.number });
    if (tableNumber > 0) {
      table.status = 'occupied';
      table.currentSession = session._id;
      await table.save();
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('table:statusUpdate', table);
      io.to('staff').emit('notification', { type: 'info', message: `الطاولة ${table.number} أصبحت مشغولة` });
    }

    res.status(201).json({ success: true, data: session });
  } catch (error) {
    console.error('Start session error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get('/:token', async (req, res) => {
  try {
    const session = await Session.findOne({ sessionToken: req.params.token })
      .populate({ path: 'orders', populate: { path: 'items.menuItem', select: 'name nameAr image' } });
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    res.json({ success: true, data: session });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    const sessions = await Session.find(filter).populate('orders').populate('table').sort('-startedAt');
    res.json({ success: true, data: sessions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.patch('/:token/end', async (req, res) => {
  try {
    const session = await Session.findOne({ sessionToken: req.params.token });
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    session.status = 'completed';
    session.endedAt = new Date();
    await session.save();

    const table = await Table.findById(session.table);
    if (table) {
      table.status = 'cleaning';
      table.currentSession = null;
      await table.save();
      const io = req.app.get('io');
      if (io) io.emit('table:statusUpdate', table);
    }
    res.json({ success: true, data: session });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

module.exports = router;
