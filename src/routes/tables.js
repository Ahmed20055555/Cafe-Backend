const express = require('express');
const router = express.Router();
const QRCode = require('qrcode');
const Table = require('../models/Table');
const Session = require('../models/Session');
const { protect, authorize } = require('../middleware/auth');

// GET /api/tables/status/:number - PUBLIC - check table status for customer
router.get('/status/:number', async (req, res) => {
  try {
    const table = await Table.findOne({ number: parseInt(req.params.number) })
      .populate('currentSession');
    if (!table) {
      // Table doesn't exist yet — it will be auto-created on order
      return res.json({ success: true, data: { status: 'available', tableNumber: parseInt(req.params.number), exists: false } });
    }
    const isOccupied = table.status === 'occupied' && table.currentSession?.status === 'active';
    res.json({
      success: true,
      data: {
        status: isOccupied ? 'occupied' : 'available',
        tableNumber: table.number,
        capacity: table.capacity,
        location: table.location,
        exists: true,
        sessionId: isOccupied ? table.currentSession?._id : null,
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/tables
router.get('/', protect, async (req, res) => {
  try {
    const tables = await Table.find()
      .populate('assignedWaiter', 'name')
      .populate('currentSession')
      .sort('number');
    res.json({ success: true, data: tables });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/tables
router.post('/', protect, authorize('admin'), async (req, res) => {
  try {
    const { number, capacity, location } = req.body;
    const table = await Table.create({ number, capacity, location });

    // Generate QR code
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const qrUrl = `${clientUrl}/menu?table=${table.number}`;
    const qrCode = await QRCode.toDataURL(qrUrl, {
      width: 400,
      margin: 2,
      color: { dark: '#1a1a2e', light: '#ffffff' }
    });
    table.qrCode = qrCode;
    await table.save();

    res.status(201).json({ success: true, data: table });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// PUT /api/tables/:id
router.put('/:id', protect, authorize('admin', 'waiter'), async (req, res) => {
  try {
    const table = await Table.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    }).populate('assignedWaiter', 'name');

    if (!table) return res.status(404).json({ success: false, message: 'Table not found' });

    // Emit table update via socket
    const io = req.app.get('io');
    if (io) io.emit('table:statusUpdate', table);

    res.json({ success: true, data: table });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// DELETE /api/tables/:id
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const table = await Table.findByIdAndDelete(req.params.id);
    if (!table) return res.status(404).json({ success: false, message: 'Table not found' });
    res.json({ success: true, message: 'Table deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PATCH /api/tables/:id/block  — admin locks/unlocks the table
router.patch('/:id/block', protect, authorize('admin'), async (req, res) => {
  try {
    const table = await Table.findById(req.params.id);
    if (!table) return res.status(404).json({ success: false, message: 'Table not found' });
    table.isBlocked = req.body.isBlocked;
    await table.save();
    const io = req.app.get('io');
    if (io) io.emit('table:statusUpdate', table);
    res.json({ success: true, data: table });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// PATCH /api/tables/:id/close-session  — admin closes active session
router.patch('/:id/close-session', protect, authorize('admin'), async (req, res) => {
  try {
    const table = await Table.findById(req.params.id).populate('currentSession');
    if (!table) return res.status(404).json({ success: false, message: 'Table not found' });

    if (table.currentSession) {
      const session = await Session.findById(table.currentSession._id);
      if (session) {
        session.status = 'completed';
        session.endedAt = new Date();
        await session.save();
      }
    }
    table.status = 'available';
    table.currentSession = null;
    await table.save();

    const io = req.app.get('io');
    if (io) io.emit('table:statusUpdate', table);

    res.json({ success: true, data: table });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// GET /api/tables/:id/qr - get QR code for table
router.get('/:id/qr', async (req, res) => {
  try {
    const table = await Table.findById(req.params.id);
    if (!table) return res.status(404).json({ success: false, message: 'Table not found' });

    if (!table.qrCode) {
      const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
      const qrUrl = `${clientUrl}/menu?table=${table.number}`;
      table.qrCode = await QRCode.toDataURL(qrUrl, {
        width: 400,
        margin: 2,
        color: { dark: '#1a1a2e', light: '#ffffff' }
      });
      await table.save();
    }

    res.json({ success: true, data: { qrCode: table.qrCode, tableNumber: table.number } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/tables/:number/assign-waiter
router.post('/:number/assign-waiter', protect, authorize('admin'), async (req, res) => {
  try {
    const table = await Table.findOne({ number: req.params.number });
    if (!table) return res.status(404).json({ success: false, message: 'Table not found' });

    table.assignedWaiter = req.body.waiterId;
    await table.save();
    await table.populate('assignedWaiter', 'name');

    const io = req.app.get('io');
    if (io) io.emit('table:statusUpdate', table);

    res.json({ success: true, data: table });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

module.exports = router;
