import client from './client';
import type { Asset, AssetParams, Inspection, QrCode } from './types';

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

export const addInspection = (pid: string, inspector_name: string, note?: string) =>
  client
    .post<Inspection>(`/assets/${pid}/inspections`, { inspector_name, note })
    .then((r) => r.data);

export const getPublic = (pid: string) =>
  client.get<Asset>(`/assets/public/${pid}`).then((r) => r.data);

export const addPublicInspection = (pid: string, inspector_name: string, note?: string) =>
  client
    .post<Inspection>(`/assets/public/${pid}/inspect`, { inspector_name, note })
    .then((r) => r.data);
