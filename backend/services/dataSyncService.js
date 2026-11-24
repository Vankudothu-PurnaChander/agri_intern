/**
 * Data Synchronization and Query Service (High-Performance Hybrid Engine).
 * Prioritizes MongoDB Atlas with compound-indexed queries, .lean() projections,
 * multi-level caching (Redis / In-Memory), and transparent fallback to local datasets.
 */
const fs = require('fs');
const path = require('path');
const { CROPS, WARANGAL_MARKETS } = require('../config/crops');
const { getDBStatus } = require('../config/db');
const cacheService = require('./cacheService');
const Price = require('../models/Price');
const Arrival = require('../models/Arrival');
const Trade = require('../models/Trade');

const DATA_DIR = path.resolve(__dirname, '../../datasets/processed');

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function formatHumanDate(isoStr) {
  if (!isoStr || isoStr === 'N/A') return 'N/A';
  try {
    const parts = String(isoStr).split('-');
    if (parts.length !== 3) return isoStr;
    const [y, m, d] = parts;
    return `${parseInt(d, 10)} ${MONTH_NAMES[parseInt(m, 10) - 1] || m} ${y}`;
  } catch (e) {
    return isoStr;
  }
}

class DataSyncService {
  constructor() {
    this.prices = [];
    this.arrivals = [];
    this.trade = [];
    this.isLocalLoaded = false;
  }

  // Fast CSV parser for local fallback
  _parseCSV(filePath) {
    if (!fs.existsSync(filePath)) return [];
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;

      const values = [];
      let inQuotes = false;
      let curr = '';

      for (let c = 0; c < line.length; c++) {
        const char = line[c];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(curr.trim().replace(/^"|"$/g, ''));
          curr = '';
        } else {
          curr += char;
        }
      }
      values.push(curr.trim().replace(/^"|"$/g, ''));

      const row = {};
      headers.forEach((h, idx) => {
        let val = values[idx];
        if (val === undefined || val === '') {
          val = null;
        } else if (!isNaN(val) && val !== null && val.trim() !== '') {
          val = Number(val);
        }
        row[h] = val;
      });
      rows.push(row);
    }
    return rows;
  }

  loadLocalFallbackData() {
    if (this.isLocalLoaded) return;
    try {
      const pricesFile = path.join(DATA_DIR, 'prices', 'cleaned_prices_all.csv');
      const arrivalsFile = path.join(DATA_DIR, 'arrivals', 'cleaned_arrivals_all.csv');
      const tradeFile = path.join(DATA_DIR, 'trade', 'cleaned_trade_all.csv');

      this.prices = this._parseCSV(pricesFile);
      this.arrivals = this._parseCSV(arrivalsFile);
      this.trade = this._parseCSV(tradeFile);
      this.isLocalLoaded = true;
      console.log(`📦 Loaded local fallback: ${this.prices.length} prices, ${this.arrivals.length} arrivals, ${this.trade.length} trade records.`);
    } catch (e) {
      console.warn('Local fallback datasets notice:', e.message);
    }
  }

  ensureLoaded() {
    if (!getDBStatus() && !this.isLocalLoaded) {
      this.loadLocalFallbackData();
    }
  }

  // -------------------------------------------------------------
  // DASHBOARD APIs
  // -------------------------------------------------------------
  async getDashboardSummary() {
    const cacheKey = cacheService.makeKey('dashboard', 'summary');
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached;

    const t0 = Date.now();
    let result = null;

    if (getDBStatus()) {
      try {
        const [priceCount, arrivalCount, mandisAgg, latestRow] = await Promise.all([
          Price.countDocuments().exec(),
          Arrival.countDocuments().exec(),
          Price.distinct('canonical_market_name').exec(),
          Price.findOne().sort({ observation_date: -1 }).select('observation_date').lean().exec()
        ]);

        result = {
          supportedCropsCount: Object.keys(CROPS).length,
          reportingMandisCount: mandisAgg.length,
          reportingMandisList: mandisAgg,
          latestObservationDate: latestRow?.observation_date || 'N/A',
          totalPriceObservations: priceCount,
          totalArrivalObservations: arrivalCount,
          targetDistrict: 'Warangal',
          targetState: 'Telangana',
          storageBackend: 'MongoDB Atlas',
          queryTimeMs: Date.now() - t0
        };
      } catch (err) {
        console.warn('MongoDB summary error, falling back to local:', err.message);
      }
    }

    if (!result) {
      this.loadLocalFallbackData();
      const dates = this.prices.map(p => p.observation_date).filter(Boolean).sort();
      const latestDate = dates.length > 0 ? dates[dates.length - 1] : 'N/A';
      const uniqueMandis = new Set(this.prices.map(p => p.canonical_market_name).filter(Boolean));

      result = {
        supportedCropsCount: Object.keys(CROPS).length,
        reportingMandisCount: uniqueMandis.size,
        reportingMandisList: Array.from(uniqueMandis),
        latestObservationDate: latestDate,
        totalPriceObservations: this.prices.length,
        totalArrivalObservations: this.arrivals.length,
        targetDistrict: 'Warangal',
        targetState: 'Telangana',
        storageBackend: 'Local Fast Memory Engine',
        queryTimeMs: Date.now() - t0
      };
    }

    await cacheService.set(cacheKey, result, 180);
    return result;
  }

  async getCropOverview() {
    const cacheKey = cacheService.makeKey('dashboard', 'crop-overview');
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached;

    const overview = [];

    for (const [cropId, meta] of Object.entries(CROPS)) {
      let recentRows = [];
      let latestRow = null;
      let pastRow = null;

      if (getDBStatus()) {
        try {
          recentRows = await Price.find({ crop_id: cropId })
            .sort({ observation_date: -1 })
            .limit(15)
            .select('observation_date modal_price canonical_market_name variety')
            .lean()
            .exec();

          if (recentRows && recentRows.length > 0) {
            latestRow = recentRows[0];
            const latestDate = new Date(latestRow.observation_date);
            const targetPastDate = new Date(latestDate);
            targetPastDate.setDate(targetPastDate.getDate() - 7);
            const pastDateStr = targetPastDate.toISOString().split('T')[0];

            pastRow = recentRows.find(r => r.observation_date <= pastDateStr) || recentRows[recentRows.length - 1];
          }
        } catch (e) {
          latestRow = null;
        }
      }

      if (!latestRow) {
        this.loadLocalFallbackData();
        const cropPrices = this.prices.filter(p => p.crop_id === cropId);
        if (cropPrices.length > 0) {
          cropPrices.sort((a, b) => b.observation_date.localeCompare(a.observation_date));
          recentRows = cropPrices.slice(0, 15);
          latestRow = recentRows[0];
          const latestDate = new Date(latestRow.observation_date);
          const targetPastDate = new Date(latestDate);
          targetPastDate.setDate(targetPastDate.getDate() - 7);
          const pastDateStr = targetPastDate.toISOString().split('T')[0];
          pastRow = recentRows.find(r => r.observation_date <= pastDateStr) || recentRows[recentRows.length - 1];
        }
      }

      if (!latestRow) {
        overview.push({
          cropId,
          cropName: meta.canonicalName,
          displayNameEn: meta.displayNameEn,
          displayNameTe: meta.displayNameTe,
          imagePath: meta.imagePath,
          latestModalPrice: null,
          priceUnit: meta.priceUnit,
          sevenDayChangePct: null,
          trend: 'STABLE',
          lastUpdatedDate: 'N/A',
          latestObservationDateFormatted: 'N/A',
          trendDateRangeLabel: 'No observation records found',
          sparklinePoints: [],
          status: 'Insufficient price data'
        });
        continue;
      }

      const latestPrice = Number(latestRow.modal_price);
      let pctChange = null;
      let trend = 'STABLE';

      if (pastRow && Number(pastRow.modal_price) > 0) {
        const pastPrice = Number(pastRow.modal_price);
        pctChange = Number((((latestPrice - pastPrice) / pastPrice) * 100).toFixed(2));
        if (pctChange > 0.5) trend = 'UPWARD';
        else if (pctChange < -0.5) trend = 'DOWNWARD';
        else trend = 'STABLE';
      }

      // Build strictly actual observation points for trend sparkline (no artificial/interpolated dates)
      const dateMap = new Map();
      for (const r of [...recentRows].reverse()) {
        if (!dateMap.has(r.observation_date) && Number(r.modal_price) > 0) {
          dateMap.set(r.observation_date, {
            date: r.observation_date,
            price: Number(r.modal_price)
          });
        }
      }
      const sparklinePoints = Array.from(dateMap.values());
      const earliestObsDate = sparklinePoints.length > 0 ? sparklinePoints[0].date : latestRow.observation_date;
      const latestFormatted = formatHumanDate(latestRow.observation_date);

      overview.push({
        cropId,
        cropName: meta.canonicalName,
        displayNameEn: meta.displayNameEn,
        displayNameTe: meta.displayNameTe,
        imagePath: meta.imagePath,
        latestModalPrice: latestPrice,
        priceUnit: meta.priceUnit,
        sevenDayChangePct: pctChange,
        trend,
        lastUpdatedDate: latestRow.observation_date,
        latestObservationDateFormatted: latestFormatted,
        earliestObservationDate: earliestObsDate,
        trendDateRangeLabel: `Historical price trend: Available data up to ${latestFormatted}`,
        sparklinePoints,
        variety: latestRow.variety || 'FAQ',
        marketName: latestRow.canonical_market_name
      });
    }

    await cacheService.set(cacheKey, overview, 180);
    return overview;
  }

  // -------------------------------------------------------------
  // CURRENT PRICES & MARKETS APIs
  // -------------------------------------------------------------
  async getReportingMarkets(cropId = null) {
    const cid = cropId && cropId !== 'all' ? cropId.toLowerCase() : null;
    const cacheKey = cacheService.makeKey('markets', 'prices', cid || 'all');
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached;

    let markets = [];

    if (getDBStatus()) {
      try {
        const matchStage = cid ? { $match: { crop_id: cid } } : { $match: {} };
        const agg = await Price.aggregate([
          matchStage,
          { $group: { _id: "$canonical_market_name", count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ]).exec();

        markets = agg.map(a => ({ marketName: a._id, count: a.count }));
      } catch (err) {
        console.warn('MongoDB market agg error, falling back:', err.message);
      }
    }

    if (markets.length === 0) {
      this.loadLocalFallbackData();
      let list = this.prices;
      if (cid) list = list.filter(p => p.crop_id === cid);
      const marketCounts = {};
      for (const row of list) {
        const m = row.canonical_market_name;
        if (m) marketCounts[m] = (marketCounts[m] || 0) + 1;
      }
      markets = Object.entries(marketCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([marketName, count]) => ({ marketName, count }));
    }

    await cacheService.set(cacheKey, markets, 3600); // 1 hour TTL for market lists
    return markets;
  }

  async getLatestPrices(cropId = null, marketName = null, isTodayOnly = false, page = 1, limit = 50, sortOrder = 'desc') {
    const cid = cropId && cropId !== 'all' ? cropId.toLowerCase() : null;
    const mkt = marketName && marketName !== 'all' ? marketName : null;
    const sortDir = sortOrder === 'asc' ? 1 : -1;
    const cacheKey = cacheService.makeKey('prices', 'latest', cid, mkt, isTodayOnly, page, limit, sortOrder);
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached;

    const nowKolkata = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

    if (getDBStatus()) {
      try {
        const filter = {};
        if (cid) filter.crop_id = cid;
        if (mkt) filter.canonical_market_name = mkt;
        if (isTodayOnly) filter.observation_date = nowKolkata;

        const [total, docs] = await Promise.all([
          Price.countDocuments(filter).exec(),
          Price.find(filter)
            .sort({ observation_date: sortDir, _id: sortDir })
            .skip((page - 1) * limit)
            .limit(limit)
            .select('observation_date crop_id crop_name canonical_market_name district state variety grade min_price modal_price max_price price_unit fetched_at')
            .lean()
            .exec()
        ]);

        const response = {
          data: docs,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            sort: sortOrder
          }
        };
        await cacheService.set(cacheKey, response, 120);
        return response;
      } catch (err) {
        console.warn('MongoDB prices error, falling back:', err.message);
      }
    }

    // Local fallback
    this.loadLocalFallbackData();
    let filtered = [...this.prices];
    if (cid) filtered = filtered.filter(p => p.crop_id === cid);
    if (mkt) filtered = filtered.filter(p => p.canonical_market_name === mkt);
    if (isTodayOnly) filtered = filtered.filter(p => p.observation_date === nowKolkata);

    filtered.sort((a, b) => {
      const cmp = a.observation_date.localeCompare(b.observation_date);
      return sortDir === 1 ? cmp : -cmp;
    });
    const total = filtered.length;
    const paginated = filtered.slice((page - 1) * limit, page * limit);

    const response = {
      data: paginated,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        sort: sortOrder
      }
    };
    await cacheService.set(cacheKey, response, 120);
    return response;
  }

  async getPriceHistory(cropId, marketName = null, days = 30) {
    const cid = cropId.toLowerCase();
    const mkt = marketName && marketName !== 'all' ? marketName : null;
    const cacheKey = cacheService.makeKey('prices', 'history', cid, mkt, days);
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached;

    let aggregated = [];

    if (getDBStatus()) {
      try {
        const filter = { crop_id: cid };
        if (mkt) filter.canonical_market_name = mkt;

        const docs = await Price.find(filter)
          .sort({ observation_date: -1 })
          .limit(days * 4) // Fetch enough rows for aggregation across varieties
          .select('observation_date crop_id canonical_market_name min_price modal_price max_price')
          .lean()
          .exec();

        const dateMap = new Map();
        for (const r of docs) {
          const d = r.observation_date;
          if (!dateMap.has(d)) {
            dateMap.set(d, {
              observation_date: d,
              crop_id: r.crop_id,
              market_name: r.canonical_market_name,
              modal_prices: [],
              min_prices: [],
              max_prices: []
            });
          }
          const entry = dateMap.get(d);
          if (r.modal_price) entry.modal_prices.push(Number(r.modal_price));
          if (r.min_price) entry.min_prices.push(Number(r.min_price));
          if (r.max_price) entry.max_prices.push(Number(r.max_price));
        }

        aggregated = Array.from(dateMap.values()).map(e => {
          const sortedModal = e.modal_prices.sort((a, b) => a - b);
          const medianModal = sortedModal.length > 0 ? sortedModal[Math.floor(sortedModal.length / 2)] : null;
          return {
            observation_date: e.observation_date,
            crop_id: e.crop_id,
            market_name: e.market_name,
            modal_price: medianModal,
            min_price: e.min_prices.length > 0 ? Math.min(...e.min_prices) : null,
            max_price: e.max_prices.length > 0 ? Math.max(...e.max_prices) : null,
            price_unit: '₹/Quintal'
          };
        });
      } catch (err) {
        console.warn('MongoDB price history error, falling back:', err.message);
      }
    }

    if (aggregated.length === 0) {
      this.loadLocalFallbackData();
      let filtered = this.prices.filter(p => p.crop_id === cid);
      if (mkt) filtered = filtered.filter(p => p.canonical_market_name === mkt);

      const dateMap = new Map();
      for (const r of filtered) {
        const d = r.observation_date;
        if (!dateMap.has(d)) {
          dateMap.set(d, {
            observation_date: d,
            crop_id: r.crop_id,
            market_name: r.canonical_market_name,
            modal_prices: [],
            min_prices: [],
            max_prices: []
          });
        }
        const entry = dateMap.get(d);
        if (r.modal_price) entry.modal_prices.push(Number(r.modal_price));
        if (r.min_price) entry.min_prices.push(Number(r.min_price));
        if (r.max_price) entry.max_prices.push(Number(r.max_price));
      }

      aggregated = Array.from(dateMap.values()).map(e => {
        const sortedModal = e.modal_prices.sort((a, b) => a - b);
        const medianModal = sortedModal.length > 0 ? sortedModal[Math.floor(sortedModal.length / 2)] : null;
        return {
          observation_date: e.observation_date,
          crop_id: e.crop_id,
          market_name: e.market_name,
          modal_price: medianModal,
          min_price: e.min_prices.length > 0 ? Math.min(...e.min_prices) : null,
          max_price: e.max_prices.length > 0 ? Math.max(...e.max_prices) : null,
          price_unit: '₹/Quintal'
        };
      });
    }

    // Chronological order (oldest to newest) for chart plotting
    aggregated.sort((a, b) => a.observation_date.localeCompare(b.observation_date));
    const result = aggregated.slice(-days);
    await cacheService.set(cacheKey, result, 300);
    return result;
  }

  // -------------------------------------------------------------
  // ARRIVALS APIs
  // -------------------------------------------------------------
  async getReportingArrivalMarkets(cropId = null) {
    const cid = cropId && cropId !== 'all' ? cropId.toLowerCase() : null;
    const cacheKey = cacheService.makeKey('markets', 'arrivals', cid || 'all');
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached;

    let markets = [];

    if (getDBStatus()) {
      try {
        const matchStage = cid ? { $match: { crop_id: cid } } : { $match: {} };
        const agg = await Arrival.aggregate([
          matchStage,
          { $group: { _id: "$canonical_market_name", count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ]).exec();

        markets = agg.map(a => ({ marketName: a._id, count: a.count }));
      } catch (err) {
        console.warn('MongoDB arrival market agg error:', err.message);
      }
    }

    if (markets.length === 0) {
      this.loadLocalFallbackData();
      let list = this.arrivals;
      if (cid) list = list.filter(a => a.crop_id === cid);
      const marketCounts = {};
      for (const row of list) {
        const m = row.canonical_market_name;
        if (m) marketCounts[m] = (marketCounts[m] || 0) + 1;
      }
      markets = Object.entries(marketCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([marketName, count]) => ({ marketName, count }));
    }

    await cacheService.set(cacheKey, markets, 3600);
    return markets;
  }

  async getLatestArrivals(cropId = null, marketName = null) {
    const cid = cropId && cropId !== 'all' ? cropId.toLowerCase() : null;
    const mkt = marketName && marketName !== 'all' ? marketName : null;
    const cacheKey = cacheService.makeKey('arrivals', 'latest', cid, mkt);
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached;

    if (getDBStatus()) {
      try {
        const filter = {};
        if (cid) filter.crop_id = cid;
        if (mkt) filter.canonical_market_name = mkt;

        const docs = await Arrival.find(filter)
          .sort({ observation_date: -1 })
          .limit(30)
          .lean()
          .exec();

        if (docs && docs.length > 0) {
          const latestRow = docs[0];
          const last7 = docs.slice(0, 7).map(a => Number(a.arrival_quantity)).filter(v => !isNaN(v) && v > 0);
          const last30 = docs.map(a => Number(a.arrival_quantity)).filter(v => !isNaN(v) && v > 0);

          const avg7 = last7.length > 0 ? Number((last7.reduce((s, v) => s + v, 0) / last7.length).toFixed(2)) : null;
          const avg30 = last30.length > 0 ? Number((last30.reduce((s, v) => s + v, 0) / last30.length).toFixed(2)) : null;

          const res = {
            latestQuantity: latestRow.arrival_quantity,
            unit: latestRow.arrival_unit || 'Tonnes',
            avg7Days: avg7,
            avg30Days: avg30,
            observationDate: latestRow.observation_date,
            marketName: latestRow.canonical_market_name,
            cropName: latestRow.crop_name
          };
          await cacheService.set(cacheKey, res, 180);
          return res;
        }
      } catch (err) {}
    }

    // Local fallback
    this.loadLocalFallbackData();
    let filtered = [...this.arrivals];
    if (cid) filtered = filtered.filter(a => a.crop_id === cid);
    if (mkt) filtered = filtered.filter(a => a.canonical_market_name === mkt);

    if (filtered.length === 0) {
      return {
        latestQuantity: null,
        unit: 'Tonnes',
        avg7Days: null,
        avg30Days: null,
        observationDate: 'N/A'
      };
    }

    filtered.sort((a, b) => a.observation_date.localeCompare(b.observation_date));
    const latestRow = filtered[filtered.length - 1];
    const last7 = filtered.slice(-7).map(a => Number(a.arrival_quantity)).filter(v => !isNaN(v) && v > 0);
    const last30 = filtered.slice(-30).map(a => Number(a.arrival_quantity)).filter(v => !isNaN(v) && v > 0);

    const avg7 = last7.length > 0 ? Number((last7.reduce((s, v) => s + v, 0) / last7.length).toFixed(2)) : null;
    const avg30 = last30.length > 0 ? Number((last30.reduce((s, v) => s + v, 0) / last30.length).toFixed(2)) : null;

    const res = {
      latestQuantity: latestRow.arrival_quantity,
      unit: latestRow.arrival_unit || 'Tonnes',
      avg7Days: avg7,
      avg30Days: avg30,
      observationDate: latestRow.observation_date,
      marketName: latestRow.canonical_market_name,
      cropName: latestRow.crop_name
    };
    await cacheService.set(cacheKey, res, 180);
    return res;
  }

  async getArrivalHistory(cropId, marketName = null, days = 60, page = 1, limit = 50) {
    const cid = cropId.toLowerCase();
    const mkt = marketName && marketName !== 'all' ? marketName : null;
    const cacheKey = cacheService.makeKey('arrivals', 'history', cid, mkt, days, page, limit);
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached;

    if (getDBStatus()) {
      try {
        const filter = { crop_id: cid };
        if (mkt) filter.canonical_market_name = mkt;

        const [total, docs] = await Promise.all([
          Arrival.countDocuments(filter).exec(),
          Arrival.find(filter)
            .sort({ observation_date: -1 })
            .limit(days)
            .select('observation_date crop_id crop_name canonical_market_name arrival_quantity arrival_unit arrival_status')
            .lean()
            .exec()
        ]);

        const mapped = docs.map(r => ({
          observation_date: r.observation_date,
          crop_id: r.crop_id,
          crop_name: r.crop_name,
          market_name: r.canonical_market_name,
          arrival_quantity: r.arrival_quantity,
          arrival_unit: r.arrival_unit || 'Tonnes',
          status: r.arrival_status
        }));

        const response = {
          data: mapped,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total
          }
        };
        await cacheService.set(cacheKey, response, 180);
        return response;
      } catch (err) {
        console.warn('MongoDB arrival history error:', err.message);
      }
    }

    // Local fallback
    this.loadLocalFallbackData();
    let filtered = this.arrivals.filter(a => a.crop_id === cid);
    if (mkt) filtered = filtered.filter(a => a.canonical_market_name === mkt);

    filtered.sort((a, b) => b.observation_date.localeCompare(a.observation_date));
    const recent = filtered.slice(0, days);

    const mapped = recent.map(r => ({
      observation_date: r.observation_date,
      crop_id: r.crop_id,
      crop_name: r.crop_name,
      market_name: r.canonical_market_name,
      arrival_quantity: r.arrival_quantity,
      arrival_unit: r.arrival_unit || 'Tonnes',
      status: r.arrival_status
    }));

    const response = {
      data: mapped,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: filtered.length
      }
    };
    await cacheService.set(cacheKey, response, 180);
    return response;
  }

  // -------------------------------------------------------------
  // MANDI COMPARISON API (Uses Each Mandi's Latest Available Observation)
  // -------------------------------------------------------------
  async getMandiComparison(cropId) {
    const cid = cropId.toLowerCase();
    const cacheKey = cacheService.makeKey('comparison', cid);
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached;

    let mandiList = [];

    if (getDBStatus()) {
      try {
        // Aggregate: for each distinct canonical_market_name, select its latest available observation
        const pipeline = [
          { $match: { crop_id: cid, modal_price: { $gt: 0 } } },
          // Sort newest observations first; if multiple records on same date, prefer latest record ID
          { $sort: { canonical_market_name: 1, observation_date: -1, _id: -1 } },
          {
            $group: {
              _id: "$canonical_market_name",
              latestDate: { $first: "$observation_date" },
              modalPrice: { $first: "$modal_price" },
              minPrice: { $first: "$min_price" },
              maxPrice: { $first: "$max_price" },
              variety: { $first: "$variety" },
              grade: { $first: "$grade" }
            }
          },
          {
            $project: {
              _id: 0,
              marketName: "$_id",
              observationDate: "$latestDate",
              modalPrice: "$modalPrice",
              minPrice: "$minPrice",
              maxPrice: "$maxPrice",
              variety: "$variety",
              grade: "$grade",
              priceUnit: "₹/Quintal"
            }
          },
          // Sort strictly from highest modal price to lowest among latest observations
          { $sort: { modalPrice: -1 } }
        ];

        mandiList = await Price.aggregate(pipeline).exec();
      } catch (err) {
        console.warn('MongoDB comparison error, falling back:', err.message);
      }
    }

    if (mandiList.length === 0) {
      this.loadLocalFallbackData();
      const cropPrices = this.prices.filter(p => p.crop_id === cid && Number(p.modal_price) > 0);
      if (cropPrices.length === 0) {
        return {
          cropId: cid,
          cropName: CROPS[cid]?.canonicalName || cid,
          highestModalPrice: null,
          highestMandis: [],
          highestMandiDate: 'N/A',
          totalMandisCount: 0,
          mandis: []
        };
      }

      // Group each market by its own latest observation date
      const mandiLatestMap = new Map();
      for (const r of cropPrices) {
        const mkt = r.canonical_market_name;
        const existing = mandiLatestMap.get(mkt);
        if (!existing || r.observation_date > existing.observation_date) {
          mandiLatestMap.set(mkt, r);
        }
      }

      mandiList = Array.from(mandiLatestMap.values()).map(r => ({
        marketName: r.canonical_market_name,
        observationDate: r.observation_date,
        modalPrice: Number(r.modal_price),
        minPrice: Number(r.min_price || r.modal_price),
        maxPrice: Number(r.max_price || r.modal_price),
        variety: r.variety || 'FAQ',
        grade: r.grade || 'FAQ',
        priceUnit: '₹/Quintal'
      })).sort((a, b) => b.modalPrice - a.modalPrice);
    }

    const highestPrice = mandiList.length > 0 ? mandiList[0].modalPrice : null;
    const highestMandis = mandiList.filter(m => m.modalPrice === highestPrice).map(m => m.marketName);
    const highestDate = mandiList.length > 0 ? mandiList[0].observationDate : 'N/A';

    const enhancedMandis = mandiList.map(m => ({
      ...m,
      observationDateFormatted: formatHumanDate(m.observationDate)
    }));

    const result = {
      cropId: cid,
      cropName: CROPS[cid]?.canonicalName || cid,
      comparisonDate: highestDate,
      highestModalPrice: highestPrice,
      highestMandis: highestMandis,
      highestMandiDate: highestDate,
      highestMandiDateFormatted: formatHumanDate(highestDate),
      totalMandisCount: enhancedMandis.length,
      mandis: enhancedMandis
    };

    await cacheService.set(cacheKey, result, 300);
    return result;
  }
}

module.exports = new DataSyncService();
