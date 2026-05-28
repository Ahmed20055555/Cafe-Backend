const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
const Bill = require('../models/Bill');
const Session = require('../models/Session');
const Order = require('../models/Order');
const Table = require('../models/Table');
const Loyalty = require('../models/Loyalty');
const { protect } = require('../middleware/auth');

// POST /api/bills - generate bill
router.post('/', async (req, res) => {
  try {
    const { sessionToken } = req.body;
    const session = await Session.findOne({ sessionToken }).populate('orders');
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

    const existing = await Bill.findOne({ session: session._id, status: { $ne: 'cancelled' } });
    if (existing) return res.json({ success: true, data: existing });

    let subtotal = 0;
    const billItems = [];
    for (const order of session.orders) {
      for (const item of order.items) {
        const addOnsTotal = item.selectedAddOns.reduce((s, a) => s + a.price, 0);
        const itemTotal = (item.price + addOnsTotal) * item.quantity;
        billItems.push({
          name: item.name, quantity: item.quantity,
          unitPrice: item.price, addOns: item.selectedAddOns, total: itemTotal
        });
        subtotal += itemTotal;
      }
    }

    const Settings = require('../models/Settings');
    const settings = await Settings.findOne() || {};
    const taxRate = parseFloat(settings.taxRate || 0) / 100;
    const taxAmount = Math.round(subtotal * taxRate * 100) / 100;
    const total = Math.round((subtotal + taxAmount) * 100) / 100;

    const crypto = require('crypto');
    const orderReference = 'IG-' + crypto.randomBytes(3).toString('hex').toUpperCase();

    const bill = await Bill.create({
      session: session._id, table: session.table, tableNumber: session.tableNumber,
      orders: session.orders.map(o => o._id), items: billItems,
      subtotal, taxRate, taxAmount, total,
      orderReference,
      paymentMethod: req.body.paymentMethod || 'cash'
    });

    session.status = 'billing';
    await session.save();

    const io = req.app.get('io');
    if (io) io.emit('bill:requested', { tableNumber: session.tableNumber, bill });

    res.status(201).json({ success: true, data: bill });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// GET /api/bills/pending-receipts
router.get('/pending-receipts', async (req, res) => {
  try {
    const bills = await Bill.find({ status: 'pending' })
      .sort('createdAt');
    res.json({ success: true, data: bills });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PATCH /api/bills/:id/receipt-url
router.patch('/:id/receipt-url', async (req, res) => {
  try {
    const bill = await Bill.findById(req.params.id);
    if (!bill) return res.status(404).json({ success: false, message: 'Bill not found' });
    
    if (req.body.receiptUrl) bill.receiptUrl = req.body.receiptUrl;
    if (req.body.paymentMethod) bill.paymentMethod = req.body.paymentMethod;
    
    await bill.save();
    
    const io = req.app.get('io');
    if (io) {
      io.emit('bill:receiptUploaded', bill);
      io.emit('notification', { type: 'payment', message: `طاولة ${bill.tableNumber} رفعت إيصال دفع جديد.`, billId: bill._id });
    }
    
    res.json({ success: true, data: bill });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// POST /api/bills/:id/pay
router.post('/:id/pay', async (req, res) => {
  try {
    const bill = await Bill.findById(req.params.id);
    if (!bill) return res.status(404).json({ success: false, message: 'Bill not found' });

    bill.paymentMethod = req.body.paymentMethod || 'cash';
    if (req.body.splitDetails) bill.splitDetails = req.body.splitDetails;
    bill.status = 'paid';
    bill.paidAt = new Date();
    await bill.save();

    // Handle loyalty
    if (req.body.loyaltyPhone) {
      let loyalty = await Loyalty.findOne({ phone: req.body.loyaltyPhone });
      if (!loyalty) loyalty = await Loyalty.create({ phone: req.body.loyaltyPhone, name: req.body.loyaltyName || '' });
      const stamps = Math.floor(bill.total / 10);
      loyalty.stamps += stamps;
      loyalty.history.push({ action: 'earned', stamps });
      await loyalty.save();
    }

    // End session (but do NOT close the table so it stays occupied)
    const session = await Session.findById(bill.session);
    if (session) {
      session.status = 'completed';
      session.endedAt = new Date();
      await session.save();
    }

    res.json({ success: true, data: bill });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// GET /api/bills/:id/receipt - generate PDF receipt
router.get('/:id/receipt', async (req, res) => {
  try {
    const bill = await Bill.findById(req.params.id);
    if (!bill) return res.status(404).json({ success: false, message: 'Bill not found' });

    const doc = new PDFDocument({ size: [226, 600], margin: 10 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=receipt-${bill._id}.pdf`);
    doc.pipe(res);

    doc.fontSize(14).font('Helvetica-Bold').text('CAFE MANAGEMENT', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(8).font('Helvetica').text(`Table: ${bill.tableNumber}`, { align: 'center' });
    doc.text(`Date: ${new Date(bill.paidAt || bill.createdAt).toLocaleString()}`, { align: 'center' });
    doc.moveDown(0.3);
    doc.text('─'.repeat(30), { align: 'center' });
    doc.moveDown(0.3);

    for (const item of bill.items) {
      doc.text(`${item.quantity}x ${item.name}`);
      doc.text(`   ${item.total.toFixed(2)} EGP`, { align: 'right' });
    }

    doc.moveDown(0.3);
    doc.text('─'.repeat(30), { align: 'center' });
    doc.text(`Subtotal: ${bill.subtotal.toFixed(2)} EGP`, { align: 'right' });
    doc.text(`Tax (${(bill.taxRate * 100).toFixed(0)}%): ${bill.taxAmount.toFixed(2)} EGP`, { align: 'right' });
    doc.font('Helvetica-Bold').fontSize(10);
    doc.text(`TOTAL: ${bill.total.toFixed(2)} EGP`, { align: 'right' });
    doc.moveDown(0.5);
    doc.font('Helvetica').fontSize(8);
    doc.text('Thank you for dining with us!', { align: 'center' });

    doc.end();
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
