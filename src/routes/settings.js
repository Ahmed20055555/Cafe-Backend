const express = require('express');
const router = express.Router();
const Settings = require('../models/Settings');
const { protect, authorize } = require('../middleware/auth');

// GET /api/settings - Public
router.get('/', async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({});
    }
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/settings - Admin only
router.put('/', protect, authorize('admin'), async (req, res) => {
  try {
    const { cafeName, primaryColor } = req.body;
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings();
    }
    
    if (cafeName) settings.cafeName = cafeName;
    if (primaryColor) settings.primaryColor = primaryColor;
    settings.updatedAt = Date.now();
    
    await settings.save();
    
    // Broadcast setting updates so UI changes live
    const io = req.app.get('io');
    if (io) {
      io.emit('settings:update', settings);
    }

    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
