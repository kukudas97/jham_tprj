import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  const [searchParams] = useSearchParams();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await authApi.login(email, password);
      login(data);
      const redirect = searchParams.get('redirect');
      navigate(redirect ?? '/assets');
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

  const inputCls =
    'w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors placeholder:text-gray-400';

  return (
    <div className="min-h-screen bg-slate-900 flex">
      {/* 왼쪽 브랜딩 패널 (데스크톱) */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-indigo-600 via-indigo-700 to-slate-800 flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <span className="text-white font-bold text-xl tracking-wide">JHAM</span>
        </div>

        <div>
          <h2 className="text-4xl font-bold text-white leading-tight mb-4">
            스마트한<br />자산 관리
          </h2>
          <p className="text-indigo-200 text-base leading-relaxed mb-8">
            QR 코드 기반으로 자산을 등록하고 추적하세요.<br />
            모바일에서도 간편하게 조회하고 점검 이력을 기록합니다.
          </p>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'QR 스캔', desc: '모바일 즉시 조회' },
              { label: '분류 관리', desc: '체계적 분류 체계' },
              { label: '점검 이력', desc: '이력 추적 관리' },
            ].map((f) => (
              <div key={f.label} className="bg-white/10 rounded-xl p-3 backdrop-blur-sm">
                <p className="text-white text-sm font-semibold">{f.label}</p>
                <p className="text-indigo-200 text-xs mt-0.5">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-indigo-300 text-xs">© 2025 JHAM Asset Management</p>
      </div>

      {/* 오른쪽 로그인 패널 */}
      <div className="flex-1 flex items-center justify-center p-6 bg-gray-50">
        <div className="w-full max-w-sm">
          {/* 모바일 로고 */}
          <div className="lg:hidden text-center mb-8">
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900">JHAM</h1>
            <p className="text-sm text-gray-500">자산 관리 시스템</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
            <div className="mb-6">
              <h3 className="text-xl font-bold text-gray-900">
                {tab === 'login' ? '로그인' : '회원가입'}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                {tab === 'login' ? '계정으로 로그인하세요' : '새 계정을 만드세요'}
              </p>
            </div>

            {/* 탭 */}
            <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
              {(['login', 'register'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => { setTab(t); setError(''); }}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                    tab === t
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {t === 'login' ? '로그인' : '회원가입'}
                </button>
              ))}
            </div>

            {tab === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">이메일</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    required className={inputCls} placeholder="email@example.com" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">비밀번호</label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                    required className={inputCls} placeholder="••••••••" />
                </div>
                {error && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl">
                    <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}
                <button type="submit" disabled={loading}
                  className="w-full py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm mt-2">
                  {loading ? '로그인 중...' : '로그인'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="flex bg-gray-100 rounded-xl p-1">
                  {(['new', 'join'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => { setJoinMode(m); setError(''); }}
                      className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
                        joinMode === m
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {m === 'new' ? '새 회사 만들기' : '초대 코드로 참여'}
                    </button>
                  ))}
                </div>

                {joinMode === 'new' ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">회사명 *</label>
                    <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)}
                      required className={inputCls} placeholder="회사 이름" />
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">초대 코드 *</label>
                    <input type="text" value={companyCode} onChange={(e) => setCompanyCode(e.target.value)}
                      required className={inputCls} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
                    <p className="text-xs text-gray-400 mt-1">회사 관리자에게 초대 코드를 받으세요.</p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">이름</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                    required className={inputCls} placeholder="홍길동" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">이메일</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    required className={inputCls} placeholder="email@example.com" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">비밀번호</label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                    required minLength={8} className={inputCls} placeholder="8자 이상" />
                </div>
                {error && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl">
                    <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}
                <button type="submit" disabled={loading}
                  className="w-full py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm">
                  {loading ? '처리 중...' : '회원가입'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
