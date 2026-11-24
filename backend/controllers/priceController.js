const dataSync = require('../services/dataSyncService');

exports.getReportingMarkets = async (req, res) => {
  try {
    const { cropId } = req.query;
    const markets = await dataSync.getReportingMarkets(cropId);
    res.json({
      success: true,
      data: markets,
      count: markets.length,
      message: 'Reporting markets retrieved successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, data: [], message: 'Failed to retrieve reporting markets: ' + error.message });
  }
};

exports.getLatestPrices = async (req, res) => {
  try {
    const { cropId, market, page = 1, limit = 50, sort = 'desc' } = req.query;
    const result = await dataSync.getLatestPrices(cropId, market, false, Number(page), Number(limit), sort);
    res.json({
      success: true,
      data: result.data,
      count: result.data.length,
      pagination: result.pagination,
      message: result.data.length > 0 ? 'Latest prices retrieved successfully' : 'No records found for the selected criteria'
    });
  } catch (error) {
    res.status(500).json({ success: false, data: [], message: 'Failed to retrieve latest prices: ' + error.message });
  }
};

exports.getTodayPrices = async (req, res) => {
  try {
    const { cropId, market, page = 1, limit = 50, sort = 'desc' } = req.query;
    const result = await dataSync.getLatestPrices(cropId, market, true, Number(page), Number(limit), sort);
    res.json({
      success: true,
      data: result.data,
      count: result.data.length,
      pagination: result.pagination,
      message: result.data.length === 0 ? 'No price reported today.' : 'Today prices retrieved successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, data: [], message: 'Failed to retrieve today prices: ' + error.message });
  }
};

exports.getPriceHistory = async (req, res) => {
  try {
    const { cropId, market, days = 30 } = req.query;
    if (!cropId) {
      return res.status(400).json({ success: false, data: [], message: 'cropId query parameter is required' });
    }
    const history = await dataSync.getPriceHistory(cropId, market, Number(days));
    res.json({
      success: true,
      data: history,
      count: history.length,
      message: 'Price history retrieved successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, data: [], message: 'Failed to retrieve price history: ' + error.message });
  }
};
