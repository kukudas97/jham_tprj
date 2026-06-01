import React, { useCallback, useEffect, useState } from 'react';
import Layout from '../components/Layout';
import * as departmentsApi from '../api/departments';
import type { Department, Team } from '../api/types';

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
        <button type="button" onClick={onCancel}
          className="flex-1 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">
          취소
        </button>
        <button type="button" onClick={onConfirm}
          className="flex-1 py-2 text-sm font-semibold bg-red-600 text-white rounded-xl hover:bg-red-700">
          삭제
        </button>
      </div>
    </div>
  </div>
);

// ─── 인라인 편집 행 ────────────────────────────────────────────────────────
const InlineEditRow: React.FC<{
  colSpan: number;
  value: string;
  onSave: (v: string) => void;
  onCancel: () => void;
  placeholder?: string;
}> = ({ colSpan, value, onSave, onCancel, placeholder }) => {
  const [text, setText] = useState(value);
  return (
    <tr className="bg-indigo-50">
      <td colSpan={colSpan} className="px-4 py-2">
        <form className="flex items-center gap-2"
          onSubmit={(e) => { e.preventDefault(); if (text.trim()) onSave(text.trim()); }}>
          <input
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={placeholder}
            className="flex-1 border border-indigo-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <button type="submit"
            className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
            저장
          </button>
          <button type="button" onClick={onCancel}
            className="px-3 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">
            취소
          </button>
        </form>
      </td>
    </tr>
  );
};

// ─── 작업 버튼 ─────────────────────────────────────────────────────────────
const ActionBtn: React.FC<{ icon: 'edit' | 'delete'; onClick: () => void; title: string }> = ({
  icon, onClick, title,
}) => (
  <button type="button" onClick={onClick} title={title}
    className={`p-1.5 rounded-lg transition-colors ${
      icon === 'edit'
        ? 'text-gray-400 hover:text-indigo-600 hover:bg-indigo-50'
        : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
    }`}>
    {icon === 'edit' ? (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ) : (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    )}
  </button>
);

// ─── 메인 ──────────────────────────────────────────────────────────────────
const DepartmentsPage: React.FC = () => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDeptPid, setSelectedDeptPid] = useState<string | null>(null);

  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  // 부서 편집 상태
  const [editingDeptPid, setEditingDeptPid] = useState<string | null>(null);
  const [addingDept, setAddingDept] = useState(false);

  // 팀 편집 상태
  const [editingTeamPid, setEditingTeamPid] = useState<string | null>(null);
  const [addingTeam, setAddingTeam] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<{ msg: string; onConfirm: () => void } | null>(null);

  const fetchDepartments = useCallback(async () => {
    try {
      setLoading(true);
      const data = await departmentsApi.list();
      setDepartments(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDepartments(); }, [fetchDepartments]);

  const selectedDept = departments.find((d) => d.pid === selectedDeptPid) ?? null;

  // ── 에러 핸들러 공통 ──────────────────────────────────────────────────────
  const apiMsg = (e: unknown) =>
    (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? '오류가 발생했습니다.';

  // ── 부서 CRUD ────────────────────────────────────────────────────────────
  const handleAddDept = async (name: string) => {
    try {
      const dept = await departmentsApi.create(name);
      setDepartments((prev) => [...prev, dept]);
      setAddingDept(false);
    } catch (e) { alert(apiMsg(e)); }
  };

  const handleUpdateDept = async (pid: string, name: string) => {
    try {
      const updated = await departmentsApi.update(pid, name);
      setDepartments((prev) =>
        prev.map((d) => (d.pid === pid ? { ...updated, teams: d.teams } : d)),
      );
      setEditingDeptPid(null);
    } catch (e) { alert(apiMsg(e)); }
  };

  const handleDeleteDept = (dept: Department) => {
    const msg =
      dept.teams.length > 0
        ? `'${dept.name}' 부서와 소속 ${dept.teams.length}개 팀을 삭제합니다. 계속할까요?`
        : `'${dept.name}' 부서를 삭제합니다. 계속할까요?`;
    setConfirmDelete({
      msg,
      onConfirm: async () => {
        try {
          await departmentsApi.remove(dept.pid);
          setDepartments((prev) => prev.filter((d) => d.pid !== dept.pid));
          if (selectedDeptPid === dept.pid) setSelectedDeptPid(null);
        } catch { alert('부서 삭제에 실패했습니다.'); }
        finally { setConfirmDelete(null); }
      },
    });
  };

  // ── 팀 CRUD ──────────────────────────────────────────────────────────────
  const handleAddTeam = async (name: string) => {
    if (!selectedDept) return;
    try {
      const team = await departmentsApi.createTeam(selectedDept.pid, name);
      setDepartments((prev) =>
        prev.map((d) => (d.pid === selectedDept.pid ? { ...d, teams: [...d.teams, team] } : d)),
      );
      setAddingTeam(false);
    } catch (e) { alert(apiMsg(e)); }
  };

  const handleUpdateTeam = async (team: Team, newName: string) => {
    if (!selectedDept) return;
    try {
      await departmentsApi.updateTeam(selectedDept.pid, team.pid, newName);
      setDepartments((prev) =>
        prev.map((d) =>
          d.pid === selectedDept.pid
            ? { ...d, teams: d.teams.map((t) => (t.pid === team.pid ? { ...t, name: newName } : t)) }
            : d,
        ),
      );
      setEditingTeamPid(null);
    } catch (e) { alert(apiMsg(e)); }
  };

  const handleDeleteTeam = (team: Team) => {
    if (!selectedDept) return;
    setConfirmDelete({
      msg: `'${team.name}' 팀을 삭제합니다. 계속할까요?`,
      onConfirm: async () => {
        try {
          await departmentsApi.removeTeam(selectedDept.pid, team.pid);
          setDepartments((prev) =>
            prev.map((d) =>
              d.pid === selectedDept.pid
                ? { ...d, teams: d.teams.filter((t) => t.pid !== team.pid) }
                : d,
            ),
          );
        } catch { alert('팀 삭제에 실패했습니다.'); }
        finally { setConfirmDelete(null); }
      },
    });
  };

  // ── 자동 매핑 ─────────────────────────────────────────────────────────────
  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const result = await departmentsApi.syncFromAssets();
      setSyncMsg(`자산 ${result.updated}개 부서/팀 연결 완료`);
      await fetchDepartments();
    } catch { setSyncMsg('자동 매핑에 실패했습니다.'); }
    finally { setSyncing(false); }
  };

  // ─── 공통 테이블 헤더 스타일 ────────────────────────────────────────────
  const thCls = 'px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50';
  const tdCls = 'px-4 py-2.5 text-sm text-gray-800';

  return (
    <Layout>
      <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">

        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">부서 관리</h2>
            <p className="text-xs text-gray-500 mt-0.5">부서와 하위 팀을 관리합니다.</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleSync} disabled={syncing}
              title="기존 자산의 부서명/팀명을 읽어 부서·팀 자동 생성 및 연결 (팀이 없어도 부서만 연결됩니다)"
              className="px-3 py-2 text-xs font-medium text-indigo-600 border border-indigo-200 rounded-xl hover:bg-indigo-50 disabled:opacity-50 transition-colors">
              {syncing ? '처리 중…' : '기존 자산 자동 매핑'}
            </button>
            <button type="button"
              onClick={() => { setAddingDept(true); setEditingDeptPid(null); }}
              className="px-3 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              부서 추가
            </button>
          </div>
        </div>

        {syncMsg && (
          <div className="px-4 py-2.5 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
            {syncMsg}
          </div>
        )}

        {/* ── 부서 그리드 ───────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700">부서 목록</h3>
            <span className="text-xs text-gray-400">{departments.length}개</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className={`${thCls} w-14`}>No.</th>
                  <th className={thCls}>부서명</th>
                  <th className={`${thCls} w-24 text-center`}>팀 수</th>
                  <th className={`${thCls} w-24 text-center`}>작업</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400">불러오는 중…</td></tr>
                ) : departments.length === 0 && !addingDept ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400">
                      등록된 부서가 없습니다. &apos;기존 자산 자동 매핑&apos;을 이용하거나 직접 추가하세요.
                    </td>
                  </tr>
                ) : (
                  departments.map((dept, idx) => (
                    editingDeptPid === dept.pid ? (
                      <InlineEditRow key={dept.pid} colSpan={4} value={dept.name}
                        placeholder="부서명" onSave={(v) => handleUpdateDept(dept.pid, v)}
                        onCancel={() => setEditingDeptPid(null)} />
                    ) : (
                      <tr key={dept.pid}
                        onClick={() => setSelectedDeptPid(dept.pid === selectedDeptPid ? null : dept.pid)}
                        className={`cursor-pointer transition-colors hover:bg-gray-50 ${
                          selectedDeptPid === dept.pid ? 'bg-indigo-50' : ''
                        }`}>
                        <td className={`${tdCls} text-gray-400 text-center`}>{idx + 1}</td>
                        <td className={`${tdCls} font-medium`}>
                          <span className={selectedDeptPid === dept.pid ? 'text-indigo-700' : ''}>
                            {dept.name}
                          </span>
                        </td>
                        <td className={`${tdCls} text-center`}>
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                            {dept.teams.length}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <div className="flex items-center justify-center gap-0.5"
                            onClick={(e) => e.stopPropagation()}>
                            <ActionBtn icon="edit" title="부서 이름 수정"
                              onClick={() => { setEditingDeptPid(dept.pid); setAddingDept(false); }} />
                            <ActionBtn icon="delete" title="부서 삭제"
                              onClick={() => handleDeleteDept(dept)} />
                          </div>
                        </td>
                      </tr>
                    )
                  ))
                )}
                {/* 부서 추가 행 */}
                {addingDept && (
                  <InlineEditRow colSpan={4} value="" placeholder="새 부서명 입력"
                    onSave={handleAddDept} onCancel={() => setAddingDept(false)} />
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── 팀 그리드 (부서 선택 시 표시) ────────────────────────────── */}
        {selectedDept && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <h3 className="text-sm font-semibold text-gray-700">
                  <span className="text-indigo-600">{selectedDept.name}</span> 팀 목록
                </h3>
              </div>
              <button type="button"
                onClick={() => { setAddingTeam(true); setEditingTeamPid(null); }}
                className="px-2.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
                팀 추가
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className={`${thCls} w-14`}>No.</th>
                    <th className={thCls}>팀명</th>
                    <th className={`${thCls} w-24 text-center`}>작업</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {selectedDept.teams.length === 0 && !addingTeam ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-sm text-gray-400">
                        등록된 팀이 없습니다. (팀 없이 부서만 사용 가능합니다)
                      </td>
                    </tr>
                  ) : (
                    selectedDept.teams.map((team, idx) => (
                      editingTeamPid === team.pid ? (
                        <InlineEditRow key={team.pid} colSpan={3} value={team.name}
                          placeholder="팀명" onSave={(v) => handleUpdateTeam(team, v)}
                          onCancel={() => setEditingTeamPid(null)} />
                      ) : (
                        <tr key={team.pid} className="hover:bg-gray-50 transition-colors">
                          <td className={`${tdCls} text-gray-400 text-center`}>{idx + 1}</td>
                          <td className={tdCls}>{team.name}</td>
                          <td className="px-4 py-2.5 text-center">
                            <div className="flex items-center justify-center gap-0.5">
                              <ActionBtn icon="edit" title="팀 이름 수정"
                                onClick={() => { setEditingTeamPid(team.pid); setAddingTeam(false); }} />
                              <ActionBtn icon="delete" title="팀 삭제"
                                onClick={() => handleDeleteTeam(team)} />
                            </div>
                          </td>
                        </tr>
                      )
                    ))
                  )}
                  {addingTeam && (
                    <InlineEditRow colSpan={3} value="" placeholder="새 팀명 입력"
                      onSave={handleAddTeam} onCancel={() => setAddingTeam(false)} />
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!selectedDept && !loading && departments.length > 0 && (
          <p className="text-center text-xs text-gray-400">부서 행을 클릭하면 팀 목록이 표시됩니다.</p>
        )}
      </div>

      {confirmDelete && (
        <ConfirmModal message={confirmDelete.msg}
          onConfirm={confirmDelete.onConfirm}
          onCancel={() => setConfirmDelete(null)} />
      )}
    </Layout>
  );
};

export default DepartmentsPage;
