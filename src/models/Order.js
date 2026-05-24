const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  menuItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MenuItem',
    required: true
  },
  name: { type: String, required: true },
  nameAr: { type: String },
  quantity: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true },
  selectedAddOns: [{
    name: { type: String },
    price: { type: Number }
  }],
  notes: { type: String, trim: true },
  status: {
    type: String,
    enum: ['pending', 'preparing', 'ready', 'served'],
    default: 'pending'
  },
  statusUpdatedAt: { type: Date, default: Date.now }
}, { _id: true });

const orderSchema = new mongoose.Schema({
  table: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Table',
    required: true
  },
  tableNumber: {
    type: Number,
    required: true
  },
  session: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session',
    required: true
  },
  orderNumber: {
    type: Number
  },
  items: [orderItemSchema],
  status: {
    type: String,
    enum: ['pending', 'preparing', 'ready', 'served', 'completed', 'cancelled'],
    default: 'pending'
  },
  customerNotes: {
    type: String,
    trim: true
  },
  subtotal: { type: Number, default: 0 },
  tax: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  assignedWaiter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  estimatedTime: { type: Number, default: 15 }, // minutes
  estimatedReadyAt: { type: Date },
  completedAt: { type: Date }
}, {
  timestamps: true
});

// Auto-increment order number
orderSchema.pre('save', async function(next) {
  if (this.isNew) {
    const lastOrder = await this.constructor.findOne({}, {}, { sort: { orderNumber: -1 } });
    this.orderNumber = lastOrder ? lastOrder.orderNumber + 1 : 1001;
  }
  next();
});

// Calculate totals
orderSchema.methods.calculateTotals = function() {
  this.subtotal = this.items.reduce((sum, item) => {
    const addOnsTotal = item.selectedAddOns.reduce((a, addon) => a + addon.price, 0);
    return sum + (item.price + addOnsTotal) * item.quantity;
  }, 0);
  const taxRate = parseFloat(process.env.TAX_RATE || 0.14);
  this.tax = Math.round(this.subtotal * taxRate * 100) / 100;
  this.total = Math.round((this.subtotal + this.tax) * 100) / 100;
};

module.exports = mongoose.model('Order', orderSchema);
