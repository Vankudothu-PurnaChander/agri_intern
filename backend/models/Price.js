const mongoose = require('mongoose');

const priceSchema = new mongoose.Schema({
  observation_date: {
    type: String,
    required: true,
    index: true // Format: YYYY-MM-DD
  },
  crop_id: {
    type: String,
    required: true,
    index: true
  },
  crop_name: {
    type: String,
    required: true
  },
  canonical_market_name: {
    type: String,
    required: true,
    index: true
  },
  district: {
    type: String,
    default: 'Warangal'
  },
  state: {
    type: String,
    default: 'Telangana'
  },
  variety: {
    type: String,
    default: 'FAQ'
  },
  grade: {
    type: String,
    default: 'FAQ'
  },
  min_price: {
    type: Number,
    required: true
  },
  max_price: {
    type: Number,
    required: true
  },
  modal_price: {
    type: Number,
    required: true,
    index: true
  },
  price_unit: {
    type: String,
    default: '₹/Quintal'
  },
  price_source: {
    type: String,
    default: 'Agmarknet'
  },
  fetched_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

priceSchema.index(
  { observation_date: 1, crop_id: 1, canonical_market_name: 1, variety: 1, grade: 1 },
  { unique: true }
);

module.exports = mongoose.model('Price', priceSchema);

