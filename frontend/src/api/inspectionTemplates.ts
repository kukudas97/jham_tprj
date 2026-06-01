import client from './client';
import type { InspectionTemplate, InspectionTemplateParams } from './types';

export const list = () =>
  client.get<InspectionTemplate[]>('/inspection_templates').then((r) => r.data);

export const create = (params: InspectionTemplateParams) =>
  client.post<InspectionTemplate>('/inspection_templates', params).then((r) => r.data);

export const update = (pid: string, params: InspectionTemplateParams) =>
  client.put<InspectionTemplate>(`/inspection_templates/${pid}`, params).then((r) => r.data);

export const remove = (pid: string) => client.delete(`/inspection_templates/${pid}`);
