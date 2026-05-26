export interface LoginResponse {
  token: string;
  pid: string;
  name: string;
  is_verified: boolean;
  company_id: number | null;
  company_pid: string | null;
}

export interface Asset {
  pid: string;
  name: string;
  serial_number: string | null;
  location: string | null;
  note: string | null;
}

export interface AssetParams {
  name: string;
  serial_number?: string;
  location?: string;
  note?: string;
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
