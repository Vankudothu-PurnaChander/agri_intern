const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { connectDB } = require('./config/db');
const dataSync = require('./services/dataSyncService');
const cacheService = require('./services/cacheService');

// Route imports
const dashboardRoutes = require('./routes/dashboardRoutes');
const priceRoutes = require('./routes/priceRoutes');
const arrivalRoutes = require('./routes/arrivalRoutes');
const comparisonRoutes = require('./routes/comparisonRoutes');
const analysisRoutes = require('./routes/analysisRoutes');
const forecastRoutes = require('./routes/forecastRoutes');
const dataRoutes = require('./routes/dataRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Security & Parsing Middlewares
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors());
app.use(express.json());

// Initialize Database & Datasets Cache
connectDB();
dataSync.ensureLoaded();

// Mount REST API Routes
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/prices', priceRoutes);
app.use('/api/arrivals', arrivalRoutes);
app.use('/api/mandi-comparison', comparisonRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/forecast', forecastRoutes);
app.use('/api/data', dataRoutes);

// Health check & performance telemetry
app.get('/api/health', (req, res) => {
  res.json({
    status: 'HEALTHY',
    service: 'Warangal Agricultural Market Intelligence Backend',
    district: 'Warangal',
    state: 'Telangana',
    supportedCrops: 7,
    storage: {
      mongoConnected: require('./config/db').getDBStatus(),
      cluster: 'MongoDB Atlas'
    },
    cache: cacheService.getMetrics(),
    timestamp: new Date().toISOString()
  });
});

// Centralized error handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({
    success: false,
    message: 'An internal server error occurred',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Agricultural Market Intelligence Server listening on port ${PORT}`);
});

module.exports = app;

