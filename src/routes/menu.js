const express = require('express');
const router = express.Router();
const MenuItem = require('../models/MenuItem');
const { protect, authorize } = require('../middleware/auth');

// GET /api/menu - public (customer menu)
router.get('/', async (req, res) => {
  try {
    const filter = {};
    if (req.query.category) filter.category = req.query.category;
    if (req.query.available === 'true') filter.isAvailable = true;
    if (req.query.popular === 'true') filter.isPopular = true;

    const items = await MenuItem.find(filter)
      .populate('category', 'name nameAr icon')
      .populate('goesWellWith', 'name nameAr price image')
      .sort('category name');

    res.json({ success: true, data: items });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/menu/popular - popular items for upsell
router.get('/popular', async (req, res) => {
  try {
    const items = await MenuItem.find({ isAvailable: true })
      .sort({ totalOrdered: -1 })
      .limit(6)
      .populate('category', 'name nameAr icon');
    res.json({ success: true, data: items });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/menu/low-stock - inventory alerts
router.get('/low-stock', protect, authorize('admin'), async (req, res) => {
  try {
    const items = await MenuItem.find({
      inventoryCount: { $gte: 0 },
      $expr: { $lte: ['$inventoryCount', '$lowStockThreshold'] }
    }).populate('category', 'name');
    res.json({ success: true, data: items });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/menu/:id
router.get('/:id', async (req, res) => {
  try {
    const item = await MenuItem.findById(req.params.id)
      .populate('category', 'name nameAr icon')
      .populate('goesWellWith', 'name nameAr price image');
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });
    res.json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/menu
router.post('/', protect, authorize('admin'), async (req, res) => {
  try {
    const item = await MenuItem.create(req.body);
    await item.populate('category', 'name nameAr icon');
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// PUT /api/menu/:id
router.put('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const item = await MenuItem.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    }).populate('category', 'name nameAr icon');

    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });

    // Notify all clients about menu update
    const io = req.app.get('io');
    if (io) io.emit('menu:itemUpdate', item);

    res.json({ success: true, data: item });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// PATCH /api/menu/:id/availability - quick toggle
router.patch('/:id/availability', protect, authorize('admin', 'kitchen'), async (req, res) => {
  try {
    const item = await MenuItem.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });

    item.isAvailable = !item.isAvailable;
    await item.save();

    const io = req.app.get('io');
    if (io) io.emit('menu:itemUpdate', item);

    res.json({ success: true, data: item });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// DELETE /api/menu/:id
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    await MenuItem.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Menu item deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
