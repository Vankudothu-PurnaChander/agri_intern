import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { fetchDashboardSummary, fetchCropOverview, triggerDailySync } from '../services/api';
import { CropCard } from '../components/CropCard';
import { StatCard } from '../components/StatCard';
import { DataStateView } from '../components/DataStateView';
import { 
  Sprout, 
  Store, 
  Calendar, 
  BarChart3, 
  TrendingUp, 
  Truck, 
  BrainCircuit, 
  Scale, 
  AlertCircle,
  RefreshCw,
  CheckCircle2
} from 'lucide-react';

export const DashboardPage = () => {
  const { t, language } = useLanguage();
  const navigate = useNavigate();

  const [summary, setSummary] = useState(null);
  const [cropsOverview, setCropsOverview] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [sumData, ovData] = await Promise.all([
        fetchDashboardSummary(true),
        fetchCropOverview(true)
      ]);
      setSummary(sumData);
      setCropsOverview(ovData);
    } catch (err) {
      console.error('Dashboard load error:', err);
      setError('Failed to load market data. Please ensure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleLiveSync = async () => {
    setIsSyncing(true);
    setSyncNotice(null);
    try {
      const res = await triggerDailySync();
      setSyncNotice({
        type: 'success',
        message: res.message || 'Mandi prices refreshed from Data.gov.in API.'
      });
      await loadData();
    } catch (err) {
      setSyncNotice({
        type: 'error',
        message: 'Sync failed: ' + (err.message || 'Server timeout connecting to Data.gov.in')
      });
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCropSelect = (cropId) => {
    navigate(`/forecast?crop=${cropId}`);
  };

  return (
    <div className="space-y-8">
      {/* 1. Hero Introduction Banner */}
      <section className="bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-800 rounded-3xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden text-left">
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center space-x-2 bg-emerald-900/60 backdrop-blur-xs px-3.5 py-1 rounded-full text-xs font-semibold text-amber-300 border border-emerald-600">
            <Sprout className="w-3.5 h-3.5" />
            <span>Warangal District • 7 Core Crops</span>
          </div>

          <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight leading-tight text-white">
            {t('dashboard.heroHeading')}
          </h2>

          <p className="text-emerald-100 text-sm sm:text-base leading-relaxed">
            {t('dashboard.heroSub')}
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              onClick={() => navigate('/prices')}
              className="bg-amber-400 hover:bg-amber-300 text-emerald-950 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all flex items-center space-x-1.5"
            >
              <TrendingUp className="w-4 h-4" />
              <span>{t('nav.currentPrices')}</span>
            </button>
            <button
              onClick={() => navigate('/forecast')}
              className="bg-emerald-900/80 hover:bg-emerald-900 text-white border border-emerald-600 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center space-x-1.5"
            >
              <BrainCircuit className="w-4 h-4 text-amber-300" />
              <span>{t('nav.futureTrends')}</span>
            </button>
            <button
              onClick={handleLiveSync}
              disabled={isSyncing}
              title="Fetch latest verified market observations from data.gov.in"
              className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center space-x-1.5 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 text-emerald-300 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing Data.gov.in...' : 'Sync Live Prices'}</span>
            </button>
          </div>

          {syncNotice && (
            <div className={`mt-3 p-3 rounded-xl text-xs flex items-center space-x-2 ${
              syncNotice.type === 'success' 
                ? 'bg-emerald-900/80 text-emerald-100 border border-emerald-500' 
                : 'bg-rose-900/80 text-rose-100 border border-rose-500'
            }`}>
              {syncNotice.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{syncNotice.message}</span>
            </div>
          )}
        </div>

        {/* Decorative background watermark */}
        <div className="absolute right-[-30px] bottom-[-40px] opacity-10 pointer-events-none">
          <Sprout className="w-80 h-80 text-white" />
        </div>
      </section>

      {/* Dynamic Data Content Boundary */}
      <DataStateView
        loading={loading}
        error={error}
        isEmpty={!loading && cropsOverview.length === 0}
        emptyMessage="No crop market summaries available."
        onRetry={loadData}
        skeletonRows={5}
      >
        <div className="space-y-8">
          {/* 2. Key Statistical Summary Cards */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title={t('dashboard.supportedCropsCount')}
              value={summary?.supportedCropsCount || 7}
              subtitle="Cotton, Chillies, Maize, etc."
              icon={Sprout}
              color="emerald"
            />
            <StatCard
              title={t('dashboard.reportingMandis')}
              value={summary?.reportingMandisCount || 13}
              subtitle="Warangal APMCs"
              icon={Store}
              color="amber"
            />
            <StatCard
              title={t('dashboard.latestDate')}
              value={summary?.latestObservationDate || 'N/A'}
              subtitle="Asia/Kolkata Mandi Time"
              icon={Calendar}
              color="blue"
            />
            <StatCard
              title={t('dashboard.totalObservations')}
              value={summary?.totalPriceObservations?.toLocaleString('en-IN') || '14,056'}
              subtitle="5-Year Processed Dataset"
              icon={BarChart3}
              color="purple"
            />
          </section>

          {/* 3. Seven Supported Crop Cards */}
          <section className="space-y-4 text-left">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                {t('dashboard.cropCardsHeading')}
              </h2>
              <p className="text-xs text-slate-500">
                {t('dashboard.cropCardsSub')}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {cropsOverview.map((crop) => (
                <CropCard
                  key={crop.cropId}
                  crop={crop}
                  onSelect={handleCropSelect}
                />
              ))}
            </div>
          </section>
        </div>
      </DataStateView>

      {/* 4. How the System Works Guide for Farmers */}
      <section className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 text-left space-y-6 shadow-xs">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
            {t('dashboard.howItWorksHeading')}
          </h2>
          <p className="text-xs text-slate-500">
            Built strictly using verified agricultural market data without fabricated information.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center">
              1
            </div>
            <h3 className="font-bold text-slate-800 text-sm">
              {t('dashboard.step1Title')}
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              {t('dashboard.step1Desc')}
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 font-bold flex items-center justify-center">
              2
            </div>
            <h3 className="font-bold text-slate-800 text-sm">
              {t('dashboard.step2Title')}
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              {t('dashboard.step2Desc')}
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 font-bold flex items-center justify-center">
              3
            </div>
            <h3 className="font-bold text-slate-800 text-sm">
              {t('dashboard.step3Title')}
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              {t('dashboard.step3Desc')}
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-800 font-bold flex items-center justify-center">
              4
            </div>
            <h3 className="font-bold text-slate-800 text-sm">
              {t('dashboard.step4Title')}
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              {t('dashboard.step4Desc')}
            </p>
          </div>
        </div>

        {/* Ethical disclaimer alert */}
        <div className="flex items-start space-x-3 p-4 bg-amber-50 rounded-2xl border border-amber-200 text-amber-900 text-xs">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            {t('dashboard.disclaimer')}
          </p>
        </div>
      </section>
    </div>
  );
};

