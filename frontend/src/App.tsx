import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import AuthGuard from './components/AuthGuard';
import LoginPage from './pages/LoginPage';
import AssetsPage from './pages/AssetsPage';
import AssetCategoriesPage from './pages/AssetCategoriesPage';
import DepartmentsPage from './pages/DepartmentsPage';
import UploadPage from './pages/UploadPage';
import QrScanPage from './pages/QrScanPage';
import HelpPage from './pages/HelpPage';
import InspectionsPage from './pages/InspectionsPage';
import ReportsPage from './pages/ReportsPage';
import AdminPage from './pages/AdminPage';

const AssetPidRedirect: React.FC = () => {
  const { pid } = useParams<{ pid: string }>();
  return <Navigate to={`/assets?open=${pid}`} replace />;
};

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
              <AssetPidRedirect />
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
          path="/departments"
          element={
            <AuthGuard>
              <DepartmentsPage />
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
        <Route
          path="/inspections"
          element={
            <AuthGuard>
              <InspectionsPage />
            </AuthGuard>
          }
        />
        <Route
          path="/reports"
          element={
            <AuthGuard>
              <ReportsPage />
            </AuthGuard>
          }
        />
        <Route
          path="/admin"
          element={
            <AuthGuard>
              <AdminPage />
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
