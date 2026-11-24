const express = require('express');
const router = express.Router();
const comparisonController = require('../controllers/comparisonController');

router.get('/:cropId', comparisonController.getMandiComparison);

module.exports = router;

