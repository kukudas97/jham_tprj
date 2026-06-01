import client from './client';
import type { Department, Team } from './types';

export const list = (): Promise<Department[]> =>
  client.get<Department[]>('/departments').then((r) => r.data);

export const create = (name: string): Promise<Department> =>
  client.post<Department>('/departments', { name }).then((r) => r.data);

export const update = (pid: string, name: string): Promise<Department> =>
  client.put<Department>(`/departments/${pid}`, { name }).then((r) => r.data);

export const remove = (pid: string): Promise<void> =>
  client.delete(`/departments/${pid}`).then(() => undefined);

export const createTeam = (deptPid: string, name: string): Promise<Team> =>
  client.post<Team>(`/departments/${deptPid}/teams`, { name }).then((r) => r.data);

export const updateTeam = (deptPid: string, teamPid: string, name: string): Promise<Team> =>
  client.put<Team>(`/departments/${deptPid}/teams/${teamPid}`, { name }).then((r) => r.data);

export const removeTeam = (deptPid: string, teamPid: string): Promise<void> =>
  client.delete(`/departments/${deptPid}/teams/${teamPid}`).then(() => undefined);

export const syncFromAssets = (): Promise<{ updated: number }> =>
  client.post<{ updated: number }>('/departments/sync', {}).then((r) => r.data);
