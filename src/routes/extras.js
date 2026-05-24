const express = require('express');
const router = express.Router();
const Feedback = require('../models/Feedback');
const Loyalty = require('../models/Loyalty');
const Reservation = require('../models/Reservation');
const { protect, authorize } = require('../middleware/auth');

// --- FEEDBACK ---
router.post('/feedback', async (req, res) => {
  try {
    const feedback = await Feedback.create(req.body);
    res.status(201).json({ success: true, data: feedback });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get('/feedback', protect, authorize('admin'), async (req, res) => {
  try {
    const feedback = await Feedback.find().sort('-createdAt').limit(50);
    res.json({ success: true, data: feedback });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- LOYALTY ---
router.get('/loyalty/:phone', async (req, res) => {
  try {
    const loyalty = await Loyalty.findOne({ phone: req.params.phone });
    if (!loyalty) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: loyalty });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/loyalty/redeem', async (req, res) => {
  try {
    const loyalty = await Loyalty.findOne({ phone: req.body.phone });
    if (!loyalty) return res.status(404).json({ success: false, message: 'Not found' });
    if (loyalty.stamps < loyalty.stampsRequired) {
      return res.status(400).json({ success: false, message: 'Not enough stamps' });
    }
    loyalty.stamps -= loyalty.stampsRequired;
    loyalty.totalRedeemed += 1;
    loyalty.history.push({ action: 'redeemed', stamps: loyalty.stampsRequired });
    await loyalty.save();
    res.json({ success: true, data: loyalty });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// --- RESERVATIONS ---
router.post('/reservations', async (req, res) => {
  try {
    const reservation = await Reservation.create(req.body);
    const io = req.app.get('io');
    if (io) io.emit('notification', { type: 'info', message: `New reservation: ${reservation.customerName} for ${reservation.partySize} at ${reservation.timeSlot}` });
    res.status(201).json({ success: true, data: reservation });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get('/reservations', protect, async (req, res) => {
  try {
    const filter = {};
    if (req.query.date) {
      const d = new Date(req.query.date);
      const next = new Date(d); next.setDate(next.getDate() + 1);
      filter.reservationDate = { $gte: d, $lt: next };
    }
    if (req.query.status) filter.status = req.query.status;
    const reservations = await Reservation.find(filter).populate('table').sort('reservationDate timeSlot');
    res.json({ success: true, data: reservations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.patch('/reservations/:id', protect, async (req, res) => {
  try {
    const r = await Reservation.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!r) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: r });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

module.exports = router;
