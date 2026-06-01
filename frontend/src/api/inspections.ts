import client from './client';
import type { InspectionListItem } from './types';

export interface InspectionListQuery {
  asset_name?: string;
  department_pid?: string;
  team_pid?: string;
  inspection_type?: string;
  inspection_result?: string;
  date_from?: string;
  date_to?: string;
}

export const list = (query?: InspectionListQuery) =>
  client.get<InspectionListItem[]>('/inspections', { params: query }).then((r) => r.data);
