export interface LoginResponse {
  token: string;
  pid: string;
  name: string;
  is_verified: boolean;
  company_id: number | null;
  company_pid: string | null;
}

export interface FieldDef {
  pid: string;
  field_name: string;
  field_label: string;
  is_required: boolean;
  sort_order: number;
}

export interface FieldValue {
  field_def_pid: string;
  field_name: string;
  field_label: string;
  value: string | null;
}

export interface Asset {
  pid: string;
  name: string;
  serial_number: string | null;
  location: string | null;
  note: string | null;
  category_pid: string | null;
  category_name: string | null;
  department_pid: string | null;
  department_name: string | null;
  team_pid: string | null;
  team_name: string | null;
  manager_name: string | null;
  field_values: FieldValue[];
  photo_url: string | null;
}

export interface AssetParams {
  name: string;
  serial_number?: string;
  location?: string;
  note?: string;
  category_pid?: string;
  department_pid?: string;
  team_pid?: string;
  manager_name?: string;
  field_values?: { field_def_pid: string; value?: string }[];
}

export interface SubCategory {
  pid: string;
  name: string;
}

export interface CategoryRequiredFields {
  serial_number: boolean;
  location: boolean;
  note: boolean;
}

export interface Category {
  pid: string;
  name: string;
  children: SubCategory[];
  required_fields: CategoryRequiredFields;
  field_defs: FieldDef[];
}

export interface Inspection {
  pid: string;
  inspector_name: string;
  note: string | null;
}

export interface QrCode {
  pid: string;
  image_path: string;
}

export interface AssetUpload {
  pid: string;
  filename: string;
  status: string;
  error_message: string | null;
}

export interface Team {
  pid: string;
  name: string;
}

export interface Department {
  pid: string;
  name: string;
  teams: Team[];
}
