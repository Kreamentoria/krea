import axios from 'axios';
import { ApiResponse, CurrentRates, RateRecord } from './types';

const client = axios.create({ baseURL: '/api' });

export async function fetchCurrentRates(): Promise<CurrentRates> {
  const { data } = await client.get<ApiResponse<CurrentRates>>('/rates');
  if (!data.success) throw new Error(data.error ?? 'Failed to fetch rates');
  return data.data;
}

export async function fetchHistory(): Promise<RateRecord[]> {
  const { data } = await client.get<ApiResponse<RateRecord[]>>('/history');
  if (!data.success) throw new Error(data.error ?? 'Failed to fetch history');
  return data.data;
}

export async function refreshRates(): Promise<CurrentRates> {
  const { data } = await client.post<ApiResponse<CurrentRates>>('/rates/refresh');
  if (!data.success) throw new Error(data.error ?? 'Failed to refresh rates');
  return data.data;
}
