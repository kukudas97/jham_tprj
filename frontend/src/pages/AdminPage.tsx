import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import {
  listAdminCompanies,
  deleteAdminCompany,
  listAdminUsers,
  setUserAdmin,
  deleteAdminUser,
  type AdminCompany,
  type AdminUser,
} from '../api/admin';

type Tab = 'companies' | 'users';

const AdminPage: React.FC = () => {
  const { user: me } = useAuth();
  const [tab, setTab] = useState<Tab>('companies');

  const [companies, setCompanies] = useState<AdminCompany[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);

  if (!me?.is_admin) return <Navigate to="/assets" replace />;

  const loadCompanies = async () => {
    setLoading(true);
    try {
      setCompanies(await listAdminCompanies());
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      setUsers(await listAdminUsers());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'companies') loadCompanies();
    else loadUsers();
  }, [tab]);

  const handleDeleteCompany = async (c: AdminCompany) => {
    if (!confirm(`"${c.name}" 회사를 삭제하시겠습니까?\n소속 사용자는 회사 없음 상태가 됩니다.`))
      return;
    await deleteAdminCompany(c.pid);
    setCompanies((prev) => prev.filter((x) => x.pid !== c.pid));
  };

  const handleToggleAdmin = async (u: AdminUser) => {
    const next = !u.is_admin;
    const label = next ? '관리자로 지정' : '관리자 해제';
    if (!confirm(`"${u.name}"을 ${label}하시겠습니까?`)) return;
    await setUserAdmin(u.pid, next);
    setUsers((prev) => prev.map((x) => (x.pid === u.pid ? { ...x, is_admin: next } : x)));
  };

  const handleDeleteUser = async (u: AdminUser) => {
    if (!confirm(`"${u.name}" (${u.email}) 사용자를 삭제하시겠습니까?`)) return;
    await deleteAdminUser(u.pid);
    setUsers((prev) => prev.filter((x) => x.pid !== u.pid));
  };

  const tabCls = (t: Tab) =>
    `px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
      tab === t
        ? 'bg-indigo-600 text-white'
        : 'text-gray-600 hover:bg-gray-100'
    }`;

  return (
    <Layout>
      <div className="p-4 sm:p-6 max-w-6xl mx-auto">
        <div className="mb-5">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">관리자 패널</h1>
          <p className="text-sm text-gray-500 mt-1">전체 회사 및 사용자 관리</p>
        </div>

        <div className="flex gap-2 mb-6">
          <button type="button" className={tabCls('companies')} onClick={() => setTab('companies')}>
            회사 목록
          </button>
          <button type="button" className={tabCls('users')} onClick={() => setTab('users')}>
            사용자 목록
          </button>
        </div>

        {tab === 'companies' && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 sm:px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <span className="font-semibold text-gray-800">
                전체 회사 <span className="text-gray-400 font-normal">({companies.length})</span>
              </span>
              <button type="button" onClick={loadCompanies}
                className="text-xs text-gray-500 hover:text-indigo-600 px-2 py-1 rounded hover:bg-gray-50">
                새로고침
              </button>
            </div>
            {loading ? (
              <div className="py-16 text-center text-gray-400">로딩 중...</div>
            ) : companies.length === 0 ? (
              <div className="py-16 text-center text-gray-400">등록된 회사가 없습니다.</div>
            ) : (
              <>
                {/* 데스크톱 테이블 */}
                <table className="hidden sm:table w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                      <th className="text-left px-5 py-3 font-medium">회사명</th>
                      <th className="text-center px-5 py-3 font-medium">사용자 수</th>
                      <th className="text-left px-5 py-3 font-medium">생성일</th>
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {companies.map((c) => (
                      <tr key={c.pid} className="hover:bg-gray-50/50">
                        <td className="px-5 py-3.5 font-medium text-gray-900">{c.name}</td>
                        <td className="px-5 py-3.5 text-center">
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold">
                            {c.user_count}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-gray-500">{c.created_at.slice(0, 10)}</td>
                        <td className="px-5 py-3.5 text-right">
                          <button type="button" onClick={() => handleDeleteCompany(c)}
                            className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-colors">
                            삭제
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {/* 모바일 카드 */}
                <div className="sm:hidden divide-y divide-gray-100">
                  {companies.map((c) => (
                    <div key={c.pid} className="px-4 py-3.5 flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{c.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{c.created_at.slice(0, 10)} · 사용자 {c.user_count}명</p>
                      </div>
                      <button type="button" onClick={() => handleDeleteCompany(c)}
                        className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded flex-shrink-0">
                        삭제
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {tab === 'users' && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 sm:px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <span className="font-semibold text-gray-800">
                전체 사용자 <span className="text-gray-400 font-normal">({users.length})</span>
              </span>
              <button type="button" onClick={loadUsers}
                className="text-xs text-gray-500 hover:text-indigo-600 px-2 py-1 rounded hover:bg-gray-50">
                새로고침
              </button>
            </div>
            {loading ? (
              <div className="py-16 text-center text-gray-400">로딩 중...</div>
            ) : users.length === 0 ? (
              <div className="py-16 text-center text-gray-400">등록된 사용자가 없습니다.</div>
            ) : (
              <>
                {/* 데스크톱 테이블 */}
                <table className="hidden sm:table w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                      <th className="text-left px-5 py-3 font-medium">이름</th>
                      <th className="text-left px-5 py-3 font-medium">이메일</th>
                      <th className="text-left px-5 py-3 font-medium">소속 회사</th>
                      <th className="text-center px-5 py-3 font-medium">관리자</th>
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {users.map((u) => (
                      <tr key={u.pid} className="hover:bg-gray-50/50">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold flex-shrink-0">
                              {u.name.charAt(0)}
                            </div>
                            <span className="font-medium text-gray-900">{u.name}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-gray-500">{u.email}</td>
                        <td className="px-5 py-3.5">
                          {u.company_name ? <span className="text-gray-700">{u.company_name}</span> : <span className="text-gray-400 text-xs">없음</span>}
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <button type="button" onClick={() => handleToggleAdmin(u)}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${u.is_admin ? 'bg-indigo-600' : 'bg-gray-200'}`}
                            title={u.is_admin ? '관리자 해제' : '관리자 지정'}>
                            <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${u.is_admin ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                          </button>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          {u.pid !== me?.pid && (
                            <button type="button" onClick={() => handleDeleteUser(u)}
                              className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-colors">
                              삭제
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {/* 모바일 카드 */}
                <div className="sm:hidden divide-y divide-gray-100">
                  {users.map((u) => (
                    <div key={u.pid} className="px-4 py-3.5 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-sm font-bold flex-shrink-0">
                        {u.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-gray-900 text-sm">{u.name}</span>
                          {u.is_admin && <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-md">관리자</span>}
                        </div>
                        <p className="text-xs text-gray-500 truncate mt-0.5">{u.email}</p>
                        <p className="text-xs text-gray-400">{u.company_name ?? '소속 없음'}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button type="button" onClick={() => handleToggleAdmin(u)}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${u.is_admin ? 'bg-indigo-600' : 'bg-gray-200'}`}>
                          <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${u.is_admin ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                        </button>
                        {u.pid !== me?.pid && (
                          <button type="button" onClick={() => handleDeleteUser(u)}
                            className="text-xs text-red-500 px-2 py-1 rounded">
                            삭제
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default AdminPage;
