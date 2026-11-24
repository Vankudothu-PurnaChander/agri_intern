const express = require('express');
const router = express.Router();
const dataController = require('../controllers/dataController');

router.get('/quality', dataController.getDataQuality);
router.get('/collection/status', dataController.getDataCollectionStatus);
router.post('/collect', dataController.triggerDataCollection);
router.post('/retrain', dataController.retrainModel);

module.exports = router;

