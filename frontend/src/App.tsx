import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import AuthGuard from './components/AuthGuard';
import LoginPage from './pages/LoginPage';
import AssetsPage from './pages/AssetsPage';
import AssetDetailPage from './pages/AssetDetailPage';
import AssetCategoriesPage from './pages/AssetCategoriesPage';
import UploadPage from './pages/UploadPage';
import QrScanPage from './pages/QrScanPage';
import HelpPage from './pages/HelpPage';

const App: React.FC = () => (
  <AuthProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/qr/:pid" element={<QrScanPage />} />
        <Route
          path="/assets"
          element={
            <AuthGuard>
              <AssetsPage />
            </AuthGuard>
          }
        />
        <Route
          path="/assets/:pid"
          element={
            <AuthGuard>
              <AssetDetailPage />
            </AuthGuard>
          }
        />
        <Route
          path="/categories"
          element={
            <AuthGuard>
              <AssetCategoriesPage />
            </AuthGuard>
          }
        />
        <Route
          path="/upload"
          element={
            <AuthGuard>
              <UploadPage />
            </AuthGuard>
          }
        />
        <Route
          path="/help"
          element={
            <AuthGuard>
              <HelpPage />
            </AuthGuard>
          }
        />
        <Route path="/" element={<Navigate to="/assets" replace />} />
        <Route path="*" element={<Navigate to="/assets" replace />} />
      </Routes>
    </BrowserRouter>
  </AuthProvider>
);

export default App;
