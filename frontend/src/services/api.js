import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// High-speed client cache & in-flight request deduplicator
const clientCache = new Map();
const inFlightRequests = new Map();
const DEFAULT_TTL_MS = 60 * 1000; // 60 seconds stale-time

const makeCacheKey = (url, params = {}) => {
  const sortedParams = Object.keys(params)
    .sort()
    .map(k => `${k}=${params[k]}`)
    .join('&');
  return `${url}?${sortedParams}`;
};

const cachedGet = async (url, params = {}, ttlMs = DEFAULT_TTL_MS, forceRefresh = false) => {
  const cacheKey = makeCacheKey(url, params);

  // Return cached result if valid and not force refresh
  if (!forceRefresh && clientCache.has(cacheKey)) {
    const entry = clientCache.get(cacheKey);
    if (Date.now() < entry.expiry) {
      return entry.data;
    }
    clientCache.delete(cacheKey);
  }

  // Deduplicate in-flight requests (prevent duplicate parallel network calls)
  if (inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey);
  }

  const requestPromise = (async () => {
    try {
      const res = await api.get(url, { params });
      const payload = res.data;
      if (payload?.success) {
        clientCache.set(cacheKey, {
          data: payload,
          expiry: Date.now() + ttlMs
        });
      }
      return payload;
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  })();

  inFlightRequests.set(cacheKey, requestPromise);
  return requestPromise;
};

export const clearApiCache = () => {
  clientCache.clear();
  inFlightRequests.clear();
};

// -------------------------------------------------------------
// DASHBOARD APIs
// -------------------------------------------------------------
export const fetchDashboardSummary = async (force = false) => {
  const res = await cachedGet('/dashboard/summary', {}, 120000, force);
  return res?.data;
};

export const fetchCropOverview = async (force = false) => {
  const res = await cachedGet('/dashboard/crop-overview', {}, 120000, force);
  return res?.data || [];
};

// -------------------------------------------------------------
// CURRENT PRICES APIs
// -------------------------------------------------------------
export const fetchReportingMarkets = async (cropId = null, force = false) => {
  const params = {};
  if (cropId && cropId !== 'all') params.cropId = cropId;
  const res = await cachedGet('/prices/markets', params, 600000, force);
  return res?.data || [];
};

export const fetchLatestPrices = async (cropId = null, market = null, page = 1, limit = 50, sort = 'desc', force = false) => {
  const params = { page, limit, sort };
  if (cropId && cropId !== 'all') params.cropId = cropId;
  if (market && market !== 'all') params.market = market;
  const res = await cachedGet('/prices/latest', params, 60000, force);
  return {
    data: res?.data || [],
    pagination: res?.pagination || { page, limit, total: res?.data?.length || 0, sort },
    message: res?.message
  };
};

export const fetchTodayPrices = async (cropId = null, market = null, force = false) => {
  const params = {};
  if (cropId && cropId !== 'all') params.cropId = cropId;
  if (market && market !== 'all') params.market = market;
  const res = await cachedGet('/prices/today', params, 30000, force);
  return {
    data: res?.data || [],
    pagination: res?.pagination,
    message: res?.message
  };
};

export const fetchPriceHistory = async (cropId, market = null, days = 30, force = false) => {
  const params = { cropId, days };
  if (market && market !== 'all') params.market = market;
  const res = await cachedGet('/prices/history', params, 120000, force);
  return res?.data || [];
};

// -------------------------------------------------------------
// MARKET ARRIVALS APIs
// -------------------------------------------------------------
export const fetchReportingArrivalMarkets = async (cropId = null, force = false) => {
  const params = {};
  if (cropId && cropId !== 'all') params.cropId = cropId;
  const res = await cachedGet('/arrivals/markets', params, 600000, force);
  return res?.data || [];
};

export const fetchLatestArrivals = async (cropId = null, market = null, force = false) => {
  const params = {};
  if (cropId && cropId !== 'all') params.cropId = cropId;
  if (market && market !== 'all') params.market = market;
  const res = await cachedGet('/arrivals/latest', params, 60000, force);
  return res?.data;
};

export const fetchArrivalHistory = async (cropId, market = null, days = 60, page = 1, limit = 50, force = false) => {
  const params = { cropId, days, page, limit };
  if (market && market !== 'all') params.market = market;
  const res = await cachedGet('/arrivals/history', params, 60000, force);
  return {
    data: res?.data || [],
    pagination: res?.pagination || { page, limit, total: res?.data?.length || 0 }
  };
};

// -------------------------------------------------------------
// MANDI COMPARISON APIs
// -------------------------------------------------------------
export const fetchMandiComparison = async (cropId, force = false) => {
  const res = await cachedGet(`/mandi-comparison/${cropId}`, {}, 120000, force);
  return res?.data;
};

// -------------------------------------------------------------
// STATISTICAL PRICE-ARRIVAL ANALYSIS APIs
// -------------------------------------------------------------
export const fetchPriceArrivalAnalysis = async (cropId, market = null, force = false) => {
  const params = {};
  if (market && market !== 'all') params.market = market;
  const res = await cachedGet(`/analysis/price-arrival/${cropId}`, params, 300000, force);
  return res?.data;
};

// -------------------------------------------------------------
// MACHINE LEARNING FORECASTING APIs
// -------------------------------------------------------------
export const fetchForecast = async (cropId, market = null, horizon = 15, force = false) => {
  const params = { horizon };
  if (market && market !== 'all') params.market = market;
  const res = await cachedGet(`/forecast/${cropId}`, params, 300000, force);
  return res?.data;
};

export const fetchForecastSupport = async (force = false) => {
  const res = await cachedGet('/forecast/support', {}, 300000, force);
  return res?.data;
};

export const fetchMultiHorizonForecast = async (cropId, market = null, force = false) => {
  const params = {};
  if (market && market !== 'all') params.market = market;
  const res = await cachedGet(`/forecast/${cropId}/horizons`, params, 300000, force);
  return res?.data;
};

export const fetchModelEvaluation = async (cropId, force = false) => {
  const res = await cachedGet(`/forecast/${cropId}/evaluation`, {}, 600000, force);
  return res?.data;
};

// -------------------------------------------------------------
// SYSTEM STATUS & RETRAINING APIs
// -------------------------------------------------------------
export const triggerDailySync = async () => {
  clearApiCache();
  const res = await api.post('/data/collect');
  return res.data;
};

export const fetchDataSyncStatus = async () => {
  const res = await api.get('/data/collection/status');
  return res.data;
};

export const fetchSystemHealth = async () => {
  const res = await api.get('/health');
  return res.data;
};

export default api;
