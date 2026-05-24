const mongoose = require('mongoose');

const addOnSchema = new mongoose.Schema({
  name: { type: String, required: true },
  nameAr: { type: String },
  price: { type: Number, required: true, min: 0 }
}, { _id: true });

const menuItemSchema = new mongoose.Schema({
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Category is required']
  },
  name: {
    type: String,
    required: [true, 'Item name is required'],
    trim: true
  },
  nameAr: {
    type: String,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  descriptionAr: {
    type: String,
    trim: true
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: 0
  },
  image: {
    type: String
  },
  allergens: [{
    type: String,
    enum: ['gluten', 'dairy', 'nuts', 'eggs', 'soy', 'fish', 'shellfish', 'sesame', 'none']
  }],
  isAvailable: {
    type: Boolean,
    default: true
  },
  isPopular: {
    type: Boolean,
    default: false
  },
  addOns: [addOnSchema],
  preparationTime: {
    type: Number, // in minutes
    default: 15
  },
  // Inventory
  inventoryCount: {
    type: Number,
    default: -1 // -1 means unlimited
  },
  lowStockThreshold: {
    type: Number,
    default: 5
  },
  // Analytics
  totalOrdered: {
    type: Number,
    default: 0
  },
  // Upsell
  goesWellWith: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MenuItem'
  }]
}, {
  timestamps: true
});

// Virtual for low stock check
menuItemSchema.virtual('isLowStock').get(function() {
  if (this.inventoryCount === -1) return false;
  return this.inventoryCount <= this.lowStockThreshold;
});

menuItemSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('MenuItem', menuItemSchema);
