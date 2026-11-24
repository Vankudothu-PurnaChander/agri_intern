import React, { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { 
  fetchReportingArrivalMarkets, 
  fetchArrivalHistory,
  fetchPriceArrivalAnalysis 
} from '../services/api';
import { DataStateView } from '../components/DataStateView';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid,
  LabelList
} from 'recharts';
import { 
  Truck, 
  Store, 
  Calendar, 
  Info,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Activity,
  Layers,
  ChevronDown,
  ChevronUp,
  Scale
} from 'lucide-react';

export const MarketArrivalsPage = () => {
  const { t, language } = useLanguage();

  const [selectedCrop, setSelectedCrop] = useState('maize');
  const [selectedMarket, setSelectedMarket] = useState('Warangal APMC');
  const [availableMarkets, setAvailableMarkets] = useState([]);
  const [arrivalHistory, setArrivalHistory] = useState([]);
  const [analysisData, setAnalysisData] = useState(null);
  const [showLagDetails, setShowLagDetails] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0 });
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

  // Fetch reporting arrival markets dynamically when crop changes
  useEffect(() => {
    let isMounted = true;
    const loadMarkets = async () => {
      try {
        const mkts = await fetchReportingArrivalMarkets(selectedCrop);
        if (isMounted) {
          const mktNames = mkts.map(m => m.marketName);
          setAvailableMarkets(mktNames);
          if (mktNames.length > 0 && !mktNames.includes(selectedMarket)) {
            setSelectedMarket(mktNames[0]);
          }
        }
      } catch (err) {
        console.error('Arrivals markets fetch error:', err);
      }
    };
    loadMarkets();
    return () => { isMounted = false; };
  }, [selectedCrop]);

  // Load arrival history and statistical price-arrival correlation in parallel
  const loadArrivals = async (page = 1, force = false) => {
    if (!selectedMarket) return;
    setLoading(true);
    setError(null);
    try {
      const [res, analysis] = await Promise.all([
        fetchArrivalHistory(selectedCrop, selectedMarket, 60, page, 50, force),
        fetchPriceArrivalAnalysis(selectedCrop, selectedMarket, force).catch(() => null)
      ]);
      setArrivalHistory(res.data);
      setPagination(res.pagination || { page, limit: 50, total: res.data.length });
      setAnalysisData(analysis);
    } catch (err) {
      console.error('Arrival history fetch error:', err);
      setError(err.message || 'Unable to retrieve arrivals data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPagination(p => ({ ...p, page: 1 }));
    loadArrivals(1);
  }, [selectedCrop, selectedMarket]);

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > Math.ceil(pagination.total / pagination.limit)) return;
    setPagination(p => ({ ...p, page: newPage }));
    loadArrivals(newPage);
  };

  const selectedCropObj = crops.find(c => c.id === selectedCrop);
  const cropDisplayName = language === 'te' ? selectedCropObj?.nameTe : selectedCropObj?.nameEn;
  const totalPages = Math.ceil(pagination.total / pagination.limit) || 1;

  // Table data: newest records first
  const tableData = useMemo(() => {
    return [...arrivalHistory].sort((a, b) => b.observation_date.localeCompare(a.observation_date));
  }, [arrivalHistory]);

  const latestRecord = tableData.length > 0 ? tableData[0] : null;

  // Summary Metrics: strictly without treating missing observations as zero
  const validArrivals = useMemo(() => {
    return arrivalHistory.filter(r => r.arrival_quantity !== null && r.arrival_quantity !== undefined && !isNaN(r.arrival_quantity));
  }, [arrivalHistory]);

  const totalPeriodArrivals = useMemo(() => {
    return validArrivals.reduce((sum, r) => sum + Number(r.arrival_quantity), 0);
  }, [validArrivals]);

  const avgDailyArrival = useMemo(() => {
    return validArrivals.length > 0 ? (totalPeriodArrivals / validArrivals.length) : 0;
  }, [validArrivals, totalPeriodArrivals]);

  // Daily calendar continuous series: strictly latest 15 calendar days of available arrival data
  const calendarChartData = useMemo(() => {
    if (arrivalHistory.length === 0) return [];
    const sorted = [...arrivalHistory].sort((a, b) => a.observation_date.localeCompare(b.observation_date));
    const endStr = sorted[sorted.length - 1].observation_date;

    const end = new Date(endStr);
    const start = new Date(end);
    start.setDate(start.getDate() - 14); // Exactly 15 continuous calendar days ending on latest observation date

    const map = new Map();
    for (const r of sorted) {
      map.set(r.observation_date, r);
    }

    const list = [];
    const cur = new Date(start);
    while (cur <= end) {
      const dStr = cur.toISOString().slice(0, 10);
      const rec = map.get(dStr);
      list.push({
        observation_date: dStr,
        arrival_quantity: rec ? Number(rec.arrival_quantity) : null,
        arrival_unit: rec?.arrival_unit || 'Tonnes',
        market_name: rec?.market_name || selectedMarket,
        crop_name: cropDisplayName,
        is_reported: !!rec
      });
      cur.setDate(cur.getDate() + 1);
    }
    return list;
  }, [arrivalHistory, selectedMarket, cropDisplayName]);

  return (
    <div className="space-y-6 text-left">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">
          {t('arrivals.title')}
        </h2>
        <p className="text-xs text-slate-500">
          {t('arrivals.subtitle')}
        </p>
      </div>

      {/* Filter Selector Bar */}
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

      {/* 4 Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Latest Reported Inflow */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>{t('arrivals.latestInflow')}</span>
            <Truck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-black text-slate-900 tracking-tight">
            {latestRecord ? `${Number(latestRecord.arrival_quantity).toLocaleString('en-IN')} Tonnes` : 'N/A'}
          </div>
          <div className="text-[11px] text-slate-500">
            {latestRecord ? `Reported: ${latestRecord.observation_date}` : 'No recent report'}
          </div>
        </div>

        {/* Card 2: Period Total */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>{t('arrivals.periodTotal')}</span>
            <Layers className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-xl font-black text-slate-900 tracking-tight">
            {totalPeriodArrivals > 0 ? `${Math.round(totalPeriodArrivals).toLocaleString('en-IN')} Tonnes` : 'N/A'}
          </div>
          <div className="text-[11px] text-slate-500">
            Cumulative recorded inflow
          </div>
        </div>

        {/* Card 3: Daily Average Arrival */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>{t('arrivals.dailyAverage')}</span>
            <Activity className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-xl font-black text-slate-900 tracking-tight">
            {avgDailyArrival > 0 ? `${Math.round(avgDailyArrival).toLocaleString('en-IN')} Tonnes/day` : 'N/A'}
          </div>
          <div className="text-[11px] text-slate-500">
            Across {validArrivals.length} active reporting days
          </div>
        </div>

        {/* Card 4: Active Reporting Sessions */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>{t('arrivals.activeSessions')}</span>
            <Calendar className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-xl font-black text-slate-900 tracking-tight">
            {validArrivals.length} Days
          </div>
          <div className="text-[11px] text-slate-500">
            Market auctions logged
          </div>
        </div>
      </div>

      {/* Daily Mandi Arrivals Vertical Bar Chart (Latest 15 Calendar Days) */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {t('arrivals.chartTitle')} — Latest 15 Calendar Days ({selectedMarket})
            </h3>
            <p className="text-xs text-slate-500">
              Displaying arrival inflows for {cropDisplayName} across the most recent 15 calendar days
            </p>
          </div>
          <div className="flex items-center space-x-2 self-start sm:self-auto">
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md">
              Unit: Tonnes
            </span>
          </div>
        </div>

        <DataStateView
          loading={loading}
          error={error}
          isEmpty={calendarChartData.length === 0}
          emptyMessage={`No historical arrivals reported for ${cropDisplayName} at ${selectedMarket}.`}
          onRetry={() => loadArrivals(pagination.page, true)}
        >
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={calendarChartData} margin={{ top: 24, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis 
                  dataKey="observation_date" 
                  tick={{ fontSize: 11, fill: '#64748b' }} 
                  tickFormatter={(val) => val.slice(5)} 
                />
                <YAxis 
                  tick={{ fontSize: 11, fill: '#64748b' }} 
                  label={{ value: 'Tonnes', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#64748b' }}
                />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-lg text-xs space-y-1">
                          <div className="font-bold text-slate-800">{d.observation_date}</div>
                          <div className="text-slate-600">Crop: <span className="font-semibold text-slate-900">{d.crop_name}</span></div>
                          <div className="text-slate-600">Market: <span className="font-semibold text-slate-900">{d.market_name}</span></div>
                          {d.is_reported ? (
                            <div className="font-bold text-emerald-700 pt-0.5">
                              Arrival: {Number(d.arrival_quantity).toLocaleString('en-IN')} {d.arrival_unit}
                            </div>
                          ) : (
                            <div className="text-amber-600 italic pt-0.5">No report (market closed / holiday)</div>
                          )}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar 
                  dataKey="arrival_quantity" 
                  fill="#059669" 
                  radius={[4, 4, 0, 0]} 
                  maxBarSize={44}
                  name="Arrival Quantity"
                >
                  <LabelList 
                    dataKey="arrival_quantity" 
                    position="top" 
                    formatter={(val) => (val !== null && val !== undefined && val > 0) ? `${Math.round(val)}t` : ''} 
                    style={{ fontSize: '10px', fontWeight: 700, fill: '#047857' }} 
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </DataStateView>

        <div className="flex items-center space-x-2 text-xs text-slate-500 pt-2 border-t border-slate-100">
          <Info className="w-4 h-4 text-emerald-600 shrink-0" />
          <p>
            The latest 15 calendar days are displayed with calendar continuity. Missing bars indicate non-trading or holiday sessions without fabrication.
          </p>
        </div>
      </div>

      {/* Historical Price-Arrival Relationship & Farmer Guidance Card (Phase 7 Requirement) */}
      {analysisData && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
                <Scale className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {t('arrivals.priceArrivalHeading')}
                </h3>
                <p className="text-xs text-slate-500">
                  {t('arrivals.priceArrivalSub')}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 text-xs font-semibold self-start sm:self-auto">
              <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md">
                {analysisData.sample_count || validArrivals.length} {t('arrivals.observationsAnalyzed')}
              </span>
              {analysisData.selected_lag !== undefined && (
                <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-md">
                  {t('arrivals.optimalLag')}: {analysisData.selected_lag === 0 ? 'Same-day' : `${analysisData.selected_lag} Days`}
                </span>
              )}
            </div>
          </div>

          {/* Farmer-Friendly Interpretation (Zero Raw Formulas or Confusing Statistics in Main View) */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-medium">
              {analysisData.interpretation || 'Statistical analysis indicates that market price levels are primarily influenced by multi-day arrivals and seasonal factors.'}
            </p>
          </div>

          {/* Optional Toggle for Technical Lag Analysis Breakdown */}
          {analysisData.lagged_correlations && Object.keys(analysisData.lagged_correlations).length > 0 && (
            <div className="space-y-2">
              <button
                onClick={() => setShowLagDetails(!showLagDetails)}
                className="inline-flex items-center space-x-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 transition-colors"
              >
                <span>{showLagDetails ? t('arrivals.hideTechnicalDetails') : t('arrivals.showTechnicalDetails')}</span>
                {showLagDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {showLagDetails && (
                <div className="overflow-x-auto pt-2">
                  <table className="w-full text-left text-xs border border-slate-200 rounded-xl overflow-hidden">
                    <thead className="bg-slate-100 text-slate-700 uppercase font-bold text-[11px]">
                      <tr>
                        <th className="py-2.5 px-3">Arrival Lag Period</th>
                        <th className="py-2.5 px-3 text-right">Pearson Correlation (r)</th>
                        <th className="py-2.5 px-3 text-right">P-Value</th>
                        <th className="py-2.5 px-3 text-right">Sample Pairs</th>
                        <th className="py-2.5 px-3 text-center">Statistical Significance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-slate-700 bg-white">
                      {Object.entries(analysisData.lagged_correlations).map(([k, v]) => (
                        <tr key={k} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-semibold text-slate-900">
                            {v.lag_days === 0 ? 'Same Day (Lag 0)' : `${v.lag_days} Days Later`}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold">
                            {v.correlation !== null ? v.correlation : 'N/A'}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-500">
                            {v.p_value !== null ? v.p_value : 'N/A'}
                          </td>
                          <td className="py-2 px-3 text-right">
                            {v.sample_count || 'N/A'}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              v.is_significant
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}>
                              {v.is_significant ? 'Significant (p < 0.05)' : 'Not Significant'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          <div className="text-[11px] text-slate-400 border-t border-slate-100 pt-2">
            {t('arrivals.causationDisclaimer')}
          </div>
        </div>
      )}

      {/* Date-Wise Arrivals Table (Newest Records First with Pagination) */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {t('arrivals.dailyArrivalsTitle')} — {selectedMarket}
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Showing page {pagination.page} of {totalPages} ({pagination.total} records total)
            </p>
          </div>
          <button
            onClick={() => loadArrivals(pagination.page, true)}
            title="Refresh arrivals"
            className="p-1.5 text-slate-500 hover:text-emerald-700 rounded-lg hover:bg-slate-100 transition-colors self-start sm:self-auto"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <DataStateView
          loading={loading}
          error={error}
          isEmpty={tableData.length === 0}
          emptyMessage={`No arrival records found for ${cropDisplayName} at ${selectedMarket}.`}
          onRetry={() => loadArrivals(pagination.page, true)}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">{t('common.date')}</th>
                  <th className="py-3 px-4">Crop</th>
                  <th className="py-3 px-4">{t('common.market')}</th>
                  <th className="py-3 px-4 text-right">Arrival Quantity</th>
                  <th className="py-3 px-4 text-center">Unit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {tableData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                      {row.observation_date}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800">
                      {cropDisplayName}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {row.market_name}
                    </td>
                    <td className="py-3 px-4 text-right font-black text-emerald-800 text-sm">
                      {row.arrival_quantity !== null && row.arrival_quantity !== undefined 
                        ? Number(row.arrival_quantity).toLocaleString('en-IN') 
                        : 'N/A'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded text-[11px] font-semibold">
                        {row.arrival_unit || 'Tonnes'}
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
