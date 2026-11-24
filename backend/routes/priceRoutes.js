const express = require('express');
const router = express.Router();
const priceController = require('../controllers/priceController');

router.get('/markets', priceController.getReportingMarkets);
router.get('/latest', priceController.getLatestPrices);
router.get('/today', priceController.getTodayPrices);
router.get('/history', priceController.getPriceHistory);

module.exports = router;

