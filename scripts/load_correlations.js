const path = require('path');
require(path.resolve(__dirname, '../backend/node_modules/dotenv')).config({ path: path.resolve(__dirname, '../backend/.env') });
const fs = require('fs');
const mongoose = require(path.resolve(__dirname, '../backend/node_modules/mongoose'));
const Correlation = require('../backend/models/Correlation');

async function loadCorrelations() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI missing from backend/.env');
    process.exit(1);
  }

  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(uri);
  console.log('Connected to Atlas successfully.');

  const jsonPath = path.resolve(__dirname, '../Datasets/processed/integrated/correlation_results.json');
  if (!fs.existsSync(jsonPath)) {
    console.error('correlation_results.json not found at:', jsonPath);
    process.exit(1);
  }

  const rawData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  const entries = Object.values(rawData);
  console.log(`Found ${entries.length} correlation entries to import.`);

  let inserted = 0;
  let updated = 0;

  for (const entry of entries) {
    const filter = { crop_id: entry.crop_id, market_name: entry.market_name };
    const doc = {
      crop_id: entry.crop_id,
      crop_name: entry.crop_name,
      market_name: entry.market_name,
      analysis_date: entry.analysis_date,
      sample_count: entry.sample_count,
      pearson: entry.pearson,
      spearman: entry.spearman,
      lagged_correlations: entry.lagged_correlations,
      rolling_correlations: entry.rolling_correlations || [],
      granger_causality: entry.granger_causality,
      selected_lag: entry.selected_lag || 0,
      interpretation: entry.interpretation,
      data_version: '5-year-integrated-v1',
      calculated_at: new Date()
    };

    const res = await Correlation.updateOne(filter, { $set: doc }, { upsert: true });
    if (res.upsertedCount > 0) inserted++;
    else updated++;
  }

  console.log(`✅ Correlations Import Complete! Inserted: ${inserted}, Updated: ${updated}, Total: ${entries.length}`);
  await mongoose.disconnect();
  process.exit(0);
}

loadCorrelations().catch(err => {
  console.error('Import error:', err);
  process.exit(1);
});
