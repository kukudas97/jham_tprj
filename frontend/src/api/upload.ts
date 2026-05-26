import client from './client';
import type { AssetUpload } from './types';

export const uploadExcel = (file: File) => {
  const form = new FormData();
  form.append('file', file);
  return client
    .post<AssetUpload>('/assets/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then((r) => r.data);
};
