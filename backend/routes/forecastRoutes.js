const express = require('express');
const router = express.Router();
const forecastController = require('../controllers/forecastController');

router.get('/support', forecastController.getSupport);
router.get('/:cropId', forecastController.getForecast);
router.get('/:cropId/horizons', forecastController.getMultiHorizonForecast);
router.get('/:cropId/evaluation', forecastController.getModelEvaluation);

module.exports = router;

