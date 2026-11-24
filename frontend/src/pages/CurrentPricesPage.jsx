import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { 
  fetchReportingMarkets, 
  fetchLatestPrices, 
  fetchTodayPrices, 
  fetchPriceHistory 
} from '../services/api';
import { DataStateView } from '../components/DataStateView';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend, 
  CartesianGrid 
} from 'recharts';
import { 
  Store, 
  TrendingUp, 
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';

export const CurrentPricesPage = () => {
  const { t, language } = useLanguage();

  const [selectedCrop, setSelectedCrop] = useState('cotton');
  const [selectedMarket, setSelectedMarket] = useState('Warangal APMC');
  const [availableMarkets, setAvailableMarkets] = useState([]);
  const [viewMode, setViewMode] = useState('latest'); // 'latest' or 'today'
  const [sortOrder, setSortOrder] = useState('desc'); // 'desc' (newest first) or 'asc' (oldest first)
  const [pricesList, setPricesList] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0 });
  const [todayNotice, setTodayNotice] = useState(null);
  const [priceHistory, setPriceHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const crops = [
    { id: 'cotton', nameEn: 'Cotton', nameTe: 'పత్తి' },
    { id: 'dry_chillies', nameEn: 'Dry Chillies', nameTe: 'ఎండు మిర్చి' },
    { id: 'maize', nameEn: 'Maize', nameTe: 'మొక్కజొన్న' },
    { id: 'turmeric', nameEn: 'Turmeric', nameTe: 'పసుపు' },
    { id: 'groundnut', nameEn: 'Groundnut', nameTe: 'వేరుశనగ' },
    { id: 'paddy', nameEn: 'Paddy', nameTe: 'వరి (వడ్లు)' },
    { id: 'red_gram', nameEn: 'Red Gram', nameTe: 'కందులు' }
  ];

  // Load available reporting markets dynamically when crop changes
  useEffect(() => {
    let isMounted = true;
    const loadMarkets = async () => {
      try {
        const mkts = await fetchReportingMarkets(selectedCrop);
        if (isMounted) {
          const mktNames = mkts.map(m => m.marketName);
          setAvailableMarkets(mktNames);
          if (mktNames.length > 0 && !mktNames.includes(selectedMarket)) {
            setSelectedMarket(mktNames[0]);
          }
        }
      } catch (err) {
        console.error('Error fetching reporting markets:', err);
      }
    };
    loadMarkets();
    return () => { isMounted = false; };
  }, [selectedCrop]);

  // Load prices and chart history for specific crop & specific market
  const loadData = async (page = 1, force = false, currentSort = sortOrder) => {
    if (!selectedMarket) return;
    setLoading(true);
    setError(null);
    setTodayNotice(null);

    try {
      if (viewMode === 'today') {
        const res = await fetchTodayPrices(selectedCrop, selectedMarket, force);
        setPricesList(res.data);
        setPagination({ page: 1, limit: 50, total: res.data.length, sort: currentSort });
        if (res.data.length === 0) {
          setTodayNotice(t('prices.todayNotice'));
        }
      } else {
        const res = await fetchLatestPrices(selectedCrop, selectedMarket, page, 50, currentSort, force);
        setPricesList(res.data);
        setPagination(res.pagination || { page, limit: 50, total: res.data.length, sort: currentSort });
      }

      // Load 30-day historical chart data for this specific market
      const hist = await fetchPriceHistory(selectedCrop, selectedMarket, 30, force);
      setPriceHistory(hist);
    } catch (err) {
      console.error('Prices fetch error:', err);
      setError(err.message || 'Unable to load market price data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPagination(p => ({ ...p, page: 1 }));
    loadData(1, false, sortOrder);
  }, [selectedCrop, selectedMarket, viewMode, sortOrder]);

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > Math.ceil(pagination.total / pagination.limit)) return;
    setPagination(p => ({ ...p, page: newPage }));
    loadData(newPage, false, sortOrder);
  };

  const toggleSortOrder = () => {
    setSortOrder(prev => (prev === 'desc' ? 'asc' : 'desc'));
  };

  const selectedCropObj = crops.find(c => c.id === selectedCrop);
  const cropDisplayName = language === 'te' ? selectedCropObj?.nameTe : selectedCropObj?.nameEn;
  const totalPages = Math.ceil(pagination.total / pagination.limit) || 1;

  // Format currency helper
  const formatPrice = (val) => {
    if (val === null || val === undefined || isNaN(val) || val === '') return 'N/A';
    return `₹${Number(val).toLocaleString('en-IN')}`;
  };

  return (
    <div className="space-y-6 text-left">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            {t('prices.title')}
          </h2>
          <p className="text-xs text-slate-500">
            {t('prices.subtitle')}
          </p>
        </div>

        {/* View Mode Toggle */}
        <div className="inline-flex p-1 bg-slate-200/70 rounded-xl self-start sm:self-auto">
          <button
            onClick={() => setViewMode('latest')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
              viewMode === 'latest'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t('prices.latestReported')}
          </button>
          <button
            onClick={() => setViewMode('today')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
              viewMode === 'today'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t('prices.todayOnly')}
          </button>
        </div>
      </div>

      {/* Crop & Explicit Market Selection Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        {/* Crop Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider mr-1">
            {t('common.selectCrop')}:
          </span>
          {crops.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCrop(c.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                selectedCrop === c.id
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {language === 'te' ? c.nameTe : c.nameEn}
            </button>
          ))}
        </div>

        {/* Explicit Market Dropdown */}
        <div className="flex items-center space-x-2">
          <Store className="w-4 h-4 text-emerald-600" />
          <span className="text-xs font-bold text-slate-700 whitespace-nowrap">
            {t('common.selectMarket')}:
          </span>
          <select
            value={selectedMarket}
            onChange={(e) => setSelectedMarket(e.target.value)}
            className="text-xs font-bold border border-slate-300 rounded-lg px-3 py-1.5 bg-white text-slate-800 focus:outline-emerald-600"
          >
            {availableMarkets.length > 0 ? (
              availableMarkets.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))
            ) : (
              <option value="">No reporting markets</option>
            )}
          </select>
        </div>
      </div>

      {/* Today Notice Banner */}
      {viewMode === 'today' && todayNotice && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start space-x-3 text-amber-900 text-xs">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">{t('prices.todayNotice')}</span>
            <p className="text-amber-800 mt-0.5">
              {t('prices.todayExpl')}
            </p>
          </div>
        </div>
      )}

      {/* 30-Day Historical Price Graph for Selected Market */}
      {viewMode === 'latest' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {t('prices.chartTitle')} — {selectedMarket}
              </h3>
              <p className="text-xs text-slate-500">
                {t('prices.chartSub')}
              </p>
            </div>
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md self-start sm:self-auto">
              ₹/Quintal
            </span>
          </div>

          <DataStateView
            loading={loading}
            error={error}
            isEmpty={priceHistory.length === 0}
            emptyMessage={`No 30-day historical price points available for ${selectedMarket}.`}
            onRetry={() => loadData(pagination.page, true)}
            skeletonRows={5}
          >
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={priceHistory} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="observation_date" 
                    tick={{ fontSize: 11, fill: '#64748b' }} 
                    tickFormatter={(val) => val.slice(5)} 
                  />
                  <YAxis 
                    tick={{ fontSize: 11, fill: '#64748b' }} 
                    domain={['dataMin - 150', 'dataMax + 150']} 
                  />
                  <Tooltip 
                    formatter={(val, name, item) => {
                      const key = item?.dataKey || name;
                      let label = name || 'Price';
                      if (key === 'modal_price' || name === 'Modal Price') label = 'Modal Price';
                      else if (key === 'min_price' || name === 'Min Price') label = 'Min Price';
                      else if (key === 'max_price' || name === 'Max Price') label = 'Max Price';
                      return [val ? `₹${Number(val).toLocaleString('en-IN')}/Qtl` : 'N/A', label];
                    }} 
                    labelFormatter={(lbl) => `Date: ${lbl}`}
                  />
                  <Legend verticalAlign="top" height={36} />
                  <Line 
                    type="monotone" 
                    dataKey="max_price" 
                    stroke="#f59e0b" 
                    name="Max Price" 
                    strokeWidth={1.5} 
                    dot={false} 
                    connectNulls={false} 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="modal_price" 
                    stroke="#059669" 
                    name="Modal Price" 
                    strokeWidth={2.5} 
                    dot={{ r: 3, fill: '#059669' }} 
                    connectNulls={false} 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="min_price" 
                    stroke="#3b82f6" 
                    name="Min Price" 
                    strokeWidth={1.5} 
                    dot={false} 
                    connectNulls={false} 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </DataStateView>
        </div>
      )}

      {/* Tabular Price Breakdown with Server-Side Pagination & Sort Order Toggle */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {t('prices.tableTitle')} — {selectedMarket} ({cropDisplayName})
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Showing page {pagination.page} of {totalPages} ({pagination.total} records total) • Ordered: {sortOrder === 'desc' ? 'Newest to Oldest' : 'Oldest to Newest'}
            </p>
          </div>

          <div className="flex items-center space-x-2 self-start sm:self-auto">
            {/* Sort Order Toggle Button */}
            <button
              type="button"
              onClick={toggleSortOrder}
              title={`Switch to ${sortOrder === 'desc' ? 'Oldest First' : 'Newest First'}`}
              className="inline-flex items-center space-x-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
              <span>{sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}</span>
            </button>

            {/* Refresh Button */}
            <button
              onClick={() => loadData(pagination.page, true)}
              title="Refresh from server"
              className="p-1.5 text-slate-500 hover:text-emerald-700 rounded-xl hover:bg-slate-100 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        <DataStateView
          loading={loading}
          error={error}
          isEmpty={pricesList.length === 0}
          emptyMessage={viewMode === 'today' ? "No price reported today." : `No price observations recorded for ${cropDisplayName} at ${selectedMarket}.`}
          onRetry={() => loadData(pagination.page, true)}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th 
                    className="py-3 px-4 cursor-pointer select-none hover:bg-slate-100 transition-colors"
                    onClick={toggleSortOrder}
                    title="Click to toggle Newest/Oldest order"
                  >
                    <div className="flex items-center space-x-1">
                      <span>{t('common.date')}</span>
                      {sortOrder === 'desc' ? (
                        <ArrowDown className="w-3.5 h-3.5 text-emerald-600 inline" />
                      ) : (
                        <ArrowUp className="w-3.5 h-3.5 text-blue-600 inline" />
                      )}
                    </div>
                  </th>
                  <th className="py-3 px-4">{t('common.market')}</th>
                  <th className="py-3 px-4">Crop</th>
                  <th className="py-3 px-4">{t('common.variety')}</th>
                  <th className="py-3 px-4 text-right text-blue-700">{t('common.minPrice')}</th>
                  <th className="py-3 px-4 text-right text-emerald-800 font-extrabold">{t('common.modalPrice')}</th>
                  <th className="py-3 px-4 text-right text-amber-700">{t('common.maxPrice')}</th>
                  <th className="py-3 px-4 text-center">{t('common.grade')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {pricesList.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 text-slate-700 whitespace-nowrap font-semibold">
                      {row.observation_date}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {row.canonical_market_name || row.original_market_name}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800">
                      {cropDisplayName}
                    </td>
                    <td className="py-3 px-4 text-slate-600">{row.variety || 'FAQ'}</td>
                    <td className="py-3 px-4 text-right font-semibold text-blue-700">
                      {formatPrice(row.min_price)}
                    </td>
                    <td className="py-3 px-4 text-right font-black text-emerald-800 text-sm">
                      {formatPrice(row.modal_price)}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-amber-700">
                      {formatPrice(row.max_price)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-medium">
                        {row.grade || 'FAQ'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500">
                Page {pagination.page} of {totalPages} ({pagination.total} records)
              </span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors flex items-center space-x-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= totalPages}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors flex items-center space-x-1"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </DataStateView>
      </div>
    </div>
  );
};
