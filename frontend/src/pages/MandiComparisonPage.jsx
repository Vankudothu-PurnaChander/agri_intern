import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { fetchMandiComparison } from '../services/api';
import { DataStateView } from '../components/DataStateView';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Cell, 
  CartesianGrid,
  LabelList
} from 'recharts';
import { 
  Filter, 
  Trophy, 
  Calendar, 
  Store, 
  AlertCircle,
  TrendingUp,
  RefreshCw 
} from 'lucide-react';

export const MandiComparisonPage = () => {
  const { t, language } = useLanguage();

  const [selectedCrop, setSelectedCrop] = useState('cotton');
  const [comparisonData, setComparisonData] = useState(null);
  const [showAll, setShowAll] = useState(false);
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

  const loadComparison = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMandiComparison(selectedCrop);
      setComparisonData(data);
    } catch (err) {
      console.error('Comparison fetch error:', err);
      setError('Unable to load mandi comparison records. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadComparison();
  }, [selectedCrop]);

  const mandis = comparisonData?.mandis || [];
  const highestPrice = comparisonData?.highestModalPrice;
  const highestMandis = comparisonData?.highestMandis || [];
  const highestMandiDate = comparisonData?.highestMandiDateFormatted || comparisonData?.highestMandiDate;

  // Show top 5 mandis by default, or all mandis if showAll is true
  const displayedMandis = showAll ? mandis : mandis.slice(0, 5);

  const CustomChartTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-lg text-xs space-y-1.5 border border-slate-700">
          <p className="font-bold text-emerald-400 text-sm">{item.marketName}</p>
          <p className="text-slate-200">
            Modal Price: <strong className="text-white font-extrabold">₹{Number(item.modalPrice).toLocaleString('en-IN')}</strong> / Qtl
          </p>
          {item.minPrice && item.maxPrice && (
            <p className="text-slate-400 text-[11px]">
              Range: ₹{Number(item.minPrice).toLocaleString('en-IN')} - ₹{Number(item.maxPrice).toLocaleString('en-IN')}
            </p>
          )}
          <p className="text-amber-300 text-[11px] pt-1 border-t border-slate-800 flex items-center space-x-1">
            <Calendar className="w-3 h-3 inline-block mr-1" />
            <span>Observed Date: {item.observationDateFormatted || item.observationDate}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 text-left">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">
          {t('comparison.title')}
        </h2>
        <p className="text-xs text-slate-500">
          Compare latest reported auction prices across Warangal district APMCs (sorted highest to lowest).
        </p>
      </div>

      {/* Crop Selector Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center gap-4">
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-emerald-600" />
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            {t('common.selectCrop')}:
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5">
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
      </div>

      {/* Mandi Comparison Data State View */}
      <DataStateView
        loading={loading}
        error={error}
        isEmpty={!loading && mandis.length === 0}
        emptyMessage={t('common.noData')}
        onRetry={loadComparison}
        skeletonRows={6}
      >
        <div className="space-y-6">
          {/* Highest Price Mandi Indicator Banner */}
          {highestPrice && (
            <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 rounded-3xl p-6 text-white shadow-md relative overflow-hidden">
              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="inline-flex items-center space-x-1.5 bg-amber-800/60 px-3 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider text-amber-100">
                    <Trophy className="w-3.5 h-3.5 text-amber-200" />
                    <span>Highest Price Mandi</span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-white">
                    {highestMandis.join(', ')}
                  </h3>
                  <div className="flex items-center space-x-2 text-xs text-amber-100">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Latest Observed Date: <strong>{highestMandiDate}</strong></span>
                  </div>
                </div>

                <div className="bg-white/20 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/30 text-center self-start md:self-auto">
                  <span className="text-xs uppercase tracking-wider font-semibold text-amber-100 block">
                    Reported Modal Price
                  </span>
                  <span className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                    ₹{highestPrice.toLocaleString('en-IN')}
                  </span>
                  <span className="text-xs font-bold text-amber-200 block">/quintal</span>
                </div>
              </div>
            </div>
          )}

          {/* Mandi Price Comparison Bar Chart */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {t('comparison.chartTitle')}
                </h3>
                <p className="text-xs text-slate-500">
                  Vertical comparison of latest available modal rates per mandi (₹/Quintal)
                </p>
              </div>

              {/* Top 5 vs All Mandis Selector Toggle */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setShowAll(false)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    !showAll
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Top 5 Mandis
                </button>
                {mandis.length > 5 && (
                  <button
                    type="button"
                    onClick={() => setShowAll(true)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      showAll
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    All Mandis ({mandis.length})
                  </button>
                )}
              </div>
            </div>

            {displayedMandis.length > 0 && (
              <div className="h-88 w-full pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={displayedMandis} margin={{ top: 25, right: 20, left: 10, bottom: 55 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="marketName" 
                      tick={{ fontSize: 11, fill: '#1e293b', fontWeight: 600 }} 
                      angle={-20}
                      textAnchor="end"
                      interval={0}
                      height={60}
                    />
                    <YAxis 
                      tick={{ fontSize: 11, fill: '#64748b' }} 
                      domain={[0, (dataMax) => Math.ceil(dataMax * 1.15)]}
                      label={{ value: '₹ / Quintal', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#64748b' }}
                    />
                    <Tooltip content={<CustomChartTooltip />} />
                    <Bar dataKey="modalPrice" radius={[8, 8, 0, 0]} maxBarSize={56}>
                      <LabelList 
                        dataKey="modalPrice" 
                        position="top" 
                        formatter={(val) => `₹${Number(val).toLocaleString('en-IN')}`} 
                        style={{ fontSize: '11px', fontWeight: 700, fill: '#0f172a' }} 
                      />
                      {displayedMandis.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.modalPrice === highestPrice ? '#d97706' : '#059669'} 
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Comparison Detailed Breakdown Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Latest Mandi Price Comparison Breakdown
                </h3>
                <p className="text-xs text-slate-500">
                  Showing {displayedMandis.length} of {mandis.length} reporting mandis (sorted by modal price descending)
                </p>
              </div>
              {mandis.length > 5 && (
                <button
                  type="button"
                  onClick={() => setShowAll(!showAll)}
                  className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 underline self-start sm:self-auto"
                >
                  {showAll ? 'Show Top 5 Only' : `View All ${mandis.length} Mandis`}
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">{t('common.market')}</th>
                    <th className="py-3 px-4">Latest Observation Date</th>
                    <th className="py-3 px-4 text-right">{t('common.minPrice')}</th>
                    <th className="py-3 px-4 text-right">{t('common.modalPrice')}</th>
                    <th className="py-3 px-4 text-right">{t('common.maxPrice')}</th>
                    <th className="py-3 px-4 text-right">Diff vs Highest</th>
                    <th className="py-3 px-4">{t('common.variety')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {displayedMandis.map((m, idx) => {
                    const diff = m.modalPrice - highestPrice;
                    const isTop = m.modalPrice === highestPrice;
                    return (
                      <tr key={idx} className={`hover:bg-slate-50/80 transition-colors ${isTop ? 'bg-amber-50/40' : ''}`}>
                        <td className="py-3 px-4 font-bold text-slate-900 flex items-center space-x-1.5">
                          {isTop && <Trophy className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />}
                          <span>{m.marketName}</span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 font-medium">
                          <span className="inline-flex items-center space-x-1 bg-slate-100 px-2 py-0.5 rounded text-[11px] text-slate-700">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            <span>{m.observationDateFormatted || m.observationDate}</span>
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right text-slate-600">
                          ₹{m.minPrice ? Number(m.minPrice).toLocaleString('en-IN') : 'N/A'}
                        </td>
                        <td className={`py-3 px-4 text-right font-black text-sm ${isTop ? 'text-amber-800' : 'text-emerald-800'}`}>
                          ₹{Number(m.modalPrice).toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-600">
                          ₹{m.maxPrice ? Number(m.maxPrice).toLocaleString('en-IN') : 'N/A'}
                        </td>
                        <td className="py-3 px-4 text-right font-medium">
                          {isTop ? (
                            <span className="text-amber-700 font-bold bg-amber-100/80 px-2 py-0.5 rounded text-[11px]">
                              Highest Rate
                            </span>
                          ) : (
                            <span className="text-rose-600 font-semibold">
                              -₹{Math.abs(diff).toLocaleString('en-IN')}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-500">{m.variety || 'FAQ'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </DataStateView>
    </div>
  );
};
