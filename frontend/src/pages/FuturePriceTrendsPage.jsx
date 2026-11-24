import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { fetchForecastSupport, fetchForecast } from '../services/api';
import { DataStateView } from '../components/DataStateView';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid 
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Store, 
  Clock, 
  Calendar,
  Truck,
  Sparkles,
  AlertCircle,
  HelpCircle,
  Activity,
  Info
} from 'lucide-react';

export const FuturePriceTrendsPage = () => {
  const { t, language } = useLanguage();
  const [searchParams] = useSearchParams();

  const initialCrop = searchParams.get('crop') || 'cotton';
  const [selectedCrop, setSelectedCrop] = useState(initialCrop);
  const [selectedMarket, setSelectedMarket] = useState('Warangal APMC');
  const [availableMarkets, setAvailableMarkets] = useState([]);
  const [selectedHorizon, setSelectedHorizon] = useState(15); // strictly 7, 15, or 30
  
  const [forecastData, setForecastData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);

  const crops = [
    { id: 'cotton', nameEn: 'Cotton', nameTe: 'పత్తి' },
    { id: 'dry_chillies', nameEn: 'Dry Chillies', nameTe: 'ఎండు మిర్చి' },
    { id: 'maize', nameEn: 'Maize', nameTe: 'మొక్కజొన్న' },
    { id: 'turmeric', nameEn: 'Turmeric', nameTe: 'పసుపు' },
    { id: 'groundnut', nameEn: 'Groundnut', nameTe: 'వేరుశనగ' },
    { id: 'paddy', nameEn: 'Paddy', nameTe: 'వరి (వడ్లు)' },
    { id: 'red_gram', nameEn: 'Red Gram', nameTe: 'కందులు' }
  ];

  const durations = [
    { days: 7, label: t('forecast.duration7') },
    { days: 15, label: t('forecast.duration15') },
    { days: 30, label: t('forecast.duration30') }
  ];

  // Dynamically load eligible Warangal markets for selected crop
  useEffect(() => {
    let isMounted = true;
    const loadMarkets = async () => {
      try {
        const support = await fetchForecastSupport();
        if (isMounted) {
          const mktNames = (support?.rows || [])
            .filter(r => r.crop_id === selectedCrop && r.supported)
            .sort((a, b) => b.observations - a.observations)
            .map(r => r.market_name);
          setAvailableMarkets(mktNames);
          if (mktNames.length === 0) {
            setSelectedMarket('');
            setForecastData(null);
            setErrorMessage('No Warangal market has enough recent price history for a forecast of this crop.');
          } else if (!mktNames.includes(selectedMarket)) {
            setSelectedMarket(mktNames[0]);
          }
        }
      } catch (err) {
        console.error('Error fetching forecast markets:', err);
      }
    };
    loadMarkets();
    return () => { isMounted = false; };
  }, [selectedCrop]);

  // Load forecast whenever crop, market, or duration changes
  const loadForecastData = useCallback(async () => {
    if (!selectedMarket) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      const fc = await fetchForecast(selectedCrop, selectedMarket, selectedHorizon);
      if (fc && fc.status === 'SUCCESS' && fc.future_points?.length > 0) {
        setForecastData(fc);
      } else {
        setForecastData(null);
        setErrorMessage(fc?.message || 'Forecast could not be generated for this selection.');
      }
    } catch (err) {
      console.error('Forecast fetch error:', err);
      setForecastData(null);
      setErrorMessage('Unable to retrieve price forecast at this time.');
    } finally {
      setLoading(false);
    }
  }, [selectedCrop, selectedMarket, selectedHorizon]);

  useEffect(() => {
    loadForecastData();
  }, [loadForecastData]);

  const selectedCropObj = crops.find(c => c.id === selectedCrop);
  const cropDisplayName = language === 'te' ? selectedCropObj?.nameTe : selectedCropObj?.nameEn;

  // Future points for graph
  const futurePoints = forecastData?.future_points || [];
  
  // Format graph data to compute range spread for Recharts stacked area
  const chartData = futurePoints.map(pt => ({
    date: pt.date,
    lower_bound: pt.lower_bound,
    range_span: Math.max(0, pt.upper_bound - pt.lower_bound),
    upper_bound: pt.upper_bound
  }));

  const trend = forecastData?.trend_direction;
  const isUp = trend === 'INCREASING';
  const isDown = trend === 'DECREASING';

  return (
    <div className="space-y-6 text-left">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">
          {t('forecast.title')}
        </h2>
        <p className="text-xs text-slate-500">
          {t('forecast.subtitle')}
        </p>
      </div>

      {/* 3 Farmer Controls: Crop, Market, Duration */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        {/* Row 1: Crop Selection Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider mr-2">
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

        {/* Row 2: Market Dropdown and Duration Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-slate-100">
          {/* Explicit Market Selection */}
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

          {/* Strictly 7, 15, or 30 Days Selection */}
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-bold text-slate-700 whitespace-nowrap">
              {t('forecast.selectDuration')}:
            </span>
            <div className="inline-flex p-1 bg-slate-100 rounded-lg border border-slate-200">
              {durations.map((d) => (
                <button
                  key={d.days}
                  onClick={() => setSelectedHorizon(d.days)}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                    selectedHorizon === d.days
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Forecast Output Boundary */}
      <DataStateView
        loading={loading}
        error={errorMessage && errorMessage.includes('Unable') ? errorMessage : null}
        isEmpty={!loading && !forecastData}
        emptyMessage={errorMessage || t('common.noData')}
        onRetry={loadForecastData}
        skeletonRows={6}
      >
        {forecastData && (
          <div className="space-y-6">
            {/* Top Summary Banner: Expected Price Range & Trend Badge */}
            <div className="bg-gradient-to-r from-emerald-900 to-slate-900 text-white rounded-3xl p-6 shadow-sm border border-emerald-800/50 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                      {cropDisplayName} — {selectedMarket}
                    </span>
                    {/* Trend Badge */}
                    <span className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      isUp 
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40' 
                        : isDown 
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-400/40' 
                          : 'bg-amber-500/20 text-amber-300 border border-amber-400/40'
                    }`}>
                      {isUp && <TrendingUp className="w-3.5 h-3.5" />}
                      {isDown && <TrendingDown className="w-3.5 h-3.5" />}
                      {!isUp && !isDown && <Minus className="w-3.5 h-3.5" />}
                      <span>{forecastData.trend_label}</span>
                    </span>
                  </div>

                  {/* Main Top Summary Requirement */}
                  <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    {forecastData.expected_range_summary}
                  </h3>

                  <div className="text-xs text-slate-300 flex items-center space-x-2">
                    <span>Latest reported price: <strong>₹{Number(forecastData.latest_actual_price).toLocaleString('en-IN')}/Qtl</strong></span>
                    <span>•</span>
                    <span>Forecast origin: {forecastData.forecast_origin_date}</span>
                  </div>
                </div>

                {/* Price Range Display */}
                <div className="bg-white/10 backdrop-blur-md px-5 py-4 rounded-2xl border border-white/20 text-center shrink-0">
                  <span className="text-[11px] uppercase tracking-wider text-slate-300 font-semibold block">
                    {selectedHorizon}-Day Expected Range
                  </span>
                  <span className="text-2xl sm:text-3xl font-black text-amber-300 tracking-tight">
                    ₹{forecastData.lower_bound_final?.toLocaleString('en-IN')} – ₹{forecastData.upper_bound_final?.toLocaleString('en-IN')}
                  </span>
                  <span className="text-xs block text-slate-300 mt-0.5">
                    ₹ per quintal
                  </span>
                </div>
              </div>
            </div>

            {/* Forecast Graph: Future Dates ONLY with Shaded Area Range */}
            {chartData.length > 0 && (
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      {t('forecast.chartTitle')} — {selectedHorizon} Days Ahead
                    </h3>
                    <p className="text-xs text-slate-500">
                      {t('forecast.chartSub')}
                    </p>
                  </div>
                  <div className="flex items-center space-x-3 text-xs font-semibold">
                    <span className="inline-flex items-center space-x-1.5 text-purple-700 bg-purple-50 px-2.5 py-1 rounded-md border border-purple-200">
                      <span className="w-3 h-3 bg-purple-400 rounded-sm"></span>
                      <span>Expected Price Range</span>
                    </span>
                  </div>
                </div>

                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fontSize: 11, fill: '#64748b' }} 
                        tickFormatter={(val) => val.slice(5)} 
                      />
                      <YAxis 
                        tick={{ fontSize: 11, fill: '#64748b' }} 
                        domain={['dataMin - 150', 'dataMax + 150']} 
                        label={{ value: '₹ / Quintal', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#64748b' }}
                      />
                      <Tooltip 
                        formatter={(val, name, item) => {
                          const lb = item.payload.lower_bound;
                          const ub = item.payload.upper_bound;
                          return [`₹${lb.toLocaleString('en-IN')} – ₹${ub.toLocaleString('en-IN')} per quintal`, 'Expected Price Range'];
                        }}
                        labelFormatter={(lbl) => `Forecast Date: ${lbl}`}
                      />
                      {/* Transparent baseline below lower bound */}
                      <Area 
                        type="monotone" 
                        dataKey="lower_bound" 
                        stackId="range" 
                        stroke="none" 
                        fill="transparent" 
                      />
                      {/* Shaded price uncertainty band between lower and upper bounds */}
                      <Area 
                        type="monotone" 
                        dataKey="range_span" 
                        stackId="range" 
                        stroke="#7c3aed" 
                        strokeWidth={1.5}
                        fill="#8b5cf6" 
                        fillOpacity={0.25} 
                        name="Expected Price Range"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <p className="text-[11px] text-slate-400 pt-2 border-t border-slate-100">
                  {t('forecast.disclaimer')}
                </p>
              </div>
            )}

            {/* Dedicated Evidence-Based Reason Section: "Why is this price trend expected?" */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <HelpCircle className="w-5 h-5 text-emerald-600" />
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                      Why is this price trend expected?
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500">
                    Evidence-based market factors and statistical rationale for {cropDisplayName} at {selectedMarket} ({selectedHorizon}-Day Horizon)
                  </p>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <span className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                    isUp 
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                      : isDown 
                        ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}>
                    {isUp && <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />}
                    {isDown && <TrendingDown className="w-3.5 h-3.5 text-rose-600" />}
                    {!isUp && !isDown && <Minus className="w-3.5 h-3.5 text-amber-600" />}
                    <span>{forecastData.trend_label} ({forecastData.expected_change_pct > 0 ? `+${forecastData.expected_change_pct}` : forecastData.expected_change_pct}%)</span>
                  </span>
                </div>
              </div>

              {/* Price Movement Anchor Summary */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4 text-slate-500" />
                  <span className="text-slate-600">Latest Actual Modal Price:</span>
                  <span className="font-bold text-slate-900">₹{Number(forecastData.latest_actual_price).toLocaleString('en-IN')}/Qtl</span>
                  <span className="text-slate-400">({forecastData.forecast_origin_date})</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Activity className="w-4 h-4 text-emerald-600" />
                  <span className="text-slate-600">{selectedHorizon}-Day Projected Midpoint:</span>
                  <span className="font-bold text-emerald-700">
                    ₹{Number(forecastData.trend_explanation?.final_expected_price || forecastData.future_points?.[forecastData.future_points.length - 1]?.expected_mid || 0).toLocaleString('en-IN')}/Qtl
                  </span>
                </div>
              </div>

              {/* Summary Explanation */}
              <p className="text-sm text-slate-700 leading-relaxed font-normal">
                {forecastData.trend_explanation?.summary_text || forecastData.farmer_explanation}
              </p>

              {/* 4 Data-Backed Evidence Drivers */}
              <div className="space-y-2.5 pt-1">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Key Market Drivers & Statistical Evidence:
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(forecastData.trend_explanation?.evidence_points || [
                    `Recent 7-session trading momentum and short-term volatility anchor the baseline modal price near ₹${Number(forecastData.latest_actual_price).toLocaleString('en-IN')}/Qtl.`,
                    `Mandi arrival inflows at ${selectedMarket} provide physical volume context for market clearances.`,
                    `${selectedHorizon}-day horizon dynamics reflect prevailing seasonal cropping patterns in Warangal district.`,
                    `Machine-learning time-series features evaluate lag pricing and arrival trends to compute projection intervals.`
                  ]).map((point, index) => (
                    <div key={index} className="flex items-start space-x-2.5 p-3 rounded-xl bg-slate-50/70 border border-slate-200/60 text-xs text-slate-700 leading-relaxed">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold shrink-0 mt-0.5">
                        {index + 1}
                      </span>
                      <span>{point}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Limitation / Advisory Footnote */}
              <div className="flex items-center space-x-2 text-[11px] text-slate-400 pt-2 border-t border-slate-100">
                <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>
                  {forecastData.trend_explanation?.data_limitations || 'Predictions are synthesized from verified APMC transaction records and time-series models.'}
                </span>
              </div>
            </div>

            {/* Farmer Marketing Guidance & Evidence-Based Outlook */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Evidence-Based Price Outlook */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center space-x-2 text-emerald-800">
                  <Sparkles className="w-5 h-5 text-emerald-600" />
                  <h4 className="text-sm font-bold uppercase tracking-wider">
                    {t('forecast.outlookHeading')}
                  </h4>
                </div>
                <p className="text-sm text-slate-700 leading-relaxed">
                  {forecastData.farmer_explanation}
                </p>
              </div>

              {/* Farmer Selling Context */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center space-x-2 text-emerald-800">
                  <Store className="w-5 h-5 text-emerald-600" />
                  <h4 className="text-sm font-bold uppercase tracking-wider">
                    {t('forecast.sellingGuidanceHeading')}
                  </h4>
                </div>
                <p className="text-sm text-slate-700 leading-relaxed">
                  {forecastData.farmer_guidance}
                </p>
              </div>
            </div>

            {/* Historical Mandi Arrival Context (Zero Fabricated Future Arrivals) */}
            {forecastData.recent_arrival_context && (
              <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 space-y-2">
                <div className="flex items-center space-x-2 text-slate-800">
                  <Truck className="w-5 h-5 text-emerald-600" />
                  <h4 className="text-sm font-bold uppercase tracking-wider">
                    {t('forecast.recentArrivalsHeading')}
                  </h4>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {forecastData.recent_arrival_context.summary}
                </p>
                {forecastData.recent_arrival_context.latest_arrival_tonnes && (
                  <div className="text-xs font-semibold text-slate-700 pt-1">
                    Latest recorded arrival volume: <span className="text-emerald-700 font-bold">{forecastData.recent_arrival_context.latest_arrival_tonnes} Tonnes</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </DataStateView>
    </div>
  );
};
