import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as authApi from '../api/auth';

const LoginPage: React.FC = () => {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [joinMode, setJoinMode] = useState<'new' | 'join'>('new');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyCode, setCompanyCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await authApi.login(email, password);
      login(data);
      navigate('/assets');
    } catch {
      setError('이메일 또는 비밀번호가 올바르지 않습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const options =
        joinMode === 'new'
          ? { company_name: companyName }
          : { company_code: companyCode };
      await authApi.register(email, password, name, options);
      setTab('login');
    } catch {
      setError('회원가입에 실패했습니다. 이미 사용 중인 이메일이거나 초대 코드가 유효하지 않습니다.');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">JHAM</h1>
          <p className="text-sm text-gray-500 mt-1">자산 관리 시스템</p>
        </div>

        {/* 로그인/회원가입 탭 */}
        <div className="flex border border-gray-200 rounded-lg p-1 mb-6">
          {(['login', 'register'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => { setTab(t); setError(''); }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                tab === t ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'login' ? '로그인' : '회원가입'}
            </button>
          ))}
        </div>

        {tab === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                required className={inputCls} placeholder="email@example.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                required className={inputCls} placeholder="••••••••" />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-4">
            {/* 새 회사 / 기존 회사 참여 토글 */}
            <div className="flex border border-gray-200 rounded-lg p-1">
              {(['new', 'join'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setJoinMode(m); setError(''); }}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    joinMode === m ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {m === 'new' ? '새 회사 만들기' : '초대 코드로 참여'}
                </button>
              ))}
            </div>

            {joinMode === 'new' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">회사명 *</label>
                <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)}
                  required className={inputCls} placeholder="회사 이름" />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">초대 코드 *</label>
                <input type="text" value={companyCode} onChange={(e) => setCompanyCode(e.target.value)}
                  required className={inputCls} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
                <p className="text-xs text-gray-400 mt-1">회사 관리자에게 초대 코드를 받으세요.</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">이름</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                required className={inputCls} placeholder="홍길동" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                required className={inputCls} placeholder="email@example.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                required minLength={8} className={inputCls} placeholder="8자 이상" />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {loading ? '처리 중...' : '회원가입'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default LoginPage;
