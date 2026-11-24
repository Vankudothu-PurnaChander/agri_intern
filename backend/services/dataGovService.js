/**
 * Data.gov.in Mandi Integration Service
 * Securely communicates with Data.gov.in Agmarknet API using DATA_GOVT_API_KEY.
 * Retrieves verified market price observations, filters for Warangal district mandis,
 * standardizes the 7 supported crops, preserves original observation dates,
 * records fetched_at timestamps, and upserts into MongoDB Atlas without duplicates.
 */
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { CROPS, WARANGAL_MARKETS } = require('../config/crops');
const { getDBStatus } = require('../config/db');
const Price = require('../models/Price');
const CollectionLog = require('../models/CollectionLog');
const cacheService = require('./cacheService');

const RESOURCE_ID = '9ef84268-d588-465a-a308-a864a43d0070';
const BASE_URL = `https://api.data.gov.in/resource/${RESOURCE_ID}`;
const LOG_FILE = path.resolve(__dirname, '../../datasets/reports/daily_collection_log.json');

const WARANGAL_DISTRICTS = new Set([
  'warangal', 'hanumakonda', 'jangaon', 'mahabubabad',
  'mulugu', 'jayashankar bhupalpally', 'warangal rural', 'warangal urban'
]);

// Helper to normalize DD/MM/YYYY or YYYY-MM-DD
function normalizeDate(rawDate) {
  if (!rawDate) return null;
  const s = String(rawDate).trim();
  // Check if DD/MM/YYYY or DD-MM-YYYY
  const partsSlash = s.split('/');
  if (partsSlash.length === 3) {
    if (partsSlash[2].length === 4) {
      // DD/MM/YYYY
      const day = partsSlash[0].padStart(2, '0');
      const month = partsSlash[1].padStart(2, '0');
      const year = partsSlash[2];
      return `${year}-${month}-${day}`;
    } else if (partsSlash[0].length === 4) {
      // YYYY/MM/DD
      return `${partsSlash[0]}-${partsSlash[1].padStart(2, '0')}-${partsSlash[2].padStart(2, '0')}`;
    }
  }
  const partsDash = s.split('-');
  if (partsDash.length === 3) {
    if (partsDash[2].length === 4) {
      // DD-MM-YYYY
      return `${partsDash[2]}-${partsDash[1].padStart(2, '0')}-${partsDash[0].padStart(2, '0')}`;
    } else if (partsDash[0].length === 4) {
      return s; // already YYYY-MM-DD
    }
  }
  return s;
}

// Canonical resolution for the 7 crops with strict vegetable/other pulse exclusions
function resolveCropId(name) {
  if (!name) return null;
  const s = String(name).trim().toLowerCase();

  // Exclude perishable vegetables and non-target pulses
  if (s.includes('green chilli') || s.includes('green chili') || s.includes('green chilly')) return null;
  if (s.includes('bhindi') || s.includes('ladies finger') || s.includes('okra')) return null;
  if (s.includes('green gram') || s.includes('moong') || s.includes('black gram') || s.includes('urad') || s.includes('bengal gram') || s.includes('chana')) return null;

  if (s.includes('cotton') || s.includes('kapas')) return 'cotton';
  if (s.includes('dry chilli') || s.includes('dry chillies') || s.includes('red chilli') || s.includes('red chillies') || s.includes('chilli (dry)')) return 'dry_chillies';
  if (s.includes('maize') || s.includes('corn') || s.includes('makka')) return 'maize';
  if (s.includes('turmeric') || s.includes('haldi') || s.includes('pasupu')) return 'turmeric';
  if (s.includes('groundnut') || s.includes('peanut') || s.includes('palli')) return 'groundnut';
  if (s.includes('paddy') || s.includes('dhan') || s.includes('rice(paddy)') || s.includes('bpt')) return 'paddy';
  if (s.includes('red gram') || s.includes('arhar') || s.includes('tur') || s.includes('kandi') || s.includes('pigeon pea')) return 'red_gram';

  return null;
}

// Canonical APMC market name resolution
function resolveMarket(rawMarket) {
  if (!rawMarket) return null;
  const m = String(rawMarket).trim();
  const lower = m.toLowerCase();

  if (lower.includes('warangal')) return 'Warangal APMC';
  if (lower.includes('kesamudram')) return 'Kesamudram APMC';
  if (lower.includes('jangaon')) return 'Jangaon APMC';
  if (lower.includes('mahabubabad')) return 'Mahabubabad APMC';
  if (lower.includes('narsampet') && !lower.includes('nekonda')) return 'Narsampet APMC';
  if (lower.includes('nekkonda') || lower.includes('nekonda')) return 'Nekkonda APMC';
  if (lower.includes('mulugu')) return 'Mulugu APMC';
  if (lower.includes('wardhannapet')) return 'Wardhannapet APMC';
  if (lower.includes('ghanpur')) return 'Station Ghanpur';
  if (lower.includes('thorrur')) return 'Thorrur APMC';
  if (lower.includes('parkal')) return 'Parkal APMC';
  if (lower.includes('cherial')) return 'Cherial APMC';
  if (lower.includes('kamalapur')) return 'Kamalapur APMC';

  return m.toLowerCase().includes('apmc') ? m : `${m} APMC`;
}

class DataGovService {
  constructor() {
    this.apiKey = process.env.DATA_GOVT_API_KEY || '';
    this.lastFetchStatus = {
      timestamp: null,
      status: 'INITIAL',
      recordsFetched: 0,
      recordsUpserted: 0,
      latestObservationDate: null,
      message: 'Service initialized'
    };
  }

  getApiKey() {
    if (!this.apiKey && process.env.DATA_GOVT_API_KEY) {
      this.apiKey = process.env.DATA_GOVT_API_KEY;
    }
    return this.apiKey;
  }

  /**
   * Fetches latest market records from Data.gov.in API with retry and backoff.
   */
  async fetchLiveMandiRecords(limit = 1000, maxRetries = 2) {
    const key = this.getApiKey();
    if (!key) {
      console.warn('⚠️ DATA_GOVT_API_KEY not configured. External fetch skipped.');
      return { success: false, records: [], message: 'DATA_GOVT_API_KEY is not configured in backend environment.' };
    }

    const params = {
      'api-key': key,
      format: 'json',
      limit,
      'filters[state]': 'Telangana'
    };

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) WarangalAgriMarket/2.0',
      'Accept': 'application/json'
    };

    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`📡 Connecting to Data.gov.in Mandi API (Attempt ${attempt}/${maxRetries})...`);
        const response = await axios.get(BASE_URL, {
          params,
          headers,
          timeout: 25000
        });

        if (response.status === 200 && response.data) {
          const records = response.data.records || [];
          console.log(`✅ Received ${records.length} total records from Data.gov.in (Total in resource: ${response.data.total || records.length})`);
          return { success: true, records, total: response.data.total || records.length };
        }
      } catch (err) {
        lastError = err.message;
        console.warn(`⚠️ Data.gov.in attempt ${attempt} warning: ${err.message}`);
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 2000 * attempt));
        }
      }
    }

    return { success: false, records: [], message: `Data.gov.in request failed: ${lastError}` };
  }

  /**
   * Core synchronization method:
   * 1. Fetches from Data.gov.in
   * 2. Filters for Warangal geography and 7 crops
   * 3. Resolves canonical names and validates price bounds
   * 4. Upserts to MongoDB Atlas with deduplication
   * 5. Invalidates backend cache
   */
  async syncDailyPrices() {
    const startTime = Date.now();
    const fetchResult = await this.fetchLiveMandiRecords(1000);

    if (!fetchResult.success || fetchResult.records.length === 0) {
      this.lastFetchStatus = {
        timestamp: new Date().toISOString(),
        status: 'OFFLINE_RETAINED',
        recordsFetched: 0,
        recordsUpserted: 0,
        latestObservationDate: this.lastFetchStatus.latestObservationDate,
        message: fetchResult.message || 'No new records from external API. Previous observations retained.'
      };
      return this.lastFetchStatus;
    }

    const rawRecords = fetchResult.records;
    const bulkOps = [];
    let latestObsDate = null;
    let rejectedCount = 0;

    for (const r of rawRecords) {
      const dist = String(r.district || '').trim().toLowerCase();
      const mktRaw = String(r.market || '').trim();
      const canonicalMarket = resolveMarket(mktRaw);

      const isWarangalGeo = WARANGAL_DISTRICTS.has(dist) ||
                            mktRaw.toLowerCase().includes('warangal') ||
                            WARANGAL_MARKETS.includes(canonicalMarket);

      if (!isWarangalGeo) continue;

      const cropId = resolveCropId(r.commodity);
      if (!cropId) continue;

      const normDate = normalizeDate(r.arrival_date);
      if (!normDate) {
        rejectedCount++;
        continue;
      }

      const modalPrice = Number(r.modal_price);
      const minPrice = Number(r.min_price) || modalPrice;
      const maxPrice = Number(r.max_price) || modalPrice;

      if (!modalPrice || modalPrice <= 0 || isNaN(modalPrice)) {
        rejectedCount++;
        continue;
      }

      if (!latestObsDate || normDate > latestObsDate) {
        latestObsDate = normDate;
      }

      const variety = r.variety || 'FAQ';
      const grade = r.grade || 'FAQ';

      const priceDoc = {
        observation_date: normDate,
        crop_id: cropId,
        crop_name: CROPS[cropId]?.canonicalName || cropId,
        canonical_market_name: canonicalMarket,
        district: 'Warangal',
        state: 'Telangana',
        variety,
        grade,
        min_price: minPrice,
        max_price: maxPrice,
        modal_price: modalPrice,
        price_unit: '₹/Quintal',
        price_source: 'Data.gov.in / Agmarknet',
        fetched_at: new Date()
      };

      // Compound filter for strict deduplication
      const filter = {
        observation_date: normDate,
        crop_id: cropId,
        canonical_market_name: canonicalMarket,
        variety
      };

      bulkOps.push({
        updateOne: {
          filter,
          update: { $set: priceDoc },
          upsert: true
        }
      });
    }

    let upsertedCount = 0;
    if (getDBStatus() && bulkOps.length > 0) {
      try {
        const res = await Price.bulkWrite(bulkOps, { ordered: false });
        upsertedCount = (res.upsertedCount || 0) + (res.modifiedCount || 0);
        console.log(`✅ Upserted ${upsertedCount} verified records into MongoDB Atlas.`);
      } catch (err) {
        console.warn('MongoDB Atlas bulkWrite notice:', err.message);
      }
    }

    // Invalidate caches across dashboard, prices, and comparison
    cacheService.delPattern('dashboard*');
    cacheService.delPattern('prices*');
    cacheService.delPattern('comparison*');

    const durationSec = Number(((Date.now() - startTime) / 1000).toFixed(2));
    const syncStatus = {
      timestamp: new Date().toISOString(),
      status: 'SUCCESS',
      recordsFetched: rawRecords.length,
      warangalRecordsMatched: bulkOps.length,
      recordsUpserted: upsertedCount,
      rejectedCount,
      latestObservationDate: latestObsDate,
      durationSec,
      message: `Synchronized ${bulkOps.length} Warangal observations. ${upsertedCount} new/updated in database.`
    };

    this.lastFetchStatus = syncStatus;

    // Persist to local audit log
    try {
      let logs = [];
      if (fs.existsSync(LOG_FILE)) {
        logs = JSON.parse(fs.readFileSync(LOG_FILE, 'utf-8'));
      }
      logs.push(syncStatus);
      fs.writeFileSync(LOG_FILE, JSON.stringify(logs.slice(-50), null, 2), 'utf-8');
    } catch (e) {}

    return syncStatus;
  }

  getStatus() {
    return this.lastFetchStatus;
  }
}

module.exports = new DataGovService();

