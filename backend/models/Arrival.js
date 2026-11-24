const mongoose = require('mongoose');

const arrivalSchema = new mongoose.Schema({
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
  arrival_quantity: {
    type: Number,
    default: null
  },
  arrival_unit: {
    type: String,
    default: 'Tonnes'
  },
  arrival_status: {
    type: String,
    enum: ['REPORTED_POSITIVE', 'REPORTED_ZERO', 'NOT_REPORTED', 'DATA_COLLECTION_FAILURE'],
    default: 'REPORTED_POSITIVE'
  },
  modal_price: {
    type: Number,
    default: null
  },
  source: {
    type: String,
    default: 'Agmarknet'
  }
}, {
  timestamps: true
});

arrivalSchema.index(
  { observation_date: 1, crop_id: 1, canonical_market_name: 1 },
  { unique: true }
);

module.exports = mongoose.model('Arrival', arrivalSchema);

