import client from './client';
import type { Category, FieldDef } from './types';

export const list = () => client.get<Category[]>('/categories').then((r) => r.data);

export interface CreateCategoryParams {
  name: string;
  parent_pid?: string;
  require_serial_number?: boolean;
  require_location?: boolean;
  require_note?: boolean;
}

export interface UpdateCategoryParams {
  name: string;
  require_serial_number?: boolean;
  require_location?: boolean;
  require_note?: boolean;
}

export const create = (params: CreateCategoryParams) =>
  client.post<Category>('/categories', params).then((r) => r.data);

export const update = (pid: string, params: UpdateCategoryParams) =>
  client.put<Category>(`/categories/${pid}`, params).then((r) => r.data);

export const remove = (pid: string) => client.delete(`/categories/${pid}`);

// Field def CRUD
export interface CreateFieldDefParams {
  field_name: string;
  field_label: string;
  is_required?: boolean;
  sort_order?: number;
}

export interface UpdateFieldDefParams {
  field_name: string;
  field_label: string;
  is_required?: boolean;
  sort_order?: number;
}

export const listFieldDefs = (catPid: string) =>
  client.get<FieldDef[]>(`/categories/${catPid}/fields`).then((r) => r.data);

export const createFieldDef = (catPid: string, params: CreateFieldDefParams) =>
  client.post<FieldDef>(`/categories/${catPid}/fields`, params).then((r) => r.data);

export const updateFieldDef = (catPid: string, fieldPid: string, params: UpdateFieldDefParams) =>
  client.put<FieldDef>(`/categories/${catPid}/fields/${fieldPid}`, params).then((r) => r.data);

export const removeFieldDef = (catPid: string, fieldPid: string) =>
  client.delete(`/categories/${catPid}/fields/${fieldPid}`);
