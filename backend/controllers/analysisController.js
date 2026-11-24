const mlService = require('../services/mlService');

exports.getAllCorrelations = async (req, res) => {
  try {
    const data = await mlService.getCorrelations();
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to retrieve correlation analysis' });
  }
};

exports.getPriceArrivalAnalysis = async (req, res) => {
  try {
    const { cropId } = req.params;
    const { market } = req.query;
    const data = await mlService.getPriceArrivalAnalysis(cropId, market);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to retrieve price-arrival dynamics' });
  }
};

exports.getLagAnalysis = async (req, res) => {
  try {
    const { cropId } = req.params;
    const { market } = req.query;
    const data = await mlService.getPriceArrivalAnalysis(cropId, market);
    res.json({
      success: true,
      data: {
        cropId,
        laggedCorrelations: data.lagged_correlations || {},
        selectedLag: data.selected_lag || 0,
        interpretation: data.interpretation
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to retrieve lag analysis' });
  }
};

