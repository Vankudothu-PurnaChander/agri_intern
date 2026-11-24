const fs = require('fs');
const path = require('path');
const mlService = require('../services/mlService');
const dataGovService = require('../services/dataGovService');

const REPORTS_DIR = path.resolve(__dirname, '../../datasets/reports');

exports.getDataQuality = (req, res) => {
  try {
    const reportPath = path.join(REPORTS_DIR, 'cleaning_report.json');
    if (fs.existsSync(reportPath)) {
      const data = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
      return res.json({ success: true, data });
    }
    res.json({ success: true, data: { status: 'Reports initializing' } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to retrieve data quality metrics' });
  }
};

exports.getDataCollectionStatus = (req, res) => {
  let recentAudit = dataGovService.getStatus();
  if (!recentAudit || !recentAudit.timestamp) {
    const logPath = path.join(REPORTS_DIR, 'daily_collection_log.json');
    if (fs.existsSync(logPath)) {
      try {
        const logs = JSON.parse(fs.readFileSync(logPath, 'utf-8'));
        if (logs.length > 0) recentAudit = logs[logs.length - 1];
      } catch (e) {}
    }
  }

  res.json({
    success: true,
    data: {
      status: 'OPERATIONAL',
      providers: [
        { name: 'Agmarknet 2.0 Public API', type: 'Daily Mandi Feed', status: 'Active' },
        { name: 'Data.gov.in Mandi API', type: 'Official Open Gov Feed', status: 'Active' },
        { name: 'DGCIS Ministry of Commerce', type: 'National Trade Statistics', status: 'Active' }
      ],
      last_audit: recentAudit || { timestamp: new Date().toISOString(), status: 'Active' },
      dataFreshness: {
        lastFetchedAt: recentAudit?.timestamp || new Date().toISOString(),
        latestObservationDate: recentAudit?.latestObservationDate || 'N/A',
        recordsFetched: recentAudit?.recordsFetched || 0
      }
    }
  });
};

exports.triggerDataCollection = async (req, res) => {
  try {
    const syncResult = await dataGovService.syncDailyPrices();
    res.json({
      success: true,
      message: syncResult.message,
      data: syncResult
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to trigger data collection: ' + err.message });
  }
};

exports.retrainModel = async (req, res) => {
  try {
    const result = await mlService.triggerRetraining();
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to initiate retraining' });
  }
};

