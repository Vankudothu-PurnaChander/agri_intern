import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Sprout, Globe, MapPin } from 'lucide-react';

export const Navbar = ({ onToggleSidebar }) => {
  const { language, toggleLanguage, t } = useLanguage();

  return (
    <header className="sticky top-0 z-30 bg-emerald-800 text-white shadow-md border-b border-emerald-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Brand & Region */}
          <div className="flex items-center space-x-3">
            <button
              onClick={onToggleSidebar}
              className="lg:hidden p-2 rounded-md text-emerald-100 hover:bg-emerald-700 focus:outline-none"
              aria-label="Toggle menu"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <div className="flex items-center space-x-2">
              <div className="p-2 bg-emerald-600 rounded-lg shadow-inner">
                <Sprout className="w-6 h-6 text-amber-300" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white leading-tight">
                  {t('app.title')}
                </h1>
                <div className="flex items-center text-xs text-emerald-200 space-x-1">
                  <MapPin className="w-3 h-3 text-amber-300" />
                  <span>{t('app.district')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Actions: Language Switcher */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center bg-emerald-900/70 p-1 rounded-full border border-emerald-700">
              <Globe className="w-4 h-4 text-emerald-300 ml-2 mr-1" />
              <button
                onClick={() => toggleLanguage('en')}
                className={`px-3 py-1 text-xs font-semibold rounded-full transition-all duration-150 ${
                  language === 'en'
                    ? 'bg-amber-400 text-emerald-950 shadow-sm'
                    : 'text-emerald-200 hover:text-white'
                }`}
              >
                English
              </button>
              <button
                onClick={() => toggleLanguage('te')}
                className={`px-3 py-1 text-xs font-semibold rounded-full transition-all duration-150 ${
                  language === 'te'
                    ? 'bg-amber-400 text-emerald-950 shadow-sm'
                    : 'text-emerald-200 hover:text-white'
                }`}
              >
                తెలుగు
              </button>
            </div>
          </div>

        </div>
      </div>
    </header>
  );
};

