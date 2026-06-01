import React, { useCallback, useEffect, useState } from 'react';
import Layout from '../components/Layout';
import * as departmentsApi from '../api/departments';
import type { Department, Team } from '../api/types';

// ─── 인라인 편집 입력 ──────────────────────────────────────────────────────
const InlineInput: React.FC<{
  value: string;
  onSave: (v: string) => void;
  onCancel: () => void;
  placeholder?: string;
}> = ({ value, onSave, onCancel, placeholder }) => {
  const [text, setText] = useState(value);
  return (
    <form
      className="flex items-center gap-1.5"
      onSubmit={(e) => { e.preventDefault(); if (text.trim()) onSave(text.trim()); }}
    >
      <input
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        className="border border-indigo-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 w-44"
      />
      <button type="submit" className="text-xs px-2.5 py-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
        저장
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="text-xs px-2.5 py-1 text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50"
      >
        취소
      </button>
    </form>
  );
};

// ─── 확인 모달 ─────────────────────────────────────────────────────────────
const ConfirmModal: React.FC<{
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ message, onConfirm, onCancel }) => (
  <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-2xl shadow-xl w-full max-w-xs p-6">
      <p className="text-sm text-gray-700 mb-5">{message}</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50"
        >
          취소
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="flex-1 py-2 text-sm font-semibold bg-red-600 text-white rounded-xl hover:bg-red-700"
        >
          삭제
        </button>
      </div>
    </div>
  </div>
);

// ─── 메인 페이지 ───────────────────────────────────────────────────────────
const DepartmentsPage: React.FC = () => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  // 편집 상태: dept / team 레벨
  const [addingDept, setAddingDept] = useState(false);
  const [editingDeptPid, setEditingDeptPid] = useState<string | null>(null);
  const [addingTeamInDept, setAddingTeamInDept] = useState<string | null>(null); // deptPid
  const [editingTeamKey, setEditingTeamKey] = useState<string | null>(null); // `${deptPid}:${teamPid}`
  const [confirmDelete, setConfirmDelete] = useState<{ msg: string; onConfirm: () => void } | null>(
    null,
  );

  const fetchDepartments = useCallback(async () => {
    try {
      setLoading(true);
      const data = await departmentsApi.list();
      setDepartments(data);
    } catch {
      setError('부서 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  // ── 부서 CRUD ────────────────────────────────────────────────────────────
  const handleAddDept = async (name: string) => {
    try {
      const dept = await departmentsApi.create(name);
      setDepartments((prev) => [...prev, dept]);
      setAddingDept(false);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      alert(msg ?? '부서 생성에 실패했습니다.');
    }
  };

  const handleUpdateDept = async (pid: string, name: string) => {
    try {
      const updated = await departmentsApi.update(pid, name);
      setDepartments((prev) => prev.map((d) => (d.pid === pid ? { ...updated, teams: d.teams } : d)));
      setEditingDeptPid(null);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      alert(msg ?? '부서 수정에 실패했습니다.');
    }
  };

  const handleDeleteDept = (dept: Department) => {
    const msg =
      dept.teams.length > 0
        ? `'${dept.name}' 부서와 소속된 ${dept.teams.length}개 팀을 삭제합니다. 계속할까요?`
        : `'${dept.name}' 부서를 삭제합니다. 계속할까요?`;
    setConfirmDelete({
      msg,
      onConfirm: async () => {
        try {
          await departmentsApi.remove(dept.pid);
          setDepartments((prev) => prev.filter((d) => d.pid !== dept.pid));
        } catch {
          alert('부서 삭제에 실패했습니다.');
        } finally {
          setConfirmDelete(null);
        }
      },
    });
  };

  // ── 팀 CRUD ──────────────────────────────────────────────────────────────
  const handleAddTeam = async (deptPid: string, name: string) => {
    try {
      const team = await departmentsApi.createTeam(deptPid, name);
      setDepartments((prev) =>
        prev.map((d) => (d.pid === deptPid ? { ...d, teams: [...d.teams, team] } : d)),
      );
      setAddingTeamInDept(null);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      alert(msg ?? '팀 생성에 실패했습니다.');
    }
  };

  const handleUpdateTeam = async (deptPid: string, team: Team, newName: string) => {
    try {
      await departmentsApi.updateTeam(deptPid, team.pid, newName);
      setDepartments((prev) =>
        prev.map((d) =>
          d.pid === deptPid
            ? { ...d, teams: d.teams.map((t) => (t.pid === team.pid ? { ...t, name: newName } : t)) }
            : d,
        ),
      );
      setEditingTeamKey(null);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      alert(msg ?? '팀 수정에 실패했습니다.');
    }
  };

  const handleDeleteTeam = (deptPid: string, team: Team) => {
    setConfirmDelete({
      msg: `'${team.name}' 팀을 삭제합니다. 계속할까요?`,
      onConfirm: async () => {
        try {
          await departmentsApi.removeTeam(deptPid, team.pid);
          setDepartments((prev) =>
            prev.map((d) =>
              d.pid === deptPid ? { ...d, teams: d.teams.filter((t) => t.pid !== team.pid) } : d,
            ),
          );
        } catch {
          alert('팀 삭제에 실패했습니다.');
        } finally {
          setConfirmDelete(null);
        }
      },
    });
  };

  // ── 기존 자산 자동 매핑 ───────────────────────────────────────────────────
  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const result = await departmentsApi.syncFromAssets();
      setSyncMsg(`자산 ${result.updated}개의 부서/팀 연결이 완료되었습니다.`);
      await fetchDepartments();
    } catch {
      setSyncMsg('자동 매핑에 실패했습니다.');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Layout>
      <div className="p-4 sm:p-6 max-w-3xl mx-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-gray-900">부서 관리</h2>
            <p className="text-xs text-gray-500 mt-0.5">부서와 하위 팀을 관리합니다.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSync}
              disabled={syncing}
              title="기존 자산 부서명/팀명을 기준으로 부서·팀을 자동 생성하고 연결합니다"
              className="px-3 py-2 text-xs font-medium text-indigo-600 border border-indigo-200 rounded-xl hover:bg-indigo-50 disabled:opacity-50 transition-colors"
            >
              {syncing ? '처리 중…' : '기존 자산 자동 매핑'}
            </button>
            <button
              type="button"
              onClick={() => { setAddingDept(true); setEditingDeptPid(null); }}
              className="px-3 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              부서 추가
            </button>
          </div>
        </div>

        {syncMsg && (
          <div className="mb-4 px-4 py-2.5 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
            {syncMsg}
          </div>
        )}

        {error && (
          <div className="mb-4 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            {error}
          </div>
        )}

        {/* 부서 추가 입력 */}
        {addingDept && (
          <div className="mb-3 px-4 py-3 bg-indigo-50 border border-indigo-200 rounded-xl">
            <p className="text-xs font-medium text-indigo-700 mb-2">새 부서 이름</p>
            <InlineInput
              value=""
              placeholder="부서명 입력"
              onSave={handleAddDept}
              onCancel={() => setAddingDept(false)}
            />
          </div>
        )}

        {/* 부서 목록 */}
        {loading ? (
          <div className="text-center py-12 text-gray-400 text-sm">불러오는 중…</div>
        ) : departments.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            등록된 부서가 없습니다.
            <br />
            <span className="text-xs">상단 &apos;부서 추가&apos; 버튼을 클릭하거나, &apos;기존 자산 자동 매핑&apos;을 이용하세요.</span>
          </div>
        ) : (
          <div className="space-y-3">
            {departments.map((dept) => (
              <div key={dept.pid} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                {/* 부서 행 */}
                <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-100">
                  <svg className="w-4 h-4 text-indigo-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>

                  <div className="flex-1 min-w-0">
                    {editingDeptPid === dept.pid ? (
                      <InlineInput
                        value={dept.name}
                        onSave={(v) => handleUpdateDept(dept.pid, v)}
                        onCancel={() => setEditingDeptPid(null)}
                      />
                    ) : (
                      <span className="font-semibold text-sm text-gray-800">{dept.name}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-xs text-gray-400">{dept.teams.length}팀</span>
                    {editingDeptPid !== dept.pid && (
                      <>
                        <button
                          type="button"
                          onClick={() => { setEditingDeptPid(dept.pid); setAddingDept(false); }}
                          className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="부서 이름 수정"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteDept(dept)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="부서 삭제"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* 팀 목록 */}
                <div className="divide-y divide-gray-50">
                  {dept.teams.map((team) => {
                    const teamKey = `${dept.pid}:${team.pid}`;
                    return (
                      <div key={team.pid} className="flex items-center gap-3 px-4 py-2.5 pl-10">
                        <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <div className="flex-1 min-w-0">
                          {editingTeamKey === teamKey ? (
                            <InlineInput
                              value={team.name}
                              onSave={(v) => handleUpdateTeam(dept.pid, team, v)}
                              onCancel={() => setEditingTeamKey(null)}
                            />
                          ) : (
                            <span className="text-sm text-gray-700">{team.name}</span>
                          )}
                        </div>
                        {editingTeamKey !== teamKey && (
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => { setEditingTeamKey(teamKey); setAddingTeamInDept(null); }}
                              className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                              title="팀 이름 수정"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteTeam(dept.pid, team)}
                              className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              title="팀 삭제"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* 팀 추가 입력 */}
                  {addingTeamInDept === dept.pid ? (
                    <div className="px-4 py-2.5 pl-10">
                      <InlineInput
                        value=""
                        placeholder="팀명 입력"
                        onSave={(v) => handleAddTeam(dept.pid, v)}
                        onCancel={() => setAddingTeamInDept(null)}
                      />
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setAddingTeamInDept(dept.pid); setEditingTeamKey(null); }}
                      className="w-full flex items-center gap-2 px-4 py-2 pl-10 text-xs text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                      </svg>
                      팀 추가
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {confirmDelete && (
        <ConfirmModal
          message={confirmDelete.msg}
          onConfirm={confirmDelete.onConfirm}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </Layout>
  );
};

export default DepartmentsPage;
