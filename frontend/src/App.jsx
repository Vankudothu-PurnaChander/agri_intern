import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LanguageProvider } from './context/LanguageContext';
import { Layout } from './components/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { CurrentPricesPage } from './pages/CurrentPricesPage';
import { MarketArrivalsPage } from './pages/MarketArrivalsPage';
import { MandiComparisonPage } from './pages/MandiComparisonPage';
import { FuturePriceTrendsPage } from './pages/FuturePriceTrendsPage';

function App() {
  return (
    <LanguageProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<DashboardPage />} />
            <Route path="prices" element={<CurrentPricesPage />} />
            <Route path="arrivals" element={<MarketArrivalsPage />} />
            <Route path="comparison" element={<MandiComparisonPage />} />
            <Route path="forecast" element={<FuturePriceTrendsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </LanguageProvider>
  );
}

export default App;
