const dataSync = require('../services/dataSyncService');
const cacheService = require('../services/cacheService');

exports.getSummary = async (req, res) => {
  try {
    const summary = await dataSync.getDashboardSummary();
    res.json({
      success: true,
      data: summary,
      message: 'Dashboard summary retrieved successfully',
      cache: cacheService.getMetrics()
    });
  } catch (error) {
    res.status(500).json({ success: false, data: null, message: 'Failed to retrieve dashboard summary: ' + error.message });
  }
};

exports.getCropOverview = async (req, res) => {
  try {
    const overview = await dataSync.getCropOverview();
    res.json({
      success: true,
      data: overview,
      count: overview.length,
      message: 'Crop overview retrieved successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, data: [], message: 'Failed to retrieve crop overview: ' + error.message });
  }
};
