const mongoose = require('mongoose');

const billSchema = new mongoose.Schema({
  session: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session',
    required: true
  },
  table: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Table',
    required: true
  },
  tableNumber: { type: Number },
  orders: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  }],
  items: [{
    name: String,
    quantity: Number,
    unitPrice: Number,
    addOns: [{ name: String, price: Number }],
    total: Number
  }],
  subtotal: { type: Number, required: true },
  taxRate: { type: Number, default: 0.14 },
  taxAmount: { type: Number, required: true },
  total: { type: Number, required: true },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'split'],
    default: 'cash'
  },
  splitDetails: [{
    method: { type: String, enum: ['cash', 'card'] },
    amount: { type: Number },
    paidBy: { type: String }
  }],
  status: {
    type: String,
    enum: ['pending', 'paid', 'cancelled'],
    default: 'pending'
  },
  receiptUrl: { type: String },
  paidAt: { type: Date }
}, {
  timestamps: true
});

module.exports = mongoose.model('Bill', billSchema);
