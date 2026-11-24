import React from 'react';
import { NavLink } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { 
  LayoutDashboard, 
  TrendingUp, 
  Truck, 
  Scale, 
  BrainCircuit 
} from 'lucide-react';

export const Sidebar = ({ isOpen, onClose }) => {
  const { t } = useLanguage();

  const navItems = [
    {
      to: '/',
      label: t('nav.dashboard'),
      icon: LayoutDashboard
    },
    {
      to: '/prices',
      label: t('nav.currentPrices'),
      icon: TrendingUp
    },
    {
      to: '/arrivals',
      label: t('nav.arrivals'),
      icon: Truck
    },
    {
      to: '/comparison',
      label: t('nav.mandiComparison'),
      icon: Scale
    },
    {
      to: '/forecast',
      label: t('nav.futureTrends'),
      icon: BrainCircuit
    }
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-40 lg:hidden" 
          onClick={onClose}
        />
      )}

      {/* Sidebar container */}
      <aside className={`
        fixed lg:static top-16 bottom-0 left-0 z-40
        w-64 bg-white border-r border-slate-200 flex flex-col justify-between
        transform transition-transform duration-200 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-4 space-y-2 overflow-y-auto">
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  onClick={() => onClose && onClose()}
                  className={({ isActive }) => `
                    flex items-center px-3.5 py-3 rounded-lg text-sm font-medium transition-colors
                    ${isActive 
                      ? 'bg-emerald-50 text-emerald-800 border-l-4 border-emerald-600 font-semibold' 
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'}
                  `}
                >
                  <Icon className="w-5 h-5 mr-3 shrink-0 text-emerald-700" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>
      </aside>
    </>
  );
};
