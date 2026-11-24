const mongoose = require('mongoose');

const tradeSchema = new mongoose.Schema({
  fiscal_year: {
    type: String,
    required: true,
    index: true
  },
  crop_id: {
    type: String,
    required: true,
    index: true
  },
  trade_direction: {
    type: String,
    enum: ['Export', 'Import'],
    required: true
  },
  hs_code: {
    type: String,
    required: true
  },
  monetary_value_crore_inr: {
    type: Number,
    required: true
  },
  pct_growth: {
    type: Number,
    default: null
  },
  currency: {
    type: String,
    default: 'INR'
  },
  unit: {
    type: String,
    default: '₹ Crore'
  },
  scope: {
    type: String,
    default: 'NATIONAL_INDIA'
  },
  source: {
    type: String,
    default: 'DGCIS'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Trade', tradeSchema);

