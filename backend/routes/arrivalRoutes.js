const express = require('express');
const router = express.Router();
const arrivalController = require('../controllers/arrivalController');

router.get('/markets', arrivalController.getReportingMarkets);
router.get('/latest', arrivalController.getLatestArrivals);
router.get('/history', arrivalController.getArrivalHistory);

module.exports = router;

