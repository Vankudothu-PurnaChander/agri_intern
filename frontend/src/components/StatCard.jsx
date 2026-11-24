import React from 'react';

export const StatCard = ({ title, value, subtitle, icon: Icon, color = 'emerald' }) => {
  const colorMap = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    purple: 'bg-purple-50 text-purple-700 border-purple-100'
  };

  const iconBgMap = {
    emerald: 'bg-emerald-100 text-emerald-700',
    amber: 'bg-amber-100 text-amber-700',
    blue: 'bg-blue-100 text-blue-700',
    purple: 'bg-purple-100 text-purple-700'
  };

  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center space-x-4 text-left">
      {Icon && (
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${iconBgMap[color] || iconBgMap.emerald}`}>
          <Icon className="w-6 h-6" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider truncate">
          {title}
        </div>
        <div className="text-2xl font-black text-slate-900 tracking-tight mt-0.5">
          {value}
        </div>
        {subtitle && (
          <div className="text-xs text-slate-400 mt-0.5 truncate">
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
};

