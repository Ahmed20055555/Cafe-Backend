const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const sessionSchema = new mongoose.Schema({
  table: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Table',
    required: true
  },
  tableNumber: {
    type: Number,
    required: true
  },
  sessionToken: {
    type: String,
    unique: true,
    default: () => uuidv4()
  },
  status: {
    type: String,
    enum: ['active', 'billing', 'completed'],
    default: 'active'
  },
  orders: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  }],
  totalAmount: {
    type: Number,
    default: 0
  },
  loyaltyPhone: { type: String },
  loyaltyStampsEarned: { type: Number, default: 0 },
  startedAt: { type: Date, default: Date.now },
  endedAt: { type: Date }
}, {
  timestamps: true
});

module.exports = mongoose.model('Session', sessionSchema);
