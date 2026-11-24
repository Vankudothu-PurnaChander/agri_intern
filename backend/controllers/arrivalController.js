const dataSync = require('../services/dataSyncService');

exports.getReportingMarkets = async (req, res) => {
  try {
    const { cropId } = req.query;
    const markets = await dataSync.getReportingArrivalMarkets(cropId);
    res.json({
      success: true,
      data: markets,
      count: markets.length,
      message: 'Arrival reporting markets retrieved successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, data: [], message: 'Failed to retrieve arrival markets: ' + error.message });
  }
};

exports.getLatestArrivals = async (req, res) => {
  try {
    const { cropId, market } = req.query;
    const summary = await dataSync.getLatestArrivals(cropId, market);
    res.json({
      success: true,
      data: summary,
      message: 'Latest arrival summary retrieved successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, data: null, message: 'Failed to retrieve latest arrivals: ' + error.message });
  }
};

exports.getArrivalHistory = async (req, res) => {
  try {
    const { cropId, market, days = 60, page = 1, limit = 50 } = req.query;
    if (!cropId) {
      return res.status(400).json({ success: false, data: [], message: 'cropId query parameter is required' });
    }
    const result = await dataSync.getArrivalHistory(cropId, market, Number(days), Number(page), Number(limit));
    res.json({
      success: true,
      data: result.data,
      count: result.data.length,
      pagination: result.pagination,
      message: result.data.length > 0 ? 'Arrival history retrieved successfully' : 'No arrival records found for the selected criteria'
    });
  } catch (error) {
    res.status(500).json({ success: false, data: [], message: 'Failed to retrieve arrival history: ' + error.message });
  }
};
