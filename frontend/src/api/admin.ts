import client from './client';

export interface AdminCompany {
  pid: string;
  name: string;
  user_count: number;
  created_at: string;
}

export interface AdminUser {
  pid: string;
  name: string;
  email: string;
  is_admin: boolean;
  company_pid: string | null;
  company_name: string | null;
  created_at: string;
}

export const listAdminCompanies = () =>
  client.get<AdminCompany[]>('/admin/companies').then((r) => r.data);

export const deleteAdminCompany = (pid: string) =>
  client.delete(`/admin/companies/${pid}`);

export const listAdminUsers = () =>
  client.get<AdminUser[]>('/admin/users').then((r) => r.data);

export const setUserAdmin = (pid: string, is_admin: boolean) =>
  client.patch(`/admin/users/${pid}/is-admin`, { is_admin });

export const deleteAdminUser = (pid: string) =>
  client.delete(`/admin/users/${pid}`);
