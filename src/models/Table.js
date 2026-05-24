const mongoose = require('mongoose');

const tableSchema = new mongoose.Schema({
  number: {
    type: Number,
    required: [true, 'Table number is required'],
    unique: true
  },
  capacity: {
    type: Number,
    required: [true, 'Table capacity is required'],
    min: 1,
    max: 20
  },
  status: {
    type: String,
    enum: ['available', 'occupied', 'reserved', 'cleaning'],
    default: 'available'
  },
  qrCode: {
    type: String // Base64 encoded QR code image
  },
  assignedWaiter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  currentSession: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session'
  },
  location: {
    type: String,
    enum: ['indoor', 'outdoor', 'terrace', 'vip'],
    default: 'indoor'
  },
  isBlocked: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Table', tableSchema);
