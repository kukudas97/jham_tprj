import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import QrScannerModal from './QrScannerModal';

const navItem = 'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-blue-50 hover:text-blue-700 transition-colors';
const activeNav = 'bg-blue-50 text-blue-700';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [scannerOpen, setScannerOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {scannerOpen && <QrScannerModal onClose={() => setScannerOpen(false)} />}

      {/* 사이드바 */}
      <aside className="w-60 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col">
        <div className="px-5 py-5 border-b border-gray-100">
          <h1 className="text-lg font-bold text-gray-900">JHAM</h1>
          <p className="text-xs text-gray-400 mt-0.5">자산 관리 시스템</p>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          <button
            type="button"
            onClick={() => setScannerOpen(true)}
            className={`w-full ${navItem}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 3.5a.5.5 0 11-1 0 .5.5 0 011 0zM6 12.5a.5.5 0 11-1 0 .5.5 0 011 0zM4 4h5v5H4V4zm11 0h5v5h-5V4zM4 15h5v5H4v-5z" />
            </svg>
            QR 스캔
          </button>
          <NavLink
            to="/assets"
            className={({ isActive }) => `${navItem} ${isActive ? activeNav : ''}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            자산 목록
          </NavLink>
          <NavLink
            to="/categories"
            className={({ isActive }) => `${navItem} ${isActive ? activeNav : ''}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            자산 분류
          </NavLink>
          <NavLink
            to="/upload"
            className={({ isActive }) => `${navItem} ${isActive ? activeNav : ''}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Excel 업로드
          </NavLink>
          <NavLink
            to="/help"
            className={({ isActive }) => `${navItem} ${isActive ? activeNav : ''}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            사용방법
          </NavLink>
        </nav>

        <div className="p-3 border-t border-gray-100 space-y-1">
          <div className="px-3 py-1.5 text-xs text-gray-500 truncate">{user?.name}</div>
          {user?.company_pid && (
            <div className="px-3 py-2 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-400 mb-1">초대 코드</p>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(user.company_pid ?? '');
                }}
                className="w-full text-left font-mono text-xs text-gray-600 truncate hover:text-blue-600 transition-colors"
                title="클릭하여 복사"
              >
                {user.company_pid}
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            로그아웃
          </button>
        </div>
      </aside>

      {/* 메인 컨텐츠 */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
};

export default Layout;
