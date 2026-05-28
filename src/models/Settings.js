const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  cafeName: { type: String, default: 'كافيه أرتيزان' },
  primaryColor: { type: String, default: '#c8956c' },
  taxRate: { type: Number, default: 0 },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Settings', settingsSchema);
