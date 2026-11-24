const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');

router.get('/summary', dashboardController.getSummary);
router.get('/crop-overview', dashboardController.getCropOverview);

module.exports = router;

