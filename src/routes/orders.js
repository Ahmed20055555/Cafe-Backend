const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Session = require('../models/Session');
const Table = require('../models/Table');
const MenuItem = require('../models/MenuItem');
const { protect, authorize } = require('../middleware/auth');

// POST /api/orders - place order (customer, no auth needed)
router.post('/', async (req, res) => {
  try {
    const { sessionToken, items, customerNotes, tableNumber: directTableNumber } = req.body;

    let session, table;

    if (sessionToken) {
      // Normal flow: find session by token
      session = await Session.findOne({ sessionToken });
      if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
      if (session.status !== 'active') return res.status(400).json({ success: false, message: 'Session is not active' });
      table = await Table.findById(session.table);
    } else if (directTableNumber) {
      // Fallback: find or create session by table number directly
      table = await Table.findOne({ number: directTableNumber });
      if (table) {
        session = await Session.findOne({ table: table._id, status: 'active' });
        if (!session) {
          session = await Session.create({ table: table._id, tableNumber: table.number });
          table.status = 'occupied';
          table.currentSession = session._id;
          await table.save();
        }
      }
    }

    if (!session) return res.status(400).json({ success: false, message: 'No valid session. Please provide sessionToken or tableNumber.' });

    const orderItems = [];

    for (const item of items) {
      const menuItem = await MenuItem.findById(item.menuItemId);
      if (!menuItem || !menuItem.isAvailable) continue;

      orderItems.push({
        menuItem: menuItem._id,
        name: menuItem.name,
        nameAr: menuItem.nameAr,
        quantity: item.quantity,
        price: menuItem.price,
        selectedAddOns: item.selectedAddOns || [],
        notes: item.notes || ''
      });

      menuItem.totalOrdered += item.quantity;
      await menuItem.save();
    }

    if (orderItems.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid items in order' });
    }

    const Settings = require('../models/Settings');
    const settings = await Settings.findOne() || {};
    const taxRate = parseFloat(settings.taxRate || 0) / 100;

    // Check if there is an active order for this session
    let order = await Order.findOne({ session: session._id, status: { $in: ['pending', 'preparing'] } });

    if (order) {
      order.items.push(...orderItems);
      order.calculateTotals(taxRate);
      if (order.status === 'preparing') {
        order.status = 'pending';
        order.estimatedReadyAt = undefined;
      }
      
      await order.save();

      const allOrders = await Order.find({ session: session._id });
      session.totalAmount = allOrders.reduce((sum, o) => sum + o.total, 0);
      await session.save();

      const io = req.app.get('io');
      if (io) {
        io.emit('order:statusUpdate', order);
        io.emit('notification', { type: 'order', message: `تمت إضافة عناصر للطلب #${order.orderNumber} - طاولة ${session.tableNumber}`, orderId: order._id });
      }

      return res.status(201).json({ success: true, data: order });
    }

    // Otherwise create a new order
    order = new Order({
      table: session.table,
      tableNumber: session.tableNumber,
      session: session._id,
      items: orderItems,
      customerNotes,
      assignedWaiter: table?.assignedWaiter,
      estimatedTime: 15
    });

    order.calculateTotals(taxRate);
    await order.save();

    session.orders.push(order._id);
    session.totalAmount += order.total;
    await session.save();

    const io = req.app.get('io');
    if (io) {
      io.emit('order:new', order);
      io.emit('notification', { type: 'order', message: `New order #${order.orderNumber} from Table ${session.tableNumber}`, orderId: order._id });
    }

    res.status(201).json({ success: true, data: order });
  } catch (error) {
    console.error('Order placement error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// GET /api/orders - list orders (staff)
router.get('/', protect, async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.table) filter.tableNumber = parseInt(req.query.table);
    if (req.query.today === 'true') {
      const start = new Date(); start.setHours(0,0,0,0);
      const end = new Date(); end.setHours(23,59,59,999);
      filter.createdAt = { $gte: start, $lte: end };
    }
    const orders = await Order.find(filter).populate('assignedWaiter', 'name').sort('-createdAt');
    res.json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/orders/all - clear all orders (dev)
router.delete('/all', async (req, res) => {
  try {
    await Order.deleteMany({});
    res.json({ success: true, message: 'All orders deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/orders/active - active kitchen orders (NO AUTH - kitchen screen is open)
router.get('/active', async (req, res) => {
  try {
    const orders = await Order.find({ status: { $in: ['pending', 'preparing'] } })
      .populate('assignedWaiter', 'name').sort('createdAt');
    res.json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/orders/session/:token - orders for a session
router.get('/session/:token', async (req, res) => {
  try {
    const session = await Session.findOne({ sessionToken: req.params.token });
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    const orders = await Order.find({ session: session._id }).sort('createdAt');
    res.json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PATCH /api/orders/:id/status - update order status (NO AUTH - kitchen screen uses this)
router.patch('/:id/status', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    const { status, estimatedMins, readyAt } = req.body;
    order.status = status;

    if (estimatedMins) order.estimatedTime = estimatedMins;
    if (readyAt) order.estimatedReadyAt = readyAt;
    if (['ready', 'served', 'completed'].includes(status)) order.completedAt = new Date();

    await order.save();

    const io = req.app.get('io');
    if (io) {
      // Broadcast to all kitchen screens
      io.emit('order:statusUpdate', order);

      // Notify customer session with estimated time
      if (status === 'preparing' && estimatedMins) {
        io.to(`session:${order.session.toString()}`).emit('order:preparing', {
          orderId: order._id,
          orderNumber: order.orderNumber,
          tableNumber: order.tableNumber,
          estimatedMins,
          readyAt: order.estimatedReadyAt,
          message: `طلبك رقم #${order.orderNumber} بدأ تحضيره - سيكون جاهزاً خلال ${estimatedMins} دقيقة`
        });
      }

      if (status === 'ready') {
        io.to(`session:${order.session.toString()}`).emit('order:ready', {
          orderId: order._id,
          orderNumber: order.orderNumber,
          tableNumber: order.tableNumber,
          message: `طلبك رقم #${order.orderNumber} جاهز! 🎉`
        });
      }
    }

    res.json({ success: true, data: order });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// PATCH /api/orders/:id/items/:itemId/status
router.patch('/:id/items/:itemId/status', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    const item = order.items.id(req.params.itemId);
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });

    item.status = req.body.status;
    item.statusUpdatedAt = new Date();

    const allReady = order.items.every(i => i.status === 'ready' || i.status === 'served');
    const anyPreparing = order.items.some(i => i.status === 'preparing');
    if (allReady) order.status = 'ready';
    else if (anyPreparing) order.status = 'preparing';

    await order.save();
    const io = req.app.get('io');
    if (io) io.emit('order:itemUpdate', { orderId: order._id, item, orderStatus: order.status });

    res.json({ success: true, data: order });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

module.exports = router;
