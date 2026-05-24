const mongoose = require('mongoose');

const loyaltySchema = new mongoose.Schema({
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    unique: true,
    trim: true
  },
  name: {
    type: String,
    trim: true
  },
  stamps: {
    type: Number,
    default: 0
  },
  totalRedeemed: {
    type: Number,
    default: 0
  },
  stampsRequired: {
    type: Number,
    default: 9 // Buy 9, get 1 free
  },
  history: [{
    action: { type: String, enum: ['earned', 'redeemed'] },
    stamps: { type: Number },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    date: { type: Date, default: Date.now }
  }]
}, {
  timestamps: true
});

// Check if eligible for free item
loyaltySchema.virtual('eligibleForFree').get(function() {
  return this.stamps >= this.stampsRequired;
});

loyaltySchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Loyalty', loyaltySchema);
