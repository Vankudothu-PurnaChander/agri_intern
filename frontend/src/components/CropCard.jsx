import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { TrendingUp, TrendingDown, Minus, Calendar, MapPin } from 'lucide-react';

export const CropCard = ({ crop, onSelect, isSelected }) => {
  const { language, t } = useLanguage();
  const displayName = language === 'te' ? crop.displayNameTe : crop.displayNameEn;

  const isUp = crop.trend === 'UPWARD';
  const isDown = crop.trend === 'DOWNWARD';

  // Fallback crop illustrations/emojis if image is missing
  const cropIcons = {
    cotton: '☁️',
    dry_chillies: '🌶️',
    maize: '🌽',
    turmeric: '🟡',
    groundnut: '🥜',
    paddy: '🌾',
    red_gram: '🟤'
  };

  return (
    <div 
      onClick={() => onSelect && onSelect(crop.cropId)}
      className={`
        bg-white rounded-2xl p-5 border transition-all duration-200 cursor-pointer text-left
        ${isSelected 
          ? 'ring-2 ring-emerald-500 border-emerald-500 shadow-md bg-emerald-50/20' 
          : 'border-slate-200 hover:border-emerald-300 hover:shadow-md'}
      `}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center text-2xl shadow-inner">
            {cropIcons[crop.cropId] || '🌱'}
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-base leading-tight">
              {displayName}
            </h3>
            <span className="text-xs text-slate-500">
              {language === 'te' ? crop.displayNameEn : crop.displayNameTe}
            </span>
          </div>
        </div>

        {/* 7-Day Trend Badge */}
        {crop.sevenDayChangePct !== null && crop.sevenDayChangePct !== undefined ? (
          <div className={`
            flex items-center px-2.5 py-1 rounded-full text-xs font-semibold
            ${isUp 
              ? 'bg-emerald-100 text-emerald-800' 
              : isDown 
                ? 'bg-rose-100 text-rose-800' 
                : 'bg-slate-100 text-slate-700'}
          `}>
            {isUp && <TrendingUp className="w-3.5 h-3.5 mr-1 text-emerald-600" />}
            {isDown && <TrendingDown className="w-3.5 h-3.5 mr-1 text-rose-600" />}
            {!isUp && !isDown && <Minus className="w-3.5 h-3.5 mr-1 text-slate-500" />}
            <span>
              {crop.sevenDayChangePct > 0 ? `+${crop.sevenDayChangePct}%` : `${crop.sevenDayChangePct}%`}
            </span>
          </div>
        ) : (
          <span className="text-[11px] text-slate-400 font-medium">
            {t('common.stable')}
          </span>
        )}
      </div>

      {/* Latest Price Display */}
      <div className="mt-4 pt-3 border-t border-slate-100">
        <div className="text-xs text-slate-500 uppercase tracking-wider font-medium">
          {t('common.modalPrice')}
        </div>
        <div className="flex items-baseline space-x-1 mt-0.5">
          {crop.latestModalPrice ? (
            <>
              <span className="text-2xl font-extrabold text-slate-900 tracking-tight">
                ₹{Number(crop.latestModalPrice).toLocaleString('en-IN')}
              </span>
              <span className="text-xs font-semibold text-slate-500">/quintal</span>
            </>
          ) : (
            <span className="text-sm font-medium text-slate-400">
              {t('common.noData')}
            </span>
          )}
        </div>
      </div>

      {/* Historical Price Trend Date Range (Strict Section 2 Requirement) */}
      <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-col space-y-1">
        <div className="text-[11px] font-semibold text-slate-700 flex items-center space-x-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block shrink-0"></span>
          <span className="truncate">
            {crop.trendDateRangeLabel || `Historical price trend: Available data up to ${crop.lastUpdatedDate || 'N/A'}`}
          </span>
        </div>
        {crop.earliestObservationDate && crop.earliestObservationDate !== crop.lastUpdatedDate && (
          <div className="text-[10px] text-slate-400 pl-3">
            Active dates: {crop.earliestObservationDate} to {crop.lastUpdatedDate}
          </div>
        )}
      </div>

      {/* Metadata Footnote */}
      <div className="mt-2.5 pt-2 border-t border-slate-50 flex items-center justify-between text-[11px] text-slate-400">
        <div className="flex items-center space-x-1">
          <Calendar className="w-3 h-3 text-slate-400" />
          <span>{crop.lastUpdatedDate || 'N/A'}</span>
        </div>
        {crop.marketName && (
          <div className="flex items-center space-x-1 truncate max-w-[130px]">
            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
            <span className="truncate">{crop.marketName}</span>
          </div>
        )}
      </div>
    </div>
  );
};

