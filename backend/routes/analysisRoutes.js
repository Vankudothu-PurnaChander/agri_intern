const express = require('express');
const router = express.Router();
const analysisController = require('../controllers/analysisController');

router.get('/correlation', analysisController.getAllCorrelations);
router.get('/price-arrival/:cropId', analysisController.getPriceArrivalAnalysis);
router.get('/lag-analysis/:cropId', analysisController.getLagAnalysis);

module.exports = router;

