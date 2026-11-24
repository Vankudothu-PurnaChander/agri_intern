const mlService = require('../services/mlService');

exports.getSupport = async (req, res) => {
  try {
    res.json({ success: true, data: await mlService.getSupportTable() });
  } catch (error) {
    res.status(503).json({ success: false, message: 'Forecast service unavailable' });
  }
};

exports.getForecast = async (req, res) => {
  try {
    const { cropId } = req.params;
    const market = req.query.market || null;
    const horizon = Number(req.query.horizon ?? 15);
    if (![7, 15, 30].includes(horizon)) {
      return res.status(400).json({ success: false, message: 'horizon must be 7, 15 or 30' });
    }
    const forecast = await mlService.getForecast(cropId, market, horizon);
    const status = forecast && forecast.status === 'SERVICE_UNAVAILABLE' ? 503 : 200;
    res.status(status).json({ success: status === 200, data: forecast });
  } catch (error) {
    console.error('Forecast error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate forecast' });
  }
};

exports.getMultiHorizonForecast = async (req, res) => {
  try {
    const { cropId } = req.params;
    const { market } = req.query;
    const multi = await mlService.getMultiHorizonForecast(cropId, market);
    res.json({ success: true, data: multi });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to retrieve multi-horizon forecast' });
  }
};

exports.getModelEvaluation = async (req, res) => {
  try {
    const { cropId } = req.params;
    const evalData = await mlService.getCropEvaluation(cropId);
    res.json({ success: true, data: evalData });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to retrieve model evaluation' });
  }
};

