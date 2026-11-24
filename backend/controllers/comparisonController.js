const dataSync = require('../services/dataSyncService');

exports.getMandiComparison = async (req, res) => {
  try {
    const { cropId } = req.params;
    if (!cropId) {
      return res.status(400).json({ success: false, data: null, message: 'cropId parameter is required' });
    }
    const comparison = await dataSync.getMandiComparison(cropId);
    res.json({
      success: true,
      data: comparison,
      message: 'Mandi comparison retrieved successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, data: null, message: 'Failed to retrieve mandi comparison: ' + error.message });
  }
};
