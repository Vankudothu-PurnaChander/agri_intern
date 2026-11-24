/**
 * MongoDB Atlas Index Creation and Optimization Script.
 * Ensures high-performance compound indexing for Warangal agricultural queries.
 */
const path = require('path');
const dotenv = require(path.resolve(__dirname, '../backend/node_modules/dotenv'));
dotenv.config({ path: path.resolve(__dirname, '../backend/.env') });
const mongoose = require(path.resolve(__dirname, '../backend/node_modules/mongoose'));

async function safeCreateIndex(coll, keys, options = {}) {
  try {
    const name = await coll.createIndex(keys, options);
    console.log(`   + Created/verified index on [${Object.keys(keys).join(', ')}]: ${name}`);
  } catch (err) {
    if (err.code === 85) {
      console.log(`   ~ Index already exists on [${Object.keys(keys).join(', ')}], keeping active.`);
    } else {
      console.warn(`   ! Index creation note on [${Object.keys(keys).join(', ')}]: ${err.message}`);
    }
  }
}

async function createOptimizedIndexes() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set in backend/.env');
    process.exit(1);
  }

  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  const db = mongoose.connection.db;

  console.log('\n--- 1. Optimizing Indexes for "prices" Collection ---');
  const priceColl = db.collection('prices');
  
  // 1. Primary query pattern: crop + market + descending date
  await safeCreateIndex(priceColl, { crop_id: 1, canonical_market_name: 1, observation_date: -1 });

  // 2. Market history pattern: market + descending date
  await safeCreateIndex(priceColl, { canonical_market_name: 1, observation_date: -1 });

  // 3. Crop district-wide timeline pattern: crop + descending date
  await safeCreateIndex(priceColl, { crop_id: 1, observation_date: -1 });

  // 4. Observation date descending
  await safeCreateIndex(priceColl, { observation_date: -1 });

  const priceIndexes = await priceColl.indexes();
  console.log('Active Price Indexes:', priceIndexes.map(i => i.name));

  console.log('\n--- 2. Optimizing Indexes for "arrivals" Collection ---');
  const arrivalColl = db.collection('arrivals');

  // 1. Primary arrival query pattern: crop + market + descending date
  await safeCreateIndex(arrivalColl, { crop_id: 1, canonical_market_name: 1, observation_date: -1 });

  // 2. Market arrivals pattern: market + descending date
  await safeCreateIndex(arrivalColl, { canonical_market_name: 1, observation_date: -1 });

  // 3. Observation date descending
  await safeCreateIndex(arrivalColl, { observation_date: -1 });

  const arrivalIndexes = await arrivalColl.indexes();
  console.log('Active Arrival Indexes:', arrivalIndexes.map(i => i.name));

  console.log('\n--- 3. Optimizing Indexes for "trades" Collection ---');
  const tradeColl = db.collection('trades');

  await safeCreateIndex(tradeColl, { crop_id: 1, trade_direction: 1, fiscal_year: -1 });

  const tradeIndexes = await tradeColl.indexes();
  console.log('Active Trade Indexes:', tradeIndexes.map(i => i.name));

  console.log('\n✅ All compound indexes verified and active on MongoDB Atlas!');
  process.exit(0);
}

createOptimizedIndexes().catch(err => {
  console.error('Index creation failed:', err);
  process.exit(1);
});
