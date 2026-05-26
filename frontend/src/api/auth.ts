import client from './client';
import type { LoginResponse } from './types';

export const login = (email: string, password: string) =>
  client.post<LoginResponse>('/auth/login', { email, password }).then((r) => r.data);

export const register = (
  email: string,
  password: string,
  name: string,
  options: { company_name?: string; company_code?: string },
) => client.post('/auth/register', { email, password, name, ...options }).then((r) => r.data);

export const current = () =>
  client.get<LoginResponse>('/auth/current').then((r) => r.data);
