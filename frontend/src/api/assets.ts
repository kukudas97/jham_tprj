import client from './client';
import type {
  Asset,
  AssetParams,
  CategoryByDeptResponse,
  CategoryDeptCountResponse,
  DepartmentValueSummary,
  DeptTeamCategoryResponse,
  Inspection,
  InspectionParams,
  QrCode,
} from './types';

export const list = () => client.get<Asset[]>('/assets').then((r) => r.data);

export const get = (pid: string) => client.get<Asset>(`/assets/${pid}`).then((r) => r.data);

export const create = (params: AssetParams) =>
  client.post<Asset>('/assets', params).then((r) => r.data);

export const update = (pid: string, params: AssetParams) =>
  client.put<Asset>(`/assets/${pid}`, params).then((r) => r.data);

export const remove = (pid: string) => client.delete(`/assets/${pid}`);

export const getQr = (pid: string) =>
  client.get<QrCode>(`/assets/${pid}/qr`).then((r) => r.data);

export const listInspections = (pid: string) =>
  client.get<Inspection[]>(`/assets/${pid}/inspections`).then((r) => r.data);

export const addInspection = (pid: string, params: InspectionParams) =>
  client.post<Inspection>(`/assets/${pid}/inspections`, params).then((r) => r.data);

export const updateInspection = (pid: string, params: InspectionParams) =>
  client.put<Inspection>(`/asset_inspections/${pid}`, params).then((r) => r.data);

export const deleteInspection = (pid: string) =>
  client.delete(`/asset_inspections/${pid}`);

export const bulkDeleteInspections = (pids: string[]) =>
  client.delete('/asset_inspections/bulk', { data: { pids } });

export const uploadPhoto = (pid: string, file: File) => {
  const form = new FormData();
  form.append('photo', file);
  return client.post<Asset>(`/assets/${pid}/photo`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((r) => r.data);
};

export const getPublic = (pid: string) =>
  client.get<Asset>(`/assets/public/${pid}`).then((r) => r.data);

export const addPublicInspection = (pid: string, inspector_name: string, note?: string) =>
  client
    .post<Inspection>(`/assets/public/${pid}/inspect`, { inspector_name, note })
    .then((r) => r.data);

export const getDeptValueSummary = () =>
  client.get<DepartmentValueSummary[]>('/assets/summary/department-values').then((r) => r.data);

export const getCategoryByDeptSummary = () =>
  client.get<CategoryByDeptResponse>('/assets/summary/category-by-department').then((r) => r.data);

export const getDeptTeamCategorySummary = () =>
  client.get<DeptTeamCategoryResponse>('/assets/summary/dept-team-category').then((r) => r.data);

export const getCategoryDeptCountSummary = () =>
  client
    .get<CategoryDeptCountResponse>('/assets/summary/category-dept-count')
    .then((r) => r.data);
