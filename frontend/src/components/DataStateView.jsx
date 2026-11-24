import React from 'react';
import { RefreshCw, AlertTriangle, Database, Info } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

/**
 * Universal Data State Boundary Component.
 * Strictly distinguishes Loading, Success with Data, Success without Data,
 * API Network Error, Database Error, and ML Forecasting Failure.
 */
export const DataStateView = ({
  loading,
  error,
  isEmpty,
  emptyMessage,
  onRetry,
  children,
  skeletonRows = 4
}) => {
  const { t } = useLanguage();

  // 1. Loading State (Skeleton pulse loaders)
  if (loading) {
    return (
      <div className="space-y-3 p-6 bg-white rounded-3xl border border-slate-200">
        <div className="flex items-center space-x-2 text-xs font-semibold text-emerald-800 mb-2">
          <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
          <span>{t('common.loading')}</span>
        </div>
        {Array.from({ length: skeletonRows }).map((_, i) => (
          <div key={i} className="h-9 bg-slate-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  // 2. Error State (Network, Server, or Database error with Retry button)
  if (error) {
    const isDbError = typeof error === 'string' && error.toLowerCase().includes('database');
    const Icon = isDbError ? Database : AlertTriangle;

    return (
      <div className="bg-rose-50 border border-rose-200 rounded-3xl p-6 text-left space-y-3">
        <div className="flex items-center space-x-2 text-rose-800 font-bold text-sm">
          <Icon className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{isDbError ? 'Database Connection Notice' : 'Data Retrieval Failure'}</span>
        </div>
        <p className="text-xs text-rose-700 leading-relaxed">
          {typeof error === 'string' ? error : (error.message || 'Unable to retrieve records from the market server.')}
        </p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition-colors shadow-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{t('common.refresh')}</span>
          </button>
        )}
      </div>
    );
  }

  // 3. Success without Data (Empty State)
  if (isEmpty) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-3xl p-8 text-center space-y-2">
        <Info className="w-8 h-8 text-slate-400 mx-auto" />
        <h4 className="text-sm font-bold text-slate-700">
          {emptyMessage || t('common.noData')}
        </h4>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          No trading observations have been logged for this specific combination. Try selecting another active APMC market yard.
        </p>
      </div>
    );
  }

  // 4. Success with Data
  return children;
};

