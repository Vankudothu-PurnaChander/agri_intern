const mongoose = require('mongoose');

const collectionLogSchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    default: Date.now
  },
  source: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['SUCCESS', 'PARTIAL', 'FAILED'],
    required: true
  },
  records_fetched: {
    type: Number,
    default: 0
  },
  records_upserted: {
    type: Number,
    default: 0
  },
  error_message: {
    type: String,
    default: null
  }
});

module.exports = mongoose.model('CollectionLog', collectionLogSchema);

