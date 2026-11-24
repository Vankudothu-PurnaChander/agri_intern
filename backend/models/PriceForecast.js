const mongoose = require('mongoose');

const priceForecastSchema = new mongoose.Schema({
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
  forecast_horizon_days: {
    type: Number,
    default: 15
  },
  forecast_origin_date: {
    type: String,
    required: true
  },
  latest_actual_price: {
    type: Number,
    required: true
  },
  forecast_final_price: {
    type: Number,
    required: true
  },
  expected_change_pct: {
    type: Number,
    required: true
  },
  trend_direction: {
    type: String,
    enum: ['INCREASING', 'DECREASING', 'STABLE'],
    required: true
  },
  selected_model: {
    type: String,
    required: true
  },
  model_metrics: {
    type: Object,
    default: {}
  },
  timeline: {
    type: Array,
    default: []
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('PriceForecast', priceForecastSchema);

