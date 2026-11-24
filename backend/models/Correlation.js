const mongoose = require('mongoose');

const correlationSchema = new mongoose.Schema({
  crop_id: {
    type: String,
    required: true,
    index: true
  },
  crop_name: {
    type: String,
    required: true
  },
  market_name: {
    type: String,
    required: true,
    index: true
  },
  analysis_date: {
    type: String,
    required: true
  },
  sample_count: {
    type: Number,
    required: true
  },
  pearson: {
    correlation: Number,
    p_value: Number,
    is_significant: Boolean
  },
  spearman: {
    correlation: Number,
    p_value: Number,
    is_significant: Boolean
  },
  lagged_correlations: {
    type: Map,
    of: Object,
    default: {}
  },
  rolling_correlations: [{
    date: String,
    correlation: Number
  }],
  granger_causality: {
    type: Object,
    default: null
  },
  selected_lag: {
    type: Number,
    default: 0
  },
  interpretation: {
    type: String,
    required: true
  },
  data_version: {
    type: String,
    default: '5-year-integrated-v1'
  },
  calculated_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound unique key ensuring idempotency
correlationSchema.index({ crop_id: 1, market_name: 1 }, { unique: true });

module.exports = mongoose.model('Correlation', correlationSchema);

